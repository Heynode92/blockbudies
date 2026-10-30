import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8').replace(/\r\n/g,'\n');
const parseArray=(code,re,name)=>{
 const m=code.match(re);assert.ok(m,name+' table missing');
 return vm.runInNewContext('('+m[1]+')');
};

test('XM2010 uses exact immutable weapon stats, original sniper falloff and animated bolt mesh',()=>{
 const ctx={
  WEAPON_PROFILES:[],WEAPON_MODEL_BUILDERS:[],WEAPON_RANGE_MODIFIERS:[],
  DAMAGE_FALLOFF:{defaultModifiers:{sniper:.99}},
  bx:(...args)=>({kind:'box',args,children:[],add(x){this.children.push(x);}}),
  cy:(...args)=>({kind:'cylinder',args})
 };
 vm.runInNewContext(read('src/game/weapon/18-xm2010.js'),ctx);
 const weapon=ctx.WEAPON_PROFILES[17];
 assert.equal(Object.isFrozen(weapon),true);
 for(const [key,value] of Object.entries({name:'XM2010',kind:'sniper',damage:82,rpm:0,control:86,speed:69,vRecoil:64,hRecoil:60,mag:5,res:30,range:200}))
  assert.equal(weapon[key],value,key);
 assert.equal(ctx.WEAPON_RANGE_MODIFIERS[17],.99);
 const gun={userData:{}},meshes=[];
 ctx.WEAPON_MODEL_BUILDERS[17](gun,(...parts)=>meshes.push(...parts));
 assert.ok(meshes.length>=65,'scope, suppressor and chassis should be detailed');
 assert.ok(meshes.some(x=>x.kind==='cylinder'&&x.args[2]>=.68),'long suppressor exists');
 assert.ok(meshes.includes(gun.userData.bolt),'bolt handle is part of model');
 assert.equal(gun.userData.bolt.children.length,1,'bolt knob follows moving bolt handle');
});

test('XM2010 uses AWP sound and zoom, and the complete 18-slot gameplay tables',()=>{
 const vmCode=read('src/game/weapon/30-viewmodels.js'),audio=read('src/game/65-audio.js');
 const combat=read('src/game/45-combat.js');
 const tables={
  ADF:parseArray(vmCode,/ADF=(\[[^\]]+\])/,'FOV'),
  AP:parseArray(vmCode,/,AP=(\[\[.*?\]\]),bobP=/s,'ADS position'),
  RG:parseArray(vmCode,/var RG=(\[\[.*?\]\]),\s*RL=/s,'right hand'),
  RL:parseArray(vmCode,/\bRL=(\[\[.*?\]\]),\s*PT=/s,'left hand'),
  PT:parseArray(vmCode,/\bPT=(\[\[.*?\]\]),\s*MODE=/s,'reload position'),
  MODE:parseArray(vmCode,/MODE=(\[[^\]]+\])/,'reload style'),
  NC:parseArray(vmCode,/NC=(\[[^\]]+\])/,'reload cycles'),
  MZ:parseArray(combat,/MZ=(\[[^\]]+\])/,'muzzle'),
  SFXI:parseArray(audio,/SFXI=(\[[^\]]+\])/,'sound mapping')
 };
 for(const [label,values] of Object.entries(tables))assert.equal(values.length,19,label+' covers ID 17');
 assert.equal(tables.SFXI[17],tables.SFXI[8]);
 assert.equal(tables.SFXI[17],4);
 assert.equal(tables.ADF[17],tables.ADF[8],'XM2010 and AWP share zoom level');
 assert.ok(tables.MZ[17]<-2.3);
});

test('scope input, auto-unscoping and shared bolt-action gate use sniper profile',()=>{
 for(const path of ['src/game/75-weapon-controls.js','src/game/80-input.js','src/game/79-camera-look.js',
  'src/game/95-simulation.js','src/game/96-hud-and-radar.js'])
  assert.match(read(path),/\.snp/,path+' must use canonical sniper type');
 const sim=read('src/game/95-simulation.js');
 assert.match(sim,/!\(w\.snp&&pl\.bolt>0\)/,'must not fire during bolt animation');
 assert.match(sim,/pl\.bolt=BOLT_T/,'bolt action triggered after each shot');
 assert.match(sim,/pl\.bolt===0&&WP\[pl\.w\]\.snp/,'reload after empty magazine and bolt');
 const view=read('src/game/weapon/30-viewmodels.js');
 assert.match(view,/boltGun=WP\[w\]&&WP\[w\]\.snp\?guns\[w\]:null/);
 assert.match(view,/ejectShell\(w,1\)/,'bolt ejection uses selected sniper ID');
 assert.match(read('src/game/75-weapon-controls.js'),/\b17:'<svg/,'HUD icon');
 assert.match(read('src/game/77-loadout-picker.js'),/WS_ORDER=\[[^\]]*17/,'loadout');
});

test('generated file is exactly assembled from source manifest including XM2010',()=>{
 const manifest=JSON.parse(read('tools/source-manifest.json'));
 const path='src/game/weapon/18-xm2010.js';
 assert.equal(manifest.parts.filter(p=>p===path).length,1);
 assert.equal(manifest.parts.indexOf(path),manifest.parts.indexOf('src/game/weapon/17-xm8.js')+1);
 assert.equal(read('assets/game.js'),'(function(){\n'+manifest.parts.map(read).join('')+'})();\n');
});
