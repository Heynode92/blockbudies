import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pointBlockGamePlugin } from '../tools/vite-game-plugin.mjs';

const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const manifest = JSON.parse(read('tools/source-manifest.json'));
const html = read('index.html');
const entry = read('src/main.js');

test('Vite uses ESM npm Three.js and a single engine bootstrap', () => {
 assert.match(entry, /import \* as THREE from 'three'/);
 assert.match(entry, /mountPointBlock\(THREE,/);
 assert.doesNotMatch(entry, /virtual:pointblock-styles/);
 assert.match(html, /<script type="module" src="\.\/src\/main\.js"><\/script>/);
 assert.doesNotMatch(html, /cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js/);
 assert.doesNotMatch(html, /<script src="\.\/assets\/game\.js"><\/script>/);
 assert.equal(JSON.parse(read('package.json')).dependencies.three, '0.128.0');
});
test('All existing game parts compile in original order; no gameplay files dropped', () => {
 const plugin = pointBlockGamePlugin(root);
 const files = new Set();
 const id = plugin.resolveId('virtual:pointblock-game');
 const code = plugin.load.call({addWatchFile(path){files.add(path);}},id);
 const oldBundle = read('assets/game.js');
 const oldSource = '(function(){\n'+manifest.parts.map(read).join('').replace(/\r\n/g,'\n')+'})();\n';
 assert.equal(oldBundle.replace(/\r\n/g,'\n'),oldSource);
 const expected = `export function mountPointBlock(THREE, GAME_ASSET_URLS) {\n${manifest.parts.map(read).join('').replace(/\r\n/g,'\n')}\n}\n`;
 assert.equal(code, expected);
 assert.ok(files.has(resolve(root,'tools/source-manifest.json')));
});
test('All 15 CSS files block first paint from HTML head in original cascade order', () => {
 assert.equal(manifest.styles.length,15);
 const links=[...html.matchAll(/<link rel="stylesheet" href="\.\/(src\/styles\/[^"]+\.css)">/g)]
  .map(match=>match[1]);
 assert.deepEqual(links,manifest.styles);
 assert.ok(html.indexOf(links[0])<html.indexOf('</head>'));
 assert.match(html,/html\.pb-route-restoring #lb \{ visibility:hidden; \}/);
 assert.match(html,/document\.documentElement\.classList\.add\("pb-route-restoring"\)/);
 const route=read('src/game/85-navigation-routes.js');
 assert.match(route,/document\.documentElement\.classList\.remove\("pb-route-restoring"\)/);
 assert.doesNotMatch(entry,/virtual:pointblock-styles/);
});
test('Production videos resolve through Vite imports and all routes remain available', () => {
 const home=read('src/game/82-home-showcase.js');
 assert.match(home,/src:GAME_ASSET_URLS\.deathmatch/);
 assert.match(home,/src:GAME_ASSET_URLS\.bomb/);
 assert.match(entry,/deatch_match_demo\.mp4\?url/);
 assert.match(entry,/bomb_mission_demo\.mp4\?url/);
 const route=read('src/game/85-navigation-routes.js');
 for (const path of ['/loby','/loby/room/','/inventory','/shop'])
   assert.ok(route.includes('"'+path+'"'), 'Missing route '+path);
});
