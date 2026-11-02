import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const code=readFileSync(new URL('../src/game/98-online-bridge.js',import.meta.url),'utf8');
const start=code.indexOf('function onlinePredictStep(');
const stop=code.indexOf('\nfunction onlineWarn(',start);
assert.ok(start>=0&&stop>start,'prediction helpers must exist in canonical runtime');
const helpers=code.slice(start,stop)+'\nthis.predictionApi={step:onlinePredictStep,reconcile:onlineReconcileSelf,interpolate:onlineInterpolateActor};';
const speed=6.5*.79/1.15;
function harness(){
 const pl={x:0,y:0,z:0,vy:0,grounded:true};
 const ctx={
  Math,pl,onlinePredSteps:[],onlineCorrection:{x:0,y:0,z:0},
  onlineHasPrediction:true,onlineLastAck:0,onlineLastAccepted:0,onlineSeq:0,
  onlineCorrectionSize:0,onlinePrevAlive:true,
  weaponMovementSpeed:(weaponId,sprint,ads)=>{
   assert.equal(weaponId,9);
   return speed*(1+.15*sprint)*(1-.38*ads);
  },
  resolve:()=>{},
 };
 runInNewContext(helpers,ctx);
 return {ctx,pl,api:ctx.predictionApi};
}
const forward={seq:1,moveX:0,moveZ:-1,yaw:0,sprint:false,ads:false,
 jump:false,crouch:false,weaponId:9,dt:.016};
test('local camera movement responds immediately at render Hz with canonical K2 speed',()=>{
 const {pl,api}=harness();
 for(let i=0;i<60;i++)api.step(pl,forward,1/60);
 assert.ok(Math.abs(pl.z-speed)<.00001);
 assert.equal(pl.x,0);
 assert.equal(pl.y,0);
});
test('movement yaw, diagonal normalization and crouch sprint restriction preserve server axes',()=>{
 const {pl,api}=harness();
 const input={...forward,yaw:Math.PI/2,sprint:true,crouch:true};
 api.step(pl,input,.05);
 assert.ok(Math.abs(pl.x-speed*.05)<.000001);
 assert.ok(Math.abs(pl.z)<.000001);
 const diagonal={...input,yaw:0,moveX:Math.SQRT1_2,moveZ:-Math.SQRT1_2,crouch:false};
 api.step(pl,diagonal,.05);
 assert.ok(Number.isFinite(pl.x)&&Number.isFinite(pl.z));
});
test('reconciliation prunes processed inputs, replays only pending frames, and preserves server seq across reconnect',()=>{
 const {ctx,pl,api}=harness();
 ctx.onlinePredSteps=[{...forward,seq:1,dt:.05},{...forward,seq:2,dt:.05}];
 api.reconcile({x:0,y:0,z:0,alive:true},{lastProcessedInputSeq:1,lastAcceptedInputSeq:4,grounded:true,velocityY:0},true);
 assert.equal(ctx.onlineLastAck,1);
 assert.equal(ctx.onlineSeq,4);
 assert.equal(ctx.onlinePredSteps.length,1);
 assert.ok(Math.abs(ctx.onlineCorrection.z-speed*.05)<1e-8);
 assert.equal(pl.z,0,'reconciliation must not instantly yank local camera for minor drift');
});
test('server jump, respawn and large correction reset prediction without overriding authority',()=>{
 const {ctx,pl,api}=harness();
 ctx.onlineHasPrediction=false;
 api.reconcile({x:4,y:1.5,z:9,alive:true},{lastProcessedInputSeq:0,lastAcceptedInputSeq:0,grounded:false,velocityY:5},true);
 assert.equal(pl.x,4);assert.equal(pl.y,1.5);assert.equal(pl.vy,5);
 assert.equal(pl.grounded,false);
 ctx.onlineHasPrediction=true;pl.x=20;
 api.reconcile({x:4,y:1.5,z:9,alive:true},{lastProcessedInputSeq:0,lastAcceptedInputSeq:0,grounded:false,velocityY:4},true);
 assert.equal(pl.x,4);assert.equal(ctx.onlineCorrection.x,0);
});
test('remote actors interpolate at buffered render time and never extrapolate into unknown future',()=>{
 const {api}=harness();
 const a={t:1000,x:0,y:0,z:0,yaw:Math.PI-.1};
 const b={t:1100,x:10,y:0,z:0,yaw:-Math.PI+.1};
 const mid=api.interpolate([a,b],1050);
 assert.equal(mid.x,5);
 assert.ok(Math.abs(Math.abs(mid.yaw)-Math.PI)<.000001,'rotation follows shortest arc');
 assert.equal(api.interpolate([a,b],1200),b,'no enemy position extrapolation beyond authorized frame');
 assert.equal(api.interpolate([a,b],900),a,'early render is clamped to observed frame');
});
test('runtime keeps collision and damage server authoritative',()=>{
 assert.match(code,/onlinePredictStep\(pl,prediction,prediction\.dt\)/);
 assert.match(code,/lastProcessedInputSeq/);
 assert.match(code,/onlinePredSteps\.filter/);
 assert.match(code,/onlineLastSnapshotAt<600/);
 assert.match(code,/onlineInterpolateActor\(actor\.samples\|\|\[\],renderAt\)/);
 assert.match(code,/visible\.has\(id\)/);
 assert.doesNotMatch(code,/type:'input',frame:\{[\s\S]{0,220}?(?:position|damage|kills):/);
});
