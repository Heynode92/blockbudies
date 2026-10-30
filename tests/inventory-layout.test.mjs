import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8').replace(/\r\n/g,'\n');
const css=read('src/styles/12-inventory-armory.css'),oldCSS=read('src/styles/09-inventory.css'),
      html=read('index.html'),js=read('src/game/89-inventory.js');
test('inventory displays the approved compact three-column armory with a shared top bar',()=>{
 assert.match(css,/#lbiv\.on\{[^}]*grid-template-columns:minmax\(225px,1\.03fr\) minmax\(0,2\.28fr\) minmax\(250px,1\.08fr\)/);
 assert.match(css,/#lbiv \.ivtop\{[^}]*grid-column:1\/-1/);
 for(const id of ['ivtabs','ivclasses','ivsort','ivviewtoggle','ivcards','ivpreview','ivdetailthumb','ivdetailname','ivstats','ivdescription','ivuse'])
   assert.ok(html.includes('id="'+id+'"'),id+' is present');
 assert.match(html,/CHOOSE YOUR LOADOUT/);
 assert.match(html,/WEAPON DETAILS/);
 assert.match(css,/#lbiv \.ivleft\{grid-column:1/);
 assert.match(css,/#lbiv \.ivright\{grid-column:2/);
 assert.match(css,/#lbiv \.ivdetails\{grid-column:3/);
});
test('three-column weapon grid has fixed rows, a single scroller and status badges',()=>{
 assert.match(css,/#lbiv #ivcards\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\);grid-auto-rows:clamp\(142px,21vh,215px\)/);
 assert.match(css,/#lbiv #ivcards\{[^}]*overflow-y:auto/);
 assert.match(css,/#lbiv \.ivcard\.selected\{border:2px solid #ffa12e/);
 assert.match(css,/#lbiv \.ivcard\.equipped \.ivmark\{background:#00dd7b/);
 assert.match(css,/#lbiv \.ivcard\.locked\{opacity:/);
 assert.match(oldCSS,/#ivcards\{[^}]*overflow-y:auto/);
});
test('filters, sorting and list toggle work without altering ownership or saved equipment',()=>{
 assert.match(js,/var inventoryClass="all",inventorySort="default",inventoryList=false/);
 for(const label of ['ASSAULT','SMG','SNIPER','SHOTGUN','LAUNCHER'])assert.ok(js.includes('"'+label+'"'));
 assert.match(js,/inventoryClass=item\[0\];inventoryScroll\[inventoryTab\]=0;inventoryRender\(\)/);
 assert.match(js,/inventorySort=this.value;inventoryScroll\[inventoryTab\]=0;inventoryRender\(\)/);
 assert.match(js,/inventoryList=!inventoryList;inventoryScroll\[inventoryTab\]=0;inventoryRender\(\)/);
 assert.match(js,/if\(inventoryTab!=="main"\)return ids/);
 assert.match(js,/var ids=inventoryViewIds\(\),owned=inventoryOwned\(inventoryTab\)/);
 assert.match(js,/lockedSelection\?\s*"UNLOCK IN SHOP"/);
 assert.match(js,/if\(lockedSelection\)\{if\(typeof shopOpen==="function"\)shopOpen\(\);return;\}/);
});
test('small viewports retain usable inventory controls and a responsive equipment panel',()=>{
 assert.match(css,/@media\(max-width:1160px\)/);
 assert.match(css,/@media\(max-width:680px\)/);
 assert.match(css,/#lbiv #ivcards\{height:auto;max-height:63vh;grid-template-columns:repeat\(2/);
 assert.match(css,/#lbiv \.ivdetails\{grid-column:1;grid-row:4/);
 assert.match(css,/#lbiv \.ivstats\{display:flex;flex-direction:column/);
});
test('gear tabs, real character preview and scroll continuity remain intact',()=>{
 assert.match(js,/var inventoryTab="main",inventoryPick=\{\},inventoryScroll=\{\}/);
 assert.match(js,/inventoryScroll\[inventoryTab\]=cards\.scrollTop;inventoryTab=c\.key;inventoryRender\(\)/);
 assert.match(js,/inventoryScroll\[inventoryTab\]=cards\.scrollTop;inventoryPick\[inventoryTab\]=id;inventoryRender\(\)/);
 assert.match(js,/cards\.scrollTop=inventoryScroll\[inventoryTab\]\|\|0/);
 assert.match(js,/document\.getElementById\("ivcards"\)\.addEventListener\("scroll"/);
 assert.match(js,/INVENTORY_HINTS\[inventoryTab\]/);
 assert.match(js,/inventoryShowModel\(selected\)/);
 assert.match(js,/INVENTORY_THUMBS\[id\]/);
});
test('asset manifest includes new CSS and browser JS equals the original ordered source',()=>{
 const m=JSON.parse(read('tools/source-manifest.json'));
 assert.ok(m.styles.includes('src/styles/12-inventory-armory.css'));
 assert.equal(read('assets/game.js'),'(function(){\n'+m.parts.map(read).join('')+'})();\n');
});
