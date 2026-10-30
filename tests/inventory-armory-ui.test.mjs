import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8').replace(/\r\n/g,'\n');
const inv=read('src/game/89-inventory.js'),css=read('src/styles/12-inventory-armory.css'),html=read('index.html');
test('all nine primary weapons appear while Shop retains ownership authority',()=>{
 assert.match(inv,/inventoryTab==="main"\?inventoryCatalogMain\(\):inventoryOwned\(inventoryTab\)/);
 assert.match(inv,/var locked=owned\.indexOf\(id\)<0/);
 assert.match(inv,/locked\?"LOCKED":id===equipped\?"IN USE":""/);
 assert.match(inv,/if\(lockedSelection\)\{if\(typeof shopOpen==="function"\)shopOpen\(\);return;\}/);
});
test('class filters operate on natural catalog order',()=>{
 const start=inv.indexOf('var inventoryClass="all"'),end=inv.indexOf('function inventoryCatalogMain(){',start);
 const data={1:['AK-47','rifle',33],2:['Shotgun','shotgun',168],3:['RPG','rocket',85],
  6:['Kriss','smg',21],8:['AWP','sniper',81],9:['K2','rifle',36],10:['MP7','smg',21],
  11:['P90','smg',24],12:['AK SOPMOD','rifle',33]};
 const ctx={Math,Number,inventoryTab:'main',WP:Array.from({length:13},(_,i)=>({
  n:data[i]?.[0]||'Unknown',stats:{kind:data[i]?.[1],damage:data[i]?.[2]||0}})),
  inventoryCatalogMain(){return[1,2,3,6,8,9,10,11,12];},inventoryOwned(){return[9,1];}};
 runInNewContext(inv.slice(start,end),ctx);
 assert.equal(ctx.inventoryViewIds().length,9);
 ctx.inventoryClass='smg';assert.deepEqual(Array.from(ctx.inventoryViewIds()),[6,10,11]);
 ctx.inventoryClass='all';assert.deepEqual(Array.from(ctx.inventoryViewIds()),[1,2,3,6,8,9,10,11,12]);
});
test('approved three-column layout, live thumbnails and status controls are wired',()=>{
 for(const id of ['ivpreview','ivdetailthumb','ivdetailname','ivdetailclass','ivstats','ivclasses'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(inv,/INVENTORY_THUMBS\[selected\]/);
 assert.match(inv,/inventoryShowModel\(selected\)/);
 assert.match(inv,/inventoryStatPercent\(pair\[0\],numeric,weapon\)/);
 assert.doesNotMatch(css,/\.iv-list/);
 assert.match(css,/@media\(max-width:680px\)/);
});
test('all six categories and equipped values retain inventory persistence',()=>{
 assert.match(inv,/function inventoryEquip\(cat,id\)/);
 assert.match(inv,/inventoryOwned\(cat\)\.indexOf\(id\)<0/);
 assert.match(inv,/localStorage\.setItem\(INVENTORY_STORAGE/);
 for(const k of ['main','secondary','mele','explosive','helm','item'])assert.ok(inv.includes('key:"'+k+'"'));
});
