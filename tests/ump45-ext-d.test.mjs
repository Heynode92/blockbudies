import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const source=path=>readFileSync(new URL(path,root),'utf8').replace(/\r\n/g,'\n');

test('UMP45 Ext D uses requested stats and an independent low-poly model',()=>{
 const ctx={WEAPON_PROFILES:[],WEAPON_RANGE_MODIFIERS:[],WEAPON_MODEL_BUILDERS:[],
  DAMAGE_FALLOFF:{defaultModifiers:{smg:.85}},
  bx:(...args)=>({kind:'box',args}),cy:(...args)=>({kind:'cylinder',args})};
 vm.runInNewContext(source('src/game/weapon/15-ump45-ext-d.js'),ctx,{filename:'15-ump45-ext-d.js'});
 const p=ctx.WEAPON_PROFILES[14];
 assert.ok(Object.isFrozen(p));
 for(const [k,v] of Object.entries({name:'UMP45 Ext D',damage:25,rpm:90,control:47,speed:87,
  vRecoil:48,hRecoil:48,mag:33,res:260,range:50,kind:'smg'}))assert.equal(p[k],v,k);
 assert.equal(ctx.WEAPON_RANGE_MODIFIERS[14],ctx.DAMAGE_FALLOFF.defaultModifiers.smg);
 const pieces=[],gun={userData:{}};
 ctx.WEAPON_MODEL_BUILDERS[14](gun,(...parts)=>pieces.push(...parts));
 assert.ok(pieces.length>=25,'detailed UMP geometry expected');
 assert.ok(pieces.some(m=>m.kind==='cylinder'),'barrel and muzzle modeled');
 assert.equal(gun.userData.opticParts,undefined,'UMP45 Ext D is unscoped');
});

test('UMP45 Ext D arrays, no-scope ADS, HUD, AK-47 sound and loadout integration',()=>{
 const view=source('src/game/weapon/30-viewmodels.js');
 const combat=source('src/game/45-combat.js');
 const audio=source('src/game/65-audio.js');
 const controls=source('src/game/75-weapon-controls.js');
 const order=source('src/game/77-loadout-picker.js');
 const optics=source('src/game/76-tactical-optics.js');
 function array(text,pattern,name){
  const found=text.match(pattern);
  assert.ok(found,name+' table exists');
  return vm.runInNewContext('('+found[1]+')');
 }
 const tables={
  ADF:array(view,/ADF=(\[[^\]]+\])/,'ADF'),
  AP:array(view,/,AP=(\[\[.*?\]\]),bobP=/s,'AP'),
  RG:array(view,/var RG=(\[\[.*?\]\]),\s*RL=/s,'RG'),
  RL:array(view,/\bRL=(\[\[.*?\]\]),\s*PT=/s,'RL'),
  PT:array(view,/\bPT=(\[\[.*?\]\]),\s*MODE=/s,'PT'),
  MODE:array(view,/MODE=(\[[^\]]+\])/,'MODE'),
  NC:array(view,/NC=(\[[^\]]+\])/,'NC'),
  MZ:array(combat,/MZ=(\[[^\]]+\])/,'MZ'),
  SFXI:array(audio,/SFXI=(\[[^\]]+\])/,'SFXI')
 };
 for(const [key,values] of Object.entries(tables))assert.equal(values.length,16,key+' must cover 16 IDs');
 assert.equal(tables.SFXI[14],tables.SFXI[1],'UMP45 Ext D must sound identical to AK-47');
 assert.equal(tables.SFXI[14],1);
 assert.match(controls,/w===14\|\|!!tacticalOpticConfig\(w\)/,'right click ADS supported');
 assert.match(controls,/\b14:'<svg/,'HUD icon exists');
 assert.match(order,/WS_ORDER=\[[^\]]*14/,'explicit loadout entry exists');
 assert.doesNotMatch(optics,/^\s*14\s*:/m,'no scoped reticle configuration');
});

test('manifest includes UMP45 before ballistics and keeps older weapons in order',()=>{
 const manifest=JSON.parse(source('tools/source-manifest.json'));
 const p='src/game/weapon/15-ump45-ext-d.js';
 assert.equal(manifest.parts.filter(item=>item===p).length,1);
 assert.equal(manifest.parts.indexOf(p),manifest.parts.indexOf('src/game/weapon/14-mp5k-ext.js')+1);
 assert.ok(manifest.parts.indexOf(p)<manifest.parts.indexOf('src/game/weapon/20-ballistics.js'));
});
