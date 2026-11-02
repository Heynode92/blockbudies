// Authoritative online bridge for the existing single-scope Three.js runtime.
// No browser-local room, unlock, score, objective, bot aim or kill is authoritative.
// The original rendering, UI transitions, map art and viewmodels are preserved.
var onlineApi=typeof PB_ONLINE!=='undefined'?PB_ONLINE:null;
var onlineActive=false,onlineTraining=false,onlineCurrentId=null,onlineMatchId=null;
var onlineWorld=null,onlineGame=null,onlineActors=new Map(),onlineSeq=0,onlineSendAt=0,onlineMeId=null;
var onlineLobbyTimer=0,onlineRoomOpening=false,onlineRoomTimer=0,onlineRouteToken=0,onlineAttaching=false;
var onlineTeamNotice=null,onlineInputId=0,onlineVisualLoaded=false;
var onlineReconnectTimer=0,onlineReconnectStarted=0,onlineReconnecting=false;
var onlineAimInitialized=false,onlineTrainingProgressValue=null,onlinePrevAlive=true;
var onlineSelfTarget=null,onlineLastWinner=undefined,onlineMuzzleTime=0;
var onlinePendingWeapon=null,onlinePendingWeaponAt=0,onlineHitMarker=null,onlineHitUntil=0;
var onlineShotTracers=[];
var onlineScoreboard=new Map();
// Local display-only movement, never an authoritative position or damage claim.
var onlinePredSteps=[],onlineCorrection={x:0,y:0,z:0},onlineHasPrediction=false;
var onlineLastAuthTick=-1,onlineLastAck=0,onlineLastAccepted=0;
var onlineFrameSamples=[],onlineSnapshotSamples=[],onlineLastFrameAt=0,onlineLastSnapshotAt=0;
var onlineLastSnapshotTick=-1,onlineLastMetricsAt=0,onlineCorrectionSize=0,onlineRemoteDelay=150;
var onlinePerfEnabled=typeof location!=='undefined'&&new URLSearchParams(location.search).has('pbNetQa');
var onlinePerfPanel=null;
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
 onlinePerfPanel.textContent='POINTBLOCK · NETWORK QA (LOCAL)\n'+
  'Frame p95: '+frame.toFixed(1)+' ms · FPS ~'+(frame?Math.round(1000/frame):'—')+'\n'+
  'Snapshot p95: '+snapshot.toFixed(1)+' ms\n'+
  'Last snapshot: '+Math.round(elapsed)+' ms ago\n'+
  'Server tick: '+onlineLastSnapshotTick+' · input ack: '+onlineLastAck+'\n'+
  'Pending frames: '+onlinePredSteps.length+' · correction: '+onlineCorrectionSize.toFixed(2)+'m';
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
function onlineReactToImpact(victimId,headshot){
 if(typeof victimId!=='string'||!onlineActive)return;
 // Never create an actor from combat events; use only an already authorized visual.
 var record=onlineActors.get(victimId),bot=record?.model;
 if(!bot||bot.dead||!bot.g?.visible)return;
 bot.fl=.18;bot.hs=Math.random()<.5?-1:1;
 bot.hv=(bot.hv||0)+(headshot?7:4);
 // Visual-only blood; damage and victim identity are already verified by BE.
 var dx=bot.x-pl.x,dz=bot.z-pl.z;
 bloodHit(bot.x,(bot.y||0)+(headshot?1.7:1.12),bot.z,dx,dz,!!headshot);
}
function onlineTickEffects(dt){
 for(var n=onlineShotTracers.length-1;n>=0;n--){
  var beam=onlineShotTracers[n];beam.t-=dt;
  if(beam.t<=0){S.remove(beam.m);onlineShotTracers.splice(n,1);continue;}
  beam.m.position.x+=beam.vx*dt;beam.m.position.y+=beam.vy*dt;
  beam.m.position.z+=beam.vz*dt;
 }
 updCl(dt);updCh(dt);
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
 updDrops(dt);
 updSm(dt);
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
// Cosmetic tracer, sourced only from a server-confirmed shot origin and direction.
function onlineShotTracer(frame){
 if(![frame.x,frame.y,frame.z,frame.yaw,frame.pitch].every(Number.isFinite))return;
 if(!Number.isInteger(frame.weaponId)||frame.weaponId<0||frame.weaponId>=WP.length)return;
 var w=WP[frame.weaponId];
 if(w.melee||w.gr)return;
 if(onlineShotTracers.length>=40){var oldest=onlineShotTracers.shift();S.remove(oldest.m);}
 var own=frame.actorId===onlineUserId()?'p':'e',mesh=tracer(own,false);
 var angle=frame.yaw,pitch=frame.pitch,speed=Math.min(260,w.spd||180);
 mesh.rotation.order='YXZ';mesh.rotation.set(-pitch,angle,0);
 mesh.position.set(frame.x,frame.y,frame.z);S.add(mesh);
 onlineShotTracers.push({m:mesh,vx:Math.sin(angle)*Math.cos(pitch)*speed,
  vy:Math.sin(pitch)*speed,vz:Math.cos(angle)*Math.cos(pitch)*speed,t:.085});
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
  status:r.status,members:Array.isArray(r.members)?r.members:[],
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
function onlineRoomRender(){
 var list=document.getElementById('roomEntries');if(!list)return;
 list.replaceChildren();
 document.getElementById('roomEmpty').hidden=roomList.length>0;
 roomText('roomCount',roomList.length+' ONLINE ROOM'+(roomList.length===1?'':'S'));
 roomList.forEach(function(r){
  var row=document.createElement('div');row.className='room-entry';
  function cell(tag,value,cls){var el=document.createElement(tag);el.textContent=String(value);if(cls)el.className=cls;row.appendChild(el);return el}
  cell('span',r.code||'—');cell('strong',r.name);
  var map=document.createElement('div');map.className='rm-map';
  var title=document.createElement('span'),mode=document.createElement('small');
  title.textContent=(roomMapsForMode(r.mode,r.mapId)||{}).name||'UNKNOWN';
  mode.textContent=r.mode===1?'BOMB MISSION':'DEATHMATCH';
  map.appendChild(title);map.appendChild(mode);row.appendChild(map);
  cell('span',r.members.length+' / 10');
  cell('span',r.status||'WAITING','rm-status');
  var button=cell('button','JOIN');button.type='button';
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
function onlineRoomTeams(){
 var size=5, me=onlineApi?.state().player?.id;
 for(var side=0;side<2;side++){
  var target=document.getElementById(side===0?'rmlPoliceSlots':'rmlTerrorSlots');
  target.replaceChildren();
  var members=(roomCurrent?.members||[]).filter(m=>m.team===side);
  roomText(side===0?'rmlPoliceCount':'rmlTerrorCount',members.length+' / '+size+' PLAYERS');
  for(var index=0;index<size;index++){
   var member=members[index],mine=member?.playerId===me;
   var row=document.createElement('button');row.type='button';
   row.className='rml-slot'+(mine?' is-you':'');row.disabled=!!member&&!mine;
   row.setAttribute('aria-pressed',String(mine));
   var num=document.createElement('span');num.className='rml-slot-index';num.textContent=String(index+1);
   var name=document.createElement('span');name.className='rml-slot-name';
   name.textContent=member?(mine?'YOU · '+member.username:member.username):'BOT ON START';
   var hint=document.createElement('em');hint.textContent=mine?'YOU':member?'PLAYER':'OPEN';
   row.appendChild(num);row.appendChild(name);row.appendChild(hint);
   if(!member){(function(team){row.addEventListener('click',()=>{void onlineSwitchTeam(team)})})(side)}
   target.appendChild(row);
  }
 }
}
function onlineLiveRoomDecorate(room) {
 roomLiveOpen(room);
 var me=onlineOwnMember();
 roomText('rmlBotSummary',room.members.length+' PLAYER'+(room.members.length===1?'':'S')+
  ' + '+(10-room.members.length)+' BOTS ON START');
 var mine=onlineIsMaster();
 document.getElementById('roomMasterActions').hidden=!mine;
 document.getElementById('roomMasterStatus').hidden=!mine;
 var startControl=document.getElementById('rmlStart');
 startControl.hidden=!mine||!['OPEN','ACTIVE'].includes(room.status);
 startControl.textContent=room.status==='ACTIVE'?'REJOIN MATCH':'START MATCH';
 // A Room Master still owns an ACTIVE room, but its rules are locked in.
 document.getElementById('rmlSettings').hidden=!mine||room.status!=='OPEN';
 if(me){roomSide=me.team===1?1:0;roomSeat=room.members.filter(m=>m.team===roomSide).findIndex(m=>m.playerId===me.playerId)}
 onlineRoomTeams();
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
 }catch(error){onlineWarn(error)}
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
 }catch(error){onlineWarn(error)}
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
 onlineActive=false;onlineTraining=false;onlineCurrentId=null;onlineMatchId=null;
 onlineWorld=null;onlineGame=null;
 for(const item of onlineActors.values()){if(item.model?.g)S.remove(item.model.g)}
 onlineActors.clear();onlineMeId=null;onlineSeq=0;onlineSendAt=0;onlineVisualLoaded=false;
 onlinePredSteps.length=0;onlineCorrection={x:0,y:0,z:0};onlineHasPrediction=false;
 onlineLastAuthTick=-1;onlineLastAck=0;onlineLastAccepted=0;
 onlineLastFrameAt=0;onlineLastSnapshotAt=0;onlineLastSnapshotTick=-1;onlineRemoteDelay=150;
 onlineFrameSamples.length=0;onlineSnapshotSamples.length=0;onlineCorrectionSize=0;
 if(onlinePerfPanel){onlinePerfPanel.remove();onlinePerfPanel=null;}
 onlineAimInitialized=false;onlineTrainingProgressValue=null;onlinePrevAlive=true;
 onlineSelfTarget=null;onlineLastWinner=undefined;onlineMuzzleTime=0;onlineScoreboard.clear();
 onlinePendingWeapon=null;onlinePendingWeaponAt=0;onlineHitUntil=0;
 if(onlineHitMarker){onlineHitMarker.remove();onlineHitMarker=null;}
 for(const fx of mzf)S.remove(fx.m);mzf.length=0;
 for(const particle of sk)S.remove(particle.m);sk.length=0;bloodActive=0;
 for(const dropped of dg)S.remove(dropped.m);dg.length=0;
 for(const tracer of onlineShotTracers)S.remove(tracer.m);onlineShotTracers.length=0;
 for(const mark of DC){S.remove(mark);if(mark.userData.t!==undefined)mark.material.dispose()}DC.length=0;
 for(const chunk of CH)S.remove(chunk.m);CH.length=0;
 clrFD();clrSm();
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
   if(error?.code!=='ROOM_ALREADY_ACTIVE'&&error?.code!=='ROOM_NOT_READY')throw error;
   var activeRoom=await onlineApi.getRoom(authoritative.id);
   if(activeRoom.ownerId!==playerId||activeRoom.status!=='ACTIVE')throw error;
   onlineLiveRoomDecorate(onlineAdoptRoom(activeRoom));
   await onlineAttachMatch(roomCurrent);
  }
 }catch(error){onlineWarn(error)}
 finally{startControl.disabled=false}
}
function onlineBeginTransition(room){
 var flow=roomStartFlow;
 roomMatchConfig={...room};
 selectedTdmMapId=tdmMapId(room.mapId);selectedBombMapId=bombMapId(room.mapId);
 selM=room.mode;selectedGameMode=room.mode;
 modePreviewSelect(selM);
 if(flow.active)roomStartAbort();
 flow.active=true;flow.phase='countdown';flow.token++;
 flow.team=roomSide;flow.config={...room};
 flow.deadline=performance.now()+ROOM_START_COUNTDOWN*1000;
 document.getElementById('roomPrestartNumber').textContent=String(ROOM_START_COUNTDOWN);
 document.getElementById('roomPrestart').hidden=false;
 var token=flow.token;
 flow.raf=requestAnimationFrame(function(now){roomStartCountdown(now,token)});
}
function onlineUserId(){
 return onlineTraining?onlineMeId:onlineApi?.state().player?.id;
}
function onlineReceiveFrame(frame){
 if(frame.type==='lobby_snapshot'){
  if(roomCurrent&&frame.roomId===roomCurrent.id)void onlineApi.getRoom(roomCurrent.id)
   .then(r=>onlineLiveRoomDecorate(onlineAdoptRoom(r))).catch(onlineWarn);
  return;
 }
 if(frame.type==='match_ready'||frame.type==='training_ready'||
    frame.type==='match_snapshot'||frame.type==='training_snapshot'){
  // Rejoined masters recover the same matchId from the authoritative WS handshake.
  if(frame.type==='match_ready'&&typeof frame.matchId==='string')onlineMatchId=frame.matchId;
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
  if(onlineActive)onlineWallImpact(frame);
  return;
 }
 if(frame.type==='combat_hit'){
  if(onlineActive){
   onlineHitConfirm(!!frame.headshot);
   onlineReactToImpact(frame.victimId,!!frame.headshot);
  }
  return;
 }
 if(frame.type==='combat_impact'){
  onlineReactToImpact(frame.victimId,!!frame.headshot);
  return;
 }
 if(frame.type==='combat_hurt'){
  if(onlineActive){
   var hit=document.getElementById('hit');
   if(hit)hit.style.opacity='1';
   cs.s=Math.max(cs.s,.45);
  }
  return;
 }
 if(frame.type==='combat_shot'){
  if(!onlineActive)return;
  onlineShotTracer(frame);
  if(frame.actorId===onlineUserId())return;
  var remote=onlineActors.get(frame.actorId);
  if(remote&&remote.model&&!remote.model.dead){
   var bot=remote.model;bot.rc=1;
   if(Number.isInteger(frame.weaponId)&&frame.weaponId>=0&&frame.weaponId<WP.length){
    botVisualWeapon(bot,frame.weaponId);bot.weapon=frame.weaponId;
   }
   if(bot.weapon!==4&&bot.weapon!==5){
    // Emit at the real animated gun muzzle, not the soldier center.
    var gun=bot.g?.userData?.rg;
    if(gun){
     gun.updateWorldMatrix(true,false);
     var tip=gun.localToWorld(new T.Vector3(0,0,-.7));
     enemyShotFx(bot,tip.x,tip.y,tip.z);
    }
   }
  }
  return;
 }
 if(frame.type==='match_event'){
  var event=frame.event;
  if(event?.kind==='MATCH_END')onlineLastWinner=event.winner;
  if(event?.kind==='KILL'&&onlineActive){var actor=onlineActors.get(event.actorId)?.label||'PLAYER';
   var victim=onlineActors.get(event.victimId)?.label||'PLAYER';
   roomLiveLog(actor+' ELIMINATED '+victim);}
  return;
 }
 if(frame.type==='match_completed'){
  var result=frame.game,matchId=frame.matchId,winner=onlineLastWinner,mode=roomCurrent?.mode??selM;
  mt.over=true;onlineGame=result;onlineResetLive();
  matchExitToLobby('list');
  onlineShowMatchReport(result,matchId,winner,mode);
  return;
 }
 if(frame.type==='training_result'){
  onlineTrainingProgress(frame.progress);
  if(frame.progress?.status==='COMPLETED'){void onlineTrainingCompleted();return;}
  if(frame.progress?.status==='TIMEOUT_POLICY_PENDING'){
   onlineResetLive();run=false;lob=true;lb.style.display='flex';document.body.classList.add('lobby');
   lobP('lbs');onlineWarn('TRAINING_TIME_EXPIRED_NOT_ELIGIBLE');
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
async function onlineTrainingCompleted(){
 if(!onlineTraining)return;
 onlineResetLive();run=false;lob=true;lb.style.display='flex';document.body.classList.add('lobby');
 lobP('lbs');
 try{await onlineApi.refreshProfile()}catch(e){onlineWarn(e)}
 onlineDialog('TRAINING COMPLETE','Enter a unique PointBlock callsign (1–12 letters, numbers or underscore).','REGISTER',async name=>{
  await onlineApi.register(name);
  await onlineApi.refreshProfile();
  await onlineLoadInventory();roomLobbyOpen();
 });
}
async function onlineStartTraining(){
 if(!onlineAuth())return;
 try{
  var started=await onlineApi.startTraining();
  if(started.status==='COMPLETED'){
   onlineDialog('REGISTER CALLSIGN','Training verified. Choose a unique username.','REGISTER',async name=>{
    await onlineApi.register(name);await onlineApi.refreshProfile();
    await onlineLoadInventory();roomLobbyOpen();
   });return;
  }
  onlineTraining=true;onlineActive=true;
  await onlineApi.openLive('training',null,onlineReceiveFrame,onlineSocketStatus);
  onlineMeId=onlineWorld?.actors?.find(a=>!a.bot)?.id||null;
  roomMatchConfig={mode:0,mapId:'block-district',kills:10,minutes:5,rounds:12,roundMinutes:2};
  selM=0;selectedTdmMapId='block-district';modePreviewSelect(0);
  begin(0);onlineApplyWorld();
 }catch(error){onlineResetLive();onlineWarn(error)}
}
async function onlineStartGate(){
 if(!onlineAuth())return;
 try{
  var info=await onlineApi.refreshProfile();
  if(info.registered){await onlineLoadInventory();roomLobbyOpen();return}
  if(info.onboarding?.trainingCompleted){
   onlineDialog('REGISTER CALLSIGN','Training verified. Choose your player name.','REGISTER',async name=>{
    await onlineApi.register(name);await onlineApi.refreshProfile();
    await onlineLoadInventory();roomLobbyOpen();
   });
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
  pl.dead=!self.alive;
  var privateState=world.privateState;
  pl.hp=privateState?.hp??self.hp??pl.hp;
  pl.vest=privateState?.vest??self.vest??pl.vest;
  if(Number.isFinite(privateState?.spawnShieldRemaining))pl.inv=Math.max(0,privateState.spawnShieldRemaining);
  if(typeof privateState?.helmet==='boolean')pl.helm=privateState.helmet;
  else if(typeof self.helmet==='boolean')pl.helm=self.helmet;
  onlineWeaponSnapshot(self,privateState,fresh);
  if(pl.st&&privateState){pl.st.k=privateState.kills;pl.st.d=privateState.deaths;}
  if(self.alive&&(!onlineAimInitialized||!onlinePrevAlive)){
   pl.face=self.yaw;onlineAimInitialized=true;
  }
  onlinePrevAlive=self.alive;
 }
 if(Array.isArray(game.teamKills)){ts[0]=game.teamKills[0];ts[1]=game.teamKills[1]}
 mt.t=Number.isFinite(game.remaining)?Math.max(0,game.remaining):mt.t;
 mt.cd=0;mt.over=game.status==='COMPLETED';
 var visible=new Set();
 world.actors.forEach(function(actor){
  if(!actor||actor.id===selfId||!Number.isFinite(actor.x)||!Number.isFinite(actor.z))return;
  visible.add(actor.id);
  var current=onlineActors.get(actor.id);
  if(!current){
   var index=[...onlineActors.values()].filter(e=>e.tm===actor.team).length%5;
   var model=newBot(actor.team,index);
   model.id=actor.id;model.bot=!!actor.bot;
   model.name=actor.bot?model.name:roomCurrent?.members?.find(m=>m.playerId===actor.id)?.username||'PLAYER';
   if(!actor.bot)onlineLabelActor(model,model.name);
   model.st=onlineScoreboard.get(actor.id)||{name:model.name,tm:actor.team,k:0,d:0};
   placeBot(model);
   onlineActors.set(actor.id,{model,label:model.name,tm:actor.team});
   current=onlineActors.get(actor.id);
  }
  var bot=current.model;
  bot.dead=!actor.alive;
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
  bot.g.visible=!!actor.alive;
  if(bot.nm)bot.nm.visible=actor.team===pl.tm&&actor.alive;
 });
 // Server redacts hidden enemies. Drop the old visual AND its last known coordinates
 // from the local actor pool; the browser must not keep a phantom radar target.
 for(const [id,current] of onlineActors){
  if(!visible.has(id)){
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
   if(!entry){
    var human=roomCurrent?.members?.find(function(m){return m.playerId===row.id});
    entry={name:human?.username||'BOT',tm:row.team,k:0,d:0};
   }
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
function onlineShowMatchReport(game,matchId,winner,mode){
 if(!game)return;
 var old=document.getElementById('pointblockMatchReport');if(old)old.remove();
 var overlay=document.createElement('div');overlay.id='pointblockMatchReport';overlay.className='point-online-dialog';
 var panel=document.createElement('section');panel.className='point-online-dialog-panel';
 var heading=document.createElement('h2');heading.textContent='SERVER-VERIFIED MATCH RESULT';
 var own=roomSide===1?1:0,score=game.teamKills||[0,0];
 if(Array.isArray(game.rounds)&&mode===1)score=game.rounds;
 var summary=document.createElement('p');
 summary.textContent='POLICE '+score[0]+' — '+score[1]+' TERRORISTS';
 var verdict=document.createElement('p');
 verdict.textContent=winner===null?'DRAW':winner===own?'VICTORY':winner===1-own?'DEFEAT':'MATCH COMPLETE';
 var reward=document.createElement('p');reward.textContent='Reward verification pending';
 var button=document.createElement('button');button.type='button';button.textContent='BACK TO LOBBY';
 button.onclick=function(){overlay.remove();roomLobbyOpen()};
 panel.append(heading,summary,verdict,reward,button);overlay.append(panel);document.body.append(overlay);
 if(matchId&&onlineApi?.state().authenticated){
  onlineApi.award(matchId).then(function(value){
   function halfUnits(input){var n=BigInt(input);return (n/2n).toString()+(n%2n?'.5':'');}
   reward.textContent='EXP +'+halfUnits(value.awardedExpHalf)+
    ' · vPBT +'+halfUnits(value.awardedVpbtHalf);
  }).catch(function(error){reward.textContent='Reward pending server verification ('+(error.code||'NOT_AVAILABLE')+')'});
 }
}
function onlineVisualUpdate(dt){
 if(!onlineActive||!run||lob)return;
 var now=performance.now();onlineMeasureFrame(now);
 tt+=dt;sndN=0;
 pl.sw=Math.max(0,(pl.sw||0)-dt);
 pl.stab=Math.max(0,(pl.stab||0)-dt);
 pl.thr=Math.max(0,(pl.thr||0)-dt);
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
 var wantsFire=!pl.dead&&(!!keys.KeyF||fireHeld||
   (mouse.down&&document.pointerLockElement===R.domElement));
 if(wantsFire&&pl.mag>0&&now-onlineMuzzleTime>Math.max(75,(WP[pl.w]?.cd||.14)*1000)){
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
 if(!pl.dead&&now-onlineSendAt>=50&&onlineApi?.live){
  var sequence=onlineSeq+1;
  if(onlineApi.live.send({type:'input',frame:{
   seq:sequence,moveX:x,moveZ:z,yaw:pl.face,pitch:pl.pitch,
   sprint:sprint,ads:!!ads,fire:wantsFire,reload:!!keys.KeyR,
   jump:jump,crouch:crouch,interact:!!(keys.KeyE||bombHold),weaponId:pl.w,
  }})){onlineSeq=sequence;onlineSendAt=now;}
 }
 onlineApplyWorld();
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
 onlineTickEffects(dt);
 if(typeof hud==='function')hud();
 if(typeof hdUpd==='function')hdUpd(dt);
 if(typeof kfUpd==='function')kfUpd(dt);
 if(onlineTraining&&onlineTrainingProgressValue)onlineTrainingProgress(onlineTrainingProgressValue);
 if(isBombMode()&&bombMatch&&typeof bombHudUpdate==='function')bombHudUpdate();
}
var oldOnlineRoomRender=roomRender,oldOnlineRoomLobbyOpen=roomLobbyOpen;
roomRender=onlineRoomRender;
roomLoad=function(){roomList=[]};
roomPersist=function(){return false};
roomLiveTeams=onlineRoomTeams;
roomLobbyOpen=function(){
 oldOnlineRoomLobbyOpen();
 if(onlineApi?.state().registered)void onlineRefreshRooms();
};
var onlineWasAuthenticated=onlineApi?.state().authenticated===true;
if(onlineApi)onlineApi.setOnChange(function(state){
 homeWalletRender();
 var wasLogout=onlineWasAuthenticated&&!state.authenticated;
 onlineWasAuthenticated=state.authenticated;
 if(wasLogout){
  var hadLiveGame=onlineActive;
  onlineResetLive();
  if(hadLiveGame&&(run||!lob))matchExitToLobby('list');
  roomList=[];roomCurrent=null;onlineRoomRender();
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
onlineAction('dgo',()=>{onlineResetLive();matchExitToLobby('list')});
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
onlineAction('roomClose',onlineLeaveRoom);
onlineAction('rmlLeave',onlineLeaveRoom);
onlineAction('roomStart',onlineMasterStart);
onlineAction('rmlStart',onlineMasterStart);
onlineAction('roomBack',()=>{if(roomCurrent)onlineLiveRoomDecorate(roomCurrent);else lobP('lbs')});
onlineAction('rmlSettings',()=>{if(onlineIsMaster())roomShowSettings();});
addEventListener('pagehide',()=>{onlineApi?.closeLive();clearInterval(onlineRoomTimer)});
