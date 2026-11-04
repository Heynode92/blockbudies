// Existing weapon speed ratings (WP.moveMult) remain the source of truth.
// SHIFT now means silent/sneak movement: 15% below normal weapon-rated pace.
// ADS slowdown is unchanged; no weapon profile or damage value is modified.
var MOVEMENT_RULES=Object.freeze({
  baseSpeed:6.5,
  sneakSlowdown:.15,
  adsSlowdown:.38
});
function weaponMovementSpeed(weaponId,sneakBlend,adsBlend){
  var r=MOVEMENT_RULES;
  var speedRatio=WP[weaponId].moveMult;
  return r.baseSpeed*speedRatio*(1-r.sneakSlowdown*sneakBlend)*
    (1-r.adsSlowdown*adsBlend);
}
