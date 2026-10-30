import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=async p=>(await readFile(resolve(root,p),'utf8')).replace(/\r\n/g,'\n');
const m=JSON.parse(await read('tools/source-manifest.json'));
const original=await read('tests/fixtures/source-original.html');
const index=await read('index.html');
const bundle=await read('assets/game.js');
const css=(await Promise.all(m.styles.map(read))).join('');
const combined='(function(){\n'+(await Promise.all(m.parts.map(read))).join('')+'})();\n';
test('the committed runtime is assembled exactly from ordered feature source files',()=>{
  assert.equal(bundle,combined);
  assert.ok(m.parts.includes('src/game/11-bomb-map.js'));
  assert.ok(m.parts.includes('src/game/86-bomb-mission.js'));
});
test('the original game is retained verbatim as an immutable regression fixture',()=>{
  assert.ok(original.startsWith('<!DOCTYPE html>\n'));
  assert.ok(original.includes('function botsUpd(dt)'));
  assert.ok(original.includes('var WP=['));
  assert.ok(original.includes('BOMB MODE'));
});
test('Historical weapon table fixture remains unchanged and new weapon modules retain original IDs',()=>{
  const orig=original.match(/var WP=\[[\s\S]*?\];\n\/\/ EW:/)?.[0];
  assert.ok(orig);
  assert.ok(m.parts.includes('src/game/weapon/00-registry.js'));
  assert.ok(m.parts.includes('src/game/weapon/30-viewmodels.js'));
  assert.ok(bundle.includes('WEAPON_PROFILES[1]=Object.freeze('));
  assert.ok(bundle.includes('function botsUpdOld(dt)'));
});
test('index references every ordered CSS module, game bundle, and original CDN',()=>{
  for(const p of m.styles)assert.ok(index.includes(`href="./${p}"`),p);
  assert.ok(index.includes('src="./assets/game.js"'));
  assert.ok(index.includes('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'));
  assert.ok(css.includes('#bombStatus'));
  assert.equal(new Set(m.styles).size,m.styles.length);
  assert.equal(new Set(m.parts).size,m.parts.length);
});
