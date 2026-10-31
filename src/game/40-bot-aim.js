// M2 BOT fire control: legal live-sight 3D yaw/pitch and bounded human-like response.
// Never read target coordinates after LOS is lost. Never change shared weapon damage.
var BOT_AIM=Object.freeze({
 reactionMin:.18,reactionMax:.46,turnYaw:4.6,turnPitch:2.8,
 maxLeadSeconds:.18,maxObservedVelocity:8,torsoHeight:1.12,
 yawTolerance:.19,pitchTolerance:.15,maxPitch:1.08,
 classNoise:Object.freeze({pistol:.034,rifle:.025,smg:.043,dual:.052,
   shotgun:.046,sniper:.014,rocket:.035})
});
function botAimDelta(a,b){
 return Math.atan2(Math.sin(b-a),Math.cos(b-a));
}
function botAimClear(e){
 e.aimTarget=null;e.aimReadyAt=0;e.aimCanFire=false;
 e.aimSample=null;e.aimShotPitch=null;e.aimShots=0;
}
function botAimUpdate(e,target,dt){
 if(!target||!botIntelVisible(e,target)){
  botAimClear(e);return false;
 }
 var current=e.aimTarget===target;
 if(!current){
  e.aimTarget=target;
  e.aimReadyAt=tt+BOT_AIM.reactionMin+
    Math.random()*(BOT_AIM.reactionMax-BOT_AIM.reactionMin);
  // Start each new engagement from the body's actual current orientation.
  // Reusing a previous target's stale yaw would visually snap after patrolling.
  e.aimYaw=e.g&&e.g.rotation&&Number.isFinite(e.g.rotation.y)?
    e.g.rotation.y:Number.isFinite(e.aimYaw)?e.aimYaw:0;
  e.aimPitch=Number.isFinite(e.aimPitch)?e.aimPitch:0;
  e.aimSample=null;e.aimShots=0;
 }
 // Sample velocity only while the opponent is actually visible.
 var sample=e.aimSample,vx=0,vz=0,vy=0;
 if(sample&&tt>sample.at&&tt-sample.at<.35){
  var elapsed=tt-sample.at;
  vx=(target.x-sample.x)/elapsed;vz=(target.z-sample.z)/elapsed;
  vy=((target.y||0)-sample.y)/elapsed;
  var speed=Math.hypot(vx,vz,vy);
  if(speed>BOT_AIM.maxObservedVelocity){
   var scale=BOT_AIM.maxObservedVelocity/speed;
   vx*=scale;vz*=scale;vy*=scale;
  }
 }
 e.aimSample={x:target.x,z:target.z,y:target.y||0,at:tt};
 var w=WP[e.weapon]||WP[e.primary]||WP[0],
     dx=target.x-e.x,dz=target.z-e.z,dist=Math.hypot(dx,dz)||.01,
     lead=Math.min(BOT_AIM.maxLeadSeconds,dist/Math.max(1,w.spd||160));
 // Predictions originate ONLY from fresh visual samples; do not pursue unseen positions.
 var tx=target.x+vx*lead,tz=target.z+vz*lead,
     horizontal=Math.max(.01,Math.hypot(tx-e.x,tz-e.z)),
     targetHeight=(target.y||0)+vy*lead+BOT_AIM.torsoHeight-.3*(target.crA||0),
     muzzleHeight=(e.y||0)+1.07-.3*(e.crA||0),
     desiredYaw=Math.atan2(tx-e.x,tz-e.z),
     desiredPitch=Math.max(-BOT_AIM.maxPitch,Math.min(BOT_AIM.maxPitch,
       Math.atan2(targetHeight-muzzleHeight,horizontal))),
     yawStep=Math.max(-BOT_AIM.turnYaw*dt,Math.min(BOT_AIM.turnYaw*dt,
       botAimDelta(e.aimYaw,desiredYaw))),
     pitchStep=Math.max(-BOT_AIM.turnPitch*dt,Math.min(BOT_AIM.turnPitch*dt,
       desiredPitch-e.aimPitch));
 e.aimYaw+=yawStep;
 e.aimPitch+=pitchStep;
 e.aimYawError=Math.abs(botAimDelta(e.aimYaw,desiredYaw));
 e.aimPitchError=Math.abs(desiredPitch-e.aimPitch);
 e.aimShots=Math.max(0,(e.aimShots||0)-dt*2.2);
 e.aimCanFire=tt>=e.aimReadyAt&&
   e.aimYawError<=BOT_AIM.yawTolerance&&
   e.aimPitchError<=BOT_AIM.pitchTolerance;
 return e.aimCanFire;
}
function botAimShot(e,w,d){
 // One lawful bullet direction, with independent class-specific angular error.
 // Shared fire() still applies canonical spread, pellet pattern, hitboxes and damage.
 if(!e.aimCanFire||!e.aimTarget||!botIntelVisible(e,e.aimTarget))return null;
 var kind=w.stats&&w.stats.kind||'rifle',
     base=BOT_AIM.classNoise[kind]||.032,
     distancePenalty=Math.min(.065,Math.max(0,d)*.0013),
     burstPenalty=Math.min(.04,(e.aimShots||0)*.006),
     spread=base+distancePenalty+burstPenalty,
     yaw=(Math.random()-.5)*2*spread,
     pitch=(Math.random()-.5)*2*spread;
 e.aimShots=(e.aimShots||0)+1;
 return {yaw:e.aimYaw+yaw,
  pitch:Math.max(-BOT_AIM.maxPitch,Math.min(BOT_AIM.maxPitch,e.aimPitch+pitch))};
}
