import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),".."),read=p=>readFileSync(resolve(root,p),"utf8").replace(/\r\n/g,'\n');
const code=read("src/game/89-inventory.js"),css=read("src/styles/09-inventory.css");
test("Inventory Kriss is a single owned item while V mode remains in gameplay",()=>{
 const main=code.slice(code.indexOf('key:"main"'),code.indexOf('key:"secondary"'));
 assert.ok(main.includes('"smg"'));assert.ok(!main.includes('"dual"'));
 assert.match(code,/if\(c\.key==="main"&&wish===7\)wish=6/);
 assert.match(code,/Press V in a match/);
 assert.match(read("src/game/75-weapon-controls.js"),/function toggleDual\(\)/);
});
test("Colorful thumbnails come from mkGun meshes, not SVG silhouettes",()=>{
 assert.match(code,/function inventoryBuildThumbnails\(\)/);
 assert.match(code,/mkGun\(id\)/);
 assert.match(code,/preserveDrawingBuffer:true/);
 assert.match(code,/\.toDataURL\("image\/png"\)/);
 assert.match(code,/INVENTORY_THUMBS\[id\]/);
 assert.doesNotMatch(code,/SV\[id\]/);
 assert.match(css,/\.ivthumb\{/);
});
test("Character inventory preview uses gameplay IK for each hand, not floating default rifle",()=>{
 assert.match(code,/var actor=terro\(0\)/);
 assert.match(code,/if\(actor\.g\.userData\.rg\)mount\.remove/);
 assert.match(code,/function inventoryPoseFrame\(p,now\)/);
 assert.match(code,/aimA\(a\.arms\[1\]/);
 assert.match(code,/aimA\(a\.arms\[0\]/);
 assert.match(code,/INVENTORY_POSES=/);
 for(const type of ["rifle","shotgun","smg","sniper","rocket","pistol","knife","grenade"])assert.ok(code.includes(type+":{gun:"));
});
test("Inventory still persists to localStorage and maintains game-ready equipment",()=>{
 assert.match(code,/inventoryState\.equipped\[cat\]=id/);
 assert.match(code,/localStorage\.setItem/);
 assert.match(code,/function inventoryForNewMatch\(\)/);
 assert.match(code,/inventoryRender\(\);inventoryStartPreview\(\)/);
});
test("Committed assets/game.js matches ordered modular sources",()=>{
 const m=JSON.parse(read("tools/source-manifest.json"));
 assert.equal(read("assets/game.js"),"(function(){\n"+m.parts.map(read).join("")+"})();\n");
});
