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

test('Create Room uses only one authoritative wide dialog rule; obsolete narrow override stays removed',()=>{
 // Previously a trailing 660px block overrode the cinematic grid on desktop.
 assert.match(css,/#lbrooms \.room-create-dialog \{\s*position:relative;[\s\S]*?width:min\(1480px,100%\)/);
 assert.doesNotMatch(css,/width:min\(660px,100%\)/);
 assert.doesNotMatch(css,/height:min\(710px,calc\(100vh - 140px\)\)/);
 assert.match(css,/#lbrooms \.room-create-overlay \{\s*position:absolute;z-index:11;[\s\S]*?inset:var\(--bb-shared-header-height,86px\) 0 0/);
 assert.match(css,/#lbrooms \.room-create-overlay\[hidden\] \{display:none!important;\}/);
 assert.match(css,/@media\(max-width:860px\) \{[\s\S]*?#lbrooms \.room-create-dialog \{width:100%;height:100%;max-height:100%;\}/);
 assert.equal((css.match(/#lbrooms \.room-create-dialog \{\s*position:relative;/g)||[]).length,1);
});

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


function thumbnailFixture(){
 const source=read('src/game/83-room-lobby.js'),start=source.indexOf('// Create Room map cards use ONLY'),
  end=source.indexOf('function roomText(',start);
 assert.ok(start>=0&&end>start,'canonical map-card functions must be available');
 const calls={map:[],render:0,clear:0,pixels:0};
 const canvas=()=>({width:240,height:130,getContext(){return {drawImage(){calls.pixels++;}}}});
 const labs={id:'block-labs',name:'BLOCK LABS',preview:{x:-40,y:5.2,z:14,lookX:-40,lookY:2,lookZ:-20,fov:72}};
 const town={id:'block-town',name:'BLOCK TOWN',preview:{x:12,y:47,z:35,lookX:0,lookY:0,lookZ:-12,fov:74}};
 const hospital={id:'hospital',name:'HOSPITAL',preview:{x:-67,y:5.2,z:-28,lookX:-67,lookY:2,lookZ:-5,fov:73}};
 const entries=[labs,town,hospital].map(map=>({
  children:[canvas()],
  getAttribute(name){return name==='aria-label'?'Choose '+map.name:null;}
 }));
 const cardRoot={children:entries};
 const overlay={hidden:false};
 const document={
  hidden:false,createElement(tag){assert.equal(tag,'canvas');return canvas();},
  getElementById(id){
   if(id==='roomMapCards')return cardRoot;
   if(id==='roomCreateOverlay')return overlay;
   if(id==='lbrooms')return {classList:{contains:s=>s==='on'}};
   throw new Error('unexpected element '+id);
  }
 };
 const context={
  document,console:{warn(){}},run:false,lob:true,roomDraftMode:0,roomDraftMapId:'block-district',
  selectedTdmMapId:'block-district',selectedBombMapId:'lockdown',mapPreviewSceneBomb:false,
  tdmMapOptions(){return [{id:'block-district',name:'BLOCK DISTRICT'},labs];},
  bombMapOptions(){return [{id:'lockdown',name:'LOCKDOWN'},town,hospital];},
  tdmMapId:id=>id,bombMapId:id=>id,
  R:{domElement:{width:1920,height:1080},clear(){calls.clear++;},render(){calls.render++;}},
  S:{},C:{near:.1,far:430},
  T:{PerspectiveCamera:class {constructor(fov){this.fov=fov;this.position={set(){}};}lookAt(){} }},
  selectGameMap(bomb){calls.map.push({id:bomb?context.selectedBombMapId:context.selectedTdmMapId,bomb});}
 };
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);
 return {context,overlay,document,calls,entries};
}

test('all inactive map cards receive authentic 3D captures and selected map is restored',()=>{
 const {context,calls}=thumbnailFixture();
 context.roomMapCapturePendingPreview();
 assert.equal(calls.render,2,'one temporary screenshot + final world restore');
 assert.equal(calls.clear,2);
 assert.equal(calls.map[0].id,'block-labs');
 assert.equal(calls.map[1].id,'block-district','main scene must be restored');
 assert.equal(context.selectedTdmMapId,'block-district');
 assert.ok(context.roomMapThumbnailCache['block-labs'],'map thumbnail should be cached');
 assert.ok(calls.pixels>=2,'capture and card paint both happened');
 context.roomMapCapturePendingPreview();
 assert.equal(calls.render,2,'cached map must not be rendered again');
});

test('Block Town and Hospital thumbnails use their registered camera without changing Bomb selection',()=>{
 const {context,calls,overlay}=thumbnailFixture();
 context.roomDraftMode=1;context.roomDraftMapId='lockdown';
 context.selectedBombMapId='lockdown';context.mapPreviewSceneBomb=true;
 context.roomMapCapturePendingPreview();context.roomMapCapturePendingPreview();
 assert.deepEqual(calls.map.map(x=>x.id),['block-town','lockdown','hospital','lockdown']);
 assert.equal(calls.render,4);
 assert.equal(context.selectedBombMapId,'lockdown');
 assert.ok(context.roomMapThumbnailCache['block-town']);
 assert.ok(context.roomMapThumbnailCache.hospital);
 overlay.hidden=true;
 context.roomMapCapturePendingPreview();
 assert.equal(calls.render,4,'no hidden popup GPU work');
});
