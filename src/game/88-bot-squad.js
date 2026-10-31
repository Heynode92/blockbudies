// M4 — deterministic squad roles, legitimate shared-contact flank lanes and bounded entry synchronization.
// All enemy coordinates originate only from M1 timestamped, same-team sight/radio snapshots.
// No hidden enemy scan, forced hits, direct-wall movement or Bomb objective overrides.
var BOT_SQUAD=Object.freeze({
 thinkSeconds:1.05,goalSeconds:2.0,flankRadius:5.5,supportRadius:4.2,
 goalReach:1.3,contactRange:33,allyGoalSpacing:2.0,
 laneRadius:2.35,laneStrength:.26,
 entryWaitMax:.34,entryNearMin:5,entryNearMax:13
});
function botSquadReset(e){
 e.squadRole=null;e.squadGoal=null;e.squadUntil=0;
 e.squadRetryAt=0;e.squadReportAt=-1;
 e.squadEntryWaitUntil=0;e.squadEntryCooldownUntil=0;
}
function botSquadRoster(team){
 // This roster reveals only friendly public positions and survival, no enemy identity.
 return en.filter(function(o){return o&&!o.dead&&o.tm===team;})
   .sort(function(a,b){return a.idx-b.idx;});
}
function botSquadRole(e){
 var allies=botSquadRoster(e.tm),rank=allies.indexOf(e);
 if(rank<0)return null;
 return ['entry','flank-left','flank-right','support'][rank%4];
}
function botSquadReport(e){
 var r=botTeamReports[e.tm];
 // M1 alone owns this report. Team, source and expiry are mandatory, not inferred.
 if(!r||r.team!==e.tm||r.source!=='radio'||r.until<=tt||
    !Number.isFinite(r.x)||!Number.isFinite(r.z)||!Number.isFinite(r.seenAt))
   return null;
 return r;
}
function botSquadCanFlank(e){
 if(isBombMode()){
  // Bomb authority remains in bombTacticalGoal: planted defense, escort,
  // recovery, carrier, retake and defuse are not overwritten by a squad move.
  return false;
 }
 return true;
}
function botSquadFlankPoint(e,role,r){
 var dx=r.x-e.x,dz=r.z-e.z,dist=Math.hypot(dx,dz);
 if(dist<2||dist>BOT_SQUAD.contactRange)return null;
 var ux=dx/dist,uz=dz/dist,lx=uz,lz=-ux,
     x,z;
 if(role==='flank-left'){
  x=r.x+lx*BOT_SQUAD.flankRadius-ux*2.2;
  z=r.z+lz*BOT_SQUAD.flankRadius-uz*2.2;
 }else if(role==='flank-right'){
  x=r.x-lx*BOT_SQUAD.flankRadius-ux*2.2;
  z=r.z-lz*BOT_SQUAD.flankRadius-uz*2.2;
 }else if(role==='support'){
  x=r.x-ux*BOT_SQUAD.supportRadius;
  z=r.z-uz*BOT_SQUAD.supportRadius;
 }else return null;
 if(!Number.isFinite(x)||!Number.isFinite(z)||
    Math.abs(x)>=A-1.8||Math.abs(z)>=A-1.8||
    inObs(x,z,.72))return null;
 // Reserve separate safe lanes; never send different bots to one flank waypoint.
 for(var i=0;i<en.length;i++){
  var ally=en[i];
  if(ally===e||ally.dead||ally.tm!==e.tm||!ally.squadGoal||
     ally.squadUntil<=tt)continue;
  if(Math.hypot(x-ally.squadGoal[0],z-ally.squadGoal[1])<
       BOT_SQUAD.allyGoalSpacing)return null;
 }
 // Exactly one bounded A* check per fresh candidate, throttled by squadRetryAt.
 return botMoveReachable(e,x,z)?[x,z]:null;
}
function botSquadIntent(e,target,intent){
 if(!e||e.dead)return;
 e.squadRole=botSquadRole(e);
 if(!e.squadRole)return;
 if(target||intent.retreat||intent.hold||botMoveUrgent(e)||
    e.m3Mode||!botSquadCanFlank(e)){
  e.squadGoal=null;e.squadUntil=0;return;
 }
 var report=botSquadReport(e),allies=botSquadRoster(e.tm);
 if(!report||allies.length<2){
  e.squadGoal=null;e.squadUntil=0;e.squadEntryWaitUntil=0;return;
 }
 if(e.squadRole==='entry'){
  // Wait only once for a new authentic contact, and NEVER wait indefinitely.
  var dist=Math.hypot(report.x-e.x,report.z-e.z);
  if(tt>=(e.squadEntryCooldownUntil||0)&&allies.length>=3&&
     dist>BOT_SQUAD.entryNearMin&&dist<BOT_SQUAD.entryNearMax){
   e.squadEntryCooldownUntil=tt+4;
   e.squadEntryWaitUntil=Math.min(tt+BOT_SQUAD.entryWaitMax,report.until);
  }
  if(tt<e.squadEntryWaitUntil)intent.hold=true;
  return;
 }
 if(e.squadGoal&&e.squadUntil>tt&&
    Math.hypot(e.x-e.squadGoal[0],e.z-e.squadGoal[1])>BOT_SQUAD.goalReach&&
    Math.hypot(report.x-e.squadAnchorX,report.z-e.squadAnchorZ)<4){
  intent.goal=e.squadGoal;return;
 }
 if(tt<(e.squadRetryAt||0))return;
 e.squadRetryAt=tt+BOT_SQUAD.thinkSeconds;
 e.squadGoal=null;e.squadUntil=0;
 var goal=botSquadFlankPoint(e,e.squadRole,report);
 if(!goal)return; // Fallback to ordinary M1/M3 navigation, never freeze.
 e.squadGoal=goal;e.squadReportAt=report.seenAt;
 e.squadAnchorX=report.x;e.squadAnchorZ=report.z;
 e.squadUntil=Math.min(report.until,tt+BOT_SQUAD.goalSeconds);
 intent.goal=goal;
}
function botSquadLane(e,vx,vz){
 if(!e||e.dead||botMoveUrgent(e)||(!vx&&!vz))return[vx,vz];
 var len=Math.hypot(vx,vz),ux=vx/len,uz=vz/len,
     rx=0,rz=0,rank=botSquadRoster(e.tm).indexOf(e),side=rank%2?1:-1;
 if(rank<0)return[vx,vz];
 for(var i=0;i<en.length;i++){
  var ally=en[i];
  if(!ally||ally===e||ally.dead||ally.tm!==e.tm)continue;
  var dx=ally.x-e.x,dz=ally.z-e.z,d=Math.hypot(dx,dz);
  // Only divert if a friendly actually occupies the next forward lane.
  if(d>.2&&d<BOT_SQUAD.laneRadius&&(dx*ux+dz*uz)/d>.3){
   rx+=uz*side*BOT_SQUAD.laneStrength;
   rz-=ux*side*BOT_SQUAD.laneStrength;
  }
 }
 var ax=vx+rx,az=vz+rz,n=Math.hypot(ax,az);
 return n>1?[ax/n,az/n]:[ax,az];
}
