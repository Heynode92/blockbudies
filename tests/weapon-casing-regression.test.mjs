import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8').replace(/\r\n/g,'\n');
const source=read('src/game/50-items-and-drops.js');
const casingSource=source.slice(source.indexOf('function weaponCasingType('),source.indexOf('// GSC = original dropped-gun scales'));
const dropsSource=source.slice(source.indexOf('var GSC='),source.indexOf('// detachGun():'));

test('first Saiga shot ejects a shotgun casing instead of indexing CSP[18]',()=>{
 const spawned=[];
 class Vector3{
  constructor(x,y,z){Object.assign(this,{x,y,z});}
  set(x,y,z){Object.assign(this,{x,y,z});return this;}
  applyQuaternion(){return this;}
 }
 const WP=Array.from({length:19},()=>({stats:{kind:'rifle'}}));
 for(const [id,kind] of [[0,'pistol'],[2,'shotgun'],[6,'smg'],[7,'dual'],[8,'sniper'],[14,'smg'],[17,'sniper'],[18,'shotgun']])WP[id]={stats:{kind}};
 const ctx={WP,CSP:[[.05,.02,-.25],[.06,.03,-.35],[.06,.03,-.1]],CSR:[.024,.026,.037],
 T:{Vector3},C:{fov:70,quaternion:{},localToWorld:()=>{}},hold:{localToWorld:()=>{}},
 S:{add:()=>{},remove:()=>{}},dg:[],
 mkCasing:type=>{spawned.push(type);return{position:{copy(){}},rotation:{set(){}},traverse:()=>{}};},
 addDrop:()=>{ctx.dg.push({});}};
 vm.createContext(ctx);
 vm.runInContext(casingSource,ctx);
 for(const [id,want] of [[18,2],[2,2],[17,1],[8,1],[14,0],[6,0],[7,0],[0,0],[1,1]]){
  assert.equal(vm.runInContext('weaponCasingType('+id+')',ctx),want);
  assert.doesNotThrow(()=>vm.runInContext('ejectShell('+id+',1)',ctx),'ejection for weapon '+id);
  assert.equal(spawned.at(-1),want);
 }
 assert.equal(spawned.length,9);
});
test('death drop of Saiga and other new weapons uses a finite legacy class scale',()=>{
 const kinds=['pistol','rifle','shotgun','rocket','knife','grenade','smg','dual','sniper',
 'rifle','smg','smg','rifle','smg','smg','rifle','rifle','sniper','shotgun'];
 const ctx={WP:kinds.map(kind=>({stats:{kind}})),
 pl:{w:18,face:0,x:0,z:0},mkGun:()=>({scale:{setScalar(v){ctx.scaled=v;}},rotation:{},position:{set(){}},traverse(){}}),
 S:{add(){}},addDrop:(...args)=>{ctx.dropHeight=args[4];}};
 vm.createContext(ctx);
 vm.runInContext(dropsSource,ctx);
 for(const [id,expectedClass] of [[18,'shotgun'],[17,'sniper'],[16,'rifle'],[14,'smg']]){
  const classId=kinds.indexOf(expectedClass);
  ctx.pl.w=id;
  assert.equal(vm.runInContext('dropVisualIndex(pl.w)',ctx),classId);
  assert.doesNotThrow(()=>vm.runInContext('dropPlayerGun()',ctx));
  assert.ok(Number.isFinite(ctx.scaled)&&ctx.scaled>0);
  assert.ok(Number.isFinite(ctx.dropHeight));
 }
});
test('compiled browser script exactly mirrors source manifest after casing fix',()=>{
 const m=JSON.parse(read('tools/source-manifest.json'));
 const expected='(function(){\n'+m.parts.map(read).join('')+'})();\n';
 assert.equal(read('assets/game.js'),expected);
});
