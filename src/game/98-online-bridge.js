// Authoritative online bridge for the existing single-scope Three.js runtime.
// No browser-local room, unlock, score, objective, bot aim or kill is authoritative.
// The original rendering, UI transitions, map art and viewmodels are preserved.
var onlineApi=typeof PB_ONLINE!=='undefined'?PB_ONLINE:null;
var onlineActive=false,onlineTraining=false,onlineCurrentId=null,onlineMatchId=null;
var onlineServerPhase='CONNECTING',onlineClientSceneReady=false,onlineLoadParticipants={ready:0,total:0};
// Server input/ticks own charge; this state is for 3D first-person pose only.
var onlineGrenadeHolding=false,onlineGrenadeCancelUntilRelease=false,
    onlineGrenadeHoldAt=0,onlineGrenadeServerCharge=null;
function onlineGrenadeCancelPrime(){
 if(!onlineActive)return;
 if(onlineGrenadeHolding){
  onlineGrenadeHolding=false;onlineGrenadeCancelUntilRelease=true;
 }
 pl.thr=0;onlineGrenadeServerCharge=null;
}
function onlineGrenadeHandPose(){
 if(!onlineActive)return;
 var weapon=guns?.[5],pin=weapon?.userData?.grenadePin,lever=weapon?.userData?.grenadeLever;
 if(!pin||!lever)return;
 var phase=onlineGrenadeHolding?
  Math.min(1,Math.max(0,(performance.now()-onlineGrenadeHoldAt)/300)):0;
 pin.position.x=phase*.12;
 pin.rotation.z=-phase*.35;
 lever.rotation.x=phase*.65;
}
function onlineGrenadeChargeUI(){
 var indicator=document.getElementById('grenadeChargeHud');
 if(!indicator)return;
 var show=onlineGrenadeHolding&&pl.w===5&&!pl.dead&&
  onlineGrenadeServerCharge?.maxSeconds>0;
 indicator.hidden=!show;
 if(!show)return;
 var ratio=Math.max(0,Math.min(1,onlineGrenadeServerCharge.seconds/
  onlineGrenadeServerCharge.maxSeconds));
 indicator.querySelector('i').style.width=Math.round(ratio*100)+'%';
 indicator.querySelector('strong').textContent=Math.round(ratio*100)+'%';
}
var onlineWorld=null,onlineGame=null,onlineActors=new Map(),onlineSeq=0,onlineSendAt=0,onlineMeId=null;
var onlineLobbyTimer=0,onlineRoomOpening=false,onlineRoomTimer=0,onlineRouteToken=0,onlineAttaching=false;
var onlineTeamNotice=null,onlineInputId=0,onlineVisualLoaded=false;
var onlineReconnectTimer=0,onlineReconnectStarted=0,onlineReconnecting=false;
var onlineAimInitialized=false,onlineTrainingProgressValue=null,onlinePrevAlive=true;
var onlineSelfTarget=null,onlineLastWinner=undefined,onlineMuzzleTime=0;
var onlinePendingMatchCompleted=null,onlineResultsDisplayed=false;
var onlineResultFallbackTimer=null;
var onlineRewardMatchId=null,onlineRewardTimer=null,onlineRewardChecking=false;
var onlineStallChecking=false,onlineLastStallCheckAt=0;
var onlinePendingKillTick=-1,onlinePendingKillTotal=null;
var onlinePendingWeapon=null,onlinePendingWeaponAt=0,onlineHitMarker=null,onlineHitUntil=0;
var onlineShotTracers=[],onlineSeenGrenadeBlasts=new Set();
var onlineScoreboard=new Map(),onlineSeenKillIds=new Set();
// Public identity metadata only, independent of actor visibility/coordinates.
function onlineCleanCallsign(value,fallback){
 return typeof value==='string'&&/^[A-Za-z0-9_]{1,12}$/.test(value)?value:fallback;
}
function onlinePublicActor(id){
 if(id===onlineUserId())return {name:onlineCleanCallsign(onlineApi?.state().player?.username,'You'),tm:pl.tm,bot:false};
 var member=roomCurrent?.members?.find(m=>m.playerId===id);
 var score=onlineGame?.scoreboard?.find(a=>a.id===id);
 var cached=onlineScoreboard.get(id),model=onlineActors.get(id)?.model;
 var isBot=typeof score?.botName==='string'||(typeof id==='string'&&id.startsWith('BOT-'));
 var name=isBot?onlineCleanCallsign(score?.botName,onlineCleanCallsign(cached?.name,'BOT')):
  onlineCleanCallsign(member?.username,onlineCleanCallsign(cached?.name,onlineCleanCallsign(model?.name,'PLAYER')));
 var team=score?.team===0||score?.team===1?score.team:
  member?.team===0||member?.team===1?member.team:
  cached?.tm===0||cached?.tm===1?cached.tm:0;
 return {name:name,tm:team,bot:isBot};
}
// Local display-only movement, never an authoritative position or damage claim.
var onlinePredSteps=[],onlineCorrection={x:0,y:0,z:0},onlineHasPrediction=false;
var onlineLastAuthTick=-1,onlineLastAck=0,onlineLastAccepted=0;
var onlineFrameSamples=[],onlineSnapshotSamples=[],onlineLastFrameAt=0,onlineLastSnapshotAt=0;
var onlineLastSnapshotTick=-1,onlineLastMetricsAt=0,onlineCorrectionSize=0,onlineRemoteDelay=150;
var onlinePerfEnabled=typeof location!=='undefined'&&new URLSearchParams(location.search).has('pbNetQa');
var onlinePerfPanel=null;
// Counts are sourced from the actual authenticated input send and BE events.
// Diagnostic only; no client-side decisions about hits, damage or ammunition.
var onlineCombatQa={fireInputs:0,confirmedShots:0,confirmedHits:0,wallImpacts:0,damageTaken:0,lastEvent:'NONE'};
function onlineSample(samples,value,limit){
 if(Number.isFinite(value)&&value>=0){samples.push(value);if(samples.length>limit)samples.shift();}
}
function onlineP95(samples){
 if(!samples.length)return 0;
 var ordered=samples.slice().sort(function(a,b){return a-b});
 return ordered[Math.ceil(ordered.length*.95)-1];
}
function onlineMeasureFrame(now){
 if(onlineLastFrameAt&&now-onlineLastFrameAt<1000)
  onlineSample(onlineFrameSamples,now-onlineLastFrameAt,180);
 onlineLastFrameAt=now;
 if(!onlinePerfEnabled||now-onlineLastMetricsAt<1000)return;
 onlineLastMetricsAt=now;
 if(!onlinePerfPanel){
  onlinePerfPanel=document.createElement('pre');
  onlinePerfPanel.id='pointblockNetQa';
  onlinePerfPanel.style.cssText='position:fixed;right:12px;bottom:12px;z-index:999999;pointer-events:none;color:#e4f4ff;background:rgba(4,12,24,.88);border:1px solid #71869b;padding:9px 12px;font:12px/1.6 monospace;white-space:pre;min-width:235px';
  document.body.appendChild(onlinePerfPanel);
 }
 var frame=onlineP95(onlineFrameSamples),snapshot=onlineP95(onlineSnapshotSamples);
 var elapsed=onlineLastSnapshotAt?now-onlineLastSnapshotAt:0;
 onlinePerfPanel.textContent='POINTBLOCK · NETWORK QA (CLIENT)\n'+
  'Frame p95: '+frame.toFixed(1)+' ms · FPS ~'+(frame?Math.round(1000/frame):'—')+'\n'+
  'Snapshot p95: '+snapshot.toFixed(1)+' ms\n'+
  'Last snapshot: '+Math.round(elapsed)+' ms ago\n'+
  'Server tick: '+onlineLastSnapshotTick+' · input ack: '+onlineLastAck+'\n'+
  'Pending frames: '+onlinePredSteps.length+' · correction: '+onlineCorrectionSize.toFixed(2)+'m\n'+
  'FIRE sent: '+onlineCombatQa.fireInputs+' · SHOT confirmed: '+onlineCombatQa.confirmedShots+'\n'+
  'HIT confirmed: '+onlineCombatQa.confirmedHits+' · WALL impact: '+onlineCombatQa.wallImpacts+'\n'+
  'Damage taken: '+onlineCombatQa.damageTaken+' · latest: '+onlineCombatQa.lastEvent;
}
function onlineMeasureSnapshot(world,now){
 if(!world||!Number.isSafeInteger(world.serverTick)||world.serverTick<=onlineLastSnapshotTick)return;
 if(onlineLastSnapshotAt&&now-onlineLastSnapshotAt<2000)
  onlineSample(onlineSnapshotSamples,now-onlineLastSnapshotAt,80);
 onlineLastSnapshotAt=now;onlineLastSnapshotTick=world.serverTick;
 if(onlineSnapshotSamples.length>=3)
  onlineRemoteDelay=Math.min(220,Math.max(115,onlineP95(onlineSnapshotSamples)*1.25));
}
// Read the original offline map's OB colliders. Do not build a second hardcoded
// map: the server is authoritative, while FE prediction uses the same geometry
// that bld()/wl()/map constructors already registered.
function onlinePositionBlocked(x,y,z,radius){
 if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))return true;
 if(Math.abs(x)+radius>A||Math.abs(z)+radius>A)return true;
 for(var i=0;i<OB.length;i++){
  var o=OB[i];
  if(o.fl||y+1.8<=(o.y0||0)||y>=o.h-.05)continue;
  if(Math.abs(x-o.x)<o.hw+radius&&Math.abs(z-o.z)<o.hd+radius)return true;
 }
 return false;
}
// Swept, axis-separated local prediction: same step-size and sliding approach
// as server moveWithCollision(), with FE's existing OB as the geometry source.
function onlineMoveWithCollision(p,vx,vz,dt,radius){
 var distance=Math.hypot(vx*dt,vz*dt),count=Math.max(1,Math.ceil(distance/Math.max(.1,radius*.45)));
 var sx=vx*dt/count,sz=vz*dt/count;
 for(var i=0;i<count;i++){
  if(!onlinePositionBlocked(p.x+sx,p.y,p.z,radius))p.x+=sx;
  if(!onlinePositionBlocked(p.x,p.y,p.z+sz,radius))p.z+=sz;
 }
}
// Smooth correction is cosmetic only, but must obey the original world
// collider. Never drag the camera through walls during reconciliation.
function onlineApplyCollisionCorrection(p,correction,alpha,radius){
 var amount=Math.max(0,Math.min(1,alpha)),dx=correction.x*amount,dz=correction.z*amount;
 var dy=correction.y*amount,plannedY=p.y+dy;
 if(!onlinePositionBlocked(p.x,plannedY,p.z,radius)){p.y=plannedY;correction.y-=dy;}
 else correction.y=0;
 var distance=Math.hypot(dx,dz),count=Math.max(1,Math.ceil(distance/Math.max(.1,radius*.45)));
 var sx=dx/count,sz=dz/count,acceptedX=0,acceptedZ=0;
 for(var i=0;i<count;i++){
  if(!onlinePositionBlocked(p.x+sx,p.y,p.z,radius)){p.x+=sx;acceptedX+=sx;}
  if(!onlinePositionBlocked(p.x,p.y,p.z+sz,radius)){p.z+=sz;acceptedZ+=sz;}
 }
 correction.x-=acceptedX;correction.z-=acceptedZ;
 // A blocked direction must not accumulate endlessly and jitter at a wall.
 if(Math.abs(acceptedX-dx)>.00001)correction.x=0;
 if(Math.abs(acceptedZ-dz)>.00001)correction.z=0;
 // Reuse original gh() also after reconciliation; a server correction must not
 // gradually drag a grounded camera into the walkable foundation.
 var ground=gh(p.x,p.z,p.y);
 if(p.grounded&&p.vy<=0&&p.y<=ground+.001){
  p.y=ground;
  if(correction.y<0)correction.y=0;
 }
}
// Mirrors server-approved speed and local-axis transform; FE geometry is
// visual prediction only and never claims authoritative position or damage.
function onlinePredictStep(position,input,dt){
 if(!(dt>0)||!Number.isFinite(dt))return position;
 var step=Math.min(dt,.05),fw=-input.moveZ,sn=Math.sin(input.yaw),cs=Math.cos(input.yaw);
 var speed=weaponMovementSpeed(input.weaponId,input.sprint&&!input.crouch?1:0,input.ads?1:0);
 onlineMoveWithCollision(position,(fw*sn-input.moveX*cs)*speed,
  (fw*cs+input.moveX*sn)*speed,step,.55);
 // Offline source of truth calls gh() before jump and after gravity.
 var previousY=position.y,ground=gh(position.x,position.z,previousY);
 if(!Number.isFinite(position.vy))position.vy=0;
 if(position.grounded&&position.vy<=0&&position.y<=ground)position.y=ground;
 if(input.jump&&position.grounded&&position.y<=ground+.001){
  position.vy=9;position.grounded=false;
 }
 position.vy-=28*step;position.y+=position.vy*step;
 ground=gh(position.x,position.z,previousY);
 if(position.y<=ground){position.y=ground;position.vy=0;position.grounded=true;}
 else position.grounded=false;
 return position;
}
function onlineReconcileSelf(actor,privateState,fresh){
 if(!fresh)return;
 var ack=privateState?.lastProcessedInputSeq,accepted=privateState?.lastAcceptedInputSeq;
 if(!Number.isSafeInteger(ack)||ack<0)return;
 onlineLastAck=Math.max(onlineLastAck,ack);
 if(Number.isSafeInteger(accepted)&&accepted>=0){
  onlineLastAccepted=Math.max(onlineLastAccepted,accepted);
  onlineSeq=Math.max(onlineSeq,onlineLastAccepted); // 60s rejoin keeps sequence monotonic
 }
 // Only frames not yet simulated by the server are replayable.
 onlinePredSteps=onlinePredSteps.filter(function(step){return step.seq>onlineLastAck});
 if(!onlineHasPrediction||!actor.alive||!onlinePrevAlive){
  pl.x=actor.x;pl.y=actor.y;pl.z=actor.z;
  if(privateState?.grounded===true)pl.y=Math.max(pl.y,gh(pl.x,pl.z,pl.y));
  pl.vy=Number.isFinite(privateState?.velocityY)?privateState.velocityY:0;
  pl.grounded=privateState?.grounded===true;
  onlineCorrection={x:0,y:0,z:0};onlinePredSteps.length=0;
  onlineHasPrediction=!!actor.alive;
  onlineCorrectionSize=0;return;
 }
 var projected={x:actor.x,y:actor.y,z:actor.z,
  vy:Number.isFinite(privateState?.velocityY)?privateState.velocityY:0,
  grounded:privateState?.grounded===true};
 for(var i=0;i<onlinePredSteps.length;i++){
  var frame=onlinePredSteps[i];
  onlinePredictStep(projected,frame,frame.dt);
 }
 var dx=projected.x-pl.x,dy=projected.y-pl.y,dz=projected.z-pl.z,dist=Math.hypot(dx,dy,dz);
 onlineCorrectionSize=dist;
 // Respawn, map mismatch or large server correction: never interpolate through walls.
 if(dist>2.5){
  pl.x=actor.x;pl.y=actor.y;pl.z=actor.z;
  if(privateState?.grounded===true)pl.y=Math.max(pl.y,gh(pl.x,pl.z,pl.y));
  pl.vy=Number.isFinite(privateState?.velocityY)?privateState.velocityY:0;
  pl.grounded=privateState?.grounded===true;
  onlineCorrection={x:0,y:0,z:0};onlinePredSteps.length=0;return;
 }
 // Small timing differences below a centimeter are not worth camera jitter.
 if(dist>.04)onlineCorrection={x:dx,y:dy,z:dz};
}
function onlineInterpolateActor(samples,renderAt){
 if(!samples.length)return null;
 if(samples.length===1||renderAt<=samples[0].t)return samples[0];
 for(var i=1;i<samples.length;i++){
  var b=samples[i],a=samples[i-1];
  if(renderAt>b.t)continue;
  var alpha=Math.max(0,Math.min(1,(renderAt-a.t)/(b.t-a.t||1)));
  return{x:a.x+(b.x-a.x)*alpha,y:a.y+(b.y-a.y)*alpha,z:a.z+(b.z-a.z)*alpha,
   yaw:a.yaw+Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw))*alpha};
 }
 // Never extrapolate enemies past server-authorized snapshots.
 return samples[samples.length-1];
}
// A pending local weapon switch remains visual-only until its authoritative echo.
function onlineWeaponSnapshot(actor,privateState,fresh){
 if(!fresh||!Number.isInteger(actor.weaponId)||actor.weaponId<0||actor.weaponId>=WP.length)return;
 if(onlinePendingWeapon!==null){
  if(actor.weaponId===onlinePendingWeapon)onlinePendingWeapon=null;
  else if(performance.now()-onlinePendingWeaponAt<2000)return;
  else onlinePendingWeapon=null;
 }
 if(pl.w!==actor.weaponId){
  pl.ammo[pl.w]={mag:pl.mag,res:pl.res};pl.w=actor.weaponId;pl.sw=.28;
  pl.slot=actor.weaponId===4?2:actor.weaponId===5?3:actor.weaponId===0?1:0;
 }
 if(Number.isInteger(privateState?.ammo?.magazine))pl.mag=privateState.ammo.magazine;
 if(Number.isInteger(privateState?.ammo?.reserve))pl.res=privateState.ammo.reserve;
 if(Number.isFinite(privateState?.ammo?.reloadRemaining))
  pl.rl=Math.max(0,privateState.ammo.reloadRemaining);
}
function onlineHitConfirm(headshot){
 if(!onlineHitMarker){
  onlineHitMarker=document.createElement('div');
  onlineHitMarker.setAttribute('aria-hidden','true');
  onlineHitMarker.style.cssText='position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:10020;font:700 34px/1 sans-serif;text-shadow:0 0 5px #000,0 0 10px #000;opacity:0';
  onlineHitMarker.textContent='×';document.body.appendChild(onlineHitMarker);
 }
 onlineHitMarker.style.color=headshot?'#ff5656':'#fff';
 onlineHitMarker.style.opacity='1';onlineHitUntil=performance.now()+160;
}
function onlineAnimateRemoteActor(record,sample,dt){
 var bot=record.model,oldX=Number.isFinite(bot.x)?bot.x:sample.x,
     oldZ=Number.isFinite(bot.z)?bot.z:sample.z;
 var moved=Math.min(.5,Math.hypot(sample.x-oldX,sample.z-oldZ)),
     pace=Math.min(1,moved/Math.max(.016,dt)/2.2);
 bot.x=sample.x;bot.y=sample.y;bot.z=sample.z;
 bot.g.position.set(sample.x,sample.y,sample.z);bot.g.rotation.y=sample.yaw;
 bot.wp=(bot.wp||0)+moved*2.4;
 if(bot.legs&&bot.legs.length>=2){
  bot.legs[0].rotation.x=Math.sin(bot.wp)*.8*pace;
  bot.legs[1].rotation.x=-bot.legs[0].rotation.x;
 }
 if(bot.body){
  bot.body.position.y=Math.abs(Math.sin(bot.wp))*.07*pace;
  bot.body.rotation.z=Math.sin(bot.wp)*.05*pace;
  bot.body.rotation.x=-.05*(bot.rc||0);
  bot.body.rotation.y=0; // Reset per-frame hit wobble so repeated hits never twist the model permanently.
 }
 bot.rc=Math.max(0,(bot.rc||0)-dt*6);
 if(bot.arms&&bot.arms.length>=2&&bot.g.userData.gun)aimArms(bot);
 // Offline BOT simulation owns hit wobble; online must update visual damage separately.
 if(bot.fl>0||Math.abs(bot.hx||0)>.001||Math.abs(bot.hv||0)>.001)flash(bot,dt);
}
// Server-owned KILL events may trigger the existing offline blood pool effect
// only for already authorized visible actors. Never reveal an unseen death site.
function onlineConfirmedDeath(event){
 if(!event||typeof event.victimId!=='string')return;
 // The model must have been authorized in a PREVIOUS snapshot. A server kill
 // for an unseen enemy never creates a body or exposes a location.
 var record=onlineActors.get(event.victimId),model=record?.model;
 if(!model||model.dead||!model.g?.visible)return;
 var shooter=event.actorId===onlineUserId()?pl:onlineActors.get(event.actorId)?.model;
 var dx=shooter?model.x-shooter.x:0,dz=shooter?model.z-shooter.z:0;
 // Transfer ownership to the ORIGINAL offline corpse list. The next redacted
 // world snapshot must not destroy the corpse or create a second dead model.
 onlineActors.delete(event.victimId);
 var index=en.indexOf(model);if(index>=0)en.splice(index,1);
 model.dead=true;
 spawnBotDeathVisual(model,dx,dz,0);
}
function onlineReactToImpact(victimId,headshot,ownShot){
 if(typeof victimId!=='string'||!onlineActive)return;
 var model=onlineActors.get(victimId)?.model;
 if(!model||model.dead||!model.g?.visible)return;
 // Reuse the original offline hit recoil and blood, not a second online formula.
 // This intensity is cosmetic only and comes from the existing weapon profile.
 var visualDamage=ownShot?(WP[pl.w]?.dmg||0):0;
 var dx=ownShot?model.x-pl.x:0,dz=ownShot?model.z-pl.z:0;
 botDamageReaction(model,visualDamage,dx,dz,!!headshot,true);
}
function onlineTickEffects(dt){
 // Original offline projectile arc and collision are visual-only online.
 updG(dt);
 for(var g of grs){
  if(!g.serverVisual||g.t<=0)continue;
  g.trailElapsed=(g.trailElapsed||0)+dt;
  if(g.trailElapsed>=.12){
   g.trailElapsed=0;
   if(g.y>gh(g.x,g.z,g.y)+.32)
    smoke(g.x,g.y,g.z,1,.38,.15,.65,.36,.12);
  }
 }
 for(var n=onlineShotTracers.length-1;n>=0;n--){
  var beam=onlineShotTracers[n];beam.t-=dt;
  if(beam.t<=0){S.remove(beam.m);onlineShotTracers.splice(n,1);continue;}
  beam.m.position.x+=beam.vx*dt;beam.m.position.y+=beam.vy*dt;
  beam.m.position.z+=beam.vz*dt;
 }
 updCl(dt);
 // Offline updDead owns exactly one corpse fall, helmet/gun drop, and debris
 // update per frame. Do not duplicate any part of its lifecycle online.
 updDead(dt);
 bloodPoolUpdate(dt);
 // The offline update() is intentionally disabled online. Its short-lived FX
 // must still be simulated and reclaimed, or muzzle flashes accumulate as
 // huge glowing spheres and ejected casings freeze in midair.
 for(var i=mzf.length-1;i>=0;i--){
  var flashFx=mzf[i];flashFx.t-=dt;
  if(flashFx.t<=0){S.remove(flashFx.m);mzf.splice(i,1);}
 }
 for(var j=sk.length-1;j>=0;j--){
  var particle=sk[j];particle.t+=dt;
  particle.m.position.x+=particle.vx*dt;
  particle.m.position.y+=particle.vy*dt;
  particle.m.position.z+=particle.vz*dt;
  particle.vy-=9*dt;
  particle.m.scale.setScalar(Math.max(.001,particle.sz*(1-particle.t/particle.l)));
  if(particle.t>=particle.l){
   S.remove(particle.m);sk.splice(j,1);
   if(particle.blood)bloodActive=Math.max(0,bloodActive-1);
  }
 }
 updSm(dt);
 // Keep original offline impact lifecycle and transient toast expiry.
 for(var i=fx.length-1;i>=0;i--){
  var effect=fx[i];effect.t+=dt*3;
  effect.m.scale.setScalar(.5+effect.t*4);
  effect.m.material.opacity=Math.max(0,.7-effect.t*.7);
  if(effect.t>=1){S.remove(effect.m);fx.splice(i,1);}
 }
 if(toastT>0&&(toastT-=dt)<=0)
  document.getElementById("toast").style.opacity=0;
}
// Server-confirmed bullet marks reuse offline impact, crack, decal and spark assets.
function onlineWallImpact(frame){
 if(![frame.x,frame.y,frame.z,frame.nx,frame.ny,frame.nz].every(Number.isFinite))return;
 var x=frame.x,y=frame.y,z=frame.z,nx=frame.nx,ny=frame.ny,nz=frame.nz;
 if(Math.hypot(nx,ny,nz)<.9)return;
 if(ny>.8&&y<=.2){gDecal(TXH[(Math.random()*TXH.length)|0],x,z,.24);spark(x,y+.035,z,0xd9d0bb,3,1.6,.08);return;}
 var ax=Math.abs(nx)>.8?0:Math.abs(ny)>.8?1:2,sg=ax===0?Math.sign(nx):ax===1?Math.sign(ny):Math.sign(nz);
 var o=obsAt(x-nx*.16,z-nz*.16,y-ny*.16);
 if(o){
  var expected=ax===0?o.x+sg*o.hw:ax===2?o.z+sg*o.hd:o.h;
  var actual=ax===0?x:ax===2?z:y;
  if(Math.abs(expected-actual)<.65){
   impact(o,{x:x,y:y,z:z,ax:ax,sg:sg},{rk:false});return;
  }
 }
 // Backstop for small authoritative-vs-visual geometry differences.
 var mark=new T.Mesh(dcG,TXH[(Math.random()*TXH.length)|0].clone());
 mark.scale.set(.25,.25,1);
 mark.position.set(x+nx*.035,y+ny*.035,z+nz*.035);
 mark.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(nx,ny,nz).normalize());
 mark.rotateZ(Math.random()*Math.PI*2);
 mark.userData.t=DECAY;
 S.add(mark);DC.push(mark);
 if(DC.length>DCMAX){var gone=DC.shift();S.remove(gone);if(gone.userData.t!==undefined)gone.material.dispose();}
 spark(x+nx*.04,y+ny*.04,z+nz*.04,0xd9d0bb,3,1.6,.08);
}
// The original offline loop reduces pl.ghide on every frame. In online,
// update() is deliberately disabled, so this visual timer must tick here.
// It never writes to the server or changes ammo, grenade fuses or damage.
function onlineGrenadePresentationTick(dt){
 if(!Number.isFinite(dt)||dt<0)return;
 pl.ghide=Math.max(0,(Number.isFinite(pl.ghide)?pl.ghide:0)-dt);
}
// A server-confirmed throw uses the ORIGINAL offline grenade mesh and
// updG() arc, bounce and blinking fuse. Geometry is cosmetic only.
function onlineGrenadeThrow(frame){
 if(!onlineActive||frame.weaponId!==5||typeof frame.grenadeId!=='string'||
    frame.grenadeId.length>80)return;
 if(![frame.x,frame.y,frame.z,frame.vx,frame.vy,frame.vz,frame.fuse].every(Number.isFinite)||
    frame.fuse<=0||frame.fuse>5)return;
 if(grs.some(function(g){return g.serverVisual&&g.grenadeId===frame.grenadeId}))return;
 if(grs.filter(function(g){return g.serverVisual}).length>=24)return;
 grs.push({m:mkGren(),serverVisual:true,grenadeId:frame.grenadeId,
  x:frame.x,y:frame.y,z:frame.z,vx:frame.vx,vy:frame.vy,vz:frame.vz,t:frame.fuse});
 if(frame.actorId===onlineUserId()){pl.ghide=.65;onlineGrenadeServerCharge=null;}
}
// Reuse offline explosion particles, scorch and smoke, but absolutely NOT the
// offline boom() damage or kill calculation. The point comes from the BE.
function onlineGrenadeExplosion(frame){
 if(!onlineActive||typeof frame.grenadeId!=='string'||frame.grenadeId.length>80||
    ![frame.x,frame.y,frame.z].every(Number.isFinite)||
    onlineSeenGrenadeBlasts.has(frame.grenadeId))return;
 onlineSeenGrenadeBlasts.add(frame.grenadeId);
 if(onlineSeenGrenadeBlasts.size>128)
  onlineSeenGrenadeBlasts.delete(onlineSeenGrenadeBlasts.values().next().value);
 for(var i=grs.length-1;i>=0;i--){
  var g=grs[i];if(g.serverVisual&&g.grenadeId===frame.grenadeId){
   S.remove(g.m);grs.splice(i,1);break;
  }
 }
 var x=frame.x,y=Math.max(.17,Math.min(1.5,frame.y)),z=frame.z;
 if(y<1.1&&Math.abs(x)<A&&Math.abs(z)<A)
  gDecal(TXS,x,z,3.2+Math.random()*.6);
 var m=new T.Mesh(new T.SphereGeometry(1,14,14),
  new T.MeshBasicMaterial({color:0xffa94d,transparent:true,opacity:.7}));
 m.position.set(x,y,z);S.add(m);fx.push({m:m,t:0});
 spark(x,1,z,0xffa94d,26,9,.28);
 spark(x,1,z,0xfff3bf,10,5,.2);
 smoke(x,y,z,8,3.2,1,2.4,1.2,1);
 smoke(x,.35,z,10,4.5,.9,2.2,.25,0);
 smoke(x,y+.4,z,5,1.2,1.2,3,1.6,1);
 shakeT=Math.max(shakeT,.35);
}
// Cosmetic tracer, sourced only from a server-confirmed shot origin and direction.
// Muzzle origin is computed from the real canonical gun model, not the actor
// center. The backend remains authoritative over trajectory, speed and hits.
function onlineShotMuzzle(frame){
 var z=Number.isInteger(frame.weaponId)?MZ[frame.weaponId]:null;
 if(!Number.isFinite(z))return null;
 if(frame.actorId===onlineUserId()){
  if(pl.dead)return null;
  mflash.position.set(0,.02,z);mflash.updateWorldMatrix(true,false);
  var viewTip=mflash.getWorldPosition(new T.Vector3());
  C.updateWorldMatrix(true,false);
  return viewTip.applyQuaternion(C.quaternion).add(C.position);
 }
 var model=onlineActors.get(frame.actorId)?.model;
 var gun=model?.g?.userData?.rg;
 if(!gun||model.dead||!model.g.visible)return null;
 gun.updateWorldMatrix(true,false);
 return gun.localToWorld(new T.Vector3(0,0,z));
}
function onlineShotTracer(frame,muzzle){
 if(![frame.x,frame.y,frame.z,frame.yaw,frame.pitch].every(Number.isFinite))return;
 if(!Number.isInteger(frame.weaponId)||frame.weaponId<0||frame.weaponId>=WP.length)return;
 var w=WP[frame.weaponId];
 if(w.melee||w.gr)return;
 if(onlineShotTracers.length>=40){var oldest=onlineShotTracers.shift();S.remove(oldest.m);}
 var own=frame.actorId===onlineUserId()?'p':'e',mesh=tracer(own,false);
 // Actual speed is sent with the authorized server shot. It influences only
 // the cosmetic mesh, never client collision or hit registration.
 var angle=frame.yaw,pitch=frame.pitch,
  speed=Number.isFinite(frame.projectileSpeed)&&frame.projectileSpeed>0&&frame.projectileSpeed<=1000?
   frame.projectileSpeed:(w.spd||180),
  duration=Math.min(.15,Math.max(.075,24/speed));
 mesh.rotation.order='YXZ';mesh.rotation.set(-pitch,angle,0);
 if(muzzle&&[muzzle.x,muzzle.y,muzzle.z].every(Number.isFinite))mesh.position.copy(muzzle);
 else mesh.position.set(frame.x,frame.y,frame.z);
 S.add(mesh);
 onlineShotTracers.push({m:mesh,vx:Math.sin(angle)*Math.cos(pitch)*speed,
  vy:Math.sin(pitch)*speed,vz:Math.cos(angle)*Math.cos(pitch)*speed,t:duration});
}
function onlineWarn(error) {
 var code=typeof error==='string'?error:error&&error.code||'BACKEND_UNAVAILABLE';
 roomSetMessage(code);if(typeof roomLiveLog==='function'&&roomCurrent)roomLiveLog(code);
 return code;
}
function onlineAuth() {
 if(!onlineApi||!onlineApi.state().configured){onlineWarn('BACKEND_URL_NOT_CONFIGURED');return false;}
 if(!onlineApi.state().authenticated){onlineWarn('SIWE_LOGIN_REQUIRED — CONNECT WALLET FIRST');return false;}
 return true;
}
function onlineRoomOf(r) {
 if(!r||typeof r.id!=='string'||!['DM','BM'].includes(r.mode))return null;
 var mode=r.mode==='BM'?1:0,goals=r.goals||{};
 return {id:r.id,code:r.code,name:r.name,mode:mode,mapId:r.mapId,ownerId:r.ownerId,
  status:r.status,members:Array.isArray(r.members)?r.members.map(function(m){
    return {playerId:m.playerId,team:m.team,username:m.username,ready:m.ready===true,
      rankIndex:Number.isSafeInteger(m.rankIndex)&&m.rankIndex>=0&&m.rankIndex<17?m.rankIndex:null,
      rank:typeof m.rank==='string'?m.rank.slice(0,48):null};
  }):[],
  kills:goals.kills??50,minutes:goals.minutes??10,
  rounds:goals.maxRounds??12,roundMinutes:goals.roundMinutes??2};
}
function onlineRoomBody(draft) {
 if(!draft||!String(draft.name||'').trim())throw Error('ROOM_NAME_REQUIRED');
 var mode=draft.mode===1?'BM':'DM',common={name:String(draft.name).trim().slice(0,32),mapId:draft.mapId};
 return mode==='DM'?{...common,mode,goalKills:Number(draft.kills),goalMinutes:Number(draft.minutes)}:
  {...common,mode,maxRounds:Number(draft.rounds),roundMinutes:Number(draft.roundMinutes)};
}
function onlineRoomUpdateBody(draft) {
 var {mode,...payload}=onlineRoomBody(draft);
 return payload;
}
function onlineIsMaster(){return !!roomCurrent&&onlineApi?.state().player?.id===roomCurrent.ownerId;}
function onlineOwnMember(){
 return roomCurrent?.members?.find(m=>m.playerId===onlineApi?.state().player?.id)||null;
}
function onlineAdoptRoom(room) {
 var parsed=onlineRoomOf(room);if(!parsed)throw Error('INVALID_ROOM_RESPONSE');
 roomCurrent=parsed;
 var me=onlineOwnMember();if(me){
  roomSide=me.team===1?1:0;
  roomSeat=parsed.members.filter(m=>m.team===roomSide).findIndex(m=>m.playerId===me.playerId);
 }
 if(!roomList.some(r=>r.id===parsed.id))roomList.unshift(parsed);
 else roomList=roomList.map(r=>r.id===parsed.id?parsed:r);
 return parsed;
}
// Projected room number is presentation-only. The original UUID and full
// publicCode remain untouched for authenticated Join and Room Master actions.
// BE publicCode format: PBT-<sequence>-DM/BM.
function onlineRoomDisplayId(code){
 var value=typeof code==='string'?/^PBT-(\d+)-(?:DM|BM)$/.exec(code):null;
 return value?value[1]:'—';
}
function onlineRoomRender(){
 var list=document.getElementById('roomEntries');if(!list)return;
 // Never relabel actual backend rooms as offline local sessions.
 document.getElementById('roomBrowserModeLabel').textContent='MATCH ROOMS · 5V5';
 document.getElementById('roomEmptyTitle').textContent='NO ROOMS AVAILABLE';
 document.getElementById('roomEmptyCopy').textContent='Create a room to start a server-verified match.';
 list.replaceChildren();
 document.getElementById('roomEmpty').hidden=roomList.length>0;
 roomText('roomCount',roomList.length+' ONLINE ROOM'+(roomList.length===1?'':'S'));
 roomList.forEach(function(r){
  var row=document.createElement('div');row.className='room-entry';
  function cell(tag,value,cls){var el=document.createElement(tag);el.textContent=String(value);if(cls)el.className=cls;row.appendChild(el);return el}
  var idCell=cell('span',onlineRoomDisplayId(r.code),'room-id');
  idCell.setAttribute('aria-label','Room ID '+idCell.textContent);
  cell('strong',r.name,'room-name');
  var map=document.createElement('div');map.className='rm-map';
  var title=document.createElement('span'),mode=document.createElement('small');
  title.textContent=(roomMapsForMode(r.mode,r.mapId)||{}).name||'UNKNOWN';
  mode.textContent=r.mode===1?'BOMB MISSION':'DEATHMATCH';
  map.appendChild(title);map.appendChild(mode);row.appendChild(map);
  cell('span',r.members.length+' / 10','room-players');
  cell('span',r.status||'WAITING','rm-status');
  var button=cell('button','JOIN','room-join');button.type='button';
  button.disabled=r.status!=='OPEN';
  button.addEventListener('click',()=>{void onlineSelectRoom(r.id)});
  list.appendChild(row);
 });
}
async function onlineRefreshRooms(){
 if(!onlineAuth())return;
 try {
  var response=await onlineApi.rooms();
  roomList=(response.rooms||[]).map(onlineRoomOf).filter(Boolean);
  if(roomCurrent&&!roomList.some(r=>r.id===roomCurrent.id))roomList.unshift(roomCurrent);
  onlineRoomRender();
 }catch(error){roomList=[];onlineRoomRender();onlineWarn(error)}
}
// This is one PointBlock-styled, accessible dialog for server-verified room
// events. Names enter via textContent only; no unsafe HTML interpolation.
var onlineRoomDialogAccept=null,onlineRoomDialogBlocked=false;
function onlineRoomDialogClose(){
 var root=document.getElementById('roomMultiplayerDialog');
 root.hidden=true;onlineRoomDialogAccept=null;onlineRoomDialogBlocked=false;
}
function onlineRoomDialog(title,message,actionLabel,cancelLabel,onAccept){
 var root=document.getElementById('roomMultiplayerDialog');
 document.getElementById('roomOnlineDialogTitle').textContent=title;
 document.getElementById('roomOnlineDialogBody').textContent=message;
 var ok=document.getElementById('roomOnlineDialogOk'),cancel=document.getElementById('roomOnlineDialogCancel');
 ok.textContent=actionLabel||'OK';cancel.textContent=cancelLabel||'CANCEL';
 cancel.hidden=!onAccept;onlineRoomDialogAccept=onAccept||null;
 root.hidden=false;ok.focus();
}
document.getElementById('roomOnlineDialogOk').addEventListener('click',async function(){
 if(onlineRoomDialogBlocked)return;
 var action=onlineRoomDialogAccept;
 if(!action){onlineRoomDialogClose();return;}
 onlineRoomDialogBlocked=true;this.disabled=true;
 try{await action();onlineRoomDialogClose();}
 catch(error){onlineWarn(error);}
 finally{onlineRoomDialogBlocked=false;this.disabled=false;}
});
document.getElementById('roomOnlineDialogCancel').addEventListener('click',onlineRoomDialogClose);
document.getElementById('roomMultiplayerDialog').addEventListener('click',function(event){
 if(event.target===this&&onlineRoomDialogAccept)onlineRoomDialogClose();
});
document.addEventListener('keydown',function(event){
 if(event.key==='Escape'&&!document.getElementById('roomMultiplayerDialog').hidden){
  event.preventDefault();event.stopImmediatePropagation();
  if(onlineRoomDialogAccept)onlineRoomDialogClose();
 }
},true);
function onlineUnreadyMembers(room){
 return (room?.members||[]).filter(function(m){return m.playerId!==room.ownerId&&!m.ready;});
}
function onlineShowWaitingPlayers(room){
 var waiting=onlineUnreadyMembers(room),names=waiting.map(m=>m.username).join(', ');
 onlineRoomDialog('WAITING FOR PLAYERS READY',
   names?'The following players must press READY before the match can start: '+names:
     'Waiting for all connected players to be ready.',
   'OK',null,null);
}
async function onlineToggleReady(){
 if(!onlineAuth()||!roomCurrent||onlineActive||onlineAttaching)return;
 var player=onlineApi.state().player?.id;
 var room=onlineAdoptRoom(await onlineApi.getRoom(roomCurrent.id));
 if(room.status==='ACTIVE'){await onlineAttachMatch(room);return;}
 if(room.status!=='OPEN')return;
 if(room.ownerId===player){await onlineMasterStart();return;}
 var me=room.members.find(m=>m.playerId===player);if(!me){onlineWarn('ROOM_MEMBERSHIP_REQUIRED');return;}
 try{
  var updated=await onlineApi.setRoomReady(room.id,!me.ready);
  onlineLiveRoomDecorate(onlineAdoptRoom(updated));
 }catch(error){onlineWarn(error)}
}
function onlinePromptKickMember(id,name){
 if(!onlineIsMaster()||roomCurrent?.status!=='OPEN')return;
 var safeName=String(name||'PLAYER').slice(0,12);
 onlineRoomDialog('KICK PLAYER',
  'Kick '+safeName+' from your room? They cannot rejoin this room for 1 minute.',
  'CONFIRM KICK','CANCEL',async function(){
    if(!onlineIsMaster()||roomCurrent?.status!=='OPEN')throw Error('ROOM_MASTER_REQUIRED');
    var update=await onlineApi.kickRoomMember(roomCurrent.id,id);
    onlineLiveRoomDecorate(onlineAdoptRoom(update.room));
  });
}
var onlineLastKickNotice='';
async function onlineShowOwnKick(roomId){
 var data;
 try{data=await onlineApi.roomKickStatus(roomId)}
 catch(error){onlineWarn(error);return}
 if(!data?.kicked)return;
 var key=roomId+':'+data.expiresAt;
 if(key===onlineLastKickNotice)return;
 onlineLastKickNotice=key;
 var name=String(data.byUsername||'ROOM MASTER').slice(0,12);
 onlineRoomDialog('REMOVED FROM ROOM',
  'YOU ALREADY KICKED BY '+name+
    (data.remainingSeconds>0?' · Wait '+data.remainingSeconds+' seconds before joining this room again.':''),
  'OK',null,null);
}
async function onlineHandleMissingMembership(roomId){
 clearInterval(onlineRoomTimer);onlineRoomTimer=0;
 if(roomCurrent?.id!==roomId)return;
 roomCurrent=null;roomList=[];roomEditState(null);
 // Kicked users return to the public Room Browser, not to the HOME page;
 // no LeaveRoom request is sent because membership was already revoked in BE.
 roomLobbyOpen();
 await onlineShowOwnKick(roomId);
}

function onlineRoomTeams(){
 var size=5, me=onlineApi?.state().player?.id,master=onlineIsMaster(),
     roomOpen=roomCurrent?.status==='OPEN';
 for(var side=0;side<2;side++){
  var target=document.getElementById(side===0?'rmlPoliceSlots':'rmlTerrorSlots');
  target.replaceChildren();
  var members=(roomCurrent?.members||[]).filter(m=>m.team===side);
  roomText(side===0?'rmlPoliceCount':'rmlTerrorCount',members.length+' / '+size+' PLAYERS');
  for(var index=0;index<size;index++){
   var member=members[index],mine=member?.playerId===me;
   // Occupied seats are containers, not buttons containing more buttons.
   var row=document.createElement(member?'div':'button');
   if(!member)row.type='button';
   row.className='rml-slot'+(mine?' is-you':'')+(member?.ready?' is-ready':'');
   if(!member)row.setAttribute('aria-pressed','false');
   var num=document.createElement('span');num.className='rml-slot-index';num.textContent=String(index+1);
   var name=document.createElement('span');name.className='rml-slot-name';
   name.textContent=member?(mine?member.username+' (YOU)':member.username):'BOT ON START';
   var hint=document.createElement('em');hint.className='rml-seat-state';
   hint.textContent=member?(member.playerId===roomCurrent.ownerId?'ROOM MASTER':member.ready?'READY':'NOT READY'):'OPEN';
   row.appendChild(num);
   if(member){
    var preview=rankRosterPreview(member.rankIndex),badge;
    if(preview){
     badge=document.createElement('img');badge.src=preview;
     badge.className='rml-rank-3d';badge.draggable=false;
     badge.alt=member.rank?member.rank+' rank insignia':'3D rank insignia';
    }else{
     badge=document.createElement('span');badge.className='rml-rank-3d rml-rank-pending';
     badge.setAttribute('aria-label','Rank insignia unavailable');
    }
    row.appendChild(badge);
   }
   row.appendChild(name);row.appendChild(hint);
   if(member&&master&&!mine&&roomOpen){
    var kick=document.createElement('button');kick.type='button';
    kick.className='rml-kick-player';kick.textContent='KICK';
    kick.setAttribute('aria-label','Kick '+member.username+' from this room');
    (function(id,label){kick.addEventListener('click',function(){
      onlinePromptKickMember(id,label);
    });})(member.playerId,member.username);
    row.appendChild(kick);
   }
   if(!member){(function(team){row.addEventListener('click',()=>{void onlineSwitchTeam(team)})})(side)}
   target.appendChild(row);
  }
 }
}
function onlineLiveRoomDecorate(room) {
 roomLiveOpen(room);
 var me=onlineOwnMember();

 var mine=onlineIsMaster();
 document.getElementById('roomMasterActions').hidden=!mine;
 document.getElementById('roomMasterStatus').hidden=!mine;
 var startControl=document.getElementById('rmlStart');
 startControl.hidden=!me||!['OPEN','ACTIVE'].includes(room.status);
 startControl.disabled=false;
 startControl.textContent=room.status==='ACTIVE'?'REJOIN MATCH':
   mine?'START MATCH':me?.ready?'CANCEL':'READY';
 startControl.classList.toggle('room-ready-action',!mine&&room.status==='OPEN'&&!me?.ready);
 startControl.classList.toggle('room-cancel-action',!mine&&room.status==='OPEN'&&!!me?.ready);
 document.getElementById('roomStart').disabled=!mine;
 // A Room Master still owns an ACTIVE room, but its rules are locked in.
 document.getElementById('rmlSettings').hidden=!mine||room.status!=='OPEN';
 if(me){roomSide=me.team===1?1:0;roomSeat=room.members.filter(m=>m.team===roomSide).findIndex(m=>m.playerId===me.playerId)}
 onlineRoomTeams();
}
async function onlineRecoverMembership() {
 if(!onlineApi?.state().registered)return null;
 var reply=await onlineApi.currentRoom();
 if(!reply?.room){
  roomCurrent=null;
  if(reply?.lastKick?.roomId)void onlineShowOwnKick(reply.lastKick.roomId);
  return null;
 }
 var room=onlineAdoptRoom(reply.room);
 onlineLiveRoomDecorate(room);onlineStartRoomPoll();
 return room;
}
async function onlineSelectRoom(id) {
 if(!onlineAuth()||onlineRoomOpening)return;
 onlineRoomOpening=true;
 try{
  var room=await onlineApi.getRoom(id);
  if(room.status==='OPEN'&&!room.members?.some(m=>m.playerId===onlineApi.state().player?.id)){
   var counts=[0,1].map(t=>room.members.filter(m=>m.team===t).length);
   room=await onlineApi.joinRoom(id,counts[0]<=counts[1]&&counts[0]<5?0:1);
  }
  var current=onlineAdoptRoom(room);onlineLiveRoomDecorate(current);
  roomLiveLog(current.code+' · CONNECTED TO ROOM SERVER');
  onlineStartRoomPoll();
 }catch(error){
  if(error?.code==='ALREADY_IN_ROOM'){
   try{await onlineRecoverMembership();}catch(recovery){onlineWarn(recovery);}
  }else if(error?.code==='ROOM_KICK_COOLDOWN'){
   await onlineShowOwnKick(id);
  }else onlineWarn(error);
 }
 finally{onlineRoomOpening=false}
}
async function onlineCreateRoom(){
 if(!onlineAuth())return;
 var draft=roomFormData();
 if(!draft){onlineWarn('ROOM_NAME_REQUIRED');return}
 try{
  var created=await onlineApi.createRoom(onlineRoomBody(draft));
  roomList=[];roomLog=[];onlineAdoptRoom(created);
  roomBrowserCreateClose();onlineLiveRoomDecorate(roomCurrent);
  roomLiveLog('Server created '+roomCurrent.code);
  onlineStartRoomPoll();
 }catch(error){
  if(error?.code==='ALREADY_IN_ROOM'){
   try{await onlineRecoverMembership();roomBrowserCreateClose();}
   catch(recovery){onlineWarn(recovery);}
  }else if(error?.code==='ROOM_DAILY_CREATE_LIMIT'){
    var reset=typeof error.resetAt==='string'?new Date(error.resetAt):null;
    var resetLabel=reset&&Number.isFinite(reset.getTime())?
      reset.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short',timeZoneName:'short'}):
      'the next official server reset';
    onlineRoomDialog('DAILY ROOM LIMIT REACHED',
      'Your daily limit of '+(error.limit||'10')+' rooms has been reached. Room creation resets at '+
      resetLabel+'.','OK',null,null);
  }else onlineWarn(error);
 }
}
async function onlineSaveRoom(inModal){
 if(!onlineAuth()||!onlineIsMaster()){onlineWarn('ROOM_MASTER_REQUIRED');return false}
 try{
  var draft=inModal&&roomModalDraft?
    {...roomModalDraft,name:document.getElementById('roomModalName').value.trim().slice(0,32)}:roomFormData();
  if(!draft||draft.mode!==roomCurrent.mode)throw Error('ROOM_MODE_IMMUTABLE');
  var updated=await onlineApi.updateRoom(roomCurrent.id,onlineRoomUpdateBody(draft));
  var room=onlineAdoptRoom(updated);
  if(inModal)roomModalHide(false);
  onlineLiveRoomDecorate(room);roomLiveLog('SERVER SETTINGS SAVED');return true;
 }catch(error){onlineWarn(error);if(inModal)roomText('roomModalError',error.code||error.message||'SAVE FAILED');return false;}
}
async function onlineSwitchTeam(team){
 if(!onlineAuth()||!roomCurrent||team===roomSide)return;
 try{await onlineApi.switchTeam(roomCurrent.id,team);
  var room=await onlineApi.getRoom(roomCurrent.id);
  onlineLiveRoomDecorate(onlineAdoptRoom(room));
  roomLiveLog('You joined '+(team?'Terrorist':'Police')+' team');
 }catch(error){onlineWarn(error)}
}
function onlineConfirmLeaveRoom(){
 if(!onlineAuth()||!roomCurrent)return;
 onlineRoomDialog('LEAVE ROOM?',
  onlineIsMaster()?'Are you sure you want to leave? Room Master will pass to the next player. If no one remains, this room will close.':
    'Are you sure you want to leave this room and return to the Room Browser?',
  'YES','NO',onlineLeaveRoom);
}
async function onlineLeaveRoom(){
 if(!onlineAuth()||!roomCurrent)return;
 try{
  if(onlineActive){await onlineApi.abandonRoom(roomCurrent.id);}
  else await onlineApi.leaveRoom(roomCurrent.id);
  onlineResetLive();roomCurrent=null;roomList=[];roomEditState(null);
  roomLobbyOpen();
 }catch(error){onlineWarn(error)}
}
function onlineStartRoomPoll() {
 clearInterval(onlineRoomTimer);
 if(!roomCurrent)return;
 var id=roomCurrent.id;
 onlineRoomTimer=setInterval(async function(){
  if(!roomCurrent||roomCurrent.id!==id||onlineActive||onlineAttaching)return;
  try{
   var next=await onlineApi.getRoom(id);
   if(!next.members?.some(m=>m.playerId===onlineApi.state().player?.id)){
    await onlineHandleMissingMembership(id);return;
   }
   // Keep the rendered Room Master controls synchronized with the DB status.
   // Do this BEFORE connecting: a failed WS handshake must leave REJOIN visible.
   if(!roomCurrent||roomCurrent.id!==id||onlineActive||onlineAttaching)return;
   var normalized=onlineAdoptRoom(next);
   if(next.status==='ACTIVE'){
    if(document.getElementById('lbroomlive').classList.contains('on'))
     onlineLiveRoomDecorate(normalized);
    clearInterval(onlineRoomTimer);
    await onlineAttachMatch(normalized);
   }else if(next.status==='OPEN'&&document.getElementById('lbroomlive').classList.contains('on')){
    onlineLiveRoomDecorate(normalized);
   }
  }catch(error){if(error.status===404){clearInterval(onlineRoomTimer);roomCurrent=null;roomLobbyOpen();}}
 },2300);
}
function onlineResetLive(){
 clearTimeout(onlineResultFallbackTimer);onlineResultFallbackTimer=null;
 onlinePendingMatchCompleted=null;
 onlineCombatQa={fireInputs:0,confirmedShots:0,confirmedHits:0,wallImpacts:0,damageTaken:0,lastEvent:'NONE'};
 onlineActive=false;onlineTraining=false;onlineCurrentId=null;onlineMatchId=null;
 onlineWorld=null;onlineGame=null;
 onlineServerPhase='CONNECTING';onlineClientSceneReady=false;onlineLoadParticipants={ready:0,total:0};
 document.getElementById('dv').classList.remove('online-results');
 pl.kb='';pl.rsT=0;pl.rt=0;pl.dt=0;pl.ghide=0;
 onlineGrenadeHolding=false;onlineGrenadeCancelUntilRelease=false;
 onlineGrenadeServerCharge=null;onlineGrenadeChargeUI();
 if(pl.bloodPool){bloodPoolRemove(pl.bloodPool);pl.bloodPool=null;}
 document.body.classList.remove('dead','bomb-spectator');
 for(const item of onlineActors.values()){if(item.model?.g)S.remove(item.model.g)}
 onlineActors.clear();onlineMeId=null;onlineSeq=0;onlineSendAt=0;onlineVisualLoaded=false;
 onlinePredSteps.length=0;onlineCorrection={x:0,y:0,z:0};onlineHasPrediction=false;
 onlineLastAuthTick=-1;onlineLastAck=0;onlineLastAccepted=0;
 onlineLastFrameAt=0;onlineLastSnapshotAt=0;onlineLastSnapshotTick=-1;onlineRemoteDelay=150;
 onlineFrameSamples.length=0;onlineSnapshotSamples.length=0;onlineCorrectionSize=0;
 if(onlinePerfPanel){onlinePerfPanel.remove();onlinePerfPanel=null;}
 onlineAimInitialized=false;onlineTrainingProgressValue=null;onlinePrevAlive=true;
 onlineSelfTarget=null;onlineLastWinner=undefined;onlineMuzzleTime=0;onlineScoreboard.clear();onlineSeenKillIds.clear();
 onlinePendingKillTick=-1;onlinePendingKillTotal=null;onlineLastStallCheckAt=0;
 onlinePendingWeapon=null;onlinePendingWeaponAt=0;onlineHitUntil=0;
 if(onlineHitMarker){onlineHitMarker.remove();onlineHitMarker=null;}
 for(const fx of mzf)S.remove(fx.m);mzf.length=0;
 for(const particle of sk)S.remove(particle.m);sk.length=0;bloodActive=0;
 for(const dropped of dg)S.remove(dropped.m);dg.length=0;
 for(const corpse of dead){if(corpse.bloodPool)bloodPoolRemove(corpse.bloodPool);S.remove(corpse.g);}dead.length=0;
 for(const helmet of hlms)S.remove(helmet.m);hlms.length=0;
 for(const tracer of onlineShotTracers)S.remove(tracer.m);onlineShotTracers.length=0;
 for(const grenade of grs)if(grenade.serverVisual)S.remove(grenade.m);
 for(var gi=grs.length-1;gi>=0;gi--)if(grs[gi].serverVisual)grs.splice(gi,1);
 onlineSeenGrenadeBlasts.clear();
 for(const mark of DC){S.remove(mark);if(mark.userData.t!==undefined)mark.material.dispose()}DC.length=0;
 for(const chunk of CH)S.remove(chunk.m);CH.length=0;
 clrFD();clrSm();bloodPoolClear();
 onlineApi?.closeLive();clearInterval(onlineRoomTimer);clearTimeout(onlineReconnectTimer);
 onlineReconnecting=false;onlineReconnectStarted=0;
}
async function onlineAttachMatch(room){
 // Poll and Room Master clicks can both observe ACTIVE during the WS handshake.
 // Only one connection may consume a one-use realtime ticket at a time.
 if(!onlineAuth()||onlineActive||onlineAttaching)return false;
 onlineAttaching=true;
 try{
  // Room data is normalized once by onlineAdoptRoom (DM/BM -> 0/1).
  // Every caller here can pass that already-normalized room. Re-running
  // onlineRoomOf() on mode=0/1 would incorrectly throw INVALID_ROOM_RESPONSE
  // after the backend has successfully started the authoritative match.
  var current=room&&(room.mode===0||room.mode===1)&&typeof room.id==='string'&&
    Array.isArray(room.members)?room:onlineAdoptRoom(room);
  if(onlineIsMaster())document.getElementById('rmlStart').textContent='CONNECTING TO MATCH...';
  await onlineApi.openLive('room',current.id,onlineReceiveFrame,onlineSocketStatus);
  onlineCurrentId=current.id;onlineTraining=false;onlineActive=true;onlineVisualLoaded=false;
  clearInterval(onlineRoomTimer);
  onlineBeginTransition(current);
  return true;
 }catch(error){
  onlineResetLive();
  var code=onlineWarn(error);
  // Match stays ACTIVE on the server. Surface the actual connection failure
  // instead of leaving a misleading START MATCH button with no visible feedback.
  roomText('rmlBotSummary','MATCH CONNECTION FAILED · '+code);
  if(roomCurrent?.status==='ACTIVE'&&onlineIsMaster())
   document.getElementById('rmlStart').textContent='RETRY MATCH CONNECTION';
  return false;
 }finally{onlineAttaching=false}
}
async function onlineMasterStart(){
 if(!onlineAuth()||!onlineIsMaster()){onlineWarn('ROOM_MASTER_REQUIRED');return}
 if(onlineActive||onlineAttaching)return;
 var startControl=document.getElementById('rmlStart');
 startControl.disabled=true;
 try{
  // A click can race with a previous START response or a backend reconnect.
  // Ask the server: only the signed-in Player's immutable ownerId grants master rights.
  var playerId=onlineApi.state().player?.id;
  var authoritative=await onlineApi.getRoom(roomCurrent.id);
  if(authoritative.ownerId!==playerId){onlineWarn('ROOM_MASTER_REQUIRED');return}
  // Never trust the local button's stale status: read and render server truth.
  onlineLiveRoomDecorate(onlineAdoptRoom(authoritative));
  if(authoritative.status==='ACTIVE'){
   await onlineAttachMatch(roomCurrent);return;
  }
  if(authoritative.status!=='OPEN'){onlineWarn('ROOM_NOT_WAITING');return}
  onlineAdoptRoom(authoritative);
  if(onlineUnreadyMembers(authoritative).length){onlineShowWaitingPlayers(authoritative);return;}
  if(!await onlineSaveRoom(false)){
   // A concurrent start may have activated this room after the status check.
   var afterSave=await onlineApi.getRoom(authoritative.id);
   if(afterSave.ownerId===playerId&&afterSave.status==='ACTIVE'){
    onlineLiveRoomDecorate(onlineAdoptRoom(afterSave));
    await onlineAttachMatch(roomCurrent);
   }
   return;
  }
  try{
   var started=await onlineApi.startRoom(authoritative.id);
   if(started.status!=='ACTIVE'||typeof started.matchId!=='string')
    throw Error('INVALID_MATCH_START_RESPONSE');
   onlineMatchId=started.matchId;
   // The backend confirmed ACTIVE. Update the button before WS connects,
   // preserving the owner's ability to retry without a duplicate match.
   roomCurrent={...roomCurrent,status:'ACTIVE'};
   onlineLiveRoomDecorate(roomCurrent);
   await onlineAttachMatch(roomCurrent);
  }catch(error){
   if(error?.code==='ROOM_PLAYERS_NOT_READY'||error?.code==='ROOM_NOT_READY'){
    var next=await onlineApi.getRoom(authoritative.id);
    onlineLiveRoomDecorate(onlineAdoptRoom(next));
    onlineShowWaitingPlayers(next);return;
   }
   if(error?.code!=='ROOM_ALREADY_ACTIVE')throw error;
   var activeRoom=await onlineApi.getRoom(authoritative.id);
   if(activeRoom.ownerId!==playerId||activeRoom.status!=='ACTIVE')throw error;
   onlineLiveRoomDecorate(onlineAdoptRoom(activeRoom));
   await onlineAttachMatch(roomCurrent);
  }
 }catch(error){onlineWarn(error)}
 finally{startControl.disabled=false}
}
function onlineMatchLoadingStatus(frame){
 if(!onlineActive||!frame||frame.matchId!==onlineMatchId)return;
 if(!['CONNECTING','COUNTDOWN','LIVE'].includes(frame.phase))return;
 onlineServerPhase=frame.phase;
 onlineLoadParticipants={ready:Number.isSafeInteger(frame.ready)?frame.ready:0,
  total:Number.isSafeInteger(frame.total)?frame.total:0};
 var flow=roomStartFlow;
 if(!flow.active||flow.phase!=='server-wait')return;
 var total=Math.max(1,onlineLoadParticipants.total),ready=Math.min(total,onlineLoadParticipants.ready);
 if(frame.phase==='CONNECTING')roomStartMark(65+Math.floor(28*ready/total),
  'CONNECTING TO SERVER · '+ready+'/'+total+' PLAYERS READY');
 else if(frame.phase==='COUNTDOWN')roomStartMark(96,'ALL PLAYERS CONNECTED · MATCH STARTING');
 else onlineCompleteServerLoading(flow.token);
}
function onlineCompleteServerLoading(token){
 var flow=roomStartFlow;
 if(!onlineActive||!flow.active||flow.token!==token||flow.phase!=='server-wait'||
    !onlineClientSceneReady||onlineServerPhase!=='LIVE')return;
 flow.phase='preparing';
 flow.loadoutSeconds=0; // No second loadout lock after the server GO signal.
 roomStartMark(100,'DEPLOYMENT COMPLETE');
 roomStartReveal(token);
}
function onlineBeginTransition(room){
 onlineResultsDisplayed=false;
 var flow=roomStartFlow;
 roomMatchConfig={...room};
 selectedTdmMapId=tdmMapId(room.mapId);selectedBombMapId=bombMapId(room.mapId);
 selM=room.mode;selectedGameMode=room.mode;
 modePreviewSelect(selM);
 if(flow.active)roomStartAbort();
 flow.active=true;flow.phase='loading';flow.token++;
 flow.team=roomSide;flow.config={...room};flow.mapReady=false;flow.loadoutSeconds=0;
 onlineClientSceneReady=false;
 document.getElementById('roomPrestart').hidden=true;
 // Only server states advance beyond map/renderer initialization.
 roomStartLoading(flow.token);
}
function onlineUserId(){
 return onlineTraining?onlineMeId:onlineApi?.state().player?.id;
}
// Use server-owned K/D and streak to drive the ORIGINAL offline cosmetic HUD.
function onlineRestoreKillStars(kills){
 starsReset();
 // Use the same original starKill renderer, but skip past celebrations.
 for(var i=0;i<Math.min(8,kills);i++)starKill(true);
 stnEl.textContent=kills?'\u00d7'+kills:'';
}
function onlineSyncKillDisplay(kills,animate){
 if(!Number.isSafeInteger(kills)||kills<0)return;
 var previous=score,target=Math.min(8,kills);
 if(animate&&kills===previous+1){
  if(starsEl.querySelectorAll('.st').length!==Math.min(8,previous))
   onlineRestoreKillStars(previous);
  score=kills;starKill();return;
 }
 score=kills;
 if(starsEl.querySelectorAll('.st').length!==target||
    stnEl.textContent!==(kills?'\u00d7'+kills:''))
  onlineRestoreKillStars(kills);
}
function onlineApplyVerifiedKill(event){
 if(!event||typeof event.id!=='string'||onlineSeenKillIds.has(event.id))return;
 onlineSeenKillIds.add(event.id);
 if(onlineSeenKillIds.size>128)onlineSeenKillIds.delete(onlineSeenKillIds.values().next().value);
 if(!onlineActive||!run||lob||event.actorId!==onlineUserId()||!pl.st||
    (Number.isSafeInteger(event.tick)&&event.tick<=onlineLastAuthTick))return;
 // No derived +1 or client damage calculation: the BE supplies actual total.
 if(!Number.isSafeInteger(event.kills)||event.kills<0)return;
 if(event.kills>=score){
  onlineSyncKillDisplay(event.kills,event.kills===score+1);
  pl.st.k=event.kills;
 }
 if(Number.isSafeInteger(event.tick)&&event.tick>=onlinePendingKillTick){
  onlinePendingKillTick=event.tick;
  onlinePendingKillTotal=Math.max(onlinePendingKillTotal??0,event.kills);
 }
 if(Number.isSafeInteger(event.streak)&&event.streak>=0){
  if(event.streak===1)ck.hs=0;
  ck.n=event.streak;
 }
 if(event.headshot)ck.hs++;
 // The canonical offline boom() emits one grouped notification per explosion.
 if(event.explosive)return;
 hsF=!!event.headshot;
 try{killNotify(false)}finally{hsF=false;}
}
function onlineApplyVerifiedExplosion(event){
 if(!event||typeof event.id!=='string'||onlineSeenKillIds.has(event.id)||
    !onlineActive||!run||lob||event.actorId!==onlineUserId()||
    !Number.isSafeInteger(event.count)||event.count<=0||
    (Number.isSafeInteger(event.tick)&&event.tick<=onlineLastAuthTick))return;
 onlineSeenKillIds.add(event.id);
 if(onlineSeenKillIds.size>128)onlineSeenKillIds.delete(onlineSeenKillIds.values().next().value);
 if(Number.isSafeInteger(event.streak)&&event.streak>=0)ck.n=event.streak;
 boomN=event.count;
 if(Number.isInteger(event.weaponId)&&WP[event.weaponId])
  boomLab=WP[event.weaponId].n.toUpperCase();
 hsF=false;killNotify(boomN>2);
}
// Public scoreboard identity is attached to each real server row before the
// existing Results overlay is rendered. No random/client-generated BOT names.
function onlineScoreIdentity(entry,row){
 var identity=onlinePublicActor(row.id),me=row.id===onlineUserId();
 var own=onlineApi?.state().player;
 var member=roomCurrent?.members?.find(m=>m.playerId===row.id);
 var rank=identity.bot?0:me?own?.rankIndex:member?.rankIndex;
 entry.id=row.id;
 entry.name=identity.name;entry.bot=identity.bot;
 entry.rankIndex=Number.isSafeInteger(rank)&&rank>=0&&rank<17?rank:null;
 return entry;
}
// Match settlement is BE-owned. The ORIGINAL offline report is the renderer.
function onlineAdoptFinalScore(game){
 if(!game||game.status!=='COMPLETED'||!Array.isArray(game.scoreboard))return false;
 var me=onlineUserId(),points=isBombMode()?game.rounds:game.teamKills,team=pl.tm;
 if(!Array.isArray(points)||points.length!==2)return false;
 var rows=[];
 game.scoreboard.forEach(function(row){
  if(!row||typeof row.id!=='string'||!Number.isSafeInteger(row.kills)||
     !Number.isSafeInteger(row.deaths))return;
  var entry=row.id===me?pl.st:onlineScoreboard.get(row.id);
  if(!entry)entry={name:'PLAYER',tm:row.team,k:0,d:0};
  onlineScoreIdentity(entry,row);
  entry.tm=row.team;entry.k=row.kills;entry.d=row.deaths;
  if(row.id===me)team=row.team;
  rows.push(entry);
 });
 if(!pl.st||!rows.includes(pl.st))return false;
 ROS=rows;pl.tm=team;ts[0]=points[0];ts[1]=points[1];
 onlineSyncKillDisplay(pl.st.k,false);
 return true;
}
// Results use the ORIGINAL offline Battle Report. Only the two numbers below
// come from a persisted settlement, never a client-side award calculation.
// Online Results use DOM/textContent instead of HTML interpolation; untrusted
// player names never enter the innerHTML-based legacy offline scoreboard.
function onlineRenderResultScoreboard(rows,selfStat){
 var host=document.getElementById('sbd');if(!host)return;
 host.replaceChildren();
 var ordered=rows.slice().sort(function(a,b){return b.k-a.k||a.d-b.d});
 ordered.forEach(function(entry,index){
  var row=document.createElement('div');
  row.className='sbr online-result-row'+(entry===selfStat?' me':'');
  row.style.setProperty('--c',entry.tm?'#ff8a65':'#4dabf7');
  var place=document.createElement('span');place.className='result-place';
  place.textContent=String(index+1)+'.';
  row.appendChild(place);
  var rank=document.createElement('span');rank.className='result-rank';
  var indexRank=entry.bot?0:entry.rankIndex;
  var preview=Number.isSafeInteger(indexRank)&&typeof rankRosterPreview==='function'?
   rankRosterPreview(indexRank):null;
  if(preview){
   var image=document.createElement('img');image.src=preview;
   image.alt=entry.bot?'Trainee skull rank':'Player rank insignia';
   image.draggable=false;rank.appendChild(image);
  }else rank.textContent=entry.bot?'TRAINEE':'—';
  row.appendChild(rank);
  var identity=document.createElement('span');identity.className='result-identity';
  var label=document.createElement('strong');label.textContent=
   entry.bot?'BOT '+onlineCleanCallsign(entry.name,'BOT').toUpperCase():onlineCleanCallsign(entry.name,'PLAYER');
  identity.appendChild(label);
  var tag=document.createElement('small');
  tag.textContent=entry===selfStat?'(YOU)':entry.bot?'(BOT)':'';
  if(tag.textContent)identity.appendChild(tag);
  row.appendChild(identity);
  var kills=document.createElement('b');kills.textContent=String(entry.k);
  var deaths=document.createElement('b');deaths.textContent=String(entry.d);
  row.append(kills,deaths);host.appendChild(row);
 });
}
function onlineRewardVisible(matchId){
 return onlineResultsDisplayed&&onlineRewardMatchId===matchId&&
  document.getElementById('dv').classList.contains('show');
}
function onlineRewardStop(){
 clearTimeout(onlineRewardTimer);onlineRewardTimer=null;
 onlineRewardMatchId=null;onlineRewardChecking=false;
}
function onlineCheckVerifiedReward(matchId,attempt){
 if(!onlineRewardVisible(matchId)||onlineRewardChecking||!onlineApi?.state().authenticated)return;
 onlineRewardChecking=true;
 var flag=document.getElementById('verifiedRewardFlag'),
  status=document.getElementById('verifiedRewardStatus'),
  retry=document.getElementById('verifiedRewardRetry');
 flag.textContent='CALCULATING';retry.hidden=true;
 void onlineApi.award(matchId).then(function(value){
  if(!onlineRewardVisible(matchId))return;
  // Backend balances and rewards are serialized nonnegative half units.
  var exp=homeFormatHalf(value?.awardedExpHalf),vpbt=homeFormatHalf(value?.awardedVpbtHalf);
  if(exp==='—'||vpbt==='—'||value.matchId!==matchId)
   throw Error('INVALID_MATCH_SETTLEMENT_RESPONSE');
  document.getElementById('verifiedExpAmount').textContent='+'+exp;
  document.getElementById('verifiedVpbtAmount').textContent='+'+vpbt;
  flag.textContent='AWARDED';
  status.textContent='Rewards added to your account';
  retry.hidden=true;
  // Read after settlement so the vPBT header and player rank meter reflect
  // actual persisted progress, rather than an optimistic local increment.
  void onlineApi.refreshProfile().then(function(state){
   if(onlineRewardVisible(matchId)&&state?.authenticated&&state.registered){
    resultsVerifiedRank(state.player);
    // The rank badge beside YOU must also reflect any rank-up just earned.
    if(pl.st&&Number.isSafeInteger(state.player.rankIndex)){
     pl.st.rankIndex=state.player.rankIndex;
     onlineRenderResultScoreboard(ROS,pl.st);
    }
   }
  }).catch(function(error){
   if(onlineRewardVisible(matchId))status.textContent='Rewards added. Updating your rank…';
  });
 }).catch(function(error){
  if(!onlineRewardVisible(matchId))return;
  if(error?.code==='MATCH_REWARD_NOT_FOUND'&&attempt<8){
   flag.textContent='PENDING';
   status.textContent='Preparing your match rewards…';
   onlineRewardTimer=setTimeout(function(){onlineCheckVerifiedReward(matchId,attempt+1);},1250);
   return;
  }
  flag.textContent='PENDING';
  status.textContent='Rewards are taking longer than expected. Select RECHECK to try again.';
  retry.hidden=false;
 }).finally(function(){onlineRewardChecking=false;});
}
function onlineShowVerifiedReward(matchId){
 var section=document.getElementById('verifiedReward');
 if(!section)return;
 onlineRewardStop();
 onlineRewardMatchId=matchId;
 section.hidden=false;
 document.getElementById('verifiedExpAmount').textContent='—';
 document.getElementById('verifiedVpbtAmount').textContent='—';
 document.getElementById('verifiedRewardStatus').textContent='Calculating your match rewards…';
 document.getElementById('verifiedRewardFlag').textContent='CALCULATING';
 document.getElementById('verifiedRewardRetry').hidden=true;
 onlineCheckVerifiedReward(matchId,0);
}
function onlineFinalizeCompletedMatch(frame){
 if(!onlineActive||onlineTraining||!frame||frame.matchId!==onlineMatchId||
    !onlineAdoptFinalScore(frame.game))return;
 var matchId=frame.matchId;
 onlineResetLive();
 if(roomCurrent)roomCurrent={...roomCurrent,status:'OPEN'};
 onlineResultsDisplayed=true;
 document.getElementById('dv').classList.add('online-results');
 endMatch(); // ORIGINAL offline Victory/Defeat, stats, rank, best score and scoreboard.
 // Results are not a rematch controller: one EXIT GAME returns to this
 // same registered room, preserving the BE membership and room owner.
 document.getElementById('dgo').textContent='EXIT GAME';
 document.getElementById('dmn').hidden=true;
 onlineShowVerifiedReward(matchId);
}
function onlineReceiveFrame(frame){
 if(frame.type==='match_loading'){
  onlineMatchLoadingStatus(frame);return;
 }
 if(frame.type==='match_live'){
  onlineMatchLoadingStatus({...frame,phase:'LIVE'});return;
 }
 if(frame.type==='lobby_snapshot'){
  if(roomCurrent&&frame.roomId===roomCurrent.id)void onlineApi.getRoom(roomCurrent.id)
   .then(r=>onlineLiveRoomDecorate(onlineAdoptRoom(r))).catch(onlineWarn);
  return;
 }
 if(frame.type==='match_ready'||frame.type==='training_ready'||
    frame.type==='match_snapshot'||frame.type==='training_snapshot'){
  // Rejoined masters recover the same matchId from the authoritative WS handshake.
  if(frame.type==='match_ready'&&typeof frame.matchId==='string'){
   onlineMatchId=frame.matchId;
   if(frame.loading?.phase)onlineServerPhase=frame.loading.phase;
  }
  if(frame.world&&Number.isSafeInteger(frame.world.serverTick)){
   // Drop out-of-order authoritative world snapshots. Snapshot telemetry is opt-in.
   if(onlineWorld&&frame.world.matchId===onlineWorld.matchId&&
      frame.world.serverTick<onlineWorld.serverTick)return;
   var metricsNow=performance.now();
   onlineMeasureSnapshot(frame.world,metricsNow);
   if(frame.type==='match_ready'||frame.type==='training_ready'){
    onlinePredSteps.length=0;onlineHasPrediction=false;onlineLastAuthTick=-1;
    var joinedSeq=frame.world.privateState?.lastAcceptedInputSeq;
    if(Number.isSafeInteger(joinedSeq))onlineSeq=Math.max(onlineSeq,joinedSeq);
   }
   onlineWorld=frame.world;onlineGame=frame.game;
   if(!onlineMeId){onlineMeId=onlineTraining?
     frame.world.actors.find(a=>!a.bot)?.id:onlineApi?.state().player?.id;}
   if(onlineActive&&run&&!lob)onlineApplyWorld();
  }
  if(frame.progress)onlineTrainingProgress(frame.progress);
  return;
 }
 if(frame.type==='combat_wall_hit'){
  if(onlineActive&&frame.actorId===onlineUserId()){
   onlineCombatQa.wallImpacts++;
   onlineCombatQa.lastEvent='WALL_HIT';
  }
  if(onlineActive)onlineWallImpact(frame);
  return;
 }
 if(frame.type==='combat_hit'){
  if(onlineActive){
   onlineCombatQa.confirmedHits++;
   onlineCombatQa.lastEvent='HIT';
   onlineHitConfirm(!!frame.headshot);
   onlineReactToImpact(frame.victimId,!!frame.headshot,true);
  }
  return;
 }
 if(frame.type==='combat_impact'){
  onlineReactToImpact(frame.victimId,!!frame.headshot,false);
  return;
 }
 if(frame.type==='combat_hurt'){
  if(onlineActive){
   onlineCombatQa.damageTaken++;
   var hit=document.getElementById('hit');
   if(hit)hit.style.opacity='1';
   cs.s=Math.max(cs.s,.45);
  }
  return;
 }
 if(frame.type==='combat_grenade_explosion'){
  onlineGrenadeExplosion(frame);return;
 }
 if(frame.type==='combat_shot'){
  if(!onlineActive)return;
  if(frame.actorId===onlineUserId()){
   onlineCombatQa.confirmedShots++;
   onlineCombatQa.lastEvent='SHOT';
  }
  if(frame.weaponId===5){
   onlineGrenadeThrow(frame);return;
  }
  if(frame.actorId===onlineUserId()){
   onlineShotTracer(frame,onlineShotMuzzle(frame));return;
  }
  var remote=onlineActors.get(frame.actorId);
  if(remote&&remote.model&&!remote.model.dead){
   var bot=remote.model;bot.rc=1;
   if(Number.isInteger(frame.weaponId)&&frame.weaponId>=0&&frame.weaponId<WP.length){
    botVisualWeapon(bot,frame.weaponId);bot.weapon=frame.weaponId;
   }
   if(bot.weapon!==4&&bot.weapon!==5){
    var muzzle=onlineShotMuzzle(frame);
    if(muzzle)enemyShotFx(bot,muzzle.x,muzzle.y,muzzle.z);
   }
  }
  onlineShotTracer(frame,onlineShotMuzzle(frame));
  return;
 }
 if(frame.type==='match_event'){
  var event=frame.event;
  if(event?.kind==='MATCH_END')onlineLastWinner=event.winner;
  if(event?.kind==='EXPLOSION_RESULT')onlineApplyVerifiedExplosion(event);
  if(event?.kind==='KILL'&&onlineActive){
   // Both names are public match-roster identities. Never depend on the
   // transient 3D actor mesh, which may already be redacted by fog-of-war.
   var actor=onlinePublicActor(event.actorId),victim=onlinePublicActor(event.victimId);
   var killer=event.actorId===onlineUserId()?pl:actor;
   var target=event.victimId===onlineUserId()?pl:victim;
   kFeed(killer,Number.isInteger(event.weaponId)?event.weaponId:1,!!event.headshot,target);
   if(event.victimId===onlineUserId())pl.kb=actor.name;
   onlineConfirmedDeath(event);
   onlineApplyVerifiedKill(event);
   roomLiveLog(actor.name+' ELIMINATED '+victim.name);
  }
  return;
 }
 if(frame.type==='match_failed'){
  if(!onlineActive)return;
  onlineResetLive();matchExitToLobby('room');onlineWarn(frame.code||'SERVER_MATCH_FAILURE');return;
 }
 if(frame.type==='match_completed'){
  if(!onlineActive)return;
  if(dead.length>0){
   // Prefer the original offline corpse animation. It must NEVER hold the
   // verified result hostage if the 3-D loop stalls or a model is retained.
   onlinePendingMatchCompleted=frame;
   clearTimeout(onlineResultFallbackTimer);
   onlineResultFallbackTimer=setTimeout(function(){
    if(!onlineActive||onlinePendingMatchCompleted?.matchId!==frame.matchId)return;
    var completed=onlinePendingMatchCompleted;onlinePendingMatchCompleted=null;
    onlineFinalizeCompletedMatch(completed);
   },2200);
  }else onlineFinalizeCompletedMatch(frame);
  return;
 }
 if(frame.type==='training_result'){
  onlineTrainingProgress(frame.progress);
  if(frame.progress?.status==='COMPLETED'){void onlineTrainingFinished(frame.progress);return;}
  if(frame.progress?.status==='TIMEOUT_POLICY_PENDING'){
   void onlineTrainingFinished(frame.progress);
  }
 }
}
function onlineSocketStatus(info){
 if(info.code===1000||!onlineActive||onlineReconnecting)return;
 // Server retains the player for 60 seconds. Never fall back to client hit simulation.
 onlineReconnecting=true;onlineReconnectStarted=Date.now();run=false;
 onlineWarn('RECONNECTING TO MATCH SERVER');
 onlineReconnectTimer=setTimeout(onlineRetry,1000);
}
async function onlineRetry(){
 if(!onlineReconnecting||!onlineActive)return;
 if(Date.now()-onlineReconnectStarted>55000){
  onlineResetLive();matchExitToLobby('list');onlineWarn('RECONNECT_WINDOW_EXPIRED');return;
 }
 try{
  var kind=onlineTraining?'training':'room';
  await onlineApi.openLive(kind,onlineTraining?null:onlineCurrentId,onlineReceiveFrame,onlineSocketStatus);
  onlineReconnecting=false;clearTimeout(onlineReconnectTimer);
  run=true;mt.over=false;onlineApplyWorld();
 }catch(error){
  if(!onlineReconnecting)return;
  onlineReconnectTimer=setTimeout(onlineRetry,2500);
 }
}
function onlineTrainingProgress(progress){
 if(!progress)return;
 onlineTrainingProgressValue=progress;
 var text='TRAINING '+progress.combinedKills+' / '+progress.targetKills;
 var element=document.getElementById('rsp');
 if(element&&onlineTraining)element.textContent=text;
}
function onlineDialog(title,description,action,submit) {
 var existing=document.getElementById('pointblockOnlineDialog');if(existing)existing.remove();
 var overlay=document.createElement('div');overlay.id='pointblockOnlineDialog';overlay.className='point-online-dialog';
 var form=document.createElement('form');form.className='point-online-dialog-panel';
 var h=document.createElement('h2');h.textContent=title;
 var p=document.createElement('p');p.textContent=description;
 var input=document.createElement('input');input.required=true;input.maxLength=12;input.minLength=1;
 input.pattern='[A-Za-z0-9_]+';input.placeholder='USERNAME';input.autocomplete='off';
 var error=document.createElement('div');error.setAttribute('role','status');
 var button=document.createElement('button');button.type='submit';button.textContent=action;
 form.append(h,p,input,error,button);overlay.append(form);document.body.append(overlay);
 form.addEventListener('submit',async e=>{
  e.preventDefault();button.disabled=true;error.textContent='';
  try{await submit(input.value);overlay.remove()}catch(err){error.textContent=err.code||err.message||'REQUEST FAILED'}
  finally{button.disabled=false}
 });
 input.focus();
}
// The Training Result is a proper result screen, not a fabricated match award.
// Numbers and terminal state come from the authenticated training_result event.
var onlineTrainingResultStatus=null;
function onlineDisplayTrainingResult(progress){
 if(!progress||!['COMPLETED','TIMEOUT_POLICY_PENDING'].includes(progress.status))return;
 onlineTrainingResultStatus=progress.status;
 var won=progress.status==='COMPLETED';
 var kills=Number.isSafeInteger(progress.combinedKills)?progress.combinedKills:null;
 var target=Number.isSafeInteger(progress.targetKills)?progress.targetKills:null;
 document.getElementById('trainingResultTitle').textContent=won?'TRAINING COMPLETE':'TRAINING INCOMPLETE';
 document.getElementById('trainingResultDescription').textContent=won?
  'Training complete! You can now register your PointBlock callsign.':
  'Training ended before the required team kills. You cannot register yet.';
 document.getElementById('trainingResultKills').textContent=kills!==null&&target!==null?
  kills+' / '+target:won?'VERIFIED':'NOT COMPLETED';
 document.getElementById('trainingResultStatus').textContent=won?
  'TRAINING PASSED · READY TO REGISTER':'TRAINING INCOMPLETE · REGISTRATION LOCKED';
 document.getElementById('trainingResultContinue').textContent=won?
  'CONTINUE · REGISTER CALLSIGN':'BACK TO HOME';
 document.getElementById('trainingResult').hidden=false;
 document.getElementById('dv').classList.add('show','training-result-active');
 document.body.classList.remove('dead','bomb-spectator');
 document.body.classList.add('over');
 run=false;lob=false;
 if(document.exitPointerLock)document.exitPointerLock();
 document.getElementById('trainingResultContinue').focus();
}
function onlineTrainingResultContinue(){
 var result=onlineTrainingResultStatus;
 if(!result)return;
 onlineTrainingResultStatus=null;
 document.getElementById('trainingResult').hidden=true;
 document.getElementById('dv').classList.remove('show','training-result-active');
 document.body.classList.remove('over');document.body.classList.add('lobby');
 run=false;lob=true;lb.style.display='flex';lobP('lbs');
 if(result!=='COMPLETED')return;
 onlineDialog('REGISTER CALLSIGN',
  'Training complete! Enter a unique callsign (1–12 letters, numbers or underscore).',
  'REGISTER',async name=>{
   await onlineApi.register(name);
   await onlineApi.refreshProfile();
   await onlineLoadInventory();roomLobbyOpen();
  });
}
async function onlineTrainingFinished(progress){
 if(!onlineTraining)return;
 onlineResetLive();
 try{await onlineApi.refreshProfile()}catch(e){onlineWarn(e)}
 onlineDisplayTrainingResult(progress);
}
document.getElementById('trainingResultContinue').addEventListener('click',onlineTrainingResultContinue);
async function onlineStartTraining(){
 if(!onlineAuth())return;
 try{
  var started=await onlineApi.startTraining();
  if(started.status==='COMPLETED'){
   onlineDisplayTrainingResult({status:'COMPLETED'});return;
  }
  onlineResultsDisplayed=false;onlineTraining=true;onlineActive=true;
  await onlineApi.openLive('training',null,onlineReceiveFrame,onlineSocketStatus);
  onlineMeId=onlineWorld?.actors?.find(a=>!a.bot)?.id||null;
  roomMatchConfig={mode:0,mapId:'block-district',kills:10,minutes:5,rounds:12,roundMinutes:2};
  selM=0;selectedTdmMapId='block-district';modePreviewSelect(0);
  begin(0);onlineApplyWorld();
 }catch(error){onlineResetLive();onlineWarn(error)}
}
async function onlineStartGate(){
 if(!onlineApi?.state().authenticated){
  if(typeof homeAuthGateOpen==='function')homeAuthGateOpen('match');
  return;
 }
 if(!onlineAuth())return;
 try{
  var info=await onlineApi.refreshProfile();
  if(info.registered){
   await onlineLoadInventory();
   await onlineRecoverMembership();
   roomLobbyOpen();return
  }
  if(info.onboarding?.trainingCompleted){
   onlineDisplayTrainingResult({status:'COMPLETED'});
  }else await onlineStartTraining();
 }catch(error){onlineWarn(error)}
}
// Called after the original begin() constructs local visual actors, never local simulation.
function onlineApplyWorld(){
 var world=onlineWorld,game=onlineGame;
 if(!onlineActive||!world||!game||!run||lob)return;
 if(world.matchId!==onlineMatchId&&onlineMatchId&&!onlineTraining)return;
 if(!onlineVisualLoaded){
  en.forEach(function(b){if(b?.g)S.remove(b.g)});en.length=0;
  ROS=pl.st?[pl.st]:[];onlineActors.clear();onlineScoreboard.clear();onlineVisualLoaded=true;
 }
 var selfId=onlineUserId();
 var fresh=world.serverTick!==onlineLastAuthTick;
 if(fresh)onlineLastAuthTick=world.serverTick;
 var self=world.actors.find(a=>a.id===selfId);
 // Spectator snapshots remain recipient-bound; hidden enemies are never created.
 if(self){
  pl.tm=self.team;
  onlineReconcileSelf(self,world.privateState,fresh);
  onlineSelfTarget={x:self.x,y:self.y,z:self.z};
  var wasAlive=onlinePrevAlive,privateState=world.privateState;
  pl.dead=!self.alive;
  if(!self.alive&&wasAlive){
   resetKillStreak();kn.innerHTML='';pl.rt=0;pl.dt=0;pl.rsT=0;
   // Keep an already-received public KILL attribution when its event arrives
   // before the death snapshot. The next server-authorized respawn clears it.
   mouse.down=mouse.right=false;fireHeld=false;
   document.body.classList.toggle('dead',!isBombMode());
   document.body.classList.toggle('bomb-spectator',isBombMode());
   if(pm?.g){pm.g.visible=true;pm.g.position.set(pl.x,pl.y||0,pl.z);}
   if(pl.bloodPool)bloodPoolRemove(pl.bloodPool);
   pl.bloodPool=bloodPoolSpawn(pl.x,pl.y||0,pl.z,null);
  }else if(self.alive&&!wasAlive){
   pl.rsT=0;pl.rt=0;pl.dt=0;pl.kb='';
   if(pl.bloodPool){bloodPoolRemove(pl.bloodPool);pl.bloodPool=null;}
   if(pm)blockDeathPose(pm,0);
   document.body.classList.remove('dead','bomb-spectator');
   if(pm?.g)pm.g.visible=false;
  }
  if(!self.alive&&fresh){
   pl.rsT=Number.isFinite(privateState?.respawnRemaining)?
     Math.max(0,privateState.respawnRemaining):0;
  }
  if(fresh&&self.alive)
   onlineGrenadeServerCharge=privateState?.grenadeCharge??null;
  pl.hp=privateState?.hp??self.hp??pl.hp;
  pl.vest=privateState?.vest??self.vest??pl.vest;
  if(Number.isFinite(privateState?.spawnShieldRemaining))pl.inv=Math.max(0,privateState.spawnShieldRemaining);
  if(typeof privateState?.helmet==='boolean')pl.helm=privateState.helmet;
  else if(typeof self.helmet==='boolean')pl.helm=self.helmet;
  onlineWeaponSnapshot(self,privateState,fresh);
  if(pl.st&&privateState){
   var kills=privateState.kills;
   var newer=onlinePendingKillTotal!==null&&onlinePendingKillTick>world.serverTick;
   if(newer)kills=Math.max(kills,onlinePendingKillTotal);
   else{onlinePendingKillTick=-1;onlinePendingKillTotal=null;}
   pl.st.k=kills;pl.st.d=privateState.deaths;
   onlineSyncKillDisplay(kills,false);
   if(!newer&&Number.isSafeInteger(privateState.streak)&&privateState.streak>=0){
    if(privateState.streak===0&&ck.n!==0){ck.hs=0;kn.innerHTML='';}
    ck.n=privateState.streak;
   }
  }
  if(self.alive&&(!onlineAimInitialized||!onlinePrevAlive)){
   pl.face=self.yaw;onlineAimInitialized=true;
  }
  onlinePrevAlive=self.alive;
 }
 if(Array.isArray(game.teamKills)){ts[0]=game.teamKills[0];ts[1]=game.teamKills[1]}
 mt.t=Number.isFinite(game.remaining)?Math.max(0,game.remaining):mt.t;
 mt.cd=0;mt.over=game.status==='COMPLETED'&&!onlineActive;
 var visible=new Set();
 world.actors.forEach(function(actor){
  if(!actor||actor.id===selfId||!Number.isFinite(actor.x)||!Number.isFinite(actor.z))return;
  // Enemy deaths are hidden from new snapshots; teammates may still appear
  // with alive=false. Never build a fresh visual for someone already dead.
  if(!actor.alive)return;
  visible.add(actor.id);
  var current=onlineActors.get(actor.id);
  if(!current){
   var index=[...onlineActors.values()].filter(e=>e.tm===actor.team).length%5;
   var model=newBot(actor.team,index);
   model.id=actor.id;model.bot=!!actor.bot;
   model.name=onlinePublicActor(actor.id).name;
   // Authoritative public BOT names are stable even after visibility resets.
   onlineLabelActor(model,model.name);
   model.st=onlineScoreboard.get(actor.id)||{name:model.name,tm:actor.team,k:0,d:0};
   placeBot(model);
   onlineActors.set(actor.id,{model,label:model.name,tm:actor.team});
   current=onlineActors.get(actor.id);
  }
  var bot=current.model;
  bot.dead=false;
  if(!current.samples){current.samples=[];bot.g.position.set(actor.x,actor.y,actor.z);
   bot.x=actor.x;bot.y=actor.y;bot.z=actor.z;}
  if(fresh&&(!current.lastTick||world.serverTick>current.lastTick)){
   var samples=current.samples,last=samples[samples.length-1];
   // Never interpolate across a server-authorized teleport or new life.
   if(last&&Math.hypot(last.x-actor.x,last.z-actor.z)>4)samples.length=0;
   samples.push({t:performance.now(),x:actor.x,y:actor.y,z:actor.z,yaw:actor.yaw});
   if(samples.length>8)samples.shift();
   current.lastTick=world.serverTick;
  }
  if(bot.visualWeapon!==actor.weaponId)botVisualWeapon(bot,actor.weaponId);
  bot.weapon=actor.weaponId;bot.primary=actor.weaponId;
  bot.g.visible=true;
  if(bot.nm)bot.nm.visible=actor.team===pl.tm&&actor.alive;
 });
 // Server redacts hidden enemies. Drop the old visual AND its last known coordinates
 // from the local actor pool; the browser must not keep a phantom radar target.
 for(const [id,current] of onlineActors){
  if(!visible.has(id)){
   // A verified corpse was already transferred to original dead[] at KILL.
   // Non-authorized/stale living models are simply removed.
   if(current.model?.g)S.remove(current.model.g);
   var index=en.indexOf(current.model);
   if(index>=0)en.splice(index,1);
   onlineActors.delete(id);
  }
 }
 if(Array.isArray(game.scoreboard)){
  var entries=[];
  game.scoreboard.forEach(function(row){
   if(!row||typeof row.id!=='string'||!Number.isSafeInteger(row.kills)||!Number.isSafeInteger(row.deaths))return;
   var entry=row.id===selfId?pl.st:onlineScoreboard.get(row.id);
   if(!entry)entry={name:'PLAYER',tm:row.team,k:0,d:0};
   onlineScoreIdentity(entry,row);
   entry.tm=row.team;entry.k=row.kills;entry.d=row.deaths;
   onlineScoreboard.set(row.id,entry);entries.push(entry);
   var model=onlineActors.get(row.id)?.model;
   if(model)model.st=entry;
  });
  ROS=entries;
 }
 if(bombMatch&&world.bomb&&game.bombState){
  bombMatch.state=game.bombState;
  bombMatch.roundWins=Array.isArray(game.rounds)?game.rounds:bombMatch.roundWins;
  if(Array.isArray(game.rounds))bombMatch.round=1+game.rounds[0]+game.rounds[1];
  bombMatch.dropped=world.bomb.visibility==='TERRORISTS_ONLY'&&pl.tm===1?world.bomb.position:null;
  bombMatch.carrier=pl.tm===1&&world.bomb.carrierId===selfId?pl:
   pl.tm===1?onlineActors.get(world.bomb.carrierId)?.model||null:null;
  var action=world.privateState?.bombAction;
  pl.bAction=action&&['plant','defuse'].includes(action.kind)&&
   Number.isFinite(action.progress)&&Number.isFinite(action.required)&&action.required>0?
   {type:action.kind,t:Math.min(action.progress,action.required),site:bombMatch.site}:null;
  if(world.bomb.visibility==='PUBLIC_PLANTED'&&world.bomb.position&&BOMB_SITES.length){
   var nearest=BOMB_SITES.map(function(q,index){return{index:index,d:Math.hypot(q.x-world.bomb.position.x,q.z-world.bomb.position.z)};})
     .sort(function(x,y){return x.d-y.d})[0];
   if(nearest)bombMatch.site=nearest.index;
  }
  if(world.bomb.visibility==='PUBLIC_PLANTED'&&world.bomb.position&&bombMatch.device){
   bombMatch.device.position.set(world.bomb.position.x,0,world.bomb.position.z);
   bombMatch.device.visible=true;
  }else if(bombMatch.device)bombMatch.device.visible=false;
 }
 if(typeof tmUpd==='function')tmUpd();
}
// Real player display names only; the original BOT badge is never shown on a human.
function onlineLabelActor(model,name){
 if(!model?.nm||typeof name!=='string')return;
 var label=name.slice(0,12).toUpperCase(),canvas=document.createElement('canvas');
 canvas.width=256;canvas.height=64;
 var ctx=canvas.getContext('2d');if(!ctx)return;
 ctx.font='700 40px Rajdhani,"Trebuchet MS",sans-serif';
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=7;
 ctx.strokeStyle='rgba(0,0,0,.85)';ctx.strokeText(label,128,34);
 ctx.fillStyle=model.tm===1?'#ff8a65':'#74c0fc';ctx.fillText(label,128,34);
 var old=model.nm.material.map;model.nm.material.map=new T.CanvasTexture(canvas);
 model.nm.material.needsUpdate=true;
 if(old&&typeof old.dispose==='function')old.dispose();
}
// Recheck trusted room status when the WS stops advancing without closing.
function onlineWatchSnapshots(now){
 if(!onlineActive||onlineTraining||onlineReconnecting||onlineStallChecking||
    !roomCurrent||!onlineMatchId||!onlineLastSnapshotAt||onlinePendingMatchCompleted)return;
 var timeout=Math.max(4000,onlineRemoteDelay*20);
 if(now-onlineLastSnapshotAt<timeout||now-onlineLastStallCheckAt<timeout)return;
 onlineLastStallCheckAt=now;onlineStallChecking=true;
 var id=onlineMatchId;
 void onlineApi.getRoom(roomCurrent.id).then(function(room){
  if(!onlineActive||onlineMatchId!==id)return;
  if(room.status==='OPEN'){
   if(onlineGame?.status==='COMPLETED')
    onlineFinalizeCompletedMatch({matchId:id,game:onlineGame});
   else{
    onlineResetLive();matchExitToLobby('room');
    onlineWarn('MATCH_RESULT_UNAVAILABLE_REJOIN_ROOM');
   }
  }else if(room.status==='ACTIVE'){
   onlineApi.closeLive();onlineSocketStatus({code:1006});
  }else{
   onlineResetLive();matchExitToLobby('list');onlineWarn('MATCH_SERVER_STOPPED');
  }
 }).catch(onlineWarn).finally(function(){onlineStallChecking=false;});
}
function onlineVisualUpdate(dt){
 if(!onlineActive||!run||lob)return;
 var now=performance.now();onlineMeasureFrame(now);onlineWatchSnapshots(now);
 tt+=dt;sndN=0;
 pl.sw=Math.max(0,(pl.sw||0)-dt);
 pl.stab=Math.max(0,(pl.stab||0)-dt);
 pl.thr=Math.max(0,(pl.thr||0)-dt);
 onlineGrenadePresentationTick(dt);
 pl.pump=Math.max(0,(pl.pump||0)-dt);
 pl.rl=Math.max(0,(pl.rl||0)-dt);
 var x=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+ST.l.x,
     z=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0)+ST.l.y,
     length=Math.hypot(x,z);
 if(length>1){x/=length;z/=length;}
 var moving=!pl.dead&&length>.1;
 mvAmt+=((moving?1:0)-mvAmt)*Math.min(1,dt*8);
 wtT+=((moving?1:0)-wtT)*Math.min(1,dt*5);
 bobP+=dt*9*(moving?1:0);
 var ads=!pl.dead&&(mouse.right||scopeOn)&&canAds(pl.w);
 adsT+=((ads?1:0)-adsT)*Math.min(1,dt*12);
 sprT+=((keys.ShiftLeft||keys.ShiftRight?1:0)-sprT)*Math.min(1,dt*9);
 pl.face-=ST.r.x*2.4*dt;pl.pitch=Math.max(-1.2,Math.min(1.2,pl.pitch-ST.r.y*1.6*dt));
 var wantsFire=!onlinePendingMatchCompleted&&!pl.dead&&(!!keys.KeyF||fireHeld||
   (mouse.down&&document.pointerLockElement===R.domElement));
 if(pl.w===5){
  var canPrime=wantsFire&&!onlineGrenadeCancelUntilRelease&&pl.mag>0&&pl.rl<=0;
  if(canPrime&&!onlineGrenadeHolding){
   onlineGrenadeHolding=true;onlineGrenadeHoldAt=now;pl.thr=0;
  }else if(!canPrime&&onlineGrenadeHolding){
   onlineGrenadeHolding=false;
   if(!onlineGrenadeCancelUntilRelease)pl.thr=.5;
  }
 }
 if(!wantsFire)onlineGrenadeCancelUntilRelease=false;
 onlineGrenadeChargeUI();
 var acceptedFire=wantsFire&&!onlineGrenadeCancelUntilRelease;
 if(acceptedFire&&pl.w!==5&&pl.mag>0&&now-onlineMuzzleTime>Math.max(75,(WP[pl.w]?.cd||.14)*1000)){
  // Cosmetic prediction only: server decides shot legitimacy, ammo, hit and damage.
  onlineMuzzleTime=now;
  if(pl.w===4)pl.stab=.42;
  else if(pl.w===5)pl.thr=.5;
  else{
   flashT=.035;kick=Math.min(.26,kick+(WP[pl.w]?.viewKick||.018));
   camShot(pl.w);gunSfx(GS[SFXI[pl.w]],1);
   if(pl.w!==8)ejectShell(pl.w,1);
   if(WP[pl.w]?.pump){pl.pump=WP[pl.w].pumpDuration;pl.pumpEjected=false;}
  }
 }
 var sprint=!!(keys.ShiftLeft||keys.ShiftRight),jump=!!(keys.Space||jumpHeld),
     crouch=!!(keys.ControlLeft||keys.ControlRight);
 if(!onlinePendingMatchCompleted&&!pl.dead&&now-onlineSendAt>=50&&onlineApi?.live){
  var sequence=onlineSeq+1;
  if(onlineApi.live.send({type:'input',frame:{
   seq:sequence,moveX:x,moveZ:z,yaw:pl.face,pitch:pl.pitch,
   sprint:sprint,ads:!!ads,fire:acceptedFire,reload:!!keys.KeyR,
   jump:jump,crouch:crouch,interact:!!(keys.KeyE||bombHold),weaponId:pl.w,
  }})){
   onlineSeq=sequence;onlineSendAt=now;
   if(acceptedFire)onlineCombatQa.fireInputs++;
  }
 }
 onlineApplyWorld();
 // Countdown may only interpolate the server's authenticated respawnRemaining.
 // Never invoke the offline respawn function in an online match.
 if(pl.dead&&!isBombMode())
  pl.rsT=Math.max(0,(Number.isFinite(pl.rsT)?pl.rsT:0)-Math.max(0,dt));
 // First-person camera responds immediately on every render frame; it never
 // waits for a 10 Hz server snapshot to permit movement.
 if(!pl.dead&&onlineHasPrediction&&now-onlineLastSnapshotAt<600){
  var prediction={seq:onlineSeq,moveX:x,moveZ:z,yaw:pl.face,ads:!!ads,
   sprint:sprint,jump:jump,crouch:crouch,weaponId:pl.w,dt:Math.max(0,Math.min(dt,.05))};
  onlinePredictStep(pl,prediction,prediction.dt);
  onlinePredSteps.push(prediction);
  if(onlinePredSteps.length>128)onlinePredSteps.shift();
  // Never feed the correction, predicted position, or render FPS into the
  // authoritative match engine; this is local visual reconciliation only.
  var correctionAlpha=1-Math.exp(-12*prediction.dt);
  onlineApplyCollisionCorrection(pl,onlineCorrection,correctionAlpha,.55);
  camY=pl.y;
 }
 // 10 Hz server snapshots -> buffered ~150 ms render interpolation for
 // visible remote actors. Hidden enemy snapshots are never extrapolated.
 var renderAt=now-onlineRemoteDelay;
 onlineActors.forEach(function(actor){
  if(!actor.model?.g||!actor.model.g.visible)return;
  var sample=onlineInterpolateActor(actor.samples||[],renderAt);
  if(!sample)return;
  onlineAnimateRemoteActor(actor,sample,dt);
 });
 if(onlineHitMarker&&now>onlineHitUntil)onlineHitMarker.style.opacity='0';
 var hurtOverlay=document.getElementById('hit');
 if(hurtOverlay)hurtOverlay.style.opacity=Math.max(0,(parseFloat(hurtOverlay.style.opacity)||0)-dt*2);
 // Match the original offline blockDeathPose() while maintaining the real
 // authenticated death position. This is model-only, never a client respawn.
 if(pl.dead&&pm?.g){
  pl.dt=Math.min(5,(Number.isFinite(pl.dt)?pl.dt:0)+Math.max(0,dt));
  pm.g.visible=true;pm.g.position.set(pl.x,pl.y||0,pl.z);
  pm.g.rotation.y=pl.face;
  blockDeathPose(pm,pl.dt);
 }
 onlineTickEffects(dt);
 if(onlinePendingMatchCompleted&&dead.length===0){
  var completed=onlinePendingMatchCompleted;
  onlinePendingMatchCompleted=null;
  onlineFinalizeCompletedMatch(completed);
  return;
 }
 if(typeof hud==='function')hud();
 if(typeof hdUpd==='function')hdUpd(dt);
 if(typeof kfUpd==='function')kfUpd(dt);
 if(onlineTraining&&onlineTrainingProgressValue)onlineTrainingProgress(onlineTrainingProgressValue);
 if(isBombMode()&&bombMatch&&typeof bombHudUpdate==='function')bombHudUpdate();
}
var oldOnlineRoomRender=roomRender,oldOnlineRoomLobbyOpen=roomLobbyOpen;
roomRender=onlineRoomRender;
roomLoad=function(){roomList=roomCurrent?[roomCurrent]:[]};
roomPersist=function(){return false};
roomLiveTeams=onlineRoomTeams;
roomLobbyOpen=function(){
 if(!onlineApi?.state().authenticated||!onlineApi.state().registered){
  roomCurrent=null;roomList=[];lobP('lbs');return;
 }
 oldOnlineRoomLobbyOpen();
 if(roomCurrent){onlineLiveRoomDecorate(roomCurrent);onlineStartRoomPoll();}
 void onlineRefreshRooms();
};
var onlineWasAuthenticated=onlineApi?.state().authenticated===true;
if(onlineApi)onlineApi.setOnChange(function(state){
 homeWalletRender();
 var wasLogout=onlineWasAuthenticated&&!state.authenticated;
 onlineWasAuthenticated=state.authenticated;
 if(wasLogout){
  rankInsigniaResultDetach();
  onlineResultsDisplayed=false;onlineRewardStop();
  document.getElementById('dv').classList.remove('show');
  document.body.classList.remove('over');
  // Drop all cached weapons before returning to a public panel.
  inventoryLoad();
  var hadLiveGame=onlineActive;
  onlineResetLive();
  if(hadLiveGame&&(run||!lob))matchExitToLobby('list');
  roomList=[];roomCurrent=null;onlineRoomRender();
  // Authenticated/registered access is mandatory for every non-home route.
  if(typeof lobP==='function')lobP('lbs');
  if(typeof appRouteUpdate==='function')appRouteUpdate('lbs',true);
 }
});
function onlineAction(id,fn) {
 var el=document.getElementById(id);if(!el)return;
 el.addEventListener('click',function(e){
  e.preventDefault();e.stopImmediatePropagation();void fn();
 },true);
}
onlineAction('lbst',onlineStartGate);
onlineAction('mdm',onlineStartGate);
onlineAction('tsP',onlineStartGate);
onlineAction('tsT',onlineStartGate);
onlineAction('dgo',async()=>{
 if(!onlineResultsDisplayed){again();return;}
 onlineResultsDisplayed=false;onlineRewardStop();
 var reward=document.getElementById('verifiedReward');if(reward)reward.hidden=true;
 document.getElementById('dmn').hidden=false;
 matchExitToLobby('room');
 // This is intentionally NOT /leave, /match/leave, or /start.
 // The same existing Room Master and players remain in their room.
 if(roomCurrent)await onlineRecoverMembership().catch(onlineWarn);
});
onlineAction('dmn',()=>{
 onlineResultsDisplayed=false;onlineRewardStop();
 var reward=document.getElementById('verifiedReward');if(reward)reward.hidden=true;
 document.getElementById('dmn').hidden=false;
 matchExitToLobby('room');
 if(roomCurrent)void onlineRecoverMembership().catch(onlineWarn);
});
document.getElementById('verifiedRewardRetry').addEventListener('click',function(){
 if(onlineRewardMatchId)onlineCheckVerifiedReward(onlineRewardMatchId,0);
});
onlineAction('go',onlineStartGate);
onlineAction('escConfirmYes',async()=>{
 if(onlineActive&&!onlineTraining&&roomCurrent){
  try{await onlineApi.abandonRoom(roomCurrent.id)}
  catch(error){onlineWarn(error);return}
 }
 // Training abandonment policy is intentionally not guessed; closing the
 // socket never creates or refunds progression in the browser.
 onlineResetLive();matchExitToLobby('list');
});
onlineAction('roomCreate',onlineCreateRoom);
onlineAction('roomRefresh',onlineRefreshRooms);
onlineAction('roomSave',()=>onlineSaveRoom(false));
onlineAction('roomModalSave',()=>onlineSaveRoom(true));
onlineAction('roomClose',onlineConfirmLeaveRoom);
onlineAction('rmlLeave',onlineConfirmLeaveRoom);
onlineAction('roomStart',onlineMasterStart);
onlineAction('rmlStart',onlineToggleReady);
onlineAction('roomBack',()=>{if(roomCurrent)onlineLiveRoomDecorate(roomCurrent);else lobP('lbs')});
onlineAction('rmlSettings',()=>{if(onlineIsMaster())roomShowSettings();});
// The route is restored only AFTER the backend validates this browser tab's
// existing SIWE token and queries its current room membership.
async function onlineRestoreOnBoot(){
 try{
  if(onlineApi){
   await onlineApi.restoreSession();
   if(onlineApi.state().authenticated&&onlineApi.state().registered){
    // Direct /loby/room restore bypasses Home START: rehydrate the verified
    // fixed loadout BEFORE attaching the realtime match. Failure must not
    // block rejoining; slot UI remains null-safe and server stays authoritative.
    await onlineLoadInventory().catch(onlineWarn);
    await onlineRecoverMembership();
   }
  }
 }catch(error){onlineWarn(error);}
 finally{
  appRouteBootReady=true;
  appRouteRestore();
 }
 if(roomCurrent?.status==='ACTIVE'&&onlineApi?.state().registered){
  // Reloading during a live game reconnects to the same authoritative match.
  void onlineAttachMatch(roomCurrent);
 }
}
void onlineRestoreOnBoot();
addEventListener('pagehide',()=>{onlineApi?.closeLive();clearInterval(onlineRoomTimer)});
