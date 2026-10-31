import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
const source=read('src/game/88-bot-movement.js');
function scene(extra={}){
 const bot={x:0,z:0,idx:0,tm:0,dead:false,hp:60,fl:.1,stk:0,
   g:{rotation:{y:0}},wx:0,wz:0};
 const foe={x:10,z:0,idx:0,tm:1,dead:false,hp:100};
 const c={Math,A:30,tt:1,en:[bot,foe],pl:{dead:true,tm:1},
   BOT_TACTICS:{criticalHP:34,threatRange:24},
   isBombMode:()=>false,bombMatch:null,
   inObs:()=>false,los:()=>true,
   gPath:(x,z,tx,tz)=>[[tx,tz]],
   botIntelVisible:()=>true,
   botIntelKnown:()=>({x:10,z:0,until:20,source:'sight'}),
   botSmartCover:()=>[-2,2],...extra
 };
 vm.createContext(c);vm.runInContext(source,c,{filename:'88-bot-movement.js'});
 return{c,bot,foe};
}
test('M3: damage triggers navigable reactive cover, without modifying health or weapon state',()=>{
 const {c,bot,foe}=scene();const intent={retreat:false,goal:null,hold:false};
 c.botMoveIntent(bot,foe,intent);
 assert.equal(bot.m3Mode,'cover');
 assert.deepEqual(Array.from(intent.goal),[-2,2]);
 assert.equal(bot.hp,60);
 assert.ok(bot.m3RetryAt>c.tt);
 const again={retreat:false,goal:null,hold:false};
 c.botMoveIntent(bot,foe,again);
 assert.deepEqual(Array.from(again.goal),[-2,2]);
});
test('M3: reached cover transitions to temporary hold then short legal peek',()=>{
 const {c,bot,foe}=scene();
 c.botMoveIntent(bot,foe,{retreat:false,goal:null,hold:false});
 bot.x=-2;bot.z=2;c.tt=1.25;
 let intent={retreat:false,goal:null,hold:false};
 c.botMoveIntent(bot,null,intent);
 assert.equal(bot.m3Mode,'hold');assert.equal(intent.hold,true);
 c.tt=1.7;intent={retreat:false,goal:null,hold:false};
 c.botMoveIntent(bot,null,intent);
 assert.equal(bot.m3Mode,'peeking');
 assert.ok(intent.goal&&intent.goal.length===2);
 assert.ok(c.los(intent.goal[0],intent.goal[1],10,0));
});
test('M3: peeking cannot use expired enemy intel or hidden live coordinates',()=>{
 const {c,bot,foe}=scene({botIntelKnown:()=>({x:10,z:0,until:1.1,source:'sight'})});
 c.tt=1.5;
 bot.m3Mode='hold';bot.m3Expires=1.4;
 const goal={retreat:false,goal:null,hold:false};
 c.botMoveIntent(bot,null,goal);
 assert.equal(goal.goal,null);
 assert.equal(bot.m3Mode,null);
 foe.x=999;foe.z=999;
 assert.equal(c.botMovePeek(bot,{x:8,z:0,until:1.4}),null);
});
test('M3: urgent Bomb plant/defuse and critical-HP retreat bypass offensive cover',()=>{
 const {c,bot,foe}=scene();
 c.isBombMode=()=>true;c.bombMatch={state:'idle',carrier:bot,done:false};
 let intent={retreat:false,goal:null,hold:false};
 c.botMoveIntent(bot,foe,intent);assert.equal(intent.goal,null);
 c.bombMatch={state:'planted',done:false,defuser:bot};
 bot.fl=.2;
 intent={retreat:false,goal:null,hold:false};
 c.botMoveIntent(bot,foe,intent);assert.equal(intent.goal,null);
 c.isBombMode=()=>false;c.bombMatch=null;bot.hp=25;
 intent={retreat:true,goal:[-5,0],hold:false};
 c.botMoveIntent(bot,foe,intent);
 assert.deepEqual(intent.goal,[-5,0]);
});
test('M3: dodge is finite, requires visible danger and is rate-limited',()=>{
 const {c,bot,foe}=scene();
 let movement=c.botMoveDodge(bot,foe,.05,0,0);
 assert.ok(movement[1]!==0);
 const first=bot.m3DodgeAt;assert.ok(first>c.tt);
 c.tt=1.2;bot.fl=0;
 movement=c.botMoveDodge(bot,foe,.05,0,0);
 assert.ok(movement[1]!==0,'brief dodge continues even after hit flash');
 c.tt=1.5;movement=c.botMoveDodge(bot,foe,.05,0,0);
 assert.equal(movement[1],0,'dodge must expire');
 c.botIntelVisible=()=>false;bot.fl=.2;
 movement=c.botMoveDodge(bot,foe,.05,0,0);
 assert.deepEqual(Array.from(movement),[0,0]);
 assert.equal(bot.m3DodgeAt,first);
});
test('M3: blocked forward probe legally slides on clear axis, never crosses solid box',()=>{
 const {c,bot}=scene({inObs:(x,z)=>x>.4});
 const result=c.botMoveSteer(bot,1,.8,5,.1,false);
 assert.equal(result[0],0);
 assert.ok(result[1]>0);
 assert.ok(!c.inObs(bot.x+result[0]*.8,bot.z+result[1]*.8));
 const stop=c.botMoveSteer(bot,1,1,5,.1,true);
 assert.deepEqual(Array.from(stop),[0,0]);
});
test('M3: no feasible movement returns zero instead of tunneling through walls',()=>{
 const {c,bot}=scene({inObs:(x,z)=>true});
 const vel=c.botMoveSteer(bot,1,1,5,.1,false);
 assert.deepEqual(Array.from(vel),[0,0]);
 assert.equal(bot.x,0);assert.equal(bot.z,0,'steering must never mutate world position');
});
test('M3: stuck logic is bounded, triggers replan and never teleports',()=>{
 const {c,bot}=scene();let before=[bot.x,bot.z];
 for(let k=0;k<7;k++){c.tt=1+k*.1;c.botMoveTrack(bot,0,0,.1,5,true,false);}
 assert.ok(bot.m3RecoverAt>c.tt-.5);
 assert.equal(bot.pt,0);
 assert.deepEqual([bot.x,bot.z],before);
 assert.ok(bot.m3StallCycles<=c.BOT_MOVE.maxStallCycles);
 const recovered=c.botMoveRecovery(bot,1,0,5,.05,false);
 assert.ok(Number.isFinite(recovered[0])&&Number.isFinite(recovered[1]));
 bot.x=2;c.tt+=.1;c.botMoveTrack(bot,0,0,.1,5,true,false);
 assert.equal(bot.m3StallCycles,0);
});
test('M3: movement state reset clears cover/dodge/recovery at respawn',()=>{
 const {c,bot}=scene();
 bot.m3Mode='peeking';bot.m3Goal=[8,2];bot.m3DodgeUntil=9;
 bot.m3RecoverUntil=9;bot.m3StallCycles=3;
 c.botMoveReset(bot);
 assert.equal(bot.m3Mode,null);assert.equal(bot.m3Goal,null);
 assert.equal(bot.m3DodgeUntil,0);assert.equal(bot.m3RecoverUntil,0);
 assert.equal(bot.m3StallCycles,0);
});
test('M3: all navigation remains behind canonical A-star and resolve, never direct bypass',()=>{
 const ai=read('src/game/90-bot-ai.js');
 assert.match(ai,/e\.path=p\|\|\[\]/,'unreachable path cannot turn into direct charge');
 assert.match(ai,/botMoveSteer\(e,/);
 assert.match(ai,/botMoveTrack\(e,/);
 assert.match(ai,/resolve\(e,\.55\)/);
 assert.doesNotMatch(source,/\.x\s*\+=|\.z\s*\+=/);
 assert.match(read('src/game/85-lobby-and-match.js'),/botMoveReset\(b\)/);
});

test('M3: real A-star grid routes around obstacle walls without cutting corners',()=>{
 const nav=read('src/game/90-bot-ai.js');
 const prefix=nav.slice(0,nav.indexOf('// botsUpd(dt)'));
 const c={Math,Uint8Array,Float32Array,Int32Array,A:12,
   isBombMode:()=>false,
   inObs(x,z,r){return Math.abs(x)<1.6+r&&Math.abs(z)<2.5+r;}};
 vm.createContext(c);vm.runInContext(prefix,c);
 const route=c.gPath(-8,0,8,0);
 assert.ok(route&&route.length>1,'A-star must find a route around a solid wall');
 let prev=[-8,0];
 for(const next of route){
  const length=Math.hypot(next[0]-prev[0],next[1]-prev[1]);
  const count=Math.max(1,Math.ceil(length/.25));
  for(let i=1;i<=count;i++){
   const x=prev[0]+(next[0]-prev[0])*i/count;
   const z=prev[1]+(next[1]-prev[1])*i/count;
   assert.equal(c.inObs(x,z,.15),false,'A-star waypoint segment may not cross the solid obstacle');
  }
  prev=next;
 }
});
test('M3: real A-star unreachable goal fails closed with no direct-wall fallback',()=>{
 const nav=read('src/game/90-bot-ai.js');
 const prefix=nav.slice(0,nav.indexOf('// botsUpd(dt)'));
 const c={Math,Uint8Array,Float32Array,Int32Array,A:8,
   isBombMode:()=>false,
   inObs(){return true;}};
 vm.createContext(c);vm.runInContext(prefix,c);
 const e={x:0,z:0};
 c.botPath(e,5,5);
 assert.equal(e.path.length,0,'unreachable A-star target cannot become direct movement');
});
