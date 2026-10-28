// Bomb Mission third-person chase camera. Renders teammates' entire visible character.
var SPECTATOR_CAMERA=Object.freeze({
  followDistance:5.2,height:2.75,targetHeight:1.05,
  collisionRadius:.34,step:.18,minDistance:1.05,followSmoothing:11,fieldOfView:63
});
var spectatorCameraLast=null;
function bombResetSpectatorCamera(){spectatorCameraLast=null;}
function bombSpectatorCamera(dt){
  var target=bombSpectatorTarget();if(!target){
    C.position.set(pl.x,2.5+pl.y,pl.z);C.lookAt(pl.x,1+pl.y,pl.z+3);return;
  }
  var c=SPECTATOR_CAMERA,y=target.y||0,face=target.g.rotation.y,sx=Math.sin(face),sz=Math.cos(face);
  // Follow from behind the character, ray-testing the wall so the view never clips.
  var cameraDist=c.followDistance;
  for(var d=c.step;d<=c.followDistance;d+=c.step){
    var testY=y+c.targetHeight+(c.height-c.targetHeight)*d/c.followDistance;
    if(inObs(target.x-sx*d,target.z-sz*d,c.collisionRadius,testY)){
      cameraDist=Math.max(c.minDistance,d-c.step*2);break;
    }
  }
  var x=target.x-sx*cameraDist,z=target.z-sz*cameraDist;
  var dest=new T.Vector3(x,y+c.height,z);
  if(spectatorCameraLast!==target){C.position.copy(dest);spectatorCameraLast=target;}
  else C.position.lerp(dest,Math.min(1,dt*c.followSmoothing));
  C.lookAt(target.x,y+c.targetHeight,target.z);
}
