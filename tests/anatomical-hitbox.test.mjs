import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function setup(){
 const c={Math,Number,Object};
 runInNewContext(read('src/game/39-defense.js'),c);
 return c;
}
const pose={x:0,y:0,z:8,yaw:0,crouch:false,gaitPhase:0,gaitPace:0};
const cast=(c,x,y,p=pose)=>c.sweptCharacterHit({x,y,z:0},{x,y,z:15},p);
test('original visible 3P model dimensions, narrow actual head and no above-shoulder ghost headshot',()=>{
 const c=setup(),r=c.CHARACTER_HITBOX_RULES;
 assert.equal(r.revision,'pointblock-hitbox-2026-11-05-p3');
 assert.equal(r.head.centerY,1.65);
 assert.equal(r.head.halfX,.25);
 assert.equal(cast(c,0,1.65)?.hitgroup,'head');
 for(const x of [.4,.70,.85])assert.equal(cast(c,x,1.65),null);
 assert.equal(cast(c,0,2.01),null);
 assert.equal(cast(c,0,1.15)?.hitgroup,'chest');
 assert.equal(cast(c,0,.75)?.hitgroup,'stomach');
 assert.equal(cast(c,.53,1.20)?.hitgroup,'arm');
 assert.equal(cast(c,.2,.23)?.hitgroup,'leg');
});
test('same collision applies to human/BOT and is first contact along swept bullet',()=>{
 const c=setup(),a=cast(c,0,1.65);
 const bot=c.sweptCharacterHit({x:0,y:1.65,z:0},{x:0,y:1.65,z:15},{...pose,bot:true});
 const human=c.sweptCharacterHit({x:0,y:1.65,z:0},{x:0,y:1.65,z:15},{...pose,bot:false});
 assert.equal(bot?.hitgroup,'head');assert.equal(human?.hitgroup,'head');
 assert.equal(bot.fraction,human.fraction);
 assert.ok(bot.fraction>=0&&bot.fraction<=1);
 assert.equal(a.point.z,bot.point.z);
});
test('crouched head follows the rendered body and lower body remains hittable',()=>{
 const c=setup(),crouch={...pose,crouch:true};
 assert.equal(cast(c,0,1.65,crouch),null);
 assert.equal(cast(c,0,1.25,crouch)?.hitgroup,'head');
 assert.equal(cast(c,0,.72,crouch)?.hitgroup,'chest');
 assert.equal(cast(c,0,.32,crouch)?.hitgroup,'stomach');
 assert.equal(cast(c,.2,.07,crouch)?.hitgroup,'leg');
});
test('gait-aware legs and invalid hitbox inputs use deterministic guarded geometry',()=>{
 const c=setup(),stationary={...pose,gaitPace:0,gaitPhase:0};
 const walking={...pose,gaitPace:1,gaitPhase:Math.PI/2};
 const from={x:.2,y:.13,z:0},to={x:.2,y:.13,z:15};
 const still=c.sweptCharacterHit(from,to,stationary),moving=c.sweptCharacterHit(from,to,walking);
 assert.equal(still?.hitgroup,'leg');
 assert.notEqual(still?.point.z,moving?.point.z);
 for(const bad of [{...pose,x:NaN},{...pose,yaw:Infinity},{...pose,gaitPhase:NaN}]){
  assert.throws(()=>c.sweptCharacterHit(from,to,bad),e=>e?.name==='RangeError');
 }
});
test('real offline combat uses segment hitgroup and server-visible online crouch snapshot',()=>{
 const simulation=read('src/game/95-simulation.js'),impact=read('src/game/42-projectile-defense.js');
 const bridge=read('src/game/98-online-bridge.js');
 assert.match(simulation,/sweptCharacterHit\(start,finish/);
 assert.doesNotMatch(simulation,/Math\.hypot\(EE\.x-p\.x,EE\.z-p\.z\)<\.85/);
 assert.match(impact,/verifiedBodyGroup/);
 assert.match(bridge,/crouch:!!actor\.crouch/);
 assert.match(bridge,/CHARACTER_HITBOX_RULES\.crouchDrop/);
 assert.equal(setup().DEFENSE_RULES.headshotMultiplier,3);
});
