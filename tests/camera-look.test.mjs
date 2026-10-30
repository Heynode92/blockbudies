import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(resolve(root,'src/game/79-camera-look.js'),'utf8');
function setup(){
  const canvas={},document={pointerLockElement:canvas};
  const ctx={console,Math,Number,document,R:{domElement:canvas},
    WP:Array.from({length:19},(_,i)=>({snp:i===8})),
    pl:{face:1,pitch:0,w:1,dead:false},adsT:0,run:true,lob:false,mt:{over:false}};
  runInNewContext(source,ctx);
  return {ctx,document,canvas};
}
function mouse(x,y,buttons=0,clientX=0,clientY=0){
  return {pointerType:'mouse',buttons,movementX:x,movementY:y,clientX,clientY};
}

test('normal locked mouse movement retains original sensitivity and pitch clamp',()=>{
  const {ctx}=setup();
  ctx.lookMove(mouse(20,-10));
  assert.ok(Math.abs(ctx.pl.face-(1-20*.003))<1e-12);
  assert.ok(Math.abs(ctx.pl.pitch-10*.003)<1e-12);
  ctx.lookMove(mouse(0,-200));ctx.lookMove(mouse(0,-200));
  assert.equal(ctx.pl.pitch,1.2);
});
test('anomalous pointer-lock deltas cannot reverse camera direction',()=>{
  const {ctx}=setup();
  ctx.lookMove(mouse(20,0));const before=ctx.pl.face;
  ctx.lookMove(mouse(1080,-999));assert.equal(ctx.pl.face,before);
  assert.ok(Math.abs(ctx.pl.face-1)<.1);
});
test('first mouse event after pointer-lock activation is ignored',()=>{
  const {ctx,document,canvas}=setup();
  document.pointerLockElement=null;ctx.lookLockChanged();
  document.pointerLockElement=canvas;ctx.lookLockChanged();
  ctx.lookMove(mouse(800,0));assert.equal(ctx.pl.face,1);
  ctx.lookMove(mouse(12,0));assert.ok(Math.abs(ctx.pl.face-(1-12*.003))<1e-12);
});
test('drag-aim ignores browser relative warp delta and uses screen coordinates',()=>{
  const {ctx,document}=setup();document.pointerLockElement=null;
  ctx.lookStartDrag(mouse(0,0,1,50,70));
  ctx.lookMove(mouse(10000,10000,1,60,80));
  assert.ok(Math.abs(ctx.pl.face-(1-10*.003))<1e-12);
  assert.ok(Math.abs(ctx.pl.pitch-(-10*.003))<1e-12);
  ctx.lookMove(mouse(10000,10000,0,62,80));
  ctx.lookStartDrag(mouse(0,0,1,75,80));
  ctx.lookMove(mouse(0,0,1,76,80));
  assert.ok(Math.abs(ctx.pl.face-(1-11*.003))<1e-12);
});
test('malformed and non-mouse events do not affect yaw',()=>{
  const {ctx}=setup();ctx.lookMove(mouse(NaN,1));ctx.lookMove(mouse(Infinity,0));
  ctx.lookMove({pointerType:'touch',movementX:75,movementY:10});
  assert.equal(ctx.pl.face,1);
});
test('mouse look stays off in lobby, after game over, and while dead',()=>{
  const {ctx}=setup();
  ctx.lob=true;ctx.lookMove(mouse(50,0));ctx.lob=false;
  ctx.mt.over=true;ctx.lookMove(mouse(50,0));ctx.mt.over=false;
  ctx.pl.dead=true;ctx.lookMove(mouse(50,0));
  assert.equal(ctx.pl.face,1);
});
test('AWP ADS and other ADS sensitivities retain original values',()=>{
  const {ctx}=setup();ctx.adsT=1;
  ctx.lookMove(mouse(20,0));
  assert.ok(Math.abs(ctx.pl.face-(1-20*.003*.5))<1e-12);
  ctx.pl.w=8;ctx.pl.face=1;
  ctx.lookMove(mouse(20,0));
  assert.ok(Math.abs(ctx.pl.face-(1-20*.003*.18))<1e-12);
});

function inputWiringHarness(){
  function target(){return {handlers:{},addEventListener(name,fn){(this.handlers[name]??=[]).push(fn);},emit(name,e){for(const fn of this.handlers[name]??[])fn(e);},setPointerCapture(){},firstChild:{style:{}}};}
  class FakeVec{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}}
  class FakePlane{constructor(){}}
  const window=target(),document=target(),canvas=target(),elements=new Map();
  document.getElementById=id=>{if(!elements.has(id))elements.set(id,target());return elements.get(id);};
  document.pointerLockElement=canvas;
  const ctx={console,Math,Number,document,R:{domElement:canvas},
    pl:{face:1,pitch:0,w:1,dead:false},adsT:0,run:true,lob:false,mt:{over:false},
    addEventListener:window.addEventListener.bind(window),innerWidth:1280,
    T:{Raycaster:class{},Plane:FakePlane,Vector3:FakeVec,Vector2:FakeVec},
    reload(){},toggleDual(){}};
  const input=readFileSync(resolve(root,'src/game/80-input.js'),'utf8');
  runInNewContext(source+'\n'+input,ctx);
  return {ctx,window,document,canvas};
}

test('actual canvas pointermove event routes through global look guard',()=>{
  const {ctx,canvas}=inputWiringHarness();
  canvas.emit('pointermove',mouse(1200,0));assert.equal(ctx.pl.face,1);
  canvas.emit('pointermove',mouse(25,0));assert.ok(Math.abs(ctx.pl.face-(1-25*.003))<1e-12);
});
test('pointerlockchange and blur reset stale pointer state',()=>{
  const {ctx,document,window,canvas}=inputWiringHarness();
  document.pointerLockElement=null;document.emit('pointerlockchange');
  canvas.emit('pointerdown',{...mouse(0,0,1,500,500),button:0});
  canvas.emit('pointermove',mouse(999,999,1,510,500));
  assert.ok(Math.abs(ctx.pl.face-(1-10*.003))<1e-12);
  window.emit('blur');
  document.pointerLockElement=canvas;document.emit('pointerlockchange');
  canvas.emit('pointermove',mouse(1500,0));
  assert.ok(Math.abs(ctx.pl.face-(1-10*.003))<1e-12);
});

test('auto-deploy enables unlocked mouse look immediately, with no click',()=>{
 const {ctx,document}=setup();
 document.pointerLockElement=null;ctx.lookLockChanged();
 ctx.wsConfirmed=true;ctx.wsOn=false;ctx.touch=false;ctx.mt.cd=0;
 ctx.lookMove(mouse(0,0,0,500,300));
 ctx.lookMove(mouse(9000,9000,0,520,290));
 assert.ok(Math.abs(ctx.pl.face-(1-20*.003))<1e-12);
 assert.ok(Math.abs(ctx.pl.pitch-10*.003)<1e-12);
});
test('unlocked hover aim never activates during loadout, freeze, or death',()=>{
 const {ctx,document}=setup();document.pointerLockElement=null;ctx.lookLockChanged();
 ctx.wsConfirmed=false;ctx.wsOn=true;ctx.touch=false;ctx.mt.cd=3;
 ctx.lookMove(mouse(0,0,0,500,300));ctx.lookMove(mouse(0,0,0,520,300));assert.equal(ctx.pl.face,1);
 ctx.wsOn=false;ctx.wsConfirmed=true;
 ctx.lookMove(mouse(0,0,0,520,300));ctx.lookMove(mouse(0,0,0,540,300));assert.equal(ctx.pl.face,1);
 ctx.mt.cd=0;ctx.pl.dead=true;
 ctx.lookMove(mouse(0,0,0,540,300));ctx.lookMove(mouse(0,0,0,560,300));assert.equal(ctx.pl.face,1);
 ctx.pl.dead=false;ctx.lookMove(mouse(0,0,0,560,300));ctx.lookMove(mouse(0,0,0,580,300));
 assert.ok(Math.abs(ctx.pl.face-(1-20*.003))<1e-12);
});
test('free aim discards jumps and transitions cleanly into locked FPS look',()=>{
 const {ctx,document,canvas}=setup();document.pointerLockElement=null;ctx.lookLockChanged();
 ctx.wsConfirmed=true;ctx.wsOn=false;ctx.touch=false;ctx.mt.cd=0;
 ctx.lookMove(mouse(0,0,0,100,100));ctx.lookMove(mouse(0,0,0,500,100));assert.equal(ctx.pl.face,1);
 ctx.lookMove(mouse(0,0,0,510,100));assert.ok(Math.abs(ctx.pl.face-(1-10*.003))<1e-12);
 document.pointerLockElement=canvas;ctx.lookLockChanged();
 ctx.lookMove(mouse(800,0));assert.ok(Math.abs(ctx.pl.face-(1-10*.003))<1e-12);
 ctx.lookMove(mouse(10,0));assert.ok(Math.abs(ctx.pl.face-(1-20*.003))<1e-12);
});
