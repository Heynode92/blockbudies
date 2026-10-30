import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const source=path=>readFileSync(new URL(path,root),'utf8').replace(/\r\n/g,'\n');
const model=source('src/game/weapon/14-mp5k-ext.js');

test('MP5K Ext registers a new, stable SMG with the exact requested ratings',()=>{
 const ctx={
  WEAPON_PROFILES:[],WEAPON_MODEL_BUILDERS:[],WEAPON_RANGE_MODIFIERS:[],
  DAMAGE_FALLOFF:{defaultModifiers:{smg:.85}},
  bx:(...args)=>({shape:'box',args}),cy:(...args)=>({shape:'cylinder',args})
 };
 vm.runInNewContext(model,ctx,{filename:'14-mp5k-ext.js'});
 const p=ctx.WEAPON_PROFILES[13];
 assert.equal(p.name,'MP5K Ext');
 for(const [key,value] of Object.entries({damage:22,rpm:92,control:46,speed:86,vRecoil:49,hRecoil:60,mag:30,res:210,range:45,kind:'smg'}))assert.equal(p[key],value,key);
 assert.equal(ctx.WEAPON_RANGE_MODIFIERS[13],ctx.DAMAGE_FALLOFF.defaultModifiers.smg);
 const parts=[],group={userData:{}};
 ctx.WEAPON_MODEL_BUILDERS[13](group,(...meshes)=>parts.push(...meshes));
 assert.ok(parts.length>=20,'low-poly mesh contains detailed receiver and suppressor');
 assert.ok(parts.some(part=>part.shape==='cylinder'&&part.args[2]>=.6),'integrated silencer is visible');
 assert.equal(group.userData.opticParts,undefined,'unscoped MP5K has no fake optic mesh');
});

test('MP5K Ext is wired into the same ADS, reload, sound and HUD tables',()=>{
 const view=source('src/game/weapon/30-viewmodels.js');
 const controls=source('src/game/75-weapon-controls.js');
 const combat=source('src/game/45-combat.js');
 const audio=source('src/game/65-audio.js');
 const loadout=source('src/game/77-loadout-picker.js');
 const optics=source('src/game/76-tactical-optics.js');
 const readLiteral=expr=>vm.runInNewContext('('+expr+')');
 const bracketArray=(text,pattern,name)=>{
  const match=text.match(pattern);
  assert.ok(match,name+' missing');
  return readLiteral(match[1]);
 };
 const fov=bracketArray(view,/ADF=(\[[^\]]+\])/, 'ADS FOV');
 const offsets=bracketArray(view,/,AP=(\[\[.*?\]\]),bobP=/s,'ADS position');
 const rg=bracketArray(view,/var RG=(\[\[.*?\]\]),\s*RL=/s,'right grip');
 const rl=bracketArray(view,/\bRL=(\[\[.*?\]\]),\s*PT=/s,'left grip');
 const pt=bracketArray(view,/\bPT=(\[\[.*?\]\]),\s*MODE=/s,'reload hand path');
 const mode=bracketArray(view,/MODE=(\[[^\]]+\])/, 'reload mode');
 const cycles=bracketArray(view,/NC=(\[[^\]]+\])/, 'reload cycles');
 const muzzle=bracketArray(combat,/MZ=(\[[^\]]+\])/, 'muzzle placement');
 const sfx=bracketArray(audio,/SFXI=(\[[^\]]+\])/, 'audio mapping');
 for(const [name,list] of Object.entries({fov,offsets,rg,rl,pt,mode,cycles,muzzle,sfx}))
  assert.equal(list.length,19,name+' must cover all 19 weapon IDs');
 assert.equal(sfx[13],5);
 const sounds=bracketArray(audio,/var GS=(\[.*?\]),SFXI=/s,'audio presets');
 assert.equal(sounds[5].suppressed,true);
 assert.ok(sounds[5].v<sounds[1].v,'suppressed MP5K has a softer shot than standard SMGs');
 assert.match(controls,/w===13\|\|w===14\|\|!!tacticalOpticConfig\(w\)/);
 assert.match(controls,/\b13:'<svg/);
 assert.match(loadout,/WS_ORDER=\[[^\]]*13/);
 assert.doesNotMatch(optics,/^\s*13\s*:/m,'MP5K does not acquire a sniper or red-dot overlay');
});

test('generated browser bundle exactly matches the ordered source manifest',()=>{
 const manifest=JSON.parse(source('tools/source-manifest.json'));
 const newModule='src/game/weapon/14-mp5k-ext.js';
 assert.equal(manifest.parts.filter(part=>part===newModule).length,1);
 assert.ok(manifest.parts.indexOf(newModule)<manifest.parts.indexOf('src/game/weapon/20-ballistics.js'));
 const expected='(function(){\n'+manifest.parts.map(source).join('')+'})();\n';
 assert.equal(source('assets/game.js'),expected);
});
