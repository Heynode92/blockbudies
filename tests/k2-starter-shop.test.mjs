import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=path=>readFileSync(resolve(root,path),"utf8").replace(/\r\n/g,'\n');
const weapon=JSON.parse(read("tools/source-manifest.json")).parts.filter(p=>p.startsWith("src/game/weapon/")&&!p.endsWith("30-viewmodels.js")).map(read).join("");
const inventory=read("src/game/89-inventory.js");
const bot=read("src/game/41-bot-weapons.js");
const controls=read("src/game/75-weapon-controls.js");
const shop=read("src/game/89-shop.js");
function numberAt(source,key,id){
 const begin=source.indexOf(key+'=[');
 assert.ok(begin>=0,'expected numeric table '+key);
 const from=begin+key.length+1,stop=source.indexOf(']',from);
 assert.ok(stop>=from,'missing table close for '+key);
 const entries=source.slice(from+1,stop).split(',').map(Number);
 assert.ok(entries.length>id,'table '+key+' missing weapon '+id);
 return entries[id];
}
function profileContext(){
 const ctx={Math};
 runInNewContext(weapon,ctx);
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
 assert.ok(x.WEAPON_PROFILES.length>=13);
 const p=x.WEAPON_PROFILES[9];
 for(const [k,v] of Object.entries({name:"K2",damage:36,rpm:96,control:75,speed:79,
   vRecoil:66,hRecoil:33,mag:40,res:200,range:120,kind:"rifle"}))assert.equal(p[k],v,k);
 assert.equal(x.WP[9].dmg,36);
 assert.equal(x.WP[9].moveMult,.79);
 assert.ok(Math.abs(x.WP[9].life*x.WP[9].spd-120)<1e-9);
 assert.match(read("src/game/weapon/10-k2.js"),/WEAPON_MODEL_BUILDERS\[9\]/);
 assert.match(read("src/game/weapon/10-k2.js"),/receiver/);
 assert.match(controls,/9:'<svg/);
});
test("Unverified browser owns no primary; fixed sidearm, knife and utility remain",()=>{
 const {ctx}=state();
 assert.deepEqual(Array.from(ctx.inventoryOwned("main")),[]);
 assert.equal(ctx.inventoryEquipped("main"),null);
 assert.equal(ctx.favPrim,9,"starter visual fallback is not an owned asset");
 assert.deepEqual(Array.from(ctx.inventoryOwned("secondary")),[0]);
 assert.deepEqual(Array.from(ctx.inventoryOwned("mele")),[4]);
 assert.deepEqual(Array.from(ctx.inventoryOwned("explosive")),[5]);
 assert.deepEqual(Array.from(ctx.inventoryOwned("helm")),["standard_helmet"]);
});
test("Old browser storage cannot grant equipment or change backend ownership",()=>{
 const {ctx}=state({equipped:{main:6,secondary:0,mele:4,explosive:5},unlockedMain:[1,6,8]});
 assert.deepEqual(Array.from(ctx.inventoryOwned("main")),[]);
 assert.equal(ctx.inventoryEquipped("main"),null);
 assert.equal(ctx.inventoryEquip("main",6),false);
 assert.equal(ctx.inventoryClaimPrimary(6),false);
 assert.equal(ctx.inventorySave(),false);
});
test("Verified server inventory and committed loadout replace all free local unlocks",async()=>{
 const {ctx,stored}=state();
 let saves=0;
 ctx.document={getElementById:()=>({classList:{contains:()=>false}})};
 ctx.PB_ONLINE={
  state:()=>({registered:true}),
  inventory:async()=>({owned:[{weaponId:9},{weaponId:6}]}),
  loadout:async()=>({equipped:{main:9}}),
  saveLoadout:async id=>{saves++;return {equipped:{main:id}};}
 };
 assert.equal(await ctx.onlineLoadInventory(),true);
 assert.deepEqual(Array.from(ctx.inventoryOwned("main")),[6,9]);
 assert.equal(ctx.inventoryEquipped("main"),9);
 assert.equal(ctx.inventoryClaimPrimary(6),false);
 assert.equal(ctx.inventoryEquip("main",6),true);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(saves,1);
 assert.equal(ctx.inventoryEquipped("main"),6);
 assert.equal(ctx.favPrim,6);
 assert.equal(stored.has("bbfps_inventory_v1"),false,'backend equipment is never written to localStorage');
});
test("Locked variants, invalid IDs and direct browser claims are rejected",()=>{
 const {ctx}=state();
 for(const id of [7,-1,99,0,4,5,6,9]){
   assert.equal(ctx.inventoryClaimPrimary(id),false);
   assert.equal(ctx.inventoryEquip("main",id),false);
 }
 assert.deepEqual(Array.from(ctx.inventoryOwned("main")),[]);
});
test("Pre-round selection and priced shop reject browser-generated ownership claims",()=>{
 assert.match(controls,/function refreshWeaponSelection\(\)/);
 assert.match(controls,/var owned=inventoryOwned\("main"\)/);
 assert.match(controls,/WSEL\.indexOf\(id\)<0\|\|inventoryOwned\("main"\)\.indexOf\(id\)<0/);
 assert.match(shop,/function shopRender\(\)/);
 assert.match(shop,/PB_ONLINE\.buyWeapon\(id,key\)/);
 assert.match(shop,/shopServerItems\.get\(id\)/);
 assert.doesNotMatch(shop,/UNLOCK FREE/);
 assert.match(inventory,/function inventoryClaimPrimary\(\)\{return false;\}/);
 assert.match(read("index.html"),/id="lbshop"/);
 assert.match(read("index.html"),/id="lshop"/);
 assert.match(read("src/game/85-lobby-and-match.js"),/"lbshop"/);
});
test("AI keeps approved primary pool without K2 or removed BOT RPG",()=>{
 assert.match(bot,/primaries:\[1,1,1,2,2,6,6,6,7,8\]/);
 assert.doesNotMatch(bot,/primaries:\[[^\]]*,3\]/);
 assert.doesNotMatch(bot,/WEAPON_STARTER_ID/);
 assert.match(bot,/BOT_WEAPONS\.primaries/);
});
test("Original 13 weapon IDs preserve indexed viewmodel, audio and drop values",()=>{
 const combat=read("src/game/45-combat.js");
 const audio=read("src/game/65-audio.js");
 const drops=read("src/game/50-items-and-drops.js");
 assert.match(read("src/game/weapon/30-viewmodels.js"),/guns=WEAPON_PROFILES\.map/);
 assert.equal(numberAt(combat,"MZ",12),-1.38);
 assert.equal(numberAt(audio,"SFXI",12),1);
 assert.equal(numberAt(drops,"GSC",12),1.23);
 assert.equal(numberAt(drops,"GH",12),.09);
 const vm=read("src/game/weapon/30-viewmodels.js");
 assert.equal(numberAt(vm,"MODE",12),0);
 assert.equal(numberAt(vm,"NC",12),1);
});
test("Compiled game bundle is exactly the ordered source parts",()=>{
 const m=JSON.parse(read("tools/source-manifest.json"));
 assert.ok(m.parts.includes("src/game/89-shop.js"));
 assert.ok(m.styles.includes("src/styles/10-shop.css"));
 assert.equal(read("assets/game.js"),"(function(){\n"+m.parts.map(read).join("")+"})();\n");
});
