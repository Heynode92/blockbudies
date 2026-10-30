import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const source=path=>readFileSync(new URL(path,root),'utf8').replace(/\r\n/g,'\n');
function array(text,re,name){
 const hit=text.match(re);
 assert.ok(hit,name+' table must exist');
 return vm.runInNewContext('('+hit[1]+')');
}

test('XM8 profile matches requested stats, uses existing rifle falloff and an original mesh',()=>{
 const ctx={WEAPON_PROFILES:[],WEAPON_MODEL_BUILDERS:[],WEAPON_RANGE_MODIFIERS:[],
  DAMAGE_FALLOFF:{defaultModifiers:{rifle:.98}},
  bx:(...args)=>({type:'box',args}),cy:(...args)=>({type:'cylinder',args})};
 vm.runInNewContext(source('src/game/weapon/17-xm8.js'),ctx,{filename:'17-xm8.js'});
 const p=ctx.WEAPON_PROFILES[16];
 assert.ok(Object.isFrozen(p));
 for(const [key,value] of Object.entries({name:'XM8',kind:'rifle',damage:25,rpm:92,
   control:63,speed:82,vRecoil:49,hRecoil:28,mag:30,res:150,range:100}))
   assert.equal(p[key],value,key);
 assert.equal(ctx.WEAPON_RANGE_MODIFIERS[16],ctx.DAMAGE_FALLOFF.defaultModifiers.rifle);
 const parts=[],model={userData:{}};
 ctx.WEAPON_MODEL_BUILDERS[16](model,(...items)=>parts.push(...items));
 assert.ok(parts.length>=50,'XM8 carries distinct fore-end and carry-handle geometry');
 assert.ok(parts.some(part=>part.type==='cylinder'),'barrel and optic model use cylinders');
 assert.equal(model.userData.opticParts.length,8,'round red-dot optic geometry is removable');
 assert.ok(model.userData.opticParts.every(part=>parts.includes(part)));
});

test('XM8 uses 17-entry gameplay tables, round red-dot ADS and AK-47 shot audio',()=>{
 const view=source('src/game/weapon/30-viewmodels.js');
 const combat=source('src/game/45-combat.js');
 const audio=source('src/game/65-audio.js');
 const controls=source('src/game/75-weapon-controls.js');
 const optics=source('src/game/76-tactical-optics.js');
 const css=source('src/styles/11-tactical-optics.css');
 const picker=source('src/game/77-loadout-picker.js');
 const tables={
  ADF:array(view,/ADF=(\[[^\]]+\])/,'ADS FOV'),
  AP:array(view,/,AP=(\[\[.*?\]\]),bobP=/s,'ADS placement'),
  RG:array(view,/var RG=(\[\[.*?\]\]),\s*RL=/s,'right grip'),
  RL:array(view,/\bRL=(\[\[.*?\]\]),\s*PT=/s,'left grip'),
  PT:array(view,/\bPT=(\[\[.*?\]\]),\s*MODE=/s,'reload path'),
  MODE:array(view,/MODE=(\[[^\]]+\])/,'reload style'),
  NC:array(view,/NC=(\[[^\]]+\])/,'reload cycle'),
  MZ:array(combat,/MZ=(\[[^\]]+\])/,'muzzle offsets'),
  SFXI:array(audio,/SFXI=(\[[^\]]+\])/,'audio mapping')
 };
 for(const [label,values] of Object.entries(tables))
  assert.equal(values.length,19,label+' covers all IDs 0–16');
 assert.equal(tables.SFXI[16],tables.SFXI[1],'XM8 shot matches AK-47');
 assert.equal(tables.SFXI[16],1);
 assert.ok(tables.MZ[16]<-1.35,'XM8 muzzle offset matches barrel tip');
 assert.match(controls,/\b16:'<svg/,'new HUD silhouette exists');
 assert.match(controls,/16:"XM8 · Round red-dot sight"/,'description exists');
 assert.match(optics,/16:\{style:"xm8",name:"XM8"\}/,'optic routes through standard ADS');
 assert.match(css,/\.tactical-aim-xm8\{[^}]*--ta-color:#ff3038/,'red reticle');
 assert.match(css,/\.tactical-aim-xm8 \.ta-frame\{[^}]*border-radius:50%/,'circular optic');
 assert.match(picker,/WS_ORDER=\[[^\]]*16/,'loadout lists XM8');
});

test('XM8 is registered before ballistics and generated game.js is in sync',()=>{
 const manifest=JSON.parse(source('tools/source-manifest.json'));
 const path='src/game/weapon/17-xm8.js';
 assert.equal(manifest.parts.filter(part=>part===path).length,1);
 assert.equal(manifest.parts.indexOf(path),manifest.parts.indexOf('src/game/weapon/16-hk417.js')+1);
 assert.ok(manifest.parts.indexOf(path)<manifest.parts.indexOf('src/game/weapon/20-ballistics.js'));
 const expected='(function(){\n'+manifest.parts.map(source).join('')+'})();\n';
 assert.equal(source('assets/game.js'),expected);
});
