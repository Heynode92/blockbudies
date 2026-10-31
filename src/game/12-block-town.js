// BLOCK TOWN - outdoor Bomb Mission arena, same 160x160 footprint and collision API as Lockdown.
// All structures, palette, spawns, site centers and props are declared once in a data definition.
// All surfaces use the original Three.js Lambert mk()/wl() and batched dk()/flushDeco().
var BOMB_MAP_REGISTRY=Object.freeze({
  lockdown:Object.freeze({id:"lockdown",name:"LOCKDOWN",caption:"Indoor Tactical Arena",
    sites:Object.freeze([{id:"A",x:-25,z:-5,col:0xffa94d},{id:"B",x:25,z:5,col:0x4dabf7}])}),
  "block-town":Object.freeze({id:"block-town",name:"BLOCK TOWN",caption:"Outdoor Urban Town",
    sites:Object.freeze([{id:"A",x:-44,z:-39,col:0xffa94d},{id:"B",x:49,z:-37,col:0x4dabf7}])})
});
var selectedBombMapId="lockdown",BLOCK_TOWN_WORLD=null,BLOCK_TOWN_OB=[],BLOCK_TOWN_BR=[],BLOCK_TOWN_LT=[];
function bombMapId(value){return Object.prototype.hasOwnProperty.call(BOMB_MAP_REGISTRY,value)?value:"lockdown";}
function bombMapInfo(value){return BOMB_MAP_REGISTRY[bombMapId(value)];}
function bombMapOptions(mode){return mode===1?[BOMB_MAP_REGISTRY.lockdown,BOMB_MAP_REGISTRY["block-town"]]:[];}
function bombMapSites(id){
  var sites=bombMapInfo(id).sites;
  BOMB_SITES.length=0;sites.forEach(function(q){BOMB_SITES.push({id:q.id,x:q.x,z:q.z,col:q.col});});
}
var BLOCK_TOWN_DEF=Object.freeze({
 halfSize:BOMB_RULES.cellSize*BOMB_RULES.cells/2,
 palette:Object.freeze({
   road:0x59636a,stone:0xc3b9a6,walk:0x908b7e,curb:0xa4a29a,
   plaster:[0xc49c74,0xa8b3ac,0xd2b59b,0x99b3bf,0xb5a19a,0xc2b17b,0x8da8a0],
   roof:[0x733e31,0x495762,0x856145,0x59645f],
   glass:0x355269,frame:0xe0d7c5,wood:0x59483c,metal:0x536773,
   foliage:0x69805e,foliage2:0x4f6d56,accent:0xd6a05a
 }),
 // First 5 slots in each team are distinct and safe. Police controls A-side courtyard.
 spawns:Object.freeze({
   police:[[-61,-54],[-67,-55],[-55,-59],[-62,-63],[-70,-63]],
   terrorist:[[-38,64],[-44,69],[-32,69],[-37,74],[-47,75]]
 }),
 // x,z,width,depth,storeys(visual),paletteIndex; all buildings are *solid* 1-level exterior blocks.
 // Streets form an offset loop, rather than symmetrical lanes or a procedural maze.
 buildings:Object.freeze([
  [-69,-19,14,20,2,0],[-21,-34,20,24,3,1],[2,-59,16,16,2,2],
  [27,-61,20,15,2,3],[69,-55,15,24,3,4],
  [-70,18,16,20,2,5],[-31,8,21,21,2,3],
  [7,-7,20,25,3,0],[37,9,22,21,2,2],[70,14,15,18,3,6],
  [-70,42,16,17,2,4],[-6,46,23,18,2,5],
  [37,48,24,17,3,1],[69,60,14,16,2,0],
  [-15,-71,16,12,2,6],[7,70,15,13,2,4],
  [55,-5,12,15,2,5]
 ]),
 // Permanent real collisions used by actual projectiles, player movement and A*.
 // Short offset sightline breakers; neither spawn pair has a straight LOS.
 walls:Object.freeze([
  [-49,4,11,1.5,2.7],[-48,-12,7,1.5,2.1], // bent A main
  [-5,-30,11,1.5,2.5],[46,26,10,1.5,2.7], // broken mid / B approach
  [60,-19,1.5,9,2.9]
 ]),
 // x,z,w,d: available cover at entrances, not inside the 3.1-unit planting circle.
 cover:Object.freeze([
  [-51,-31,3.2,2.3],[-34,-50,3,2.3],[-38,-21,2.7,2],
  [58,-48,3.5,2.4],[40,-48,2.9,2.5],[50,-23,3,2.1],
  [-53,31,3,2],[-12,18,2.6,2.3],[24,24,3,2.1],[49,40,3,2]
 ]),
 trees:Object.freeze([[-75,-40],[-60,0],[-58,58],[-12,25],[23,28],[60,58],[74,-32]]),
 streetMarks:Object.freeze([[-50,38,2,10],[-50,20,2,7],[0,25,7,2],[25,-27,8,2],[48,-5,2,9]])
});
function townSpawnPt(team){
 var slots=team?BLOCK_TOWN_DEF.spawns.terrorist:BLOCK_TOWN_DEF.spawns.police;
 var hist=SPH[team],free=slots.filter(function(p){
   return !inObs(p[0],p[1],.9)&&!hist.some(function(h){return Math.hypot(h[0]-p[0],h[1]-p[1])<4.5;});
 });
 if(!free.length)free=slots.filter(function(p){return !inObs(p[0],p[1],.9);});
 if(!free.length)throw Error("BLOCK TOWN: blocked team spawn "+team);
 var p=free[(Math.random()*free.length)|0];hist.push([p[0],p[1]]);return[p[0],p[1]];
}
function makeBlockTown(){
 var before=S.children.slice(),d=BLOCK_TOWN_DEF,c=d.palette,half=d.halfSize,materials=c.plaster;
 // Existing engine geometry functions preserve performance/material consistency.
 mk(half*2,.14,half*2,c.road,0,-.12,0).castShadow=false;
 function detail(w,h,dep,color,x,y,z){dk(w,h,dep,color,x,y,z);}
 function wall(x,z,w,dep,h,color){wl(x,z,w,dep,h,color);}
 function building(b,idx){
   var x=b[0],z=b[1],w=b[2],dep=b[3],story=b[4],
     h=story*3.55+1,col=materials[b[5]],roof=c.roof[idx%c.roof.length];
   wall(x,z,w,dep,h,col);
   BR.push({x:x,z:z,hw:w/2,hd:dep/2});
   detail(w+.35,.5,dep+.35,roof,x,h+.24,z);
   detail(w+.55,.23,dep+.55,lite(col,.19),x,h-.12,z);
   detail(w+.18,.33,dep+.18,shade(col,.73),x,.2,z);
   for(var side=0;side<4;side++){
     var ns=side<2,sgn=side%2?1:-1,length=ns?w:dep,at=(ns?dep:w)/2+.045;
     // A solid facade, not a fake enterable doorway.
     for(var level=0;level<story;level++)for(var along=-length/2+2;along<=length/2-1.6;along+=3.4){
       var y=2.1+level*3.55,px=ns?x+along:x+sgn*at,
           pz=ns?z+sgn*at:z+along;
       if(ns){detail(1.75,1.65,.08,c.frame,px,y,pz);detail(1.49,1.37,.09,c.glass,px,y,pz+sgn*.055);
         detail(1.9,.17,.25,shade(col,.78),px,y-.89,pz+sgn*.11);
         detail(.12,1.35,.12,c.frame,px,y,pz+sgn*.11);}
       else{detail(.08,1.65,1.75,c.frame,px,y,pz);detail(.09,1.37,1.49,c.glass,px+sgn*.055,y,pz);
         detail(.25,.17,1.9,shade(col,.78),px+sgn*.11,y-.89,pz);
         detail(.12,1.35,.12,c.frame,px+sgn*.11,y,pz);}
     }
   }
   // Grounded shop shutters and awnings; all trim has visual-only dimensions.
   if(idx%3===0){
     var front=z+dep/2+.075;
     detail(Math.min(w-2.2,5.6),2.25,.11,c.metal,x,1.32,front);
     detail(Math.min(w-1.8,6),.19,1.15,c.roof[(idx+1)%c.roof.length],x,3.1,front+.55);
   }
   if(idx%2===0){
     detail(Math.min(w-1.5,5),.65,.22,c.wood,x,h+.7,z);
     detail(.3,1.05,.3,c.metal,x-1.2,h+1.22,z);
   }
 }
 d.buildings.forEach(building);
 // Courtyard and town streets: curved layout is achieved by offset block footprints,
 // not a gridded maze. Streets carry physical low barricades at genuine intersections.
 d.walls.forEach(function(q,i){
   wall(q[0],q[1],q[2],q[3],q[4],i%2?c.metal:c.stone);
   detail(q[2]+.12,.17,q[3]+.12,c.frame,q[0],q[4]+.08,q[1]);
 });
 d.cover.forEach(function(q,i){
   if(i%2===0)cBox([q[0],q[1],q[2],q[3]]);
   else cBar([q[0],q[1],q[2],q[3]]);
 });
 // Small central plaza, fountain base is a true solid collider.
 wall(-11,26,3,3,1.25,c.stone);
 detail(3.5,.16,3.5,c.frame,-11,1.34,26);
 // Trees: trunk is grounded collision, high canopy is purely visual overhead.
 d.trees.forEach(function(t,i){
   wall(t[0],t[1],.62,.62,3.5,c.wood);
   var crown=new T.Mesh(new T.IcosahedronGeometry(2.65,0),
     new T.MeshLambertMaterial({color:i%2?c.foliage:c.foliage2}));
   crown.position.set(t[0],5.2,t[1]);crown.castShadow=true;S.add(crown);
 });
 d.streetMarks.forEach(function(q){
   detail(q[2],.035,q[3],c.curb,q[0],.045,q[1]);
 });
 // Two site markers preserve the original placement/defuse UI and affordance.
 BOMB_SITES.forEach(function(site){
   var radius=BOMB_RULES.siteRadius;
   var ring=new T.Mesh(new T.RingGeometry(radius-.24,radius,40),
     new T.MeshBasicMaterial({color:site.col,transparent:true,opacity:.88,side:T.DoubleSide,depthWrite:false}));
   ring.rotation.x=-Math.PI/2;ring.position.set(site.x,.11,site.z);S.add(ring);
   var disk=new T.Mesh(new T.CircleGeometry(radius-.35,40),
     new T.MeshBasicMaterial({color:site.col,transparent:true,opacity:.15,side:T.DoubleSide,depthWrite:false}));
   disk.rotation.x=-Math.PI/2;disk.position.set(site.x,.09,site.z);S.add(disk);
   var canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
   var ctx=canvas.getContext('2d');ctx.fillStyle='rgba(7,15,27,.91)';ctx.fillRect(0,0,256,128);
   ctx.fillStyle='#fff';ctx.font='bold 84px Impact, sans-serif';ctx.textAlign='center';ctx.fillText(site.id,128,94);
   var sign=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(canvas),transparent:true,depthTest:true}));
   sign.scale.set(3.2,1.6,1);sign.position.set(site.x,3.3,site.z);S.add(sign);
 });
 flushDeco();
 BLOCK_TOWN_WORLD=S.children.filter(function(o){return before.indexOf(o)<0;});
 BLOCK_TOWN_OB=OB.slice();BLOCK_TOWN_BR=BR.slice();BLOCK_TOWN_LT=LT.slice();
}
