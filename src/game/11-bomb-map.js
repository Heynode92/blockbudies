// BOMB MISSION: rules and UI strings are centralized here; no gameplay constants in input/HUD.
var BOMB_RULES=Object.freeze({teamSize:5,rounds:12,wins:7,roundSeconds:120,freezeSeconds:5,
  plantSeconds:5,defuseSeconds:7,fuseSeconds:40,roundBreakSeconds:3,
  siteRadius:3.1,interactRadius:2.45,pickupRadius:2,cellSize:10,cells:16,
  wallHeight:5.75,ceilingHeight:5.7,ceilingThickness:.22,seed:73021,botUseRange:2.1,
  plantHitRecoverySeconds:.9});
var BOMB_TEXT=Object.freeze({
  plant:'Plant bomb here',defuse:'Defuse the bomb',planting:'PLANTING BOMB',defusing:'DEFUSING BOMB',
  planted:'BOMB PLANTED',dropped:'BOMB DROPPED',carrier:'YOU HAVE THE BOMB',picked:'BOMB PICKED UP',
  spectating:'SPECTATING',spectatingPolice:'SPECTATING POLICE',switchView:'LEFT / RIGHT to switch teammate',switchPolice:'LEFT / RIGHT to switch player',noTeam:'NO TEAMMATES ALIVE',
  policeWin:'POLICE WIN THE ROUND',terrorWin:'TERRORISTS WIN THE ROUND',
  explosion:'BOMB DETONATED',defused:'BOMB DEFUSED',round:'ROUND',hold:'HOLD E',
  elimination:'TEAM ELIMINATED',timeout:'TIME EXPIRED',site:'BOMB SITE'});
var BOMB_SITES=[{id:'A',x:-25,z:-5,col:0xffa94d},{id:'B',x:25,z:5,col:0x4dabf7}];
// Rendered furniture must have a grounded, solid body. Small trim/details may be visual only.
// Sizes are kept here so walkability clearance can be adjusted in one place.
var BOMB_PROPS=Object.freeze({inset:3.05,doorClearance:2.8,
  rack:{w:1.85,d:.95,h:2.85},locker:{w:2.3,d:.95,h:2.55},
  desk:{w:2.3,d:1.15,h:1.15},generator:{w:1.85,d:1.25,h:2.7},
  cover:{w:2.3,d:1.55}});
var BOMB_CITY=S.children.filter(function(o){return o.isMesh||o.isGridHelper;});
var BOMB_CITY_OB=OB.slice(),BOMB_CITY_BR=BR.slice(),BOMB_CITY_LT=LT.slice();
var BOMB_WORLD=null,BOMB_OB=[],BOMB_BR=[],BOMB_LT=[],BOMB_FOG=S.fog,BOMB_BACKGROUND=S.background,BOMB_NAV_WALLS=[];
var BOMB_CITY_HALF=A;
var selectedGameMode=0;
function isBombMode(){return selectedGameMode===1;}
// When a full movement step lands a character CENTER inside a Bomb Mode solid,
// push to the nearest outer face. The original TDM collision policy is unchanged.
function bombPushOutOfSolid(p,o,r){
  var left=p.x-(o.x-o.hw),right=(o.x+o.hw)-p.x,
      near=p.z-(o.z-o.hd),far=(o.z+o.hd)-p.z,
      side=Math.min(left,right,near,far);
  if(side===left)p.x=o.x-o.hw-r;
  else if(side===right)p.x=o.x+o.hw+r;
  else if(side===near)p.z=o.z-o.hd-r;
  else p.z=o.z+o.hd+r;
}
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
  // Seal tile seams with a continuous roof backing. Individual ceiling panels have
  // small visual seams; without this slab those seams expose the outdoor sky.
  var roofTop=cfg.ceilingHeight+cfg.ceilingThickness/2;
  mk(step*n,.14,step*n,0x202b35,0,roofTop+.055,0).castShadow=false;
  BOMB_NAV_WALLS=[];
  var zones=[
    {floor:0x5b6772,ceiling:0x303a45,wall:0x293c50,accent:0x4dabf7,label:'SECURITY'},
    {floor:0x64645f,ceiling:0x363a41,wall:0x414851,accent:0xffa94d,label:'WAREHOUSE'},
    {floor:0x5c6861,ceiling:0x33413c,wall:0x304b40,accent:0x69db7c,label:'REACTOR'},
    {floor:0x67616c,ceiling:0x383440,wall:0x45364f,accent:0xb197fc,label:'LABORATORY'}
  ];
  function visualBox(w,hh,d,col,x,y,z){var m=mk(w,hh,d,col,x,y,z);m.castShadow=false;return m;}
  // Thin details use the SAME batched decoration system as Deathmatch. This reduces
  // draw calls and keeps the gameplay collisions on the actual solid furniture bodies.
  function trim(w,hh,d,col,x,y,z){dk(w,hh,d,col,x,y,z);}
  function groundedDetail(w,hh,d,col,x,bottom,z){trim(w,hh,d,col,x,bottom+hh/2,z);}
  // Wall panels are drawn ON solid wall faces (no fake walk-through meshes). A floor-to-
  // ceiling silhouette, contrasting skirting and regularly spaced studs distinguish walls
  // from desks, containers and other collision-enabled props.
  function mapBarrier(x,z,w,d,hh,col,accent){
    wl(x,z,w,d,hh,col);BOMB_NAV_WALLS.push({x:x,z:z,hw:w/2,hd:d/2});
    var longX=w>d,length=Math.max(w,d),face=longX?d/2+.025:w/2+.025;
    groundedDetail(w+.045,.19,d+.045,0x121d29,x,0,z);
    trim(w+.025,.16,d+.025,0xb3c0c9,x,hh-.18,z);
    // Each wall has a readable BOTH-SIDED silhouette. The original wall mesh
    // remains the collider and these thin details never protrude into walkways.
    for(var side=-1;side<=1;side+=2){
      var surface=side*face;
      if(longX){
        trim(w-.12,.22,.035,accent||0x849ba9,x,2.35,z+surface);
        trim(w-.12,.12,.035,0x1c2a35,x,1.0,z+surface);
      }else{
        trim(.035,.22,d-.12,accent||0x849ba9,x+surface,2.35,z);
        trim(.035,.12,d-.12,0x1c2a35,x+surface,1.0,z);
      }
      // Repeated inset wall plates plus continuous steel studs identify solid
      // architecture even when approaching from the reverse side of the room.
      for(var offset=-length/2+.4;offset<length/2-.4;offset+=2.6){
        var section=Math.min(2.35,length/2-.4-offset);
        if(section<=.5)continue;
        if(longX){
          trim(section,1.65,.025,0x3b5260,x+offset+section/2,3.72,z+surface);
          trim(.11,hh-.45,.075,0x91a5b2,x+offset,hh/2,z+surface);
        }else{
          trim(.025,1.65,section,0x3b5260,x+surface,3.72,z+offset+section/2);
          trim(.075,hh-.45,.11,0x91a5b2,x+surface,hh/2,z+offset);
        }
      }
    }
  }
  // A framed industrial passage is still open through the center for A* and players.
  // Side piers have real OB colliders; the lintel is a high LT bullet blocker only.
  function mapPassage(x,z,longX,zone){
    var total=step+.04,gap=5.4,pier=(total-gap)/2,wall=.52;
    if(longX){
      mapBarrier(x-(gap+pier)/2,z,pier,wall,h,zone.wall,zone.accent);
      mapBarrier(x+(gap+pier)/2,z,pier,wall,h,zone.wall,zone.accent);
    }else{
      mapBarrier(x,z-(gap+pier)/2,wall,pier,h,zone.wall,zone.accent);
      mapBarrier(x,z+(gap+pier)/2,wall,pier,h,zone.wall,zone.accent);
    }
    var lintelH=.6,lintelBottom=cfg.ceilingHeight-.88;
    if(longX)trim(gap,lintelH,wall+.05,0x19252e,x,lintelBottom+lintelH/2,z);
    else trim(wall+.05,lintelH,gap,0x19252e,x,lintelBottom+lintelH/2,z);
    LT.push({x:x,z:z,hw:longX?gap/2:(wall+.05)/2,hd:longX?(wall+.05)/2:gap/2,
      y0:lintelBottom,h:lintelBottom+lintelH,c:0x19252e});
    // High-visibility doorway border, mounted to the supporting side piers.
    if(longX){
      trim(.16,3.2,.08,zone.accent,x-gap/2,1.6,z+wall/2+.05);
      trim(.16,3.2,.08,zone.accent,x+gap/2,1.6,z+wall/2+.05);
      trim(gap,.12,.08,zone.accent,x,lintelBottom-.1,z+wall/2+.05);
    }else{
      trim(.08,3.2,.16,zone.accent,x+wall/2+.05,1.6,z-gap/2);
      trim(.08,3.2,.16,zone.accent,x+wall/2+.05,1.6,z+gap/2);
      trim(.08,.12,gap,zone.accent,x+wall/2+.05,lintelBottom-.1,z);
    }
    trim(longX?gap:wall,.04,longX?wall:gap,0xcbd4d9,x,.04,z);
  }
  // No decorative body is allowed to be walk-through. Collision uses the same
  // wl()/OB convention as TDM, so physics, bullets and A* share the geometry.
  function solidFurniture(x,z,dim,col){
    wl(x,z,dim.w,dim.d,dim.h,col);
    groundedDetail(dim.w+.08,.12,dim.d+.08,0x26313a,x,0,z);
  }
  function facilityProps(x,z,i,j,zone){
    var pattern=(i*7+j*11)%9,sgn=(i+j)%2?1:-1,
        inset=BOMB_PROPS.inset,px=x+sgn*inset,pz=z+((i%2)?-1:1)*inset,
        C=0x26313a,steel=0x84939b,dark=0x1a232c;
    if(pattern===0||pattern===7){ // FULLY GROUNDED security rack, ventilated front, powered display strips
      var r=BOMB_PROPS.rack;solidFurniture(px,pz,r,0x293642);
      trim(r.w-.2,r.h-.37,.035,dark,px,r.h*.51,pz+r.d/2+.025);
      for(var a=0;a<5;a++){
        trim(r.w-.43,.055,.045,a===2?zone.accent:steel,px,.4+a*.44,pz+r.d/2+.055);
        trim(.11,.11,.05,0x80ffbc,px+r.w/2-.27,.45+a*.44,pz+r.d/2+.07);
      }
      groundedDetail(.16,r.h,.16,steel,px-r.w/2+.06,0,pz+r.d/2);
      groundedDetail(.16,r.h,.16,steel,px+r.w/2-.06,0,pz+r.d/2);
    }else if(pattern===1||pattern===5){ // Framed storage locker, no unsupported floating shelves
      var l=BOMB_PROPS.locker;solidFurniture(px,pz,l,0x495761);
      groundedDetail(l.w+.04,.17,l.d+.09,steel,px,0,pz);
      for(var a=0;a<3;a++){
        trim(l.w-.18,.07,.06,steel,px,.65+a*.73,pz+l.d/2+.035);
        trim(.12,.4,.07,zone.accent,px-l.w/2+.16,.78+a*.68,pz+l.d/2+.06);
      }
      trim(.09,1.6,.06,0xd0d6d8,px+l.w/2-.24,1.28,pz+l.d/2+.06);
    }else if(pattern===2||pattern===6){ // Floor-mounted generator with silhouette, protective tank and footings
      var g=BOMB_PROPS.generator;solidFurniture(px,pz,g,0x415764);
      groundedDetail(g.w+.24,.22,g.d+.23,C,px,0,pz);
      // Rounded tank cap sits on an actual support body; collision covers its footprint.
      var cylinder=new T.Mesh(new T.CylinderGeometry(.45,.45,1.62,10),
        new T.MeshLambertMaterial({color:pattern===2?0x718d91:0x70877c}));
      cylinder.position.set(px,1.47,pz);cylinder.castShadow=true;S.add(cylinder);
      trim(g.w+.05,.13,g.d+.05,zone.accent,px,2.55,pz);
      for(var a=0;a<3;a++)trim(.32,.14,.06,0xc8d2d6,px-.48+a*.48,.56,pz+g.d/2+.05);
      trim(.15,1.9,.1,dark,px-g.w/2+.13,1.2,pz+g.d/2+.045);
    }else if(pattern===3){ // Existing TDM hazard barrier: registered collision + striped geometry
      var b=BOMB_PROPS.cover;cBar([px,pz,b.w,b.d]);
    }else if(pattern===4){ // Grounded command console with a flush mounted screen housing
      var d=BOMB_PROPS.desk;solidFurniture(px,pz,d,0x586b75);
      trim(d.w+.12,.13,d.d+.12,steel,px,d.h-.03,pz);
      // Screen and support occupy the same collision volume, not free-floating geometry.
      var panelW=1.32,panelH=.76,panelY=d.h+.56;
      trim(.17,.7,.22,dark,px,d.h+.34,pz);
      trim(panelW,panelH,.17,dark,px,panelY,pz);
      trim(panelW-.18,panelH-.19,.02,zone.accent,px,panelY,pz+.105);
      OB.push({x:px,z:pz,hw:panelW/2,hd:.13,h:panelY+panelH/2,y0:d.h+.17,c:dark});
      trim(.14,.09,.05,0x97e0bd,px+.76,d.h-.22,pz+d.d/2+.05);
    }else{ // Existing TDM cargo container: physically solid and detailed, not a plain block
      cBox([px,pz,2.25,1.85]);
    }
  }
  for(j=0;j<n;j++)for(i=0;i<n;i++){
    var x=(i-(n-1)/2)*step,z=(j-(n-1)/2)*step,id=j*n+i;
    // Quadrant palettes give landmarks to navigate by instead of identical gray rooms.
    var sector=(i<n/2?0:1)+(j<n/2?0:2),zone=zones[sector];
    visualBox(step-.16,.07,step-.16,zone.floor,x,.015,z);
    visualBox(step-.10,cfg.ceilingThickness,step-.10,zone.ceiling,x,cfg.ceilingHeight,z);
    // Floor markings and overhead services lead players towards the central objectives.
    if((i+j)%3===0){
      var underRoof=cfg.ceilingHeight-cfg.ceilingThickness/2;
      visualBox(2.8,.08,.82,0x26343c,x,underRoof-.04,z);
      visualBox(2.38,.026,.68,0xcce6ef,x,underRoof-.09,z);
    }
    if((i+j)%4===0){visualBox(.12,.035,step*.65,zone.accent,x-.9,.06,z);
      visualBox(.12,.035,step*.65,zone.accent,x+.9,.06,z);}
    if(i===0)mapBarrier(x-step/2,z,.5,step+.15,h,zone.wall,zone.accent);
    if(j===0)mapBarrier(x,z-step/2,step+.15,.5,h,zone.wall,zone.accent);
    if(i===n-1)mapBarrier(x+step/2,z,.5,step+.15,h,zone.wall,zone.accent);
    if(j===n-1)mapBarrier(x,z+step/2,step+.15,.5,h,zone.wall,zone.accent);
    // Preserve every spanning-tree connection. Some openings now have actual physical
    // jambs and a supported lintel, making doorways recognizable in both 3D and radar.
    if(i<n-1){
      if(!linked(id,id+1)&&random()>.42)mapBarrier(x+step/2,z,.52,step+.03,h,zone.wall,zone.accent);
      else if(linked(id,id+1)&&(i*5+j*3)%4===0)mapPassage(x+step/2,z,false,zone);
    }
    if(j<n-1){
      if(!linked(id,id+n)&&random()>.42)mapBarrier(x,z+step/2,step+.03,.52,h,zone.wall,zone.accent);
      else if(linked(id,id+n)&&(i*3+j*5)%4===0)mapPassage(x,z+step/2,true,zone);
    }
    // Dress every sector differently. The props are decorative, never a hidden maze obstacle.
    var isSite=BOMB_SITES.some(function(q){return Math.hypot(q.x-x,q.z-z)<step*1.3;});
    if(!isSite&&i>0&&j>0&&i<n-1&&j<n-1)facilityProps(x,z,i,j,zone);
    if((i+j)%5===0){ // Roof duct WITH brackets connecting it to the ceiling
      var ductY=cfg.ceilingHeight-.36,roofBase=cfg.ceilingHeight-cfg.ceilingThickness/2;
      trim(step*.58,.23,.36,0x778b96,x,ductY,z-3.3);
      for(var a=-1;a<=1;a+=2){
        trim(.1,roofBase-(ductY+.115)+.02,.16,0xb4bec3,x+a*2,
          (roofBase+ductY+.115)/2,z-3.3);
      }
      trim(.26,.07,.37,zone.accent,x,ductY-.14,z-3.3);
    }
    // Floor-level cabinets act as usable cover without filling central routes.
    if(!isSite&&(i*13+j*17)%11===0&&i>0&&j>0&&i<n-1&&j<n-1){
      var ax=x-3.45,az=z-3.45;
      cBar([ax,az,1.65,1.4]);
    }
  }
  // The continuous overhead slab is a real bullet blocker, like TDM roof lintels,
  // but never a ground obstacle that would invalidate bot navigation.
  LT.push({x:0,z:0,hw:step*n/2,hd:step*n/2,
    y0:cfg.ceilingHeight-cfg.ceilingThickness/2,
    h:roofTop+.125,c:0x303a45});
  flushDeco(); // Batch visual-only details using the unchanged TDM decoration helper.
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
// Activate a single Bomb arena using original OB/BR/LT physics and the same map size.
// Every map owns immutable geometry snapshots. Map swaps invalidate BOT pathfinding.
function selectGameMap(bombActive){
  var id=bombActive?bombMapId(selectedBombMapId):"lockdown",
      town=bombActive&&id==="block-town";
  BOMB_CITY.forEach(function(m){m.visible=!bombActive;});
  if(BOMB_WORLD)BOMB_WORLD.forEach(function(m){m.visible=bombActive&&!town;});
  if(BLOCK_TOWN_WORLD)BLOCK_TOWN_WORLD.forEach(function(m){m.visible=!!town;});
  OB.length=0;BR.length=0;LT.length=0;
  if(bombActive){
    A=BOMB_RULES.cellSize*BOMB_RULES.cells/2;
    bombMapSites(id);
    if(town){
      if(!BLOCK_TOWN_WORLD)makeBlockTown();
      else{Array.prototype.push.apply(OB,BLOCK_TOWN_OB);Array.prototype.push.apply(BR,BLOCK_TOWN_BR);Array.prototype.push.apply(LT,BLOCK_TOWN_LT);}
      S.background=new T.Color(0xa7cde0);S.fog=new T.Fog(0xa7cde0,54,170);
    }else{
      if(!BOMB_WORLD)makeBombMap();
      else{Array.prototype.push.apply(OB,BOMB_OB);Array.prototype.push.apply(BR,BOMB_BR);Array.prototype.push.apply(LT,BOMB_LT);}
      S.background=new T.Color(0x1b2735);S.fog=new T.Fog(0x1b2735,25,95);
    }
  }else{
    A=BOMB_CITY_HALF;
    bombMapSites("lockdown");
    Array.prototype.push.apply(OB,BOMB_CITY_OB);Array.prototype.push.apply(BR,BOMB_CITY_BR);Array.prototype.push.apply(LT,BOMB_CITY_LT);
    S.background=BOMB_BACKGROUND;S.fog=BOMB_FOG;
  }
  GB=null;
}
function bombSpawnPt(team){
  if(bombMapId(selectedBombMapId)==="block-town")return townSpawnPt(team);
  var hist=SPH[team],step=BOMB_RULES.cellSize,candidates=[],z=team?-65:65;
  [-35,-15,-5,5,15,35].forEach(function(x){if(!inObs(x,z,.85)&&!hist.some(function(p){return Math.hypot(p[0]-x,p[1]-z)<5;}))candidates.push([x,z]);});
  var pick=candidates.length?candidates[(Math.random()*candidates.length)|0]:[(Math.random()-.5)*10,z];
  hist.push(pick);return pick;
}
