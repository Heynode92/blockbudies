// ---- WEAPON REGISTRY: stable IDs for save files, bot loadouts and all weapon arrays ----
var WEAPON_PROFILES=[],WEAPON_MODEL_BUILDERS=[],WEAPON_RANGE_MODIFIERS=[];
var WEAPON_STARTER_ID=9;
// CS:GO damage falloff is damage*modifier^(distance/500 CS units).
// For POINT BLOCK, 20 world units are one falloff interval; the two unit systems differ.
var DAMAGE_FALLOFF=Object.freeze({
 referenceUnits:20,
 // Original non-rifle rating-to-falloff remains intact. The rifle profile
 // still retains its immutable rangeModifier stat, but uses the approved
 // single distance-retention curve below instead of the old exponent.
 defaultModifiers:Object.freeze({pistol:.91,rifle:.98,smg:.85,dual:.85,shotgun:.70,sniper:.99}),
 rifleRevision:'pointblock-rifle-falloff-2026-11-05-p4',
 rifleCurve:Object.freeze([
  Object.freeze({distance:0,retained:1}),
  Object.freeze({distance:30,retained:1}),
  Object.freeze({distance:50,retained:.90}),
  Object.freeze({distance:70,retained:.80}),
  Object.freeze({distance:90,retained:.75}),
  Object.freeze({distance:110,retained:.70}),
  Object.freeze({distance:120,retained:.65}),
  Object.freeze({distance:140,retained:.60}),
  Object.freeze({distance:160,retained:.55})
 ])
});
function rifleDamageRetention(horizontalDistance){
 if(!Number.isFinite(horizontalDistance)||horizontalDistance<0)throw new RangeError('Invalid rifle falloff distance');
 var nodes=DAMAGE_FALLOFF.rifleCurve;
 for(var i=1;i<nodes.length;i++){
  var a=nodes[i-1],b=nodes[i];
  if(horizontalDistance<=b.distance){
   var t=(horizontalDistance-a.distance)/(b.distance-a.distance);
   return a.retained+(b.retained-a.retained)*t;
  }
 }
 // Original weapon projectile lifetime remains the only range cutoff.
 return nodes[nodes.length-1].retained;
}
var WEAPON_CLASS_LABELS=Object.freeze({pistol:"HANDGUN",rifle:"ASSAULT RIFLE",shotgun:"SHOTGUN",rocket:"LAUNCHER",knife:"MELEE",grenade:"THROWABLE",smg:"SUBMACHINE GUN",dual:"SUBMACHINE GUN",sniper:"SNIPER RIFLE"});
