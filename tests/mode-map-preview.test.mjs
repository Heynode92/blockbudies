import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8').replace(/\r\n/g,'\n');
const html=read('index.html'),css=read('src/styles/04-lobby.css'),preview=read('src/game/84-live-map-preview.js'),
 lobby=read('src/game/85-lobby-and-match.js'),loop=read('src/game/99-render-loop.js'),manifest=JSON.parse(read('tools/source-manifest.json'));
function setup(){
 const scenes=[],draws=[],source={width:1920,height:1080};
 const canvas={width:960,height:540,getContext(){return{clearRect(){},drawImage(...a){draws.push(a);}}}};
 const body={classList:{contains(){return true;}}};
 const state={document:{hidden:false,getElementById(n){return n==='mapPreviewCanvas'?canvas:n==='lbm'?body:{classList:{contains(){return false;}}};}},
 R:{domElement:source},lob:true,run:false,selM:0,touch:false,Math,Number,selectGameMap(x){scenes.push(x);}};
 runInNewContext(preview,state);return{state,scenes,draws,source};
}
test('the selected Deathmatch displays BLOCK DISTRICT with minimal map-centric text',()=>{
 for(const id of ['mapPreviewCanvas','mapName','mapCaption','mapOverview','mmap','mdm'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(lobby,/name:"BLOCK DISTRICT"/);
 assert.match(lobby,/name:"LOCKDOWN",caption:"Indoor Tactical Arena"/);
 assert.doesNotMatch(lobby,/name:"BOMB MISSION",caption:/);
 assert.match(html,/PLAY NOW<kbd>ENTER<\/kbd>/);
 assert.doesNotMatch(html,/id="mds"|id="mhw"|id="mdf"/);
 assert.match(css,/#lbm \.mmap\{/);
 assert.doesNotMatch(html,/LIVE 3D|class="mmap-live"/);
 assert.doesNotMatch(css,/\.mmap-live/);
});
test('live preview reuses the rendered world frame and throttles 2D copies',()=>{
 const {state,draws,source}=setup();
 state.modePreviewDraw(1000);state.modePreviewDraw(1017);state.modePreviewDraw(1034);
 state.modePreviewDraw(1050);state.modePreviewDraw(1068);
 assert.equal(draws.length,3);assert.equal(draws[0][0],source);
 assert.equal(draws[0][7],960);assert.equal(draws[0][8],540);
 assert.doesNotMatch(preview,/new\s+(?:T\.)?WebGLRenderer|requestAnimationFrame/);
 assert.match(loop,/R\.render\(S,C\);modePreviewDraw\(now\);/);
 assert.equal(state.mapPreviewFrameMs,1000/30);
});
test('30 FPS cap is identical on touch and desktop; preview stays paused between frames',()=>{
 const {state,draws}=setup();
 state.touch=true;
 for(let now=0;now<=100;now+=10)state.modePreviewDraw(now);
 assert.equal(draws.length,3,'draw only at 0, 40 and 80ms');
 state.touch=false;
 for(let now=110;now<=200;now+=10)state.modePreviewDraw(now);
 assert.equal(draws.length,6,'continue the same 30 FPS limit on desktop');
});
test('preview stays idle outside SELECT MODE, in gameplay, in a hidden tab or on the locked mode',()=>{
 const {state,draws}=setup();
 state.run=true;state.modePreviewDraw(1000);state.run=false;state.selM=2;state.modePreviewDraw(1100);
 state.selM=0;state.document.hidden=true;state.modePreviewDraw(1200);
 state.document.hidden=false;state.document.getElementById=()=>({classList:{contains(){return false;}}});state.modePreviewDraw(1300);
 assert.equal(draws.length,0);
});
test('Bomb Mode previews actual interior world, city restores on return',()=>{
 const {state,scenes}=setup();
 state.modePreviewSelect(1);assert.equal(state.mapPreviewSceneBomb,true);
 state.modePreviewSelect(0);assert.equal(state.mapPreviewSceneBomb,false);
 assert.deepEqual(scenes,[true,false]);
 assert.match(loop,/if\(lob&&mapPreviewSceneBomb\)/);
 assert.match(lobby,/modePreviewSelect\(i\)/);
});
test('source manifest, original browser bundle and game modes remain in sync',()=>{
 assert.ok(manifest.parts.indexOf('src/game/84-live-map-preview.js')<manifest.parts.indexOf('src/game/85-lobby-and-match.js'));
 assert.equal(manifest.parts.indexOf('src/game/89-bot-tactical-intelligence.js')+1,manifest.parts.indexOf('src/game/85-lobby-and-match.js'));
 const built='(function(){\n'+manifest.parts.map(read).join('')+'})();\n';
 assert.equal(read('assets/game.js'),built);
 assert.match(lobby,/function startMatch\(tm\)/);
 assert.match(lobby,/function selMode\(i\)/);
});
