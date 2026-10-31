// CS:GO-inspired range simulator for POINT BLOCK.
// node tools/damage-sim.mjs
// Ideal hits only (all pellets connect); TTK excludes reload, travel time and misses.
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";
var root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
var read=p=>readFileSync(resolve(root,p),"utf8");
var manifest=JSON.parse(read("tools/source-manifest.json"));
var defs=manifest.parts.filter(p=>p.startsWith("src/game/weapon/")&&!p.endsWith("30-viewmodels.js")).map(read).join("");
var hit=read("src/game/75-weapon-controls.js").match(/function fall\(b,p\)\{[^\n]+\}/);
if(!hit)throw Error("Live fall() source missing");
var ctx={Math};
runInNewContext(read("src/game/39-defense.js")+defs+hit[0],ctx);
function kill(w,d,head,vest,helmet){
 if(w.melee||w.gr||w.rk||d>w.range)return null;
 var hp=ctx.DEFENSE_RULES.maxHp,armor=vest?ctx.DEFENSE_RULES.vestMax:0,helm=helmet,shots=0;
 var raw=w.dmg*ctx.fall({fo:w.rangeModifier?[w.rangeModifier,w.rangeUnit]:null,sx:0,sz:0},{x:d,z:0});
 while(hp>0&&shots<500){
  shots++;
  for(var pellet=0;pellet<w.pel;pellet++){
   var dmg=raw;
   if(head){if(helm)helm=false;else dmg=ctx.defenseHeadshotDamage(dmg);}
   var defender={vest:armor};
   hp-=ctx.defenseDamage(defender,dmg,head?"head":"bullet-body");
   armor=defender.vest;
   if(hp<=0)break;
  }
 }
 if(hp>0)throw Error("Simulation failed for "+w.n);
 return shots+" / "+((shots-1)*w.cd).toFixed(2)+"s";
}
console.log("POINT BLOCK — CS-inspired range falloff");
console.log("damage = base × modifier ^ (distance / "+ctx.DAMAGE_FALLOFF.referenceUnits+" world units)");
console.log("100 HP | 50 vest | 20% body reduction | 3× unhelmeted headshots");
console.log("Each cell: bullets to kill / ideal TTK. Assumes all pellets hit.");
for(var w of ctx.WP){
 console.log("\n"+w.n+" | "+ctx.WEAPON_CLASS_LABELS[w.stats.kind]+" | "+(w.rangeModifier===null?"NO BULLET FALLOFF":"modifier="+w.rangeModifier)+" | maxRange="+w.range);
 console.log(" Distance | Body naked | Body vest | Head naked | Head helmet");
 for(var d of [5,10,20,40,60]){
  var results=[kill(w,d,false,false,false),kill(w,d,false,true,false),kill(w,d,true,false,false),kill(w,d,true,true,true)];
  console.log(String(d).padStart(9)+" | "+results.map(x=>(x??"N/A").padEnd(12)).join(" | "));
 }
}
