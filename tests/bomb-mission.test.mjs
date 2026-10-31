import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolve} from 'node:path';
const root = resolve(import.meta.dirname, '..');
const mapSource=readFileSync(resolve(root,'src/game/11-bomb-map.js'),'utf8');
const townSource=readFileSync(resolve(root,'src/game/12-block-town.js'),'utf8');
const labsSource=readFileSync(resolve(root,'src/game/13-block-labs.js'),'utf8');
const hospitalSource=readFileSync(resolve(root,'src/game/14-hospital.js'),'utf8');
const missionSource=readFileSync(resolve(root,'src/game/86-bomb-mission.js'),'utf8');
const tacticsSource=readFileSync(resolve(root,'src/game/87-bomb-tactics.js'),'utf8');
const perceptionSource=readFileSync(resolve(root,'src/game/88-bot-perception.js'),'utf8');
const intelligenceSource=readFileSync(resolve(root,'src/game/86-bomb-intelligence.js'),'utf8');
const cameraSource=readFileSync(resolve(root,'src/game/88-spectator-camera.js'),'utf8');
function fakeThree(){
  class Position { constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;} set(x,y,z){this.x=x;this.y=y;this.z=z;return this;} copy(o){return this.set(o.x,o.y,o.z);} lerp(o,t){this.x+=(o.x-this.x)*t;this.y+=(o.y-this.y)*t;this.z+=(o.z-this.z)*t;return this;} }
  class Group{constructor(){this.children=[];this.position=new Position();this.scale=new Position();this.rotation={x:0,y:0,z:0};this.userData={};this.visible=true;}add(...items){this.children.push(...items);} }
  class Mesh extends Group{constructor(){super();this.isMesh=true;}}
  class Sprite extends Group{}
  class Material{constructor(props){Object.assign(this,props);}}
  class Geometry{constructor(){}}
  class Color{constructor(color){this.value=color;}}
  return {Group,Mesh,Sprite,Vector3:Position,Color,Fog:class{constructor(color,near,far){this.color=color;this.near=near;this.far=far;}},MeshBasicMaterial:Material,MeshLambertMaterial:Material,SpriteMaterial:Material,BoxGeometry:Geometry,CylinderGeometry:Geometry,SphereGeometry:Geometry,IcosahedronGeometry:Geometry,CircleGeometry:Geometry,RingGeometry:Geometry,CanvasTexture:class{}};
}
function makeContext(){
  const T=fakeThree();
  const dom={};for(const id of ['bombInfo','bombDropMarker','bombStatus','bombActionLabel','bombActionBar','bombTouch','bombSpec','bombNext']){
    dom[id]={style:{},textContent:'',addEventListener(){},setPointerCapture(){},userData:{}};
  }
  const fakeCanvas={width:0,height:0,getContext(){return {fillRect(){},fillText(){},fillStyle:'',font:'',textAlign:''};}};
  const S=new T.Group();S.fog=null;S.background=null;
  S.add({type:"GridHelper",visible:true}); // TDM GridHelper is LineSegments, not Mesh.
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
    shade(c,f){return c;},lite(c,f){return c;},
    dk(w,h,d,col,x,y,z){ctx.visualDetails.push({w,h,d,col,x,y,z});},
    flushDeco(){const m=new T.Mesh();m.userData.decorationBatch=true;S.add(m);},
    cBox(q){ctx.wl(q[0],q[1],q[2],q[3],2.4,0x687586);},
    cBar(q){ctx.wl(q[0],q[1],q[2],q[3],1.3,0xadb5bd);},
    inObs(x,z,m){return ctx.OB.some(o=>Math.abs(x-o.x)<o.hw+(m||0)&&Math.abs(z-o.z)<o.hd+(m||0));},
    reset(){},startMatch(){},endMatch(){ctx.mt.over=true;}
  };
  runInNewContext(mapSource+'\n'+townSource+'\n'+labsSource+'\n'+hospitalSource+'\n'+missionSource+'\n'+perceptionSource+'\n'+intelligenceSource+'\n'+tacticsSource+'\n'+cameraSource,ctx);
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
  assert.equal(c.bombTacticalStage(carrier),'intercept');
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
test('indoor architectural walls and framed passages have real physical anchors',()=>{
  const c=makeContext();c.selectGameMap(true);
  const framed=c.LT.filter(q=>q.y0>2&&q.y0<c.BOMB_RULES.ceilingHeight-0.5);
  assert.ok(framed.length>15,'numerous industrial doorframes have a bullet-blocking lintel');
  for(const lintel of framed){
    assert.equal(c.inObs(lintel.x,lintel.z,.55),false,'walkable doorway center must be open');
    const near=c.OB.filter(o=>Math.hypot(o.x-lintel.x,o.z-lintel.z)<6&&o.h>=c.BOMB_RULES.wallHeight-.1);
    assert.ok(near.length>=2,'two physical side piers must support each overhead lintel');
  }
  const wallDetails=c.visualDetails.filter(q=>q.h>1&&q.h<c.BOMB_RULES.wallHeight);
  assert.ok(wallDetails.length>200,'contrast panels and mullions exist on solid architectural walls');
  const groundDetails=c.visualDetails.filter(q=>q.y-q.h/2<.02&&q.y-q.h/2>-.02);
  assert.ok(groundDetails.length>0,'wall skirting and props are grounded');
});

test('Block Town outdoor 160x160 has separated A-side Police spawns and accessible A/B routes',()=>{
 const c=makeContext();c.selectedBombMapId='block-town';c.selectGameMap(true);
 assert.equal(c.A,80);assert.equal(c.BOMB_SITES[0].id,'A');assert.equal(c.BOMB_SITES[0].x,55);
 assert.equal(c.BOMB_SITES[1].id,'B');assert.equal(c.BOMB_SITES[1].x,-16);
 const police=c.BLOCK_TOWN_DEF.spawns.police,terror=c.BLOCK_TOWN_DEF.spawns.terrorist;
 assert.equal(police.length,5);assert.equal(terror.length,5);
 for(const p of police.concat(terror))assert.equal(c.inObs(p[0],p[1],.85),false,'spawn is collision-free '+p);
 for(const site of c.BOMB_SITES)assert.equal(c.inObs(site.x,site.z,1),false,'plant center is clear');
 assert.ok(police.every(p=>p[0]<-65&&p[1]<-25),'Police starts at WEST-NORTH purple spawn');
 assert.ok(terror.every(p=>p[0]>40&&p[1]>65),'Terrorists start at SOUTH-EAST red spawn');
 assert.ok(c.BOMB_SITES[0].x>40&&c.BOMB_SITES[0].z<-40,'A site is NORTH-EAST');
 assert.ok(c.BOMB_SITES[1].x<0&&c.BOMB_SITES[1].z>0,'B site is CENTRAL-SOUTH');
 for(const p of police)for(const q of terror){
  let blocked=false,steps=Math.ceil(Math.hypot(q[0]-p[0],q[1]-p[1])/.5);
  for(let k=1;k<steps;k++){
   let t=k/steps;
   if(c.inObs(p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t,.02)){blocked=true;break;}
  }
  assert.ok(blocked,'opposing spawn points never have a direct firing corridor');
 }
 runInNewContext(navSource,c);
 for(const p of police.concat(terror))for(const site of c.BOMB_SITES){
  const pts=c.gPath(p[0],p[1],site.x,site.z);
  assert.ok(pts&&pts.length>0,'real production A* path from '+p+' to '+site.id);
 }
 assert.equal(c.BLOCK_TOWN_WORLD.length>10,true,'town has real outdoor geometry');
 assert.equal(c.BOMB_WORLD,null,'Lockdown should not have been built unnecessarily');
 c.selectGameMap(false);assert.equal(c.A,60);
 assert.ok(c.BLOCK_TOWN_WORLD.every(o=>o.visible===false));
 c.selectedBombMapId='lockdown';c.selectGameMap(true);
 assert.equal(c.BOMB_SITES[0].x,-25,'original Lockdown site survives map swap');
 assert.ok(c.BOMB_WORLD.length>100);
 assert.ok(c.BLOCK_TOWN_WORLD.every(o=>o.visible===false));
 c.selectedBombMapId='block-town';c.selectGameMap(true);
 assert.equal(c.BOMB_SITES[0].x,55);
 assert.ok(c.BOMB_WORLD.every(o=>o.visible===false));
 assert.equal(c.OB.length,c.BLOCK_TOWN_OB.length,'restores only Block Town collision snapshot');
});

test('Block Town rendering avoids coplanar pavement, repeated plain-box facades and TDM grid leakage',()=>{
 const c=makeContext(),grid=c.S.children.find(o=>o.type==='GridHelper');
 assert.ok(grid&&grid.visible,'original TDM street grid starts visible');
 c.selectedBombMapId='block-town';c.selectGameMap(true);
 assert.equal(grid.visible,false,'old TDM GridHelper cannot bleed through Town street surface');
 const paving=c.BLOCK_TOWN_DEF.paving;
 for(let i=0;i<paving.length;i++)for(let j=i+1;j<paving.length;j++){
  const a=paving[i],b=paving[j];
  assert.ok(!(Math.abs(a[0]-b[0])<(a[2]+b[2])/2-.001&&Math.abs(a[1]-b[1])<(a[3]+b[3])/2-.001),
   'Town street paving cannot share coplanar coverage: '+i+','+j);
 }
 assert.ok(c.visualDetails.length>300,'architectural window, shopfront, roof and urban prop detailing exists');
 assert.ok(c.OB.length>=c.BLOCK_TOWN_DEF.buildings.length+c.BLOCK_TOWN_DEF.cover.length,
  'every solid urban structure is physical gameplay collision');
 c.BLOCK_TOWN_DEF.cover.forEach(function(p,i){
  const solid=c.OB.find(o=>Math.abs(o.x-p[0])<.001&&Math.abs(o.z-p[1])<.001);
  assert.ok(solid,'cover collision body exists at '+p);
  assert.equal(solid.hw,p[2]/2,'cover width is unchanged');
  assert.equal(solid.hd,p[3]/2,'cover depth is unchanged');
  assert.equal(solid.h,i%2===0?2.4:1.3,'visual-only restyling preserves the original cover height');
 });
 c.selectGameMap(false);
 assert.equal(grid.visible,true,'TDM GridHelper restored after leaving Bomb Mode');
});

test('Block Town owns a four-sided solid boundary and skyline while TDM and Lockdown remain isolated',()=>{
 const c=makeContext(),oldCity=c.OB.slice(),cfg=c.BLOCK_TOWN_DEF.perimeter,half=c.BLOCK_TOWN_DEF.halfSize,
       offset=half+cfg.thickness/2+.02,span=half*2+cfg.thickness*2;
 c.selectedBombMapId='block-town';c.selectGameMap(true);
 assert.equal(c.A,half);
 const expected=[[0,-offset,span,cfg.thickness],[0,offset,span,cfg.thickness],
   [-offset,0,cfg.thickness,span],[offset,0,cfg.thickness,span]];
 for(const w of expected){
   const hit=c.OB.find(o=>Math.abs(o.x-w[0])<.001&&Math.abs(o.z-w[1])<.001&&
      Math.abs(o.hw-w[2]/2)<.001&&Math.abs(o.hd-w[3]/2)<.001&&o.h===cfg.height);
   assert.ok(hit,'physical perimeter wall is registered for collision and bullet sweeps: '+w);
   const matching=c.S.children.find(m=>m.isMesh&&m.userData.box&&
     Math.abs(m.position.x-w[0])<.001&&Math.abs(m.position.z-w[1])<.001&&
     Math.abs(m.userData.box.w-w[2])<.001&&Math.abs(m.userData.box.d-w[3])<.001);
   assert.ok(matching,'each physical perimeter has an actual visible 3D wall');
   assert.equal(matching.visible,true);
 }
 const skyline=c.BLOCK_TOWN_WORLD.filter(m=>m.isMesh&&m.userData.box&&
   (Math.abs(m.position.x)>half||Math.abs(m.position.z)>half)&&
   m.userData.box.h>=cfg.facadeMinHeight);
 assert.ok(skyline.length>=20,'boundary is backed by outdoor urban skyline silhouettes');
 assert.ok(c.BLOCK_TOWN_DEF.spawns.police.concat(c.BLOCK_TOWN_DEF.spawns.terrorist)
   .every(p=>!c.inObs(p[0],p[1],.9)), 'boundary does not obstruct any spawn');
 c.selectedBombMapId='lockdown';c.selectGameMap(true);
 assert.ok(c.BLOCK_TOWN_WORLD.every(m=>m.visible===false),'Town enclosure disappears in Lockdown');
 c.selectGameMap(false);
 assert.deepEqual(c.OB,oldCity,'TDM original arena collision is restored exactly');
});
test('Block Town spawn orientation faces interior objective rather than empty outer boundary',()=>{
 const c=makeContext(),def=c.BLOCK_TOWN_DEF;
 c.selectedGameMode=1;c.selectedBombMapId='block-town';c.selectGameMap(true);
 for(const tm of [0,1]){
   const goal=tm?def.spawnLook.terrorist:def.spawnLook.police,
     group=tm?def.spawns.terrorist:def.spawns.police;
   for(const pt of group){
     const yaw=c.bombMapSpawnYaw(tm,pt[0],pt[1]);
     assert.ok(Number.isFinite(yaw));
     const dx=goal[0]-pt[0],dz=goal[1]-pt[1],length=Math.hypot(dx,dz);
     const dot=(Math.sin(yaw)*dx+Math.cos(yaw)*dz)/length;
     assert.ok(dot>.999,'player and BOT initial yaw aims into tactical route, not toward map edge');
   }
 }
 c.selectedBombMapId='lockdown';
 assert.equal(c.bombMapSpawnYaw(0,-15,65),Math.PI,'Lockdown police orientation unchanged');
 assert.equal(c.bombMapSpawnYaw(1,15,-65),0,'Lockdown Terrorist orientation unchanged');
 c.selectedGameMode=0;
 assert.equal(c.bombMapSpawnYaw(0,-10,38),Math.PI,'TDM police orientation unchanged');
 assert.equal(c.bombMapSpawnYaw(1,10,-38),0,'TDM Terrorist orientation unchanged');
 const src=readFileSync(resolve(root,'src/game/85-lobby-and-match.js'),'utf8');
 assert.match(src,/pl\.face=bombMapSpawnYaw\(tm,pl\.x,pl\.z\)/,'human spawn uses map yaw');
 assert.match(src,/pl\.face=bombMapSpawnYaw\(pl\.tm,pl\.x,pl\.z\)/,'respawn uses map yaw');
 assert.match(src,/b\.g\.rotation\.y=bombMapSpawnYaw\(b\.tm,b\.x,b\.z\)/,'BOT spawn uses map yaw');
});

test('Block Labs follows the six-block indoor Deathmatch blueprint and isolates all map states',()=>{
 const c=makeContext(),oldCity=c.OB.slice(),def=c.BLOCK_LABS_DEF;
 c.selectedGameMode=0;c.selectedTdmMapId='block-labs';
 c.selectGameMap(false);
 assert.equal(c.A,60);
 assert.equal(def.blocks.length,6,'three rows and two columns of solid laboratory blocks');
 assert.equal(def.reactors.length,6,'four outer green reactors and two central reactors');
 assert.ok(c.BLOCK_LABS_WORLD.length>=25,'world has complete physical and visual facility geometry');
 for(const b of def.blocks){
   assert.ok(c.OB.some(o=>o.x===b[0]&&o.z===b[1]&&o.hw===b[2]/2&&o.hd===b[3]/2),
     'white building is solid rather than a fake walk-through block: '+b);
 }
 for(const reactor of def.reactors){
   assert.ok(c.OB.some(o=>o.x===reactor[0]&&o.z===reactor[1]&&o.hw===reactor[2]&&o.hd===reactor[2]),
     'green reactor is grounded, collidable and registered: '+reactor);
 }
 assert.ok(c.LT.some(o=>o.hw===60&&o.hd===60&&o.y0>10),'indoor ceiling blocks overhead projectiles');
 const edge=def.halfSize+.52,span=def.halfSize*2+1.6;
 for(const w of [[0,-edge,span,1.2],[0,edge,span,1.2],[-edge,0,1.2,span],[edge,0,1.2,span]])
   assert.ok(c.OB.some(o=>o.x===w[0]&&o.z===w[1]&&o.hw===w[2]/2&&o.hd===w[3]/2),
     'full perimeter has a matching grounded solid collider');
 for(const pts of [def.spawns.police,def.spawns.terrorist])
   for(const v of pts)assert.equal(c.inObs(v[0],v[1],.85),false,'spawn must be clear of all lab walls');
 runInNewContext(navSource,c);
 for(const tm of [0,1]){
   const goal=tm?def.spawnLook.terrorist:def.spawnLook.police;
   for(const v of (tm?def.spawns.terrorist:def.spawns.police)){
     const yaw=c.bombMapSpawnYaw(tm,v[0],v[1]);
     assert.ok((Math.sin(yaw)*(goal[0]-v[0])+Math.cos(yaw)*(goal[1]-v[1]))/
       Math.hypot(goal[0]-v[0],goal[1]-v[1])>.99,'team must face toward inner lab');
     const path=c.gPath(v[0],v[1],-45,0);
     assert.ok(path&&path.length>0,'A* traverses the left route from spawn '+v);
     const right=c.gPath(v[0],v[1],45,0);
     assert.ok(right&&right.length>0,'A* traverses the right route from spawn '+v);
   }
 }
 c.selectedGameMode=1;c.selectedBombMapId='block-town';c.selectGameMap(true);
 assert.equal(c.A,80);assert.ok(c.BLOCK_LABS_WORLD.every(o=>o.visible===false),'Labs never bleeds into Bomb');
 c.selectedGameMode=0;c.selectedTdmMapId='block-district';c.selectGameMap(false);
 assert.equal(c.A,60);
 assert.ok(c.BLOCK_LABS_WORLD.every(o=>o.visible===false),'Labs geometry is hidden in original TDM');
 assert.deepEqual(c.OB,oldCity,'existing Block District collision is unchanged');
 c.selectedTdmMapId='block-labs';c.selectGameMap(false);
 assert.equal(c.OB.length,c.BLOCK_LABS_OB.length,'restores only Labs colliders');
});
test('Block Labs preserves old TDM orientation and physical respawn handling elsewhere',()=>{
 const c=makeContext();
 c.selectedGameMode=0;c.selectedTdmMapId='block-district';
 assert.equal(c.bombMapSpawnYaw(0,0,38),Math.PI);
 assert.equal(c.bombMapSpawnYaw(1,0,-38),0);
 assert.equal(c.tdmMapId('__proto__'),'block-district','unsafe map ID is rejected');
 assert.equal(c.tdmMapId('../block-labs'),'block-district');
 const source=readFileSync(resolve(root,'src/game/85-lobby-and-match.js'),'utf8');
 assert.match(source,/if\(tdmMapId\(selectedTdmMapId\)==="block-labs"\)return labsSpawnPt\(tm\)/);
 assert.match(source,/pl\.face=bombMapSpawnYaw\(tm,pl\.x,pl\.z\)/);
});

test('Block Town V3 obeys owner blueprint anchors and offers connected, broken-sightline streets',()=>{
 const c=makeContext();
 c.selectedBombMapId='block-town';c.selectGameMap(true);
 const d=c.BLOCK_TOWN_DEF;
 assert.equal(d.halfSize,80,'original 160x160 Bomb footprint retained');
 assert.equal(d.buildings.length,15,'illustrated 15 irregular white building masses are real');
 assert.equal(d.cover.length,15,'urban cover islands protect long exterior streets');
 for(const point of d.spawns.police.concat(d.spawns.terrorist))
   assert.equal(c.inObs(point[0],point[1],.9),false,'every configured spawn is outside solids');
 for(const site of c.BOMB_SITES)
   assert.equal(c.inObs(site.x,site.z,3.1),false,'planting circle stays entirely usable: '+site.id);
 // Conservative per-projectile ray proxy with the SAME OB collision rectangles as gameplay.
 function occluded(a,b){
   const n=Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/.5);
   for(let i=1;i<n;i++){
     const t=i/n;
     if(c.inObs(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,.02))return true;
   }
   return false;
 }
 for(const p of d.spawns.police)for(const q of d.spawns.terrorist)
   assert.equal(occluded(p,q),true,'no direct spawn-vs-spawn sniping corridor');
 runInNewContext(navSource,c);
 for(const p of d.spawns.police.concat(d.spawns.terrorist)){
   for(const site of c.BOMB_SITES){
     const route=c.gPath(p[0],p[1],site.x,site.z);
     assert.ok(route&&route.length,'both objectives accessible from '+p+' to '+site.id);
   }
 }
 // Real physical blockers cut the wide east-west center street while leaving
 // alternate passing routes. Missing/visual-only props would invalidate this.
 for(const q of d.cover)
   assert.ok(c.OB.some(o=>o.x===q[0]&&o.z===q[1]&&o.hw===q[2]/2&&o.hd===q[3]/2),
     'decorative town furniture has genuine projectile/nav collision: '+q);
 assert.equal(d.landmarks.map(o=>o.kind).join(','),'delivery-van,street-kiosk');
 for(const item of d.landmarks){
   assert.ok(c.OB.some(o=>o.x===item.x&&o.z===item.z&&o.hw===item.w/2&&
      o.hd===item.d/2&&o.h===item.h),
      'real town landmark must have exact collision volume: '+item.kind);
   for(const point of d.spawns.police.concat(d.spawns.terrorist))
     assert.ok(Math.abs(point[0]-item.x)>item.w/2+.85||
       Math.abs(point[1]-item.z)>item.d/2+.85,
       'collidable landmark cannot overlap spawn '+item.kind);
 }
 // Walking lanes around each landmark must remain navigable in production A*.
 for(const point of d.spawns.police.concat(d.spawns.terrorist))
   for(const site of c.BOMB_SITES)
     assert.ok(c.gPath(point[0],point[1],site.x,site.z).length>0,
       'landmarks may not obstruct either actual Bomb Site');
});

test('Block Town V4 limits sampled eye-height geometric LOS to 70 units via real urban cover',()=>{
 const c=makeContext();c.selectedBombMapId='block-town';c.selectGameMap(true);
 const d=c.BLOCK_TOWN_DEF,limit=d.visibility.far;
 assert.equal(d.visibility.eyeHeight,1.7);
 assert.equal(limit,70,'view distance belongs to Block Town config');
 assert.equal(c.S.fog.near,d.visibility.near);
 assert.equal(c.S.fog.far,70,'rendered exterior is completely fogged at 70 units');
 assert.equal(d.sightlineBreakers.length,37,'all deliberate chicane profiles are declared');
 const blockers=d.sightlineBreakers;
 for(const q of blockers){
   const hit=c.OB.find(o=>o.x===q[1]&&o.z===q[2]&&o.hw===q[3]/2&&o.hd===q[4]/2&&o.h===q[5]);
   assert.ok(hit,'each visible street chicane must also stop players, projectiles and A* '+q[0]);
   assert.ok(hit.h>d.visibility.eyeHeight,'eye-height sightline blocker is not a knee-high prop');
 }
 // Actual world collision array, not a second curated cover list.
 // Slab entry ray-vs-AABB at human eye height. The independent dense probe
 // detects 160-unit straight street leaks, including along perimeter streets.
 const walls=c.OB.filter(o=>!o.fl&&o.h>=d.visibility.eyeHeight&&(!o.y0||o.y0<=d.visibility.eyeHeight));
 const directions=[];
 for(let angle=0;angle<360;angle+=d.visibility.auditDegrees){
   const rad=angle*Math.PI/180;directions.push([Math.cos(rad),Math.sin(rad)]);
 }
 let checked=0,longest=0;
 for(let z=-76;z<=76;z+=d.visibility.auditGrid)
 for(let x=-76;x<=76;x+=d.visibility.auditGrid){
   if(c.inObs(x,z,.9))continue;
   for(const direction of directions){
     const vx=direction[0],vz=direction[1];
     let nearest=200;
     for(const box of walls){
       const x0=box.x-box.hw,x1=box.x+box.hw,z0=box.z-box.hd,z1=box.z+box.hd;
       let ax=-Infinity,bx=Infinity,az=-Infinity,bz=Infinity;
       if(Math.abs(vx)<1e-9){
         if(x<x0||x>x1)continue;
       }else{
         const a=(x0-x)/vx,b=(x1-x)/vx;ax=Math.min(a,b);bx=Math.max(a,b);
       }
       if(Math.abs(vz)<1e-9){
         if(z<z0||z>z1)continue;
       }else{
         const a=(z0-z)/vz,b=(z1-z)/vz;az=Math.min(a,b);bz=Math.max(a,b);
       }
       const entry=Math.max(0,ax,az);
       if(entry<=Math.min(bx,bz)&&entry<nearest)nearest=entry;
     }
     checked++;longest=Math.max(longest,nearest);
     assert.ok(nearest<=limit+.12,
       'LOS leak '+nearest.toFixed(2)+' > '+limit+' from '+x+','+z+' toward '+vx.toFixed(3)+','+vz.toFixed(3));
   }
 }
 assert.ok(checked>45000,'survey must sample enough real traversable streets');
 assert.ok(longest>45,'no artificial universal weapon or projectile range nerf was introduced');
 c.selectedBombMapId='lockdown';c.selectGameMap(true);
 assert.ok(c.S.fog.far!==70,'Block Town visibility must not leak to Lockdown');
 c.selectGameMap(false);
 assert.ok(c.S.fog===c.BOMB_FOG,'original Deathmatch fog restored');
});


test('Hospital blueprint registers as an indoor 160x160 Bomb map with real physical wards and props',()=>{
 const c=makeContext(),oldOb=c.OB.slice(),oldSky=c.S.fog;
 assert.equal(c.bombMapId('hospital'),'hospital');
 assert.equal(c.bombMapId('hospital/../bad'),'lockdown');
 assert.equal(c.bombMapOptions(1).map(x=>x.id).join(','),'lockdown,block-town,hospital');
 c.selectedBombMapId='hospital';
 c.selectGameMap(true);
 assert.equal(c.A,80);
 assert.equal(c.BOMB_SITES[0].id,'A');assert.equal(c.BOMB_SITES[0].x,67);assert.equal(c.BOMB_SITES[0].z,-43);
 assert.equal(c.BOMB_SITES[1].id,'B');assert.equal(c.BOMB_SITES[1].x,-67);assert.equal(c.BOMB_SITES[1].z,3);
 assert.ok(c.HOSPITAL_WORLD.length>20);
 assert.equal(c.HOSPITAL_DEF.wings.length,10);
 assert.equal(c.HOSPITAL_DEF.furniture.length,20);
 assert.equal(c.HOSPITAL_DEF.halfSize,80);
 assert.ok(c.HOSPITAL_LT.some(x=>x.hw===80&&x.hd===80&&x.y0>10),'hospital has a physical ceiling');
 for(const b of c.HOSPITAL_DEF.wings){
   assert.ok(c.OB.some(o=>o.x===b[0]&&o.z===b[1]&&o.hw===b[2]/2&&o.hd===b[3]/2),
     'each blueprint white room block must be physically solid '+b);
 }
 for(const p of c.HOSPITAL_DEF.furniture){
   assert.ok(c.OB.some(o=>o.x===p[1]&&o.z===p[2]&&
     o.hw===p[3]/2&&o.hd===p[4]/2&&o.h===p[5]),
     'every clinical cover prop must have a real collider '+p[0]);
 }
 for(const site of c.BOMB_SITES)
   assert.equal(c.inObs(site.x,site.z,3.1),false,'both Bomb plant circles must be clear of clinical props '+site.id);
 const groups=[c.HOSPITAL_DEF.spawns.police,c.HOSPITAL_DEF.spawns.terrorist];
 assert.equal(groups[0].length,5);assert.equal(groups[1].length,5);
 for(const point of groups.flat())
   assert.equal(c.inObs(point[0],point[1],.85),false,'all ten spawn slots must be safe');
 for(const p of groups[0])for(const q of groups[1]){
   let blocked=false;const n=Math.ceil(Math.hypot(p[0]-q[0],p[1]-q[1])/.5);
   for(let i=1;i<n;i++){
     const r=i/n;
     if(c.inObs(p[0]+(q[0]-p[0])*r,p[1]+(q[1]-p[1])*r,.02)){blocked=true;break;}
   }
   assert.ok(blocked,'opposing Hospital spawns cannot shoot each other through corridors');
 }
 runInNewContext(navSource,c);
 for(const p of groups.flat())for(const site of c.BOMB_SITES){
   const path=c.gPath(p[0],p[1],site.x,site.z);
   assert.ok(path&&path.length>0,'production A* path exists from '+p+' to Hospital site '+site.id);
 }
 for(const team of [0,1]){
   const look=team?c.HOSPITAL_DEF.spawnLook.terrorist:c.HOSPITAL_DEF.spawnLook.police;
   for(const p of groups[team]){
     const yaw=c.bombMapSpawnYaw(team,p[0],p[1]),dx=look[0]-p[0],dz=look[1]-p[1];
     assert.ok(Math.cos(yaw)*dz+Math.sin(yaw)*dx>0,'spawns face interior medical corridors');
   }
 }
 const clinicalOb=c.HOSPITAL_OB.length;
 c.selectedBombMapId='block-town';c.selectGameMap(true);
 assert.ok(c.HOSPITAL_WORLD.every(m=>!m.visible),'Hospital hidden when switching to Block Town');
 assert.equal(c.BOMB_SITES[0].x,55);
 c.selectedBombMapId='lockdown';c.selectGameMap(true);
 assert.equal(c.BOMB_SITES[0].x,-25);
 assert.ok(c.HOSPITAL_WORLD.every(m=>!m.visible),'Hospital hidden in Lockdown');
 c.selectGameMap(false);
 assert.deepEqual(c.OB,oldOb,'Deathmatch original physical map restored');
 c.selectedBombMapId='hospital';c.selectGameMap(true);
 assert.equal(c.OB.length,clinicalOb,'Hospital reuses only its own cached obstacles');
 assert.equal(c.HOSPITAL_WORLD.every(m=>m.visible),true);
});

test('Hospital corridor geometry is traced from owner artwork, not arbitrary rectangular maze',()=>{
 const c=makeContext();c.selectedBombMapId='hospital';c.selectGameMap(true);
 const d=c.HOSPITAL_DEF,source=c.HOSPITAL_BLUEPRINT;
 assert.equal(source.width,632);
 assert.equal(source.height,627);
 assert.equal(source.outlinePx.length,32,'every outer gray-border step is retained');
 assert.equal(source.roomsPx.length,10,'eight original isolated white room islands including 3-piece L');
 assert.equal(d.wings.length,10);
 // Actual screenshot-based WHITE samples are impassable, not invented paths.
 const white=[[150,185],[329,120],[510,200],[331,245],
   [445,354],[440,540],[100,422],[250,467],[207,527],[170,560]];
 for(const px of white){
   const point=c.hospitalPxPoint(px[0],px[1]);
   assert.ok(c.inObs(point[0],point[1],.4),
     'white owner-blueprint room must be truly solid '+px);
 }
 // The arrow endpoints / corridor centerline junctions remain walkable.
 const grey=[[49,52],[52,150],[50,240],[125,139],
   [252,196],[330,192],[436,194],[584,138],[586,291],
   [260,296],[58,323],[46,405],[162,405],[239,393],
   [355,398],[525,397],[350,471],[538,548],
   [112,601],[450,594]];
 for(const px of grey){
   const point=c.hospitalPxPoint(px[0],px[1]);
   assert.equal(c.inObs(point[0],point[1],.6),false,
      'grey owner-blueprint corridor must not have any blocking wall/prop '+px);
 }
 // At least 30 edge segments physically enforce the stepped external footprint.
 for(let i=0;i<source.outlinePx.length;i++){
   const a=source.outlinePx[i],b=source.outlinePx[(i+1)%source.outlinePx.length],
     p=c.hospitalPxPoint((a[0]+b[0])/2,(a[1]+b[1])/2);
   assert.ok(c.inObs(p[0],p[1],.1),
     'outer corridor outline must have a physical solid boundary '+i);
 }
 assert.ok(c.HOSPITAL_LT.some(o=>o.hw===80&&o.hd===80&&o.y0>10));
});
