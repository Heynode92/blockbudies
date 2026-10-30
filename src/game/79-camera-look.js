// Global first-person camera input (shared by Deathmatch and Bomb Mission).
// Browser pointer lock can emit discontinuous movementX/Y values. Reject anomalous
// individual events instead of letting one bad event rotate the view backwards.
var LOOK_CONFIG={
  sensitivity:.003,             // Original desktop mouse sensitivity (unchanged).
  sniperAdsReduction:.82,       // Original AWP ADS multiplier (unchanged).
  otherAdsReduction:.5,        // Original non-AWP ADS multiplier (unchanged).
  maxMouseDeltaPerEvent:200     // Pixels; discard impossible jumps, not normal aim.
};
var lookDragPoint=null,lookSkipLockedMove=false;
function lookStartDrag(e){
  if(e.pointerType!=="mouse"||document.pointerLockElement===R.domElement)return;
  if(Number.isFinite(e.clientX)&&Number.isFinite(e.clientY))lookDragPoint={x:e.clientX,y:e.clientY};
}
function lookStopDrag(){lookDragPoint=null;}
function lookLockChanged(){
  lookStopDrag();
  // The first relative movement can contain a cursor-warp delta after lock acquisition.
  lookSkipLockedMove=document.pointerLockElement===R.domElement;
}
function lookMove(e){
  if(e.pointerType!=="mouse"||!run||lob||mt.over||!pl||pl.dead||
     (typeof wsOn!=="undefined"&&wsOn))return;
  var locked=document.pointerLockElement===R.domElement,dragging=!!(e.buttons&1),dx,dy;
  if(!locked&&!dragging){lookStopDrag();return;}
  if(locked){
    if(lookSkipLockedMove){lookSkipLockedMove=false;return;}
    dx=e.movementX;dy=e.movementY;
  }else{
    // Screen coordinates are stable during unlocked click-and-drag; movementX/Y
    // can jump when the browser switches between locked and unlocked pointers.
    if(!lookDragPoint){lookStartDrag(e);return;}
    dx=e.clientX-lookDragPoint.x;dy=e.clientY-lookDragPoint.y;
    lookStartDrag(e);
  }
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||
      Math.abs(dx)>LOOK_CONFIG.maxMouseDeltaPerEvent||
      Math.abs(dy)>LOOK_CONFIG.maxMouseDeltaPerEvent)return;
  var sn=LOOK_CONFIG.sensitivity*(1-(pl.w===8?LOOK_CONFIG.sniperAdsReduction:LOOK_CONFIG.otherAdsReduction)*adsT);
  pl.face-=dx*sn;
  pl.pitch=Math.max(-1.2,Math.min(1.2,pl.pitch-dy*sn));
}
