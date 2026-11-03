import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../src/game/98-online-bridge.js',import.meta.url),'utf8');
function extract(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert.ok(a>=0&&b>a);return source.slice(a,b);
}
test('final online state reuses original offline report, no separate modal',()=>{
 const code=extract('function onlineAdoptFinalScore(','function onlineReceiveFrame(');
 assert.match(code,/endMatch\(\)/);
 assert.doesNotMatch(code,/matchExitToLobby\(/);
 assert.doesNotMatch(source,/function onlineShowMatchReport\(/);
});
test('server final scoreboard populates original result K/D and teams',()=>{
 const fragment=extract('function onlineScoreIdentity(','function onlineShowVerifiedReward(');
 const me={name:'You',tm:0,k:0,d:0};
 const ctx={onlineUserId(){return 'me'},pl:{tm:0,st:me},
   onlineScoreboard:new Map(),roomCurrent:{members:[]},ROS:[],ts:[0,0],
   onlineApi:{state:()=>({player:{username:'FIFO',rankIndex:3}})},
   onlinePublicActor:(id)=>({name:id==='me'?'FIFO':'Alex',bot:id==='bot',tm:id==='me'?0:1}),
   isBombMode(){return false},onlineSyncKillDisplay(){}};
 runInNewContext(fragment+'\nthis.adopt=onlineAdoptFinalScore;',ctx);
 assert.equal(ctx.adopt({status:'ACTIVE',scoreboard:[],teamKills:[1,0]}),false);
 assert.equal(ctx.adopt({status:'COMPLETED',teamKills:[50,31],scoreboard:[
  {id:'me',team:0,kills:7,deaths:2},{id:'bot',team:1,kills:6,deaths:5}]}),true);
 assert.equal(me.k,7);assert.equal(me.d,2);assert.equal(ctx.ts[0],50);
 assert.equal(ctx.ROS.length,2);assert.strictEqual(ctx.ROS[0],me);
 assert.equal(ctx.ROS[0].name,'FIFO');assert.equal(ctx.ROS[0].rankIndex,3);
 assert.equal(ctx.ROS[1].name,'Alex');assert.equal(ctx.ROS[1].rankIndex,0);
 assert.equal(ctx.ROS[1].bot,true);
});
test('missing finalization and stalled snapshots have explicit recovery',()=>{
 assert.match(source,/if\(frame.type==='match_failed'\)/);
 assert.match(source,/onlineWatchSnapshots\(now\)/);
 assert.match(source,/onlineMasterStart\(\)/);
});
