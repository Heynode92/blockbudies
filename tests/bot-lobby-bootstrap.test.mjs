import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8').replace(/\r\n/g,'\n');

test('five-star BOT config is initialized before lobby MODES and UI handlers',()=>{
 const manifest=JSON.parse(read('tools/source-manifest.json'));
 const tactical='src/game/89-bot-tactical-intelligence.js';
 const lobby='src/game/85-lobby-and-match.js';
 assert.equal(manifest.parts.filter(p=>p===tactical).length,1);
 assert.ok(manifest.parts.indexOf(tactical)>=0);
 assert.equal(manifest.parts.indexOf(tactical)+1,manifest.parts.indexOf(lobby),
   'tactical config must load immediately before lobby');
 assert.ok(manifest.parts.indexOf(lobby)<manifest.parts.indexOf('src/game/90-bot-ai.js'));
 const tacticalSrc=read(tactical);
 const lobbySrc=read(lobby);
 assert.match(lobbySrc,/df:BOT_TACTICS\.difficulty/);
 assert.match(tacticalSrc,/var BOT_TACTICS=Object\.freeze\(/);
 // Real configuration initialization (not merely matching a comment/string).
 const sandbox=vm.createContext({});
 vm.runInContext(tacticalSrc,sandbox,{filename:tactical});
 assert.equal(vm.runInContext('BOT_TACTICS.difficulty',sandbox),5);
 assert.ok(vm.runInContext('Object.isFrozen(BOT_TACTICS)',sandbox));
});
test('prebuilt browser bundle executes tactical config ahead of lobby',()=>{
 const manifest=JSON.parse(read('tools/source-manifest.json'));
 const bundle=read('assets/game.js');
 const source='(function(){\n'+manifest.parts.map(read).join('')+'})();\n';
 assert.equal(bundle,source,'compiled game.js must exactly match source modules');
 const marker='var BOT_TACTICS=Object.freeze(';
 const modes='var MODES=[';
 assert.ok(bundle.indexOf(marker)>=0&&bundle.indexOf(modes)>=0);
 assert.ok(bundle.indexOf(marker)<bundle.indexOf(modes),'BOT config initialized before lobby MODES');
 new vm.Script(bundle,{filename:'assets/game.js'});
});
