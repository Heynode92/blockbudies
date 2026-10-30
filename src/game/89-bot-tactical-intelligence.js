// Five-star BOT decision layer: uses existing A* navigation, LOS, HP,
// canonical weapon ammo, and Bomb Mission objectives. No duplicate combat engine.
var BOT_TACTICS=Object.freeze({
 difficulty:5,thinkInterval:.7,memorySeconds:3.6,criticalHP:34,cautionHP:60,
 coverRadii:[3.5,6,9,12],coverSamples:12,coverHold:1.3,
 retreatSpeed:1.22,approachSpeed:1.2,fightSpeed:.94,
 proactiveReloadFraction:.28,threatRange:24,coverRecheck:1.6
});
function botSmartSight(e,t){return !!(t&&!t.dead&&los(e.x,e.z,t.x,t.z));}
function botSmartRemember(e,t){
 if(botSmartSight(e,t))e.lastSeen={x:t.x,z:t.z,until:tt+BOT_TACTICS.memorySeconds};
}
function botSmartCover(e,threat){
 if(!threat||!GB)return null;
 var saved=e.coverGoal;
 if(saved&&tt<(e.coverExpires||0)&&Math.hypot((e.coverThreatX||0)-threat.x,(e.coverThreatZ||0)-threat.z)<4)return saved;
 var opts=[],radii=BOT_TACTICS.coverRadii,heading=Math.atan2(e.z-threat.z,e.x-threat.x),limit=A-2;
 for(var r=0;r<radii.length;r++)for(var i=0;i<BOT_TACTICS.coverSamples;i++){
  var angle=heading+(i/BOT_TACTICS.coverSamples-.5)*Math.PI*1.7,
      x=e.x+Math.cos(angle)*radii[r],z=e.z+Math.sin(angle)*radii[r];
  if(Math.abs(x)>limit||Math.abs(z)>limit||inObs(x,z,.7)||los(x,z,threat.x,threat.z))continue;
  var score=radii[r]+Math.hypot(x-e.x,z-e.z)*.15;
  for(var j=0;j<en.length;j++){
   var ally=en[j];if(ally!==e&&!ally.dead&&ally.tm===e.tm&&Math.hypot(x-ally.x,z-ally.z)<2.5)score+=7;
  }
  opts.push({x:x,z:z,score:score});
 }
 opts.sort(function(a,b){return a.score-b.score;});
 for(var n=0;n<Math.min(3,opts.length);n++){
  var c=opts[n],path=gPath(e.x,e.z,c.x,c.z);
  if(!path||!path.length)continue;
  e.coverGoal=[c.x,c.z];e.coverExpires=tt+BOT_TACTICS.coverRecheck;
  e.coverThreatX=threat.x;e.coverThreatZ=threat.z;return e.coverGoal;
 }
 e.coverGoal=null;e.coverExpires=tt+.8;return null;
}
function botSmartIntent(e,target){
 var out={retreat:false,goal:null,hold:false},last=e.lastSeen,
     threat=target||(last&&last.until>tt?last:null),
     distance=threat?Math.hypot(threat.x-e.x,threat.z-e.z):Infinity,
     critical=e.hp<=BOT_TACTICS.criticalHP,reloading=e.reloadId!==null,
     urgent=isBombMode()&&bombMatch&&!bombMatch.done&&
       (e.bAction||bombMatch.state==='planted'&&e.tm===0&&bombMatch.defuser===e);
 if(threat&&distance<BOT_TACTICS.threatRange&&(critical||reloading)&&!urgent){
  out.retreat=true;out.goal=botSmartCover(e,threat);
  if(out.goal&&Math.hypot(out.goal[0]-e.x,out.goal[1]-e.z)<1.5){
    out.hold=true;e.coverHoldUntil=tt+BOT_TACTICS.coverHold;
  }
 }else if((e.coverHoldUntil||0)>tt&&!urgent&&!target)out.hold=true;
 if(!out.goal&&!target&&!isBombMode()&&last&&last.until>tt&&!critical)
   out.goal=[last.x,last.z];
 return out;
}
function botSmartVelocity(e,d,fw,strafe){
 if(e.hp<=BOT_TACTICS.criticalHP){fw=-1.05;strafe*=1.35;}
 else if(e.hp<BOT_TACTICS.cautionHP&&d<12)fw=-.75;
 else if(!isBombMode()&&d>11)fw=1.15;
 return[fw,strafe];
}
function botSmartReload(e,target){
 if(e.reloadId!==null||!e.ammo)return;
 var p=e.ammo[e.primary],s=e.ammo[BOT_WEAPONS.sidearm],w=WP[e.primary],
     close=target&&botSmartSight(e,target)&&Math.hypot(target.x-e.x,target.z-e.z)<BOT_TACTICS.threatRange;
 if(p&&p.res>0&&p.mag<w.mag&&
    (p.mag===0||(!close&&p.mag<=Math.max(1,Math.floor(w.mag*BOT_TACTICS.proactiveReloadFraction))))){
  if(botStartReload(e,e.primary)&&close&&s&&s.mag>0){e.weapon=BOT_WEAPONS.sidearm;botVisualWeapon(e,e.weapon);}
 }else if(s&&s.res>0&&s.mag===0&&(!close||!p||p.mag<=0))botStartReload(e,BOT_WEAPONS.sidearm);
}
function botSmartGrenadeSafe(e,target){
 if(!botSmartSight(e,target))return false;
 return !en.concat(pl.dead?[]:[pl]).some(function(a){
  return a!==e&&!a.dead&&a.tm===e.tm&&Math.hypot(a.x-target.x,a.z-target.z)<4.5;
 });
}
