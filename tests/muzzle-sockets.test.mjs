import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const source=read('src/game/weapon/30-viewmodels.js');
const helpers=source.slice(source.indexOf('function bx('),source.indexOf('// hold ='));
function models(){
 const paths=JSON.parse(read('tools/source-manifest.json')).parts.filter(p=>
  /^src\/game\/weapon\/(0[1-9]|1[0-9])-.*\.js$/.test(p));
 const ctx=vm.createContext({
  T:THREE,WEAPON_PROFILES:[],WEAPON_MODEL_BUILDERS:[],WEAPON_RANGE_MODIFIERS:[],
  DAMAGE_FALLOFF:{defaultModifiers:{pistol:.91,rifle:.98,smg:.85,dual:.85,shotgun:.7,sniper:.99}}
 });
 vm.runInContext(paths.map(read).join('\n')+'\n'+helpers,ctx);
 return ctx;
}
test('real muzzle socket follows K2 mesh barrel tip (not hardcoded legacy MZ)',()=>{
 const c=models(),gun=c.mkGun(9),tip=c.weaponMuzzleSocket(gun,false);
 assert.ok(tip);
 assert.ok(Math.abs(tip.position.x)<1e-6);
 assert.ok(Math.abs(tip.position.y-.005)<1e-5);
 assert.ok(Math.abs(tip.position.z+1.32)<1e-5);
 const before=tip.getWorldPosition(new THREE.Vector3());
 gun.position.set(1.2,.4,2);
 gun.rotation.y=Math.PI/4;
 gun.updateWorldMatrix(true,true);
 const after=tip.getWorldPosition(new THREE.Vector3());
 assert.ok(after.distanceTo(before)>.5,'barrel socket must move with model transform');
 assert.ok(after.distanceTo(gun.localToWorld(tip.position.clone()))<1e-8);
});
test('all 17 ballistic weapons own mesh-derived sockets; Dual Kriss has two independent mouths',()=>{
 const c=models();
 for(let id=0;id<19;id++){
  const gun=c.mkGun(id),right=c.weaponMuzzleSocket(gun,false);
  if(id===4||id===5){assert.equal(right,null);continue;}
  assert.ok(right,'missing real mesh muzzle for weapon '+id);
  assert.ok(Number.isFinite(right.position.z)&&right.position.z<0);
 }
 const dual=c.mkGun(7),right=c.weaponMuzzleSocket(dual,false),left=c.weaponMuzzleSocket(dual,true);
 assert.notEqual(right,left);
 dual.updateWorldMatrix(true,true);
 assert.ok(Math.abs(left.getWorldPosition(new THREE.Vector3()).x-
    right.getWorldPosition(new THREE.Vector3()).x+.52)<1e-6);
});
test('online first-person muzzle tracer renders in VS camera space and server still owns impacts',()=>{
 const live=read('src/game/98-online-bridge.js'),render=read('src/game/99-render-loop.js');
 assert.match(live,/var scene=S,velocity=/);
 assert.match(live,/scene=VS/);
 assert.match(live,/worldTarget=.*\.project\(C\)/);
 assert.match(live,/\.unproject\(VC\)/);
 assert.match(live,/weaponMuzzleSocket\(guns\[frame\.weaponId\],left\)/);
 assert.match(render,/rightMuzzle\.getWorldPosition/);
 assert.doesNotMatch(live,/mesh\.position\.set\(frame\.x,frame\.y,frame\.z\)/);
});
