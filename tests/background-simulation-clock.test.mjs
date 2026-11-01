import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulationClock } from '../src/background/simulation-clock.js';
import { createBackgroundTicker } from '../src/background/background-ticker.js';

test('Visible frames preserve the original 50ms max simulation step', () => {
  let now=0, enabled=true;
  const steps=[], reconciled=[];
  const clock=createSimulationClock({now:()=>now,isRunning:()=>enabled,
    step:dt=>steps.push(dt),fastForward:dt=>reconciled.push(dt)});
  now=16; clock.tickVisible();
  now=100; clock.tickVisible();
  assert.equal(steps.length,2);
  assert.ok(steps[0]>0.015 && steps[0]<0.017);
  assert.equal(steps[1],0.05);
  assert.deepEqual(reconciled,[]);
});

test('Hidden worker pulses simulate full elapsed second without one large physics delta', () => {
  let now=0;const steps=[],rest=[];
  const clock=createSimulationClock({now:()=>now,isRunning:()=>true,
    step:d=>steps.push(d),fastForward:d=>rest.push(d)});
  now=1000;clock.tickBackground();
  assert.equal(steps.length,20);
  assert.ok(steps.every(dt=>dt>0&&dt<=0.05));
  assert.equal(rest.length,0);
});

test('Long suspended tabs cap BOT CPU and reconcile the remaining wall-clock time', () => {
  let now=0;const steps=[],rest=[];
  const clock=createSimulationClock({now:()=>now,isRunning:()=>true,
    step:d=>steps.push(d),fastForward:d=>rest.push(d)});
  now=10000;clock.tickBackground();
  assert.equal(steps.length,30);
  assert.ok(Math.abs(steps.reduce((a,b)=>a+b,0)+rest[0]-10)<0.000001);
  now=10016;clock.tickVisible();
  assert.equal(steps.length,31);
});

test('Simulation never advances when match is not active and never duplicates time', () => {
  let now=0,enabled=false,delta=0;
  const clock=createSimulationClock({now:()=>now,isRunning:()=>enabled,
    step:d=>delta+=d,fastForward:d=>delta+=d});
  now=3000;clock.tickBackground();
  enabled=true;now=3050;clock.tickBackground();
  clock.tickVisible();
  assert.ok(Math.abs(delta-0.05)<0.000001);
});

test('Background ticker starts only when hidden, stops when visible, and never ticks after stop', () => {
  let callback=null;const sent=[],handlers={};let pulseCount=0;
  const mockWorker={postMessage:x=>sent.push(x),terminate(){},addEventListener(name,cb){handlers[name]=cb;}};
  const ticker=createBackgroundTicker({workerFactory:()=>mockWorker});
  ticker.onPulse(()=>pulseCount++);
  handlers.message({data:'tick'});
  assert.equal(pulseCount,0);
  ticker.setHidden(true);
  handlers.message({data:'tick'});
  assert.equal(pulseCount,1);
  ticker.setHidden(false);
  handlers.message({data:'tick'});
  assert.equal(pulseCount,1);
  assert.deepEqual(sent,['start','stop']);
  ticker.dispose();
});

test('Out-of-order foreground timestamps do not double-count time after a background pulse', () => {
  let now=0,seconds=0;
  const clock=createSimulationClock({now:()=>now,isRunning:()=>true,
    step:d=>seconds+=d,fastForward:d=>seconds+=d});
  now=1000;clock.tickBackground();
  clock.tickVisible(995); // rAF frame timestamp is older than visibility callback.
  assert.ok(Math.abs(seconds-1)<0.000001);
  now=1010;clock.tickVisible();
  assert.ok(Math.abs(seconds-1.01)<0.000001);
});
