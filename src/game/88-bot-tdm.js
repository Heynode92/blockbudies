// M6 — TDM-only situational threat scoring, class-driven engagement and fair patrol lanes.
// No change to weapons, aim dispersion, projectile damage, spawn points, or Bomb tactics.
var BOT_TDM=Object.freeze({
 thinkSeconds:3.8,maxPatrolChecks:3,spawnMargin:13,
 patrolFraction:.46,patrolLimit:24,patrolArrival:2.3,
 targetHysteresis:3.5,repositionRetry:3.5,searchRange:45,
 bands:Object.freeze({
  shotgun:Object.freeze({min:3.5,near:7,far:12}),
  smg:Object.freeze({min:5,near:10,far:18}),
  dual:Object.freeze({min:4,near:8,far:15}),
  rifle:Object.freeze({min:9,near:17,far:27}),
  sniper:Object.freeze({min:20,near:28,far:42}),
  pistol:Object.freeze({min:6,near:11,far:19})
 })
});
function botTdmReset(e){
 e.tdmRouteAt=0;e.tdmRouteIndex=0;e.tdmRouteGoal=null;
 e.tdmEngagementAt=0;e.tdmContactAt=0;
}
function botTdmWeaponKind(e){
 var weapon=WP[e.weapon]||WP[e.primary];
 return weapon&&weapon.stats&&weapon.stats.kind||'rifle';
}
function botTdmBand(e){
 return BOT_TDM.bands[botTdmWeaponKind(e)]||BOT_TDM.bands.rifle;
}
function botTdmScore(e,foe){
 if(!botIntelVisible(e,foe))return Infinity;
 var distance=Math.hypot(foe.x-e.x,foe.z-e.z),
     band=botTdmBand(e),
     score=distance;
 // A visible enemy with spawn protection is not a preferred target.
 if((foe.inv||0)>0)return Infinity;
 // A currently visible, wounded opponent is a sensible finishing target,
 // without revealing unknown enemy health to the squad.
 if(Number.isFinite(foe.hp)&&foe.hp>0&&foe.hp<40)score-=2;
 // Avoid keeping a shotgun BOT focused on an extreme-range target when an
 // equally visible closer threat exists. No fire-range/stat modification.
 if(distance>band.far)score+=(distance-band.far)*.45;
 // Minor hysteresis prevents instant target swapping in 5v5 encounters.
 if(e.tg===foe)score-=BOT_TDM.targetHysteresis;
 return score;
}
function botTdmAcquire(e){
 if(!e||e.dead||isBombMode())return null;
 var target=null,best=Infinity;
 function consider(o){
  if(!o||o===e||o.dead||o.tm===e.tm)return;
  var score=botTdmScore(e,o);
  if(Number.isFinite(score)&&score<best){best=score;target=o;}
 }
 en.forEach(consider);
 if(!pl.dead)consider(pl);
 // The only authorized target object is one that passes *live* M1 LOS.
 if(target)botIntelObserve(e,target);
 return target;
}
function botTdmCombatMove(e,d,fw,strafe){
 if(isBombMode()||e.dead||e.hp<=BOT_TACTICS.criticalHP||
    e.smartRetreat||botNeedsMelee(e))return [fw,strafe];
 var band=botTdmBand(e);
 if(d>band.far)fw=1.08;
 else if(d>band.near)fw=.55;
 else if(d<band.min)fw=-.85;
 else fw=Math.max(-.22,Math.min(.24,fw));
 // No movement-speed modification. M3 handles genuine dodge/collision.
 return [fw,strafe];
}
function botTdmPatrolGoal(e){
 if(!e||e.dead||isBombMode())return null;
 var lim=Math.min(BOT_TDM.patrolLimit,Math.max(6,A*BOT_TDM.patrolFraction)),
     side=(e.tm?1:-1),rank=e.idx||0,
     anchors=[[-.8,-.4],[-.3,.7],[.5,-.55],[.9,.4],
       [0,0],[.4,.85],[-.65,.35],[.65,-.15]],
     start=(rank*3+(e.tdmRouteIndex||0))%anchors.length;
 // Anchors stay in central map-control area, outside opponent spawn band
 // (the canonical TDM spawn center is z=+/-38, +/-10 drift).
 for(var i=0;i<BOT_TDM.maxPatrolChecks;i++){
  var a=anchors[(start+i)%anchors.length],
      x=a[0]*lim,z=a[1]*lim*side;
  if(!Number.isFinite(x)||!Number.isFinite(z)||
     Math.abs(x)>A-2||Math.abs(z)>A-2||
     Math.abs(z)>38-BOT_TDM.spawnMargin||inObs(x,z,.72))continue;
  if(botMoveReachable(e,x,z))return [x,z];
 }
 return null;
}
function botTdmPatrol(e){
 if(!e||e.dead||isBombMode())return;
 var fresh=botIntelKnown(e);
 // Valid M1 vision/radio/audio reports are always handled first.
 if(fresh&&fresh.until>tt){e.tdmRouteGoal=null;return;}
 if(!e.tdmRouteGoal&&tt<(e.tdmRouteAt||0))return;
 if(e.tdmRouteGoal&&tt<(e.tdmRouteAt||0)&&
    Math.hypot(e.x-e.tdmRouteGoal[0],e.z-e.tdmRouteGoal[1])>
      BOT_TDM.patrolArrival){
  e.wx=e.tdmRouteGoal[0];e.wz=e.tdmRouteGoal[1];return;
 }
 // One bounded planning pass per route, never every animation frame.
 e.tdmRouteAt=tt+BOT_TDM.thinkSeconds;
 e.tdmRouteIndex=(e.tdmRouteIndex||0)+1;
 var goal=botTdmPatrolGoal(e);
 if(!goal){e.tdmRouteGoal=null;return;}
 e.tdmRouteGoal=goal;e.wx=goal[0];e.wz=goal[1];
}
