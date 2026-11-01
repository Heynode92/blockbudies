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

test('Menu music uses a bundled MP3 and only runs in menu/room states', () => {
 const controller=read('src/audio/menu-bgm.js');
 const lobby=read('src/game/85-lobby-and-match.js');
 const rooms=read('src/game/83-room-lobby.js');
 const combat=read('src/game/70-kills-and-damage-hud.js');
 const plugin=read('tools/vite-game-plugin.mjs');
 assert.match(entry,/import menuMusic from '\.\/assets\/audio\/Pointblock_bgm\.mp3\?url'/);
 assert.match(entry,/const menuBgm = createMenuBgm\(menuMusic\)/);
 assert.match(entry,/mountPointBlock\(THREE, Object\.freeze\(\{ deathmatch: deathmatchVideo, bomb: bombVideo \}\), menuBgm\)/);
 assert.match(plugin,/mountPointBlock\(THREE, GAME_ASSET_URLS, MENU_BGM\)/);
 assert.match(controller,/sound\.loop = true/);
 assert.match(controller,/events\.addEventListener\('pointerdown'/);
 assert.match(controller,/events\.addEventListener\('keydown'/);
 assert.match(lobby,/if\(lob&&!run\)MENU_BGM\.enterMenu\(\)/);
 assert.match(rooms,/MENU_BGM\.leaveMenu\(\); \/\/ Smooth 1\.4s fade/);
 assert.match(rooms,/if\(returningFromLoading&&lob&&!run\)MENU_BGM\.enterMenu\(\)/);
 assert.match(combat,/function begin\(tm\)\{MENU_BGM\.leaveMenu\(\)/);
 assert.doesNotMatch(read('index.html'),/id=".*bgm.*"/i);
});

test('Hidden-tab worker and fixed-step simulation are injected without changing scene render loop', () => {
 const source=read('src/game/99-render-loop.js');
 const plugin=read('tools/vite-game-plugin.mjs');
 assert.match(entry,/import \{ createBackgroundTicker \} from '\.\/background\/background-ticker\.js'/);
 assert.match(entry,/import \{ createSimulationClock \} from '\.\/background\/simulation-clock\.js'/);
 assert.match(entry,/const backgroundTicker = createBackgroundTicker\(\)/);
 assert.match(plugin,/mountPointBlock\(THREE, GAME_ASSET_URLS, MENU_BGM, BACKGROUND_SIM\)/);
 assert.match(source,/backgroundGameClock\.tickBackground\(performance\.now\(\)\)/);
 assert.match(source,/if\(!document\.hidden\)backgroundGameClock\.tickVisible\(now\)/);
 assert.match(source,/BACKGROUND_SIM\.ticker\.setHidden\(document\.hidden\)/);
 assert.match(source,/document\.addEventListener\("visibilitychange",backgroundOnVisibility\)/);
 assert.match(source,/backgroundReconcileMatchTimers\(seconds\)/);
 assert.match(source,/bombUpdate\(0\)/);
 assert.match(source,/requestAnimationFrame\(loop\)/);
 assert.doesNotMatch(source,/if\(run\)update\(pl\.dead/);
});
