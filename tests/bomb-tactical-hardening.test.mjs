import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=(path)=>readFileSync(resolve(root,path),'utf8');
const tactics=read('src/game/87-bomb-tactics.js');
const perception=read('src/game/88-bot-perception.js');
const intelligence=read('src/game/86-bomb-intelligence.js');
const mission=read('src/game/86-bomb-mission.js');
const audio=read('src/game/65-audio.js');
const damage=read('src/game/70-kills-and-damage-hud.js');
const defense=read('src/game/39-defense.js');

function makeState(){
  const bomb={x:25,y:0,z:5};
  const cop={idx:0,tm:0,name:'MIKE',x:24,z:5,dead:false,hp:100,inv:0};
  const terror={idx:1,tm:1,name:'RAZOR',x:26,z:7,dead:false,hp:100,inv:0};
  const pl={tm:1,x:-60,z:-60,dead:true,hp:100};
  const ctx={Math,Object,Array,A:80,tt:12,en:[cop,terror],pl,
    BOMB_RULES:{plantSeconds:5,defuseSeconds:7,plantHitRecoverySeconds:.9},
    BOMB_SITES:[{x:-25,z:-5},{x:25,z:5}],
    mt:{cd:0,t:100},
    bombMatch:{done:false,state:'planted',site:1,device:{position:bomb},defuser:null,carrier:null},
    bombArea(e){return Math.hypot(e.x-25,e.z-5)<3.1?1:-1;},
    bombActionFor(e){return this.bombMatch.state==='planted'&&e.tm===0?{type:'defuse',site:1}:
      this.bombMatch.state==='idle'&&e.tm===1&&this.bombMatch.carrier===e?{type:'plant',site:1}:null;},
    inObs(){return false;},los(){return true;},bloodHit(){},isBombMode(){return true;},bombPlant(){ctx.bombMatch.state='planted';},bombDefuse(){ctx.bombMatch.done=true;}
  };
  // A VM global function does not use this, use a closure-safe function below.
  ctx.bombActionFor=function(e){if(ctx.bombMatch.state==='planted'&&e.tm===0)return {type:'defuse',site:1};
    if(ctx.bombMatch.state==='idle'&&e.tm===1&&ctx.bombMatch.carrier===e&&ctx.bombArea(e)>=0)return {type:'plant',site:1};return null;};
  runInNewContext(perception,ctx);
  runInNewContext(intelligence,ctx);
  runInNewContext(tactics,ctx);
  ctx.botIntelAcquire(cop);ctx.botIntelAcquire(terror);
  // The actual damage handlers depend on defenseDamage; include its production implementation.
  runInNewContext(defense,ctx);
  const part=mission.slice(mission.indexOf('function bombInterruptPlant('),mission.indexOf('function bombPlant('));
  runInNewContext(part,ctx);
  return {ctx,cop,terror,pl};
}

test('sole surviving Police bot fights enemy near bomb before defusing',()=>{
  const {ctx,cop,terror}=makeState();
  assert.equal(ctx.bombPickDefuser(),null);
  assert.equal(ctx.bombTacticalStage(cop),'retake-assault');
  assert.deepEqual([...ctx.bombTacticalGoal(cop)],[terror.x,terror.z]);
  assert.equal(ctx.bombBotCanAct(cop),false);
});
test('after clearing nearby enemy, sole Police bot immediately resumes defuse',()=>{
  const {ctx,cop,terror}=makeState();ctx.bombPickDefuser();terror.dead=true;
  assert.equal(ctx.bombPickDefuser(),cop);
  assert.equal(ctx.bombTacticalStage(cop),'retake-defuse');
  assert.equal(ctx.bombBotCanAct(cop),true);
});
test('last sighting expires before solo Police resumes an uncontested defuse',()=>{
  const {ctx,cop,terror}=makeState();
  terror.x=-60;terror.z=-45;
  assert.equal(ctx.bombPickDefuser(),null,'recent contact remains a short-lived threat');
  ctx.tt+=4;
  assert.equal(ctx.bombPickDefuser(),cop,'expired contact cannot block defuse forever');
  assert.equal(ctx.bombTacticalStage(cop),'retake-defuse');
});
test('lone Terrorist hunts remaining Police instead of holding a random bomb angle',()=>{
  const {ctx,cop,terror}=makeState();ctx.pl.dead=true;
  cop.x=-47;cop.z=-21;
  assert.equal(ctx.bombTacticalStage(terror),'hunt');
  // After LOS is lost, the BOT must use the previously observed location,
  // not the live hidden Police position at (-47,-21).
  assert.deepEqual([...ctx.bombTacticalGoal(terror)],[24,5]);
});
test('carrier clears site and cannot plant while Police are threatening',()=>{
  const {ctx,cop,terror}=makeState();
  ctx.bombMatch.state='idle';ctx.bombMatch.carrier=terror;
  assert.equal(ctx.bombTacticalStage(terror),'clear');
  assert.deepEqual([...ctx.bombTacticalGoal(terror)],[cop.x,cop.z]);
  assert.equal(ctx.bombBotCanAct(terror),false);
  cop.dead=true;
  assert.equal(ctx.bombTacticalStage(terror),'plant');
  assert.equal(ctx.bombBotCanAct(terror),true);
  ctx.bombAct(terror,4,true);assert.equal(ctx.bombMatch.state,'idle');
  ctx.bombAct(terror,1,true);assert.equal(ctx.bombMatch.state,'planted');
});
test('bot stops an ongoing plant when a living enemy enters the site',()=>{
  const {ctx,cop,terror}=makeState();ctx.bombMatch.state='idle';ctx.bombMatch.carrier=terror;
  cop.dead=true;ctx.bombAct(terror,2,true);assert.equal(terror.bAction.t,2);
  cop.dead=false;ctx.botIntelAcquire(terror);
  ctx.bombAct(terror,.1,ctx.bombBotCanAct(terror));
  assert.equal(terror.bAction,null);
  cop.dead=true;ctx.bombAct(terror,.1,ctx.bombBotCanAct(terror));
  assert.ok(terror.bAction&&terror.bAction.t<1,'progress must restart at zero');
});
test('real bot damage handler cancels planting and enforces recovery before retry',()=>{
  const {ctx,cop,terror}=makeState();ctx.bombMatch.state='idle';ctx.bombMatch.carrier=terror;cop.dead=true;
  ctx.bombAct(terror,2,true);assert.equal(terror.bAction.t,2);
  const fn=audio.split('\n').find(line=>line.startsWith('function dmgE('));
  assert.ok(fn,'original bot damage implementation exists');
  ctx.killE=()=>{throw new Error('unexpected bot death');};
  runInNewContext(fn,ctx);
  ctx.dmgE(terror,15,0,0,0);
  assert.equal(terror.hp,85);assert.equal(terror.bAction,null);
  ctx.bombAct(terror,.5,true);assert.equal(terror.bAction,null);
  ctx.tt+=ctx.BOMB_RULES.plantHitRecoverySeconds;
  ctx.bombAct(terror,.1,true);assert.equal(terror.bAction.t,.1);
});
test('real human damage handler cancels planting while preserving normal HP loss',()=>{
  const {ctx,cop,terror,pl}=makeState();ctx.bombMatch.state='idle';ctx.bombMatch.carrier=pl;
  pl.dead=false;pl.tm=1;pl.x=25;pl.z=5;cop.dead=true;
  ctx.bombAct(pl,2,true);assert.equal(pl.bAction.t,2);
  const fn=damage.split('\n').find(line=>line.startsWith('function hurt('));
  assert.ok(fn,'original player damage handler exists');
  ctx.pm={};ctx.cs={s:0,kv:0,yv:0,rv:0};ctx.document={getElementById(){return {style:{}};}};
  ctx.die=()=>{throw new Error('unexpected player death');};ctx.hdHit=()=>{};
  runInNewContext(fn,ctx);
  ctx.hurt(11);
  assert.equal(pl.hp,89);assert.equal(pl.bAction,null);
  ctx.bombAct(pl,.1,true);assert.equal(pl.bAction,null);
});
test('original Team Deathmatch movement, gun stats and controls remain untouched',()=>{
  const ai=read('src/game/90-bot-ai.js');
  assert.match(ai,/d>16\?1:d<7\?-\.6:0/);
  assert.match(read('src/game/45-combat.js'),/var WP|function boom/);
  assert.doesNotMatch(read('src/game/80-input.js'),/bombSoloPoliceThreat|bombPlantThreat/);
});
