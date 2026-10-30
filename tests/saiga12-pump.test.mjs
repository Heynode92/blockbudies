import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const source=path=>readFileSync(new URL(path,root),'utf8').replace(/\r\n/g,'\n');
function array(src,re,label){const m=src.match(re);assert.ok(m,label+' missing');return vm.runInNewContext('('+m[1]+')');}

test('Saiga-12 has exact immutable stats and no pump; original shotgun is explicitly pump-action',()=>{
 const ctx={WEAPON_PROFILES:[],WEAPON_MODEL_BUILDERS:[],WEAPON_RANGE_MODIFIERS:[],
 DAMAGE_FALLOFF:{defaultModifiers:{shotgun:.70}},
 bx:(...args)=>({kind:'box',args}),cy:(...args)=>({kind:'cylinder',args})};
 vm.runInNewContext(source('src/game/weapon/03-shotgun.js'),ctx);
 vm.runInNewContext(source('src/game/weapon/19-saiga12.js'),ctx);
 const p=ctx.WEAPON_PROFILES[18],old=ctx.WEAPON_PROFILES[2];
 assert.ok(Object.isFrozen(p));
 for(const [key,value] of Object.entries({name:'Saiga-12',kind:'shotgun',damage:100,rpm:53,control:0,
 speed:78,vRecoil:100,hRecoil:58,mag:6,res:30,range:70}))
   assert.equal(p[key],value,key);
 assert.equal(old.pump,true);
 assert.equal(p.pump,undefined);
 assert.equal(ctx.WEAPON_RANGE_MODIFIERS[18],ctx.DAMAGE_FALLOFF.defaultModifiers.shotgun);
 const saiga={userData:{}},saigaMeshes=[],shotgun={userData:{}};
 ctx.WEAPON_MODEL_BUILDERS[18](saiga,(...meshes)=>saigaMeshes.push(...meshes));
 ctx.WEAPON_MODEL_BUILDERS[2](shotgun,()=>{});
 assert.ok(saigaMeshes.length>30);
 assert.equal(saiga.userData.opticParts.length,9);
 assert.ok(saiga.userData.opticParts.every(m=>saigaMeshes.includes(m)));
 assert.ok(shotgun.userData.pumpSlide);
 assert.equal(saiga.userData.pumpSlide,undefined);
});

test('pump flag is derived from existing weapon profile while Saiga remains semi-auto',()=>{
 const ctx={WEAPON_PROFILES:[],WEAPON_MODEL_BUILDERS:[],WEAPON_RANGE_MODIFIERS:[],
 DAMAGE_FALLOFF:{referenceUnits:20,defaultModifiers:{shotgun:.70}},
 bx:()=>{},cy:()=>{}};
 vm.createContext(ctx);
 vm.runInContext(source('src/game/weapon/03-shotgun.js'),ctx);
 vm.runInContext(source('src/game/weapon/19-saiga12.js'),ctx);
 vm.runInContext(source('src/game/weapon/20-ballistics.js'),ctx);
 assert.equal(ctx.WP[2].pump,1);
 assert.ok(ctx.WP[2].pumpDuration>0);
 assert.ok(ctx.WP[2].pumpDuration<ctx.WP[2].cd);
 assert.equal(ctx.WP[18].pump,undefined);
 assert.equal(ctx.WP[18].pel,ctx.WP[2].pel);
 assert.equal(ctx.WP[18].mag,6);
});

test('Saiga uses shotgun SFX, box optic and correct viewmodel/shotgun reload table mapping',()=>{
 const view=source('src/game/weapon/30-viewmodels.js');
 const audio=source('src/game/65-audio.js');
 const combat=source('src/game/45-combat.js');
 const tables={
  ADF:array(view,/ADF=(\[[^\]]+\])/,'ADF'),AP:array(view,/,AP=(\[\[.*?\]\]),bobP=/s,'AP'),
  RG:array(view,/var RG=(\[\[.*?\]\]),\s*RL=/s,'RG'),
  RL:array(view,/\bRL=(\[\[.*?\]\]),\s*PT=/s,'RL'),
  PT:array(view,/\bPT=(\[\[.*?\]\]),\s*MODE=/s,'PT'),
  MODE:array(view,/MODE=(\[[^\]]+\])/,'MODE'),
  NC:array(view,/NC=(\[[^\]]+\])/,'NC'),
  MZ:array(combat,/MZ=(\[[^\]]+\])/,'MZ'),
  SFXI:array(audio,/SFXI=(\[[^\]]+\])/,'SFXI')
 };
 for(const [name,a] of Object.entries(tables))assert.equal(a.length,19,name+' needs 19 entries');
 assert.equal(tables.SFXI[18],tables.SFXI[2]);
 assert.equal(tables.SFXI[18],2);
 assert.equal(tables.MODE[18],0,'magazine-fed Saiga reloads via mag swap');
 assert.equal(tables.MODE[2],1,'original Shotgun retains shell-by-shell reload');
 const optic=source('src/game/76-tactical-optics.js');
 const css=source('src/styles/11-tactical-optics.css');
 assert.match(optic,/18:\{style:"saiga12",name:"Saiga-12",hideViewmodelOnAds:true\}/);
 assert.match(css,/\.tactical-aim-saiga12 \.ta-frame\{[^}]*border-radius:9px/);
 assert.match(source('src/game/75-weapon-controls.js'),/\b18:'<svg/);
 assert.match(source('src/game/77-loadout-picker.js'),/WS_ORDER=\[[^\]]*18/);
});

test('standard pump-cycle prevents duplicate shots and ejects during the stroke',()=>{
 const sim=source('src/game/95-simulation.js'),view=source('src/game/weapon/30-viewmodels.js');
 const reload=source('src/game/70-kills-and-damage-hud.js');
 assert.match(sim,/!\(w\.pump&&pl\.pump>0\)/);
 assert.match(sim,/else if\(w\.pump\)\{pl\.mag--;pl\.pump=w\.pumpDuration/);
 assert.match(sim,/if\(!w\.pump\)ejectShell/);
 assert.match(sim,/priorPump>0&&pl\.pump===0&&w\.pump&&pl\.mag<=0/);
 assert.match(view,/var slide=guns\[w\]&&guns\[w\]\.userData\.pumpSlide/);
 assert.match(view,/ejectShell\(w,1\)/);
 assert.match(reload,/w\.pump&&pl\.pump>0/);
 assert.match(source('src/game/75-weapon-controls.js'),/pl\.pump=0;pl\.pumpEjected=false/);
});

test('manifest lists Saiga and browser bundle exactly matches all current sources',()=>{
 const manifest=JSON.parse(source('tools/source-manifest.json'));
 const path='src/game/weapon/19-saiga12.js';
 assert.equal(manifest.parts.filter(x=>x===path).length,1);
 assert.equal(manifest.parts.indexOf(path),manifest.parts.indexOf('src/game/weapon/18-xm2010.js')+1);
 assert.ok(manifest.parts.indexOf(path)<manifest.parts.indexOf('src/game/weapon/20-ballistics.js'));
 assert.equal(source('assets/game.js'),'(function(){\n'+manifest.parts.map(source).join('')+'})();\n');
});
