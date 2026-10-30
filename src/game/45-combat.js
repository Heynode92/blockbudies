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
var trG=new T.CylinderGeometry(1,1,1,6);trG.rotateX(Math.PI/2);
var coreM=new T.MeshBasicMaterial({color:0xffffff}),
 glP=new T.MeshBasicMaterial({color:0xffc233,transparent:true,opacity:.28,blending:T.AdditiveBlending,depthWrite:false}),
 glE=new T.MeshBasicMaterial({color:0xff3b3b,transparent:true,opacity:.3,blending:T.AdditiveBlending,depthWrite:false}),
 glR=new T.MeshBasicMaterial({color:0xff7a1a,transparent:true,opacity:.6,blending:T.AdditiveBlending,depthWrite:false});
// tracer(): builds a bullet mesh (white core + additive glow). own = "p" (player) or "e" (enemy), rk = rocket (bigger).
function tracer(own,rk){var g=new T.Group(),L=rk?.9:1.1,r=rk?.1:.016;
  var c=new T.Mesh(trG,coreM);c.scale.set(r,r,L);var gl=new T.Mesh(trG,own==="p"?(rk?glR:glP):glE);gl.scale.set(r*2.6,r*2.6,L*1.15);g.add(c,gl);return g;}
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
  bloodPoolClear();bloodActive=0;if(typeof botIntelReset==='function')botIntelReset();pl={helm:true,vest:DEFENSE_RULES.vestMax,dead:false,dt:0,rt:0,life:0,x:0,z:10,hp:DEFENSE_RULES.maxHp,w:1,mag:30,res:90,rl:0,pump:0,pumpEjected:false,cd:0,face:Math.PI,pitch:0,y:0,vy:0,slot:0,prim:1,sw:0,stab:0,sth:false,thr:0,pend:false,ghide:0,ammo:(function(){var o={};WP.forEach(function(w,i){o[i]={mag:w.mag,res:w.res};});return o;})()};en=[];bl=[];cr=[];fx=[];sk=[];dead=[];dg=[];grs=[];chutes=[];resetKillStreak();shakeT=0;score=0;spawnT=1;crateT=.5;adsT=sprT=0;resetPm();hlms.forEach(function(h){S.remove(h.m);});hlms=[];setHm();document.body.classList.remove("dead");
}
// toast(): shows a short message in the middle of the screen (toastT = time left).
function toast(t){var e=document.getElementById("toast");e.textContent=t;e.style.opacity=1;toastT=1.4;}
// fire(o, face, w, own, adv): shoots weapon table entry `w` from shooter `o` (player `pl` or a bot) facing `face`.
//  own = "p" (player) or "e" (enemy bot). adv = extra time already elapsed (lets high fire-rate weapons catch up within a frame).
//  Player bullets start at the visible muzzle (hold.position + MZ) and are aimed at the crosshair distance D.
//  Dual Kriss: shotSide flips each shot (0 = right gun, 1 = left gun at x-0.52) and the bullet spawns from that gun.
//  Tracers are only visible for every 3rd bullet of rapid-fire weapons (performance); collision still happens for all bullets.
function fire(o,face,w,own,adv){
  if(typeof botSoundEmit==='function')botSoundEmit(o,'gunshot');
  var D=w.snp?90:w.dual?45:20,
      patternedShotgun=w.pel>1&&w.stats&&w.stats.kind==="shotgun";
  for(var i=0;i<w.pel;i++){
    // Fixed shotgun pattern on both axes; other weapons keep their original RNG.
    var pelletOffset=patternedShotgun?shotgunPelletSpread(i,w.pel):null,
        spreadScale=own==="p"?(w.snp?1-adsT:1-.65*adsT):1,
        yawOffset=patternedShotgun?pelletOffset[0]:(Math.random()-.5)*2,
        a=face+yawOffset*w.spr*spreadScale,g=tracer(own,w.rk);
    var mx0,my0,mz0;if(own==="p"){if(w.dual)shotSide=shotSide?0:1;var lx=hold.position.x-(w.dual&&shotSide?.52:0),dd=-(hold.position.z+MZ[pl.w]);mx0=o.x+Math.sin(face)*dd-Math.cos(face)*lx;mz0=o.z+Math.cos(face)*dd+Math.sin(face)*lx;my0=1.5+(o.y||0)+hold.position.y+.02;a+=Math.atan(lx/D);}else{var ey=face;mx0=o.x+Math.sin(ey)*1.1+Math.cos(ey)*.05;mz0=o.z+Math.cos(ey)*1.1-Math.sin(ey)*.05;my0=1.07+(o.y||0)-.3*(o.crA||0);}
    var vy0=own==="p"?w.spd*(1.5+(o.y||0)+D*Math.tan(pl.pitch)-my0)/D:0;
    // Add elevation only to shotgun pellets, on top of the existing
    // player muzzle-to-crosshair pitch or bot's original flat trajectory.
    if(patternedShotgun)vy0+=w.spd*Math.tan(pelletOffset[1]*w.spr*spreadScale);
    o.tc=(o.tc||0)+1;g.visible=!!(w.rk||w.pel>1||w.snp||o.tc%3===1);g.rotation.order="YXZ";g.rotation.set(-Math.atan2(vy0,w.spd||1),a,0);if(Math.abs(mx0)>=A||Math.abs(mz0)>=A||sweepObs(o.x,my0,o.z,mx0,my0,mz0)||sweepLT(o.x,my0,o.z,mx0,my0,mz0)||obsAt(mx0,mz0,my0)){mx0=o.x;mz0=o.z;}
    g.position.set(mx0,my0,mz0);S.add(g);
    var ad=adv||0;
    bl.push({m:g,vx:Math.sin(a)*w.spd,vy:vy0,vz:Math.cos(a)*w.spd,life:w.life,ad:ad,dmg:w.dmg,own:own,tm:o.tm,by:o,rk:w.rk,sx:o.x,sz:o.z,wid:WP.indexOf(w),fo:w.rangeModifier?[w.rangeModifier,w.rangeUnit]:null});if(own==="e"&&i===0)enemyShotFx(o,mx0,my0,mz0);if(w.rk&&own==="p")smoke(mx0,my0,mz0,6,1.4,.3,1.3,.25,0);}
}
// boom(): explosion (rocket or grenade) at (x,z): splash damage with line-of-sight check, scorch decal, particles, camera shake. lab = kill-feed label.
function boom(x,z,dmg,lab,by,shooter){var attacker=shooter||pl;curK=attacker;boomLab=lab||"RPG";killW=boomLab==="GRENADE"?5:3;if((by===undefined||by<1.1)&&Math.abs(x)<A&&Math.abs(z)<A)gDecal(TXS,x,z,3.2+Math.random()*.6);
  var m=new T.Mesh(new T.SphereGeometry(1,14,14),new T.MeshBasicMaterial({color:0xffa94d,transparent:true,opacity:.7}));
  m.position.set(x,Math.max(.3,Math.min(1.5,by||1)),z);S.add(m);fx.push({m:m,t:0});spark(x,1,z,0xffa94d,26,9,.28);spark(x,1,z,0xfff3bf,10,5,.2);var sy=Math.max(.3,Math.min(1.5,by||1));smoke(x,sy,z,8,3.2,1,2.4,1.2,1);smoke(x,.35,z,10,4.5,.9,2.2,.25,0);smoke(x,sy+.4,z,5,1.2,1.2,3,1.6,1);
  boomN=0;inBoom=true;
  en.slice().forEach(function(e){if(e.tm===attacker.tm||e.dead)return;var dd=Math.hypot(e.x-x,e.z-z);if(dd<4.2&&clearTo(x,z,e.x,e.z,.45)){var k=dd||1;dmgE(e,dmg,(e.x-x)/k,(e.z-z)/k,1,"explosive");}});
  if(attacker!==pl&&!attacker.dead){var selfDistance=Math.hypot(attacker.x-x,attacker.z-z);if(selfDistance<4.2&&clearTo(x,z,attacker.x,attacker.z,.45))dmgE(attacker,Math.ceil(dmg*(1-selfDistance/4.2*.8)),0,0,1,"explosive");}
  inBoom=false;var pd=Math.hypot(pl.x-x,pl.z-z);if((pl.tm!==attacker.tm||attacker===pl)&&pd<4.2&&clearTo(x,z,pl.x,pl.z,.45))hurt(Math.ceil(dmg*(1-pd/4.2*.8)),x,z,"explosive");shakeT=Math.max(shakeT,.35);if(boomN>0)killNotify(boomN>2);
}
