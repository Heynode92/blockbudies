import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const aim=read('src/game/40-bot-aim.js');
function scene(){
 const target={tm:1,x:0,z:16,y:0,dead:false,crA:0};
 const bot={tm:0,x:0,z:0,y:0,dead:false,primary:1,weapon:1,
   g:{rotation:{y:0}}};
 const world={tt:0,Math,visible:true,WP:[
  {stats:{kind:'pistol'},spd:160},
  {stats:{kind:'rifle'},spd:180,range:70,cd:.15,mag:30}
 ],los(){return world.visible;},botIntelVisible(e,t){
  return e!==t&&!e.dead&&!t.dead&&e.tm!==t.tm&&world.visible;
 }};
 vm.createContext(world);vm.runInContext(aim,world);
 return {world,bot,target};
}
test('M2: first sight does not permit instant firing before timed reaction',()=>{
 const {world,bot,target}=scene();
 assert.equal(world.botAimUpdate(bot,target,.016),false);
 assert.ok(bot.aimReadyAt>=.18&&bot.aimReadyAt<=.46);
 assert.equal(bot.aimCanFire,false);
 world.tt=.1;assert.equal(world.botAimUpdate(bot,target,.1),false);
 assert.equal(world.botAimShot(bot,world.WP[1],16),null);
 world.tt=.5;assert.equal(world.botAimUpdate(bot,target,.2),true);
 assert.ok(world.botAimShot(bot,world.WP[1],16));
});
test('M2: 3D pitch tracks elevation in both directions with a finite turn rate',()=>{
 const {world,bot,target}=scene();
 target.y=3;world.botAimUpdate(bot,target,.016);
 assert.ok(bot.aimPitch>0&&bot.aimPitch<=.016*world.BOT_AIM.turnPitch+.00001);
 world.tt=.5;world.botAimUpdate(bot,target,.2);
 assert.ok(bot.aimPitch>.14&&bot.aimPitch<.4);
 target.y=-2;world.tt=.55;
 const previous=bot.aimPitch;
 world.botAimUpdate(bot,target,.016);
 assert.ok(bot.aimPitch<previous);
 assert.ok(previous-bot.aimPitch<=.016*world.BOT_AIM.turnPitch+.00001);
});
test('M2: yaw cannot instantly snap 180 degrees and retargeting adds a fresh reaction',()=>{
 const {world,bot,target}=scene();
 target.z=-16;world.botAimUpdate(bot,target,.016);
 assert.ok(Math.abs(bot.aimYaw)<=world.BOT_AIM.turnYaw*.016+.00001);
 assert.equal(bot.aimCanFire,false);
 world.tt=.6;target.z=16;
 world.botAimUpdate(bot,target,.016);
 const other={tm:1,x:12,z:0,y:0,dead:false};
 world.tt=.62;
 assert.equal(world.botAimUpdate(bot,other,.016),false);
 assert.ok(bot.aimReadyAt>=.8);
});
test('M2: reacquisition begins from current patrol heading, never from stale yaw',()=>{
 const {world,bot,target}=scene();
 bot.aimYaw=2.7;bot.g.rotation.y=-.7;
 world.botAimUpdate(bot,target,.016);
 assert.ok(bot.aimYaw<-.6,'turn begins at body facing instead of previous target');
 assert.ok(Math.abs(bot.aimYaw+.7)<=world.BOT_AIM.turnYaw*.016+.00001);
 world.visible=false;world.botAimUpdate(bot,target,.1);
 bot.g.rotation.y=1.4;world.visible=true;world.tt=.6;
 world.botAimUpdate(bot,target,.016);
 assert.ok(bot.aimYaw>1.3,'new sight after patrol begins from live model orientation');
 assert.equal(bot.aimCanFire,false);
});
test('M2: losing LOS immediately clears pending shot and forbids using hidden coordinates',()=>{
 const {world,bot,target}=scene();
 world.botAimUpdate(bot,target,.2);world.tt=.6;
 world.botAimUpdate(bot,target,.2);assert.equal(bot.aimCanFire,true);
 world.visible=false;target.x=90;target.y=25;
 assert.equal(world.botAimUpdate(bot,target,.016),false);
 assert.equal(bot.aimTarget,null);
 assert.equal(bot.aimCanFire,false);
 assert.equal(world.botAimShot(bot,world.WP[1],20),null);
 assert.equal(bot.aimSample,null);
});
test('M2: lead is bounded by fresh sight samples and realistic projectile travel',()=>{
 const {world,bot,target}=scene();
 world.botAimUpdate(bot,target,.016);
 world.tt=.1;target.x=1;
 world.botAimUpdate(bot,target,.08);
 const estimatedLead=Math.atan2(1+8*Math.min(.18,Math.hypot(1,16)/180),16);
 assert.ok(bot.aimYaw>0);
 assert.ok(bot.aimYaw<=world.BOT_AIM.turnYaw*(.016+.08)+.00001);
 assert.ok(Number.isFinite(estimatedLead));
 world.visible=false;target.x=1000;
 const before=bot.aimYaw;
 world.botAimUpdate(bot,target,.1);
 assert.equal(bot.aimYaw,before,'hidden movement must not steer the aim');
});
test('M2: class-specific angular error remains bounded and produces no guaranteed precision',()=>{
 const {world,bot,target}=scene();
 world.botAimUpdate(bot,target,.15);world.tt=.6;
 world.botAimUpdate(bot,target,.25);
 const a=world.botAimShot(bot,world.WP[1],12);
 assert.ok(a&&Number.isFinite(a.yaw)&&Number.isFinite(a.pitch));
 const bound=world.BOT_AIM.classNoise.rifle+.065+.04;
 assert.ok(Math.abs(world.botAimDelta(bot.aimYaw,a.yaw))<=bound);
 assert.ok(Math.abs(bot.aimPitch-a.pitch)<=bound);
 assert.equal(bot.aimShots,1);
});
test('M2: actual projectile factory honors BOT vertical pitch and preserves player pitch',()=>{
 const combat=read('src/game/45-combat.js');
 const source=combat.slice(combat.indexOf('function fire(o,face,w,own,adv){'),combat.indexOf('// boom():'));
 assert.ok(source.startsWith('function fire('));
 const w={stats:{kind:'rifle'},pel:1,spd:180,spr:0,life:1,
   dmg:20,rangeModifier:1,rangeUnit:20};
 const shots=[],events=[];
 const c={Math,A:80,WP:[w],bl:shots,shotSide:0,adsT:0,
  pl:{x:0,z:0,y:0,face:0,pitch:.22,w:0},
  hold:{position:{x:0,y:0,z:0}},MZ:[-.4],
  shotgunPelletSpread:()=>[0,0],
  tracer(){return{visible:false,rotation:{order:'',set(){}},
    position:{set(){} }}},
  S:{add(){}},enemyShotFx(){},
  sweepObs(){return false;},sweepLT(){return false;},obsAt(){return false;},
  botSoundEmit(o,kind){events.push({o,kind})}};
 vm.createContext(c);vm.runInContext(source,c);
 const bot={x:0,z:0,y:0,tm:1,aimShotPitch:.12};
 c.fire(bot,0,w,'e',0);
 assert.ok(Math.abs(shots[0].vy-180*Math.tan(.12))<1e-8);
 assert.ok(shots[0].vy>0,'projectile must gain height toward elevated target');
 assert.equal(shots[0].dmg,20);
 assert.equal(shots[0].own,'e');
 c.fire(c.pl,0,w,'p',0);
 const expected=w.spd*(1.5+20*Math.tan(c.pl.pitch)-(1.5+c.hold.position.y+.02))/20;
 assert.ok(Math.abs(shots[1].vy-expected)<1e-8,'player pitch unchanged');
 assert.equal(events.length,2);
});
test('M2: ammo and cooldown remain canonical and do not spend bullets before aim ready',()=>{
 const {world,bot,target}=scene();
 world.fire=()=>{world.shots=(world.shots||0)+1};
 world.botVisualWeapon=()=>{};
 world.botChooseWeapon=()=>1;
 world.botThrowGrenade=()=>false;
 world.clearTo=()=>true;
 world.WP[1].pel=1;world.WP[1].dmg=20;world.WP[1].spr=.01;
 bot.ammo={1:{mag:4,res:40}};
 bot.reloadId=null;bot.visualWeapon=1;
 vm.runInContext(read('src/game/41-bot-weapons.js'),world);
 world.botChooseWeapon=()=>1;
 world.botAimUpdate(bot,target,.02);
 assert.equal(world.botAttack(bot,target,0,16),false);
 assert.equal(bot.ammo[1].mag,4);
 world.tt=.6;world.botAimUpdate(bot,target,.2);
 assert.equal(world.botAttack(bot,target,0,16),true);
 assert.equal(bot.ammo[1].mag,3);
 assert.equal(bot.cd,world.WP[1].cd);
 assert.equal(world.shots,1);
 assert.equal(bot.aimShotPitch,null);
});
