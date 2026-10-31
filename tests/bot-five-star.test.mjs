import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8').replace(/\r\n/g,'\n');
const tactics=read('src/game/89-bot-tactical-intelligence.js');
const perception=read('src/game/88-bot-perception.js');
function setup(extra={}){
 const c={A:30,GB:new Uint8Array(16),en:[],tt:10,pl:{dead:false,tm:0,x:0,z:0},
 isBombMode:()=>false,bombMatch:null,WP:Array.from({length:19},()=>({mag:30,res:90,rt:1,cd:.15,range:35,stats:{kind:'rifle'}})),
 BOT_WEAPONS:{sidearm:0},botStartReload:()=>false,botVisualWeapon:()=>{},
 gPath:(x,z,tx,tz)=>[[tx,tz]],inObs:()=>false,los:()=>true,...extra};
 vm.createContext(c);vm.runInContext(perception,c);vm.runInContext(tactics,c);return c;
}
test('five-star cover checks real LOS and retreats when critically injured',()=>{
 const c=setup({los:x=>x>-2}),b={x:0,z:0,wx:0,wz:0,hp:25,tm:0};c.en=[b];
 const cover=vm.runInContext('botSmartCover(en[0],{x:6,z:0})',c);
 assert.ok(cover&&cover[0]<=-2);
 const move=vm.runInContext('botSmartIntent(en[0],{x:6,z:0})',c);
 assert.equal(c.BOT_TACTICS.difficulty,5);assert.equal(move.retreat,true);
 assert.ok(move.goal);
});
test('failed cover checks are cached rather than repeated each animation frame',()=>{
 let calls=0;const c=setup({los:()=>{calls++;return true;}});
 c.en=[{x:0,z:0,wx:0,wz:0,hp:25,tm:0}];
 assert.equal(vm.runInContext('botSmartCover(en[0],{x:6,z:0})',c),null);
 const n=calls;assert.ok(n>0);c.tt+=.2;
 assert.equal(vm.runInContext('botSmartCover(en[0],{x:6,z:0})',c),null);
 assert.equal(calls,n);
 c.tt+=1;vm.runInContext('botSmartCover(en[0],{x:6,z:0})',c);assert.ok(calls>n);
});
test('tactical reload consumes reserves and swaps to sidearm while primary reloads',()=>{
 const c=setup();c.WP[1]={mag:30,res:150,rt:1.25,cd:.18,range:70,stats:{kind:'rifle'}};
 vm.runInContext(read('src/game/41-bot-weapons.js'),c);
 const e={primary:1,x:0,z:0,tm:0,ammo:{1:{mag:4,res:40},0:{mag:10,res:40}},reloadId:null};
 c.en=[e];vm.runInContext('botSmartReload(en[0],null)',c);
 assert.equal(e.reloadId,1);assert.equal(vm.runInContext('botChooseWeapon(en[0],10)',c),0);
 vm.runInContext('botUpdateReload(en[0],2)',c);
 assert.equal(e.reloadId,null);assert.equal(e.ammo[1].mag,30);assert.equal(e.ammo[1].res,14);
});
test('Bomb Mission assigns one recoverer and separate post-plant defenders',()=>{
 const a={x:0,z:0,idx:0,tm:1,dead:false},b={x:14,z:0,idx:1,tm:1,dead:false};
 const cop={x:30,z:0,idx:0,tm:0,dead:false};
 const c={en:[a,b,cop],pl:{dead:true,tm:0},tt:5,A:40,
  BOMB_SITES:[{x:0,z:0},{x:25,z:0}],BOMB_RULES:{interactRadius:2},
  bombMatch:{state:'idle',done:false,dropped:{x:3,z:0},round:1,carrier:null},
  isBombMode:()=>true,inObs:()=>false,los:()=>true,bombArea:()=>-1};
 vm.createContext(c);vm.runInContext(perception,c);vm.runInContext(read('src/game/87-bomb-tactics.js'),c);
 assert.equal(vm.runInContext('bombSmartRecoverer()',c),a);
 assert.equal(vm.runInContext('bombTacticalStage(en[0])',c),'recover');
 assert.equal(vm.runInContext('bombTacticalStage(en[1])',c),'recover-cover');
 const one=vm.runInContext('bombTacticalGoal(en[0])',c),two=vm.runInContext('bombTacticalGoal(en[1])',c);
 assert.notDeepEqual(Array.from(one),Array.from(two));
 c.bombMatch.state='planted';c.bombMatch.site=0;c.bombMatch.device={position:{x:0,z:0}};
 assert.equal(vm.runInContext('bombTacticalStage(en[0])',c),'hold');
 assert.equal(vm.runInContext('bombTacticalStage(en[1])',c),'intercept');
});
test('active bot frame runs and retreats from visible enemy when HP is critical',()=>{
 let footstepCalls=0;
 const b={x:0,z:0,tm:0,idx:0,hp:25,dead:false,inv:0,vis:0,tq:0,cd:1,
 ammo:{1:{mag:2,res:90},0:{mag:10,res:90},5:{mag:1,res:0}},primary:1,weapon:1,
 reloadId:null,grenadeAt:9999,visualWeapon:1,wx:0,wz:0,stk:0,pi:0,pt:0,sd:0,bt:0,navT:0,lt:0,
 g:{rotation:{y:0},position:{set(){}},userData:{}},
 legs:[{rotation:{x:0}},{rotation:{x:0}}],arms:[],
 body:{position:{y:0},rotation:{x:0,y:0,z:0}}};
 const c={A:20,GB:null,en:[b],rq:[],tt:10,mt:{cd:0,over:false},
 pl:{x:8,z:0,tm:1,dead:false,hp:100},isBombMode:()=>false,
 inObs:()=>false,los:()=>true,gh:()=>0,resolve:()=>{},flash:()=>{},aimArms:()=>{},
 footstepAdvance:()=>{footstepCalls++;},
 WP:Array.from({length:19},(_,i)=>({stats:{kind:i===0?'pistol':'rifle'},
 mag:30,res:90,rt:1.2,cd:.15,range:30,spd:120,pel:1,moveMult:1,life:1,viewKick:0})),
 BOMB_AI:{navSpeed:5,clearSiteSpeedMultiplier:1.3,teammateSpacing:2.5,repathGoalDistance:2},
 bombUncontestedRetake:()=>false,bombPickDefuser:()=>null,bombBotWantsObjective:()=>false,bombBotGoal:()=>null,
 fire:()=>{},clearTo:()=>true,grs:[],mkGren:()=>({}),newBot:()=>{},placeBot:()=>{},
 mkGun:()=>({rotation:{},scale:{setScalar(){}},position:{set(){}},traverse(){}})};
 vm.createContext(c);
 vm.runInContext(read('src/game/40-bot-aim.js'),c);
 vm.runInContext(read('src/game/41-bot-weapons.js'),c);
 vm.runInContext(perception,c);
 vm.runInContext(tactics,c);
 vm.runInContext(read('src/game/90-bot-ai.js').split('// botsUpdOld(dt)')[0],c);
 assert.doesNotThrow(()=>vm.runInContext('botsUpd(.016)',c));
 assert.equal(footstepCalls,1,'active BOT frame must update footstep cadence exactly once');
 assert.equal(b.smartRetreat,true);assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.z));
 assert.ok(b.x<0,'severely wounded bot must evade, not blindly charge');
});
test('both playable modes display 5 stars and browser bundle matches all modules',()=>{
 const lobby=read('src/game/85-lobby-and-match.js');
 assert.equal(lobby.split('lock:0,df:BOT_TACTICS.difficulty').length-1,2);
 const m=JSON.parse(read('tools/source-manifest.json'));
 // All BOT_TACTICS references in lobby must execute after the tactical config initializes.
 assert.equal(m.parts.indexOf('src/game/89-bot-tactical-intelligence.js')+1,m.parts.indexOf('src/game/85-lobby-and-match.js'));
 assert.ok(m.parts.indexOf('src/game/89-bot-tactical-intelligence.js')<m.parts.indexOf('src/game/90-bot-ai.js'));
 assert.equal(read('assets/game.js'),'(function(){\n'+m.parts.map(read).join('')+'})();\n');
});
