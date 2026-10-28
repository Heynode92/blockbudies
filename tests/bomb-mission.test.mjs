import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolve} from 'node:path';
const root = resolve(import.meta.dirname, '..');
const mapSource=readFileSync(resolve(root,'src/game/11-bomb-map.js'),'utf8');
const missionSource=readFileSync(resolve(root,'src/game/86-bomb-mission.js'),'utf8');
const tacticsSource=readFileSync(resolve(root,'src/game/87-bomb-tactics.js'),'utf8');
const cameraSource=readFileSync(resolve(root,'src/game/88-spectator-camera.js'),'utf8');
function fakeThree(){
  class Position { constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;} set(x,y,z){this.x=x;this.y=y;this.z=z;return this;} copy(o){return this.set(o.x,o.y,o.z);} lerp(o,t){this.x+=(o.x-this.x)*t;this.y+=(o.y-this.y)*t;this.z+=(o.z-this.z)*t;return this;} }
  class Group{constructor(){this.children=[];this.position=new Position();this.scale=new Position();this.rotation={x:0,y:0,z:0};this.userData={};this.visible=true;}add(...items){this.children.push(...items);} }
  class Mesh extends Group{constructor(){super();this.isMesh=true;}}
  class Sprite extends Group{}
  class Material{constructor(props){Object.assign(this,props);}}
  class Geometry{constructor(){}}
  class Color{constructor(color){this.value=color;}}
  return {Group,Mesh,Sprite,Vector3:Position,Color,Fog:class{},MeshBasicMaterial:Material,MeshLambertMaterial:Material,SpriteMaterial:Material,BoxGeometry:Geometry,CylinderGeometry:Geometry,SphereGeometry:Geometry,CircleGeometry:Geometry,RingGeometry:Geometry,CanvasTexture:class{}};
}
function makeContext(){
  const T=fakeThree();
  const dom={};for(const id of ['bombInfo','bombStatus','bombActionLabel','bombActionBar','bombTouch','bombSpec','bombNext']){
    dom[id]={style:{},textContent:'',addEventListener(){},setPointerCapture(){},userData:{}};
  }
  const fakeCanvas={width:0,height:0,getContext(){return {fillRect(){},fillText(){},fillStyle:'',font:'',textAlign:''};}};
  const S=new T.Group();S.fog=null;S.background=null;
  const C={position:new T.Vector3(),lookAt(x,y,z){this.at={x,y,z};}};
  const ctx={
    Math,Object,Array,Uint8Array,Date,console,T,S,C,VS:new T.Group(),OB:[],BR:[],LT:[],GB:null,
    pl:{x:0,z:0,tm:1,dead:false,name:'You'},en:[],ts:[0,0],
    mt:{cd:0,t:120,over:false},tt:10,run:true,lob:false,touch:false,keys:{KeyE:true},
    SPH:[[],[]],A:60,
    document:{getElementById(id){return dom[id];},createElement(){return fakeCanvas;},body:{classList:{remove(){},add(){}}}},
    addEventListener(){},toast(){},mmss(t){return String(t);},
    visualDetails:[],
    mk(w,h,d,col,x,y,z){const m=new T.Mesh();m.position.set(x,y,z);m.userData.box={w,h,d,col};S.add(m);return m;},
    wl(x,z,w,d,h,col){ctx.OB.push({x,z,hw:w/2,hd:d/2,h,c:col});return ctx.mk(w,h,d,col,x,h/2,z);},
    dk(w,h,d,col,x,y,z){ctx.visualDetails.push({w,h,d,col,x,y,z});},
    flushDeco(){const m=new T.Mesh();m.userData.decorationBatch=true;S.add(m);},
    cBox(q){ctx.wl(q[0],q[1],q[2],q[3],2.4,0x687586);},
    cBar(q){ctx.wl(q[0],q[1],q[2],q[3],1.3,0xadb5bd);},
    inObs(x,z,m){return ctx.OB.some(o=>Math.abs(x-o.x)<o.hw+(m||0)&&Math.abs(z-o.z)<o.hd+(m||0));},
    reset(){},startMatch(){},endMatch(){ctx.mt.over=true;}
  };
  runInNewContext(mapSource+'\n'+missionSource+'\n'+tacticsSource+'\n'+cameraSource,ctx);
  ctx.selectedGameMode=1;
  return ctx;
}
function init(c){
  c.pl.dead=false;c.pl.tm=1;c.pl.x=-25;c.pl.z=-5;
  c.bombMatch={state:'idle',carrier:c.pl,dropped:null,device:{visible:false,position:{x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}},userData:{led:{visible:true}}},site:-1,done:false,round:1,fuseLeft:40};
  c.mt={cd:0,t:100,over:false};c.ts=[0,0];c.run=true;c.bombHold=false;
}
test('indoor map switches geometry and restores Team Deathmatch unchanged',()=>{
  const c=makeContext();const city=[...c.OB];
  c.selectGameMap(true);
  assert.ok(c.OB.length>100,'maze walls and crates created');
  assert.equal(c.BOMB_SITES.length,2);
  for(const q of c.BOMB_SITES)assert.equal(c.inObs(q.x,q.z,1),false,'bomb sites are accessible');
  assert.ok(c.bombSpawnPt(0)[1]>0);assert.ok(c.bombSpawnPt(1)[1]<0);
  c.selectGameMap(false);
  assert.deepEqual(c.OB,city);
});
test('plant requires full five seconds and bombs are dropped on carrier death',()=>{
  const c=makeContext();init(c);
  for(let i=0;i<4;i++)c.bombAct(c.pl,1,true);
  assert.equal(c.bombMatch.state,'idle');
  c.bombAct(c.pl,1,true);
  assert.equal(c.bombMatch.state,'planted');assert.equal(c.bombMatch.site,0);
  init(c);c.bombDrop(c.pl);
  assert.equal(c.bombMatch.carrier,null);assert.equal(c.bombMatch.dropped.x,-25);
});
test('plant progress cancels on key release, movement out of site, or death',()=>{
  const c=makeContext();init(c);
  c.bombAct(c.pl,2,true);assert.equal(c.pl.bAction.t,2);
  c.bombAct(c.pl,.1,false);assert.equal(c.pl.bAction,null);
  c.bombAct(c.pl,1,true);c.pl.x=10;c.bombAct(c.pl,1,true);assert.equal(c.pl.bAction,null);
  c.pl.x=-25;c.bombAct(c.pl,1,true);c.pl.dead=true;c.bombAct(c.pl,1,true);assert.equal(c.pl.bAction,null);
});
test('defuse takes seven seconds and awards one Police round point',()=>{
  const c=makeContext();init(c);c.pl.tm=0;c.bombMatch.state='planted';c.bombMatch.site=0;
  c.bombMatch.device.position.set(-25,0,-5);
  for(let i=0;i<6;i++)c.bombAct(c.pl,1,true);
  assert.equal(c.ts[0],0);assert.equal(c.bombMatch.done,false);
  c.bombAct(c.pl,1,true);
  assert.equal(c.bombMatch.done,true);assert.equal(c.ts[0],1);assert.equal(c.ts[1],0);
});
test('terrorist automatically recovers dropped bomb in pickup radius',()=>{
  const c=makeContext();init(c);c.bombDrop(c.pl);c.bombMatch.device.visible=true;
  c.pl.x=20;c.pl.z=20;
  const buddy={x:-25,z:-5,tm:1,dead:false,idx:1,name:'Razor',bAction:null};c.en=[buddy];
  c.bombUpdate(.1);
  assert.equal(c.bombMatch.carrier,buddy);assert.equal(c.bombMatch.dropped,null);assert.equal(c.bombMatch.device.visible,false);
});
test('bomb detonation and unplanted round timeout award correct rounds',()=>{
  const c=makeContext();init(c);
  c.bombMatch.state='planted';c.bombMatch.site=0;c.mt.t=0;
  c.bombUpdate(.1);assert.equal(c.bombMatch.done,true);assert.equal(c.ts[1],1);
  init(c);c.mt.t=0;c.bombUpdate(.1);assert.equal(c.bombMatch.done,true);assert.equal(c.ts[0],1);
});
test('generated 160x160 maze keeps all 256 rooms connected by real corridors',()=>{
  const c=makeContext();c.selectGameMap(true);
  const step=c.BOMB_RULES.cellSize,half=(c.BOMB_RULES.cells-1)/2,n=c.BOMB_RULES.cells;
  const seen=new Set(['0:0']),q=[[0,0]];
  while(q.length){const [x,z]=q.shift();for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const nx=x+dx,nz=z+dz,key=nx+':'+nz;
    if(nx<0||nz<0||nx>=n||nz>=n||seen.has(key))continue;
    const px=(x-half)*step,pz=(z-half)*step;
    if(c.inObs(px+dx*step/2,pz+dz*step/2,.2))continue;
    seen.add(key);q.push([nx,nz]);
  }}
  assert.equal(seen.size,n*n);
  assert.equal(c.A,80);
});
test('bot goal changes between bomb carrying, dropped device, and planted defuse',()=>{
  const c=makeContext();init(c);
  const bot={tm:1,idx:2,dead:false,x:0,z:-65,siteChoice:0};c.en=[bot];c.bombMatch.carrier=bot;
  assert.equal(c.bombBotGoal(bot)[0],-25);
  c.bombMatch.carrier=null;c.bombMatch.dropped={x:12,z:3};
  assert.equal(c.bombBotGoal(bot)[0],12);
  c.bombMatch.dropped=null;c.bombMatch.state='planted';c.bombMatch.device.position.set(21,0,7);
  const cop={tm:0,idx:0,x:0,z:65,dead:false};c.en.push(cop);
  assert.equal(c.bombBotGoal(cop)[0],21);
});
test('spectator only selects living teammates, never enemies',()=>{
  const c=makeContext();init(c);c.pl.dead=true;
  c.en=[{tm:0,name:'Police',dead:false},{tm:1,name:'Living',dead:false},{tm:1,name:'Dead',dead:true}];
  assert.equal(c.bombSpectatorTarget().name,'Living');
  c.en[1].dead=true;assert.equal(c.bombSpectatorTarget(),null);
});

// Additional tactical regression tests, independent of browser and rendering.
const navSource=readFileSync(resolve(root,'src/game/90-bot-ai.js'),'utf8').split('// botsUpd(dt):')[0];
test('Bomb Mode uses a 160x160 world and TDM restores its original boundary',()=>{
  const c=makeContext();assert.equal(c.A,60);c.selectGameMap(true);
  assert.equal(c.BOMB_RULES.cells*c.BOMB_RULES.cellSize,160);
  assert.equal(c.A,80);
  assert.ok(Math.hypot(c.BOMB_SITES[0].x-c.BOMB_SITES[1].x,c.BOMB_SITES[0].z-c.BOMB_SITES[1].z)>40);
  c.selectGameMap(false);assert.equal(c.A,60);
});
test('A* supplies connected routes from both spawns to both sites and between sites',()=>{
  const c=makeContext();c.selectGameMap(true);
  runInNewContext(navSource,c);
  const paths=[[[-15,65],c.BOMB_SITES[0]],[[15,-65],c.BOMB_SITES[1]],[[c.BOMB_SITES[0].x,c.BOMB_SITES[0].z],c.BOMB_SITES[1]]];
  for(const [start,goal] of paths){
    const path=c.gPath(start[0],start[1],goal.x,goal.z);
    assert.ok(path&&path.length>0,'navigable route exists');
    assert.ok(Math.hypot(path.at(-1)[0]-goal.x,path.at(-1)[1]-goal.z)<3,'route reaches target room');
    for(const [x,z] of path)assert.ok(!c.inObs(x,z,.25),'waypoint is not inside a wall');
  }
});
test('assigned police bot defuses when the human is passive; human can take over',()=>{
  const c=makeContext();init(c);c.pl.tm=0;c.pl.x=25;c.pl.z=5;
  c.bombMatch.state='planted';c.bombMatch.site=1;c.bombMatch.device.position.set(25,0,5);
  const guard={tm:0,idx:0,x:26,z:5,dead:false};c.en=[guard];
  assert.equal(c.bombPickDefuser(),guard);
  assert.equal(c.bombBotCanAct(guard),true);
  c.pl.bAction={type:'defuse',site:1,t:1};
  assert.equal(c.bombPickDefuser(),c.pl);
  assert.equal(c.bombBotCanAct(guard),false);
});
test('terrorist behavior changes from escort and plant to defense and pursuit',()=>{
  const c=makeContext();init(c);
  const carrier={tm:1,idx:1,x:0,z:-60,dead:false,siteChoice:1};
  const escort={tm:1,idx:2,x:-12,z:-52,dead:false};
  const hunter={tm:1,idx:3,x:12,z:-52,dead:false};
  c.en=[carrier,escort,hunter];c.bombMatch.carrier=carrier;
  assert.equal(c.bombTacticalStage(carrier),'plant');
  assert.equal(c.bombTacticalStage(escort),'escort');
  assert.equal(c.bombTacticalStage(hunter),'hunt');
  const escortGoal=c.bombTacticalGoal(escort),plantGoal=c.bombTacticalGoal(carrier);
  assert.ok(Math.hypot(escortGoal[0]-plantGoal[0],escortGoal[1]-plantGoal[1])>3);
  c.bombMatch.state='planted';c.bombMatch.site=1;c.bombMatch.device.position.set(25,0,5);
  assert.ok(['hold','hunt'].includes(c.bombTacticalStage(escort)));
  assert.equal(c.bombTacticalStage(carrier),'hunt');
});
test('third-person spectator shows a teammate from behind, never through the nearest wall',()=>{
  const c=makeContext();init(c);c.selectGameMap(true);
  c.pl.dead=true;
  const mate={tm:1,idx:0,name:'Viper',x:5,z:5,y:0,dead:false,g:{rotation:{y:0}}};
  c.en=[mate];c.bombResetSpectatorCamera();c.bombSpectatorCamera(1/60);
  assert.ok(c.C.position.z<mate.z,'camera behind a forward-facing teammate');
  assert.ok(c.C.position.y>=2,'camera elevated to frame body');
  assert.equal(c.C.at.x,mate.x);
  assert.ok(!c.inObs(c.C.position.x,c.C.position.z,.15,c.C.position.y),'camera is outside solid walls');
});
test('radar paints actual indoor walls and tracks spectated teammate',()=>{
  const radar=readFileSync(resolve(root,'src/game/96-hud-and-radar.js'),'utf8');
  assert.match(radar,/BOMB_NAV_WALLS\.forEach/);
  assert.match(radar,/pl\.dead\?bombSpectatorTarget\(\)/);
});

// Regression: all gameplay-scale props need an actual collision volume and a base
// touching the floor. Decorative trim is intentionally not a navigation obstacle.
test('grounded racks, lockers, generator, console and cover register physical collisions',()=>{
  const c=makeContext();c.selectGameMap(true);
  const n=c.BOMB_RULES.cells,step=c.BOMB_RULES.cellSize,half=(n-1)/2,inset=c.BOMB_PROPS.inset;
  let checked=0;const patterns=new Set();
  for(let j=1;j<n-1;j++)for(let i=1;i<n-1;i++){
    const x=(i-half)*step,z=(j-half)*step;
    if(c.BOMB_SITES.some(q=>Math.hypot(q.x-x,q.z-z)<step*1.3))continue;
    const pattern=(i*7+j*11)%9,sgn=(i+j)%2?1:-1;
    const px=x+sgn*inset,pz=z+(i%2?-1:1)*inset;
    assert.ok(c.OB.some(o=>Math.abs(o.x-px)<.01&&Math.abs(o.z-pz)<.01&&o.h>=1.1),
      `missing collidable furniture at cell ${i},${j}`);
    patterns.add(pattern);checked++;
  }
  assert.ok(checked>120);assert.equal(patterns.size,9);
  assert.ok(c.visualDetails.length>100,'batched visual detailing is present');
  for(const o of c.OB)assert.ok(o.h>0,'no hovering or inverted collision geometry');
});
test('ceiling closes wall gap and blocks shots without blocking floor navigation',()=>{
  const c=makeContext();c.selectGameMap(true);const r=c.BOMB_RULES;
  assert.ok(r.wallHeight>=r.ceilingHeight-r.ceilingThickness/2);
  assert.ok(c.LT.some(o=>o.hw>=80&&o.hd>=80&&o.y0>5),
    'indoor roof has a proper overhead projectile collider');
  for(const q of c.BOMB_SITES)assert.equal(c.inObs(q.x,q.z,.65),false);
});
test('every collision body stays under a matching visible floor-to-height mesh',()=>{
  const c=makeContext();c.selectGameMap(true);
  // The lower wl geometry uses y=h/2 with height=h; upper monitor intentionally uses y0.
  for(const o of c.OB.filter(o=>!o.y0)){
    const hasMesh=c.S.children.some(m=>m.isMesh&&m.userData.box&&
      Math.abs(m.position.x-o.x)<.001&&Math.abs(m.position.z-o.z)<.001&&
      Math.abs(m.position.y-o.h/2)<.001&&Math.abs(m.userData.box.h-o.h)<.001);
    assert.ok(hasMesh,`invisible colliding geometry at ${o.x},${o.z}`);
  }
});

// These checks execute the ORIGINAL production projectile/character collision
// functions against the newly registered map obstacles (not a mock hit test).
function productionFunction(file,name){
  const source=readFileSync(resolve(root,file),'utf8');
  const start=source.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing production '+name);
  const open=source.indexOf('{',start);
  let depth=0;
  for(let i=open;i<source.length;i++){
    if(source[i]==='{')depth++;
    if(source[i]==='}'&&!--depth)return source.slice(start,i+1);
  }
  throw new Error('unterminated production function: '+name);
}
test('production bullet sweep and movement collision stop at bomb furniture',()=>{
  const c=makeContext();c.selectGameMap(true);
  runInNewContext([
    productionFunction('src/game/60-impact-effects.js','segBox'),
    productionFunction('src/game/60-impact-effects.js','sweepObs'),
    productionFunction('src/game/20-sky-and-physics.js','resolve')
  ].join('\n'),c);
  const cellX=-65,cellZ=-65,px=cellX-c.BOMB_PROPS.inset,pz=cellZ-c.BOMB_PROPS.inset;
  const furniture=c.OB.find(o=>Math.abs(o.x-px)<.001&&Math.abs(o.z-pz)<.001);
  assert.ok(furniture,'representative server rack exists');
  const hit=c.sweepObs(px-furniture.hw-1,1.4,pz,px+furniture.hw+1,1.4,pz);
  assert.equal(hit,furniture,'projectile hits the actual rack collision');
  const actor={x:px-furniture.hw-.18,y:0,z:pz};
  actor.x+=.35; // Walk into the rack from an unblocked adjacent point.
  c.resolve(actor,.55);
  assert.ok(actor.x<=px-furniture.hw-.50,'player radius cannot enter the rack');
});
test('production ceiling sweep stops projectiles passing through indoor roof',()=>{
  const c=makeContext();c.selectGameMap(true);
  runInNewContext([
    productionFunction('src/game/60-impact-effects.js','segBox'),
    productionFunction('src/game/60-impact-effects.js','sweepLT')
  ].join('\n'),c);
  assert.ok(c.sweepLT(0,5,0,0,6.5,0),'roof collision blocks vertical shots');
});
