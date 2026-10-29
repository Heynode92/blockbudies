import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=path=>readFileSync(resolve(root,path),"utf8");
const weapon=read("src/game/40-weapons-and-viewmodels.js");
const inventory=read("src/game/89-inventory.js");
const bot=read("src/game/41-bot-weapons.js");
const controls=read("src/game/75-weapon-controls.js");
const shop=read("src/game/89-shop.js");
function profileContext(){
 const ctx={Math};
 runInNewContext(weapon.slice(weapon.indexOf("var WEAPON_PROFILES="),weapon.indexOf("// EW:")),ctx);
 return ctx;
}
function state(saved=null){
 const {WP,WEAPON_STARTER_ID}=profileContext();
 const stored=new Map();
 if(saved!==null)stored.set("bbfps_inventory_v1",JSON.stringify(saved));
 const store={
   getItem(key){return stored.get(key)||null;},
   setItem(key,value){stored.set(key,value);}
 };
 const setup=inventory.slice(0,inventory.indexOf("// Pose specifications"));
 const ctx={Math,WP,WEAPON_STARTER_ID,localStorage:store,favPrim:1,
   refreshWeaponSelection(){ctx.refreshed=(ctx.refreshed||0)+1;},inventoryRender(){}};
 runInNewContext(setup,ctx);
 ctx.inventoryLoad();
 return {ctx,stored,store};
}
test("K2 is id 9 with exact user stats, own real model and rifle tuning",()=>{
 const x=profileContext();
 assert.equal(x.WEAPON_STARTER_ID,9);
 assert.equal(x.WEAPON_PROFILES.length,13);
 const p=x.WEAPON_PROFILES[9];
 for(const [k,v] of Object.entries({name:"K2",damage:36,rpm:96,control:75,speed:79,
   vRecoil:66,hRecoil:33,mag:40,res:200,range:120,kind:"rifle"}))assert.equal(p[k],v,k);
 assert.equal(x.WP[9].dmg,36);
 assert.equal(x.WP[9].moveMult,.79);
 assert.ok(Math.abs(x.WP[9].life*x.WP[9].spd-120)<1e-9);
 assert.match(weapon,/else if\(i===9\)/);
 assert.match(weapon,/receiver/);
 assert.match(controls,/9:'<svg/);
});
test("New player only owns K2 as primary but always has the usual sidearm and utility",()=>{
 const {ctx}=state();
 assert.deepEqual(Array.from(ctx.inventoryOwned("main")),[9]);
 assert.equal(ctx.inventoryEquipped("main"),9);
 assert.equal(ctx.favPrim,9);
 assert.deepEqual(Array.from(ctx.inventoryOwned("secondary")),[0]);
 assert.deepEqual(Array.from(ctx.inventoryOwned("mele")),[4]);
 assert.deepEqual(Array.from(ctx.inventoryOwned("explosive")),[5]);
 assert.deepEqual(Array.from(ctx.inventoryOwned("helm")),["standard_helmet"]);
});
test("Old pre-shop equipped settings do not grant free ownership of all guns",()=>{
 const {ctx}=state({equipped:{main:6,secondary:0,mele:4,explosive:5}});
 assert.deepEqual(Array.from(ctx.inventoryOwned("main")),[9]);
 assert.equal(ctx.inventoryEquipped("main"),9);
 assert.equal(ctx.favPrim,9);
 assert.equal(ctx.inventoryEquip("main",6),false);
});
test("Shop unlock persists and main equipment can be changed after claiming",()=>{
 const {ctx,stored}=state();
 assert.equal(ctx.inventoryClaimPrimary(6),true);
 assert.equal(ctx.inventoryClaimPrimary(6),false);
 assert.ok(ctx.inventoryOwned("main").includes(6));
 assert.equal(ctx.inventoryEquip("main",6),true);
 assert.equal(ctx.inventoryEquipped("main"),6);
 assert.equal(JSON.parse(stored.get("bbfps_inventory_v1")).equipped.main,6);
 const again=state(JSON.parse(stored.get("bbfps_inventory_v1")));
 assert.equal(again.ctx.inventoryEquipped("main"),6);
 assert.ok(again.ctx.inventoryOwned("main").includes(6));
});
test("Locked variants and fake IDs cannot be equipped or claimed",()=>{
 const {ctx}=state();
 for(const id of [7,-1,99,0,4,5]){
   assert.equal(ctx.inventoryClaimPrimary(id),false);
   assert.equal(ctx.inventoryEquip("main",id),false);
 }
 assert.equal(ctx.inventoryClaimPrimary(9),false);
 assert.deepEqual(Array.from(ctx.inventoryOwned("main")),[9]);
});
test("Ownership is enforced by pre-round selection and shop is not a placeholder",()=>{
 assert.match(controls,/function refreshWeaponSelection\(\)/);
 assert.match(controls,/var owned=inventoryOwned\("main"\)/);
 assert.match(controls,/WSEL\.indexOf\(id\)<0\|\|inventoryOwned\("main"\)\.indexOf\(id\)<0/);
 assert.match(shop,/function shopRender\(\)/);
 assert.match(shop,/inventoryClaimPrimary\(id\)/);
 assert.match(shop,/UNLOCK FREE/);
 assert.match(read("index.html"),/id="lbshop"/);
 assert.match(read("index.html"),/id="lshop"/);
 assert.match(read("src/game/85-lobby-and-match.js"),/"lbshop"/);
});
test("AI keeps its original rifle/SMG/shotgun/RPG/sniper loadout, without K2",()=>{
 assert.match(bot,/primaries:\[1,1,1,2,2,6,6,6,7,8,3\]/);
 assert.doesNotMatch(bot,/WEAPON_STARTER_ID/);
 assert.match(bot,/BOT_WEAPONS\.primaries/);
});
test("All 13 weapon IDs have viewmodels and gun effects, including K2",()=>{
 const combat=read("src/game/45-combat.js");
 const audio=read("src/game/65-audio.js");
 const drops=read("src/game/50-items-and-drops.js");
 assert.match(weapon,/guns=WEAPON_PROFILES\.map/);
 assert.match(combat,/MZ=\[[^\]]+,-1\.38\]/);
 assert.match(audio,/SFXI=\[[^\]]+,1\]/);
 assert.match(drops,/GSC=\[[^\]]+,1\.23\],GH=\[[^\]]+,\.09\]/);
 assert.match(weapon,/MODE=\[[^\]]+,0\],NC=\[[^\]]+,1\]/);
});
test("Compiled game bundle is exactly the ordered source parts",()=>{
 const m=JSON.parse(read("tools/source-manifest.json"));
 assert.ok(m.parts.includes("src/game/89-shop.js"));
 assert.ok(m.styles.includes("src/styles/10-shop.css"));
 assert.equal(read("assets/game.js"),"(function(){\n"+m.parts.map(read).join("")+"})();\n");
});
