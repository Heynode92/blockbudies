// Bomb Mission tactical director. Every position and behavior is local to Bomb Mode.
var BOMB_AI=Object.freeze({
  engagementRange:26,urgentThreatRange:6,coverRadius:11,roamRadius:23,
  destinationRefresh:6,defuserReview:.75,defusePriorityRadius:4,
  teammateSpacing:2.5,repathGoalDistance:2.4,navSpeed:5.3,
  retakeThreatRadius:34,retakeSeekRadius:36,retakeSweepRadius:4,retakeSweepStep:3,
  retakeCombatDistance:5,
  soloDefuseThreatRadius:18,plantClearRadius:13,plantEngageRange:19,
  huntedEnemyRange:160
});
function bombLiving(team){return en.filter(function(e){return e.tm===team&&!e.dead;}).concat(!pl.dead&&pl.tm===team?[pl]:[]);}
function bombNearestOpponent(e){var foes=bombLiving(1-e.tm),best=null,dist=Infinity;
  foes.forEach(function(f){var d=Math.hypot(f.x-e.x,f.z-e.z);if(d<dist){dist=d;best=f;}});
  return best;
}
// Threat assessment uses living enemy positions but does not allow firing through
// geometry: normal shooting remains protected by the original LOS check.
function bombNearestThreat(team,x,z,radius){var best=null,distance=radius;
  bombLiving(1-team).forEach(function(foe){var d=Math.hypot(foe.x-x,foe.z-z);
    if(d<distance){best=foe;distance=d;}});
  return best;
}
function bombSoloPoliceThreat(e){
  if(!bombMatch||bombMatch.done||bombMatch.state!=='planted'||e.tm!==0||
      bombLiving(0).length!==1)return null;
  var p=bombMatch.device.position;
  return bombNearestThreat(0,p.x,p.z,BOMB_AI.soloDefuseThreatRadius);
}
function bombPlantThreat(e){
  if(!bombMatch||bombMatch.done||bombMatch.state!=='idle'||e.tm!==1)return null;
  // Threats in the plant site or close enough to engage the carrier must be cleared.
  var near=bombNearestThreat(1,e.x,e.z,BOMB_AI.plantEngageRange),site=bombArea(e);
  if(site>=0){var s=BOMB_SITES[site],atSite=bombNearestThreat(1,s.x,s.z,BOMB_AI.plantClearRadius);
    if(atSite)return atSite;}
  return near;
}
function bombPickDefuser(){
  if(!bombMatch||bombMatch.done||bombMatch.state!=='planted')return null;
  var b=bombMatch,team=bombLiving(0),current=b.defuser;
  // A sole surviving officer clears a nearby Terrorist before risking the 7s defuse.
  if(team.length===1&&team[0]!==pl&&bombSoloPoliceThreat(team[0])){
    b.defuser=null;return null;
  }
  // A human who is merely standing near the bomb must not block bot defuse attempts.
  var humansDefusing=!pl.dead&&pl.tm===0&&pl.bAction&&pl.bAction.type==='defuse';
  if(humansDefusing){b.defuser=pl;return pl;}
  var botOptions=team.filter(function(e){return e!==pl;});
  if(botOptions.length)team=botOptions;
  if(current&&!current.dead&&team.indexOf(current)>=0)return current;
  var target=b.device.position;
  team.sort(function(a,c){return Math.hypot(a.x-target.x,a.z-target.z)-Math.hypot(c.x-target.x,c.z-target.z);});
  b.defuser=team[0]||null;return b.defuser;
}
function bombTacticalStage(e){
  if(!bombMatch||bombMatch.done)return 'none';
  var b=bombMatch;
  if(b.state==='planted'){
    if(e.tm===0)return bombPickDefuser()===e?'retake-defuse':'retake-assault';
    // A lone survivor cannot simply camp a random cover point: find and fight CTs.
    if(bombLiving(1).length===1)return 'hunt';
    return e.idx%3===0?'hold':'hunt';
  }
  if(e.tm===0)return e.idx%3===0?'patrol':'site-defense';
  if(e===b.carrier)return bombPlantThreat(e)?'clear':'plant';
  return e.idx%3===0?'hunt':'escort';
}
// Compute a reachable tactical candidate rather than stacking all bots on a single site.
function bombSafeGoal(x,z,e){
  var min=-A+2,max=A-2;x=Math.max(min,Math.min(max,x));z=Math.max(min,Math.min(max,z));
  if(!inObs(x,z,.85))return[x,z];
  for(var radius=2;radius<=9;radius+=1.5)for(var j=0;j<12;j++){
    var angle=j*Math.PI/6+(e.idx||0)*.25,nx=x+Math.cos(angle)*radius,nz=z+Math.sin(angle)*radius;
    if(!inObs(nx,nz,.85))return[nx,nz];
  }
  return[e.x,e.z];
}
function bombStrategicSite(e){
  if(e.siteChoice===undefined){var round=bombMatch?bombMatch.round:1;e.siteChoice=(e.idx+round+(e.tm?1:0))%BOMB_SITES.length;}
  return BOMB_SITES[e.siteChoice];
}
function bombTacticalGoal(e){
  var b=bombMatch;if(!b||b.done)return null;
  var stage=bombTacticalStage(e),site,phase=Math.floor(tt/BOMB_AI.destinationRefresh),idx=e.idx||0,
    angle=((idx*3+phase%4)*Math.PI/4),radius=BOMB_AI.coverRadius,foe;
  if(b.state==='planted'){
    site=BOMB_SITES[b.site];
    if(stage==='retake-defuse')return bombSafeGoal(b.device.position.x,b.device.position.z,e);
    if(stage==='retake-assault'){
      // When alone against a nearby defender, clear the threat before defusing.
      foe=bombSoloPoliceThreat(e);
      if(foe)return bombSafeGoal(foe.x,foe.z,e);
      // Every available officer retakes the PLANTED site; no guarding the other site
      // and no static camping at distant cover points while the fuse is ticking.
      foe=bombNearestOpponent(e);
      if(foe&&Math.hypot(foe.x-site.x,foe.z-site.z)<BOMB_AI.retakeThreatRadius&&
          Math.hypot(foe.x-e.x,foe.z-e.z)<BOMB_AI.retakeSeekRadius){
        return bombSafeGoal(foe.x,foe.z,e);
      }
      // Stagger the final sweep so squadmates enter from different angles.
      radius=BOMB_AI.retakeSweepRadius;
      angle=(idx*2+Math.floor(tt/BOMB_AI.retakeSweepStep))*Math.PI/4;
      return bombSafeGoal(b.device.position.x+Math.cos(angle)*radius,
        b.device.position.z+Math.sin(angle)*radius,e);
    }
    if(stage==='hunt'){
      foe=bombNearestOpponent(e);
      if(foe&&(bombLiving(1).length===1||Math.hypot(foe.x-site.x,foe.z-site.z)<BOMB_AI.roamRadius))
        return bombSafeGoal(foe.x,foe.z,e);
      radius=11+idx%3*4;
    }else radius=5+idx%3*2;
    return bombSafeGoal(site.x+Math.cos(angle)*radius,site.z+Math.sin(angle)*radius,e);
  }
  if(e.tm===1){
    if(b.dropped)return bombSafeGoal(b.dropped.x,b.dropped.z,e);
    var carrier=b.carrier;
    if(stage==='plant'){
      site=bombStrategicSite(e);
      // Enter the center of the site to trigger the actual planting interaction.
      return bombSafeGoal(site.x,site.z,e);
    }
    if(stage==='clear'){
      foe=bombPlantThreat(e);
      if(foe)return bombSafeGoal(foe.x,foe.z,e);
    }
    if(stage==='hunt'){
      foe=bombNearestOpponent(e);
      if(foe)return bombSafeGoal(foe.x,foe.z,e);
    }
    if(carrier){
      // Move with the carrier using different flanking lanes; no identical objectives.
      var bearing=Math.atan2(carrier.x-e.x,carrier.z-e.z);
      angle=bearing+(idx%2?1:-1)*Math.PI/2;
      radius=5+idx%3*2;
      var cx=carrier.x+Math.sin(angle)*radius,cz=carrier.z+Math.cos(angle)*radius;
      return bombSafeGoal(cx,cz,e);
    }
  }
  site=bombStrategicSite(e);
  if(stage==='patrol'){
    // Roam the middle between sites, occasionally reinforce a side.
    var p=(phase+idx)%4;
    return bombSafeGoal(p===0?site.x:p===1?-site.x:0,p===2?site.z:-site.z,e);
  }
  // Site anchors move between actual covering positions, not the planting center.
  angle=(idx*2+phase%3)*Math.PI/4;
  return bombSafeGoal(site.x+Math.cos(angle)*8,site.z+Math.sin(angle)*8,e);
}
function bombBotWantsObjective(e,t){
  if(!isBombMode()||!bombMatch||bombMatch.done)return false;
  if(e.bAction)return true;
  var role=bombTacticalStage(e);
  if(role==='retake-defuse'||role==='plant'){
    // Do not abandon the objective for distant gunfire; fight close threats normally.
    return !t||Math.hypot(t.x-e.x,t.z-e.z)>BOMB_AI.urgentThreatRange;
  }
  return false;
}
function bombBotCanAct(e){
  var a=bombActionFor(e);if(!a)return false;
  if(a.type==='defuse'&&bombPickDefuser()!==e)return false;
  if(a.type==='plant'&&(bombPlantThreat(e)||tt<(e.bHitUntil||0)))return false;
  if(e.tg&&e.lok&&Math.hypot(e.tg.x-e.x,e.tg.z-e.z)<BOMB_AI.defusePriorityRadius)return false;
  return true;
}
