// M7 diagnostic instrumentation: local, opt-in, bounded, decision-independent.
// Enable only via index.html?bbBotQa=1 (including file://); no telemetry by default.
// No network calls, persistence, user identity, coordinates, gameplay changes or UI.
var botQaEnabled=false;
try{
 botQaEnabled=typeof location!=='undefined'&&
   new URLSearchParams(location.search).get('bbBotQa')==='1';
}catch(_qaError){botQaEnabled=false;}
var BOT_QA=Object.freeze({
 maxFrames:2400,maxCpuTicks:2400,maxReactions:500,
 ranges:['0-10','10-20','20-30','30+','unknown']
});
function botQaState(){
 return {startedAt:Date.now(),frames:[],frameJs:[],cpu:[],reactions:[],
  projectiles:0,hits:0,shots:{},blockedSeconds:0,movingSeconds:0,
  pathAttempts:0,pathFailures:0,rounds:[],lostSight:0,observations:0,
  outOfWindowFrames:0,renderSamples:0};
}
var botQaData=botQaState();
function botQaBounded(arr,value,max){
 if(arr.length>=max)arr.shift();
 arr.push(value);
}
function botQaPercentiles(values){
 if(!values.length)return {count:0,median:null,p95:null,max:null};
 var s=values.slice().sort(function(a,b){return a-b;});
 return {count:s.length,
  median:Math.round(s[Math.floor((s.length-1)*.5)]*1000)/1000,
  p95:Math.round(s[Math.floor((s.length-1)*.95)]*1000)/1000,
  max:Math.round(s[s.length-1]*1000)/1000};
}
function botQaFrame(deltaMs,renderMs,active){
 if(!botQaEnabled||!active||!Number.isFinite(deltaMs))return;
 // RequestAnimationFrame wall-clock period: no game-dt clamp (which is 50ms).
 if(deltaMs>0&&deltaMs<500){
  botQaBounded(botQaData.frames,deltaMs,BOT_QA.maxFrames);
  if(Number.isFinite(renderMs)&&renderMs>=0)
   botQaBounded(botQaData.frameJs,renderMs,BOT_QA.maxFrames);
  botQaData.renderSamples++;
 }else botQaData.outOfWindowFrames++;
}
function botQaCpu(elapsedMs,bots){
 if(!botQaEnabled||!Number.isFinite(elapsedMs)||bots<1)return;
 botQaBounded(botQaData.cpu,elapsedMs,BOT_QA.maxCpuTicks);
}
function botQaObserve(e,target){
 if(!botQaEnabled||!e||!target)return;
 e.qaContactAt=tt;e.qaContactTarget=target;e.qaContactFired=false;
 botQaData.observations++;
}
function botQaSightLost(e){
 if(!botQaEnabled||!e)return;
 if(e.qaContactTarget&&!e.qaContactFired)botQaData.lostSight++;
 e.qaContactTarget=null;e.qaContactFired=false;
}
function botQaBand(distance){
 if(!Number.isFinite(distance))return 'unknown';
 return distance<10?'0-10':distance<20?'10-20':distance<30?'20-30':'30+';
}
function botQaShot(shooter,weapon,own,bullet){
 if(!botQaEnabled||own!=='e'||!bullet)return;
 var kind=weapon&&weapon.stats&&weapon.stats.kind||'unknown',
     mode=typeof isBombMode==='function'&&isBombMode()?'bomb':'tdm',
     target=shooter&&shooter.aimTarget,
     distance=target&&typeof botIntelVisible==='function'&&
       botIntelVisible(shooter,target)?
       Math.hypot(target.x-shooter.x,target.z-shooter.z):NaN,
     band=botQaBand(distance),
     key=mode+'|'+kind+'|'+band,
     stat=botQaData.shots[key]||(botQaData.shots[key]={mode:mode,kind:kind,
       range:band,projectiles:0,hits:0});
 bullet.qaKey=key;stat.projectiles++;botQaData.projectiles++;
 // Shot-to-sight timing: first fired projectile after a live reacquisition.
 if(shooter&&target&&shooter.qaContactTarget===target&&!shooter.qaContactFired){
  var lag=(tt-shooter.qaContactAt)*1000;
  if(Number.isFinite(lag)&&lag>=0&&lag<10000)
   botQaBounded(botQaData.reactions,lag,BOT_QA.maxReactions);
  shooter.qaContactFired=true;
 }
}
function botQaHit(b){
 if(!botQaEnabled||!b||!b.qaKey)return;
 var row=botQaData.shots[b.qaKey];
 if(!row)return;
 row.hits++;botQaData.hits++;
}
function botQaMove(wanted,moved,speed,dt){
 if(!botQaEnabled||!wanted||!Number.isFinite(dt)||dt<=0)return;
 botQaData.movingSeconds+=dt;
 if(moved<Math.max(.003,speed*dt*.22))botQaData.blockedSeconds+=dt;
}
function botQaPath(p){
 if(!botQaEnabled)return;
 botQaData.pathAttempts++;
 if(!p||!p.length)botQaData.pathFailures++;
}
function botQaBomb(winner,site,state){
 if(!botQaEnabled)return;
 if(botQaData.rounds.length>=150)botQaData.rounds.shift();
 botQaData.rounds.push({winner:winner,site:site,
  planted:state==='planted'});
}
function botQaReport(){
 var frames=botQaPercentiles(botQaData.frames),
     frameJs=botQaPercentiles(botQaData.frameJs),
     cpu=botQaPercentiles(botQaData.cpu),
     latency=botQaPercentiles(botQaData.reactions);
 var rows=Object.keys(botQaData.shots).sort().map(function(k){
  var r=botQaData.shots[k];
  return {mode:r.mode,weaponKind:r.kind,rangeBand:r.range,
   projectiles:r.projectiles,characterHits:r.hits,
   projectileHitPercent:r.projectiles?
    Math.round(r.hits/r.projectiles*10000)/100:null};
 });
 var bomb={completed:botQaData.rounds.length,policeWins:0,
  terroristWins:0,plantedAtFinish:0,siteA:0,siteB:0,noSite:0};
 botQaData.rounds.forEach(function(r){
  if(r.winner===0)bomb.policeWins++;
  else if(r.winner===1)bomb.terroristWins++;
  if(r.planted)bomb.plantedAtFinish++;
  if(r.site===0)bomb.siteA++;
  else if(r.site===1)bomb.siteB++;
  else bomb.noSite++;
 });
 return {schema:'BLOCK_BUDDIES_M7_QA_V1',enabled:true,
  recordedStartUnixMs:botQaData.startedAt,
  limitation:'Only events observed in this browser tab with opt-in flag; samples are rolling windows, not M0 paired baseline. Projectile hit rate is character-hit projectile / fired projectile, not trigger accuracy; shotgun pellets counted separately. CPU measures botsUpd only. No claims of full map coverage.',
  frameTimeMs:frames,frameJavaScriptWorkMs:frameJs,botUpdateCpuMs:cpu,
  firstSightToShotMs:latency,
  approximateFpsMedian:frames.median?Math.round(1000/frames.median*10)/10:null,
  projectileCount:botQaData.projectiles,
  characterProjectileHits:botQaData.hits,
  projectileHitPercent:botQaData.projectiles?
   Math.round(botQaData.hits/botQaData.projectiles*10000)/100:null,
  byWeaponRange:rows,observations:botQaData.observations,
  lostUnfiredSightings:botQaData.lostSight,
  movementAttemptSeconds:Math.round(botQaData.movingSeconds*100)/100,
  lowDisplacementSeconds:Math.round(botQaData.blockedSeconds*100)/100,
  pathAttempts:botQaData.pathAttempts,pathFailures:botQaData.pathFailures,
  bombRounds:bomb,invalidOrSuspendedFrames:botQaData.outOfWindowFrames,
  frameSampleLimit:BOT_QA.maxFrames,cpuSampleLimit:BOT_QA.maxCpuTicks,
  reactionSampleLimit:BOT_QA.maxReactions};
}
function botQaDownload(){
 if(!botQaEnabled||typeof document==='undefined'||typeof Blob==='undefined')return false;
 var data=JSON.stringify(botQaReport(),null,2),
     blob=new Blob([data],{type:'application/json'}),
     url=URL.createObjectURL(blob),
     a=document.createElement('a');
 a.href=url;a.download='block-buddies-m7-qa.json';
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(function(){URL.revokeObjectURL(url);},2000);
 return true;
}
if(botQaEnabled&&typeof window!=='undefined'){
 // Explicit, opt-in console API. Never sends data to any server.
 window.BlockBuddiesQA=Object.freeze({
  report:botQaReport,download:botQaDownload,
  reset:function(){botQaData=botQaState();}
 });
 console.info('BLOCK BUDDIES local M7 QA enabled: BlockBuddiesQA.report() / .download()');
}
