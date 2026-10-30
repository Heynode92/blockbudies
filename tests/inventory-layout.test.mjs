import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),read=p=>readFileSync(resolve(root,p),'utf8').replace(/\r\n/g,'\n');
const css=read('src/styles/09-inventory.css'),js=read('src/game/89-inventory.js');
const rule=selector=>{
 const key=selector+'{';
 let start=css.indexOf(key);
 // Skip a selector when it occurs only as the trailing member of a comma-separated rule.
 while(start>0&&css[start-1]===',')start=css.indexOf(key,start+key.length);
 assert.ok(start>=0,'CSS selector exists: '+selector);
 return css.slice(start,css.indexOf('}',start)+1);
};
test('inventory two-column shell fills its viewport independently of item counts',()=>{
 const base=rule('#lbiv.on');
 assert.match(base,/grid-template-columns:minmax\(310px,34%\) minmax\(0,1fr\)/);
 assert.match(base,/grid-template-rows:minmax\(0,1fr\)/);
 assert.match(base,/align-items:stretch/);
 assert.doesNotMatch(base,/minmax\(0,65%\)/);
 const panel=rule('.ivright');
 assert.match(panel,/display:grid;grid-template-rows:auto auto auto minmax\(0,1fr\)/);
 assert.match(rule('.ivleft,.ivright'),/height:100%;align-self:stretch/);
});
test('only weapon area scrolls on desktop and cards never stretch to fill empty rows',()=>{
 const list=rule('#ivcards');
 assert.match(list,/grid-auto-rows:142px/);
 assert.match(list,/overflow-y:auto/);
 assert.match(list,/align-content:start/);
 assert.doesNotMatch(list,/grid-auto-rows:minmax\(123px,1fr\)/);
 assert.match(rule('.ivcard'),/height:142px/);
 assert.match(css,/#ivcards\{grid-auto-rows:112px;gap:8px\}/);
});
test('tablet and phone keep a bounded collection scroller with responsive cards',()=>{
 assert.match(css,/#ivcards\{height:auto;min-height:180px;max-height:52vh;overflow-y:auto;grid-auto-rows:142px\}/);
 assert.match(css,/#ivcards\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.match(css,/#ivtabs\{flex-wrap:nowrap;overflow-x:auto/);
});
test('changing tab or selected card preserves per-category weapon-list scroll',()=>{
 assert.match(js,/var inventoryTab="main",inventoryPick=\{\},inventoryScroll=\{\}/);
 assert.match(js,/inventoryScroll\[inventoryTab\]=cards\.scrollTop;inventoryTab=c\.key;inventoryRender\(\)/);
 assert.match(js,/inventoryScroll\[inventoryTab\]=cards\.scrollTop;inventoryPick\[inventoryTab\]=id;inventoryRender\(\)/);
 assert.match(js,/cards\.scrollTop=inventoryScroll\[inventoryTab\]\|\|0/);
 assert.match(js,/document\.getElementById\("ivcards"\)\.addEventListener\("scroll"/);
});
test('secondary and other tabs show their own player-facing instructions, without new weapon mechanics',()=>{
 for(const tab of ['main','secondary','mele','explosive','item'])
   assert.match(js,new RegExp(' '+tab+':"'));
 assert.match(js,/INVENTORY_HINTS\[inventoryTab\]/);
 assert.match(js,/inventoryEquipped\(cat\)/);
 assert.match(js,/function inventoryEquip\(cat,id\)/);
 assert.match(js,/INVENTORY_THUMBS\[id\]/);
});
test('committed runtime remains exactly the ordered game modules',()=>{
 const manifest=JSON.parse(read('tools/source-manifest.json'));
 const expected="(function(){\n"+manifest.parts.map(read).join("")+"})();\n";
 assert.equal(read('assets/game.js'),expected);
});
