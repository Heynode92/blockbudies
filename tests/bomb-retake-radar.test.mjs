import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=(p)=>readFileSync(resolve(root,p),'utf8');
const tactics=source('src/game/87-bomb-tactics.js');
const perception=source('src/game/88-bot-perception.js');
const intelligence=source('src/game/86-bomb-intelligence.js');
const radarSrc=source('src/game/96-hud-and-radar.js');
const radarHelpers=radarSrc.slice(radarSrc.indexOf('var BOMB_RADAR='),radarSrc.indexOf('// cfont():'));
const css=source('src/styles/07-bomb-mission.css');

function state(){
  const device={position:{x:25,z:5}};
  const defuser={tm:0,idx:0,x:24,z:14,dead:false};
  const officer={tm:0,idx:1,x:-10,z:50,dead:false};
  const guard={tm:1,idx:2,x:24,z:11,dead:false};
  const ctx={Math,Object,Array,A:80,tt:3,en:[defuser,officer,guard],
    pl:{tm:1,x:-72,z:-60,dead:false},
    BOMB_SITES:[{id:'A',x:-25,z:-5},{id:'B',x:25,z:5}],
    bombMatch:{state:'planted',site:1,done:false,device,defuser:null},
    isBombMode(){return true;},inObs(){return false;},los(){return true;},
    bombActionFor(){return null;}
  };
  runInNewContext(perception,ctx);
  runInNewContext(intelligence,ctx);
  runInNewContext(tactics,ctx);
  return {ctx,defuser,officer,guard};
}

test('after planting, surviving Police do not retain distant guard or patrol roles',()=>{
  const {ctx,defuser,officer}=state();
  assert.equal(ctx.bombTacticalStage(defuser),'retake-defuse');
  assert.equal(ctx.bombTacticalStage(officer),'retake-assault');
});
test('the assigned defuser approaches the real bomb position',()=>{
  const {ctx,defuser}=state();
  assert.deepEqual([...ctx.bombTacticalGoal(defuser)],[25,5]);
});
test('assault officers chase Terrorists close to the planted device',()=>{
  const {ctx,officer,guard}=state();
  officer.x=8;officer.z=5;
  ctx.botIntelAcquire(officer);
  assert.deepEqual([...ctx.bombTacticalGoal(officer)],[guard.x,guard.z]);
});
test('if the enemy is away, assault officers sweep immediately around the planted device',()=>{
  const {ctx,officer,guard}=state();guard.x=-65;guard.z=-65;
  const goal=ctx.bombTacticalGoal(officer);
  assert.ok(Math.hypot(goal[0]-25,goal[1]-5)<ctx.BOMB_AI.retakeSweepRadius+.01);
});
test('Police push visible enemies in Bomb Mode while legacy TDM combat expression remains',()=>{
  const ai=source('src/game/90-bot-ai.js');
  assert.match(ai,/bombMatch\.state==='planted'&&e\.tm===0/);
  assert.match(ai,/BOMB_AI\.retakeCombatDistance/);
  assert.match(ai,/d>16\?1:d<7\?-\.6:0/);
});
test('radar keeps standard range without bomb and grows to reveal distant planted devices',()=>{
  const ctx={Math,Object,bombMatch:{state:'planted',done:false,device:{position:{x:100,z:-30}}},isBombMode(){return true;},bombDroppedSignalVisible(){return false;}};
  runInNewContext(radarHelpers,ctx);
  const radius=ctx.bombRadarRange({x:-60,z:50});
  assert.ok(radius>Math.hypot(160,80),'entire offset to the planted device must fit in the radar');
  ctx.bombMatch.state='idle';assert.equal(ctx.bombRadarRange({x:0,z:0}),50);
  ctx.bombMatch.state='planted';ctx.bombMatch.done=true;
  assert.equal(ctx.bombRadarRange({x:0,z:0}),50);
});
test('pulsing minimap signal uses exact live device coordinates, not site center',()=>{
  const ctx={Math,Object,bombMatch:{state:'planted',done:false,site:0,device:{position:{x:17,z:27}}},isBombMode(){return true;}};
  runInNewContext(radarHelpers,ctx);
  const arcs=[];
  const X={save(){},restore(){},beginPath(){},stroke(){},fill(){},arc(x,z,r){arcs.push([x,z,r]);}};
  ctx.bombRadarBeacon(X,2,3.3);
  assert.equal(arcs.length,3);
  assert.ok(arcs.every(q=>q[0]===17&&q[1]===27));
  ctx.bombMatch.done=true;ctx.bombRadarBeacon(X,2,3.4);
  assert.equal(arcs.length,3,'signal must disappear after the round ends');
});
test('only Bomb Mission spectator CSS hides the oversized center title',()=>{
  assert.match(css,/body\.bomb-spectator #rsp\{display:none!important\}/);
  assert.match(css,/#bombSpec\{[^}]*font:700 13px/);
  assert.match(css,/\.touch #bombSpec\{font-size:12px/);
  assert.doesNotMatch(source('src/styles/05-match.css'),/bomb-spectator/);
});
