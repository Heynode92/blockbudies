import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as THREE from 'three';

const source=readFileSync(new URL('../src/game/98-online-bridge.js',import.meta.url),'utf8');
const start=source.indexOf('function onlineShotTracer(');
const end=source.indexOf('function onlineWarn(',start);
assert.ok(start>=0&&end>start,'canonical online tracer entrypoint must exist');
const code=source.slice(start,end);

function scene(fov=70){
 const S=new THREE.Scene(),C=new THREE.PerspectiveCamera(70,16/9,.1,430),
  VC=new THREE.PerspectiveCamera(fov,16/9,.1,10);
 C.position.set(0,1.5,0);C.lookAt(0,1.5,10);
 C.updateWorldMatrix(true,false);VC.updateWorldMatrix(true,false);
 const ctx={Math,Number,T:THREE,S,C,VC,
  onlineShotTracers:[],onlineUserId:()=> 'me',
  WP:Array.from({length:19},()=>({spd:180})),tracer:()=>new THREE.Group()
 };
 runInNewContext(code+'\nthis.draw=onlineShotTracer;',ctx);
 return ctx;
}

test('local K2 full-speed tracer begins at actual 1P muzzle pixel, not the 3P server mouth pixel',()=>{
 for(const fov of [70,44]){
  const ctx=scene(fov),gunSocket=new THREE.Vector3(.33,-.15,-1.8);
  const server={actorId:'me',weaponId:9,x:.05,y:1.05,z:1.4,
   yaw:0,pitch:0,projectileSpeed:420};
  ctx.draw(server,gunSocket);
  assert.equal(ctx.onlineShotTracers.length,1);
  const shot=ctx.onlineShotTracers[0];
  assert.equal(shot.scene,ctx.S);
  assert.equal(shot.m.parent,ctx.S);
  const ndcMuzzle=gunSocket.clone().project(ctx.VC);
  const ndcBullet=shot.m.position.clone().project(ctx.C);
  assert.ok(ndcBullet.distanceTo(new THREE.Vector3(ndcMuzzle.x,ndcMuzzle.y,ndcBullet.z))<1e-8,
   'tracer visual must start precisely at the real visible barrel pixel even under ADS FOV');
  assert.ok(shot.m.position.distanceTo(new THREE.Vector3(server.x,server.y,server.z))>.1,
   'do not silently replace first-person muzzle projection with 3P model origin');
  assert.ok(Math.abs(Math.hypot(shot.vx,shot.vy,shot.vz)-420)<1e-9,
   'client visual tracer MUST use full certified backend speed, never slow laser velocity');
  assert.ok(shot.t>=.075&&shot.t<=.15,'original short tracer duration');
 }
});

test('remote, BOT and shotgun pellets stay on the exact trusted world trajectory',()=>{
 const ctx=scene(),yaw=.21,pitch=.12,speed=270;
 for(let i=0;i<6;i++)ctx.draw({actorId:'bot',weaponId:2,x:1,y:1.1,z:2,
  yaw,pitch,projectileSpeed:speed,pelletIndex:i},new THREE.Vector3(3,4,5));
 assert.equal(ctx.onlineShotTracers.length,6);
 const shot=ctx.onlineShotTracers[0];
 assert.deepEqual(shot.m.position.toArray(),[1,1.1,2]);
 assert.ok(Math.abs(shot.vx-Math.sin(yaw)*Math.cos(pitch)*speed)<1e-9);
 assert.ok(Math.abs(shot.vy-Math.sin(pitch)*speed)<1e-9);
 assert.ok(Math.abs(shot.vz-Math.cos(yaw)*Math.cos(pitch)*speed)<1e-9);
});

test('fallback, invalid metadata and anti-laser guard',()=>{
 assert.doesNotMatch(code,/scene=VS|speed\/14|Math\.min\(18/);
 assert.match(code,/S\.add\(mesh\)/);
 assert.match(code,/muzzle\.clone\(\)\.project\(VC\)/);
 assert.match(code,/\.unproject\(C\)/);
 const ctx=scene();
 ctx.draw({actorId:'me',weaponId:9,x:NaN,y:1,z:2,yaw:0,pitch:0,
  projectileSpeed:180},new THREE.Vector3());
 assert.equal(ctx.onlineShotTracers.length,0);
 ctx.draw({actorId:'me',weaponId:9,x:0,y:1,z:2,yaw:0,pitch:0,
  projectileSpeed:180},null);
 assert.deepEqual(ctx.onlineShotTracers[0].m.position.toArray(),[0,1,2]);
 assert.equal(ctx.onlineShotTracers[0].vz,180);
});
