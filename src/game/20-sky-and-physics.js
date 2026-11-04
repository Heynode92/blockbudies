// ===== sky: gradient dome, blocky sun, voxel clouds, birds, blimp =====
var HZC=0xa6d5f2,SKF=new T.Group(),SKW=new T.Group();S.add(SKF);S.add(SKW);
(function(){var R0=300,geo=new T.SphereGeometry(R0,32,20),pa=geo.attributes.position,ca=new Float32Array(pa.count*3),hz=new T.Color(HZC),zn=new T.Color(0x3d8fdc),mid=new T.Color(0x74b9ee),c=new T.Color(),i,h,t;
  for(i=0;i<pa.count;i++){h=pa.getY(i)/R0;if(h<=0)c.copy(hz);else{t=Math.pow(h,.6);if(t<.5)c.copy(hz).lerp(mid,t*2);else c.copy(mid).lerp(zn,(t-.5)*2);}ca[i*3]=c.r;ca[i*3+1]=c.g;ca[i*3+2]=c.b;}
  geo.setAttribute("color",new T.BufferAttribute(ca,3));
  var dm=new T.Mesh(geo,new T.MeshBasicMaterial({vertexColors:true,side:T.BackSide,fog:false,depthWrite:false}));dm.renderOrder=-10;SKF.add(dm);
  // sun: blocky core + soft glow
  var sd=new T.Vector3(.6,.5,.62).normalize(),cv=document.createElement("canvas");cv.width=cv.height=128;var cx=cv.getContext("2d"),gr2=cx.createRadialGradient(64,64,4,64,64,64);gr2.addColorStop(0,"rgba(255,248,210,1)");gr2.addColorStop(.25,"rgba(255,230,150,.55)");gr2.addColorStop(1,"rgba(255,220,140,0)");cx.fillStyle=gr2;cx.fillRect(0,0,128,128);
  var gl=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(cv),fog:false,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));gl.scale.set(190,190,1);gl.position.copy(sd).multiplyScalar(270);gl.renderOrder=-9;SKF.add(gl);
  var sc2=new T.Mesh(new T.BoxGeometry(20,20,20),new T.MeshBasicMaterial({color:0xfff6c8,fog:false}));sc2.position.copy(sd).multiplyScalar(270);sc2.rotation.set(.5,.7,.2);SKF.add(sc2);
  // clouds
  var cm=new T.MeshLambertMaterial({color:0xffffff,emissive:0x707c88,fog:false}),cg=new T.BoxGeometry(1,1,1),CL=[],ci,bi,cl,nb;
  for(ci=0;ci<20;ci++){cl=new T.Group();nb=4+((Math.random()*4)|0);var bw=14+Math.random()*14,bd=8+Math.random()*7;
    var base=new T.Mesh(cg,cm);base.scale.set(bw,4,bd);cl.add(base);
    for(bi=0;bi<nb;bi++){var m2=new T.Mesh(cg,cm),sw=5+Math.random()*8,sdp=5+Math.random()*5;m2.scale.set(sw,3+Math.random()*3,sdp);m2.position.set((Math.random()-.5)*(bw-sw),3+Math.random()*1.5,(Math.random()-.5)*(bd-sdp));cl.add(m2);}
    var lo=ci>=13;cl.position.set((Math.random()*2-1)*220,lo?32+Math.random()*14:58+Math.random()*38,(Math.random()*2-1)*220);cl.scale.setScalar(lo?.8:1+Math.random()*.6);SKW.add(cl);CL.push({g:cl,v:.9+Math.random()*1.6});}
  SKW.userData.cl=CL;
  // birds
  var BD=[],bi2,fi,bm=new T.MeshLambertMaterial({color:0x2b2f38,fog:false});
  for(fi=0;fi<4;fi++){var R1=38+fi*17,hh=26+fi*7,w1=(fi%2?-1:1)*(.09-fi*.012);
    for(bi2=0;bi2<3;bi2++){var bg=new T.Group(),bd2=new T.Mesh(new T.BoxGeometry(.45,.25,1.1),bm);bg.add(bd2);var wg=[];
      [-1,1].forEach(function(sg){var piv=new T.Group();piv.position.set(sg*.2,.05,0);var wm=new T.Mesh(new T.BoxGeometry(1.8,.07,.65),bm);wm.position.x=sg*.9;piv.add(wm);bg.add(piv);wg.push(piv);});
      SKW.add(bg);BD.push({g:bg,w:wg,R:R1+bi2*3,w1:w1,ph:fi*1.7+bi2*.35,h:hh+bi2*1.6});}}
  SKW.userData.bd=BD;
  // blimp
  var bl=new T.Group(),bmw=new T.MeshLambertMaterial({color:0xf1f3f5,fog:false}),bmo=new T.MeshLambertMaterial({color:0xe8590c,fog:false}),bmg=new T.MeshLambertMaterial({color:0x495057,fog:false});
  function bb(w,h,d,m,x,y,z){var q=new T.Mesh(new T.BoxGeometry(w,h,d),m);q.position.set(x,y,z);bl.add(q);}
  bb(20,7,7,bmw,0,0,0);bb(7,7.3,7.3,bmo,0,0,0);bb(4,5,5,bmw,12,0,0);bb(4,5,5,bmw,-12,0,0);bb(2.4,3,3,bmw,-14.5,0,0);bb(5,.7,10,bmo,-11,0,0);bb(5,10,.7,bmo,-11,0,0);bb(6,1.8,2.6,bmg,0,-4.3,0);bb(1.2,1.5,.6,bmg,0,-3.4,1.5);
  bl.position.set(-250,78,-130);bl.scale.setScalar(1.3);SKW.add(bl);SKW.userData.bl=bl;
})();
// updSky(): animates the sky (clouds, birds, blimp) and keeps the sky dome centered on the camera.
function updSky(dt){var cp=C.position,t=performance.now()/1000,CL=SKW.userData.cl,BD=SKW.userData.bd,bl=SKW.userData.bl,i,b,c;
  SKF.position.copy(cp);
  for(i=0;i<CL.length;i++){c=CL[i];c.g.position.x+=c.v*dt;if(c.g.position.x>240)c.g.position.x=-240;}
  for(i=0;i<BD.length;i++){b=BD[i];var an=b.w1*t+b.ph;b.g.position.set(Math.cos(an)*b.R,b.h+Math.sin(t*.7+b.ph)*1.6,Math.sin(an)*b.R);b.g.rotation.y=Math.atan2(-Math.sin(an)*Math.sign(b.w1),Math.cos(an)*Math.sign(b.w1));var fl=Math.sin(t*9+b.ph*3)*.6;b.w[0].rotation.z=fl;b.w[1].rotation.z=-fl;}
  bl.position.x+=3.2*dt;if(bl.position.x>260)bl.position.x=-260;bl.position.y=78+Math.sin(t*.25)*1.5;}
// inObs(): true if point (x,z) with margin m is inside a solid box in OB. Optional y checks the height range.
function inObs(x,z,m,y){m=m||.1;for(var i=0;i<OB.length;i++){var o=OB[i];if(o.fl||(o.y0&&y===undefined))continue;if(y!==undefined&&(y>o.h||y<(o.y0||0)))continue;if(Math.abs(x-o.x)<o.hw+m&&Math.abs(z-o.z)<o.hd+m)return true;}return false;}
// gh(): ground height at (x,z) for a character whose feet are at y. Lets players step/jump onto boxes (o.st = step-up limit, default .35).
function gh(x,z,y){var g=0;for(var i=0;i<OB.length;i++){var o=OB[i];if(o.h<=y+(o.st||.35)&&Math.abs(x-o.x)<o.hw+.25&&Math.abs(z-o.z)<o.hd+.25)g=Math.max(g,o.h);}return g;}
// Shared physical-map body test: only source-of-truth OB entries are solid.
// The FE game constructs every playable wall/furniture body through wl()/OB.
// Decorative textures, glass tint, road paint and lamps stay visual-only.
// Spatial lookup of canonical OB solids. The array is reused between map
// swaps, so selectGameMap() explicitly invalidates the cache each time.
var solidCollisionCache=null;
function solidCollisionInvalidate(){solidCollisionCache=null;}
function solidCollisionGrid(){
 if(solidCollisionCache&&solidCollisionCache.length===OB.length&&solidCollisionCache.half===A)
  return solidCollisionCache;
 var cell=(2*A)/Math.max(8,Math.ceil(Math.sqrt(OB.length))),
     bins=new Map();
 for(var i=0;i<OB.length;i++){
  var o=OB[i];if(o.fl)continue;
  var ix0=Math.floor((o.x-o.hw+A)/cell),ix1=Math.floor((o.x+o.hw+A)/cell),
      iz0=Math.floor((o.z-o.hd+A)/cell),iz1=Math.floor((o.z+o.hd+A)/cell);
  for(var ix=ix0;ix<=ix1;ix++)for(var iz=iz0;iz<=iz1;iz++){
   var key=ix+','+iz,items=bins.get(key);
   if(items)items.push(o);else bins.set(key,[o]);
  }
 }
 solidCollisionCache={length:OB.length,half:A,cell:cell,bins:bins};
 return solidCollisionCache;
}
function solidPositionBlocked(x,y,z,radius,height){
 if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z)||
    !Number.isFinite(radius)||radius<0)return true;
 if(Math.abs(x)+radius>A||Math.abs(z)+radius>A)return true;
 var h=height===undefined?1.8:height,g=solidCollisionGrid(),
     ix0=Math.floor((x-radius+A)/g.cell),ix1=Math.floor((x+radius+A)/g.cell),
     iz0=Math.floor((z-radius+A)/g.cell),iz1=Math.floor((z+radius+A)/g.cell);
 for(var ix=ix0;ix<=ix1;ix++)for(var iz=iz0;iz<=iz1;iz++){
  var items=g.bins.get(ix+','+iz);
  if(!items)continue;
  for(var i=0;i<items.length;i++){
   var o=items[i];
   if(y+h<=(o.y0||0)||y>=o.h)continue;
   // Match the ORIGINAL offline resolve(): circular player hull vs solid
   // rectangle. Inflating the rectangle by radius on both axes caused
   // invisible corner collisions in tight Bomb Mission corridors.
   var dx=Math.max(0,Math.abs(x-o.x)-o.hw),
       dz=Math.max(0,Math.abs(z-o.z)-o.hd);
   if(radius===0?dx===0&&dz===0:dx*dx+dz*dz<radius*radius)return true;
  }
 }
 return false;
}
// Swept axis-separated translation prevents tunneling through thin walls,
// tables and crates even after one slow frame; the server uses the same step
// policy in moveWithCollision(), but is always authoritative online.
function moveWithSolidCollision(p,dx,dz,radius){
 if(![dx,dz].every(Number.isFinite)||!p||!Number.isFinite(p.y))return;
 var count=Math.max(1,Math.ceil(Math.hypot(dx,dz)/Math.max(.1,radius*.45))),
     sx=dx/count,sz=dz/count;
 for(var i=0;i<count;i++){
  if(!solidPositionBlocked(p.x+sx,p.y,p.z,radius))p.x+=sx;
  if(!solidPositionBlocked(p.x,p.y,p.z+sz,radius))p.z+=sz;
 }
}
// resolve(): pushes entity p (radius r) out of solid boxes so characters cannot walk through walls.
function resolve(p,r){
  p.x=Math.max(-A,Math.min(A,p.x));p.z=Math.max(-A,Math.min(A,p.z));
  OB.forEach(function(o){if(o.fl||(p.y||0)>=o.h-.05||(p.y||0)+1.8<=(o.y0||0))return;var nx=Math.max(o.x-o.hw,Math.min(o.x+o.hw,p.x)),nz=Math.max(o.z-o.hd,Math.min(o.z+o.hd,p.z)),dx=p.x-nx,dz=p.z-nz,d=Math.hypot(dx,dz);
    if(d<r){if(d>0){p.x+=dx/d*(r-d);p.z+=dz/d*(r-d);}else if(isBombMode())bombPushOutOfSolid(p,o,r);else p.x+=r;}});
}
