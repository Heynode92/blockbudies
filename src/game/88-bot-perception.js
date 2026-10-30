// M1 BOT perception: evidence-only sight, acoustic cues and bounded team radio.
// Never expose hidden live enemy objects via tactical goal helpers.
var BOT_SENSE=Object.freeze({
 sightRange:45,memorySeconds:3.6,radioSeconds:2.4,
 radioInterval:.35,footstepRange:17,gunshotRange:37,
 soundSeconds:1.35,maxSounds:28,hearingCooldown:.45,
 auditoryUncertainty:2.4
});
var botSoundEvents=[],botTeamReports=[null,null];
function botIntelReset(){
 botSoundEvents.length=0;botTeamReports=[null,null];
 // Also clear per-life evidence when a match/round is rebuilt.
 if(typeof en!=='undefined'&&en)en.forEach(function(e){
  if(e){e.lastSeen=null;e.heard=null;e.tg=null;e.lok=false;}
 });
}
function botIntelVisible(e,foe){
 return !!(e&&foe&&e!==foe&&!e.dead&&!foe.dead&&e.tm!==foe.tm&&
  Math.hypot(foe.x-e.x,foe.z-e.z)<=BOT_SENSE.sightRange&&
  los(e.x,e.z,foe.x,foe.z));
}
function botIntelObserve(e,foe){
 if(!botIntelVisible(e,foe))return false;
 // Capture coordinates at observation time; do not retain enemy object pointers.
 var report={x:foe.x,z:foe.z,seenAt:tt,until:tt+BOT_SENSE.memorySeconds,
  source:'sight',team:e.tm,observer:e.idx};
 e.lastSeen=report;
 var old=botTeamReports[e.tm];
 if(!old||old.until<=tt||tt-old.seenAt>=BOT_SENSE.radioInterval||
    Math.hypot(old.x-report.x,old.z-report.z)>2){
  botTeamReports[e.tm]={x:report.x,z:report.z,seenAt:tt,
   until:tt+BOT_SENSE.radioSeconds,source:'radio',team:e.tm,observer:e.idx};
 }
 return true;
}
function botIntelAcquire(e){
 var target=null,best=Infinity;
 en.forEach(function(o){if(botIntelVisible(e,o)){
  var d=Math.hypot(o.x-e.x,o.z-e.z);if(d<best){best=d;target=o;}
 }});
 if(!pl.dead&&botIntelVisible(e,pl)){
  var dist=Math.hypot(pl.x-e.x,pl.z-e.z);
  if(dist<best)target=pl;
 }
 if(target)botIntelObserve(e,target);
 return target;
}
function botSoundEmit(actor,kind){
 if(!actor||actor.dead||!run||lob||mt.over||mt.cd>0||
    (kind!=='footstep'&&kind!=='gunshot'))return;
 // Only auditory evidence: no actor reference, identity, HP, target or enemy pointer.
 var item={x:actor.x,z:actor.z,at:tt,until:tt+BOT_SENSE.soundSeconds,
  kind:kind,team:actor.tm};
 botSoundEvents.push(item);
 if(botSoundEvents.length>BOT_SENSE.maxSounds)botSoundEvents.shift();
}
function botIntelHearing(e){
 if(!e||e.dead)return null;
 var current=e.heard,nearest=null,weight=Infinity;
 for(var i=botSoundEvents.length-1;i>=0;i--){
  var a=botSoundEvents[i];
  if(a.until<=tt)continue;
  // Ignore allied sounds; team membership can be inferred from known squad roster,
  // but never expose which individual produced an enemy noise.
  if(a.team===e.tm)continue;
  var d=Math.hypot(e.x-a.x,e.z-a.z),max=a.kind==='gunshot'?
    BOT_SENSE.gunshotRange:BOT_SENSE.footstepRange;
  // Walls attenuate hearing but never create perfect visual intel.
  if(d>max||d>max*(los(e.x,e.z,a.x,a.z)?1:.6))continue;
  var score=d+(tt-a.at)*3;
  if(score<weight){weight=score;nearest=a;}
 }
 if(nearest&&(!current||current.until<=tt||nearest.at>current.heardAt)){
  // Coarse-grid localization is intentionally not exact (no through-wall tracking).
  var grid=BOT_SENSE.auditoryUncertainty;
  e.heard={x:Math.round(nearest.x/grid)*grid,
   z:Math.round(nearest.z/grid)*grid,heardAt:nearest.at,
   until:Math.min(nearest.until,tt+BOT_SENSE.soundSeconds),
   source:'sound',kind:nearest.kind};
 }
 return e.heard&&e.heard.until>tt?e.heard:null;
}
function botIntelKnown(e){
 if(!e||e.dead)return null;
 var own=e.lastSeen&&e.lastSeen.until>tt?e.lastSeen:null,
     team=botTeamReports[e.tm],shared=team&&team.until>tt?team:null;
 // Hearing cannot replace a fresh, confirmed sighting or become a shootable target.
 return own||shared||(e.heard&&e.heard.until>tt?e.heard:null);
}
function botIntelNearest(e,x,z,radius){
 if(!e||e.dead)return null;
 // Evidence is immutable positional snapshots. It must never be a live enemy actor.
 var own=e.lastSeen&&e.lastSeen.until>tt?e.lastSeen:null,
     shared=botTeamReports[e.tm],radio=shared&&shared.until>tt?shared:null,
     sound=e.heard&&e.heard.until>tt?e.heard:null,
     best=null,distance=radius;
 [own,radio,sound].forEach(function(q){
  if(!q)return;
  var d=Math.hypot(q.x-x,q.z-z);
  if(d<distance){best=q;distance=d;}
 });
 return best;
}
