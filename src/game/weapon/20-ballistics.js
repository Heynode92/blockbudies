// The score->engine conversion is game balancing, NOT an unofficial Point Blank formula.
// min/max are real rounds-per-minute bounds for each archetype; spread is angular.
var WEAPON_TUNING={
 pistol:{rpmMin:180,rpmMax:360,spread:.09,bulletSpeed:160,reload:1,viewKick:1.1,recoilScale:.35},
 rifle:{rpmMin:400,rpmMax:750,spread:.13,bulletSpeed:180,reload:1.4,viewKick:.9,recoilScale:.65},
 shotgun:{rpmMin:45,rpmMax:90,spread:.6,bulletSpeed:125,reload:2.2,pellets:6,viewKick:1.7,recoilScale:1.2},
 rocket:{rpmMin:25,rpmMax:45,spread:.02,bulletSpeed:15,reload:1.8,viewKick:2,recoilScale:1.3},
 knife:{cooldown:.55,reload:1},
 grenade:{cooldown:1.1,reload:1},
 smg:{rpmMin:650,rpmMax:1050,spread:.075,bulletSpeed:170,reload:1.5,viewKick:.65,recoilScale:.45},
 dual:{rpmMin:850,rpmMax:1250,spread:.095,bulletSpeed:170,reload:2.4,viewKick:.55,recoilScale:.4},
 sniper:{rpmMin:30,rpmMax:65,spread:.21,bulletSpeed:420,reload:2.6,viewKick:2.8,recoilScale:1.5}
};
function weaponProfile(p,id){var t=WEAPON_TUNING[p.kind],pel=t.pellets||1;
  var rangeModifier=WEAPON_RANGE_MODIFIERS[id];
  if(rangeModifier===undefined)rangeModifier=DAMAGE_FALLOFF.defaultModifiers[p.kind]||null;
  var realRpm=p.rpm===null?null:t.rpmMin+(t.rpmMax-t.rpmMin)*p.rpm/100;
  var speed=t.bulletSpeed||0;
  var w={n:p.name,stats:p,cd:realRpm===null?t.cooldown:60/realRpm,
    dmg:p.damage/pel,spd:speed,life:p.range===null?0:p.range/speed,
    pel:p.kind==='knife'||p.kind==='grenade'?0:pel,
    spr:p.control===null?0:(t.spread||0)*(100-p.control)/100,
    mag:p.mag,res:p.res,rt:t.reload,
    range:p.range,moveMult:p.speed/100,
    rangeModifier:rangeModifier,rangeUnit:rangeModifier?DAMAGE_FALLOFF.referenceUnits:null,
    viewKick:t.viewKick?Math.min(.26,(.015+.001*p.vRecoil)*t.viewKick):0,
    recoilScale:t.recoilScale||0};
  if(p.kind==='rocket')w.rk=1;
  if(p.kind==='knife')w.melee=1;
  if(p.kind==='grenade')w.gr=1;
  if(p.kind==='dual')w.dual=1;
  if(p.kind==='sniper')w.snp=1;
  return w;
}
var WP=WEAPON_PROFILES.map(weaponProfile);
