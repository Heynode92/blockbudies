// Permanent passive firearm body defense. Online authority: BE defense.ts.
// All combat percentages are centralized here and mirrored by the BE contract.
var DEFENSE_RULES=Object.freeze({
 revision:'pointblock-defense-2026-11-05-p1',
 maxHp:100,bodyReduction:.30,pumpShotgunBodyReduction:.20,headshotMultiplier:3
});
// Body-zone geometry mirrors the BE hitgroup.ts and the existing blocky model.
// This classifies a contact within the OLD cylinder, not a new limb collider.
var HITGROUP_RULES=Object.freeze({
 revision:'pointblock-hitgroup-2026-11-05-p2',
 multipliers:Object.freeze({chest:1,stomach:1.25,arm:1,leg:.75}),
 zones:Object.freeze({legsTop:.58,stomachTop:1.0,armBottom:.58,armSide:.40})
});
function defenseClassifyBodyHitgroup(point,pose){
 if(![point.x,point.y,point.z,pose.x,pose.y,pose.z,pose.yaw].every(Number.isFinite))
  throw new RangeError('Non-finite body impact pose');
 var h=point.y-pose.y,zone=HITGROUP_RULES.zones;
 if(h<zone.legsTop)return 'leg';
 var dx=point.x-pose.x,dz=point.z-pose.z;
 var right=dx*Math.cos(pose.yaw)-dz*Math.sin(pose.yaw);
 if(h>=zone.armBottom&&Math.abs(right)>=zone.armSide)return 'arm';
 return h<zone.stomachTop?'stomach':'chest';
}
function defenseHitgroupMultiplier(group){
 if(!Object.prototype.hasOwnProperty.call(HITGROUP_RULES.multipliers,group))
  throw new RangeError('Invalid body hitgroup');
 return HITGROUP_RULES.multipliers[group];
}
function defenseSpawn(actor){actor.hp=DEFENSE_RULES.maxHp;actor.helm=true;}
function defenseBodyReductionForWeapon(weaponId){
 // No BOT/player branch. Use the canonical registered weapon class and pump flag.
 var profile=Number.isSafeInteger(weaponId)?WEAPON_PROFILES[weaponId]:null;
 return profile&&profile.kind==='shotgun'&&profile.pump===true?
  DEFENSE_RULES.pumpShotgunBodyReduction:DEFENSE_RULES.bodyReduction;
}
function defenseDamage(actor,raw,kind,weaponId,hitgroup){
 var damage=Math.max(0,Number.isFinite(raw)?raw:0);
 // Distance is already applied by projectileHitCharacter(). No rounding
 // between hitgroup and permanent defense, including each shotgun pellet.
 return kind==='bullet-body'?
  damage*defenseHitgroupMultiplier(hitgroup||'chest')*(1-defenseBodyReductionForWeapon(weaponId)):damage;
}
// Helmet absorbs the first headshot bonus; unhelmeted headshots retain 3x.
function defenseHeadshotDamage(base){return base*DEFENSE_RULES.headshotMultiplier;}
