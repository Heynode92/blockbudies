import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const tdm=read('src/game/88-bot-tdm.js');
const perception=read('src/game/88-bot-perception.js');
function scene(extra={}){
 const bot={x:0,z:0,tm:0,idx:0,hp:100,dead:false,primary:1,
  weapon:1,inv:0,smartRetreat:false,ammo:{1:{mag:30,res:90},0:{mag:12,res:60}}};
 const foes=[
  {x:9,z:0,tm:1,idx:0,dead:false,hp:100,inv:0},
  {x:13,z:1,tm:1,idx:1,dead:false,hp:100,inv:0},
  {x:18,z:-2,tm:1,idx:2,dead:false,hp:100,inv:0}
 ];
 const c={Math,A:52,tt:1,en:[bot,...foes],pl:{tm:0,dead:true},
  blocked:false,mode:'tdm',isBombMode(){return c.mode==='bomb';},
  los(){return !c.blocked;},inObs(){return false;},
  WP:[{stats:{kind:'pistol'}},{stats:{kind:'rifle'}},
   {stats:{kind:'shotgun'}},{stats:{kind:'rocket'}},
   {},{stats:{kind:'grenade'}},{stats:{kind:'smg'}},
   {stats:{kind:'dual'}},{stats:{kind:'sniper'}}],
  BOT_TACTICS:{criticalHP:34},
  BOT_WEAPONS:{primaries:[1,1,1,2,2,6,6,6,7,8],sidearm:0},
  botNeedsMelee:()=>false,routeChecks:0,
  botMoveReachable(e,x,z){c.routeChecks++;return true;},
  ...extra};
 vm.createContext(c);
 vm.runInContext(perception,c);
 vm.runInContext(tdm,c);
 return{c,bot,foes};
}
test('M6: TDM only acquires currently visible enemies using M1 LOS',()=>{
 const {c,bot,foes}=scene();
 assert.equal(c.botTdmAcquire(bot),foes[0]);
 assert.equal(bot.lastSeen.source,'sight');
 c.blocked=true;foes[0].x=40;foes[0].z=40;
 assert.equal(c.botTdmAcquire(bot),null);
 assert.equal(bot.lastSeen.x,9,'hidden target does not update old snapshot');
 c.tt=5;
 assert.equal(c.botIntelKnown(bot),null);
});
test('M6: never prefer a protected spawn opponent or assign a target solely because of old audio',()=>{
 const {c,bot,foes}=scene();
 foes[0].inv=2;
 assert.equal(c.botTdmAcquire(bot),foes[1]);
 foes[1].inv=2;foes[2].inv=2;
 assert.equal(c.botTdmAcquire(bot),null);
 c.blocked=true;foes.forEach(x=>x.inv=0);
 bot.heard={x:9,z:0,until:4,source:'sound'};
 assert.equal(c.botTdmAcquire(bot),null);
});
test('M6: threat scoring treats human opponent and BOT opponents without player targeting bias',()=>{
 const {c,bot,foes}=scene();
 c.pl={tm:1,dead:false,x:6,z:0,hp:100,inv:0};
 assert.equal(c.botTdmAcquire(bot),c.pl);
 c.pl.x=20;c.pl.z=0;
 assert.equal(c.botTdmAcquire(bot),foes[0]);
});
test('M6: current visible target receives bounded hysteresis to avoid thrashing',()=>{
 const {c,bot,foes}=scene();
 foes[1].x=8;foes[1].z=0;
 bot.tg=foes[0];
 assert.equal(c.botTdmAcquire(bot),foes[0]);
 foes[1].x=4;foes[1].z=0;
 assert.equal(c.botTdmAcquire(bot),foes[1]);
});
test('M6: weapon-class bands are based on canonical equipped weapon, not changed damage',()=>{
 const {c,bot}=scene();
 const expected=[
  [1,'rifle',9,17,27],[2,'shotgun',3.5,7,12],
  [6,'smg',5,10,18],[7,'dual',4,8,15],
  [8,'sniper',20,28,42],[0,'pistol',6,11,19]
 ];
 for(const [id,kind,min,near,far] of expected){
  bot.weapon=id;
  assert.equal(c.botTdmWeaponKind(bot),kind);
  const band=c.botTdmBand(bot);
  assert.deepEqual([band.min,band.near,band.far],[min,near,far]);
 }
});
test('M6: sniper avoids close rush while shotgun closes distance without speed buff',()=>{
 const {c,bot}=scene();
 bot.weapon=8;
 assert.ok(c.botTdmCombatMove(bot,8,1,.3)[0]<0,'sniper should create space');
 assert.ok(c.botTdmCombatMove(bot,45,0,.3)[0]>0,'sniper should reposition toward range');
 bot.weapon=2;
 assert.ok(c.botTdmCombatMove(bot,18,0,.3)[0]>0,'shotgun should close to useful range');
 assert.ok(c.botTdmCombatMove(bot,2,1,.3)[0]<0,'shotgun should avoid point-blank overrun');
 bot.weapon=6;
 assert.ok(c.botTdmCombatMove(bot,12,1,.3)[0]>0);
 assert.deepEqual(Array.from(c.botTdmCombatMove(bot,12,1,.3)).slice(1),[.3]);
});
test('M6: critical HP, cover retreat and melee keep existing combat priorities',()=>{
 const {c,bot}=scene();
 bot.weapon=8;bot.hp=20;
 assert.deepEqual(Array.from(c.botTdmCombatMove(bot,4,-.8,.3)),[-.8,.3]);
 bot.hp=100;bot.smartRetreat=true;
 assert.deepEqual(Array.from(c.botTdmCombatMove(bot,4,-.8,.3)),[-.8,.3]);
 bot.smartRetreat=false;c.botNeedsMelee=()=>true;
 assert.deepEqual(Array.from(c.botTdmCombatMove(bot,4,1,.3)),[1,.3]);
});
test('M6: Bomb Mission cannot use TDM target scoring, patrol or engagement overrides',()=>{
 const {c,bot}=scene();c.mode='bomb';
 assert.equal(c.botTdmAcquire(bot),null);
 assert.equal(c.botTdmPatrolGoal(bot),null);
 const old=[bot.wx,bot.wz];c.botTdmPatrol(bot);
 assert.deepEqual([bot.wx,bot.wz],old);
 assert.deepEqual(Array.from(c.botTdmCombatMove(bot,2,1,.3)),[1,.3]);
});
test('M6: central map-control lanes never enter opponent spawn bands, either faction',()=>{
 const {c,bot}=scene();
 for(const team of [0,1]){
  bot.tm=team;
  for(let i=0;i<8;i++){
   bot.tdmRouteIndex=i;
   const goal=c.botTdmPatrolGoal(bot);
   assert.ok(goal,'open map must offer reachable waypoint');
   assert.ok(Math.abs(goal[1])<=24);
   assert.ok(Math.abs(goal[1])<28,'enemy spawn drifts between +/-28 and +/-48');
   assert.ok(Math.abs(goal[0])<=24);
  }
 }
});
test('M6: failed A-star patrol choices are bounded to three queries and cool down',()=>{
 const {c,bot}=scene({botMoveReachable(){c.routeChecks++;return false;}});
 c.botTdmPatrol(bot);
 assert.equal(c.routeChecks,c.BOT_TDM.maxPatrolChecks);
 const at=bot.tdmRouteAt;
 for(let i=0;i<20;i++){c.tt+=.05;c.botTdmPatrol(bot);}
 assert.equal(c.routeChecks,c.BOT_TDM.maxPatrolChecks,
   'impossible map must not replan at render frequency');
 assert.equal(bot.tdmRouteAt,at);
});
test('M6: active TDM patrol goal stays until arrival/expiry; new contact cancels route',()=>{
 const {c,bot}=scene();c.en=[bot];
 c.botTdmPatrol(bot);
 const goal=bot.tdmRouteGoal&&Array.from(bot.tdmRouteGoal);
 assert.ok(goal);
 let calls=c.routeChecks;
 c.tt=1.2;c.botTdmPatrol(bot);
 assert.deepEqual(Array.from(bot.tdmRouteGoal),goal);
 assert.equal(c.routeChecks,calls);
 bot.lastSeen={x:3,z:2,team:0,until:3,source:'sight'};
 c.tt=1.3;c.botTdmPatrol(bot);
 assert.equal(bot.tdmRouteGoal,null);
 assert.equal(c.routeChecks,calls);
});
test('M6: invalid map-control anchors never force a direct-wall route',()=>{
 const {c,bot}=scene({inObs(){return true;}});
 assert.equal(c.botTdmPatrolGoal(bot),null);
 c.botTdmPatrol(bot);
 assert.equal(bot.tdmRouteGoal,null);
});
test('M6: M6 does not add RPG to BOT pool or mutate weapon damage or recoil',()=>{
 const pool=read('src/game/41-bot-weapons.js');
 assert.match(pool,/primaries:\[1,1,1,2,2,6,6,6,7,8\]/);
 const ids=scene().c.BOT_WEAPONS.primaries;
 assert.equal(ids.includes(3),false,'RPG remains excluded');
 assert.doesNotMatch(tdm,/\.dmg\s*\+?=|\.damage\s*\+?=|\.recoil\s*\+?=/);
 assert.doesNotMatch(tdm,/\.x\s*\+=|\.z\s*\+=/);
});
test('M6: active TDM branch loads M6 before tactical AI and preserves Bomb state machine',()=>{
 const s=read('src/game/90-bot-ai.js');
 assert.match(s,/isBombMode\(\)\?botIntelAcquire\(e\):botTdmAcquire\(e\)/);
 assert.match(s,/else botTdmPatrol\(e\)/);
 assert.match(s,/botTdmCombatMove\(e,d,fw,st\)/);
 const p=JSON.parse(read('tools/source-manifest.json')).parts;
 assert.ok(p.indexOf('src/game/88-bot-perception.js')<p.indexOf('src/game/88-bot-tdm.js'));
 assert.ok(p.indexOf('src/game/88-bot-tdm.js')<p.indexOf('src/game/90-bot-ai.js'));
 assert.match(read('src/game/85-lobby-and-match.js'),/botTdmReset\(b\)/);
});
test('M6: real A-star patrol route is reachable around a solid synthetic building',()=>{
 const {c,bot}=scene({A:28,botMoveReachable:undefined,
  inObs(x,z,r){return Math.abs(x)<2+r&&Math.abs(z)<4+r;}});
 bot.x=-15;bot.z=0;c.en=[bot];
 const nav=read('src/game/90-bot-ai.js');
 const prefix=nav.slice(0,nav.indexOf('// botsUpd(dt)'));
 vm.runInContext(prefix,c);
 vm.runInContext(read('src/game/88-bot-movement.js'),c);
 const goal=c.botTdmPatrolGoal(bot);
 assert.ok(goal);
 const path=c.gPath(bot.x,bot.z,goal[0],goal[1]);
 assert.ok(path&&path.length>0);
 assert.ok(goal[1]<28&&goal[1]>-28);
});
