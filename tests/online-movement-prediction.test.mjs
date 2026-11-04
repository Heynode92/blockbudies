import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as THREE from 'three';

const code=readFileSync(new URL('../src/game/98-online-bridge.js',import.meta.url),'utf8');
const start=code.indexOf('function onlinePositionBlocked(');
const stop=code.indexOf('\nfunction onlineWarn(',start);
assert.ok(start>=0&&stop>start,'prediction helpers must exist in canonical runtime');
const originalPhysics=readFileSync(new URL('../src/game/20-sky-and-physics.js',import.meta.url),'utf8');
const ghStart=originalPhysics.indexOf('function gh(');
const ghEnd=originalPhysics.indexOf('// resolve():',ghStart);
assert.ok(ghStart>0&&ghEnd>ghStart,'the canonical offline gh() must exist');
const helpers=originalPhysics.slice(ghStart,ghEnd)+'\n'+code.slice(start,stop)+
 '\nthis.predictionApi={step:onlinePredictStep,reconcile:onlineReconcileSelf,interpolate:onlineInterpolateActor,blocked:onlinePositionBlocked,correct:onlineApplyCollisionCorrection};';
const speed=6.5*.79/1.15;
function harness(){
 const pl={x:0,y:0,z:0,vy:0,grounded:true};
 const ctx={
  Math,pl,A:60,OB:[],onlinePredSteps:[],onlineCorrection:{x:0,y:0,z:0},
  onlineHasPrediction:true,onlineLastAck:0,onlineLastAccepted:0,onlineSeq:0,
  onlineCorrectionSize:0,onlinePrevAlive:true,
  weaponMovementSpeed:(weaponId,sprint,ads)=>{
   assert.equal(weaponId,9);
   return speed*(1-.15*sprint)*(1-.38*ads);
  },
  resolve:()=>{},
 };
 runInNewContext(helpers,ctx);
 return {ctx,pl,api:ctx.predictionApi};
}
const forward={seq:1,moveX:0,moveZ:-1,yaw:0,sprint:false,ads:false,
 jump:false,crouch:false,weaponId:9,dt:.016};
test('local camera movement responds immediately at render Hz with canonical K2 speed',()=>{
 const {pl,api}=harness();
 for(let i=0;i<60;i++)api.step(pl,forward,1/60);
 assert.ok(Math.abs(pl.z-speed)<.00001);
 assert.equal(pl.x,0);
 assert.equal(pl.y,0);
});
test('movement yaw, diagonal normalization and crouch sprint restriction preserve server axes',()=>{
 const {pl,api}=harness();
 const input={...forward,yaw:Math.PI/2,sprint:true,crouch:true};
 api.step(pl,input,.05);
 assert.ok(Math.abs(pl.x-speed*.85*.05)<.000001,'SHIFT stealth is 15% slower, not faster');
 assert.ok(Math.abs(pl.z)<.000001);
 const diagonal={...input,yaw:0,moveX:Math.SQRT1_2,moveZ:-Math.SQRT1_2,crouch:false};
 api.step(pl,diagonal,.05);
 assert.ok(Number.isFinite(pl.x)&&Number.isFinite(pl.z));
});
test('reconciliation prunes processed inputs, replays only pending frames, and preserves server seq across reconnect',()=>{
 const {ctx,pl,api}=harness();
 ctx.onlinePredSteps=[{...forward,seq:1,dt:.05},{...forward,seq:2,dt:.05}];
 api.reconcile({x:0,y:0,z:0,alive:true},{lastProcessedInputSeq:1,lastAcceptedInputSeq:4,grounded:true,velocityY:0},true);
 assert.equal(ctx.onlineLastAck,1);
 assert.equal(ctx.onlineSeq,4);
 assert.equal(ctx.onlinePredSteps.length,1);
 assert.ok(Math.abs(ctx.onlineCorrection.z-speed*.05)<1e-8);
 assert.equal(pl.z,0,'reconciliation must not instantly yank local camera for minor drift');
});
test('server jump, respawn and large correction reset prediction without overriding authority',()=>{
 const {ctx,pl,api}=harness();
 ctx.onlineHasPrediction=false;
 api.reconcile({x:4,y:1.5,z:9,alive:true},{lastProcessedInputSeq:0,lastAcceptedInputSeq:0,grounded:false,velocityY:5},true);
 assert.equal(pl.x,4);assert.equal(pl.y,1.5);assert.equal(pl.vy,5);
 assert.equal(pl.grounded,false);
 ctx.onlineHasPrediction=true;pl.x=20;
 api.reconcile({x:4,y:1.5,z:9,alive:true},{lastProcessedInputSeq:0,lastAcceptedInputSeq:0,grounded:false,velocityY:4},true);
 assert.equal(pl.x,4);assert.equal(ctx.onlineCorrection.x,0);
});
test('remote actors interpolate at buffered render time and never extrapolate into unknown future',()=>{
 const {api}=harness();
 const a={t:1000,x:0,y:0,z:0,yaw:Math.PI-.1};
 const b={t:1100,x:10,y:0,z:0,yaw:-Math.PI+.1};
 const mid=api.interpolate([a,b],1050);
 assert.equal(mid.x,5);
 assert.ok(Math.abs(Math.abs(mid.yaw)-Math.PI)<.000001,'rotation follows shortest arc');
 assert.equal(api.interpolate([a,b],1200),b,'no enemy position extrapolation beyond authorized frame');
 assert.equal(api.interpolate([a,b],900),a,'early render is clamped to observed frame');
});
test('runtime keeps collision and damage server authoritative',()=>{
 assert.match(code,/onlinePredictStep\(pl,prediction,prediction\.dt\)/);
 assert.match(code,/lastProcessedInputSeq/);
 assert.match(code,/onlinePredSteps\.filter/);
 assert.match(code,/onlineLastSnapshotAt<600/);
 assert.match(code,/onlineInterpolateActor\(actor\.samples\|\|\[\],renderAt\)/);
 assert.match(code,/visible\.has\(id\)/);
 assert.doesNotMatch(code,/type:'input',frame:\{[\s\S]{0,220}?(?:position|damage|kills):/);
});

test('weapon intent survives a stale snapshot until acknowledged',()=>{
 const ctx={Math,performance:{now:()=>100},WP:Array.from({length:19},()=>({})),
  pl:{w:4,ammo:{4:{mag:1,res:Infinity}},mag:1,res:Infinity,rl:0,slot:2,sw:0},
  onlinePendingWeapon:4,onlinePendingWeaponAt:50};
 const helper=code.slice(code.indexOf('function onlineWeaponSnapshot('),code.indexOf('function onlineHitConfirm('));
 runInNewContext(helper+'\nthis.applyWeapon=onlineWeaponSnapshot;',ctx);
 ctx.applyWeapon({weaponId:9},{ammo:{magazine:40,reserve:200}},true);
 assert.equal(ctx.pl.w,4);
 ctx.applyWeapon({weaponId:4},{ammo:{magazine:1,reserve:0}},true);
 assert.equal(ctx.onlinePendingWeapon,null);assert.equal(ctx.pl.w,4);
 ctx.applyWeapon({weaponId:9},{ammo:{magazine:39,reserve:200,reloadRemaining:0}},true);
 assert.equal(ctx.pl.w,9);assert.equal(ctx.pl.mag,39);
});
test('online renderer binds approved combat and remote animation hooks',()=>{
 assert.match(code,/onlineAnimateRemoteActor\(actor,sample,dt\)/);
 assert.match(code,/botVisualWeapon\(bot,actor.weaponId\)/);
 assert.match(code,/frame.type==='combat_hit'/);
 assert.match(code,/frame.type==='combat_shot'/);
 assert.match(code,/gunSfx\(GS\[SFXI\[pl.w\]\],1\)/);
 assert.match(code,/privateState\.spawnShieldRemaining/);
});

test('online particle lifecycle removes muzzle flash and blood instead of leaving floating orbs',()=>{
 const start=code.indexOf('function onlineTickEffects(');
 const end=code.indexOf('\nfunction onlineWarn(',start);
 assert.ok(start>0&&end>start);
 const removed=[],flash={position:{}},blood={position:{x:0,y:0,z:0},scale:{setScalar:()=>{}}};
 const ctx={Math,mzf:[{m:flash,t:.04}],
  sk:[{m:blood,t:0,l:.05,vx:0,vy:0,vz:0,sz:.06,blood:true}],
  bloodActive:1,fx:[],toastT:0,onlineShotTracers:[],S:{remove:m=>removed.push(m)},
  updG:()=>{},grs:[],updCl:()=>{},updDead:()=>{},updSm:()=>{},bloodPoolUpdate:()=>{}};
 runInNewContext(code.slice(start,end)+'\nthis.tick=onlineTickEffects;',ctx);
 ctx.tick(.06);
 assert.equal(ctx.mzf.length,0);
 assert.equal(ctx.sk.length,0);
 assert.equal(ctx.bloodActive,0);
 assert.ok(removed.includes(flash));
 assert.ok(removed.includes(blood));
});
test('network hit reactions remain server-driven, visible-only and short lived',()=>{
 assert.match(code,/frame.type==='combat_impact'/);
 assert.match(code,/onlineReactToImpact\(frame.victimId,!!frame.headshot,true\)/);
 assert.match(code,/onlineActors.get\(victimId\)/);
 assert.match(code,/botDamageReaction\(model,visualDamage,dx,dz,!!headshot,true\)/);
 assert.match(code,/flash\(bot,dt\)/);
 assert.match(code,/onlineTickEffects\(dt\)/);
 assert.match(code,/weaponMuzzleSocket\(gun,left\)/);
 assert.match(code,/socket.getWorldPosition\(new T.Vector3\(\)\)/);
});

test('trusted server wall impacts and projectile tracers reach original FE visual effects',()=>{
 assert.match(code,/frame.type==='combat_wall_hit'/);
 assert.match(code,/function onlineWallImpact\(frame\)/);
 assert.match(code,/impact\(o,\{x:x,y:y,z:z,ax:ax,sg:sg\},\{rk:false\}\)/);
 assert.match(code,/gDecal\(TXH\[/);
 assert.match(code,/function onlineShotTracer\(frame,muzzle\)/);
 assert.match(code,/onlineShotTracer\(frame,onlineShotMuzzle\(frame\)\)/);
 assert.match(code,/updCl\(dt\);[\s\S]{0,160}updDead\(dt\);/);
 assert.doesNotMatch(code,/function onlineWallImpact\(frame\)[\s\S]{0,400}damage\(/);
});

test('a server-owned wall hit invokes the original offline wall damage and ground decals',()=>{
 const start=code.indexOf('function onlineWallImpact('),end=code.indexOf('function onlineShotTracer(',start);
 assert.ok(start>=0&&end>start);
 const seen=[],wall={x:4,z:4,hw:1,hd:2,h:3};
 const ctx={Math,Number,obsAt:()=>wall,impact:(o,h,bullet)=>seen.push({o,h,bullet}),
   gDecal:(...a)=>seen.push({floor:a}),spark:()=>{},TXH:[{}]};
 runInNewContext(code.slice(start,end)+'\nthis.paint=onlineWallImpact;',ctx);
 ctx.paint({x:5,y:1.3,z:4,nx:1,ny:0,nz:0});
 assert.equal(seen.length,1);assert.equal(seen[0].o,wall);
 assert.equal(seen[0].h.ax,0);assert.equal(seen[0].h.sg,1);
 assert.equal(seen[0].h.x,5);assert.equal(seen[0].bullet.rk,false);
 ctx.paint({x:2,y:.05,z:3,nx:0,ny:1,nz:0});
 assert.equal(seen.length,2);assert.ok(seen[1].floor);
 ctx.paint({x:NaN,y:1,z:3,nx:1,ny:0,nz:0});
 assert.equal(seen.length,2,'invalid impact payload cannot draw anything');
});
test('local tracer is projected from the actual visible gun barrel into world scene at full velocity',()=>{
 const start=code.indexOf('function onlineShotTracer('),end=code.indexOf('\nfunction onlineWarn(',start);
 assert.ok(start>=0&&end>start);
 const S=new THREE.Scene(),VS=new THREE.Scene(),
  C=new THREE.PerspectiveCamera(70,16/9,.1,430),
  VC=new THREE.PerspectiveCamera(56,16/9,.1,10);
 C.position.set(0,1.5,0);C.lookAt(0,1.5,10);
 const state={Math,Number,T:THREE,WP:Array.from({length:19},()=>({spd:180})),
  onlineShotTracers:[],onlineUserId:()=> 'me',S,VS,C,VC,
  tracer:()=>new THREE.Group()};
 runInNewContext(code.slice(start,end)+'\nthis.draw=onlineShotTracer;',state);
 const viewTip=new THREE.Vector3(.3,-.2,-1.8);
 state.draw({actorId:'me',weaponId:9,x:.05,y:1.05,z:1.4,
  yaw:0,pitch:0,projectileSpeed:420},viewTip);
 assert.equal(state.onlineShotTracers.length,1);
 const tracer=state.onlineShotTracers[0];
 assert.equal(tracer.scene,S);
 assert.equal(tracer.m.parent,S);
 assert.notEqual(tracer.m.parent,VS);
 const muzzleNdc=viewTip.clone().project(VC);
 const tracerNdc=tracer.m.position.clone().project(C);
 assert.ok(Math.abs(muzzleNdc.x-tracerNdc.x)<1e-8);
 assert.ok(Math.abs(muzzleNdc.y-tracerNdc.y)<1e-8);
 assert.ok(Math.abs(Math.hypot(tracer.vx,tracer.vy,tracer.vz)-420)<1e-8);
 state.draw({actorId:'remote',weaponId:9,x:0,y:1.05,z:1.3,
  yaw:0,pitch:0,projectileSpeed:180});
 assert.equal(state.onlineShotTracers[1].scene,S);
 assert.equal(state.onlineShotTracers[1].vz,180);
 state.draw({actorId:'me',weaponId:9,x:NaN,y:0,z:0,yaw:0,pitch:0},viewTip);
 assert.equal(state.onlineShotTracers.length,2);
 assert.doesNotMatch(code.slice(start,end),/scene=VS|speed\/14|Math\.min\(18,/);
});
test('online prediction uses original OB wall collider; cannot tunnel through a wall',()=>{
 const {ctx,pl,api}=harness();
 ctx.OB.push({x:0,z:2,hw:2,hd:.5,h:3});
 for(let i=0;i<90;i++)api.step(pl,forward,1/60);
 assert.ok(pl.z<=2-.5-.55+1e-6,'camera must remain in front of existing wall');
 assert.equal(api.blocked(pl.x,pl.y,2,.55),true);
});
test('server reconciliation never interpolates camera through the original collider',()=>{
 const {ctx,pl,api}=harness();
 ctx.OB.push({x:0,z:2,hw:2,hd:.5,h:3});
 pl.z=.8;
 const correction={x:0,y:0,z:5};
 for(let i=0;i<60;i++)api.correct(pl,correction,.25,.55);
 assert.ok(pl.z<=.95+1e-6,'smoothing must stop before wall face');
 assert.equal(correction.z,0,'blocked correction must clear without jitter');
});
test('prediction respects doors, overhead geometry and map perimeter',()=>{
 const {ctx,pl,api}=harness();
 ctx.OB.push({x:0,z:2,hw:2,hd:.5,h:3,fl:1});
 for(let i=0;i<60;i++)api.step(pl,forward,1/60);
 assert.ok(pl.z>2,'original floor-like colliders remain walkable');
 ctx.OB.length=0;
 pl.x=59.4;pl.z=0;
 for(let i=0;i<10;i++)api.step(pl,{...forward,yaw:Math.PI/2},.05);
 assert.ok(pl.x<=59.45,'prediction remains inside the canonical A=60 boundary');
});

test('online foundation step-up uses actual offline gh() surface, not y=0',()=>{
 const {ctx,pl,api}=harness();
 ctx.OB.push({x:0,z:2,hw:2,hd:2,h:.9,fl:1,st:.95});
 for(let i=0;i<40;i++)api.step(pl,forward,1/60);
 assert.ok(pl.z>2,'walkable original foundation allows movement');
 assert.equal(pl.y,.9,'feet stay on the top face, not inside foundation');
 assert.equal(pl.grounded,true);
});
test('jumping and landing on elevated foundation matches original ground solver',()=>{
 const {ctx,pl,api}=harness();
 ctx.OB.push({x:0,z:0,hw:2,hd:2,h:.9,fl:1,st:.95});
 pl.y=.9;
 api.step(pl,{...forward,moveZ:0,jump:true},.05);
 assert.ok(pl.y>.9,'jump rises above platform');
 assert.equal(pl.grounded,false);
 for(let i=0;i<40;i++)api.step(pl,{...forward,moveZ:0},.05);
 assert.equal(pl.y,.9,'falling lands on foundation');
 assert.equal(pl.grounded,true);
});
test('reconciliation cannot push a grounded camera beneath an original raised floor',()=>{
 const {ctx,pl,api}=harness();
 ctx.OB.push({x:0,z:0,hw:2,hd:2,h:.9,fl:1,st:.95});
 pl.y=.9;
 const offset={x:0,y:-.7,z:0};
 for(let i=0;i<15;i++)api.correct(pl,offset,.3,.55);
 assert.equal(pl.y,.9);
 assert.equal(offset.y,0);
});

test('a server-confirmed visible death transfers the exact model into original offline ragdoll ownership',()=>{
 const start=code.indexOf('function onlineConfirmedDeath('),end=code.indexOf('\nfunction onlineReactToImpact(',start);
 assert.ok(start>=0&&end>start);
 const corpses=[],actors=new Map(),en=[],model={x:2,y:.9,z:3,dead:false,g:{visible:true}};
 const ctx={onlineActors:actors,en,pl:{x:0,z:0},onlineUserId:()=>'me',
  spawnBotDeathVisual:(bot,dx,dz,ex)=>corpses.push({bot,dx,dz,ex})};
 runInNewContext(code.slice(start,end)+'\nthis.death=onlineConfirmedDeath;',ctx);
 ctx.death({actorId:'me',victimId:'target'});
 assert.equal(corpses.length,0,'hidden or unknown actor never becomes a corpse');
 actors.set('target',{model});en.push(model);
 ctx.death({actorId:'me',victimId:'target'});
 assert.equal(corpses.length,1);
 assert.equal(corpses[0].bot,model);
 assert.equal(model.dead,true);
 assert.equal(actors.has('target'),false);
 assert.equal(en.length,0);
 ctx.death({actorId:'me',victimId:'target'});
 assert.equal(corpses.length,1,'duplicate KILL events cannot create duplicate corpses');
});
test('online confirmed shots use the original damage wobble, not duplicated visual formulas',()=>{
 assert.match(code,/botDamageReaction\(model,visualDamage,dx,dz,!!headshot,true\)/);
 assert.match(code,/updDead\(dt\)/);
 assert.doesNotMatch(code,/actor\.fellAt/);
 assert.match(code,/if\(!actor\.alive\)return;/);
});

test('original offline BOT corpse falls, stays on the ground, and cleans itself in online mode',()=>{
 const offline=readFileSync(new URL('../src/game/65-audio.js',import.meta.url),'utf8');
 const start=offline.indexOf('function spawnBotDeathVisual(');
 const end=offline.indexOf('// killE():',start);
 const deadStart=offline.indexOf('function updDead(');
 assert.ok(start>0&&end>start&&deadStart>end,'offline ragdoll helpers must be shared');
 const removed=[],pools=[],dead=[];
 const ctx={Math,dead,S:{remove:g=>removed.push(g)},
  detachGun:()=>{},spark:()=>{},gh:()=>0,resolve:()=>{},
  updH:()=>{},updG:()=>{},updDrops:()=>{},updCh:()=>{},
  bloodPoolSpawn:(x,y,z,corpse)=>{const p={corpse};pools.push(p);return p},
  bloodPoolRemove:p=>{p.removed=true}};
 runInNewContext(offline.slice(start,end)+'\n'+offline.slice(deadStart)+
  '\nthis.spawn=spawnBotDeathVisual;this.advance=updDead;',ctx);
 const arm=()=>({rotation:{z:0,set:()=>{}},scale:{y:1},
  userData:{fa:{quaternion:{set:()=>{}}}}});
 const rot={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z}};
 const model={x:0,y:0,z:1,tm:1,ms:[],
  mk:{visible:true},nm:{visible:true},
  g:{visible:true,userData:{gun:{position:{set:()=>{}}}},
   rotation:{y:0},position:{set:()=>{}}},
  body:{rotation:rot,position:{y:0}},arms:[arm(),arm()],
  legs:[{rotation:{z:0}},{rotation:{z:0}}]};
 ctx.spawn(model,0,1,0);
 assert.equal(dead.length,1);
 assert.equal(pools[0].corpse,dead[0],'blood pool follows the original animated corpse');
 ctx.advance(.18);
 assert.notEqual(rot.x,0,'the original ragdoll should visibly tilt after death');
 ctx.advance(.5);
 assert.equal(dead[0].land,true);
 assert.equal(removed.includes(model.g),false,'actor cannot blink out after 700ms');
 for(let i=0;i<10;i++)ctx.advance(.1);
 assert.equal(dead.length,1,'corpse remains on ground before original fadeout');
 for(let i=0;i<20;i++)ctx.advance(.1);
 assert.equal(dead.length,0,'original corpse lifecycle performs cleanup');
 assert.ok(removed.includes(model.g));
 assert.equal(pools[0].removed,true);
});

test('match scoreboard cannot preempt the original confirmed ragdoll lifecycle',()=>{
 const begin=code.indexOf('function onlineFinalizeCompletedMatch(');
 const end=code.indexOf('\nfunction onlineReceiveFrame(',begin);
 assert.ok(begin>=0&&end>begin);
 assert.match(code,/spawnBotDeathVisual\(model,dx,dz,0\)/);
 assert.match(code,/onlineResultFallbackTimer=setTimeout\(function\(\)/);
 assert.match(code,/ONLINE_MATCH_END_TIMING\.pauseMs/);
 assert.match(code,/ONLINE_MATCH_END_TIMING\.announcementMs/);
 assert.match(code,/var wantsFire=!onlinePendingMatchCompleted&&!pl.dead/);
 assert.match(code,/mt.over=game.status==='COMPLETED'&&!onlineActive/);
 assert.match(code,/onlineFinalizeCompletedMatch\(completed\)/);
});
