import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8').replace(/\r\n/g,'\n');
const css=read('src/styles/12-inventory-armory.css');
const html=read('index.html');
const inv=read('src/game/89-inventory.js');
const panel=html.slice(html.indexOf('<section id="lbiv"'),html.indexOf('<section id="lbshop"'));
test('inventory header removes Block Buddies branding and keeps one functional Back button',()=>{
 assert.doesNotMatch(panel,/class="ivbrand"|aria-label="Block Buddies"/);
 assert.doesNotMatch(css,/\.ivbrand/);
 assert.equal((panel.match(/id="ivback"/g)||[]).length,1);
 assert.match(inv,/getElementById\("ivback"\)\.addEventListener\("click"/);
});
test('the six main navigation tabs have consistent equal-width slots and no space-between',()=>{
 assert.match(css,/#lbiv #ivtabs\{[^}]*display:grid;grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
 assert.match(css,/#lbiv #ivtabs button\{[^}]*min-height:46px;box-sizing:border-box/);
 assert.doesNotMatch(css,/#lbiv #ivtabs\{[^}]*justify-content:space-between/);
 assert.match(css,/#lbiv \.ivtop-actions\{grid-column:3;grid-row:1/);
});
test('category filters occupy their own row and tools align to a right-hand dock',()=>{
 assert.match(css,/#lbiv \.ivfilters\{display:grid;grid-template-columns:minmax\(0,1fr\);grid-template-rows:auto auto/);
 assert.match(css,/#lbiv \.ivclasses\{grid-column:1;grid-row:1/);
 assert.match(css,/#lbiv \.ivtools\{grid-column:1;grid-row:2/);
 assert.match(css,/#lbiv \.ivclasses\{[^}]*flex-wrap:wrap/);
 assert.match(css,/#lbiv \.ivtools\{display:flex;align-items:center;justify-content:flex-end/);
 assert.match(css,/#lbiv \.ivtools select\{flex:0 0 151px;width:151px;min-width:151px;max-width:151px/);
 assert.match(css,/#lbiv \.ivtools button\{[^}]*flex:0 0 96px/);
 assert.match(html,/class="ivsort-label">SORT BY/);
 assert.match(html,/aria-label="Switch to list view"/);
 assert.match(inv,/layout\.innerHTML=inventoryList\?/);
 assert.match(inv,/Switch to grid view/);
 assert.match(inv,/inventorySort=this.value;inventoryScroll\[inventoryTab\]=0;inventoryRender\(\)/);
 assert.match(inv,/inventoryList=!inventoryList;inventoryScroll\[inventoryTab\]=0;inventoryRender\(\)/);
});
test('tablet and mobile use deterministic stacked toolbar and tab rows',()=>{
 assert.doesNotMatch(css,/@media\(min-width:1161px\) and \(max-width:1399px\)/);
 assert.match(css,/@media\(max-width:1160px\)/);
 assert.match(css,/#lbiv #ivtabs\{grid-column:1\/-1;grid-row:2;grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:680px\)/);
 assert.match(css,/#lbiv #ivtabs\{grid-column:1\/-1;grid-row:2;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/#lbiv \.ivclasses\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});
test('inventory layout update does not change game scripts or model rendering',()=>{
 const m=JSON.parse(read('tools/source-manifest.json'));
 assert.ok(m.styles.includes('src/styles/12-inventory-armory.css'));
 assert.match(panel,/id="ivpreview"/);
 assert.match(panel,/id="ivdetailthumb"/);
 assert.match(panel,/id="ivuse"/);
 assert.equal(read('assets/game.js'),'(function(){\n'+m.parts.map(read).join('')+'})();\n');
});
