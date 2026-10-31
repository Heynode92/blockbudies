// M5 Bomb Mission tactical intelligence. Decisions only: never alter Bomb rules,
// plant/defuse progress, fuse/scoring, weapon damage, or hidden opponent coordinates.
var BOMB_M5=Object.freeze({
 siteThreatRadius:14,siteSwitchCooldown:9,maxSiteSwitches:1,
 lateFuseMargin:2.5,postPlantHoldSeconds:3.2,
 postPlantRadii:[5.5,7.5,6.5,8],
 supportRadius:1.7,safeGoalSpacing:1.8,
 navCheckMax:1
});
function bombM5Reset(e){
 if(!e)return;
 e.m5Round=0;e.m5Switches=0;e.m5SwitchAt=0;
 e.m5Goal=null;e.m5GoalUntil=0;e.m5GoalStage='';
}
function bombM5Round(e){
 if(!bombMatch||!e)return;
 if(e.m5Round!==bombMatch.round){
  bombM5Reset(e);e.m5Round=bombMatch.round;
 }
}
// M1 provenance only: audible hints aren't a verified guard at a particular site.
function bombM5Contact(e){
 if(!e||e.dead||typeof botIntelKnown!=='function')return null;
 var seen=botIntelKnown(e);
 return seen&&(seen.source==='sight'||seen.source==='radio')&&
    seen.until>tt&&seen.team===e.tm&&
    Number.isFinite(seen.x)&&Number.isFinite(seen.z)?seen:null;
}
function bombM5ChooseSite(e){
 if(!e||e.dead||e.tm!==1||!bombMatch||bombMatch.done||
    bombMatch.state!=='idle'||bombMatch.carrier!==e||
    bombMatch.dropped||e.bAction)return;
 bombM5Round(e);
 if(e.siteChoice===undefined||e.m5Switches>=BOMB_M5.maxSiteSwitches||
    tt<(e.m5SwitchAt||0)||BOMB_SITES.length<2)return;
 var contact=bombM5Contact(e);
 if(!contact)return;
 var origin=BOMB_SITES[e.siteChoice],risk=Math.hypot(contact.x-origin.x,contact.z-origin.z);
 if(risk>BOMB_M5.siteThreatRadius)return;
 var selected=e.siteChoice,best=Infinity;
 for(var i=0;i<BOMB_SITES.length;i++){
  if(i===e.siteChoice)continue;
  var site=BOMB_SITES[i],threatDist=Math.hypot(contact.x-site.x,contact.z-site.z);
  if(threatDist<=BOMB_M5.siteThreatRadius*1.35)continue;
  if(typeof botMoveReachable!=='function'||!botMoveReachable(e,site.x,site.z))continue;
  var dist=Math.hypot(e.x-site.x,e.z-site.z);
  if(dist<best){best=dist;selected=i;}
 }
 if(selected!==e.siteChoice){
  e.siteChoice=selected;e.m5Switches++;
  e.m5SwitchAt=tt+BOMB_M5.siteSwitchCooldown;
 }
}
function bombM5CriticalFuse(){
 return !!(bombMatch&&!bombMatch.done&&bombMatch.state==='planted'&&
  Number.isFinite(bombMatch.fuseLeft)&&
  bombMatch.fuseLeft<=BOMB_RULES.defuseSeconds+BOMB_M5.lateFuseMargin);
}
function bombM5SelectDefuser(team,current){
 if(!bombM5CriticalFuse()||!team.length)return null;
 if(current&&!current.dead&&team.indexOf(current)>=0&&current.bAction&&
    current.bAction.type==='defuse')return current;
 var b=bombMatch,p=b.device.position,best=null,score=Infinity;
 team.forEach(function(e){
  if(!e||e.dead||e===pl)return;
  var d=Math.hypot(e.x-p.x,e.z-p.z);
  // A closer living bot can start the original 7-second interaction sooner;
  // never fabricate time reductions, extra speed, or guaranteed success.
  if(d<score){score=d;best=e;}
 });
 return best;
}
function bombM5Recoverer(){
 if(!bombMatch||bombMatch.state!=='idle'||!bombMatch.dropped)return null;
 var p=bombMatch.dropped,best=null,score=Infinity;
 bombLiving(1).forEach(function(e){
  if(e===pl||e.dead)return;
  var dist=Math.hypot(e.x-p.x,e.z-p.z);
  var penalty=e.hp!==undefined&&e.hp<35?2:0;
  var v=dist+penalty;
  if(v<score){score=v;best=e;}
 });
 return best;
}
function bombM5SafePosition(e,x,z){
 if(typeof botMoveReachable!=='function'||!Number.isFinite(x)||!Number.isFinite(z)||
    Math.abs(x)>=A-2||Math.abs(z)>=A-2||inObs(x,z,.85))return null;
 // Defuser and carrier must retain the objective's canonical direct destination.
 var teammates=bombLiving(e.tm);
 for(var j=0;j<teammates.length;j++){
  var ally=teammates[j];
  if(ally===e||ally.dead||!ally.m5Goal||ally.m5GoalUntil<=tt)continue;
  if(Math.hypot(x-ally.m5Goal[0],z-ally.m5Goal[1])<BOMB_M5.safeGoalSpacing)return null;
 }
 return botMoveReachable(e,x,z)?[x,z]:null;
}
function bombM5PostPlantGoal(e,stage){
 if(!e||e.tm!==1||!bombMatch||bombMatch.done||
    bombMatch.state!=='planted'||(stage!=='hold'&&stage!=='intercept')||
    bombLiving(1).length<2||!bombMatch.device)return null;
 bombM5Round(e);
 if(e.m5Goal&&e.m5GoalStage===stage&&e.m5GoalUntil>tt)return e.m5Goal;
 var p=bombMatch.device.position,idx=e.idx||0,contact=bombM5Contact(e);
 // Defenders face different angles, weighting a REAL observed attacker lane.
 // Never read live enemy coordinates or chase expired sound.
 var a=(idx*2+Math.floor(bombMatch.round||1))*(Math.PI/4);
 if(contact&&Math.hypot(contact.x-p.x,contact.z-p.z)<24){
  a=Math.atan2(contact.z-p.z,contact.x-p.x)+(idx%2?.35:-.35);
 }
 var radius=BOMB_M5.postPlantRadii[idx%BOMB_M5.postPlantRadii.length];
 for(var k=0;k<2;k++){
  var theta=a+(k?Math.PI/3:0),x=p.x+Math.cos(theta)*radius,z=p.z+Math.sin(theta)*radius;
  var goal=bombM5SafePosition(e,x,z);
  if(goal){
   e.m5Goal=goal;e.m5GoalUntil=tt+BOMB_M5.postPlantHoldSeconds;
   e.m5GoalStage=stage;return goal;
  }
 }
 e.m5Goal=null;e.m5GoalUntil=0;return null;
}
function bombM5RetakeSupportGoal(e,stage){
 if(!e||e.tm!==0||stage!=='retake-support'||!bombMatch||
    bombMatch.done||bombMatch.state!=='planted'||!bombMatch.device)return null;
 bombM5Round(e);
 if(e.m5Goal&&e.m5GoalStage===stage&&e.m5GoalUntil>tt)return e.m5Goal;
 var p=bombMatch.device.position,i=e.idx||0,angle=(i*2+1)*Math.PI/4;
 for(var k=0;k<2;k++){
  var a=angle+k*Math.PI/2;
  var goal=bombM5SafePosition(e,p.x+Math.cos(a)*BOMB_M5.supportRadius,
                              p.z+Math.sin(a)*BOMB_M5.supportRadius);
  if(goal){
   e.m5Goal=goal;e.m5GoalUntil=tt+Math.min(2,BOMB_M5.postPlantHoldSeconds);
   e.m5GoalStage=stage;return goal;
  }
 }
 return null;
}
