import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8').replace(/\r\n/g,'\n');

function setup(){
 const overlay={style:{display:'none',opacity:'0'},className:''};
 const opticPart={visible:true},otherPart={visible:true};
 const guns=Array.from({length:18},()=>({userData:{}}));
 guns[16].userData.opticParts=[opticPart];
 guns[15].userData.opticParts=[otherPart];
 const state={pl:{w:16,dead:false,rl:0,sw:0,bAction:false},adsT:1,lob:false,
 mt:{over:false,cd:0},run:true,guns,document:{
  getElementById:()=>overlay,body:{classList:{toggle:()=>{}}}
 },isBombMode:()=>false};
 vm.createContext(state);
 vm.runInContext(read('src/game/76-tactical-optics.js'),state,{filename:'76-tactical-optics.js'});
 return {state,overlay,opticPart,otherPart};
}

test('XM8 hides the obstructing rifle only while its circular tactical ADS is active',()=>{
 const {state,overlay,opticPart}=setup();
 assert.equal(vm.runInContext('tacticalOpticUpdate()',state),true);
 assert.equal(overlay.style.display,'block');
 assert.equal(overlay.className,'tactical-aim tactical-aim-xm8');
 assert.equal(vm.runInContext('tacticalOpticHidesViewmodel(16,true)',state),true);
 assert.equal(opticPart.visible,false);
 state.adsT=0;
 assert.equal(vm.runInContext('tacticalOpticUpdate()',state),false);
 assert.equal(overlay.style.display,'none');
 assert.equal(vm.runInContext('tacticalOpticHidesViewmodel(16,false)',state),false);
 assert.equal(opticPart.visible,true);
});

test('reload, weapon switch, match exit and other optical weapons restore or keep the model',()=>{
 const {state,opticPart,otherPart}=setup();
 for(const id of [3,6,10,11,12,15,8,17])
  assert.equal(vm.runInContext('tacticalOpticHidesViewmodel('+id+',true)',state),false,'weapon '+id+' is unaffected');
 state.pl.rl=1;
 let active=vm.runInContext('tacticalOpticUpdate()',state);
 assert.equal(active,false,'reload disables ADS');
 assert.equal(vm.runInContext('tacticalOpticHidesViewmodel(16,false)',state),false);
 assert.equal(opticPart.visible,true);
 state.pl.rl=0;state.pl.sw=.2;
 active=vm.runInContext('tacticalOpticUpdate()',state);
 assert.equal(active,false,'switch disables ADS');
 state.pl.sw=0;state.pl.w=15;
 active=vm.runInContext('tacticalOpticUpdate()',state);
 assert.equal(active,true,'other weapon keeps existing tactical ADS');
 assert.equal(vm.runInContext('tacticalOpticHidesViewmodel(15,true)',state),false);
 assert.equal(otherPart.visible,false,'other weapon optic part rules unchanged');
 state.run=false;
 assert.equal(vm.runInContext('tacticalOpticUpdate()',state),false);
});

test('HUD consumes the active overlay state to hide the XM8 viewmodel only',()=>{
 const hud=read('src/game/96-hud-and-radar.js');
 assert.match(hud,/var tacticalAdsActive=tacticalOpticUpdate\(\)/);
 assert.match(hud,/hold\.visible=!scopedNow&&!tacticalOpticHidesViewmodel\(pl\.w,tacticalAdsActive\)/);
 const optics=read('src/game/76-tactical-optics.js');
 assert.match(optics,/16:\{style:"xm8",name:"XM8",hideViewmodelOnAds:true\}/);
 assert.doesNotMatch(optics,/15:\{[^}]*hideViewmodelOnAds/,'HK417 must retain its own ADS behavior');
});

test('browser script is exactly aligned with ordered source modules',()=>{
 const manifest=JSON.parse(read('tools/source-manifest.json'));
 assert.equal(read('assets/game.js'),'(function(){\n'+manifest.parts.map(read).join('')+'})();\n');
});
