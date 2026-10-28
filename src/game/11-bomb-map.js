// BOMB MISSION: rules and UI strings are centralized here; no gameplay constants in input/HUD.
var BOMB_RULES=Object.freeze({teamSize:5,rounds:12,wins:7,roundSeconds:120,freezeSeconds:5,
  plantSeconds:5,defuseSeconds:7,fuseSeconds:40,roundBreakSeconds:3,
  siteRadius:3.1,interactRadius:2.45,pickupRadius:2,cellSize:10,cells:16,
  wallHeight:5.4,ceilingHeight:5.7,seed:73021,botUseRange:2.1});
var BOMB_TEXT=Object.freeze({
  plant:'Plant bomb here',defuse:'Defuse the bomb',planting:'PLANTING BOMB',defusing:'DEFUSING BOMB',
  planted:'BOMB PLANTED',dropped:'BOMB DROPPED',carrier:'YOU HAVE THE BOMB',picked:'BOMB PICKED UP',
  spectating:'SPECTATING',switchView:'LEFT / RIGHT to switch teammate',noTeam:'NO TEAMMATES ALIVE',
  policeWin:'POLICE WIN THE ROUND',terrorWin:'TERRORISTS WIN THE ROUND',
  explosion:'BOMB DETONATED',defused:'BOMB DEFUSED',round:'ROUND',hold:'HOLD E',
  elimination:'TEAM ELIMINATED',timeout:'TIME EXPIRED',site:'BOMB SITE'});
var BOMB_SITES=[{id:'A',x:-25,z:-5,col:0xffa94d},{id:'B',x:25,z:5,col:0x4dabf7}];
var BOMB_CITY=S.children.filter(function(o){return o.isMesh||o.isGridHelper;});
var BOMB_CITY_OB=OB.slice(),BOMB_CITY_BR=BR.slice(),BOMB_CITY_LT=LT.slice();
var BOMB_WORLD=null,BOMB_OB=[],BOMB_BR=[],BOMB_LT=[],BOMB_FOG=S.fog,BOMB_BACKGROUND=S.background,BOMB_NAV_WALLS=[];
var BOMB_CITY_HALF=A;
var selectedGameMode=0;
function isBombMode(){return selectedGameMode===1;}
// A guaranteed connected, looped indoor maze: DFS spanning tree + additional doors and open rooms.
function makeBombMap(){
  var before=S.children.slice(),cfg=BOMB_RULES,n=cfg.cells,step=cfg.cellSize,h=cfg.wallHeight;
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
  mk(step*n,.16,step*n,0x1e2631,0,-.08,0).castShadow=false;
  BOMB_NAV_WALLS=[];
  var zones=[
    {floor:0x344757,ceiling:0x303a45,wall:0x4f6779,accent:0x4dabf7,label:'SECURITY'},
    {floor:0x474d50,ceiling:0x363a41,wall:0x66727a,accent:0xffa94d,label:'WAREHOUSE'},
    {floor:0x3f4b46,ceiling:0x33413c,wall:0x5e7363,accent:0x69db7c,label:'REACTOR'},
    {floor:0x494450,ceiling:0x383440,wall:0x776878,accent:0xb197fc,label:'LABORATORY'}
  ];
  function visualBox(w,hh,d,col,x,y,z){var m=mk(w,hh,d,col,x,y,z);m.castShadow=false;return m;}
  function mapBarrier(x,z,w,d,hh,col){blockedWall(x,z,w,d,col);BOMB_NAV_WALLS.push({x:x,z:z,hw:w/2,hd:d/2});}
  // Keep props near the perimeter of each room, away from its navigation hub.
  function facilityProps(x,z,i,j,zone){
    var pattern=(i*7+j*11)%9,edge=(i+j)%2?1:-1;
    if(pattern===0||pattern===7){ // server racks and consoles
      visualBox(2.1,2.6,.85,0x202934,x+edge*3.8,1.3,z+3.8);
      for(var a=0;a<3;a++)visualBox(1.55,.19,.08,a===1?zone.accent:0x80b0c8,x+edge*3.8,.7+a*.65,z+3.32);
      visualBox(1.7,.12,.18,0x131c26,x+edge*3.8,2.7,z+3.65);
    }else if(pattern===1||pattern===5){ // steel cargo shelves with colored supplies
      visualBox(2.5,.13,1.0,0x77848d,x+edge*3.6,1.0,z-3.8);
      visualBox(2.5,.13,1.0,0x77848d,x+edge*3.6,2.0,z-3.8);
      for(var a=0;a<2;a++)visualBox(.72,.7,.7,a?zone.accent:0x9e7d57,x+edge*(3.6+a*.6),1.39+a*.85,z-3.8);
    }else if(pattern===2){ // utility pipes + tank
      visualBox(.7,2.7,.7,0x8197a0,x+3.6,1.35,z+edge*3.6);
      visualBox(3.0,.18,.18,0x6ccacb,x+2.5,3.15,z+edge*3.7);
      visualBox(.35,1.7,.35,0xc0cad1,x+3.6,3.0,z+edge*3.6);
    }else if(pattern===3){ // modular low cover
      visualBox(2.8,1.1,1.4,0x79604e,x-3.6,.55,z+edge*3.5);
      visualBox(2.9,.12,1.5,zone.accent,x-3.6,1.14,z+edge*3.5);
    }else if(pattern===4){ // supply workstations with bright displays
      visualBox(2.8,.15,1.2,0x7d838a,x+edge*3.4,1.1,z+3.7);
      visualBox(1.5,.9,.11,0x1a2731,x+edge*3.4,1.7,z+3.8);
      visualBox(1.16,.57,.06,zone.accent,x+edge*3.4,1.75,z+3.71);
    }else if(pattern===6){ // tanks / generators
      for(var a=0;a<2;a++){
        visualBox(.9,2.7,.9,a?0x7798a0:0x647c88,x+edge*3.6+a*1.2,1.35,z+3.7);
        visualBox(1.1,.2,1.1,zone.accent,x+edge*3.6+a*1.2,2.7,z+3.7);
      }
    }
  }
  for(j=0;j<n;j++)for(i=0;i<n;i++){
    var x=(i-(n-1)/2)*step,z=(j-(n-1)/2)*step,id=j*n+i;
    // Quadrant palettes give landmarks to navigate by instead of identical gray rooms.
    var sector=(i<n/2?0:1)+(j<n/2?0:2),zone=zones[sector];
    visualBox(step-.16,.07,step-.16,zone.floor,x,.015,z);
    visualBox(step-.10,.22,step-.10,zone.ceiling,x,cfg.ceilingHeight,z);
    // Floor markings and overhead services lead players towards the central objectives.
    if((i+j)%3===0){visualBox(2.4,.055,.7,0xcce6ef,x,cfg.ceilingHeight-.18,z);
      visualBox(2.8,.08,.8,0x26343c,x,cfg.ceilingHeight-.25,z);}
    if((i+j)%4===0){visualBox(.12,.035,step*.65,zone.accent,x-.9,.06,z);
      visualBox(.12,.035,step*.65,zone.accent,x+.9,.06,z);}
    if(i===0)mapBarrier(x-step/2,z,.5,step+.15,h,zone.wall);
    if(j===0)mapBarrier(x,z-step/2,step+.15,.5,h,zone.wall);
    if(i===n-1)mapBarrier(x+step/2,z,.5,step+.15,h,zone.wall);
    if(j===n-1)mapBarrier(x,z+step/2,step+.15,.5,h,zone.wall);
    // Keep many broad openings, and a large number of secondary flanking paths.
    if(i<n-1&&!linked(id,id+1)&&random()>.42)mapBarrier(x+step/2,z,.52,step+.03,h,zone.wall);
    if(j<n-1&&!linked(id,id+n)&&random()>.42)mapBarrier(x,z+step/2,step+.03,.52,h,zone.wall);
    // Dress every sector differently. The props are decorative, never a hidden maze obstacle.
    var isSite=BOMB_SITES.some(function(q){return Math.hypot(q.x-x,q.z-z)<step*1.3;});
    if(!isSite&&i>0&&j>0&&i<n-1&&j<n-1)facilityProps(x,z,i,j,zone);
    if((i+j)%5===0){ // ceiling ducts (mounted high enough to clear players and bullets)
      visualBox(step*.7,.28,.35,0x778b96,x,cfg.ceilingHeight-.52,z-3.5);
      visualBox(.25,.15,.8,zone.accent,x+2,cfg.ceilingHeight-.7,z-3.5);
    }
    // Floor-level cabinets act as usable cover without filling central routes.
    if(!isSite&&(i*13+j*17)%11===0&&i>0&&j>0&&i<n-1&&j<n-1){
      var ax=x-3.65,az=z-3.65;wl(ax,az,1.7,1.5,1.4,0x687586);
      visualBox(1.6,.13,1.4,zone.accent,ax,1.47,az);
    }
  }
  // Numbered, readable A/B target rooms. Sprites are visual and never obstruct collision.
  BOMB_SITES.forEach(function(q){
    var ring=new T.Mesh(new T.RingGeometry(cfg.siteRadius-.25,cfg.siteRadius,40),new T.MeshBasicMaterial({color:q.col,transparent:true,opacity:.85,side:T.DoubleSide,depthWrite:false}));
    ring.rotation.x=-Math.PI/2;ring.position.set(q.x,.12,q.z);S.add(ring);
    var field=new T.Mesh(new T.CircleGeometry(cfg.siteRadius-.4,40),new T.MeshBasicMaterial({color:q.col,transparent:true,opacity:.14,side:T.DoubleSide,depthWrite:false}));field.rotation.x=-Math.PI/2;field.position.set(q.x,.1,q.z);S.add(field);
    var canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;var cx=canvas.getContext('2d');
    cx.fillStyle='rgba(7,15,27,.9)';cx.fillRect(0,0,256,128);cx.fillStyle='#ffffff';cx.font='bold 84px Impact, sans-serif';cx.textAlign='center';cx.fillText(q.id,128,94);
    var sign=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(canvas),transparent:true,depthTest:true}));sign.scale.set(3.2,1.6,1);sign.position.set(q.x,3.3,q.z);S.add(sign);
  });
  BOMB_WORLD=S.children.filter(function(o){return before.indexOf(o)<0;});
  BOMB_OB=OB.slice();BOMB_BR=BR.slice();BOMB_LT=LT.slice();
}
// Switch collision geometry, visibility and pathfinding grid without touching TDM entities or controls.
function selectGameMap(bombActive){
  BOMB_CITY.forEach(function(m){m.visible=!bombActive;});
  OB.length=0;BR.length=0;LT.length=0;
  if(bombActive){
    A=BOMB_RULES.cellSize*BOMB_RULES.cells/2;
    if(!BOMB_WORLD)makeBombMap();
    else{Array.prototype.push.apply(OB,BOMB_OB);Array.prototype.push.apply(BR,BOMB_BR);Array.prototype.push.apply(LT,BOMB_LT);}
    BOMB_WORLD.forEach(function(m){m.visible=true;});S.background=new T.Color(0x1b2735);S.fog=new T.Fog(0x1b2735,25,95);
  }else{
    A=BOMB_CITY_HALF;
    if(BOMB_WORLD)BOMB_WORLD.forEach(function(m){m.visible=false;});
    Array.prototype.push.apply(OB,BOMB_CITY_OB);Array.prototype.push.apply(BR,BOMB_CITY_BR);Array.prototype.push.apply(LT,BOMB_CITY_LT);
    S.background=BOMB_BACKGROUND;S.fog=BOMB_FOG;
  }
  GB=null;
}
function bombSpawnPt(team){
  var hist=SPH[team],step=BOMB_RULES.cellSize,candidates=[],z=team?-65:65;
  [-35,-15,-5,5,15,35].forEach(function(x){if(!inObs(x,z,.85)&&!hist.some(function(p){return Math.hypot(p[0]-x,p[1]-z)<5;}))candidates.push([x,z]);});
  var pick=candidates.length?candidates[(Math.random()*candidates.length)|0]:[(Math.random()-.5)*10,z];
  hist.push(pick);return pick;
}
