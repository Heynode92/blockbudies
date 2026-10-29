// Global movement rules: speed rating is maximum sprint as a percentage of baseline.
// 100 rating = 100% of baseSpeed when sprinting. Walking is 15% slower
// relative to the sprint speed, so sprint is exactly 15% faster than walk.
// These are project mechanics (not a reverse-engineered Point Blank formula).
var MOVEMENT_RULES=Object.freeze({
  baseSpeed:6.5,
  sprintBonus:.15,
  adsSlowdown:.38
});
// sprintBlend/adsBlend are interpolated 0..1 by the existing input system.
// The heavy-weapon wtT animation is visual only and does not alter speed.
function weaponMovementSpeed(weaponId,sprintBlend,adsBlend){
  var r=MOVEMENT_RULES;
  var speedRatio=WP[weaponId].moveMult;
  var walk=r.baseSpeed*speedRatio/(1+r.sprintBonus);
  return walk*(1+r.sprintBonus*sprintBlend)*(1-r.adsSlowdown*adsBlend);
}
