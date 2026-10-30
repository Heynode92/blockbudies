import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),read=path=>readFileSync(new URL(path,root),'utf8').replace(/\r\n/g,'\n');
const inv=read('src/game/89-inventory.js'),room=read('src/game/83-room-lobby.js'),
  html=read('index.html'),css=read('src/styles/04-lobby.css');

test('room soldier uses Inventory canvas, not a static fake SVG soldier',()=>{
 assert.match(html,/id="rmlpreview" class="ivpreview rml-3d-preview"/);
 assert.match(html,/id="rmlWeaponName"/);
 assert.match(html,/id="rmlWeaponClass"/);
 assert.doesNotMatch(html,/class="rml-operator"/);
 assert.match(room,/inventoryRoomPreviewOpen\(roomSide\)/);
 assert.match(css,/#lbroomlive \.rml-3d-preview>\.ivcanvas/);
});
test('room weapon reads saved equipped main through Inventory ownership validation',()=>{
 const start=inv.indexOf('function inventoryRoomPreviewOpen(side){'),
   stop=inv.indexOf('function inventoryShowModel(id){',start);
 assert.ok(start>=0&&stop>start);
 const script=inv.slice(start,stop);
 const selected=[],host=[],started=[];
 const state={document:{getElementById:id=>({set textContent(v){state.labels[id]=v;}})},
  labels:{},inventoryEquipped:category=>{assert.equal(category,'main');return 14;},
  WP:Array.from({length:20},(_,i)=>({n:'Weapon '+i,stats:{kind:'rifle'}})),
  inventoryWeaponRole:kind=>kind.toUpperCase(),inventoryShowModel:id=>selected.push(id),
  inventoryPreviewSetSide:side=>{state.side=side;},inventoryPreviewMount:id=>host.push(id),inventoryStartPreview:()=>started.push(true)};
 state.WP[14]={n:'Selected SMG',stats:{kind:'smg'}};
 vm.createContext(state);
 vm.runInContext(script+'inventoryRoomPreviewOpen(1)',state);
 assert.equal(state.side,1);
 assert.deepEqual(selected,[14]);assert.deepEqual(host,['rmlpreview']);assert.equal(started.length,1);
 assert.equal(state.labels.rmlWeaponName,'Selected SMG');
 assert.equal(state.labels.rmlWeaponClass,'SMG');
});
test('Inventory and Room reuse one WebGL canvas, keeping Inventory pose and drag controls',()=>{
 const init=inv.slice(inv.indexOf('function inventoryPreviewInit(){'),inv.indexOf('function inventoryPreviewMount('));
 const mount=inv.slice(inv.indexOf('function inventoryPreviewMount('),inv.indexOf('function inventoryRoomPreviewOpen('));
 assert.match(init,/var actor=terro\(0\)/);
 assert.match(init,/var g=mkGun\(id\)/);
 assert.match(init,/inventoryAngle\+=/);
 assert.match(inv,/inventoryPoseFrame\(p,now\)/);
 assert.match(inv,/aimA\(a\.arms\[1\]/);
 const canvas={id:'one-canvas'},preview={host:null,renderer:{domElement:canvas}};
 const hosts={ivpreview:{insertBefore(el){this.child=el;}},rmlpreview:{insertBefore(el){this.child=el;}}};
 const ctx={inventoryPreview:preview,inventoryPreviewInit(){},document:{getElementById:id=>hosts[id]}};
 vm.createContext(ctx);
 vm.runInContext(mount+'inventoryPreviewMount("rmlpreview");inventoryPreviewMount("ivpreview")',ctx);
 assert.equal(hosts.rmlpreview.child,canvas);
 assert.equal(hosts.ivpreview.child,canvas);
 assert.equal(preview.host,hosts.ivpreview);
 assert.match(inv,/if\(!inInventory&&!inRoom\)\{inventoryPreviewLive=false;return;\}/);
 assert.match(inv,/inRoom=lob&&document\.getElementById\("lbroomlive"\)/,"rendering must stop in gameplay");
});
test('equipped selection is not the catalog highlight and gameplay remains intact',()=>{
 assert.match(inv,/function inventoryEquipped\(cat\)/);
 assert.match(inv,/var id=inventoryEquipped\("main"\),weapon=id===null\?null:WP\[id\]/);
 assert.match(inv,/inventoryPreviewMount\("ivpreview"\);inventoryPreviewSetSide\(0\);inventoryBuildThumbnails\(\);inventoryRender\(\);inventoryStartPreview\(\)/);
 assert.match(read('src/game/85-lobby-and-match.js'),/function startMatch\(tm\)/);
});

test('team switch caches genuine 3D Police and Terrorist actors without replacing weapon meshes',()=>{
 const start=inv.indexOf('function inventoryPreviewSetSide(side){'),end=inv.indexOf('function inventoryRoomPreviewOpen(side){',start);
 assert.ok(start>=0&&end>start);
 const segment=inv.slice(start,end),guns=[{id:1},{id:2}],addCalls=[];
 const previousMount={add(g){addCalls.push(['old',g])},remove(){}};
 const otherMount={add(g){addCalls.push(['other',g])},remove(){}};
 const police={g:{visible:true,userData:{gun:previousMount}}};
 const terrorist={g:{visible:false,userData:{gun:otherMount}}};
 const preview={side:0,actor:police,actors:[police,null],scene:{add(){}},guns,mount:previousMount};
 let built=0;
 const ctx={inventoryPreview:preview,inventoryPreviewInit(){},terro:team=>{assert.equal(team,1);built++;return terrorist;},S:{remove(){}}};
 vm.createContext(ctx);
 vm.runInContext(segment+'inventoryPreviewSetSide(1);inventoryPreviewSetSide(0);inventoryPreviewSetSide(1);',ctx);
 assert.equal(built,1,'cache terrorist actor instead of allocating per click');
 assert.equal(preview.actor,terrorist);
 assert.equal(preview.side,1);
 assert.equal(addCalls.filter(x=>x[0]==='other').length,4);
 assert.equal(guns.length,2,'reuse original gun meshes');
});
