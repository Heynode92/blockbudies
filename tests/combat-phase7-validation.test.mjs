import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const gold=JSON.parse(read('docs/combat-phase7-vectors.json'));
const manifest=JSON.parse(read('tools/source-manifest.json'));
const weapons=manifest.parts.filter(p=>p.startsWith('src/game/weapon/')&&!p.endsWith('30-viewmodels.js')).map(read).join('');
const fall=read('src/game/75-weapon-controls.js').match(/function fall\(b,p\)\{[^\n]+\}/)?.[0];
assert.ok(fall,'Use actual production FE distance falloff, not a test implementation');
const context=()=>{const ctx={Math,Number,Object};
 runInNewContext(read('src/game/39-defense.js')+weapons+'\n'+fall,ctx);return ctx;};
const near=(actual,expected,label)=>
 assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<1e-7,
  `${label}: ${actual} != ${expected}`);
const normalize=(p,id,modifier)=>({
 id,name:p.name,kind:p.kind,damage:p.damage,rpm:p.rpm,control:p.control,
 speed:p.speed,vRecoil:p.vRecoil,hRecoil:p.hRecoil,mag:p.mag,
 res:Number.isFinite(p.res)?p.res:'Infinity',range:p.range,
 rangeModifier:modifier,pump:p.pump===true
});
const pelletRaw=(c,v)=>{
 const w=c.WP[v.id];
 return w.dmg*c.fall({sx:0,sz:0,wid:v.id,
  fo:w.rangeModifier?[w.rangeModifier,w.rangeUnit]:null},{x:v.distance,z:0});
};
function newTriggers(c,v){
 let hp=100,cycles=0;
 while(hp>0&&cycles<100){cycles++;
  for(let i=0;i<c.WP[v.id].pel;i++){
   hp-=c.defenseDamage({},pelletRaw(c,v),'bullet-body',v.id,'chest');
   if(hp<=0)break;
  }
 }
 return cycles;
}
function historicalTriggers(p,v){
 let hp=gold.model.hp,vest=gold.model.old.vestMax,triggers=0;
 const count=p.kind==='shotgun'?6:1;
 const pellet=p.damage/count*Math.pow(p.rangeModifier,v.distance/20);
 while(hp>0&&triggers<100){triggers++;
  for(let i=0;i<count;i++){
   const absorbed=Math.min(vest,pellet*gold.model.old.bodyReductionWhileVest);
   vest-=absorbed;hp-=pellet-absorbed;
   if(hp<=0)break;
  }
 }
 return triggers;
}
test('all 19 immutable frontend source profiles match frozen server-derived originals',()=>{
 const c=context();
 assert.equal(gold.schema,'pointblock-combat-phase7-vectors-2026-11-06');
 assert.equal(gold.profiles.length,19);assert.equal(c.WEAPON_PROFILES.length,19);
 assert.deepEqual(Array.from(c.WEAPON_PROFILES,(p,id)=>
  normalize(p,id,c.WEAPON_RANGE_MODIFIERS[id])),gold.profiles);
 assert.equal(c.DEFENSE_RULES.maxHp,100);
 assert.equal(c.DEFENSE_RULES.bodyReduction,.30);
 assert.equal(c.DEFENSE_RULES.pumpShotgunBodyReduction,.20);
 assert.deepEqual(Object.fromEntries(Object.entries(c.HITGROUP_RULES.multipliers)),
  gold.model.updated.hitgroups);
 assert.equal(c.CHARACTER_HITBOX_RULES.revision,'pointblock-hitbox-2026-11-05-p3');
});
test('all 45 frozen raw-damage and six anatomical-hitgroup/helmet vectors equal live FE',()=>{
 const c=context();assert.equal(gold.scenarios.length,45);
 for(const v of gold.scenarios){
  const p=gold.profiles[v.id],w=c.WP[v.id],raw=pelletRaw(c,v);
  assert.ok(v.distance<=p.range,`${p.name} original max range`);
  assert.equal(w.pel,v.pelletCount,`${p.name} pellets per trigger`);
  near(w.cd,v.cooldownSeconds,`${p.name} effective cooldown`);
  near(raw,v.newPelletRaw,`${p.name} raw at ${v.distance}m`);
  for(const group of ['chest','stomach','arm','leg'])
   near(c.defenseDamage({},raw,'bullet-body',v.id,group),
    v.newDamagePerPellet[group],`${p.name} ${group} at ${v.distance}m`);
  near(c.defenseDamage({},raw,'head',v.id),v.newDamagePerPellet.helmetedHead,
   `${p.name} helmeted head`);
  near(c.defenseHeadshotDamage(raw),v.newDamagePerPellet.unhelmetedHead,
   `${p.name} unhelmeted head`);
 }
});
test('golden historical and current ideal chest-hit TTK: cooldown, 6 pellets and finite old vest',()=>{
 const c=context();
 for(const v of gold.scenarios){
  const p=gold.profiles[v.id];
  const oldRaw=p.damage/v.pelletCount*Math.pow(p.rangeModifier,v.distance/20);
  near(oldRaw,v.oldPelletRaw,`${p.name} old exponential raw`);
  const old=historicalTriggers(p,v),now=newTriggers(c,v);
  assert.equal(old,v.oldTriggers,`${p.name} historical triggers at ${v.distance}m`);
  assert.equal(now,v.newTriggers,`${p.name} current triggers at ${v.distance}m`);
  assert.ok(now<=p.mag&&old<=p.mag,'no reload needed for idealized TTK row');
  near((old-1)*c.WP[v.id].cd,v.oldTtkSeconds,`${p.name} historical TTK`);
  near((now-1)*c.WP[v.id].cd,v.newTtkSeconds,`${p.name} current TTK`);
 }
});
test('human and BOT apply identical permanent damage and helmet for the same hitgroup',()=>{
 const c=context();
 for(const v of gold.scenarios){
  const raw=pelletRaw(c,v);
  for(const group of ['chest','stomach','arm','leg']){
   const human={},bot={};c.defenseSpawn(human);c.defenseSpawn(bot);
   const h=c.defenseDamage(human,raw,'bullet-body',v.id,group);
   const b=c.defenseDamage(bot,raw,'bullet-body',v.id,group);
   near(h,b,`human/BOT ${v.id} ${group}`);
   assert.equal(human.hp,bot.hp);assert.equal(human.helm,bot.helm);
   assert.equal(Object.hasOwn(human,'vest'),false);
   assert.equal(Object.hasOwn(bot,'vest'),false);
  }
 }
});
test('FE actual projectile and security boundary remain source-pinned, not client-authoritative',()=>{
 const impact=read('src/game/42-projectile-defense.js');
 const sim=read('src/game/95-simulation.js');
 const bridge=read('src/game/98-online-bridge.js');
 assert.match(sim,/sweptCharacterHit\(/);
 assert.match(impact,/verifiedBodyGroup==='head'/);
 assert.match(bridge,/combatRevision===COMBAT_SYNC_REVISION/);
 assert.match(bridge,/frame.actorId===onlineUserId\(\)/);
 assert.match(bridge,/onlineShowVerifiedReward\(matchId\)/);
 assert.doesNotMatch(bridge,/pl\.vest/);
});
