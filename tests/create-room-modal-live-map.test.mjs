import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8').replace(/\r\n/g,'\n');
const html=read('index.html'),css=read('src/styles/14-room-browser.css'),
      preview=read('src/game/84-live-map-preview.js');

test('create-room popup is map-left/settings-right with existing real controls and pinned submit',()=>{
 const start=html.indexOf('<div id="roomCreateOverlay"'),end=html.indexOf('<section id="lbroomlive"',start);
 assert.ok(start>=0&&end>start);
 const popup=html.slice(start,end);
 const left=popup.indexOf('class="room-create-map-side"');
 const right=popup.indexOf('class="room-form-scroll room-config-side"');
 assert.ok(left>0&&right>left);
 assert.ok(popup.indexOf('id="roomMapPreview"')<right);
 assert.ok(popup.indexOf('id="roomMapCards"')<right);
 assert.ok(popup.indexOf('id="roomName"')>right);
 for(const id of ['roomMap','roomTdm','roomBomb','roomKills','roomMinutes','roomRounds','roomRoundMinutes','roomCreate','roomStart']) {
  assert.equal((popup.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 }
 assert.match(css,/#lbrooms \.room-create-layout\s*\{[\s\S]*?grid-template-columns:minmax\(0,1\.04fr\) minmax\(0,1fr\)/);
 assert.match(css,/#lbrooms \.room-create-dialog \.room-create-actions\s*\{[\s\S]*?flex:0 0 auto/);
 assert.match(css,/@media\(max-width:860px\)/);
});

function previewFixture(){
 const calls={world:[],mapDraw:0,mapCard:0,modeDraw:0,clears:0};
 const canvas={width:720,height:320,getContext(){return {
  drawImage(){calls.mapDraw++;},clearRect(){calls.clears++;}
 }}};
 const modeCanvas={width:720,height:320,getContext(){return {
  drawImage(){calls.modeDraw++;},clearRect(){calls.clears++;}
 }}};
 const overlay={hidden:false};
 const nodes={
  mapPreviewCanvas:modeCanvas,roomMapPreview:canvas,roomCreateOverlay:overlay,
  lbm:{classList:{contains(){return false;}}},
  lbrooms:{classList:{contains(){return true;}}},
  lbroomlive:{classList:{contains(){return false;}}}
 };
 const context={lob:true,run:false,selM:0,selectedTdmMapId:'block-district',
  selectedBombMapId:'lockdown',document:{hidden:false,getElementById(id){
   if(!(id in nodes))throw Error('unexpected DOM read '+id);
   return nodes[id];
  }},
  R:{domElement:{width:1920,height:1080}},
  selectGameMap:b=>calls.world.push(b),
  roomMapCardFrame:()=>{calls.mapCard++;}
 };
 vm.createContext(context);
 vm.runInContext(preview,context,{filename:'84-live-map-preview.js'});
 return {context,calls,overlay};
}

test('real animated Three.js canvas feeds map and selected map card at 30 FPS only while visible',()=>{
 const {context,calls,overlay}=previewFixture();
 context.modePreviewDraw(0);
 assert.equal(calls.mapDraw,1);
 assert.equal(calls.mapCard,1);
 context.modePreviewDraw(10);
 assert.equal(calls.mapDraw,1,'preview is capped at 30 FPS');
 context.modePreviewDraw(35);
 assert.equal(calls.mapDraw,2);
 assert.equal(calls.mapCard,2);
 overlay.hidden=true;
 context.modePreviewDraw(70);
 assert.equal(calls.mapDraw,2,'hidden dialog does not waste GPU pixel copies');
 assert.equal(calls.mapCard,2);
 overlay.hidden=false;
 context.modePreviewDraw(110);
 assert.equal(calls.mapDraw,3,'preview resumes when dialog reopens');
 context.document.hidden=true;
 context.modePreviewDraw(150);
 assert.equal(calls.mapDraw,3,'hidden browser tab pauses preview updates');
});

test('switching maps and modes drives the actual canonical game world',()=>{
 const {context,calls}=previewFixture();
 context.selectedTdmMapId='block-labs';
 context.modePreviewSelect(0);
 assert.deepEqual(calls.world,[false]);
 context.selectedBombMapId='hospital';
 context.modePreviewSelect(1);
 assert.deepEqual(calls.world,[false,true]);
 assert.equal(context.mapPreviewSceneBomb,true);
 assert.equal(context.mapPreviewMapId,'hospital');
 context.selectedBombMapId='block-town';
 context.modePreviewSelect(1);
 assert.deepEqual(calls.world,[false,true,true]);
 assert.equal(context.mapPreviewMapId,'block-town');
});
