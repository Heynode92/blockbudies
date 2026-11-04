// Permanent passive firearm body defense. Online authority: BE defense.ts.
// All combat percentages are centralized here and mirrored by the BE contract.
var DEFENSE_RULES=Object.freeze({
 revision:'pointblock-defense-2026-11-05-p1',
 maxHp:100,bodyReduction:.30,pumpShotgunBodyReduction:.20,headshotMultiplier:3
});
function defenseSpawn(actor){actor.hp=DEFENSE_RULES.maxHp;actor.helm=true;}
function defenseBodyReductionForWeapon(weaponId){
 // No BOT/player branch. Use the canonical registered weapon class and pump flag.
 var profile=Number.isSafeInteger(weaponId)?WEAPON_PROFILES[weaponId]:null;
 return profile&&profile.kind==='shotgun'&&profile.pump===true?
  DEFENSE_RULES.pumpShotgunBodyReduction:DEFENSE_RULES.bodyReduction;
}
function defenseDamage(actor,raw,kind,weaponId){
 var damage=Math.max(0,Number.isFinite(raw)?raw:0);
 return kind==='bullet-body'?damage*(1-defenseBodyReductionForWeapon(weaponId)):damage;
}
// Helmet absorbs the first headshot bonus; unhelmeted headshots retain 3x.
function defenseHeadshotDamage(base){return base*DEFENSE_RULES.headshotMultiplier;}
