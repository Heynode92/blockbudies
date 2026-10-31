import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const squad=read('src/game/88-bot-squad.js');
function scene(extra={}){
 const bots=Array.from({length:4},(_,i)=>({tm:0,idx:i,x:0,z:i*.5,dead:false}));
 const enemy={tm:1,idx:0,x:10,z:0,dead:false};
 const c={Math,A:35,tt:1,en:[...bots,enemy],pl:{dead:true,tm:0},
  botTeamReports:[null,null],isBombMode:()=>false,bombMatch:null,
  botMoveUrgent:()=>false,
  inObs:()=>false,botMoveReachable:()=>true,
  ...extra};
 vm.createContext(c);vm.runInContext(squad,c,{filename:'88-bot-squad.js'});
 return{c,bots,enemy};
}
const intent=()=>({retreat:false,hold:false,goal:null});
const report=(c,team=0)=>({x:10,z:0,team,source:'radio',seenAt:1,until:3.4,observer:2});
test('M4: stable team-only entry, left, right and support roles work without a human',()=>{
 const {c,bots,enemy}=scene();
 assert.deepEqual(bots.map(b=>c.botSquadRole(b)),['entry','flank-left','flank-right','support']);
 assert.equal(c.botSquadRole(enemy),'entry');
 bots[0].dead=true;
 assert.deepEqual(bots.slice(1).map(b=>c.botSquadRole(b)),['entry','flank-left','flank-right']);
 assert.equal(c.botSquadRole(bots[0]),null);
});
test('M4: no fresh M1 report means no squad target, regardless of hidden enemy coordinates',()=>{
 const {c,bots,enemy}=scene();
 let a=intent();c.botSquadIntent(bots[1],null,a);
 assert.equal(a.goal,null);
 enemy.x=180;enemy.z=-55;
 a=intent();c.botSquadIntent(bots[1],null,a);
 assert.equal(a.goal,null);
 assert.equal(bots[1].squadGoal,null);
});
test('M4: cross-team, expired and unauthenticated radio data fail closed',()=>{
 const {c,bots}=scene();
 for(const bad of [
  {...report(c),team:1},
  {...report(c),source:'sound'},
  {...report(c),until:.9},
  {...report(c),seenAt:NaN},
  {...report(c),x:Infinity}
 ]){
  c.botTeamReports[0]=bad;
  assert.equal(c.botSquadReport(bots[1]),null);
  const a=intent();c.botSquadIntent(bots[1],null,a);
  assert.equal(a.goal,null);
 }
});
test('M4: legitimate radio contact creates separate reachable flanks and support lanes',()=>{
 const {c,bots}=scene();c.botTeamReports[0]=report(c);
 const output=bots.map(b=>{const a=intent();c.botSquadIntent(b,null,a);return a});
 assert.equal(bots[1].squadRole,'flank-left');
 assert.equal(bots[2].squadRole,'flank-right');
 assert.equal(bots[3].squadRole,'support');
 assert.ok(output[1].goal&&output[2].goal&&output[3].goal);
 assert.ok(output[1].goal[1]<0&&output[2].goal[1]>0);
 assert.ok(Math.hypot(output[1].goal[0]-output[2].goal[0],output[1].goal[1]-output[2].goal[1])>2);
 assert.notDeepEqual(Array.from(output[1].goal),Array.from(output[3].goal));
});
test('M4: repeated live radio updates do not thrash flank A* or block forward progress',()=>{
 let calls=0;const {c,bots}=scene({botMoveReachable(){calls++;return true;}});
 c.botTeamReports[0]=report(c);
 const first=intent();c.botSquadIntent(bots[1],null,first);
 assert.equal(calls,1);
 const x=first.goal[0],z=first.goal[1];
 for(let k=0;k<6;k++){
  c.tt=1+.1*k;c.botTeamReports[0]={...report(c),seenAt:c.tt,until:c.tt+2.4};
  const a=intent();c.botSquadIntent(bots[1],null,a);
  assert.deepEqual(Array.from(a.goal),[x,z]);
 }
 assert.equal(calls,1,'one reachable flank evaluation, not one A* call per frame');
});
test('M4: bounded entry rendezvous never deadlocks on frequently refreshed radio',()=>{
 const {c,bots}=scene();c.botTeamReports[0]=report(c);
 let a=intent();c.botSquadIntent(bots[0],null,a);
 assert.equal(a.hold,true);
 assert.ok(bots[0].squadEntryWaitUntil<=1+c.BOT_SQUAD.entryWaitMax);
 c.tt=1.4;c.botTeamReports[0]={...report(c),seenAt:1.3,until:3.7};
 a=intent();c.botSquadIntent(bots[0],null,a);
 assert.equal(a.hold,false,'new radio sighting must not renew short synchronized entry pause');
 c.tt=1.55;a=intent();c.botSquadIntent(bots[0],null,a);
 assert.equal(a.hold,false);
});
test('M4: if cover, critical retreat or visible combat already owns intent, squad never overrides',()=>{
 const {c,bots,enemy}=scene();c.botTeamReports[0]=report(c);
 for(const variant of [
  {retreat:true,goal:[-5,-5],hold:false},
  {retreat:false,goal:[-2,3],hold:true}
 ]){
  c.botSquadIntent(bots[1],null,variant);
  assert.deepEqual(variant.goal,variant.retreat?[-5,-5]:[-2,3]);
 }
 let a=intent();c.botSquadIntent(bots[1],enemy,a);
 assert.equal(a.goal,null);
 bots[1].m3Mode='cover';
 a=intent();c.botSquadIntent(bots[1],null,a);
 assert.equal(a.goal,null);
});
test('M4: Bomb authority remains unchanged for both teams and all stages',()=>{
 const {c,bots}=scene({isBombMode:()=>true,bombMatch:{state:'planted',done:false}});
 c.botTeamReports[0]=report(c);c.botTeamReports[1]=report(c,1);
 let a=intent();c.botSquadIntent(bots[1],null,a);
 assert.equal(a.goal,null);
 c.botMoveUrgent=()=>true;
 const v=c.botSquadLane(bots[1],1,0);
 assert.deepEqual(Array.from(v),[1,0]);
});
test('M4: invalid or blocked flank candidate falls back to standard pathing without freezing',()=>{
 const {c,bots}=scene({inObs:()=>true});
 c.botTeamReports[0]=report(c);
 let a=intent();c.botSquadIntent(bots[1],null,a);
 assert.equal(a.goal,null);
 assert.ok(bots[1].squadRetryAt>c.tt);
 c.inObs=()=>false;c.botMoveReachable=()=>false;c.tt=2.1;
 a=intent();c.botSquadIntent(bots[1],null,a);
 assert.equal(a.goal,null);
});
test('M4: lane deconfliction uses only living friendlies and keeps unit speed capped',()=>{
 const {c,bots,enemy}=scene();
 bots[1].x=1;bots[1].z=0;
 const v=c.botSquadLane(bots[0],1,0);
 assert.ok(Math.hypot(...v)<=1+1e-9);
 assert.ok(Math.abs(v[1])>0,'must seek staggered entry lane when ally blocks the forward corridor');
 enemy.x=1;enemy.z=0;
 bots[1].dead=true;bots[2].dead=true;bots[3].dead=true;
 const quiet=c.botSquadLane(bots[0],1,0);
 assert.deepEqual(Array.from(quiet),[1,0],'enemy positions are never processed as friendly lane reports');
});
test('M4: squad respawn reset removes expired roles, goals, waits and reservations',()=>{
 const {c,bots}=scene();
 Object.assign(bots[1],{squadRole:'flank-left',squadGoal:[10,-5],
  squadUntil:10,squadRetryAt:10,squadEntryWaitUntil:10,squadEntryCooldownUntil:10});
 c.botSquadReset(bots[1]);
 assert.equal(bots[1].squadRole,null);
 assert.equal(bots[1].squadGoal,null);
 assert.equal(bots[1].squadUntil,0);
 assert.equal(bots[1].squadEntryCooldownUntil,0);
 assert.match(read('src/game/85-lobby-and-match.js'),/botSquadReset\(b\)/);
});
test('M4: only verified M1 radio can drive flank; no global enemy scan or direct position write',()=>{
 assert.doesNotMatch(squad,/en\.filter\(function\(o\)\{return o\.tm!==/);
 assert.doesNotMatch(squad,/\.x\s*\+=|\.z\s*\+=/);
 assert.match(squad,/r\.source!=='radio'/);
 const ai=read('src/game/90-bot-ai.js');
 assert.match(ai,/botSquadIntent\(e,t,intent\)/);
 assert.match(ai,/botSquadLane\(e,mvx,mvz\)/);
 const parts=JSON.parse(read('tools/source-manifest.json')).parts;
 assert.ok(parts.indexOf('src/game/88-bot-perception.js')<
   parts.indexOf('src/game/88-bot-squad.js'));
 assert.ok(parts.indexOf('src/game/88-bot-squad.js')<
   parts.indexOf('src/game/90-bot-ai.js'));
});
