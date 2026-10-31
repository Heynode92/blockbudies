import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const read=path=>readFileSync(resolve(root,path),'utf8');

// Rebrand affects shipped UI, canonical source and QA tooling, not original fixtures.
test('PointBlock is the shipped game identity',()=>{
 const html=read('index.html');
 const css=read('src/styles/13-home-header.css');
 const bundle=read('assets/game.js');
 assert.match(html,/<title>Point Block FPS<\/title>/);
 assert.match(html,/home-brand-point">POINT<\/span><span class="home-brand-block">BLOCK<\/span>/);
 assert.match(html,/>POINT BLOCK<\/b>/);
 assert.match(css,/\.home-brand-point/);
 assert.match(css,/\.home-brand-block/);
 assert.match(bundle,/show\("Point Block FPS"/);
 for(const [name,value] of [['index.html',html],['assets/game.js',bundle]]){
  assert.doesNotMatch(value,/(?:Blok|Block|BLOK|BLOCK)[ _-]?Budd?ies/i,
   name+' must not display old game branding');
 }
});

test('PointBlock QA API and schema stay in sync across source, bundle and tests',()=>{
 const source=read('src/game/94-bot-qa.js');
 const bundle=read('assets/game.js');
 const bridge=read('tools/bot-ai-m7-browser-bridge.js');
 const browser=read('tools/bot-ai-m7-browser.mjs');
 const qaTest=read('tests/bot-ai-m7-qa.test.mjs');
 for(const text of [source,bundle]){
  assert.match(text,/window\.PointBlockQA/);
  assert.match(text,/POINT_BLOCK_M7_QA_V1/);
  assert.match(text,/point-block-m7-qa\.json/);
 }
 assert.match(bridge,/window\.__PointBlockM7CI/);
 assert.match(browser,/window\.__PointBlockM7CI/);
 assert.match(qaTest,/window\.PointBlockQA/);
 assert.doesNotMatch(browser,/BlockBuddies/);
});

test('repository path and original fixture remain stable until separate migration',()=>{
 const readme=read('README.md');
 assert.match(readme,/https:\/\/github\.com\/Heynode92\/blockbudies\.git/);
 const fixture=read('tests/fixtures/source-original.html');
 assert.match(fixture,/<title>Blok Buddies FPS<\/title>/);
});
