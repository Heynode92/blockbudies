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

function scene(){
 const S=new THREE.Scene(),ctx={Math,Number,S,
  onlineShotTracers:[],onlineUserId:()=> 'me',
  WP:Array.from({length:19},()=>({spd:180})),
  tracer:()=>new THREE.Group()
 };
 runInNewContext(code+'\nthis.draw=onlineShotTracer;',ctx);
 return ctx;
}

test('local K2 tracer uses actual server muzzle origin at full certified bullet speed',()=>{
 const ctx=scene(),modelTip=new THREE.Vector3(.33,-.15,-1.3);
 ctx.draw({actorId:'me',weaponId:9,x:2.4,y:1.22,z:7.1,yaw:0,pitch:0,
  projectileSpeed:420},modelTip);
 assert.equal(ctx.onlineShotTracers.length,1);
 const shot=ctx.onlineShotTracers[0];
 assert.equal(shot.scene,ctx.S);
 assert.equal(shot.m.parent,ctx.S);
 assert.deepEqual(shot.m.position.toArray(),[2.4,1.22,7.1]);
 assert.equal(shot.vz,420);
 assert.equal(shot.vx,0);
 assert.equal(shot.vy,0);
 assert.ok(shot.t>0&&shot.t<=.15);
});

test('remote and shotgun pellet visual use actual SHOT angles and server speed',()=>{
 const ctx=scene();
 const pitch=.12,yaw=.21,speed=270;
 for(let i=0;i<6;i++)ctx.draw({actorId:'bot',weaponId:2,x:1,y:1.1,z:2,
  yaw,pitch,projectileSpeed:speed,pelletIndex:i},null);
 assert.equal(ctx.onlineShotTracers.length,6);
 const shot=ctx.onlineShotTracers[0];
 assert.ok(Math.abs(shot.vx-Math.sin(yaw)*Math.cos(pitch)*speed)<1e-9);
 assert.ok(Math.abs(shot.vy-Math.sin(pitch)*speed)<1e-9);
 assert.ok(Math.abs(shot.vz-Math.cos(yaw)*Math.cos(pitch)*speed)<1e-9);
});

test('no fake laser/first-person scene rescaling and invalid metadata is ignored',()=>{
 assert.doesNotMatch(code,/scene=VS|speed\/14|Math\.min\(18/);
 assert.match(code,/S\.add\(mesh\)/);
 assert.match(code,/mesh\.position\.set\(frame\.x,frame\.y,frame\.z\)/);
 const ctx=scene();
 ctx.draw({actorId:'me',weaponId:9,x:NaN,y:1,z:2,yaw:0,pitch:0,
  projectileSpeed:180},new THREE.Vector3());
 assert.equal(ctx.onlineShotTracers.length,0);
 ctx.draw({actorId:'me',weaponId:9,x:0,y:1,z:2,yaw:0,pitch:0,
  projectileSpeed:180},new THREE.Vector3());
 assert.equal(ctx.onlineShotTracers[0].vz,180);
});
