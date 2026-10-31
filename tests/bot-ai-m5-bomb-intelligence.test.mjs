import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const perception=read('src/game/88-bot-perception.js');
const intelligence=read('src/game/86-bomb-intelligence.js');
const tactics=read('src/game/87-bomb-tactics.js');
function scene(){
 const cops=[
  {tm:0,idx:0,x:18,z:4,hp:100,dead:false},
  {tm:0,idx:1,x:-15,z:14,hp:100,dead:false},
  {tm:0,idx:2,x:13,z:12,hp:100,dead:false}
 ],terror=[
  {tm:1,idx:0,x:-8,z:-10,hp:100,dead:false,siteChoice:0},
  {tm:1,idx:1,x:-10,z:-12,hp:100,dead:false},
  {tm:1,idx:2,x:7,z:-8,hp:100,dead:false}
 ];
 const c={Math,Array,Object,tt:10,A:80,en:[...cops,...terror],
  pl:{tm:1,dead:true,x:70,z:70},mt:{cd:0,t:110,over:false},
  BOMB_RULES:{plantSeconds:5,defuseSeconds:7,fuseSeconds:40,
    interactRadius:2.45,siteRadius:3.1},
  BOMB_SITES:[{id:'A',x:-25,z:-5},{id:'B',x:25,z:5}],
  bombMatch:{round:1,state:'idle',done:false,carrier:terror[0],dropped:null,
   site:-1,defuser:null,fuseLeft:40,device:{position:{x:25,z:5},visible:false}},
  isBombMode:()=>true,los:()=>true,inObs:()=>false,
  botMoveReachable:()=>true,
  bombArea(e){return c.BOMB_SITES.findIndex(s=>Math.hypot(s.x-e.x,s.z-e.z)<=3.1);},
  bombActionFor(e){
   const b=c.bombMatch;if(b.done)return null;
   if(b.state==='idle'&&e.tm===1&&e===b.carrier&&c.bombArea(e)>=0)
    return {type:'plant',site:c.bombArea(e)};
   if(b.state==='planted'&&e.tm===0&&
       Math.hypot(e.x-b.device.position.x,e.z-b.device.position.z)<=2.45)
    return {type:'defuse',site:b.site};
   return null;
  },
  bombPlant(e,site){const b=c.bombMatch;b.state='planted';b.site=site;b.carrier=null;
   b.device.position={x:c.BOMB_SITES[site].x,z:c.BOMB_SITES[site].z};
   b.fuseLeft=c.BOMB_RULES.fuseSeconds;},
  bombDefuse(){c.bombMatch.done=true;c.bombMatch.winner=0;}
 };
 vm.createContext(c);
 vm.runInContext(perception,c);
 vm.runInContext(intelligence,c);
 vm.runInContext(tactics,c);
 const mission=read('src/game/86-bomb-mission.js');
 vm.runInContext(mission.slice(mission.indexOf('function bombInterruptPlant('),
   mission.indexOf('function bombPlant(')),c);
 return{c,cops,terror};
}
function sight(c,actor,position){
 actor.lastSeen={x:position.x,z:position.z,team:actor.tm,observer:actor.idx,
  source:'sight',seenAt:c.tt,until:c.tt+3.6};
}
test('M5: carrier may switch from threatened A to reachable B using fresh legitimate sight only',()=>{
 const {c,terror}=scene(),carrier=terror[0];
 sight(c,carrier,{x:-25,z:-5});
 assert.equal(c.bombStrategicSite(carrier),c.BOMB_SITES[1]);
 assert.equal(carrier.siteChoice,1);
 assert.equal(carrier.m5Switches,1);
 assert.equal(c.bombStrategicSite(carrier),c.BOMB_SITES[1]);
 assert.equal(carrier.m5Switches,1,'no repeated switching in one round');
});
test('M5: hidden live enemy movement and sound-only clue cannot influence site choice',()=>{
 const {c,cops,terror}=scene(),carrier=terror[0];
 cops[0].x=-25;cops[0].z=-5;
 assert.equal(c.bombStrategicSite(carrier),c.BOMB_SITES[0]);
 carrier.heard={source:'sound',x:-25,z:-5,until:20,heardAt:10};
 assert.equal(c.bombStrategicSite(carrier),c.BOMB_SITES[0]);
 cops[0].x=60;cops[0].z=60;
 assert.equal(carrier.siteChoice,0);
 c.botTeamReports[1]={x:-25,z:-5,source:'radio',team:0,seenAt:10,until:12};
 assert.equal(c.bombStrategicSite(carrier),c.BOMB_SITES[0],'enemy radio must not leak');
});
test('M5: invalid path or active plant cannot trigger a site switch',()=>{
 const {c,terror}=scene(),e=terror[0];
 sight(c,e,{x:-25,z:-5});
 c.botMoveReachable=()=>false;
 c.bombStrategicSite(e);assert.equal(e.siteChoice,0);
 c.botMoveReachable=()=>true;
 e.bAction={type:'plant',site:0,t:3};
 c.bombStrategicSite(e);assert.equal(e.siteChoice,0);
});
test('M5: round resets site change and positional caches without changing bomb rules',()=>{
 const {c,terror}=scene(),e=terror[0];
 sight(c,e,{x:-25,z:-5});
 c.bombStrategicSite(e);assert.equal(e.m5Switches,1);
 c.bombMatch.round=2;e.siteChoice=0;
 e.lastSeen=null;
 c.bombStrategicSite(e);
 assert.equal(e.m5Switches,0);
 assert.equal(c.BOMB_RULES.plantSeconds,5);
 assert.equal(c.BOMB_RULES.defuseSeconds,7);
 assert.equal(c.BOMB_RULES.fuseSeconds,40);
});
test('M5: critical fuse prioritizes closer Police defuser without shortening 7-second interaction',()=>{
 const {c,cops,terror}=scene();
 c.bombMatch.state='planted';c.bombMatch.site=1;c.bombMatch.fuseLeft=8;
 cops[0].x=-20;cops[0].z=12;
 cops[1].x=24;cops[1].z=5;
 c.bombMatch.defuser=cops[0];
 assert.equal(c.bombM5CriticalFuse(),true);
 assert.equal(c.bombPickDefuser(),cops[1]);
 assert.equal(c.BOMB_RULES.defuseSeconds,7);
 terror.forEach(t=>t.dead=true);
 c.bombMatch.defuser=cops[1];cops[1].bAction={type:'defuse',site:1,t:3};
 assert.equal(c.bombPickDefuser(),cops[1],'never interrupt an active defuse');
});
test('M5: when fuse is not critical, legacy defuser strategy stays authoritative',()=>{
 const {c,cops}=scene();c.bombMatch.state='planted';c.bombMatch.site=1;
 c.bombMatch.fuseLeft=25;
 assert.equal(c.bombM5CriticalFuse(),false);
 const e=c.bombPickDefuser();
 assert.ok(cops.includes(e));
});
test('M5: no-terrorist solo Police defuses despite expired threat; real action remains five/seven seconds',()=>{
 const {c,cops,terror}=scene();
 c.bombMatch.state='planted';c.bombMatch.site=1;c.bombMatch.fuseLeft=9;
 cops[1].dead=true;cops[2].dead=true;
 terror.forEach(e=>e.dead=true);
 cops[0].x=25;cops[0].z=5;
 assert.equal(c.bombPickDefuser(),cops[0]);
 for(let i=0;i<6;i++)c.bombAct(cops[0],1,true);
 assert.equal(c.bombMatch.done,false);
 c.bombAct(cops[0],1,true);
 assert.equal(c.bombMatch.done,true);
 assert.equal(c.bombMatch.winner,0);
});
test('M5: contested 1vX critical fuse does not delay a viable defuse indefinitely',()=>{
 const {c,cops,terror}=scene();
 c.bombMatch.state='planted';c.bombMatch.site=1;c.bombMatch.fuseLeft=8;
 cops[1].dead=cops[2].dead=true;
 cops[0].x=25;cops[0].z=5;
 sight(c,cops[0],{x:26,z:5});
 assert.equal(c.bombSoloPoliceThreat(cops[0])!==null,true);
 assert.equal(c.bombPickDefuser(),cops[0],
  'critical fuse grants urgent attempt without reading enemy live position');
 assert.equal(c.bombTacticalStage(cops[0]),'retake-defuse');
 assert.equal(c.BOMB_RULES.defuseSeconds,7);
});
test('M5: dropped bomb recoverer reassigns after elimination, with health-aware tie-break',()=>{
 const {c,terror}=scene();
 c.bombMatch.dropped={x:0,z:-5};c.bombMatch.carrier=null;
 terror[0].x=0;terror[0].z=-3;terror[0].hp=20;
 terror[1].x=1;terror[1].z=-5;terror[1].hp=100;
 assert.equal(c.bombSmartRecoverer(),terror[1]);
 terror[1].dead=true;
 assert.equal(c.bombSmartRecoverer(),terror[0]);
});
test('M5: post-plant Terrorists occupy distinct reachable arcs, not the bomb center',()=>{
 const {c,terror}=scene();
 c.bombMatch.state='planted';c.bombMatch.site=1;
 const a=c.bombTacticalStage(terror[0]),b=c.bombTacticalStage(terror[1]);
 assert.equal(a,'hold');assert.equal(b,'intercept');
 const ga=c.bombTacticalGoal(terror[0]),gb=c.bombTacticalGoal(terror[1]);
 assert.ok(Math.hypot(ga[0]-gb[0],ga[1]-gb[1])>1.8);
 assert.ok(Math.hypot(ga[0]-25,ga[1]-5)>3);
 assert.ok(Math.hypot(gb[0]-25,gb[1]-5)>3);
 assert.ok(terror[0].m5Goal&&terror[1].m5Goal);
});
test('M5: post-plant positions expire and cannot track unseen enemy movement',()=>{
 const {c,cops,terror}=scene();c.bombMatch.state='planted';c.bombMatch.site=1;
 sight(c,terror[0],{x:23,z:12});
 const g=c.bombTacticalGoal(terror[0]);
 cops[0].x=-55;cops[0].z=-55;
 c.tt+=.5;
 assert.deepEqual(Array.from(c.bombTacticalGoal(terror[0])),Array.from(g));
 c.tt=20;terror[0].lastSeen=null;
 const next=c.bombTacticalGoal(terror[0]);
 assert.ok(next&&Number.isFinite(next[0]));
 assert.ok(Math.hypot(...next)<100);
});
test('M5: impossible cover geometry falls back to canonical Bomb tactical goal without stuck loop',()=>{
 const {c,terror}=scene();
 c.bombMatch.state='planted';c.bombMatch.site=1;
 c.botMoveReachable=()=>false;
 const goal=c.bombTacticalGoal(terror[0]);
 assert.ok(goal&&goal.length===2,'old Bomb goal is preserved if M5 candidate unreachable');
});
test('M5: uncontested retake support keeps backup near the device and never blocks active defuse',()=>{
 const {c,cops,terror}=scene();c.bombMatch.state='planted';c.bombMatch.site=1;
 terror.forEach(e=>e.dead=true);
 cops[0].x=25;cops[0].z=5;cops[0].bAction={type:'defuse',site:1,t:2};
 c.bombMatch.defuser=cops[0];
 assert.equal(c.bombPickDefuser(),cops[0]);
 const support=c.bombTacticalGoal(cops[1]);
 assert.ok(Math.hypot(support[0]-25,support[1]-5)<2.5);
 assert.notDeepEqual(Array.from(support),[25,5]);
});
test('M5: source boundary stays decision-only; real Bomb winner/plant/defuse remain unchanged',()=>{
 const src=read('src/game/86-bomb-intelligence.js');
 assert.doesNotMatch(src,/bombMatch\.fuseLeft\s*=|\bts\s*\[|\.hp\s*[-+]?=|bombFinish\(/);
 assert.doesNotMatch(src,/\.x\s*\+=|\.z\s*\+=/);
 assert.match(read('src/game/87-bomb-tactics.js'),/bombM5CriticalFuse/);
 const parts=JSON.parse(read('tools/source-manifest.json')).parts;
 assert.ok(parts.indexOf('src/game/86-bomb-intelligence.js')<parts.indexOf('src/game/87-bomb-tactics.js'));
 assert.ok(parts.indexOf('src/game/86-bomb-mission.js')<parts.indexOf('src/game/86-bomb-intelligence.js'));
});
