// BLOCK TOWN - outdoor Bomb Mission arena, same 160x160 footprint and collision API as Lockdown.
// All structures, palette, spawns, site centers and props are declared once in a data definition.
// All surfaces use the original Three.js Lambert mk()/wl() and batched dk()/flushDeco().
var BOMB_MAP_REGISTRY=Object.freeze({
  lockdown:Object.freeze({id:"lockdown",name:"LOCKDOWN",caption:"Indoor Tactical Arena",
    sites:Object.freeze([{id:"A",x:-25,z:-5,col:0xffa94d},{id:"B",x:25,z:5,col:0x4dabf7}])}),
  "block-town":Object.freeze({id:"block-town",name:"BLOCK TOWN",caption:"Outdoor Urban Town",
    sites:Object.freeze([{id:"A",x:-44,z:-39,col:0xffa94d},{id:"B",x:49,z:-37,col:0x4dabf7}]),
    preview:Object.freeze({x:-28,y:32,z:49,lookX:-8,lookY:0,lookZ:-27,fov:70})})
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
 var before=S.children.slice(),d=BLOCK_TOWN_DEF,c=d.palette,half=d.halfSize;
 // Single street foundation, at ground y=0. Unlike V1 there are no coplanar
 // paving rectangles. Decoration on its own height tier never writes physics.
 var base=mk(half*2,.28,half*2,c.road,0,-.14,0);base.castShadow=false;
 function detail(w,h,dep,color,x,y,z){dk(w,h,dep,color,x,y,z);}
 function wall(x,z,w,dep,h,color){wl(x,z,w,dep,h,color);}
 // Each pavement region is disjoint from all other pavement regions.
 // Distinct Y tiers (foundation 0, pavement .05, paint .09) prevent z-fighting.
 var paving=[
  [-49,-40,33,31,c.stone],[49,-37,34,29,c.stone],
  [-43,26,23,32,c.walk],[7,20,24,21,c.walk],[34,-9,21,24,c.walk],
  [-38,64,29,18,c.walk],[55,47,23,21,c.stone]
 ];
 paving.forEach(function(p){
   var slab=mk(p[2],.04,p[3],p[4],p[0],.03,p[1]);
   slab.castShadow=false;
 });
 // Building silhouettes share the gameplay-collider body but differ in architectural
 // vocabulary: shopfront, pitched-roof home, warehouse, office, cafe and rowhouse.
 function facadePane(ns,sgn,x,z,center,y,w,col,trimCol,style){
   var at=ns?z+sgn*(center+.035):x+sgn*(center+.035),uu=0;
   // Dark recess, pane, sash and sill occupy successive NON-COPLANAR depth tiers.
   var bw=style===2?1.1:1.5,bh=style===3?1.7:1.37;
   function plane(width,height,depth,paint,offset,yy){
     if(ns)detail(width,height,depth,paint,w,yy,z+sgn*(center+offset));
     else detail(depth,height,width,paint,x+sgn*(center+offset),yy,w);
   }
   plane(bw+.25,bh+.25,.07,shade(col,.52),.09,y);
   plane(bw,bh,.04,c.glass,.155,y);
   plane(.095,bh,.045,trimCol,.205,y);
   plane(bw+.48,.14,.35,trimCol,.19,y-bh/2-.17);
   if(style===1||style===4){
     plane(bw*.7,.14,.29,0x637b53,.27,y-bh/2-.03);
     plane(.18,.23,.19,c.foliage,.32,y-bh/2+.03);
   }
 }
 function building(b,idx){
   var x=b[0],z=b[1],w=b[2],dep=b[3],stories=b[4],
       style=idx%6,h=stories*3.55+1,
       col=c.plaster[b[5]],roof=c.roof[(idx+style)%c.roof.length],
       windowTrim=style===2?c.metal:c.frame;
   // Original solid footprint remains the only walkable-level obstruction.
   wall(x,z,w,dep,h,col);
   BR.push({x:x,z:z,hw:w/2,hd:dep/2});
   // Plinth, staggered cornice and vertical corner pillars differentiate silhouettes.
   detail(w+.16,.24,dep+.16,shade(col,.68),x,.16,z);
   for(var q=-1;q<=1;q+=2){
     detail(.27,h-.7,.27,shade(col,.82),x+q*(w/2-.18),h/2,z+dep/2-.18);
   }
   detail(w+.3,.24,dep+.3,lite(col,.13),x,h-.12,z);
   if(style===1||style===5){
     // Pitched two-slope town roofs, made of actual Three.js surfaces, at roof height.
     // Roof overhangs are >6m above the street and cannot be used as walk-through cover.
     for(var side=-1;side<=1;side+=2){
       var plate=mk(w/2+1,.24,dep+1.2,roof,x+side*w/4,
         h+.86,z);
       plate.rotation.z=-side*.29;plate.castShadow=false;
     }
     detail(dep*.25,1.3,dep*.14,0x8b7665,x-w*.28,h+1.65,z);
   }else{
     detail(w+.85,.39,dep+.85,roof,x,h+.28,z);
     if(style===2){
       detail(w*.33,1,dep*.27,c.metal,x+w*.16,h+1.01,z-dep*.12);
     }else{
       detail(w+.55,.26,.3,shade(roof,.64),x,h+.66,z-dep/2);
       detail(w+.55,.26,.3,shade(roof,.64),x,h+.66,z+dep/2);
       detail(.3,.26,dep+.55,shade(roof,.64),x-w/2,h+.66,z);
       detail(.3,.26,dep+.55,shade(roof,.64),x+w/2,h+.66,z);
     }
   }
   // Windows stop short of the building corners. Storefront and warehouse first
   // storeys use shutter/facade instead of repeating identically on every level.
   for(var side=0;side<4;side++){
     var ns=side<2,sgn=side%2?1:-1,length=ns?w:dep,
         center=ns?dep/2:w/2,spacing=style===2?3.5:style===1?3.65:3.2;
     for(var level=0;level<stories;level++){
       var yy=2.1+level*3.55;
       if(level===0&&(style===0||style===2||style===4)&&side===1)continue;
       for(var off=-length/2+2.3;off<=length/2-1.6;off+=spacing){
         if(ns)facadePane(true,sgn,x,z,center,yy,x+off,col,windowTrim,style);
         else facadePane(false,sgn,x,z,center,yy,z+off,col,windowTrim,style);
       }
     }
   }
   // Street-facing shop details. The anchored shutters are attached to real walls.
   var front=z+dep/2+.08,storeW=Math.min(w-3,style===2?7.5:5.5);
   if(style===0||style===2||style===4){
     detail(storeW,2.5,.14,style===2?0x68747c:c.wood,x,1.37,front);
     var shadeCol=style===4?0xb55339:style===0?0x3e7b73:c.metal;
     detail(storeW+.65,.20,1.20,shadeCol,x,3.14,front+.53);
     detail(storeW-.55,.12,.16,c.frame,x,2.38,front+.17);
     for(var strip=-storeW/2+.5;strip<storeW/2;strip+=.55)
       detail(.045,1.85,.035,shade(c.metal,.74),x+strip,1.30,front+.10);
     // Raised shop name plaque; lettering is visual geometry, not gameplay UI.
     detail(storeW*.74,.62,.15,style===4?0xf5cf83:0x315166,x,3.55,front+.09);
     for(var stripe=-1;stripe<=1;stripe++)
       detail(storeW*.16,.075,.17,c.frame,x+stripe*storeW*.21,3.55,front+.19);
   }else if(style===1||style===5){
     detail(1.85,2.55,.14,c.wood,x,1.36,front);
     detail(2.2,.15,.28,c.frame,x,2.73,front+.12);
     detail(.18,.18,.19,0xe5bd72,x+.56,1.38,front+.19);
   }else{
     detail(storeW*.65,2.15,.12,0x38444d,x,1.21,front);
     detail(storeW*.8,.18,.62,c.metal,x,2.65,front+.26);
   }
   // Downpipes/vents give depth to side elevations without introducing fake cover.
   if(idx%3===0){
     detail(.15,h-.8,.15,c.metal,x+w/2+.09,h/2,z+dep/2-.8);
     for(var v=1;v<stories;v++)
       detail(w*.39,.12,.20,shade(col,.69),x,h*.12+v*3.55,z+dep/2+.16);
   }
 }
 d.buildings.forEach(building);
 // Existing tactical sightline blockers stay collidable, but look like permanent
 // brick/stone privacy walls instead of anonymous naked cubes.
 d.walls.forEach(function(q,i){
   var col=i%2?c.metal:c.stone;
   wall(q[0],q[1],q[2],q[3],q[4],col);
   detail(q[2]+.18,.19,q[3]+.18,c.frame,q[0],q[4]+.075,q[1]);
   if(q[2]>q[3])for(var k=-q[2]/2+1;k<q[2]/2;k+=2.2)
     detail(.18,q[4]-.4,.08,shade(col,.68),q[0]+k,q[4]/2,q[1]+q[3]/2+.055);
 });
 // Every gameplay-scale prop has a real collision body, unlike visual window trim.
 // Shapes are grounded urban planters, concrete low walls, dumpsters or stacked crates.
 d.cover.forEach(function(q,i){
   var x=q[0],z=q[1],w=q[2],dep=q[3],kind=i%4,h=kind===1?1.45:1.28,
       body=kind===0?c.stone:kind===1?c.metal:kind===2?c.wood:c.curb;
   wall(x,z,w,dep,h,body);
   detail(w+.08,.12,dep+.08,shade(body,.70),x,.085,z);
   if(kind===0){ // concrete planter, with grounded soil and low leaves
     detail(w+.12,.18,dep+.12,c.frame,x,h-.04,z);
     detail(w-.34,.12,dep-.34,c.wood,x,h+.09,z);
     for(var a=-1;a<=1;a++)
       detail(.35,.42,.35,c.foliage,x+a*w*.22,h+.29,z);
   }else if(kind===1){ // urban dumpster, with trim and lid
     detail(w+.18,.16,dep+.14,0x344a51,x,h+.04,z);
     detail(w*.55,.17,.07,c.frame,x,h*.55,z+dep/2+.045);
     detail(.12,.65,.12,0x222b30,x-w/2+.18,.85,z+dep/2+.085);
   }else if(kind===2){ // low stacked wooden pallets / delivery crates
     for(var a=-1;a<=1;a++)detail(w-.22,.095,dep+.10,shade(body,a===0?.72:.86),x,.4+a*.29,z);
     detail(.15,h,.15,c.metal,x-w/2+.12,h/2,z+dep/2-.1);
     detail(.15,h,.15,c.metal,x+w/2-.12,h/2,z+dep/2-.1);
   }else{ // stone traffic barricade
     detail(w+.13,.12,dep+.15,c.frame,x,h+.05,z);
     detail(w-.2,.16,.095,0xe3af69,x,h*.65,z+dep/2+.058);
   }
 });
 // Central plaza fountain: old solid body preserved, now has a layered rim and
 // upright stone centerpiece anchored entirely on the same footprint.
 wall(-11,26,3,3,1.25,c.stone);
 detail(3.4,.17,3.4,c.frame,-11,1.25,26);
 detail(1.15,.42,1.15,0x6b9ca7,-11,1.5,26);
 detail(.55,.64,.55,c.stone,-11,1.85,26);
 // Existing registered tree-trunk colliders remain unchanged.
 d.trees.forEach(function(t,i){
   wall(t[0],t[1],.62,.62,3.5,c.wood);
   var crown=new T.Mesh(new T.IcosahedronGeometry(2.65,0),
     new T.MeshLambertMaterial({color:i%2?c.foliage:c.foliage2}));
   crown.position.set(t[0],5.2,t[1]);crown.castShadow=true;S.add(crown);
   // Decorative iron protective ring fits entirely within the true trunk collider.
   detail(.64,.24,.64,c.metal,t[0],.28,t[1]);
 });
 // Sparse street paint, each strip sits clearly ABOVE the asphalt and avoids
 // coplanar paving slabs. No full-world GridHelper or noisy chessboard roads.
 d.streetMarks.forEach(function(q,i){
   detail(q[2],.015,q[3],i%2?0xe0c99b:0xd7c6a8,q[0],.093,q[1]);
 });
 // Site signage remains physically at the exact canonical plantable centers.
 BOMB_SITES.forEach(function(site){
   var radius=BOMB_RULES.siteRadius;
   var ring=new T.Mesh(new T.RingGeometry(radius-.24,radius,40),
     new T.MeshBasicMaterial({color:site.col,transparent:true,opacity:.88,side:T.DoubleSide,depthWrite:false}));
   ring.rotation.x=-Math.PI/2;ring.position.set(site.x,.14,site.z);S.add(ring);
   var disk=new T.Mesh(new T.CircleGeometry(radius-.35,40),
     new T.MeshBasicMaterial({color:site.col,transparent:true,opacity:.15,side:T.DoubleSide,depthWrite:false}));
   disk.rotation.x=-Math.PI/2;disk.position.set(site.x,.13,site.z);S.add(disk);
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
