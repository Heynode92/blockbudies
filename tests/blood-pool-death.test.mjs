import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8').replace(/\r\n/g,'\n');
const source=read('src/game/46-blood-pools.js');
const audio=read('src/game/65-audio.js');
const player=read('src/game/70-kills-and-damage-hud.js');
const match=read('src/game/85-lobby-and-match.js');
const sim=read('src/game/95-simulation.js');
const combat=read('src/game/45-combat.js');

function game(){
 const added=[],removed=[];
 class Shape{moveTo(){}lineTo(){}closePath(){}}
 class ShapeGeometry{constructor(shape){this.shape=shape;}}
 class Material{constructor(props){Object.assign(this,props);}}
 class Node{constructor(){
  this.position={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}};
  this.rotation={x:0,y:0,z:0};
  this.scale={x:1,y:1,z:1,set(x,y,z){this.x=x;this.y=y;this.z=z;}};
  this.visible=true;this.children=[];
 }add(node){this.children.push(node);}}
 class Mesh extends Node{constructor(geometry,material){super();this.geometry=geometry;this.material=material;}}
 class Group extends Node{}
 const ctx={T:{Shape,ShapeGeometry,MeshBasicMaterial:Material,Mesh,Group,DoubleSide:2},Math,Number,
  S:{add(node){added.push(node);},remove(node){removed.push(node);}},
  gh(x,z,y){return y>2?3:0;}};
 runInNewContext(source,ctx);
 return{ctx,added,removed};
}
test('corpse puddle stays invisible until landing, then spreads on actual corpse position',()=>{
 const {ctx,added}=game(),corpse={x:2,z:4,y:0,by:0,w:0,land:false};
 const p=ctx.bloodPoolSpawn(2,0,4,corpse);
 assert.ok(p);assert.equal(added.length,1);assert.equal(p.g.visible,false);
 ctx.bloodPoolUpdate(.5);assert.equal(p.g.visible,false);
 assert.equal(p.age,0,'airborne corpse should not leak a premature floor pool');
 corpse.x=3;corpse.z=5;corpse.by=1;corpse.land=true;
 ctx.bloodPoolUpdate(.15);
 assert.equal(p.g.visible,true);
 assert.equal(p.g.position.x,3);assert.equal(p.g.position.z,5);
 assert.equal(p.g.position.y,1.035);
 const first=p.base.scale.x;
 ctx.bloodPoolUpdate(.7);
 assert.ok(p.base.scale.x>first,'puddle expands as it flows');
 assert.ok(p.baseMat.opacity>0);
 assert.equal(p.flows.length,3,'irregular rivulets extend away from the center');
 ctx.bloodPoolClear();
 assert.equal(ctx.bloodPoolLive.length,0);
});
test('BOT puddle fades with corpse blink and removes exactly with corpse',()=>{
 const {ctx,removed}=game(),body={x:0,z:0,by:0,w:0,land:true};
 const p=ctx.bloodPoolSpawn(0,0,0,body);
 ctx.bloodPoolUpdate(1.4);
 const alpha=p.baseMat.opacity;assert.ok(alpha>.5);
 body.w=1.8;ctx.bloodPoolUpdate(.05);
 assert.ok(p.baseMat.opacity<alpha,'fade follows corpse disappearance');
 body.w=2.2;ctx.bloodPoolUpdate(.05);
 assert.equal(p.g.visible,false);
 ctx.bloodPoolRemove(p);
 assert.equal(ctx.bloodPoolLive.length,0);
 assert.ok(removed.includes(p.g));
 assert.equal(ctx.bloodPoolFree.length,1,'mesh group goes to reusable cache');
 assert.match(audio,/bloodPoolRemove\(d\.bloodPool\);S\.remove\(d\.g\)/);
});
test('player puddle fades completely by respawn and is removed from scene',()=>{
 const {ctx,removed}=game();
 const p=ctx.bloodPoolSpawn(1,3,2,null);
 assert.equal(p.g.position.y,3.035,'player pool uses elevated local ground');
 for(let i=0;i<10;i++)ctx.bloodPoolUpdate(.3);
 assert.ok(p.g.visible);
 const opacity=p.baseMat.opacity;
 for(let i=0;i<6;i++)ctx.bloodPoolUpdate(.3);
 assert.equal(ctx.bloodPoolLive.length,0);
 assert.equal(p.g.visible,false);
 assert.ok(removed.includes(p.g));
 assert.ok(opacity>0);
 assert.match(player,/pl\.bloodPool=bloodPoolSpawn\(pl\.x,pl\.y\|\|0,pl\.z,null\)/);
 assert.match(match,/function respawnPl\(\)\{bloodPoolRemove\(pl\.bloodPool\);pl\.bloodPool=null;/);
});
test('blood pools cap all active scene objects, reuse cache and reset cleanly',()=>{
 const {ctx,added,removed}=game(),pools=[];
 for(let i=0;i<30;i++)pools.push(ctx.bloodPoolSpawn(i,0,0,null));
 assert.equal(ctx.bloodPoolLive.length,24);
 assert.equal(pools.filter(Boolean).length,24);
 assert.equal(added.length,24);
 const freed=pools[0];ctx.bloodPoolRemove(freed);
 const reused=ctx.bloodPoolSpawn(40,0,3,null);
 assert.equal(reused,freed);
 assert.equal(ctx.bloodPoolLive.length,24);
 ctx.bloodPoolClear();
 assert.equal(ctx.bloodPoolLive.length,0);
 assert.equal(ctx.bloodPoolFree.length,24);
 assert.equal(removed.length,25);
 assert.match(combat,/bloodPoolClear\(\);bloodActive=0;pl=\{/);
 assert.match(sim,/updDead\(dt\);bloodPoolUpdate\(dt\)/);
});
test('integration maintains 3D per-character effects without creating decals or touching damage',()=>{
 const manifest=JSON.parse(read('tools/source-manifest.json')),parts=manifest.parts;
 assert.equal(parts.filter(p=>p==='src/game/46-blood-pools.js').length,1);
 assert.equal(parts[parts.indexOf('src/game/45-combat.js')+1],'src/game/46-blood-pools.js');
 assert.doesNotMatch(source,/gDecal\(|addDecal\(|DC\.push\(/);
 assert.doesNotMatch(source,/pl\.hp|e\.hp|damage|WP\[/);
 assert.match(audio,/corpse\.bloodPool=bloodPoolSpawn\(/);
 assert.match(sim,/bloodPoolUpdate\(dt\)/);
 assert.match(player,/function die\(\)\{pl\.dead=true;/);
});
