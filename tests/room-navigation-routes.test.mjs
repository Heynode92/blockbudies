import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../'+p, import.meta.url), 'utf8');
const html=read('index.html');
const lobby=read('src/game/85-lobby-and-match.js');
const route=read('src/game/85-navigation-routes.js');
const esc=read('src/game/90-bot-ai.js');
const css=read('src/styles/05-match.css');
const manifest=JSON.parse(read('tools/source-manifest.json'));
const bundle=read('assets/game.js');

test('all requested routes are declared and bundled in correct module order', () => {
 for (const [panel,path] of Object.entries({
  lbs:'/', lbrooms:'/loby', lbroomlive:'/loby/room/', lbiv:'/inventory', lbshop:'/shop'
 })) {
  assert.match(route, new RegExp(panel+':"'+path.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'"'));
 }
 assert.ok(manifest.parts.includes('src/game/85-navigation-routes.js'));
 assert.equal(manifest.parts.indexOf('src/game/85-navigation-routes.js'),
  manifest.parts.indexOf('src/game/85-lobby-and-match.js')+1);
 assert.ok(bundle.includes(route));
});
test('ESC exit is confirmed and YES goes to Room List, not Home', () => {
 for(const id of ['escConfirm','escConfirmYes','escConfirmNo'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(html,/ARE YOU SURE\?/);
 assert.match(esc,/escConfirmYes"\)\.onclick=function\(\)\{matchExitToLobby\("list"\)/);
 assert.match(esc,/escConfirmNo"\)\.onclick=escConfirmClose/);
 assert.doesNotMatch(esc,/document\.getElementById\("dmn"\)\.onclick\(\)/);
 assert.match(css,/#esc \.esc-confirm\[hidden\]/);
});
test('results return to existing room and Room List back returns Home', () => {
 assert.match(html,/id="dmn">BACK TO ROOM<\/button>/);
 assert.match(lobby,/document\.getElementById\("dmn"\)\.onclick=function\(\)\{matchExitToLobby\("room"\)/);
 assert.match(lobby,/roomLobbyOpen\(\)/);
 const rooms=read('src/game/83-room-lobby.js');
 assert.match(rooms,/roomBack"\)\.addEventListener\("click",function\(\)\{if\(roomCurrent\)roomLiveOpen\(roomCurrent\);else lobP\("lbs"\)/);
});
test('file-based paths use hash navigation, HTTP paths use history and local assets have a base', () => {
 assert.match(route,/location\.protocol==="file:"/);
 assert.match(route,/location\.hash=hash/);
 assert.match(route,/history\[replace\?"replaceState":"pushState"\]/);
 assert.match(route,/addEventListener\("popstate",appRouteRestore\)/);
 assert.match(html,/document\.createElement\("base"\)/); // Base is created before stylesheet/script references.
});
