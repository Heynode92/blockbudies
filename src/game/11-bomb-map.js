// BOMB MISSION: rules and UI strings are centralized here; no gameplay constants in input/HUD.
var BOMB_RULES=Object.freeze({teamSize:5,rounds:12,wins:7,roundSeconds:120,freezeSeconds:5,
  plantSeconds:5,defuseSeconds:7,fuseSeconds:40,roundBreakSeconds:3,
  siteRadius:3.1,interactRadius:2.45,pickupRadius:2,cellSize:7,cells:11,
  wallHeight:5.4,ceilingHeight:5.7,seed:73021,botUseRange:2.1});
var BOMB_TEXT=Object.freeze({
  plant:'Plant bomb here',defuse:'Defuse the bomb',planting:'PLANTING BOMB',defusing:'DEFUSING BOMB',
  planted:'BOMB PLANTED',dropped:'BOMB DROPPED',carrier:'YOU HAVE THE BOMB',picked:'BOMB PICKED UP',
  spectating:'SPECTATING',switchView:'LEFT / RIGHT to switch teammate',noTeam:'NO TEAMMATES ALIVE',
  policeWin:'POLICE WIN THE ROUND',terrorWin:'TERRORISTS WIN THE ROUND',
  explosion:'BOMB DETONATED',defused:'BOMB DEFUSED',round:'ROUND',hold:'HOLD E',
  elimination:'TEAM ELIMINATED',timeout:'TIME EXPIRED',site:'BOMB SITE'});
var BOMB_SITES=[{id:'A',x:-21,z:-7,col:0xffa94d},{id:'B',x:21,z:7,col:0x4dabf7}];
var BOMB_CITY=S.children.filter(function(o){return o.isMesh||o.isGridHelper;});
var BOMB_CITY_OB=OB.slice(),BOMB_CITY_BR=BR.slice(),BOMB_CITY_LT=LT.slice();
var BOMB_WORLD=null,BOMB_OB=[],BOMB_BR=[],BOMB_LT=[],BOMB_FOG=S.fog,BOMB_BACKGROUND=S.background;
var selectedGameMode=0;
function isBombMode(){return selectedGameMode===1;}
// A guaranteed connected, looped indoor maze: DFS spanning tree + additional doors and open rooms.
function makeBombMap(){
  var before=S.children.slice(),cfg=BOMB_RULES,n=cfg.cells,step=cfg.cellSize,h=cfg.wallHeight,half=n*step/2;
  var seed=cfg.seed;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  var dirs=[[1,0],[-1,0],[0,1],[0,-1]],cells=[],stack=[[0,0]];
  for(var j=0;j<n;j++)for(var i=0;i<n;i++)cells[j*n+i]={seen:false,links:{}};
  cells[0].seen=true;
  while(stack.length){var p=stack[stack.length-1],options=[];
    dirs.forEach(function(d){var nx=p[0]+d[0],nz=p[1]+d[1];if(nx>=0&&nx<n&&nz>=0&&nz<n&&!cells[nz*n+nx].seen)options.push([nx,nz,d]);});
    if(!options.length){stack.pop();continue;}
    var next=options[(random()*options.length)|0],ax=p[1]*n+p[0],bx=next[1]*n+next[0];
    cells[ax].links[bx]=true;cells[bx].links[ax]=true;cells[bx].seen=true;stack.push([next[0],next[1]]);
  }
  // Controlled loops make multiple flanking routes. Never close a spanning-tree connection.
  function linked(a,b){return !!cells[a].links[b];}
  function blockedWall(x,z,w,d,col){wl(x,z,w,d,h,col);}
  mk(step*n,.16,step*n,0x1e2631,0,-.08,0);
  for(j=0;j<n;j++)for(i=0;i<n;i++){
    var x=(i-(n-1)/2)*step,z=(j-(n-1)/2)*step,id=j*n+i,sector=(i+j*3)%4;
    mk(step-.18,.06,step-.18,[0x333c49,0x3c414b,0x414653,0x343e4a][sector],x,.015,z);
    mk(step-.07,.22,step-.07,[0x3e4651,0x36404c,0x434a55][sector%3],x,cfg.ceilingHeight,z);
    // Deterministic industrial light panels, pipes and floor stripes.
    if((i+j)%3===0){var lamp=mk(2,.07,.7,0xcce6ef,x,cfg.ceilingHeight-.16,z);lamp.castShadow=false;}
    if(i===0)blockedWall(x-step/2,z,.5,step+.15,0x627083);
    if(j===0)blockedWall(x,z-step/2,step+.15,.5,0x627083);
    if(i===n-1)blockedWall(x+step/2,z,.5,step+.15,0x627083);
    if(j===n-1)blockedWall(x,z+step/2,step+.15,.5,0x627083);
    if(i<n-1&&!linked(id,id+1)&&random()>.29)blockedWall(x+step/2,z,.52,step+.03,sector%2?0x5c6573:0x58616e);
    if(j<n-1&&!linked(id,id+n)&&random()>.29)blockedWall(x,z+step/2,step+.03,.52,sector%2?0x596576:0x525f6d);
    if((i+j)%7===0&&i>0&&i<n-1&&j>0&&j<n-1&&!(i===2&&j===4)&&!(i===8&&j===6)){
      // low cover, never blocks the whole 7-unit-wide cell or maze navigation
      var bx0=x+(random()>.5?1.5:-1.5),bz0=z+(random()>.5?1.4:-1.4);
      wl(bx0,bz0,1.25,1.4,1.45,0x7a6048);
    }
  }
  // Numbered, readable A/B target rooms. Sprites are visual and never obstruct collision.
  BOMB_SITES.forEach(function(q){
    var ring=new T.Mesh(new T.RingGeometry(cfg.siteRadius-.25,cfg.siteRadius,40),new T.MeshBasicMaterial({color:q.col,transparent:true,opacity:.85,side:T.DoubleSide,depthWrite:false}));
    ring.rotation.x=-Math.PI/2;ring.position.set(q.x,.12,q.z);S.add(ring);
    var field=new T.Mesh(new T.CircleGeometry(cfg.siteRadius-.4,40),new T.MeshBasicMaterial({color:q.col,transparent:true,opacity:.14,side:T.DoubleSide,depthWrite:false}));field.rotation.x=-Math.PI/2;field.position.set(q.x,.1,q.z);S.add(field);
    var canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;var cx=canvas.getContext('2d');
    cx.fillStyle='rgba(7,15,27,.9)';cx.fillRect(0,0,256,128);cx.fillStyle='#ffffff';cx.font='bold 84px Impact, sans-serif';cx.textAlign='center';cx.fillText(q.id,128,94);
    var sign=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(canvas),transparent:true,depthTest:false}));sign.scale.set(3.2,1.6,1);sign.position.set(q.x,3.3,q.z);S.add(sign);
  });
  BOMB_WORLD=S.children.filter(function(o){return before.indexOf(o)<0;});
  BOMB_OB=OB.slice();BOMB_BR=BR.slice();BOMB_LT=LT.slice();
}
// Switch collision geometry, visibility and pathfinding grid without touching TDM entities or controls.
function selectGameMap(bombActive){
  BOMB_CITY.forEach(function(m){m.visible=!bombActive;});
  OB.length=0;BR.length=0;LT.length=0;
  if(bombActive){
    if(!BOMB_WORLD)makeBombMap();
    else{Array.prototype.push.apply(OB,BOMB_OB);Array.prototype.push.apply(BR,BOMB_BR);Array.prototype.push.apply(LT,BOMB_LT);}
    BOMB_WORLD.forEach(function(m){m.visible=true;});S.background=new T.Color(0x1b2735);S.fog=new T.Fog(0x1b2735,25,95);
  }else{
    if(BOMB_WORLD)BOMB_WORLD.forEach(function(m){m.visible=false;});
    Array.prototype.push.apply(OB,BOMB_CITY_OB);Array.prototype.push.apply(BR,BOMB_CITY_BR);Array.prototype.push.apply(LT,BOMB_CITY_LT);
    S.background=BOMB_BACKGROUND;S.fog=BOMB_FOG;
  }
  GB=null;
}
function bombSpawnPt(team){
  var hist=SPH[team],step=BOMB_RULES.cellSize,candidates=[],z=team?-35:35;
  [-14,-7,0,7,14].forEach(function(x){if(!inObs(x,z,.85)&&!hist.some(function(p){return Math.hypot(p[0]-x,p[1]-z)<4;}))candidates.push([x,z]);});
  var pick=candidates.length?candidates[(Math.random()*candidates.length)|0]:[(Math.random()-.5)*10,z];
  hist.push(pick);return pick;
}
