import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8').replace(/\r\n/g,'\n');
const picker=read('src/game/77-loadout-picker.js');
const controls=read('src/game/75-weapon-controls.js');
const camera=read('src/game/79-camera-look.js');
const input=read('src/game/80-input.js');
const simulation=read('src/game/95-simulation.js');
const room=read('src/game/83-room-lobby.js');

test('room start captures existing weapon selection duration without game freeze',()=>{
 assert.match(room,/flow\.loadoutSeconds=mt\.cd/);
 assert.match(room,/mt\.cd=0;run=false/);
 assert.match(room,/run=true;loadoutBeginLiveWindow\(selectionSeconds\)/);
 assert.match(picker,/var wsLiveTime=0,wsLiveDuration=0/);
 assert.match(simulation,/if\(wsLiveTime>0\)wsLiveTime=Math\.max\(0,wsLiveTime-dt\)/);
 assert.match(simulation,/if\(pl\.dead\|\|mt\.cd>0\|\|/);
 assert.match(input,/\(mt\.cd>0\|\|wsLiveTime>0\)/);
});

test('in-match picker opens at full original duration without blocking the match',()=>{
 const start=picker.indexOf('function loadoutBeginLiveWindow(seconds){');
 const end=picker.indexOf('function loadoutReleaseInput(){',start);
 const update=picker.slice(picker.indexOf('function loadoutUpdate(){'));
 assert.ok(start>0&&end>start);
 const active=new Set(),seconds={textContent:''},fill={style:{width:''}};
 const ui={classList:{toggle(name,on){if(on)active.add(name);else active.delete(name);}},
   querySelector(sel){return sel==='.wp-seconds'?seconds:sel==='.wp-track-fill'?fill:null;}};
 const state={wsLiveTime:0,wsLiveDuration:0,wsOn:false,wsConfirmed:false,wsEl:ui,
  run:true,lob:false,mt:{cd:0,over:false},pl:{dead:false},touch:false,
  BOMB_RULES:{freezeSeconds:7},isBombMode:()=>false,
  R:{domElement:{}},document:{body:{classList:{toggle(){}}},pointerLockElement:null},
  autoFinished:0,released:0,
  loadoutReleaseInput(){state.released++;},
  loadoutFinish(){state.autoFinished++;state.wsConfirmed=true;state.wsLiveTime=0;}};
 vm.createContext(state);
 vm.runInContext(picker.slice(start,end)+update,state);
 vm.runInContext('loadoutBeginLiveWindow(5)',state);
 assert.equal(state.mt.cd,0);
 assert.equal(state.wsLiveTime,5);
 assert.equal(state.wsOn,true);
 assert.equal(seconds.textContent,'5s');
 assert.equal(fill.style.width,'100%');
 assert.equal(state.released,1);
 state.wsLiveTime=2;
 vm.runInContext('loadoutUpdate()',state);
 assert.equal(seconds.textContent,'2s');
 state.wsLiveTime=0;
 vm.runInContext('loadoutUpdate()',state);
 assert.equal(state.autoFinished,1);
 assert.equal(state.wsOn,false);
 assert.equal(state.wsConfirmed,true);
 assert.equal(active.has('show'),false);
});

test('mouse hover-aim stays available with weapon cards open; legacy freeze still blocks',()=>{
 const start=camera.indexOf('function lookFreeAimEnabled(){');
 const end=camera.indexOf('function lookStartDrag(e){',start);
 assert.ok(start>0&&end>start);
 const state={wsConfirmed:false,wsOn:true,wsLiveTime:5,touch:false,
   run:true,lob:false,mt:{cd:0,over:false},pl:{dead:false},
   document:{pointerLockElement:null},R:{domElement:{}},escEl:{style:{display:'none'}}};
 vm.createContext(state);
 vm.runInContext(camera.slice(start,end),state);
 assert.equal(vm.runInContext('lookFreeAimEnabled()',state),true);
 state.wsLiveTime=0;
 assert.equal(vm.runInContext('lookFreeAimEnabled()',state),false);
 state.wsOn=false;state.wsConfirmed=true;
 assert.equal(vm.runInContext('lookFreeAimEnabled()',state),true);
 state.mt.cd=3;
 assert.equal(vm.runInContext('lookFreeAimEnabled()',state),false);
 assert.match(camera,/wsOn&&!\(typeof wsLiveTime/);
 assert.match(input,/e\.target\.closest\("#wsel"\)/);
});

test('weapon selection in the live window checks ownership and expires safely',()=>{
 const start=controls.indexOf('function chooseWeapon(id){');
 const end=controls.indexOf('function wselUpd(){',start);
 assert.ok(start>0&&end>start);
 const state={run:true,pl:{dead:false,w:9,prim:9,ammo:{}},
  mt:{cd:0,over:false},wsLiveTime:5,wsConfirmed:false,WSEL:[9,14,15],
  favPrim:9,scopeOn:false,WP:Array.from({length:16},()=>({mag:30,res:100})),
  inventoryOwned:()=>[9,14],swW(id){state.pl.w=id;},loadoutRefreshSelected(){}};
 vm.createContext(state);
 vm.runInContext(controls.slice(start,end),state);
 vm.runInContext('chooseWeapon(15)',state);
 assert.equal(state.pl.prim,9);
 vm.runInContext('chooseWeapon(14)',state);
 assert.equal(state.pl.prim,14);
 assert.equal(state.pl.w,14);
 state.wsLiveTime=0;
 vm.runInContext('chooseWeapon(9)',state);
 assert.equal(state.pl.prim,14);
});
