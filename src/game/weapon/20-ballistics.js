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
  if(p.pump===true){w.pump=1;w.pumpDuration=Math.min(.68,w.cd*.8);}
  return w;
}
var WP=WEAPON_PROFILES.map(weaponProfile);

// Keep these exact equations in backend src/matches/engine/gunplay.ts.
// Original deterministic whole-weapon recoil, bloom and movement/ADS accuracy.
var GUNPLAY_REVISION='pointblock-gunplay-2026-11-04-v2-muzzle';
var GUNPLAY_ARCHETYPES={
 pistol:{vertical:.8,horizontal:.8,bloom:.7,recovery:5.8},
 rifle:{vertical:1,horizontal:1,bloom:1,recovery:4.5},
 shotgun:{vertical:1.8,horizontal:1.15,bloom:.65,recovery:3.5},
 rocket:{vertical:1.4,horizontal:.6,bloom:.25,recovery:4},
 knife:{vertical:0,horizontal:0,bloom:0,recovery:6},
 grenade:{vertical:0,horizontal:0,bloom:0,recovery:6},
 smg:{vertical:.82,horizontal:1.18,bloom:1.15,recovery:5},
 dual:{vertical:.76,horizontal:1.27,bloom:1.3,recovery:4.9},
 sniper:{vertical:2,horizontal:.7,bloom:.2,recovery:4}
};
function freshGunplayState(){return {shots:0,yaw:0,pitch:0,bloom:0,lastShotAt:-Infinity};}
function gunplayClamp(v,lo,hi){return Math.min(hi,Math.max(lo,v));}
function gunplayShot(weaponId,state,time,conditions,random){
 if(!Number.isFinite(time)||!Number.isFinite(conditions.ads)||!Number.isFinite(conditions.speed)||
   conditions.speed<0||conditions.ads<0||conditions.ads>1)throw new RangeError('Invalid gunplay inputs');
 var p=WEAPON_PROFILES[weaponId],w=WP[weaponId],arch=GUNPLAY_ARCHETYPES[p.kind];
 if(p.kind==='knife'||p.kind==='grenade')throw new RangeError('Non-projectile weapon');
 var control=gunplayClamp(p.control===null?0:p.control,0,100)/100,
   vert=gunplayClamp(p.vRecoil===null?0:p.vRecoil,0,100)/100,
   horz=gunplayClamp(p.hRecoil===null?0:p.hRecoil,0,100)/100;
 var gap=time-state.lastShotAt;
 var interrupted=Number.isFinite(gap)&&gap>Math.max(.18,w.cd*1.35);
 if(interrupted){
  var fade=Math.exp(-Math.max(0,gap-w.cd)*arch.recovery*(.75+.5*control));
  state.pitch*=fade;state.yaw*=fade;state.bloom*=fade;
  state.shots=Math.floor(state.shots*fade);
 }
 var index=state.shots,ads=conditions.ads,move=gunplayClamp(conditions.speed/5,0,1);
 var locomotion=(1+.9*move)*(conditions.crouch?.78:1)*(conditions.grounded?1:3.25);
 var optics=p.kind==='sniper'?(3-2.82*ads):(1-.30*ads);
 var base=Math.max(.0006,w.spr*(p.kind==='shotgun'?.022:.16));
 var inaccuracy=gunplayClamp((base+state.bloom)*locomotion*optics,.0002,.12);
 var radius=Math.sqrt(gunplayClamp(random(),0,.999999))*inaccuracy,
   angle=gunplayClamp(random(),0,.999999)*Math.PI*2;
 var yaw=state.yaw+Math.cos(angle)*radius,pitch=state.pitch+Math.sin(angle)*radius;
 var verticalKick=.0030*vert*arch.vertical*(1+Math.min(index,16)*.035)*(1-.07*ads);
 var horizontalStep=.0031*horz*arch.horizontal*
   (.74*Math.sin((index+1)*.43+arch.vertical)+.26*Math.sin((index+1)*.17));
 state.pitch=gunplayClamp(state.pitch+verticalKick,0,.18);
 state.yaw=gunplayClamp(state.yaw+horizontalStep,-.15,.15);
 state.bloom=gunplayClamp(state.bloom+(.00016+.00042*(1-control))*arch.bloom,0,.038);
 state.shots=Math.min(150,index+1);
 state.lastShotAt=time;
 return {yaw:yaw,pitch:pitch,index:index,inaccuracy:inaccuracy};
}
