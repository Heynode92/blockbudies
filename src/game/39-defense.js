// Common damage rules for human and AI characters. Armor is restored on every spawn/round.
var DEFENSE_RULES=Object.freeze({maxHp:100,vestMax:50,bodyReduction:.20,headshotMultiplier:3});
function defenseSpawn(actor){actor.hp=DEFENSE_RULES.maxHp;actor.vest=DEFENSE_RULES.vestMax;actor.helm=true;}
// Vest only mitigates body bullet damage. Damage absorbed consumes equal durability.
// If the vest runs out mid-hit, any leftover damage lands at full strength.
function defenseDamage(actor,raw,kind){
  var damage=Math.max(0,Number.isFinite(raw)?raw:0);
  if(kind==='bullet-body'&&actor.vest>0){
    var absorbed=Math.min(actor.vest,damage*DEFENSE_RULES.bodyReduction);
    actor.vest=Math.max(0,actor.vest-absorbed);damage-=absorbed;
  }
  return damage;
}
// Headshot after helmet removal is identical for bots and player.
function defenseHeadshotDamage(base){return base*DEFENSE_RULES.headshotMultiplier;}
