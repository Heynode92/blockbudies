import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),".."),read=p=>readFileSync(resolve(root,p),"utf8").replace(/\r\n/g,'\n');
const html=read("index.html"),inventory=read("src/game/89-inventory.js"),lobby=read("src/game/85-lobby-and-match.js"),slots=read("src/game/75-weapon-controls.js"),m=JSON.parse(read("tools/source-manifest.json"));
test("Inventory menu, 3D preview and six tabs are connected",()=>{
 for(const id of ["lbin","lbiv","ivpreview","ivcards","ivuse","ivtabs","ivback"])assert.ok(html.includes('id="'+id+'"'));
 for(const t of ["MAIN WEAPON","SECONDARY","MELE","EXPLOSIVE","HELM","ITEM"])assert.ok(inventory.includes(t));
 assert.match(inventory,/terro\(0\)/);assert.match(inventory,/mkGun\(id\)/);assert.match(inventory,/new T\.WebGLRenderer/);
});
test("One equipped weapon per category and persistent saved loadout",()=>{
 assert.match(inventory,/inventoryState\.equipped\[cat\]=id/);
 assert.match(inventory,/localStorage\.setItem/);assert.match(inventory,/localStorage\.getItem/);
 assert.match(lobby,/function startMatch\(tm\)\{inventoryForNewMatch\(\)/);
 assert.match(slots,/inventoryEquipped\("secondary"\)/);
 assert.match(slots,/inventoryEquipped\("mele"\)/);
 assert.match(slots,/inventoryEquipped\("explosive"\)/);
 assert.match(slots,/function refreshWeaponSelection\(\)/);
});
test("New inventory module follows lobby, precedes gameplay, and bundle stays exact",()=>{
 const ix=m.parts.indexOf("src/game/89-inventory.js");
 assert.ok(ix>m.parts.indexOf("src/game/85-lobby-and-match.js"));
 assert.ok(ix<m.parts.indexOf("src/game/90-bot-ai.js"));
 assert.ok(m.styles.includes("src/styles/09-inventory.css"));
 assert.equal(read("assets/game.js"),"(function(){\n"+m.parts.map(read).join("")+"})();\n");
});
