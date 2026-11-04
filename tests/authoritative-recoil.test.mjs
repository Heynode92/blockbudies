import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const parts=JSON.parse(read('tools/source-manifest.json')).parts;
const profiles=parts.filter(p=>p.startsWith('src/game/weapon/')&&!p.endsWith('30-viewmodels.js')).map(read).join('\n');
const conditions={ads:0,speed:0,crouch:false,grounded:true},zero=()=>0,eps=1e-9;
function engine(){const c=vm.createContext({Math});vm.runInContext(profiles,c);return c;}
function sequence(c,id,changes,ads=0){
 const base=c.WEAPON_PROFILES[id],rated={...base,...changes};
 const ballistics=c.WP[id],state=c.freshGunplayState(),shots=[];
 for(let n=0;n<18;n++){
  shots.push(c.gunplayShotRated(rated,ballistics,state,
   n*ballistics.cd,{...conditions,ads},zero));
 }
 return shots;
}
test('V.Recoil changes real projectile pitch for each tested firearm, independent of camera shake',()=>{
 const c=engine();
 for(const id of [1,9,6,10,13,15,17]){
  const low=sequence(c,id,{vRecoil:0}),high=sequence(c,id,{vRecoil:100});
  assert.ok(Math.abs(high[13].pitch-low[13].pitch)>.012,'vertical recoil is ballistic for '+id);
  assert.ok(Math.abs(high[13].pitch-high[13].barrelPitch)<eps);
 }
});
test('H.Recoil independently changes actual shot yaw without mutating canonical weapon ratings',()=>{
 const c=engine();
 for(const id of [1,9,6,10,13,15,17]){
  const p=c.WEAPON_PROFILES[id],before=JSON.stringify(p);
  const low=sequence(c,id,{hRecoil:0}),high=sequence(c,id,{hRecoil:100});
  assert.ok(Math.abs(high[9].yaw-low[9].yaw)>.002,'horizontal recoil is ballistic for '+id);
  assert.ok(Math.abs(high[9].pitch-low[9].pitch)<eps);
  assert.equal(JSON.stringify(p),before);
 }
});
test('each sustained-fire round gets its own predictable H/V pose; ADS does not remove it',()=>{
 const c=engine(),k=sequence(c,9,{},1),ak=sequence(c,1,{},1);
 for(let n=1;n<12;n++){
  assert.equal(k[n].index,n);
  assert.ok(k[n].barrelPitch>k[n-1].barrelPitch);
 }
 assert.ok(Math.abs(ak[10].barrelYaw-k[10].barrelYaw)>1e-4);
 assert.ok(k[17].barrelPitch>.02);
 const compensation=-k[12].barrelPitch;
 assert.ok(Math.abs(compensation+k[12].pitch)<eps,
  'manual counter-pitch must cancel the predictable zero-noise recoil');
});
test('actual K2 3D muzzle socket moves with H/V barrel rotation and includes hands via hold group',()=>{
 const src=read('src/game/weapon/30-viewmodels.js');
 const helpers=src.slice(src.indexOf('function bx('),src.indexOf('// hold ='));
 const models=parts.filter(p=>/^src\/game\/weapon\/(0[1-9]|1[0-9])-.*\.js$/.test(p));
 const ctx=vm.createContext({T:THREE,WEAPON_PROFILES:[],WEAPON_MODEL_BUILDERS:[],
   WEAPON_RANGE_MODIFIERS:[],DAMAGE_FALLOFF:{defaultModifiers:{sniper:.99}}});
 vm.runInContext(models.map(read).join('\n')+'\n'+helpers,ctx);
 const gun=ctx.mkGun(9),socket=ctx.weaponMuzzleSocket(gun,false);
 assert.ok(socket);
 const origin=socket.getWorldPosition(new THREE.Vector3());
 const c=engine(),pose=sequence(c,9,{},1)[14];
 gun.rotation.order='YXZ';
 gun.rotation.set(pose.barrelPitch,-pose.barrelYaw,0);
 gun.updateWorldMatrix(true,true);
 const rotated=socket.getWorldPosition(new THREE.Vector3());
 assert.ok(rotated.distanceTo(origin)>.02);
 assert.match(src,/hold.rotation.set\([\s\S]*barrelPitch/);
 assert.match(src,/function syncWeaponBarrelPoseImmediate\(\)/);
 assert.match(read('src/game/45-combat.js'),/syncWeaponBarrelPoseImmediate\(\)/);
 assert.match(src,/barrelYaw/);
 const live=read('src/game/98-online-bridge.js');
 assert.match(live,/frame\.barrelPitch/);
 assert.match(live,/frame\.barrelYaw/);
 assert.match(live,/syncWeaponBarrelPoseImmediate\(\)/);
 assert.match(live,/updatedGun\.rotation\.set\(frame\.barrelPitch,Math\.PI\+frame\.barrelYaw,0\)/);
});
