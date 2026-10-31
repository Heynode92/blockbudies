import test from 'node:test';
import assert from 'node:assert/strict';
import {runBotM0Baseline} from '../tools/bot-ai-m0-baseline.mjs';

test('M0: live production BOT update yields repeatable 5v5 synthetic traces for a fixed seed',()=>{
  const options={seed:42,mode:'tdm'};
  const a=runBotM0Baseline(options),b=runBotM0Baseline(options);
  assert.deepEqual(a,b,'same seed and fixture must produce identical BOT actions/positions');
  assert.equal(a.fixture,'synthetic-10-bot-no-human');
  assert.equal(a.frames,60);
  assert.equal(a.footstepCalls,600,'each live BOT must advance footsteps once per frame');
  assert.ok(a.shotsByTeam.every(n=>n>0),'both teams should dispatch real fire calls in open LOS');
  assert.ok(a.distanceByTeam.every(n=>n>0),'both teams should move during the scenario');
});

test('M0: no line of sight means no fire dispatch for either faction',()=>{
  const trace=runBotM0Baseline({seed:42,mode:'tdm',visibility:'blocked'});
  assert.equal(trace.shotsDispatched,0);
  assert.deepEqual(trace.shotsByTeam,[0,0]);
  assert.ok(trace.losChecks>0,'real target acquisition must query visibility');
  assert.equal(trace.footstepCalls,600);
});

test('M0: critical-HP retreat behavior executes without missing dependencies',()=>{
  const baseline=runBotM0Baseline({seed:42,mode:'tdm'});
  const critical=runBotM0Baseline({seed:42,mode:'tdm',critical:true});
  assert.ok(critical.retreatBots>=9,
    'at least nine critical-HP BOTs retreat under seeded M2 reaction-limited encounters');
  assert.ok(critical.shotsDispatched<baseline.shotsDispatched,
    'critical HP should change combat behavior in this controlled fixture');
  assert.ok(critical.finalPositions.every(([x,z])=>Number.isFinite(x)&&Number.isFinite(z)));
});

test('M0: Bomb mode exercises both factions without invoking actual bomb round authority',()=>{
  const trace=runBotM0Baseline({seed:42,mode:'bomb'});
  assert.ok(trace.shotsByTeam.every(n=>n>0));
  assert.ok(trace.distanceByTeam.every(n=>n>0));
  assert.equal(trace.footstepCalls,600);
  assert.equal(trace.unavailableMetrics.includes('bombRoundWinRate'),true,
    'synthetic fixture must never claim Bomb Mission objective success');
});

test('M0: seed changes trace, while unsupported scenario arguments fail closed',()=>{
  const a=runBotM0Baseline({seed:42});
  const b=runBotM0Baseline({seed:43});
  assert.notDeepEqual(a.finalPositions,b.finalPositions);
  assert.throws(()=>runBotM0Baseline({frames:100000}),RangeError);
  assert.throws(()=>runBotM0Baseline({mode:'unknown'}),RangeError);
});

test('M0: record fire dispatch rather than inventing real hit rate or reaction latency',()=>{
  const baseline=runBotM0Baseline();
  assert.ok(baseline.shotsDispatched>0);
  for(const metric of ['realHitRate','realReactionLatency','bombRoundWinRate','browserFps']){
    assert.ok(baseline.unavailableMetrics.includes(metric));
  }
  assert.ok(baseline.nonzeroPitchShots>=0);
});

test('M0: optional measured BOT tick callback is bounded and does not change game trace',()=>{
  const calls=[];
  const observed=runBotM0Baseline({mode:'bomb',seed:42,onTick:ms=>calls.push(ms)});
  const unchanged=runBotM0Baseline({mode:'bomb',seed:42});
  assert.deepEqual(observed,unchanged,'timing observation must not modify bot state');
  assert.equal(calls.length,60);
  assert.ok(calls.every(ms=>Number.isFinite(ms)&&ms>=0));
  assert.throws(()=>runBotM0Baseline({onTick:123}),RangeError);
});
