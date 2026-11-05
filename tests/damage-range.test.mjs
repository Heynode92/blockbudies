import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {fileURLToPath} from "node:url";
import {resolve,dirname} from "node:path";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8").replace(/\r\n/g,'\n');
const m=JSON.parse(read("tools/source-manifest.json"));
const defs=m.parts.filter(p=>p.startsWith("src/game/weapon/")&&!p.endsWith("30-viewmodels.js")).map(read).join("");
const impact=read("src/game/42-projectile-defense.js");
const fall=read("src/game/75-weapon-controls.js").match(/function fall\(b,p\)\{[^\n]+\}/)?.[0];
assert.ok(fall,"expected live fall() implementation");
function setup(){
 const ctx={Math};runInNewContext(read("src/game/39-defense.js")+defs+"\n"+fall,ctx);
 return ctx;
}
function raw(w,d,ctx){
 return w.dmg*ctx.fall({sx:0,sz:0,wid:ctx.WP.indexOf(w),fo:w.rangeModifier?[w.rangeModifier,w.rangeUnit]:null},{x:d,z:0});
}
function near(a,b,what){assert.ok(Math.abs(a-b)<1e-8,what+": "+a+" != "+b);}
test("original thirteen weapon IDs and class configs are preserved alongside expanded weapon catalog",()=>{
 const c=setup();
 assert.equal(c.WP.length,c.WEAPON_PROFILES.length);
 assert.equal(c.WP.length,19);
 assert.equal(c.WEAPON_STARTER_ID,9);
 assert.deepEqual(Array.from(c.WEAPON_PROFILES.slice(0,13),p=>p.name),["Handgun","AK-47","Shotgun","RPG","Knife","Grenade","Kriss","Dual Kriss","AWP","K2","MP7","P90","AK SOPMOD"]);
 assert.ok(Object.isFrozen(c.DAMAGE_FALLOFF));
 assert.ok(Object.isFrozen(c.WEAPON_CLASS_LABELS));
 assert.ok(c.WEAPON_PROFILES.every(Object.isFrozen));
 assert.equal(c.WEAPON_CLASS_LABELS.rifle,"ASSAULT RIFLE");
 assert.equal(c.WEAPON_CLASS_LABELS.sniper,"SNIPER RIFLE");
 assert.equal(c.WEAPON_CLASS_LABELS.smg,"SUBMACHINE GUN");
});
test("original exponential decay remains exact for every non-rifle bullet archetype",()=>{
 const ctx=setup(),unit=ctx.DAMAGE_FALLOFF.referenceUnits;
 assert.equal(unit,20);
 for(const [id,w] of ctx.WP.entries()){
  if(w.stats.kind==='rifle'||!w.rangeModifier)continue;
  for(const d of [0,10,20,40,60])
   near(raw(w,d,ctx),w.dmg*Math.pow(w.rangeModifier,d/unit),w.n+" "+d);
  for(const d of [0,10,20,40])
   assert.ok(raw(w,d+10,ctx)<=raw(w,d,ctx),w.n+" damage increased");
 }
});
test("assault rifles retain full damage through 30m, then follow one piecewise-linear curve",()=>{
 const c=setup();
 const checkpoints=[[0,1],[30,1],[40,.95],[50,.90],[60,.85],[70,.80],
  [80,.775],[90,.75],[100,.725],[110,.70],[115,.675],[120,.65],
  [130,.625],[140,.60],[150,.575],[160,.55]];
 assert.equal(c.DAMAGE_FALLOFF.rifleRevision,'pointblock-rifle-falloff-2026-11-05-p4');
 assert.ok(Object.isFrozen(c.DAMAGE_FALLOFF.rifleCurve));
 const rifles=c.WP.filter(w=>w.stats.kind==='rifle');
 assert.equal(rifles.length,5);
 for(const w of rifles) {
  for(const [d,pct] of checkpoints)if(d<=w.range)
   near(raw(w,d,c),w.dmg*pct,w.n+" "+d+"m");
  assert.equal(w.life*w.spd,w.range,w.n+" projectile cap unchanged");
  assert.equal(w.stats.damage,w.dmg*w.pel,w.n+" immutable original damage");
  for(let d=0;d<Math.min(w.range,155);d+=5)
   assert.ok(raw(w,d+5,c)<=raw(w,d,c)+1e-10,w.n+" falloff must not rise");
 }
 assert.equal(c.rifleDamageRetention(160),.55);
 assert.equal(c.rifleDamageRetention(400),.55);
 assert.throws(()=>c.rifleDamageRetention(-1),e=>e?.name==='RangeError');
});
test("Rifle plateau differs from unchanged SMG, sniper and shotgun falloff",()=>{
 const c=setup();
 near(c.WP[1].rangeModifier,.98,"AK");
 near(c.WP[10].rangeModifier,.85,"MP7");
 near(c.WP[11].rangeModifier,.86,"P90");
 near(c.WP[8].rangeModifier,.99,"AWP");
 near(c.WP[2].rangeModifier,.70,"shotgun");
 near(raw(c.WP[2],20,c),19.6,"shotgun single pellet at 20");
 near(raw(c.WP[2],40,c),13.72,"shotgun single pellet at 40");
 assert.equal(c.WP[2].pel,6);
 assert.ok(raw(c.WP[8],60,c)/c.WP[8].dmg>.97);
 assert.ok(raw(c.WP[10],60,c)/c.WP[10].dmg<.62);
});
test("Projectile range remains a hard cap and non-bullet weapons do not fall off",()=>{
 const c=setup();
 for(const id of [3,4,5])assert.equal(c.WP[id].rangeModifier,null);
 assert.deepEqual([c.WP[0].range,c.WP[8].range,c.WP[9].range,c.WP[10].range],[45,180,120,60]);
 assert.match(read("src/game/45-combat.js"),/life:w\.life/);
 assert.match(read("src/game/45-combat.js"),/fo:w\.rangeModifier\?\[w\.rangeModifier,w\.rangeUnit\]:null/);
});
test("Falloff still precedes helmet/headshot and the permanent body defense",()=>{
 const c=setup(),hits=[];
 c.pl={helm:true};
 c.popPl=()=>{c.pl.helm=false;};
 c.popHelm=e=>{e.helm=false;};
 c.hurt=(damage,...rest)=>hits.push({damage,rest});
 c.dmgE=(e,damage,...rest)=>hits.push({damage,rest});
 runInNewContext(impact,c);
 const w=c.WP[9],shot={dmg:w.dmg,fo:[w.rangeModifier,w.rangeUnit],sx:0,sz:0,
   wid:9,by:{tm:0},vx:1,vz:0,m:{position:{x:60,y:1.2,z:0}}};
 const target={helm:true,x:60,y:0,z:0,g:{rotation:{y:0}}};
 c.projectileHitCharacter(shot,target,true);
 near(hits.at(-1).damage,w.dmg*.85,"helmeted headshot after 60m rifle falloff");
 c.projectileHitCharacter(shot,target,true);
 near(hits.at(-1).damage,w.dmg*.85*3,"unhelmeted headshot after 60m rifle falloff");
 c.projectileHitCharacter(shot,target,false);
 const rawBody=hits.at(-1).damage;
 near(c.defenseDamage({},rawBody,"bullet-body",shot.wid),rawBody*.7,"30% body reduction");
 assert.equal(hits.at(-1).rest.at(-2),shot.wid,"weapon identity is available to the reducer");
 assert.equal(hits.at(-1).rest.at(-1),'chest',"center upper-body hit classified as chest");
 assert.equal(c.DEFENSE_RULES.headshotMultiplier,3);
 assert.equal(c.DEFENSE_RULES.bodyReduction,.30);
 assert.equal(c.DEFENSE_RULES.pumpShotgunBodyReduction,.20);
});
test("Body/head shots to eliminate 100 HP follow passive defense with fixed original falloff",()=>{
 const c=setup();
 function shots(id,d,head,helmet){
  const w=c.WP[id];if(d>w.range)return null;
  const pellet=raw(w,d,c);let hp=c.DEFENSE_RULES.maxHp,helm=helmet,n=0;
  while(hp>0&&n<200){
   n++;
   for(let p=0;p<w.pel;p++){
    let dmg=pellet;
    if(head){if(helm)helm=false;else dmg=c.defenseHeadshotDamage(dmg);}
    hp-=c.defenseDamage({},dmg,head?"head":"bullet-body",id);
    if(hp<=0)break;
   }
  }
  return n;
 }
 for(const [id,nearRange,farRange] of [[1,5,60],[9,5,60],[6,5,60],[10,5,60],[11,5,60],[2,5,60],[8,5,60]]){
  assert.ok(shots(id,nearRange,false,false)>=1);
  assert.ok(shots(id,farRange,false,false)>=shots(id,nearRange,false,false),
    "body TTK cannot improve with range for "+id);
  assert.ok(shots(id,farRange,true,true)>=shots(id,farRange,true,false),
    "helmet must not make headshot TTK faster for "+id);
 }
 assert.equal(shots(2,5,false,false),1,"pump Shotgun five close-range torso pellets remain lethal");
 assert.equal(shots(0,60,false,false),null,"legal maximum range unchanged");
});
test("Compiled browser runtime matches the new ordered weapon source",()=>{
 const parts=m.parts.filter(p=>p.startsWith("src/game/weapon/"));
 assert.equal(parts.length,setup().WP.length+4);
 assert.ok(!m.parts.includes("src/game/40-weapons-and-viewmodels.js"));
 assert.ok(m.parts.indexOf("src/game/weapon/20-ballistics.js")<m.parts.indexOf("src/game/weapon/30-viewmodels.js"));
 assert.equal(read("assets/game.js"),"(function(){\n"+m.parts.map(read).join("")+"})();\n");
});
