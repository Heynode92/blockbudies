// ---- MAIN SIMULATION ----
// update(dt): one simulation step (dt in seconds, capped at .05 in loop()). Order: timers -> player movement/jump ->
// aiming (ADS) and weapon timers (AWP bolt) -> player shooting -> crates -> grenades -> bots -> bullets -> particles -> HUD.
// update
function update(dt){
  tt+=dt;sndN=0;if(mt.cd<=0)pl.inv=Math.max(0,(pl.inv||0)-dt);
  if(mt.cd>0)mt.cd-=dt;else if(!mt.over){mt.t-=dt;if(mt.t<=0&&!isBombMode()){endMatch();return;}}
  var mx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+ST.l.x,mz=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0)+ST.l.y,ml=Math.hypot(mx,mz);
  if(pl.dead||mt.cd>0||(isBombMode()&&pl.bAction)){mx=mz=ml=0;}if(ml>1){mx/=ml;mz/=ml;ml=1;}
  var shoot=!pl.dead&&mt.cd<=0&&!(isBombMode()&&pl.bAction)&&(!!keys.KeyF||fireHeld||(mouse.down&&document.pointerLockElement===R.domElement));
  var pb0=pl.bolt||0;pl.bolt=Math.max(0,pb0-dt);if(pl.w!==8||pl.dead)pl.bolt=0;if(pb0>0&&pl.bolt===0&&pl.w===8&&!pl.dead&&pl.mag<=0)reload();
  if(pl.w!==8||pl.dead||pl.rl>0||pl.bolt>0)scopeOn=false;
  var wA=!pl.dead&&(pl.w===8?scopeOn:mouse.right)&&canAds(pl.w)&&pl.rl<=0&&pl.sw<=0&&pl.thr<=0&&pl.stab<=0,wS=!pl.dead&&(keys.ShiftLeft||keys.ShiftRight)&&-mz>.25&&!wA&&!shoot;
  adsT+=((wA?1:0)-adsT)*Math.min(1,dt*12);sprT+=((wS?1:0)-sprT)*Math.min(1,dt*9);
  if(!pl.dead)pl.life+=dt;else{pl.dt+=dt;pl.rsT-=dt;if(pl.rsT<=0&&!mt.over&&!isBombMode())respawnPl();}
  var spd=6.5*(1+.62*sprT)*(1-.38*adsT)*(1-.12*wtT)*WP[pl.w].moveMult;
  mvAmt+=(ml-mvAmt)*Math.min(1,dt*8);wtT+=((pl.w>=1&&pl.w<=3||pl.w===6||pl.w===8?1:0)-wtT)*Math.min(1,dt*6);
  var fw=-mz,sf=Math.sin(pl.face),cf=Math.cos(pl.face);pl.x+=(fw*sf-mx*cf)*spd*dt;pl.z+=(fw*cf+mx*sf)*spd*dt;resolve(pl,.55);
  var py=pl.y,gy=gh(pl.x,pl.z,py);
  if(!pl.dead&&!(isBombMode()&&pl.bAction)&&(keys.Space||jumpHeld)&&pl.y<=gy+.001)pl.vy=9;
  pl.vy-=28*dt;pl.y+=pl.vy*dt;gy=gh(pl.x,pl.z,py);
  if(pl.y<=gy){pl.y=gy;pl.vy=0;}
  if(pl.vy===0&&Math.abs(pl.y-camY)<1.2)camY+=(pl.y-camY)*Math.min(1,dt*16);else camY=pl.y;
  var rk=pl.dead?0:1;pl.face-=ST.r.x*2.4*dt*rk;pl.pitch=Math.max(-1.2,Math.min(1.2,pl.pitch-ST.r.y*1.6*dt*rk));
  var cdo=pl.cd;pl.cd-=dt;pl.ov=(cdo>0&&pl.cd<0)?-pl.cd:0;var w=WP[pl.w];pl.sw=Math.max(0,pl.sw-dt);pl.stab=Math.max(0,pl.stab-dt);pl.ghide=Math.max(0,pl.ghide-dt);if(pl.sth&&pl.stab<=.23){pl.sth=false;doStab();}if(pl.thr>0){pl.thr=Math.max(0,pl.thr-dt);if(pl.pend&&pl.thr<=.225){pl.pend=false;throwG();}}
  if(pl.rl>0){pl.rl-=dt;if(pl.rl<=0){var n=Math.min(w.mag-pl.mag,pl.res);pl.mag+=n;pl.res-=n;}}
  for(var sn=0;sn<3&&shoot&&pl.cd<=0&&pl.rl<=0&&pl.thr<=0&&pl.sw<=0;sn++){if(sn>0)pl.ov=-pl.cd;if(w.melee){pl.cd=w.cd;pl.stab=.42;pl.sth=true;}else if(w.gr){if(pl.mag>0){pl.thr=.5;pl.pend=true;pl.cd=w.cd;}}else if(pl.mag>0){fire(pl,pl.face,w,"p",pl.ov);ejectShell(pl.w,(pl.w===7&&shotSide)?-1:1);pl.cd=w.cd-pl.ov;kick=Math.min(.26,kick+w.viewKick);flashT=Math.min(.06,w.cd*.75);camShot(pl.w);gunSfx(GS[SFXI[pl.w]],1);if(w.snp){scopeOn=false;pl.mag--;pl.bolt=BOLT_T;pl.bc=0;}else if(--pl.mag===0)reload();}else reload();}
  if(!pl.dead&&pl.w===7&&pl.mag<=0&&pl.res<=0){var kk=pl.ammo[6];if(kk&&kk.mag+kk.res>0)toggleDual();}
  if(!pl.dead&&pl.mag<=0&&pl.res<=0&&pl.rl<=0&&pl.thr<=0&&!WP[pl.w].melee&&!WP[pl.w].gr){
    var pistol=amo(0),next=pistol.mag+pistol.res>0?1:2;
    swSlot(next);toast("Out of ammo");}
  // crates
  crateT-=dt;if(DM_RULES.crates&&crateT<=0&&cr.length<12){crateT=2;var x,z,k=0;do{x=(Math.random()*2-1)*(A-3);z=(Math.random()*2-1)*(A-3);}while(inObs(x,z,1)&&k++<12);mkCrate(x,z,46,rci());}
  for(var i=cr.length-1;i>=0;i--){var c=cr[i];
    if(!c.land){var fb=.45+gh(c.x,c.z,0);c.age+=dt;var tv=-Math.max(1.2,Math.min(6,(c.y-fb)*.8));c.vy+=(tv-c.vy)*Math.min(1,dt*2);c.y+=c.vy*dt;
      var swy=Math.min(1,(c.y-fb)/4);c.m.rotation.x=Math.sin(tt*1.5+c.x)*.08*swy;c.m.rotation.z=Math.cos(tt*1.2+c.z)*.08*swy;
      if(c.pc){var u0=Math.min(1,c.age/1.4),k3=u0-1,eb=1+2.70158*k3*k3*k3+1.70158*k3*k3,sc=.2+.8*eb,fx2=1+.02*Math.sin(tt*3.1+c.x);c.pc.scale.set(sc*fx2,sc*(1+.035*Math.sin(tt*2.3+c.z)),sc*fx2);}
      if(c.y<=fb){c.y=fb;c.land=true;c.m.rotation.x=c.m.rotation.z=0;dropChute(c);}}
    c.m.position.y=c.y+(c.land?Math.sin(tt*3+c.x)*.08:0);c.m.rotation.y+=dt*(c.land?1.5:.3);
    if(!pl.dead&&c.land&&Math.hypot(c.x-pl.x,c.z-pl.z)<1.2&&!(c.ci===3&&pl.hp>=100)){S.remove(c.m);cr.splice(i,1);pick(c.ci);}}
  updChutes(dt);
  // enemies
  botsUpd(dt);
  updDead(dt);
  // bullets
  for(i=bl.length-1;i>=0;i--){var b2=bl[i],p=b2.m.position,hit=false,ho=null,hn=null,ddt=dt+(b2.ad||0),ns=Math.max(1,Math.ceil(Math.hypot(b2.vx,b2.vz,b2.vy||0)*ddt/.2)),sd=ddt/ns;b2.ad=0;
    for(var ss=0;ss<ns&&!hit;ss++){
      var qx=p.x,qy=p.y,qz=p.z;p.x+=b2.vx*sd;p.z+=b2.vz*sd;p.y+=(b2.vy||0)*sd;b2.life-=sd;hn=null;
      if(b2.rk&&ss===0){spark(p.x,p.y,p.z,0x9aa0a8,1,.6,.16);spark(p.x,p.y,p.z,0xff9f1c,1,.8,.1);smoke(p.x,p.y,p.z,1,.15,.22,1.1,.3,0);}
      ho=sweepObs(qx,qy,qz,p.x,p.y,p.z)||obsAt(p.x,p.z,p.y);
      if(ho)hn=faceOf(ho,qx,qy,qz,p);
      else if(p.y<3&&(Math.abs(p.x)>A||Math.abs(p.z)>A)){ho=bw;hn=Math.abs(p.x)>Math.abs(p.z)?{x:p.x>0?A:-A,y:p.y,z:p.z,ax:0,sg:p.x>0?-1:1}:{x:p.x,y:p.y,z:p.z>0?A:-A,ax:2,sg:p.z>0?-1:1};}
      if(!ho){var lt2=sweepLT(qx,qy,qz,p.x,p.y,p.z);if(lt2){ho=lt2;hn=faceOf(lt2,qx,qy,qz,p);}}
      if(!ho)for(var li=0;li<LT.length;li++){var lt=LT[li];if(Math.abs(p.x-lt.x)<lt.hw&&Math.abs(p.z-lt.z)<lt.hd&&p.y>=lt.y0&&p.y<=lt.h){ho=lt;hn=faceOf(lt,qx,qy,qz,p);break;}}
      hit=b2.life<=0||p.y<gh(p.x,p.z,p.y)+.03||Math.abs(p.x)>A+1||Math.abs(p.z)>A+1||!!ho;
      if(!hit){var bt=b2.tm;
        for(var j=0;j<en.length;j++){var EE=en[j];if(EE.tm===bt||EE.inv>0)continue;if(Math.hypot(EE.x-p.x,EE.z-p.z)<.85&&p.y-(EE.y||0)<2.1){
          if(!b2.rk){curK=b2.by;var hd=p.y-(EE.y||0)>=1.38;
            if(b2.own==="p"){killW=b2.wid;var fm=fall(b2,p);if(hd&&EE.helm){popHelm(EE,b2.vx,b2.vz);dmgE(EE,b2.dmg*fm,b2.vx,b2.vz);}else{hsF=hd;dmgE(EE,b2.dmg*fm*(hd?3:1),b2.vx,b2.vz);hsF=false;}}
            else{killW=1;dmgE(EE,b2.dmg*(hd?3:1),b2.vx,b2.vz);}}
          hit=true;break;}}
        if(!hit&&pl.tm!==bt&&!pl.dead&&pl.inv<=0&&Math.hypot(pl.x-p.x,pl.z-p.z)<.7&&Math.abs(p.y-(pl.y+1))<1.1){curK=b2.by;var phd=p.y>=pl.y+1.38;if(phd&&pl.helm){popPl();hurt(b2.dmg,b2.sx,b2.sz);}else hurt(b2.dmg*(phd?2:1),b2.sx,b2.sz);hit=true;}}
    }
    if(hit){if(hn)impact(ho,hn,b2);else if(p.y<gh(p.x,p.z,p.y)+.03)gImpact(p);if(b2.rk)boom(p.x,p.z,b2.dmg,0,p.y);else spark(p.x,p.y,p.z,b2.own==="p"?0xffd54a:0xff5c5c,7,5,.07);S.remove(b2.m);bl.splice(i,1);}}
  for(i=sk.length-1;i>=0;i--){var q=sk[i];q.t+=dt;q.m.position.x+=q.vx*dt;q.m.position.y+=q.vy*dt;q.m.position.z+=q.vz*dt;q.vy-=9*dt;q.m.scale.setScalar(Math.max(.001,q.sz*(1-q.t/q.l)));if(q.t>=q.l){S.remove(q.m);sk.splice(i,1);}}
  for(i=mzf.length-1;i>=0;i--){mzf[i].t-=dt;if(mzf[i].t<=0){S.remove(mzf[i].m);mzf.splice(i,1);}}
  updCl(dt);updSm(dt);
  for(i=fx.length-1;i>=0;i--){var f2=fx[i];f2.t+=dt*3;f2.m.scale.setScalar(.5+f2.t*4);f2.m.material.opacity=Math.max(0,.7-f2.t*.7);if(f2.t>=1){S.remove(f2.m);fx.splice(i,1);}}
  pm.g.position.set(pl.x,pl.y,pl.z);pm.g.rotation.y=pl.face;pm.legs[0].rotation.x=Math.sin(tt*10)*.6*ml;pm.legs[1].rotation.x=-pm.legs[0].rotation.x;pm.body.rotation.y=0;flash(pm,dt);if(pl.dead){var dp=Math.min(1,pl.dt/.6),ds=dp*dp*(3-2*dp),an=-Math.PI/2*ds;pm.body.rotation.set(an,0,0);pm.body.position.y=.3*Math.abs(Math.sin(an));pm.arms[0].rotation.z=-1.1*ds;pm.arms[1].rotation.z=1.1*ds;pm.legs[0].rotation.z=-.3*ds;pm.legs[1].rotation.z=.3*ds;}
  // Bomb objective and round resolution run after damage so an eliminated actor cannot finish an action.
  if(isBombMode())bombUpdate(dt);
  // HUD
  hud();hdUpd(dt);kfUpd(dt);
  if(toastT>0&&(toastT-=dt)<=0)document.getElementById("toast").style.opacity=0;var ht=document.getElementById("hit");ht.style.opacity=Math.max(0,ht.style.opacity-dt*2);
}
