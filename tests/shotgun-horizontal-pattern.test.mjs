import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const manifest=JSON.parse(read('tools/source-manifest.json'));
const weapons=manifest.parts.filter(p=>p.startsWith('src/game/weapon/')&&!p.endsWith('30-viewmodels.js')).map(read).join('\n');
const combat=read('src/game/45-combat.js');
const fire=combat.slice(combat.indexOf('function fire('),combat.indexOf('// boom():'));
function volley({id=2,ads=0,owner='p',rand=.5,pitch=0}={}){
 const bullets=[],math=Object.create(Math);math.random=()=>rand;
 const env={Math:math,T:THREE,tt:0,pl:{w:id,pitch,vy:0},adsT:ads,
  offlineGunMuzzleWorld(){return new THREE.Vector3(0,1.4,0);},
  syncWeaponBarrelPoseImmediate(){},
  hold:{position:{x:0,y:-.6,z:-.6}},MZ:Array(19).fill(-.9),shotSide:0,A:80,bl:bullets,
  S:{add(){}},botSoundEmit(){},enemyShotFx(){},smoke(){},
  tracer(){return{quaternion:{setFromUnitVectors(){}},rotation:{set(){}},position:{set(x,y,z){Object.assign(this,{x,y,z});}}}},
  sweepObs(){return false},sweepLT(){return false},obsAt(){return false}};
 const context=vm.createContext(env);vm.runInContext(weapons+'\n'+fire,context);
 const shooter={x:0,y:0,z:0,tm:0,gunplaySpeed:0};
 context.fire(shooter,0,context.WP[id],owner,0);
 return {bullets,shooter,profile:context.WP[id]};
}
const yaw=b=>Math.atan2(b.vx,b.vz);
const center=a=>a.reduce((n,b)=>n+yaw(b),0)/a.length;
test('six canonical shotgun pellets retain deterministic radial constellation and damage',()=>{
 const a=volley({rand:.5}),b=volley({rand:.1});
 assert.equal(a.bullets.length,6);assert.equal(b.bullets.length,6);
 assert.ok(new Set(a.bullets.map(v=>yaw(v).toFixed(4))).size>3);
 assert.ok(new Set(a.bullets.map(v=>v.vy.toFixed(4))).size>3);
 assert.equal(a.shooter.gunplayStates.get(2).shots,1,'one recoil step, not six');
 for(let i=0;i<6;i++){
  assert.equal(a.bullets[i].dmg,28);
  assert.ok(Math.abs((yaw(a.bullets[i])-yaw(a.bullets[0]))-
    (yaw(b.bullets[i])-yaw(b.bullets[0])))<.000001);
  assert.equal(a.bullets[i].life,a.profile.life);
 }
 assert.equal(volley({id:18}).bullets.length,6);
 assert.equal(volley({id:1}).bullets.length,1);
});
test('ADS narrows two-axis pellet dispersion without turning the shotgun into a laser',()=>{
 const h=volley({ads:0}).bullets,a=volley({ads:1}).bullets;
 const span=shots=>Math.max(...shots.map(v=>Math.abs(yaw(v)-center(shots))));
 assert.ok(span(a)<span(h));
 const verticalSpan=shots=>Math.max(...shots.map(v=>v.vy))-Math.min(...shots.map(v=>v.vy));
 assert.ok(verticalSpan(a)<verticalSpan(h));
 assert.ok(span(a)>.03,'ADS still retains a finite multi-pellet cone');
});
test('original radial pattern and stable weapon IDs remain registered',()=>{
 const c=vm.createContext({});vm.runInContext(read('src/game/weapon/21-shotgun-spread-pattern.js'),c);
 const pts=Array.from({length:6},(_,i)=>c.shotgunPelletSpread(i,6));
 assert.ok(pts.some(p=>p[0]<-.2)&&pts.some(p=>p[0]>.2));
 assert.ok(pts.some(p=>p[1]<-.2)&&pts.some(p=>p[1]>.2));
 assert.ok(pts.every(p=>Math.hypot(...p)<=.88));
});
