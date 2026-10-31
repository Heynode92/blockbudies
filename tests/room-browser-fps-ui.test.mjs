import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8').replace(/\r\n/g,'\n');
const html=read('index.html'),style=read('src/styles/14-room-browser.css'),
      inv=read('src/game/89-inventory.js'),room=read('src/game/83-room-lobby.js'),
      loop=read('src/game/99-render-loop.js');

test('room browser uses actual equipped Police model and a single existing WebGL renderer',()=>{
 assert.match(html,/id="roomBrowserPreview" class="ivpreview room-browser-preview"/);
 assert.match(inv,/function inventoryBrowserPreviewOpen\(\)/);
 assert.match(inv,/inventoryEquipped\("main"\)/);
 assert.match(inv,/inventoryPreviewSetSide\(0\)/);
 assert.match(inv,/inventoryPreviewMount\("roomBrowserPreview"\)/);
 assert.match(inv,/inRoom\?"rmlpreview":inBrowser\?"roomBrowserPreview":"ivpreview"/);
 assert.match(room,/inventoryBrowserPreviewOpen\(\)/);
 assert.match(loop,/R\.render\(S,C\)/);
 assert.match(style,/body\.lobby:has\(#lbrooms\.on\) #gl/);
 assert.doesNotMatch(style,/url\(|data:image|background-image:/i,'background must be the live Block District canvas, not a fabricated image');
});

test('room browser is left operator + right room list and explicit unavailable public chat',()=>{
 const begin=html.indexOf('<section id="lbrooms"'),end=html.indexOf('<section id="lbroomlive"',begin);
 const panel=html.slice(begin,end);
 assert.ok(begin>=0&&end>begin);
 const left=panel.indexOf('class="room-operator-panel"');
 const right=panel.indexOf('class="room-browser-right"');
 assert.ok(left>=0&&right>left);
 assert.match(panel,/id="roomBack"/);
 assert.match(panel,/id="roomCreateOpen"/);
 assert.match(panel,/id="roomEntries"/);
 assert.match(panel,/PUBLIC CHAT/);
 assert.match(panel,/CHAT SERVER NOT CONNECTED/);
 assert.match(panel,/id="roomPublicChatInput"[^>]*disabled/);
 assert.match(panel,/id="roomCreateOverlay" class="room-create-overlay" hidden/);
 assert.match(panel,/id="roomName"/);
 assert.match(panel,/id="roomMap"/);
 assert.match(panel,/id="roomTdm"/);
 assert.match(panel,/id="roomBomb"/);
 assert.match(panel,/id="roomCreate"/);
 assert.match(panel,/id="roomStart"/);
 assert.match(room,/roomCreateOpen"\)\.addEventListener\("click"/);
 assert.match(room,/roomCreateCancel"\)\.addEventListener\("click"/);
});

test('pre-match-only header and 3D preview never enter the actual combat HUD',()=>{
 assert.match(read('src/game/85-lobby-and-match.js'),/header\.hidden=!\(activePanel&&activePanel\.hasAttribute\("data-shared-header"\)\)/);
 assert.match(read('assets/game.js'),/lb\.style\.display="none";lob=false;/);
 assert.match(inv,/if\(!inInventory&&!inRoom&&!inBrowser\)\{inventoryPreviewLive=false;return;\}/);
 const live=html.slice(html.indexOf('<section id="lbroomlive"'));
 assert.match(live,/id="rmlpreview"/);
 assert.match(live,/id="rmlLogLines"/);
 assert.match(live,/PUBLIC CHAT/);
 assert.match(live,/PUBLIC MESSAGING COMING WITH ONLINE SERVICES/);
});
