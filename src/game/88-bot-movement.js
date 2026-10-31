// M3 movement tactics: bounded cover, legal last-seen peeks, dodge and obstacle recovery.
// Uses existing A* (gPath), solid geometry (inObs), canonical resolve(), and M1 clues.
// Does not teleport or inspect hidden enemy actor positions.
var BOT_MOVE=Object.freeze({
 coverTriggerHP:70,coverRetry:2.8,coverTravel:3.6,holdSeconds:.38,
 peekTravel:2.3,peekRetry:2.1,peekOffsets:[1.9,3.1,4.3],
 dodgeWindow:.32,dodgeCooldown:1.4,dodgeStrength:.85,
 velocityBlend:9,probeSeconds:.32,probeRadius:.62,
 stuckAfter:.52,recoverSeconds:.55,recoverCooldown:1.05,
 maxStallCycles:3
});
function botMoveReset(e){
 e.m3Mode=null;e.m3Goal=null;e.m3Expires=0;e.m3RetryAt=0;
 e.m3DodgeUntil=0;e.m3DodgeAt=0;e.m3DodgeSide=0;
 e.m3RecoverUntil=0;e.m3RecoverAt=0;e.m3RecoverSide=0;
 e.m3StallCycles=0;e.m3VX=0;e.m3VZ=0;
}
function botMoveUrgent(e){
 // No new peek/cover maneuver may prevent planting, defusing or urgent retake.
 return !!(e.bAction||(isBombMode()&&bombMatch&&!bombMatch.done&&
  (bombMatch.state==='planted'&&e.tm===0||
   bombMatch.state==='idle'&&bombMatch.carrier===e)));
}
function botMoveReachable(e,x,z){
 if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>A-1.5||
    Math.abs(z)>A-1.5||inObs(x,z,.72))return false;
 var p=gPath(e.x,e.z,x,z);
 return !!(p&&p.length);
}
function botMovePeek(e,clue){
 if(!clue||clue.until<=tt)return null;
 var dx=clue.x-e.x,dz=clue.z-e.z,dist=Math.hypot(dx,dz);
 if(dist<1||dist>BOT_TACTICS.threatRange*1.5)return null;
 // Sample lateral edges from the last AUTHORIZED observed position only.
 var sideX=dz/dist,sideZ=-dx/dist,best=null,bestScore=Infinity;
 for(var i=0;i<BOT_MOVE.peekOffsets.length;i++)
 for(var sign=-1;sign<=1;sign+=2){
  var offset=BOT_MOVE.peekOffsets[i]*sign,
      x=e.x+sideX*offset,z=e.z+sideZ*offset;
  if(Math.abs(x)>A-1.5||Math.abs(z)>A-1.5||
     inObs(x,z,.72)||!los(x,z,clue.x,clue.z))continue;
  // Avoid occupied lanes and repeated exposure if a shorter safe edge exists.
  var score=Math.abs(offset)+Math.hypot(x-e.x,z-e.z)*.2;
  for(var j=0;j<en.length;j++){
   var ally=en[j];
   if(ally!==e&&!ally.dead&&ally.tm===e.tm&&
      Math.hypot(x-ally.x,z-ally.z)<1.8)score+=6;
  }
  if(score<bestScore&&botMoveReachable(e,x,z)){
   best=[x,z];bestScore=score;
  }
 }
 return best;
}
function botMoveIntent(e,t,intent){
 if(e.dead||botMoveUrgent(e)||intent.retreat){
  e.m3Mode=null;e.m3Goal=null;return;
 }
 if(e.m3Mode&&tt>(e.m3Expires||0)){
  e.m3Mode=null;e.m3Goal=null;e.m3RetryAt=Math.max(e.m3RetryAt||0,tt+.7);
 }
 if(e.m3Mode==='cover'&&e.m3Goal){
  if(Math.hypot(e.x-e.m3Goal[0],e.z-e.m3Goal[1])<1.15){
   e.m3Mode='hold';e.m3Expires=tt+BOT_MOVE.holdSeconds;
   e.m3Goal=null;
  }else{
   intent.goal=e.m3Goal;return;
  }
 }
 if(e.m3Mode==='hold'){
  if(tt<e.m3Expires){intent.hold=true;return;}
  e.m3Mode='peeking';e.m3Goal=null;e.m3Expires=tt+BOT_MOVE.peekTravel;
 }
 if(e.m3Mode==='peeking'){
  if(t){e.m3Mode=null;e.m3Goal=null;return;} // resume combat on fresh sight
  if(!e.m3Goal){
   var clue=botIntelKnown(e);
   e.m3Goal=botMovePeek(e,clue);
   if(!e.m3Goal){e.m3Mode=null;e.m3RetryAt=tt+BOT_MOVE.peekRetry;return;}
  }
  if(Math.hypot(e.x-e.m3Goal[0],e.z-e.m3Goal[1])<.9){
   e.m3Mode=null;e.m3Goal=null;e.m3RetryAt=tt+BOT_MOVE.peekRetry;
  }else{intent.goal=e.m3Goal;return;}
 }
 if(!t||!botIntelVisible(e,t)||tt<(e.m3RetryAt||0)||
    e.hp<=BOT_TACTICS.criticalHP)return;
 // Only under actual recent damage; do not become passive in every engagement.
 if(e.fl>.035&&e.hp<BOT_MOVE.coverTriggerHP){
  e.m3RetryAt=tt+BOT_MOVE.coverRetry;
  var cover=botSmartCover(e,t);
  if(cover&&botMoveReachable(e,cover[0],cover[1])){
   e.m3Goal=[cover[0],cover[1]];
   e.m3Mode='cover';e.m3Expires=tt+BOT_MOVE.coverTravel;
   intent.goal=e.m3Goal;
  }
 }
}
function botMoveDodge(e,t,dt,fw,strafe){
 if(!t||!botIntelVisible(e,t)||botMoveUrgent(e)||
    e.hp<=BOT_TACTICS.criticalHP)return [fw,strafe];
 if(e.fl>.025&&tt>=(e.m3DodgeAt||0)){
  e.m3DodgeAt=tt+BOT_MOVE.dodgeCooldown;
  e.m3DodgeUntil=tt+BOT_MOVE.dodgeWindow;
  e.m3DodgeSide=(e.idx%2===0?1:-1)*
    ((Math.floor(tt*2)%2)===0?1:-1);
 }
 if(tt<(e.m3DodgeUntil||0))
  strafe+=e.m3DodgeSide*BOT_MOVE.dodgeStrength;
 return [fw,strafe];
}
function botMoveIsClear(e,vx,vz,sp,dt){
 if(!vx&&!vz)return true;
 var length=Math.max(.22,sp*Math.min(BOT_MOVE.probeSeconds,dt*3)),
     x=e.x+vx*length,z=e.z+vz*length;
 return Math.abs(x)<A-.8&&Math.abs(z)<A-.8&&!inObs(x,z,BOT_MOVE.probeRadius);
}
function botMoveSteer(e,vx,vz,sp,dt,hold){
 if(hold){e.m3VX=e.m3VZ=0;return [0,0];}
 // Smooth decisions without modifying player movement or BOT max speed.
 var blend=Math.min(1,Math.max(0,dt)*BOT_MOVE.velocityBlend);
 e.m3VX=(e.m3VX||0)+(vx-(e.m3VX||0))*blend;
 e.m3VZ=(e.m3VZ||0)+(vz-(e.m3VZ||0))*blend;
 var norm=Math.hypot(e.m3VX,e.m3VZ);
 if(norm>1){e.m3VX/=norm;e.m3VZ/=norm;}
 vx=e.m3VX;vz=e.m3VZ;
 if(botMoveIsClear(e,vx,vz,sp,dt))return [vx,vz];
 // Slide along a legal axis. No manual position write or collision bypass.
 if(Math.abs(vx)>=Math.abs(vz)){
  if(botMoveIsClear(e,vx,0,sp,dt)){e.m3VZ=0;return [vx,0];}
  if(botMoveIsClear(e,0,vz,sp,dt)){e.m3VX=0;return [0,vz];}
 }else{
  if(botMoveIsClear(e,0,vz,sp,dt)){e.m3VX=0;return [0,vz];}
  if(botMoveIsClear(e,vx,0,sp,dt)){e.m3VZ=0;return [vx,0];}
 }
 e.m3VX=e.m3VZ=0;
 return [0,0];
}
function botMoveTrack(e,ox,oz,dt,sp,wanted,combat){
 if(!wanted){e.stk=0;e.m3StallCycles=0;return;}
 var moved=Math.hypot(e.x-ox,e.z-oz);
 if(moved>=Math.max(.003,sp*dt*.22)){
  e.stk=0;e.m3StallCycles=0;return;
 }
 e.stk=(e.stk||0)+dt;
 if(e.stk<BOT_MOVE.stuckAfter||tt<(e.m3RecoverAt||0))return;
 e.stk=0;e.m3StallCycles=Math.min(BOT_MOVE.maxStallCycles,
    (e.m3StallCycles||0)+1);
 e.m3RecoverAt=tt+BOT_MOVE.recoverCooldown;
 e.m3RecoverUntil=tt+BOT_MOVE.recoverSeconds;
 e.m3RecoverSide=((e.idx+e.m3StallCycles)%2)?1:-1;
 e.pt=0;e.navT=combat?.55:0;
 if(e.m3StallCycles>=BOT_MOVE.maxStallCycles){
  e.m3Mode=null;e.m3Goal=null;e.m3RetryAt=tt+BOT_MOVE.coverRetry;
 }
}
function botMoveRecovery(e,vx,vz,sp,dt,hold){
 if(hold||tt>=(e.m3RecoverUntil||0))return [vx,vz];
 var side=e.m3RecoverSide||1;
 var sx=-vz*side,sz=vx*side;
 if(Math.hypot(sx,sz)<.1){
  sx=side;sz=0;
 }
 var n=Math.hypot(sx,sz)||1;
 sx/=n;sz/=n;
 if(botMoveIsClear(e,sx,sz,sp,dt))
  return [sx*.75,sz*.75];
 if(botMoveIsClear(e,-sx,-sz,sp,dt))
  return [-sx*.75,-sz*.75];
 return [0,0];
}
