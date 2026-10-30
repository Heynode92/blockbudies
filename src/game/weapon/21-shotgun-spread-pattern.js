// CS:GO-inspired LEARNABLE shotgun grouping, adapted to horizontal-only spread.
// Original Valve patterns are 2D; Block Buddies deliberately keeps zero vertical scatter.
// Reuse the existing WP pellet count, angular cone (w.spr) and ADS multiplier.
// No weapon IDs, extra RNG, new ballistics, or damage changes.
// Six pellets: -5/6, +5/6, -3/6, +3/6, -1/6, +1/6 of the existing cone.
function shotgunHorizontalPelletOffset(index,count){
 if(count<=1)return 0;
 var pair=Math.floor(index/2),rank=index%2===0?pair:count-1-pair;
 return(2*rank+1-count)/count;
}
