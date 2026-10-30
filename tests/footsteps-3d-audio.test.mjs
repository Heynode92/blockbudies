import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8').replace(/\r\n/g,'\n');
const moduleSource=read('src/game/66-footsteps.js');

function audioHarness(){
 const events={},nodes={buffers:[],sources:[],filters:[],gains:[],panners:[],listener:{},resumes:0};
 const audio={
  state:'running',sampleRate:8000,currentTime:2,destination:{},
  listener:{
   positionX:{value:0},positionY:{value:0},positionZ:{value:0},
   forwardX:{value:0},forwardY:{value:0},forwardZ:{value:0},
   upX:{value:0},upY:{value:1},upZ:{value:0}
  },
  resume(){nodes.resumes++;return Promise.resolve();},
  createBuffer(ch,len,sr){
   const buffer={ch,len,sr,data:new Float32Array(len),getChannelData(){return this.data;}};
   nodes.buffers.push(buffer);return buffer;
  },
  createBufferSource(){
   const src={playbackRate:{value:1},connected:[],connect(n){this.connected.push(n);},
    disconnect(){this.disconnected=true;},start(){this.started=true;},stop(t){this.stopped=t;}};
   nodes.sources.push(src);return src;
  },
  createBiquadFilter(){
   const f={frequency:{value:0},connect(n){this.target=n;},disconnect(){},type:''};
   nodes.filters.push(f);return f;
  },
  createGain(){
   const g={gain:{setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},
    exponentialRampToValueAtTime(v){this.final=v;}},connect(n){this.target=n;},disconnect(){}};
   nodes.gains.push(g);return g;
  },
  createPanner(){
   const p={positionX:{value:0},positionY:{value:0},positionZ:{value:0},
    connect(n){this.target=n;},disconnect(){}};
   nodes.panners.push(p);return p;
  }
 };
 class Vector3{constructor(){this.x=0;this.y=0;this.z=1;}}
 const state={
  Math,Number,Object,AC:audio,SND:true,run:true,lob:false,mt:{cd:0,over:false},
  isBombMode:()=>false,inB:()=>false,los:()=>true,
  BOMB_RULES:{cells:8,cellSize:8},
  document:{addEventListener(event,handler){events[event]=handler;}},
  window:{AudioContext:function(){return audio;}},
  T:{Vector3},
  C:{
   position:{x:0,y:1.6,z:0},
   updateMatrixWorld(){},
   getWorldDirection(v){v.x=0;v.y=0;v.z=1;return v;}
  }
 };
 vm.createContext(state);vm.runInContext(moduleSource,state);
 return{state,nodes,events,audio};
}

test('surface detection follows playable outdoor, indoor, road and bomb-map sectors',()=>{
 const {state}=audioHarness();
 const surface=(x,y,z)=>vm.runInContext('footstepSurface('+x+','+y+','+z+')',state);
 assert.equal(surface(0,0,15),'asphalt');
 assert.equal(surface(20,0,20),'concrete');
 state.inB=(x,z)=>x>15;
 assert.equal(surface(20,0,20),'indoor');
 assert.equal(surface(20,3,20),'metal','elevated platforms use metal');
 state.isBombMode=()=>true;
 // Sector arrangement is identical to 11-bomb-map: SECURITY, WAREHOUSE, REACTOR, LAB.
 assert.equal(surface(-20,0,-20),'tile');
 assert.equal(surface(20,0,-20),'metal');
 assert.equal(surface(-20,0,20),'concrete');
 assert.equal(surface(20,0,20),'indoor');
});

test('actual traveled distance triggers steps; idle, freeze, airborne and teleport are silent',()=>{
 const {state,nodes}=audioHarness(),actor={x:1,y:0,z:1,dead:false};
 state.actor=actor;
 vm.runInContext('footstepAdvance(actor,1,true,false,true)',state);
 assert.equal(nodes.sources.length,0);
 vm.runInContext('footstepAdvance(actor,1.1,true,false,true)',state);
 assert.equal(nodes.sources.length,1);
 assert.equal(actor.stepIndex,1);
 vm.runInContext('footstepAdvance(actor,0,true,false,true)',state);
 assert.equal(nodes.sources.length,1);
 vm.runInContext('footstepAdvance(actor,2,false,false,true)',state);
 assert.equal(actor.stepTrail,0);
 state.mt.cd=3;
 vm.runInContext('footstepAdvance(actor,2.1,true,false,true)',state);
 assert.equal(nodes.sources.length,1);
 state.mt.cd=0;actor.dead=true;
 vm.runInContext('footstepAdvance(actor,2.1,true,false,true)',state);
 assert.equal(nodes.sources.length,1);
 actor.dead=false;
 vm.runInContext('footstepAdvance(actor,9,true,false,true)',state);
 assert.equal(nodes.sources.length,1);
});

test('procedural footstep audio has five material banks, three variants and finite samples',()=>{
 const {state,nodes}=audioHarness();
 vm.runInContext('footstepGenerateBuffers()',state);
 assert.equal(nodes.buffers.length,15);
 assert.equal(state.footstepBuffers.concrete.length,3);
 assert.equal(state.footstepBuffers.metal.length,3);
 for(const buffer of nodes.buffers){
  assert.ok(buffer.data.every(Number.isFinite));
  assert.ok(buffer.data.some(v=>Math.abs(v)>.01));
  assert.ok(Math.max(...buffer.data)<1);
 }
 const concrete=nodes.buffers[0].data,metal=nodes.buffers[9].data;
 assert.notDeepEqual(Array.from(concrete.slice(0,100)),Array.from(metal.slice(0,100)),
  'metal and concrete must sound different');
 vm.runInContext('footstepGenerateBuffers()',state);
 assert.equal(nodes.buffers.length,15,'buffers reused rather than generated every step');
});

test('enemy and teammate steps both use HRTF stereo placement with falloff and hard cutoff',()=>{
 const {state,nodes}=audioHarness();
 state.nearActor={x:8,y:0,z:-5,stepIndex:1,tm:1,dead:false};
 vm.runInContext('footstepPlay(nearActor,false,false)',state);
 assert.equal(nodes.panners.length,1);
 const p=nodes.panners[0];
 assert.equal(p.panningModel,'HRTF');
 assert.equal(p.refDistance,2.2);
 assert.equal(p.maxDistance,24);
 assert.equal(p.positionX.value,8);
 assert.equal(p.positionZ.value,-5);
 assert.equal(p.distanceModel,'inverse');
 assert.equal(nodes.sources.length,1);
 state.nearActor.tm=0;
 vm.runInContext('footstepPlay(nearActor,false,false)',state);
 assert.equal(nodes.panners.length,2,'teammates also have spatial footsteps');
 state.nearActor.x=25;
 vm.runInContext('footstepPlay(nearActor,false,false)',state);
 assert.equal(nodes.panners.length,2,'outside hearing radius must be silent');
 state.SND=false;
 vm.runInContext('footstepPlay(nearActor,true,false)',state);
 assert.equal(nodes.sources.length,2,'audio switch disables new voices');
});

test('wall occlusion filters and muffles sound rather than revealing exact location',()=>{
 const {state,nodes}=audioHarness();
 state.walker={x:5,y:0,z:4,stepIndex:0};
 state.los=()=>false;
 vm.runInContext('footstepPlay(walker,false,true)',state);
 assert.equal(nodes.filters.length,1);
 assert.equal(nodes.filters[0].frequency.value,920);
 assert.equal(nodes.panners.length,1);
 const blockedVolume=nodes.gains[0].gain.value;
 state.los=()=>true;
 vm.runInContext('footstepPlay(walker,false,true)',state);
 assert.ok(nodes.gains[1].gain.value>blockedVolume);
 assert.equal(nodes.sources.length,2);
});

test('listener tracks camera facing and position; old Safari listener fallback supported',()=>{
 const {state,audio}=audioHarness();
 state.C.position={x:3,y:2,z:-6};
 state.C.getWorldDirection=v=>{v.x=-1;v.y=0;v.z=0;return v;};
 vm.runInContext('footstepUpdateListener()',state);
 assert.equal(audio.listener.positionX.value,3);
 assert.equal(audio.listener.positionZ.value,-6);
 assert.equal(audio.listener.forwardX.value,-1);
 assert.equal(audio.listener.upY.value,1);
});

test('footsteps integrate with active BOT/player movement and direct-open browser bundle',()=>{
 const sim=read('src/game/95-simulation.js');
 const ai=read('src/game/90-bot-ai.js');
 const loop=read('src/game/99-render-loop.js');
 const match=read('src/game/85-lobby-and-match.js');
 assert.match(sim,/footstepAdvance\(pl,Math\.hypot\(pl\.x-oldStepX,pl\.z-oldStepZ\)/);
 assert.match(ai,/footstepAdvance\(e,dm,!cdn&&dm>\.002,sp>4\.4,false\)/);
 assert.match(loop,/footstepUpdateListener\(\)/);
 assert.match(match,/function respawnPl\(\)\{[^}]*pl\.stepTrail=0/);
 assert.match(match,/function placeBot\(b\)\{[^}]*b\.stepTrail=0/);
 const parts=JSON.parse(read('tools/source-manifest.json')).parts;
 assert.equal(parts[parts.indexOf('src/game/65-audio.js')+1],'src/game/66-footsteps.js');
 assert.ok(parts.indexOf('src/game/66-footsteps.js')<parts.indexOf('src/game/90-bot-ai.js'));
 assert.ok(read('assets/game.js').includes(moduleSource));
 assert.doesNotMatch(moduleSource,/fetch\(|new Audio\(|https?:\/\//);
});
