// BLOCK LABS — data-driven 120x120 indoor Team Deathmatch arena.
// The owner blueprint is authoritative: Police NORTH, Terrorist SOUTH, six
// impassable lab blocks, left/center/right lanes, perimeter and green reactors.
// The map is independent from Block District, Lockdown and Block Town.
var TDM_MAP_REGISTRY=Object.freeze({
 "block-district":Object.freeze({id:"block-district",name:"BLOCK DISTRICT",caption:"Outdoor Urban Combat"}),
 "block-labs":Object.freeze({id:"block-labs",name:"BLOCK LABS",caption:"Indoor Research Facility",
   preview:Object.freeze({x:-38,y:21,z:30,lookX:0,lookY:2,lookZ:0,fov:72})})
});
var selectedTdmMapId="block-district",BLOCK_LABS_WORLD=null,BLOCK_LABS_OB=[],BLOCK_LABS_BR=[],BLOCK_LABS_LT=[];
function tdmMapId(value){return Object.prototype.hasOwnProperty.call(TDM_MAP_REGISTRY,value)?value:"block-district";}
function tdmMapInfo(value){return TDM_MAP_REGISTRY[tdmMapId(value)];}
function tdmMapOptions(){return [TDM_MAP_REGISTRY["block-district"],TDM_MAP_REGISTRY["block-labs"]];}
var BLOCK_LABS_DEF=Object.freeze({
 halfSize:60,
 ceilingHeight:11.7,
 wallHeight:10.8,
 palette:Object.freeze({floor:0x4f6069,floorBorder:0x83949c,wall:0xb6c2c8,wallDark:0x435866,
  white:0xe2e9eb,metal:0x748995,glass:0x2e556d,accent:0x26b99a,
  light:0xbbeaff,trim:0x293e4b,hazard:0xe4b956,reactor:0x50d76b,
  police:0x2676d5,terrorist:0xb4393c,ceiling:0x293640}),
 // x,z,w,d — no holes or fake doors in the 6 massive white blueprint blocks.
 blocks:Object.freeze([
   [-19.5,-29,29,24], [19.5,-29,29,24],
   [-19.5,0,29,16],   [19.5,0,29,16],
   [-19.5,29,29,24],  [19.5,29,29,24]
 ]),
 // Real, grounded green reactor assemblies at the 4 corner corridors and
 // two mid connectors. Radius must allow navigable clearance in side lanes.
 reactors:Object.freeze([[-44,-41,3.0],[44,-41,3.0],[-44,41,3.0],[44,41,3.0],[0,-12.5,1.3],[0,12.5,1.3]]),
 // Walls that project from outer boundary like the brown notches in blueprint.
 perimeterReturns:Object.freeze([[-55,-12,9,1.4],[-55,25,9,1.4],[55,-14,9,1.4],[55,21,9,1.4]]),
 spawns:Object.freeze({
   police:[[-28,-52],[-19,-54],[-10,-52],[18,-54],[28,-52]],
   terrorist:[[-28,52],[-19,54],[-10,52],[18,54],[28,52]]
 }),
 spawnLook:Object.freeze({police:[0,-24],terrorist:[0,24]})
});
function labsSpawnPt(team){
 var slots=team?BLOCK_LABS_DEF.spawns.terrorist:BLOCK_LABS_DEF.spawns.police,
     hist=SPH[team],free=slots.filter(function(q){
       return !inObs(q[0],q[1],.85)&&!hist.some(function(p){return Math.hypot(q[0]-p[0],q[1]-p[1])<3.8;});
     });
 if(!free.length)free=slots.filter(function(q){return !inObs(q[0],q[1],.85);});
 if(!free.length)throw Error("BLOCK LABS: no safe spawn slot for "+team);
 var v=free[Math.floor(Math.random()*free.length)];hist.push([v[0],v[1]]);
 if(hist.length>10)hist.shift();return [v[0],v[1]];
}
function labsSpawnYaw(team,x,z){
 // Same canonical game yaw: forward on XZ = (sin(face),cos(face)).
 var look=team?BLOCK_LABS_DEF.spawnLook.terrorist:BLOCK_LABS_DEF.spawnLook.police;
 return Math.atan2(look[0]-x,look[1]-z);
}
function makeBlockLabs(){
 var before=S.children.slice(),cfg=BLOCK_LABS_DEF,p=cfg.palette,h=cfg.ceilingHeight,
     A0=cfg.halfSize;
 function trim(w,hh,d,col,x,y,z){dk(w,hh,d,col,x,y,z);}
 function wall(x,z,w,d,hh,col){wl(x,z,w,d,hh,col);}
 // One continuous floor; no checkerboard overlay or coplanar pavement (Town regression).
 var base=mk(A0*2,.3,A0*2,p.floor,0,-.15,0);base.castShadow=false;
 // Physical perimeter exactly at the arena boundary. Roof and all decorative
 // hardware sit overhead and therefore do not block ground BOT A*.
 var edge=A0+.52,span=A0*2+1.6;
 [[0,-edge,span,1.2],[0,edge,span,1.2],[-edge,0,1.2,span],[edge,0,1.2,span]]
  .forEach(function(q,i){
    wall(q[0],q[1],q[2],q[3],cfg.wallHeight,p.wallDark);
    trim(q[2]+.08,.23,q[3]+.08,p.metal,q[0],cfg.wallHeight-.20,q[1]);
  });
 cfg.perimeterReturns.forEach(function(q,i){
   wall(q[0],q[1],q[2],q[3],4.4,p.wallDark);
   trim(q[2]+.12,.15,q[3]+.12,p.hazard,q[0],4.4,q[1]);
 });
 // Distinct wall modules. All six rooms are NON-ENTERABLE, so every white
 // blueprint rectangle and door-like facade remains real solid collision.
 cfg.blocks.forEach(function(b,i){
   var x=b[0],z=b[1],w=b[2],d=b[3],height=7.4+(i%3)*.28;
   wall(x,z,w,d,height,p.wall);
   BR.push({x:x,z:z,hw:w/2,hd:d/2});
   trim(w+.28,.26,d+.28,p.white,x,height-.16,z);
   trim(w+.35,.42,d+.35,p.trim,x,height+.18,z);
   trim(w+.48,.18,d+.48,p.metal,x,.24,z);
   // Horizontal exterior service lines and dark window panels on solid walls.
   for(var side=-1;side<=1;side+=2){
     trim(w-1.2,.32,.10,p.glass,x,4.75,z+side*(d/2+.10));
     trim(.10,.32,d-1.2,p.glass,x+side*(w/2+.10),4.75,z);
     for(var xOff=-w/2+3;xOff<w/2-2;xOff+=5.5){
       trim(2.2,.92,.08,p.glass,x+xOff,2.9,z+side*(d/2+.13));
       trim(2.44,.12,.24,p.metal,x+xOff,2.36,z+side*(d/2+.12));
     }
     // Readable sealed lab access panel: visual only, never a fake doorway.
     var doorX=x+(i%2?4:-4);
     trim(2.3,3.1,.13,p.trim,doorX,1.66,z+side*(d/2+.13));
     trim(1.8,2.5,.14,p.metal,doorX,1.65,z+side*(d/2+.18));
     trim(.16,.85,.17,p.hazard,doorX+.59,1.69,z+side*(d/2+.26));
     trim(2.9,.20,.32,p.hazard,doorX,3.38,z+side*(d/2+.22));
   }
   // Heavy wall ribs on far sides are visually anchored (no fake collision).
   for(var off=-d/2+2;off<d/2-1;off+=5){
     trim(.15,5.4,.35,p.metal,x+w/2+.1,3.55,z+off);
     trim(.15,5.4,.35,p.metal,x-w/2-.1,3.55,z+off);
   }
 });
 // Green objects are real solid research reactors: grounded octagonal collars
 // inside the bounding hitbox, no invisible obstacle and no fake uncollidable shell.
 cfg.reactors.forEach(function(q,i){
   var x=q[0],z=q[1],rad=q[2],height=i<4?3.3:2.2,diam=rad*2;
   wall(x,z,diam,diam,height,p.trim);
   trim(diam+.32,.22,diam+.32,p.metal,x,.16,z);
   trim(diam+.34,.20,diam+.34,p.metal,x,height-.15,z);
   var tube=new T.Mesh(new T.CylinderGeometry(rad*.58,rad*.68,height*.65,8),
     new T.MeshLambertMaterial({color:p.reactor,emissive:0x0d4218,transparent:false}));
   tube.position.set(x,height*.53,z);tube.castShadow=false;S.add(tube);
   for(var arm=0;arm<4;arm++){
     var v=arm*Math.PI/2;
     trim(.19,height,.19,p.metal,x+Math.cos(v)*(rad-.15),height/2,z+Math.sin(v)*(rad-.15));
   }
   trim(diam+.32,.13,.22,p.hazard,x,height+.035,z);
 });
 // Overhead floor-ceiling system covers outdoor sky even when looking up.
 var roof=mk(A0*2, .30,A0*2,p.ceiling,0,h,0);
 roof.castShadow=false;
 LT.push({x:0,z:0,hw:A0,hd:A0,y0:h-.15,h:h+.15,c:p.ceiling});
 // Laboratory cross-corridor luminaires and utility rails, above head height.
 for(var zz=-45;zz<=45;zz+=15){
   var fixture=new T.Mesh(new T.BoxGeometry(2.2,.08,.65),
     new T.MeshBasicMaterial({color:p.light}));
   fixture.position.set(0,h-.28,zz);fixture.castShadow=false;S.add(fixture);
 }
 for(var xx of [-44,44])for(var zz=-45;zz<=45;zz+=15){
   var fixture=new T.Mesh(new T.BoxGeometry(2.4,.08,.7),
     new T.MeshBasicMaterial({color:p.light}));
   fixture.position.set(xx,h-.28,zz);fixture.castShadow=false;S.add(fixture);
 }
 for(var zz of [-12,12]){
   trim(A0*1.6,.22,.16,p.metal,0,h-.46,zz);
   trim(A0*1.6,.11,.08,p.hazard,0,h-.65,zz);
 }
 // Floor zone signs are elevated and not z-fighting: floor top=0, stripe y=.055.
 for(var x of [-42,0,42]){
   for(var zz=-43;zz<46;zz+=18){
     trim(.10,.014,4,p.floorBorder,x,.057,zz);
   }
 }
 trim(56,.018,1,p.police,0,.061,-48.5);
 trim(56,.018,1,p.terrorist,0,.061,48.5);
 // Industrial wall accents communicate spawn areas and team orientation.
 trim(48,1.05,.16,p.police,0,6.1,-A0+.88);
 trim(48,1.05,.16,p.terrorist,0,6.1,A0-.88);
 flushDeco();
 BLOCK_LABS_WORLD=S.children.filter(function(o){return before.indexOf(o)<0;});
 BLOCK_LABS_OB=OB.slice();BLOCK_LABS_BR=BR.slice();BLOCK_LABS_LT=LT.slice();
}
