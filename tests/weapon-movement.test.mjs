import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const weaponSource=read('src/game/40-weapons-and-viewmodels.js');
const profiles=weaponSource.slice(weaponSource.indexOf('var WEAPON_PROFILES='),weaponSource.indexOf('// EW:'));
const mobility=read('src/game/43-movement.js');
const sim=read('src/game/95-simulation.js');
function setup(){
  const ctx={Math};
  runInNewContext(profiles+'\n'+mobility,ctx);
  return ctx;
}
function approx(actual,want,why){assert.ok(Math.abs(actual-want)<1e-10,`${why}: ${actual} != ${want}`);}

test('all weapon sprint speeds are their original speed rating divided by 100',()=>{
  const ctx=setup();
  for(let id=0;id<ctx.WP.length;id++){
    const rating=ctx.WEAPON_PROFILES[id].speed;
    approx(ctx.WP[id].moveMult,rating/100,ctx.WP[id].n+' multiplier');
    approx(ctx.weaponMovementSpeed(id,1,0)/ctx.MOVEMENT_RULES.baseSpeed,rating/100,ctx.WP[id].n+' sprint');
  }
});
test('Knife, AK-47, AWP sprint are 98%, 74%, 69% of base 100',()=>{
  const ctx=setup();
  for(const [id,speed] of [[4,.98],[1,.74],[8,.69]])approx(ctx.weaponMovementSpeed(id,1,0)/6.5,speed,ctx.WP[id].n);
});
test('sprint is exactly 15 percent above walking speed for every weapon',()=>{
  const ctx=setup();
  for(let id=0;id<ctx.WP.length;id++){
    const walk=ctx.weaponMovementSpeed(id,0,0);
    const run=ctx.weaponMovementSpeed(id,1,0);
    approx(run/walk,1.15,ctx.WP[id].n);
  }
});
test('ADS maintains old 38 percent reduction and never boosts sprint',()=>{
  const ctx=setup();
  for(let id of [1,4,8]){
    const walk=ctx.weaponMovementSpeed(id,0,0);
    approx(ctx.weaponMovementSpeed(id,0,1),walk*.62,ctx.WP[id].n+' ADS');
  }
});
test('partial sprint interpolation is monotonic and smooth',()=>{
  const ctx=setup(),id=1;
  const walk=ctx.weaponMovementSpeed(id,0,0),mid=ctx.weaponMovementSpeed(id,.5,0),run=ctx.weaponMovementSpeed(id,1,0);
  assert.ok(walk<mid&&mid<run);
  approx(mid,(walk+run)/2,'half-sprint');
});
test('main simulation uses shared movement calculation without heavy-weapon or double sprint penalties',()=>{
  assert.match(sim,/var spd=weaponMovementSpeed\(pl\.w,sprT,adsT\)/);
  assert.doesNotMatch(sim,/\.62\*sprT|\.12\*wtT|\.75\+\.003\*/);
  const manifest=JSON.parse(read('tools/source-manifest.json'));
  assert.ok(manifest.parts.indexOf('src/game/43-movement.js')>manifest.parts.indexOf('src/game/40-weapons-and-viewmodels.js'));
  assert.ok(manifest.parts.indexOf('src/game/43-movement.js')<manifest.parts.indexOf('src/game/95-simulation.js'));
});
