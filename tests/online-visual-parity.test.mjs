import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const online=read('src/game/98-online-bridge.js');
const offline=read('src/game/85-lobby-and-match.js');
test('online star rehydration calls original offline star renderer without celebration',()=>{
 assert.match(offline,/function starKill\(silent\)/);
 assert.match(online,/starKill\(true\)/);
 assert.doesNotMatch(online,/star\.innerHTML=STAR/);
});
test('canonical offline toast, impact, and kill feed lifecycles also run online',()=>{
 assert.match(online,/if\(toastT>0&&\(toastT-=dt\)<=0\)/);
 assert.match(online,/effect\.m\.material\.opacity=Math\.max\(0,\.7-effect\.t\*\.7\)/);
 assert.match(online,/kFeed\(killer,Number\.isInteger\(event\.weaponId\)/);
});

test('public KILL identities survive fog-of-war mesh removal',()=>{
 const a=online.indexOf('function onlineCleanCallsign(');
 const b=online.indexOf('// Local display-only movement',a);
 assert.ok(a>0&&b>a);
 const ctx={onlineUserId:()=> 'owner',onlineGame:{scoreboard:[
  {id:'BOT-id',team:1,botName:'Razor'},
  {id:'guest-id',team:0,botName:null}
 ]},onlineScoreboard:new Map(),onlineActors:new Map(),
 roomCurrent:{members:[{playerId:'guest-id',team:0,username:'PLAYER1'}]},
 onlineApi:{state:()=>({player:{username:'FIFO'}})},pl:{tm:0}};
 runInNewContext(online.slice(a,b)+'\nthis.who=onlinePublicActor;',ctx);
 assert.equal(ctx.who('BOT-id').name,'Razor');
 assert.equal(ctx.who('guest-id').name,'PLAYER1');
 assert.equal(ctx.who('owner').name,'FIFO');
 assert.equal(ctx.who('nonexistent').name,'PLAYER');
});
