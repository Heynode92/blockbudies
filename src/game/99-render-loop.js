// ---- MAIN LOOP ----
// loop(now): runs update(dt) while a match is on, then positions the camera (normal view, lobby orbit, or death cam),
// applies recoil/shake/FOV, animates the viewmodel (animHands), and renders: world first, then the viewmodel on top with depth cleared.
// The browser pauses rAF for hidden tabs. A worker-backed heartbeat continues
// authoritative local simulation in 50ms slices without rendering WebGL offscreen.
// When a browser suspends even workers, account for elapsed round-clock time
// with a bounded catch-up rather than locking the page for thousands of frames.
function backgroundReconcileMatchTimers(seconds){
  if(onlineActive||!run||mt.over||!(seconds>0))return;
  // Controls were released on blur. Keep passive invulnerability and respawn
  // counters in sync even if the browser throttled the hidden-tab worker.
  pl.inv=Math.max(0,(pl.inv||0)-seconds);
  if(pl.dead&&!isBombMode()){pl.rsT-=seconds;if(pl.rsT<=0)respawnPl();}
  if(!isBombMode()){
    var pre=Math.min(Math.max(0,mt.cd),seconds);
    mt.cd-=pre;seconds-=pre;
    if(seconds>0)mt.t-=seconds;
    if(mt.cd<=0&&(mt.t<=0||roomReachedKillLimit()))endMatch();
    else hud();
    return;
  }
  // Bomb Mission has a freeze phase, live round timer and between-round delay.
  // Reconcile each stage chronologically; do not change plant/defuse times.
  var watchdog=0;
  while(seconds>0.000001&&run&&!mt.over&&bombMatch&&watchdog++<64){
    var b=bombMatch,delta;
    if(b.done){
      delta=Math.min(seconds,Math.max(0,b.finishDelay));
      b.finishDelay-=delta;seconds-=delta;
      if(b.finishDelay<=0)bombUpdate(0);
      else break;
    }else if(mt.cd>0){
      delta=Math.min(seconds,mt.cd);
      mt.cd-=delta;seconds-=delta;
    }else{
      delta=Math.min(seconds,Math.max(0,mt.t));
      mt.t-=delta;seconds-=delta;
      if(mt.t<=0)bombUpdate(0); // Normal fuse or timeout resolution.
      else break;
    }
  }
  if(run&&!mt.over){hud();bombHudUpdate();}
}
var last=performance.now();
var backgroundGameClock=BACKGROUND_SIM.createSimulationClock({
  now:function(){return performance.now();},
  isRunning:function(){return !!run&&!mt.over&&!onlineActive;},
  step:function(dt){if(onlineActive)return;update(pl.dead&&pl.dt<.8?dt*(.3+.7*pl.dt/.8):dt);},
  fastForward:backgroundReconcileMatchTimers
});
BACKGROUND_SIM.ticker.onPulse(function(){
  if(document.hidden)backgroundGameClock.tickBackground(performance.now());
});
function backgroundOnVisibility(){
  if(document.hidden){
    // Preserve real elapsed time on hidden tabs, then let the worker take over.
    backgroundGameClock.tickBackground(performance.now());
    BACKGROUND_SIM.ticker.setHidden(true);
  }else{
    backgroundGameClock.tickBackground(performance.now());
    BACKGROUND_SIM.ticker.setHidden(false);
  }
}
document.addEventListener("visibilitychange",backgroundOnVisibility);
BACKGROUND_SIM.ticker.setHidden(document.hidden);
addEventListener("pagehide",function(){BACKGROUND_SIM.ticker.dispose();});
(function loop(now){var qaDeltaMs=now-last,qaFrameStart=botQaEnabled?performance.now():0;var dt=Math.min((now-last)/1000,.05);last=now;if(!document.hidden)backgroundGameClock.tickVisible(now);
  if(onlineActive&&!document.hidden)onlineVisualUpdate(dt);
  shakeT=Math.max(0,shakeT-dt);var sh=shakeT*.5;cs.s*=Math.max(0,1-dt*6);spr(cs,"k","kv",dt);spr(cs,"y","yv",dt);spr(cs,"r","rv",dt);var ft=70+(ADF[pl.w]-70)*adsT+6*sprT+Math.max(0,cs.k)*45*(1-.5*adsT);if(lob||mt.over){var la=performance.now()/9000;
    if(lob&&mapPreviewSceneBomb){var an=performance.now()/7500,cam=bombMapInfo(selectedBombMapId).preview;if(cam){C.position.set(cam.x+Math.sin(an)*2,cam.y,cam.z+Math.cos(an)*2);C.lookAt(cam.lookX,cam.lookY,cam.lookZ);ft=cam.fov;}else{C.position.set(25+Math.sin(an)*1.6,2.25,5+Math.cos(an)*1.6);C.lookAt(25+Math.sin(an+0.8)*12,2.1,5+Math.cos(an+0.8)*12);ft=72;}}
    else if(lob&&selM===0&&tdmMapId(selectedTdmMapId)==="block-labs"){var cc=tdmMapInfo(selectedTdmMapId).preview;C.position.set(cc.x+Math.sin(la)*.8,cc.y,cc.z+Math.cos(la)*.8);C.lookAt(cc.lookX,cc.lookY,cc.lookZ);ft=cc.fov;}
     else{C.position.set(Math.sin(la)*34,13,Math.cos(la)*34);C.lookAt(0,2,0);ft=62;}
  }else if(pl.dead&&onlineActive&&isBombMode()){
    ft=62;
    var target=onlineWorld&&onlineWorld.actors.find(function(a){return a.id===onlineWorld.observerId;});
    var follow=target||pl,ang=(target?target.yaw:pl.face)+.65;
    C.position.set(follow.x+Math.sin(ang)*5,follow.y+3.5,follow.z+Math.cos(ang)*5);
    C.lookAt(follow.x,follow.y+1.2,follow.z);
  }else if(pl.dead&&isBombMode()){ft=SPECTATOR_CAMERA.fieldOfView;bombSpectatorCamera(dt);}else if(pl.dead){pl.rt+=dt;var u=Math.min(pl.rt,3.5),an=pl.face+2.4+pl.rt*.5,rd=3+u*1.1,hh=2.2+u*1.5;ft=62;C.position.set(Math.max(-A,Math.min(A,pl.x+Math.sin(an)*rd)),hh+pl.y,Math.max(-A,Math.min(A,pl.z+Math.cos(an)*rd)));C.lookAt(pl.x,.3+pl.y,pl.z);}
  else{var cb=mvAmt*wtT*(1-.75*adsT)*(pl.vy===0?1:0)*(1+.35*sprT),bY=-cb*.022*(.5-.5*Math.cos(2*bobP)),tr=cs.s*(1-.4*adsT),ta=tr*tr,nt=performance.now()/1000,sj=sh+ta*.06,ads2=1-.4*adsT,pp=pl.pitch+cs.k*(1-.35*adsT)+snz(nt,1)*ta*.05,fy=pl.face+cs.y*ads2+snz(nt,2)*ta*.05;C.position.set(pl.x+snz(nt,3)*sj,1.5+camY+bY+snz(nt,4)*sj-(isBombMode()&&pl.bAction?.55:0),pl.z+snz(nt,5)*sj);C.lookAt(pl.x+Math.sin(fy)*Math.cos(pp),1.5+camY+bY+Math.sin(pp)-(isBombMode()&&pl.bAction?.55:0),pl.z+Math.cos(fy)*Math.cos(pp));C.rotateZ(cs.r*ads2+snz(nt,6)*ta*.06+Math.sin(bobP)*.004*cb);}
  if(Math.abs(C.fov-ft)>.02){C.fov=ft;C.updateProjectionMatrix();}
  kick*=Math.max(0,1-dt*14);flashT-=dt;var dl=pl.w===7;mflash.visible=flashT>0&&run&&!(dl&&shotSide);mflash2.visible=flashT>0&&run&&dl&&!!shotSide;var suppressedFlash=!!(GS[SFXI[pl.w]]&&GS[SFXI[pl.w]].suppressed);mflash.scale.setScalar((suppressedFlash?.17:.7)+Math.random()*(suppressedFlash?.12:.8));mflash2.scale.setScalar(.7+Math.random()*.8);mflash.position.set(0,.02,MZ[pl.w]);mflash2.position.set(-.52,.02,MZ[pl.w]);animHands();guns.forEach(function(g,i){g.visible=i===pl.w&&!(i===5&&pl.ghide>0);});sun.position.set(pl.x+14,30,pl.z+10);sun.target.position.set(pl.x,0,pl.z);sun.target.updateMatrixWorld();
  footstepUpdateListener();updSky(dt);R.clear();R.render(S,C);modePreviewDraw(now);if(!pl.dead&&!lob&&!mt.over){R.clearDepth();R.render(VS,VC);}if(botQaEnabled)botQaFrame(qaDeltaMs,performance.now()-qaFrameStart,run&&!lob&&!mt.over);requestAnimationFrame(loop);})(last);
