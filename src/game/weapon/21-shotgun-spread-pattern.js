// Fixed 2D pellet spread inspired by CS:GO's learnable shotgun concept.
// Golden-angle disk distributes pellets near/around the crosshair; no RNG,
// fixed weapon IDs, extra projectile system or copies of Valve's pattern data.
function shotgunPelletSpread(index,count){
 if(count<=1)return[0,0];
 var radius=.88*Math.sqrt((index+.5)/count);
 var angle=index*Math.PI*(3-Math.sqrt(5));
 return[Math.cos(angle)*radius,Math.sin(angle)*radius];
}
