import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=path=>readFileSync(resolve(root,path),"utf8");
const script=read("src/game/89-inventory.js"),css=read("src/styles/09-inventory.css");
test("Standard Helmet is owned gear, separate from weapon profiles and always equipped",()=>{
 assert.match(script,/\{key:"helm",label:"HELM",kinds:\[\]\}/);
 assert.match(script,/id:"standard_helmet",name:"Standard Helmet"/);
 assert.match(script,/if\(INVENTORY_GEAR\[cat\]\)return INVENTORY_GEAR\[cat\]\.map/);
 assert.doesNotMatch(read("src/game/40-weapons-and-viewmodels.js"),/standard_helmet/);
 assert.match(read("src/game/39-defense.js"),/actor\.helm=true/);
});
test("Uses actual game helmet geometry, head close-up, and no invisible weapon",()=>{
 assert.match(script,/mkHelm\(0x1c3d7a\)/);
 assert.match(script,/p\.camera\.lookAt\(0,1\.68,0\)/);
 assert.match(script,/p\.mount\.visible=false/);
 assert.match(read("src/game/30-characters.js"),/hm=mkHelm\(K\.hm,ms\)/);
});
test("ITEM shows complete tactical gear empty screen",()=>{
 assert.match(script,/NO TACTICAL ITEM YET/);
 assert.match(script,/COMING SOON/);
 assert.match(script,/INVENTORY_CRATE_SVG/);
 assert.match(script,/classList\.toggle\("ivcards-empty",!ids\.length\)/);
 assert.match(css,/#ivcards\.ivcards-empty\{display:flex/);
 assert.match(css,/#ivcards \.ivempty-gear/);
});
test("Other categories, Kriss V mode and loadout persistence remain unchanged",()=>{
 assert.match(script,/function inventoryEquip\(cat,id\)/);
 assert.match(script,/localStorage\.setItem/);
 assert.match(script,/if\(c\.key==="main"&&wish===7\)wish=6/);
 assert.match(read("src/game/75-weapon-controls.js"),/function toggleDual\(\)/);
 assert.match(script,/Custom helmets will arrive in future updates/);
});
test("Bundled game exactly matches modular source order",()=>{
 const m=JSON.parse(read("tools/source-manifest.json"));
 assert.equal(read("assets/game.js"),"(function(){\n"+m.parts.map(read).join("")+"})();\n");
});
