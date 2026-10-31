// BLOCK TOWN - outdoor Bomb Mission arena, same 160x160 footprint and collision API as Lockdown.
// All structures, palette, spawns, site centers and props are declared once in a data definition.
// All surfaces use the original Three.js Lambert mk()/wl() and batched dk()/flushDeco().
var BOMB_MAP_REGISTRY=Object.freeze({
  lockdown:Object.freeze({id:"lockdown",name:"LOCKDOWN",caption:"Indoor Tactical Arena",
    sites:Object.freeze([{id:"A",x:-25,z:-5,col:0xffa94d},{id:"B",x:25,z:5,col:0x4dabf7}])}),
  "block-town":Object.freeze({id:"block-town",name:"BLOCK TOWN",caption:"Outdoor Urban Town",
    sites:Object.freeze([{id:"A",x:55,z:-58,col:0xffa94d},{id:"B",x:-16,z:8,col:0x4dabf7}]),
    preview:Object.freeze({x:12,y:47,z:35,lookX:0,lookY:0,lookZ:-12,fov:74})})
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
 // Reuse the original Deathmatch four-wall enclosure pattern at this map's scale.
 // Walls sit just OUTSIDE [-halfSize,halfSize] so the existing A* grid stays clear.
 perimeter:Object.freeze({height:9.5,thickness:1.2,color:0x71818b,skylineOffset:3.6,
   facadeDepth:3.4,facadeSpacing:18,facadeMinHeight:12,facadeHeightStep:2.4}),
 spawnLook:Object.freeze({police:[-69,-72],terrorist:[45,45]}),
 // Render/view limit is map-only; weapon damage, projectile travel and other
 // maps retain their authoritative rules. All real 3D cover is tested below.
 visibility:Object.freeze({near:30,far:70,haze:0xa7c9d6,eyeHeight:1.7,
   auditGrid:3,auditDegrees:6}),
 palette:Object.freeze({
   road:0x59636a,stone:0xc3b9a6,walk:0x908b7e,curb:0xa4a29a,
   plaster:[0xc49c74,0xa8b3ac,0xd2b59b,0x99b3bf,0xb5a19a,0xc2b17b,0x8da8a0],
   roof:[0x733e31,0x495762,0x856145,0x59645f],
   glass:0x355269,frame:0xe0d7c5,wood:0x59483c,metal:0x536773,
   foliage:0x69805e,foliage2:0x4f6d56,accent:0xd6a05a
 }),
 // V3 replaces the OLD map footprint with the owner's latest top-down blueprint:
 // purple Police entrance at WEST-NORTH, red Terrorist entrance at SOUTH-EAST;
 // A site NORTH-EAST, B site in the CENTRAL-SOUTH intersection.
 // Coordinate conversion: 640px diagram maps to 160 gameplay world units.
 // One-way corridors are NEVER permitted; all large white masses are solid.
 spawns:Object.freeze({
   police:[[-72,-55],[-72,-49],[-72,-43],[-72,-37],[-72,-31]],
   terrorist:[[45,70],[50,74],[45,75],[61,70],[59,75]]
 }),
 // x,z,w,depth,storeys,paletteIndex: asymmetric obstacle masses,
 // including the original illustrated upper-left L (two touching solids).
 buildings:Object.freeze([
  [-35,-46,58,36,2,0],[-54,-18,20,20,2,2],
  [28,-74,33,10,2,3],[17,-35,14,18,3,1],[40,-39,12,12,2,6],
  [58,-13,44,32,3,4],
  [-17,-7,23,19,2,5],[17,-7,14,18,2,1],
  [-50,23,10,43,2,3],[-75,41,8,74,2,4],
  [-17,29,23,31,2,0],[36,29,53,31,3,6],
  [-40,61,29,11,2,5],[14,61,46,11,2,2],[58,61,10,11,2,1]
 ]),
 // Real walls split long vistas at street corners, following existing wl/OB.
 walls:Object.freeze([
  [-56,-3,2,5,2.8],[2,-22,3.5,2,2.7],[27,-58,1.5,5,3.1],
  [69,-36,1.7,6,3],[18,7,6,1.5,2.5],[-37,51,3,2,2.7]
 ]),
 // A-site = commercial courtyard; B-site = service street.
 // Cover islands are distributed to break long LOS, with free flanking lanes.
 cover:Object.freeze([
  [-42,6,4,3],[0,9,3,3],[28,7,3.5,3.2],[68,8,4,3],
  [31,-49,3.5,4],[56,-47,3,3],[64,-65,3,3],
  [-32,8,4,3],[-3,9,3,3],[-63,13,4,3],[-39,24,4,3],
  [0,28,3,3],[71,25,3,3],[-62,56,4,3],[44,51,4,3]
 ]),
 trees:Object.freeze([[-70,-17],[-63,17],[-64,68],[70,-57],[68,53],[0,-56],[4,48]]),
 // Non-overlapping, entirely decorative asphalt-side plazas. World foundation
 // remains ONE continuous solid-free road plane; different Y tiers avoid flicker.
 paving:Object.freeze([
  [54,-57,31,23,0],[-15,8,26,10,0],[-71,-46,11,33,1],
  [-62,17,11,24,1],[68,49,17,12,1],[47,71,18,10,1]
 ]),
 streetMarks:Object.freeze([[-56,-34,1,8],[-44,42,1,8],[2,-41,1,9],[67,17,1,8],[40,52,8,1]]),
 // Measured V4 sightline occluders, not a runtime camera/weapon range hack.
 // Each [name,x,z,w,d,h] is a 3m+ physical OBJ/OB solid. Staggered footprints
 // allow clean routes around the obstacle while blocking long street vistas.
 // Test grid: 3 world-unit sample spacing, 6-degree rays from eyeHeight=1.7;
 // physical line-of-sight at the sampled positions cannot exceed far=70.
 sightlineBreakers:Object.freeze([
  ["north-freight",-25,-69,12,8,3.6],
  ["north-cabinet",16,-64,9,8,3],
  ["west-cabinet",-67,0,9,10,3],
  ["west-parked",-65.5,54,10,9,3],
  ["south-freight",-20,70,10,8,3.6],
  ["south-cabinet",16,72,9,12,3],
  ["east-van",72,33,8,10,3],
  ["east-box",71,-52,8,9,3],
  ["center-utility",0,-47,9,8,3.6],
  ["east-mid",47,8,9,8,3],
  ["north-west",-70,-68,7,7,3],
  ["lowerwest-utility",-56,67,8,8,3],
  ["center-south",-4,51,12,14,3.6],
  ["mid-center",6,33,6,8,3],
  ["mid-split",7,-4,6,8,3],
  ["mid-north",4,-28,6,8,3],
  ["north-cargo",-39,-73,8,7,3.6],
  ["north-cross",24,-55,8,7,3],
  ["mid-yard",24,12,7,6,3],
  ["west-yard",-44,12,7,6,3],
  ["north-service",-6,-65,8,7,3.6],
  ["lower-mid",1,14,6,7,3],
  ["mid-east-knife",42,-30,8,8,3],
  ["mid-east-gap",23,5,9,10,3],
  ["west-corner",-75,-12,5,9,3.6],
  ["west-south-blind",-33,16,6,11,3],
  ["west-northgate",-53,-73,8,7,3],
  ["south-westgate",-22,75,9,5,3],
  ["north-site-shield",34,-60,9,16,3.6],
  ["mid-close",4,-20,7,7,3],
  ["east-outlet",65,33,7,8,3],
  ["center-split",-1,-12,6,8,3],
  ["west-inner-gate",-68,-11,9,8,3.6],
  ["southeast-rotate",47,49,8,8,3],
  ["east-inlet",29,-23,8,8,3],
  ["north-mid-cab",44,-46,7,8,3],
  ["west-rail",-47,47,8,7,3.6]
 ]),
 // Site A commercial loading and B-side service alley landmarks: both are
 // collidable, registered cover and use original Lambert-material primitives.
 landmarks:Object.freeze([
  {kind:"delivery-van",x:43,z:-58,w:8,d:3.6,h:2.3},
  {kind:"street-kiosk",x:-36,z:15,w:4,d:3.2,h:2.8}
 ]),
 plazaFeature:Object.freeze({x:-43,z:-3,width:3,depth:3,height:1.25})

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
// Spawn orientation uses the player's canonical yaw convention:
 // ground forward vector = (sin(yaw), cos(yaw)).
function bombMapSpawnYaw(team,x,z){
 if(!isBombMode()){
   if(tdmMapId(selectedTdmMapId)==="block-labs")return labsSpawnYaw(team,x,z);
   return team?0:Math.PI;
 }
 if(bombMapId(selectedBombMapId)!=="block-town")return team?0:Math.PI;
 var def=BLOCK_TOWN_DEF.spawnLook,goal=team?def.terrorist:def.police;
 return Math.atan2(goal[0]-x,goal[1]-z);
}
function makeBlockTown(){
 var before=S.children.slice(),d=BLOCK_TOWN_DEF,c=d.palette,half=d.halfSize;
 // Single street foundation, at ground y=0. Unlike V1 there are no coplanar
 // paving rectangles. Decoration on its own height tier never writes physics.
 var base=mk(half*2,.28,half*2,c.road,0,-.14,0);base.castShadow=false;
 function detail(w,h,dep,color,x,y,z){dk(w,h,dep,color,x,y,z);}
 function wall(x,z,w,dep,h,color){wl(x,z,w,dep,h,color);}
 // TDM source-of-truth creates FOUR outer mk() walls at A+0.5. Bomb hides
 // the TDM scene, so Block Town must own its own four VISIBLE solid walls.
 // These share its original OB collision API and are cached with BLOCK_TOWN_WORLD.
 (function perimeterShell(){
   var p=d.perimeter,h=p.height,th=p.thickness,off=half+th/2+.02,span=half*2+th*2;
   [[0,-off,span,th],[0,off,span,th],[-off,0,th,span],[off,0,th,span]].forEach(function(q,i){
     wall(q[0],q[1],q[2],q[3],h,i%2?shade(p.color,.91):p.color);
     // The cornice and base have distinct heights to avoid coincident faces.
     detail(q[2]+.14,.22,q[3]+.14,c.frame,q[0],h+.105,q[1]);
     detail(q[2]+.10,.19,q[3]+.10,shade(p.color,.70),q[0],.11,q[1]);
   });
   // Skyline storefront/roof silhouettes behind the physical shell. These
   // non-collidable facades are OUTSIDE the arena, not fake internal cover.
   var lane=0;
   for(var distance=-half+12;distance<half-7;distance+=p.facadeSpacing){
     for(var side=0;side<4;side++){
       var facingZ=side<2,sgn=(side%2)?1:-1,
           sx=facingZ?distance:sgn*(half+p.skylineOffset),
           sz=facingZ?sgn*(half+p.skylineOffset):distance,
           height=p.facadeMinHeight+((lane+side*2)%4)*p.facadeHeightStep,
           width=p.facadeSpacing-2.6,depth=p.facadeDepth,
           color=c.plaster[(lane+side*3)%c.plaster.length],
           bw=facingZ?width:depth,bd=facingZ?depth:width;
       var silhouette=mk(bw,height,bd,color,sx,height/2,sz);
       silhouette.castShadow=false;
       detail(bw+.4,.42,bd+.4,c.roof[(lane+side)%c.roof.length],sx,height+.21,sz);
       // Raised contrasting facade trim is decorative and far behind shell.
       for(var floor=1;floor<height/3.55;floor++)for(var n=-width/2+2;n<width/2-1;n+=3.5){
         var front=half+p.skylineOffset-p.facadeDepth/2-.09;
         if(facingZ)detail(1.45,1.2,.08,c.glass,sx+n,1.55+floor*3.1,sgn*front);
         else detail(.08,1.2,1.45,c.glass,sgn*front,1.55+floor*3.1,sz+n);
       }
     }
     lane++;
   }
 })();
 // Each pavement region is disjoint from all other pavement regions.
 // Distinct Y tiers (foundation 0, pavement .05, paint .09) prevent z-fighting.
 d.paving.forEach(function(p){
   var slab=mk(p[2],.04,p[3],p[4]===0?c.stone:c.walk,p[0],.03,p[1]);
   slab.castShadow=false;
 });
 // Building silhouettes share the gameplay-collider body but differ in architectural
 // vocabulary: shopfront, pitched-roof home, warehouse, office, cafe and rowhouse.
 function facadePane(ns,sgn,x,z,center,y,w,col,trimCol,style){
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
   var x=q[0],z=q[1],w=q[2],dep=q[3],kind=i%4,
       // Preserve the original V1 cBox/cBar collision height precisely.
       h=i%2===0?2.4:1.3,
       body=kind===0?c.wood:kind===1?c.stone:kind===2?c.metal:c.curb;
   wall(x,z,w,dep,h,body);
   detail(w+.08,.12,dep+.08,shade(body,.70),x,.085,z);
   if(kind===0){ // stacked shop-delivery crates, 2.4 m solid footprint
     for(var a=1;a<4;a++)
       detail(w+.09,.095,dep+.13,shade(body,a%2?.84:.67),x,a*h/4,z);
     detail(.15,h,.15,c.metal,x-w/2+.12,h/2,z+dep/2-.1);
     detail(.15,h,.15,c.metal,x+w/2-.12,h/2,z+dep/2-.1);
     detail(w+.12,.16,dep+.1,c.wood,x,h+.05,z);
   }else if(kind===1){ // knee-high civic concrete planter
     detail(w+.12,.18,dep+.12,c.frame,x,h-.04,z);
     detail(w-.34,.12,dep-.34,c.wood,x,h+.09,z);
     for(var a=-1;a<=1;a++)
       detail(.35,.42,.35,c.foliage,x+a*w*.22,h+.29,z);
   }else if(kind===2){ // tall 2.4 m municipal equipment cabinet / delivery container
     detail(w+.18,.16,dep+.14,0x344a51,x,h+.04,z);
     for(var k=0;k<3;k++)detail(w*.72,.10,.09,c.frame,x,.6+k*.57,z+dep/2+.045);
     detail(.15,h-.3,.13,c.frame,x-w/2+.18,h/2,z+dep/2+.075);
     detail(.15,h-.3,.13,c.frame,x+w/2-.18,h/2,z+dep/2+.075);
   }else{ // 1.3m masonry traffic barricade, not a full concrete block
     detail(w+.13,.12,dep+.15,c.frame,x,h+.05,z);
     detail(w-.2,.16,.095,0xe3af69,x,h*.65,z+dep/2+.058);
   }
 });
 // Staggered town cover is not decorative camouflage: every body uses wl()/OB,
 // which controls bullets, player collision and BOT A*. The varying upper
 // architecture is rendered in original batched Lambert materials (dk()).
 d.sightlineBreakers.forEach(function(q,i){
   var name=q[0],x=q[1],z=q[2],w=q[3],dep=q[4],h=q[5],
       type=i%5,body=type===0?0x566975:type===1?0x647780:
         type===2?0xa08b79:type===3?0x72807d:0x5a7867,
       trimCol=type===2?c.frame:type===4?c.foliage:c.metal;
   wall(x,z,w,dep,h,body);
   // Perimeter panels are offset in depth to avoid coplanar surfaces/flicker.
   detail(w+.16,.18,dep+.16,shade(body,.74),x,.11,z);
   if(type===0){
     // Delivery van/mini-bus, visually long but physically one solid vehicle.
     detail(w+.27,.20,dep+.22,0x2a3944,x,h+.10,z);
     detail(w*.30,.43,dep+.14,c.glass,x-w*.24,h-.28,z);
     for(var side=-1;side<=1;side+=2){
       detail(w*.56,.34,.09,0x2b4654,x+w*.05,h*.64,z+side*(dep/2+.065));
       for(var axle=-1;axle<=1;axle+=2){
         detail(.76,.92,.17,0x262d31,x+axle*w*.32,.47,z+side*(dep/2+.10));
         detail(.32,.32,.19,0xaab4b6,x+axle*w*.32,.47,z+side*(dep/2+.20));
       }
       detail(w*.48,.14,.10,c.accent,x,h*.36,z+side*(dep/2+.08));
     }
   }else if(type===1){
     // City electrical substation / HVAC utility cabinet.
     detail(w+.22,.20,dep+.20,0x334953,x,h+.06,z);
     detail(w*.66,1.22,.11,0x354956,x,h*.60,z+dep/2+.09);
     for(var j=-2;j<=2;j++)
       detail(w*.50,.075,.12,c.frame,x,h*.60+j*.16,z+dep/2+.16);
     detail(.42,.42,.12,0xe5b35f,x+w*.28,h*.44,z+dep/2+.16);
   }else if(type===2){
     // Brick-sided roadwork storage pod with an overhead safety awning.
     detail(w+.34,.24,dep+.34,0x765446,x,h+.12,z);
     detail(w*.76,h*.45,.11,0x504843,x,h*.56,z+dep/2+.08);
     for(var j=-1;j<=1;j++)detail(w*.19,.19,.13,c.accent,x+j*w*.26,h*.58,z+dep/2+.17);
     detail(w*.92,.18,.55,0x384954,x,h*.89,z+dep/2+.26);
   }else if(type===3){
     // Town security cabin / roadside maintenance kiosk.
     detail(w+.55,.22,dep+.48,0x314c54,x,h+.16,z);
     detail(w*.64,h*.32,.10,c.glass,x,h*.58,z+dep/2+.08);
     detail(.12,h*.35,dep*.57,c.frame,x+w/2+.09,h*.54,z);
     detail(w*.66,.16,.35,c.wood,x,h*.35,z+dep/2+.22);
     detail(w*.42,.47,.12,0xe2bc71,x,h+.45,z+dep/2+.08);
   }else{
     // Dense civic hedge / solid planting island as tall visual LOS breaker.
     detail(w+.25,.26,dep+.22,c.stone,x,h*.23,z);
     detail(w-.24,h*.62,dep-.24,c.foliage,x,h*.67,z);
     for(var j=-2;j<=2;j++)
       detail(w*.12,.32,dep*.37,j%2?c.foliage2:c.foliage,
         x+j*w*.15,h+.12,z+(j%2?-.14:.14));
   }
 });
 // Recognizable, useful urban cover. Exact bounding volumes are defined in
 // BLOCK_TOWN_DEF; no graphical vehicle/booth is secretly walk-through.
 d.landmarks.forEach(function(item){
   var x=item.x,z=item.z,w=item.w,dep=item.d,h=item.h;
   if(item.kind==="delivery-van"){
     wall(x,z,w,dep,h,0x657b84);
     detail(w+.20,.20,dep+.20,0x2f4655,x,h+.08,z);
     // Driver cab, raised glazing and cargo bands sit on the solid chassis.
     detail(w*.24,.48,dep-.24,0x263c4b,x-w*.28,h+.36,z);
     detail(.10,.8,dep-.34,c.glass,x-w*.30,h-.16,z);
     for(var side=-1;side<=1;side+=2){
       detail(w*.32,.54,.09,c.glass,x-w*.24,h-.51,z+side*(dep/2+.065));
       detail(w*.36,.13,.10,0xf0c77d,x+w*.17,1.05,z+side*(dep/2+.075));
       for(var axle=-1;axle<=1;axle+=2){
         var wheel=new T.Mesh(new T.CylinderGeometry(.56,.56,.24,10),
           new T.MeshLambertMaterial({color:0x222b32}));
         wheel.rotation.x=Math.PI/2;
         wheel.position.set(x+axle*w*.31,.56,z+side*(dep/2+.11));
         wheel.castShadow=false;S.add(wheel);
       }
     }
     detail(.13,.36,1.1,0xe3b868,x+w/2+.12,1.22,z);
   }else if(item.kind==="street-kiosk"){
     wall(x,z,w,dep,h,0x9a795a);
     detail(w+.75,.21,dep+.85,0x2f5a5c,x,h+.20,z);
     detail(w-.25,1.20,.11,0x294b55,x,1.66,z+dep/2+.10);
     detail(w-.40,.11,.35,0xdec399,x,1.02,z+dep/2+.20);
     detail(w*.75,.47,.16,0xe7c379,x,h+.52,z+dep/2+.12);
     for(var side=-1;side<=1;side+=2)
       detail(.18,h,.18,c.metal,x+side*(w/2-.22),h/2,z+dep/2+.17);
   }
 });
 // Small service-street fountain/utility island. Map data owns its new location;
 // the collider is exactly the stone pedestal rather than a hidden extra wall.
 var feature=d.plazaFeature;
 wall(feature.x,feature.z,feature.width,feature.depth,feature.height,c.stone);
 detail(feature.width+.35,.17,feature.depth+.35,c.frame,feature.x,feature.height,feature.z);
 detail(1.15,.42,1.15,0x6b9ca7,feature.x,feature.height+.25,feature.z);
 detail(.55,.64,.55,c.stone,feature.x,feature.height+.6,feature.z);
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
