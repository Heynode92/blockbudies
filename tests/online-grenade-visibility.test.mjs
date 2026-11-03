import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const online=readFileSync(new URL('../src/game/98-online-bridge.js',import.meta.url),'utf8');
const offline=readFileSync(new URL('../src/game/95-simulation.js',import.meta.url),'utf8');
const viewmodel=readFileSync(new URL('../src/game/99-render-loop.js',import.meta.url),'utf8');

test('online hand-hidden grenade is restored after the original 0.65-second window',()=>{
 const start=online.indexOf('function onlineGrenadePresentationTick(dt){');
 const end=online.indexOf('\n// A server-confirmed throw',start);
 assert.ok(start>=0&&end>start,'grenade visibility ticker must exist');
 const context={pl:{ghide:.65}};
 runInNewContext(online.slice(start,end)+'\nthis.advance=onlineGrenadePresentationTick;',context);
 context.advance(.2);
 assert.ok(Math.abs(context.pl.ghide-.45)<1e-8);
 context.advance(.45);
 assert.equal(context.pl.ghide,0);
 context.advance(1);
 assert.equal(context.pl.ghide,0);
 context.pl.ghide=.65;
 context.advance(-3);
 assert.equal(context.pl.ghide,.65,'invalid negative frame time cannot hide forever');
 context.advance(NaN);
 assert.equal(context.pl.ghide,.65,'invalid NaN frame time is ignored');
 context.advance(.65);
 assert.equal(context.pl.ghide,0);
});

test('same offline animation timer is advanced by online render loop, not ammo policy',()=>{
 assert.match(offline,/pl\.ghide=Math\.max\(0,pl\.ghide-dt\)/);
 assert.match(online,/onlineGrenadePresentationTick\(dt\);/);
 assert.match(online,/if\(frame\.actorId===onlineUserId\(\)\)pl\.ghide=\.65;/);
 assert.match(viewmodel,/g\.visible=i===pl\.w&&!?\(i===5&&pl\.ghide>0\)/);
 assert.match(online,/pl\.ghide=0;document\.body\.classList\.remove\('dead','bomb-spectator'\)/);
});
