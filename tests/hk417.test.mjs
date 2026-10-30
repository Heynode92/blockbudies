import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const source=path=>readFileSync(new URL(path,root),'utf8').replace(/\r\n/g,'\n');

function literal(text,pattern,name){
 const m=text.match(pattern);assert.ok(m,name+' array missing');
 return vm.runInNewContext('('+m[1]+')');
}
test('HK417 profile is frozen, distinct, exactly specified and uses existing rifle falloff',()=>{
 const ctx={
  WEAPON_PROFILES:[],WEAPON_RANGE_MODIFIERS:[],WEAPON_MODEL_BUILDERS:[],
  DAMAGE_FALLOFF:{defaultModifiers:{rifle:.98}},
  bx:(...args)=>({shape:'box',args}),cy:(...args)=>({shape:'cylinder',args})
 };
 vm.runInNewContext(source('src/game/weapon/16-hk417.js'),ctx);
 const w=ctx.WEAPON_PROFILES[15];
 assert.equal(Object.isFrozen(w),true);
 for(const [key,val] of Object.entries({name:'HK417',kind:'rifle',damage:33,rpm:92,control:50,speed:74,vRecoil:64,hRecoil:60,mag:30,res:150,range:160}))
  assert.equal(w[key],val,key);
 assert.equal(ctx.WEAPON_RANGE_MODIFIERS[15],ctx.DAMAGE_FALLOFF.defaultModifiers.rifle);
 const meshes=[],group={userData:{}};
 ctx.WEAPON_MODEL_BUILDERS[15](group,(...parts)=>meshes.push(...parts));
 assert.ok(meshes.length>=40,'HK417 has a detailed long-rail geometry');
 assert.ok(meshes.some(item=>item.shape==='cylinder'),'barrel uses a cylinder mesh');
 assert.equal(group.userData.opticParts.length,8,'rectangular red-dot optic has removable sight pieces');
 assert.ok(group.userData.opticParts.every(p=>meshes.includes(p)));
});

test('HK417 integrates to ADS, red box optic, sound, muzzle, HUD and loadout',()=>{
 const view=source('src/game/weapon/30-viewmodels.js');
 const combat=source('src/game/45-combat.js');
 const audio=source('src/game/65-audio.js');
 const controls=source('src/game/75-weapon-controls.js');
 const optic=source('src/game/76-tactical-optics.js');
 const css=source('src/styles/11-tactical-optics.css');
 const picker=source('src/game/77-loadout-picker.js');
 const tables={
  ADF:literal(view,/ADF=(\[[^\]]+\])/,'ADF'),
  AP:literal(view,/,AP=(\[\[.*?\]\]),bobP=/s,'AP'),
  RG:literal(view,/var RG=(\[\[.*?\]\]),\s*RL=/s,'RG'),
  RL:literal(view,/\bRL=(\[\[.*?\]\]),\s*PT=/s,'RL'),
  PT:literal(view,/\bPT=(\[\[.*?\]\]),\s*MODE=/s,'PT'),
  MODE:literal(view,/MODE=(\[[^\]]+\])/,'MODE'),
  NC:literal(view,/NC=(\[[^\]]+\])/,'NC'),
  MZ:literal(combat,/MZ=(\[[^\]]+\])/,'MZ'),
  SFXI:literal(audio,/SFXI=(\[[^\]]+\])/,'SFXI')
 };
 for(const [key,array] of Object.entries(tables))assert.equal(array.length,19,key+' covers IDs 0–15');
 assert.equal(tables.SFXI[15],tables.SFXI[1],'HK417 must reuse AK-47 firing sound');
 assert.equal(tables.SFXI[15],1);
 assert.ok(tables.MZ[15]<-1.3,'muzzle is at barrel tip');
 assert.match(controls,/\b15:'<svg/,'HUD icon exists');
 assert.match(controls,/15:"HK417 · Red-dot optic"/,'loadout description exists');
 assert.match(optic,/15:\{style:"hk417",name:"HK417"\}/,'HK417 is in tactical optic registry');
 assert.match(css,/\.tactical-aim-hk417\{[^}]*--ta-color:#ff3434/,'red-dot frame CSS');
 assert.match(css,/\.tactical-aim-hk417 \.ta-frame/,'rectangular sight style shared with SOPMOD');
 assert.match(picker,/WS_ORDER=\[[^\]]*15/,'HK417 in loadout picker');
});

test('HK417 is in the same source order and browser bundle as all weapons',()=>{
 const manifest=JSON.parse(source('tools/source-manifest.json'));
 assert.equal(manifest.parts.filter(p=>p==='src/game/weapon/16-hk417.js').length,1);
 assert.equal(manifest.parts.indexOf('src/game/weapon/16-hk417.js'),
  manifest.parts.indexOf('src/game/weapon/15-ump45-ext-d.js')+1);
 assert.ok(manifest.parts.indexOf('src/game/weapon/16-hk417.js')<manifest.parts.indexOf('src/game/weapon/20-ballistics.js'));
 const built='(function(){\n'+manifest.parts.map(source).join('')+'})();\n';
 assert.equal(source('assets/game.js'),built);
});
