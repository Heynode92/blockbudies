import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),read=p=>readFileSync(resolve(root,p),'utf8').replace(/\r\n/g,'\n');
const html=read('index.html'),inv=read('src/game/89-inventory.js'),css=read('src/styles/09-inventory.css');
test('Main armory uses player-friendly copy, not internal implementation language',()=>{
 assert.match(html,/CHOOSE YOUR LOADOUT/);assert.match(html,/WEAPON DETAILS/);
 assert.doesNotMatch(html,/EQUIP ONE PER CATEGORY|YOUR OWNED WEAPONS|CHARACTER LOADOUT/);
 assert.match(inv,/NO TACTICAL ITEM YET/);
 assert.match(inv,/UNLOCK IN SHOP/);assert.match(inv,/function inventoryEquip\(cat,id\)/);
});
test('Weapon cards show 3D image, name, equip state but no raw stat telemetry',()=>{
 assert.doesNotMatch(inv,/DMG '\+p\.damage|SPD '\+p\.speed/);
 assert.match(inv,/<span class="ivweaponicon">/);
 assert.match(inv,/<span class="ivweaponinfo"><strong>/);
 assert.match(read('src/styles/12-inventory-armory.css'),/\.ivweaponinfo small\{display:block/);
 assert.match(inv,/renderer\.domElement\.toDataURL\("image\/png"\)/);
});
test('Pistol weapon renamed Handgun without changes to combat identity or damage',()=>{
 const weapons=read('src/game/weapon/01-handgun.js');
 assert.match(weapons,/name:"Handgun",damage:26/);
 assert.match(html,/<span id="wn">Handgun<\/span>/);
 assert.match(read('src/game/75-weapon-controls.js'),/\["","Handgun","Knife","Grenade"\]/);
 assert.match(inv,/pistol:"Your trusty backup/);
});
test('Game arena visible behind tactical HUD and no vertical double-scroll on desktop',()=>{
 assert.match(css,/#lbiv\.on\{/);
 assert.match(css,/body\.lobby:has\(#lbiv\.on\) #gl/);
 assert.match(css,/backdrop-filter:blur/);
 assert.match(css,/#ivcards\{[^}]*overflow-y:auto/);
 assert.match(css,/#lbiv\.on\{[^}]*overflow:hidden/);
});
test('Gameplay bundle exactly reflects all ordered modular source parts',()=>{
 const m=JSON.parse(read('tools/source-manifest.json'));
 assert.equal(read('assets/game.js'),"(function(){\n"+m.parts.map(read).join("")+"})();\n");
});
