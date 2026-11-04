import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const online=readFileSync(new URL('../src/game/98-online-bridge.js',import.meta.url),'utf8');
const physics=readFileSync(new URL('../src/game/20-sky-and-physics.js',import.meta.url),'utf8');
const offline=readFileSync(new URL('../src/game/86-bomb-mission.js',import.meta.url),'utf8');

function extract(source,begin,end){
 const a=source.indexOf(begin),b=source.indexOf(end,a);
 assert.ok(a>=0&&b>a, 'canonical source section must exist');
 return source.slice(a,b);
}

test('Bomb Mission top scoreboard uses server ROUNDS, never Deathmatch KILLS',()=>{
 assert.match(offline,/ts\[winner\]\+\+/,'offline truth is rounds won');
 const code=extract(online,' var teamScore=isBombMode()?game.rounds:game.teamKills;',' mt.t=');
 function render(bomb,game,initial=[0,0]){
  const ctx={game,ts:initial,isBombMode:()=>bomb,Number,Array};
  runInNewContext(code,ctx);
  return [...ctx.ts];
 }
 const sample={teamKills:[8,15],rounds:[1,2]};
 assert.deepEqual(render(true,sample),[1,2],'screenshot: 8–15 kills must show 1–2 rounds');
 assert.deepEqual(render(false,sample),[8,15],'Deathmatch score remains kills');
 assert.deepEqual(render(true,{teamKills:[100,200],rounds:[2,2]}),[2,2]);
 assert.deepEqual(render(true,{teamKills:[8,15]},[2,1]),[2,1],
  'missing server rounds must never fall back to Deathmatch kills');
});

const collision=extract(physics,'var solidCollisionCache=null;','// Swept axis-separated translation');
const movement=extract(physics,'function moveWithSolidCollision(','// resolve(): pushes entity');
function colliderHarness(){
 const ctx={A:80,OB:[],Map,Math,Number,Array};
 runInNewContext(collision+'\n'+movement+
  '\nthis.blocked=solidPositionBlocked;this.move=moveWithSolidCollision;'+
  'this.invalidate=solidCollisionInvalidate;',ctx);
 return ctx;
}
test('original circular offline body hull has no invisible expanded-AABB corners',()=>{
 const c=colliderHarness();
 c.OB.push({x:0,z:0,hw:1,hd:1,h:2,y0:0});
 assert.equal(c.blocked(1.5,0,1.5,.55),false,
  'the inflated square corner is EMPTY space');
 assert.equal(c.blocked(1.35,0,1.35,.55),true);
 assert.equal(c.blocked(0,0,0,.55),true);
 assert.equal(c.blocked(0,2.1,0,.55),false);
});
test('swept motion stops at actual table and map switching clears old solid lookup',()=>{
 const c=colliderHarness();
 c.OB.push({x:0,z:0,hw:.05,hd:.2,h:1.2,y0:0});
 const p={x:-3,y:0,z:0};
 c.move(p,6,0,.55);
 assert.ok(p.x<-.54,'cannot cross even a narrow grounded table');
 assert.equal(p.z,0);
 // Deliberately swap a same-length geometry array, as selectGameMap does.
 c.OB[0]={x:20,z:0,hw:1,hd:1,h:2,y0:0};
 c.invalidate();
 assert.equal(c.blocked(0,0,0,.55),false,'old hidden arena must not block');
 assert.equal(c.blocked(20,0,0,.55),true,'new arena must be active');
});
