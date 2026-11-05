// BOLT_T = AWP bolt-action cycle length in seconds (must stay <= the AWP fire cooldown so the next shot is possible when it ends).
// MZ = per-weapon muzzle z offset in viewmodel space (where bullets and muzzle flash start). kick = recoil offset. flashT = muzzle flash time left.
var BOLT_T=1.1,MZ=[-0.7,-1,-1.15,-1.2,-0.9,-0.3,-0.9,-0.9,-1.62,-1.3,-1.04,-1,-1.38,-1.51,-1.02,-1.63,-1.49,-2.43,-1.54],kick=0,flashT=0;
// mkPick(): small floating weapon model shown on top of a crate. ci = crate type (weapon id = ci + 1).
function mkPick(ci){var g=new T.Group(),gn=mkGun(ci+1);gn.scale.setScalar(ci===2?1.2:1.5);gn.position.z=[0,.5,.45,.72][ci+1];g.add(gn);
  g.add(new T.Mesh(new T.SphereGeometry(.85,16,12),new T.MeshBasicMaterial({color:CC[ci],transparent:true,opacity:.22,depthWrite:false})));return g;}
// mkMed(): medkit model for crates with ci === 3 (heals +40 HP, see pick()).
function mkMed(){var g=new T.Group(),r=0xe03131;g.add(bx(.8,.6,.8,0xf8f9fa,0,0,0));
  for(var k=0;k<4;k++){var s=new T.Group();s.rotation.y=k*Math.PI/2;s.add(bx(.36,.1,.03,r,0,0,.41),bx(.1,.36,.03,r,0,0,.41));g.add(s);}
  g.add(bx(.36,.03,.1,r,0,.31,0),bx(.1,.03,.36,r,0,.31,0));
  g.add(new T.Mesh(new T.SphereGeometry(.85,16,12),new T.MeshBasicMaterial({color:0x69db7c,transparent:true,opacity:.2,depthWrite:false})));return g;}
// rci(): random crate contents. Returns 3 (medkit) more often when the player HP is low, otherwise 0..2 (rifle/shotgun/rocket crates).
function rci(){return Math.random()<(pl.hp<50?.5:.25)?3:Math.floor(Math.random()*3);}
// Tracer (bullet streak) geometry and materials. coreM = white core, glP = player glow (yellow), glE = enemy glow (red), glR = rocket glow (orange).
// A tapered, thin streak with a compact additive halo. Only rendering is
// changed: the same shared tracer() is called by offline and verified online
// effects; projectile hit/damage physics are not touched.
var trG=new T.CylinderGeometry(.28,1,1,8);trG.rotateX(Math.PI/2);
var coreM=new T.MeshBasicMaterial({color:0xfffbed}),
 glP=new T.MeshBasicMaterial({color:0xffc765,transparent:true,opacity:.48,blending:T.AdditiveBlending,depthWrite:false}),
 glE=new T.MeshBasicMaterial({color:0xff6c53,transparent:true,opacity:.5,blending:T.AdditiveBlending,depthWrite:false}),
 glR=new T.MeshBasicMaterial({color:0xff7a1a,transparent:true,opacity:.6,blending:T.AdditiveBlending,depthWrite:false});
// tracer(): a slim tapered core and proportional halo; rockets retain their distinct body.
function tracer(own,rk){var g=new T.Group(),L=rk?.9:1.1,r=rk?.1:.009;
  var c=new T.Mesh(trG,coreM);c.scale.set(r,r,L);
  var gl=new T.Mesh(trG,own==="p"?(rk?glR:glP):glE);
  gl.scale.set(r*2.5,r*2.5,L*1.12);g.add(c,gl);return g;}
// spark(): spawns n small additive particles at (x,y,z). Stored in `sk`, moved/faded in update().
var spG=new T.SphereGeometry(1,6,6),spM={};
function spark(x,y,z,col,n,sp,sz){var m0=spM[col]||(spM[col]=new T.MeshBasicMaterial({color:col,transparent:true,opacity:.9,blending:T.AdditiveBlending,depthWrite:false}));
  for(var i=0;i<n;i++){var m=new T.Mesh(spG,m0),a=Math.random()*6.28,b=Math.random()*2-1,k=Math.sqrt(1-b*b),v=sp*(.4+Math.random()*.6);
    m.position.set(x,y,z);S.add(m);sk.push({m:m,vx:Math.cos(a)*k*v,vy:b*v+(n>1?2:.4),vz:Math.sin(a)*k*v,t:0,l:n>1?.3+Math.random()*.25:.5,sz:sz});}}
// Character impact blood: small non-additive world-space droplets, never ammo or damage.
// Share the existing particle update/reset path and cap live drops to protect frame time.
var BLOOD_FX=Object.freeze({max:96,body:9,head:14}),bloodActive=0,
 bloodM=new T.MeshBasicMaterial({color:0xa31124,transparent:true,opacity:.95,depthWrite:false});
function bloodHit(x,y,z,dx,dz,head){
 if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))return;
 var length=Math.hypot(dx||0,dz||0)||1,n=Math.min(head?BLOOD_FX.head:BLOOD_FX.body,BLOOD_FX.max-bloodActive);
 for(var i=0;i<n;i++){
  var a=Math.random()*Math.PI*2,speed=1.2+Math.random()*2.6,
   m=new T.Mesh(spG,bloodM),forward=1.5+Math.random()*1.8;
  m.position.set(x+(Math.random()-.5)*.12,y+(Math.random()-.5)*.16,z+(Math.random()-.5)*.12);
  S.add(m);
  sk.push({m:m,vx:(dx||0)/length*forward+Math.cos(a)*speed*.6,
   vy:.7+Math.random()*2.8,vz:(dz||0)/length*forward+Math.sin(a)*speed*.6,
   t:0,l:.28+Math.random()*.23,sz:.045+Math.random()*(head?.085:.055),blood:true});
  bloodActive++;
 }
}
// reset(): clears the whole world state (bullets, bots, particles, decals) and re-creates the player object `pl` for a fresh match.
function reset(){
  [].concat(en||[],bl||[],cr||[],fx||[],sk||[],dead||[],grs||[],dg||[],chutes||[]).forEach(function(o){S.remove(o.g||o.m);});document.getElementById("kn").innerHTML="";DC.forEach(function(m){S.remove(m);});DC=[];CH.forEach(function(c){S.remove(c.m);});CH=[];cs.k=cs.s=cs.kv=cs.y=cs.yv=cs.r=cs.rv=0;clrSm();clrFD();mzf.forEach(function(q){S.remove(q.m);});mzf=[];
  if(typeof botIntelReset==='function')botIntelReset();bloodPoolClear();bloodActive=0;pl={helm:true,dead:false,dt:0,rt:0,life:0,x:0,z:10,hp:DEFENSE_RULES.maxHp,w:1,mag:30,res:90,rl:0,pump:0,pumpEjected:false,cd:0,face:Math.PI,pitch:0,y:0,vy:0,slot:0,prim:1,sw:0,stab:0,sth:false,thr:0,pend:false,ghide:0,ammo:(function(){var o={};WP.forEach(function(w,i){o[i]={mag:w.mag,res:w.res};});return o;})()};en=[];bl=[];cr=[];fx=[];sk=[];dead=[];dg=[];grs=[];chutes=[];resetKillStreak();shakeT=0;score=0;spawnT=1;crateT=.5;adsT=sprT=0;resetPm();hlms.forEach(function(h){S.remove(h.m);});hlms=[];setHm();document.body.classList.remove("dead");
}
// toast(): shows a short message in the middle of the screen (toastT = time left).
function toast(t){var e=document.getElementById("toast");e.textContent=t;e.style.opacity=1;toastT=1.4;}
// fire(o, face, w, own, adv): shoots weapon table entry `w` from shooter `o` (player `pl` or a bot) facing `face`.
//  own = "p" (player) or "e" (enemy bot). adv = extra time already elapsed (lets high fire-rate weapons catch up within a frame).
//  Player bullets start at the visible muzzle (hold.position + MZ) and are aimed at the crosshair distance D.
//  Dual Kriss: shotSide flips each shot (0 = right gun, 1 = left gun at x-0.52) and the bullet spawns from that gun.
//  Tracers are only visible for every 3rd bullet of rapid-fire weapons (performance); collision still happens for all bullets.
// Transform the actual animated first-person barrel endpoint through BOTH
// cameras. VS/VC projects the gun; C projects the world. Plainly applying
// C.quaternion to a VS coordinate would be incorrect under ADS field-of-view.
function offlineGunMuzzleWorld(o,id,left,face){
 if(o===pl){
  var local=weaponMuzzleSocket(guns[id],left);
  if(!local)throw Error('Missing visible firing muzzle socket');
  var view=local.getWorldPosition(new T.Vector3());
  VC.updateMatrixWorld(true);
  var ndc=view.clone().project(VC);
  C.updateWorldMatrix(true,false);
  var ray=new T.Vector3(ndc.x,ndc.y,.5).unproject(C)
    .sub(C.position).normalize();
  return C.position.clone().addScaledVector(ray,view.length());
 }
 var rg=o.g?.userData?.rg,socket=weaponMuzzleSocket(rg,left);
 if(!socket)throw Error('Missing BOT firing muzzle socket');
 // The BOT is simulated BEFORE the next frame's visual animation update.
 o.g.position.set(o.x,o.y||0,o.z);o.g.rotation.y=face;
 return socket.getWorldPosition(new T.Vector3());
}
function fire(o,face,w,own,adv){
 if(!w.pel)return;
 if(typeof botSoundEmit==='function')botSoundEmit(o,'gunshot');
 var weaponId=WP.indexOf(w);
 if(!o.gunplayStates)o.gunplayStates=new Map();
 var state=o.gunplayStates.get(weaponId);
 if(!state){state=freshGunplayState();o.gunplayStates.set(weaponId,state);}
 var shot=gunplayShot(weaponId,state,tt,{
  ads:own==='p'?adsT:0,speed:Math.max(0,o.gunplaySpeed||0),
  crouch:!!o.crouch,grounded:own==='p'?pl.vy===0:o.vy===0||o.vy===undefined
 },Math.random);
 // Canonical predictable barrel pose drives the actual gun mesh and hands,
 // not a second visual-only recoil accumulator.
 o.ballisticBarrelYaw=shot.barrelYaw;o.ballisticBarrelPitch=shot.barrelPitch;o.ballisticBarrelWeapon=weaponId;
 if(own==='p')syncWeaponBarrelPoseImmediate();
 if(own!=='p'&&o.g?.userData?.rg){
  var meshGun=o.g.userData.rg;
  meshGun.rotation.order='YXZ';
  meshGun.rotation.set(shot.barrelPitch,Math.PI+shot.barrelYaw,0);
 }
 var shotgun=w.pel>1&&w.stats&&w.stats.kind==='shotgun',
  sightPitch=(own==='p'?pl.pitch:(Number.isFinite(o.aimShotPitch)?o.aimShotPitch:0))+shot.pitch,
  sightYaw=face+shot.yaw,
  eye=new T.Vector3(o.x,(o.y||0)+(own==='p'?1.5:1.4),o.z),
  aimRange=Math.max(24,Math.min(80,w.spd*w.life)),side=w.dual?(shotSide=shotSide?0:1)===1:false,
  muzzle=offlineGunMuzzleWorld(o,weaponId,side,face);
 for(var i=0;i<w.pel;i++){
  var pellet=shotgun?shotgunPelletSpread(i,w.pel):null,
   spread=shotgun?w.spr*(own==='p'?(1-.23*adsT):1):0,
   ay=sightYaw+(pellet?pellet[0]*spread:0),
   ap=Math.max(-1.48,Math.min(1.48,sightPitch+(pellet?pellet[1]*spread:0))),
   target=eye.clone().add(new T.Vector3(Math.sin(ay)*Math.cos(ap),
    Math.sin(ap),Math.cos(ay)*Math.cos(ap)).multiplyScalar(aimRange)),
   travel=target.sub(muzzle).normalize(),g=tracer(own,w.rk),
   mx0=muzzle.x,my0=muzzle.y,mz0=muzzle.z;
  o.tc=(o.tc||0)+1;
  g.visible=!!(w.rk||w.pel>1||w.snp||o.tc%3===1);
  g.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),travel);
  if(Math.abs(mx0)>=A||Math.abs(mz0)>=A||
    sweepObs(eye.x,eye.y,eye.z,mx0,my0,mz0)||
    sweepLT(eye.x,eye.y,eye.z,mx0,my0,mz0)||
    obsAt(mx0,mz0,my0)){
    // The barrel is obstructed by real solid collision: never spawn a
    // projectile behind a wall just because the gun render pokes through it.
    mx0=eye.x;my0=eye.y;mz0=eye.z;
  }
  g.position.set(mx0,my0,mz0);S.add(g);
  bl.push({m:g,vx:travel.x*w.spd,vy:travel.y*w.spd,vz:travel.z*w.spd,
   life:w.life,ad:adv||0,dmg:w.dmg,own:own,tm:o.tm,by:o,rk:w.rk,
   sx:o.x,sz:o.z,wid:weaponId,fo:w.rangeModifier?[w.rangeModifier,w.rangeUnit]:null});
  if(typeof botQaEnabled!=='undefined'&&botQaEnabled)botQaShot(o,w,own,bl[bl.length-1]);
  if(own==='e'&&i===0)enemyShotFx(o,mx0,my0,mz0);
  if(w.rk&&own==='p')smoke(mx0,my0,mz0,6,1.4,.3,1.3,.25,0);
 }
}
// boom(): explosion (rocket or grenade) at (x,z): splash damage with line-of-sight check, scorch decal, particles, camera shake. lab = kill-feed label.
function boom(x,z,dmg,lab,by,shooter){var attacker=shooter||pl;curK=attacker;boomLab=lab||"RPG";killW=boomLab==="GRENADE"?5:3;if((by===undefined||by<1.1)&&Math.abs(x)<A&&Math.abs(z)<A)gDecal(TXS,x,z,3.2+Math.random()*.6);
  var m=new T.Mesh(new T.SphereGeometry(1,14,14),new T.MeshBasicMaterial({color:0xffa94d,transparent:true,opacity:.7}));
  m.position.set(x,Math.max(.3,Math.min(1.5,by||1)),z);S.add(m);fx.push({m:m,t:0});spark(x,1,z,0xffa94d,26,9,.28);spark(x,1,z,0xfff3bf,10,5,.2);var sy=Math.max(.3,Math.min(1.5,by||1));smoke(x,sy,z,8,3.2,1,2.4,1.2,1);smoke(x,.35,z,10,4.5,.9,2.2,.25,0);smoke(x,sy+.4,z,5,1.2,1.2,3,1.6,1);
  boomN=0;inBoom=true;
  en.slice().forEach(function(e){if(e.tm===attacker.tm||e.dead)return;var dd=Math.hypot(e.x-x,e.z-z);if(dd<4.2&&clearTo(x,z,e.x,e.z,.45)){var k=dd||1;dmgE(e,defenseExplosionDamage(dmg,dd),(e.x-x)/k,(e.z-z)/k,1,"explosive");}});
  if(attacker!==pl&&!attacker.dead){var selfDistance=Math.hypot(attacker.x-x,attacker.z-z);if(selfDistance<4.2&&clearTo(x,z,attacker.x,attacker.z,.45))dmgE(attacker,defenseExplosionDamage(dmg,selfDistance),0,0,1,"explosive");}
  inBoom=false;var pd=Math.hypot(pl.x-x,pl.z-z);if((pl.tm!==attacker.tm||attacker===pl)&&pd<4.2&&clearTo(x,z,pl.x,pl.z,.45))hurt(defenseExplosionDamage(dmg,pd),x,z,"explosive");shakeT=Math.max(shakeT,.35);if(boomN>0)killNotify(boomN>2);
}
