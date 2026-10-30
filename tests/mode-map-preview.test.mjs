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
 const state={document:{hidden:false,getElementById(n){return n==='mapPreviewCanvas'?canvas:body;}},
 R:{domElement:source},lob:true,run:false,selM:0,touch:false,Math,Number,selectGameMap(x){scenes.push(x);}};
 runInNewContext(preview,state);return{state,scenes,draws,source};
}
test('the selected Deathmatch displays BLOCK DISTRICT with minimal map-centric text',()=>{
 for(const id of ['mapPreviewCanvas','mapName','mapCaption','mapOverview','mmap','mdm'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(lobby,/name:"BLOCK DISTRICT"/);
 assert.match(html,/PLAY NOW<kbd>ENTER<\/kbd>/);
 assert.doesNotMatch(html,/id="mds"|id="mhw"|id="mdf"/);
 assert.match(css,/#lbm \.mmap\{/);
});
test('live preview reuses the rendered world frame and throttles 2D copies',()=>{
 const {state,draws,source}=setup();
 state.modePreviewDraw(1000);state.modePreviewDraw(1050);state.modePreviewDraw(1100);
 assert.equal(draws.length,2);assert.equal(draws[0][0],source);
 assert.equal(draws[0][7],960);assert.equal(draws[0][8],540);
 assert.doesNotMatch(preview,/new\s+(?:T\.)?WebGLRenderer|requestAnimationFrame/);
 assert.match(loop,/R\.render\(S,C\);modePreviewDraw\(now\);/);
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
 assert.equal(manifest.parts.indexOf('src/game/84-live-map-preview.js')+1,manifest.parts.indexOf('src/game/85-lobby-and-match.js'));
 const built='(function(){\n'+manifest.parts.map(read).join('')+'})();\n';
 assert.equal(read('assets/game.js'),built);
 assert.match(lobby,/function startMatch\(tm\)/);
 assert.match(lobby,/function selMode\(i\)/);
});
