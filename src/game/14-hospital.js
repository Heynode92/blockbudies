// HOSPITAL — indoor 160x160 Bomb Mission arena from owner's white-block/gray-hall blueprint.
// Independent of Lockdown and Block Town. Data owns all geometry, materials and spawn slots.
// White rectangles are sealed SOLID wings; gray areas are playable medical corridors.
var HOSPITAL_WORLD=null,HOSPITAL_OB=[],HOSPITAL_BR=[],HOSPITAL_LT=[];
var HOSPITAL_DEF=Object.freeze({
 halfSize:BOMB_RULES.cells*BOMB_RULES.cellSize/2,
 ceilingHeight:11.5,wallHeight:10.8,
 palette:Object.freeze({
  floor:0x82959f,wall:0xe1e9ec,trim:0xbccbd2,base:0x506b7b,
  glass:0x376479,deep:0x263e51,blue:0x438ba9,teal:0x4bb8aa,
  green:0x83b9a5,red:0xc95b55,warning:0xd8a85e,white:0xf4f8f7,
  ceiling:0xa5b8c2,steel:0x6d8490,bed:0xc3dae1,linen:0xd4e4df
 }),
 // Top-left PURPLE Police, bottom-right RED Terrorist. Five separated safe slots.
 spawns:Object.freeze({
  police:[[-70,-70],[-69,-65],[-64,-70],[-65,-64],[-71,-60]],
  terrorist:[[67,69],[72,67],[67,75],[73,74],[61,70]]
 }),
 spawnLook:Object.freeze({police:[-65,-36],terrorist:[65,40]}),
 // x,z,w,d,department index: white architectural masses from reference blueprint.
 // These are NOT unlocked wards or fake doorways; active traversal stays in gray corridors.
 wings:Object.freeze([
  [-42,-58,34,26,0],[-8,-49,25,22,1],[59,-71,39,13,2],
  [-42,-32,34,9,0],[-8,-17,25,9,1],[43,-27,24,25,2],
  [28,9,33,13,3],[41,35,46,10,4],[-12,8,26,8,3],
  [-50,28,13,32,4],[-15,46,30,20,4],[28,57,24,10,5],
  [-3,73,13,12,5],[-67,69,23,17,5]
 ]),
 // Actual non-penetrable clinical props. Every [kind,x,z,w,d,h,zone] is one
 // grounded real wl()/OB collider with small raised, non-colliding decorations.
 furniture:Object.freeze([
  ["triage-desk",-67,-43,3,2.3,1.5,0],
  ["stretcher",-68,-18,3,2,1.25,0],
  ["medical-cabinet",-39,-10,2.4,2,2.5,1],
  ["waiting-bench",-31,11,3.8,1.6,1.15,1],
  ["nurse-station",4,8,3,3,2,3],
  ["imaging-machine",-56,48,4,2.6,3.2,4],
  ["linen-storage",-34,34,2.5,1.9,2.6,4],
  ["stretcher",-38,60,3,1.7,1.25,4],
  ["medicine-trolley",15,24,2.6,2,1.65,3],
  ["isolation-cabinet",3,-30,2.5,2,2.6,1],
  ["imaging-console",13,-4,3,2.5,2,3],
  ["security-desk",60,-13,3.5,2.5,2,2],
  ["hospital-bed",65,-30,3,2,1.35,2],
  ["medical-monitor",74,-50,2.2,2,2.4,2],
  ["scrub-cabinet",51,-54,2.3,2,2.4,2],
  ["waiting-bench",52,18,3,1.8,1.15,3],
  ["service-rack",60,50,3,2.5,2.6,5],
  ["linen-storage",42,65,3.3,2.2,2.6,5],
  ["stretcher",10,50,3.2,2,1.25,5],
  ["wheelchair",-65,41,2,2,1.5,4]
 ]),
 // Departments are callouts and palettes only. Plant sites are owned by BOMB_MAP_REGISTRY.
 departments:Object.freeze([
  {name:"EMERGENCY",color:0x5ca99a},
  {name:"PATIENT WARD",color:0x7699b2},
  {name:"OPERATING",color:0x4eb5bd},
  {name:"NURSE STATION",color:0x73b69a},
  {name:"RADIOLOGY",color:0x859dca},
  {name:"SERVICE",color:0xd1ab6e}
 ]),
 // Disjoint zone strips are above floor. No whole-world checkerboard/grid overlay.
 floorGuides:Object.freeze([
  [-70,-39,0,14,0],[-44,-3,14,0,1],[7,-34,0,14,1],
  [61,-40,0,11,2],[49,22,0,13,3],[-64,29,0,14,4],[55,64,0,11,5]
 ]),
 // Actual map-facing scene preview is under the ceiling and within west corridor.
 preview:Object.freeze({x:-67,y:5.2,z:-25,lookX:-61,lookY:2,lookZ:8,fov:73})
});
function hospitalSpawnPt(team){
 var slots=team?HOSPITAL_DEF.spawns.terrorist:HOSPITAL_DEF.spawns.police,
     history=SPH[team],available=slots.filter(function(p){
       return !inObs(p[0],p[1],.85)&&!history.some(function(q){return Math.hypot(p[0]-q[0],p[1]-q[1])<3.7;});
     });
 if(!available.length)available=slots.filter(function(p){return !inObs(p[0],p[1],.85);});
 if(!available.length)throw Error("HOSPITAL: no safe team spawn "+team);
 var point=available[(Math.random()*available.length)|0];
 history.push([point[0],point[1]]);if(history.length>12)history.shift();
 return [point[0],point[1]];
}
function hospitalSpawnYaw(team,x,z){
 var target=team?HOSPITAL_DEF.spawnLook.terrorist:HOSPITAL_DEF.spawnLook.police;
 return Math.atan2(target[0]-x,target[1]-z);
}
function makeHospital(){
 var before=S.children.slice(),d=HOSPITAL_DEF,p=d.palette,half=d.halfSize,
     yRoof=d.ceilingHeight;
 function detail(w,h,dep,color,x,y,z){dk(w,h,dep,color,x,y,z);}
 function wall(x,z,w,dep,h,col){wl(x,z,w,dep,h,col);}
 // Flat, continuous vinyl flooring. All other floor marks sit above its top y=0.
 var floor=mk(2*half,.28,2*half,p.floor,0,-.14,0);floor.castShadow=false;
 // Four solid high perimeter walls (same project wl()/OB collision as other maps).
 var edge=half+.58,span=2*half+1.5;
 [[0,-edge,span,1.2],[0,edge,span,1.2],[-edge,0,1.2,span],[edge,0,1.2,span]]
 .forEach(function(q){
   wall(q[0],q[1],q[2],q[3],d.wallHeight,p.base);
   detail(q[2]+.12,.22,q[3]+.12,p.trim,q[0],d.wallHeight-.18,q[1]);
 });
 // Each blueprint white wing is a single sealed, true 3D obstruction.
 // Clinical facade details sit proud of the real wall, never suggesting a walkable doorway.
 d.wings.forEach(function(b,i){
   var x=b[0],z=b[1],w=b[2],dep=b[3],zone=d.departments[b[4]],
       height=7.7+(i%3)*.4,col=i%5===0?0xcbdce1:p.wall;
   wall(x,z,w,dep,height,col);
   BR.push({x:x,z:z,hw:w/2,hd:dep/2});
   detail(w+.26,.23,dep+.26,p.white,x,height-.16,z);
   detail(w+.40,.32,dep+.40,p.steel,x,height+.18,z);
   detail(w+.11,.30,dep+.11,p.base,x,.24,z);
   // Non-coplanar doorlike clinical panels are labelled SEALED SERVICE doors.
   // These are visually convincing walls, NOT unsupported passageways.
   for(var dir=-1;dir<=1;dir+=2){
     var frontage=z+dir*(dep/2+.13);
     for(var pos=-w/2+2.2;pos<w/2-1.6;pos+=5){
       if(Math.abs(pos)<1.3)continue;
       detail(2.05,1.05,.10,p.base,x+pos,3.15,frontage);
       detail(1.75,.78,.045,p.glass,x+pos,3.17,frontage+dir*.08);
       detail(2.28,.14,.22,zone.color,x+pos,2.56,frontage+dir*.06);
     }
     detail(2.6,3.45,.10,p.deep,x,1.78,frontage);
     detail(2.26,3.08,.045,p.steel,x,1.78,frontage+dir*.08);
     detail(.65,.65,.035,p.glass,x,2.34,frontage+dir*.115);
     detail(.12,.34,.09,p.warning,x+.77,1.44,frontage+dir*.13);
     detail(Math.min(w*.50,9),.55,.14,zone.color,x,5.35,frontage);
     // Distinct service conduit above clinical door; above playable head.
     detail(Math.min(w*.43,7),.13,.21,p.steel,x,6.45,frontage+dir*.07);
   }
   // Side-wall observation windows and wall protection strips.
   for(var side=-1;side<=1;side+=2){
     detail(.09,.45,Math.max(1,dep-1.5),zone.color,x+side*(w/2+.09),3.8,z);
     detail(.09,.28,Math.max(1,dep-1.7),p.base,x+side*(w/2+.11),1.1,z);
     for(var q=-dep/2+3;q<dep/2-2;q+=5.6){
       detail(.10,1.05,2.05,p.base,x+side*(w/2+.11),4.45,z+q);
       detail(.045,.80,1.76,p.glass,x+side*(w/2+.18),4.45,z+q);
     }
   }
   // Roof-visible medical plant / air-handling boxes are fully above the ceiling
   // and therefore don't interfere with indoor collision or player visibility.
 });
 // Hospital props are real grounded cover rather than open corridor clutter.
 // Style detail is batched, and always inside the physical bounding footprint
 // except small hanging components at safe height.
 d.furniture.forEach(function(q,i){
   var kind=q[0],x=q[1],z=q[2],w=q[3],dep=q[4],h=q[5],
       zone=d.departments[q[6]],baseCol=
       /bed|stretcher/.test(kind)?p.bed:
       /bench|wheelchair/.test(kind)?p.steel:
       /imaging/.test(kind)?p.deep:kind==="nurse-station"?p.base:p.trim;
   wall(x,z,w,dep,h,baseCol);
   detail(w+.12,.12,dep+.12,p.steel,x,.12,z);
   if(kind==="hospital-bed"||kind==="stretcher"){
     detail(w-.15,.16,dep-.18,p.white,x,h+.07,z);
     detail(w*.28,.18,dep*.65,p.linen,x-w*.26,h+.18,z);
     detail(.13,.75,dep+.18,p.steel,x-w/2+.09,h-.22,z);
     detail(.13,.75,dep+.18,p.steel,x+w/2-.09,h-.22,z);
     for(var wheel=-1;wheel<=1;wheel+=2)
       detail(.20,.22,.22,p.deep,x+wheel*w*.34,.18,z+dep/2+.06);
   }else if(kind==="wheelchair"){
     detail(w-.3,.16,dep-.25,p.linen,x,h*.65,z);
     detail(w-.22,.16,.18,p.deep,x,h+.12,z-dep*.35);
     for(var wheel=-1;wheel<=1;wheel+=2)
       detail(.22,.70,.75,p.deep,x+wheel*(w/2+.09),.55,z);
   }else if(kind==="nurse-station"||kind==="triage-desk"||kind==="security-desk"){
     detail(w+.18,.19,dep+.17,p.white,x,h+.075,z);
     detail(w*.65,.65,.10,p.deep,x,h+.47,z-dep*.16);
     detail(w*.54,.44,.035,zone.color,x,h+.48,z-dep*.16+.065);
     detail(w*.80,.13,.13,zone.color,x,h*.62,z+dep/2+.08);
   }else if(kind==="imaging-machine"||kind==="imaging-console"){
     detail(w*.76,.26,dep+.12,p.steel,x,h+.12,z);
     detail(w*.55,h*.45,.14,p.deep,x,h*.66,z+dep/2+.075);
     detail(w*.44,h*.29,.05,zone.color,x,h*.67,z+dep/2+.17);
     for(var vent=-1;vent<=1;vent++)
       detail(w*.27,.09,.10,p.trim,x+vent*w*.20,h*.24,z+dep/2+.09);
   }else if(kind==="waiting-bench"){
     detail(w+.08,.16,dep+.07,p.white,x,h+.04,z);
     detail(w+.1,.75,.14,p.base,x,h+.25,z-dep*.40);
     for(var leg=-1;leg<=1;leg+=2)
       detail(.18,.66,.18,p.deep,x+leg*w*.35,.37,z);
   }else{
     detail(w+.10,.14,dep+.12,zone.color,x,h+.08,z);
     for(var shelf=1;shelf<=3;shelf++)
       detail(w*.70,.085,.10,p.white,x,h*shelf/4,z+dep/2+.07);
     detail(w*.28,.18,.065,p.deep,x+w*.22,h*.52,z+dep/2+.09);
   }
 });
 // Architectural wayfinding: colored clinical corridor guides, not floor grid.
 d.floorGuides.forEach(function(q){
   var c=d.departments[q[4]].color;
   detail(q[2]?q[2]:.16,.018,q[3]?q[3]:.16,c,q[0],.055,q[1]);
 });
 // Major department overhead bulkheads and luminous signs. They do not occlude
 // LOS at eye height but make the wayfinding readable in-game.
 [[-67,-32,0],[-8,-32,1],[59,-48,2],[7,18,3],[-63,45,4],[59,55,5]]
 .forEach(function(q){
   var zone=d.departments[q[2]];
   detail(5.6,.72,.30,p.deep,q[0],6.8,q[1]);
   detail(5.1,.50,.045,zone.color,q[0],6.8,q[1]+.20);
   for(var t=-1;t<=1;t++)
     detail(.45,.09,.06,p.white,q[0]+t*1.14,6.8,q[1]+.245);
   // Actual department names are readable and distinct. The sign is an
   // overhead non-solid sprite, never an invisible collision obstacle.
   var canvas=document.createElement("canvas");canvas.width=512;canvas.height=96;
   var signCtx=canvas.getContext("2d");
   signCtx.fillStyle="#233d4c";signCtx.fillRect(0,0,512,96);
   signCtx.fillStyle="#ecf6f5";signCtx.textAlign="center";
   signCtx.font="bold 42px Arial, sans-serif";signCtx.fillText(zone.name,256,62);
   var sign=new T.Sprite(new T.SpriteMaterial({
     map:new T.CanvasTexture(canvas),transparent:true,depthTest:true}));
   sign.position.set(q[0],7.25,q[1]+.30);sign.scale.set(5.3,1.0,1);
   S.add(sign);
 });
 // Smooth luminous ceiling panels cover the sky; physical overhead projectile blocker.
 var roof=mk(half*2,.30,half*2,p.ceiling,0,yRoof,0);roof.castShadow=false;
 LT.push({x:0,z:0,hw:half,hd:half,y0:yRoof-.15,h:yRoof+.15,c:p.ceiling});
 for(var zx=-63;zx<=63;zx+=21)for(var zz=-63;zz<=63;zz+=21){
   // Light positions do not all use the same offset, creating natural ward rhythm.
   var lum=new T.Mesh(new T.BoxGeometry(3.6,.08,1.0),
     new T.MeshBasicMaterial({color:p.white}));
   lum.position.set(zx+(Math.abs(zz)%2?1:0),yRoof-.24,zz);
   lum.castShadow=false;S.add(lum);
 }
 for(var zz=-54;zz<=57;zz+=24){
   detail(100,.22,.20,p.steel,0,yRoof-.59,zz);
   detail(100,.07,.09,p.blue,0,yRoof-.75,zz);
 }
 // Bomb target markers are the SAME canonical siteRadius and in-world sprites
 // as existing Bomb maps. They never become artificial collision objects.
 BOMB_SITES.forEach(function(site){
   var radius=BOMB_RULES.siteRadius;
   var ring=new T.Mesh(new T.RingGeometry(radius-.24,radius,40),
     new T.MeshBasicMaterial({color:site.col,transparent:true,opacity:.84,side:T.DoubleSide,depthWrite:false}));
   ring.rotation.x=-Math.PI/2;ring.position.set(site.x,.13,site.z);S.add(ring);
   var disk=new T.Mesh(new T.CircleGeometry(radius-.35,40),
     new T.MeshBasicMaterial({color:site.col,transparent:true,opacity:.15,side:T.DoubleSide,depthWrite:false}));
   disk.rotation.x=-Math.PI/2;disk.position.set(site.x,.12,site.z);S.add(disk);
   var cv=document.createElement("canvas");cv.width=256;cv.height=128;
   var ctx=cv.getContext("2d");ctx.fillStyle="rgba(24,47,60,.95)";ctx.fillRect(0,0,256,128);
   ctx.fillStyle="#ffffff";ctx.font="bold 84px Impact, sans-serif";ctx.textAlign="center";
   ctx.fillText(site.id,128,94);
   var sign=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(cv),transparent:true,depthTest:true}));
   sign.scale.set(3.2,1.6,1);sign.position.set(site.x,3.3,site.z);S.add(sign);
 });
 flushDeco();
 HOSPITAL_WORLD=S.children.filter(function(item){return before.indexOf(item)<0;});
 HOSPITAL_OB=OB.slice();HOSPITAL_BR=BR.slice();HOSPITAL_LT=LT.slice();
}
