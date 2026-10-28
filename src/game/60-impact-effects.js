// ---- BULLET MARKS, WALL DAMAGE, DEBRIS, CAMERA SHAKE ----
// DC = bullet-hole decals, CH = flying debris chunks, cs = camera-shake springs {k pitch, y yaw, r roll, s strength}.
// ---- bullet marks, cracks, debris, camera shake ----
var DC=[],CH=[],DCMAX=150,CHMAX=90,cs={k:0,s:0,kv:0,y:0,yv:0,r:0,rv:0};
// rr(): random float in [a, b).
function rr(a,b){return a+Math.random()*(b-a);}
// crk(): draws one branching crack line on a canvas context (used for wall damage textures).
function crk(g,x,y,a,len,w,al,dp){g.strokeStyle="rgba(0,0,0,"+al+")";g.lineWidth=w;g.beginPath();g.moveTo(x,y);var n=Math.max(3,Math.round(len/7)),st=len/n,br=[];
  for(var i=0;i<n;i++){a+=rr(-.32,.32);x+=Math.cos(a)*st;y+=Math.sin(a)*st;g.lineTo(x,y);if(dp<2&&i>0&&i<n-1&&Math.random()<.28)br.push([x,y,a]);}
  g.stroke();br.forEach(function(q){crk(g,q[0],q[1],q[2]+(Math.random()<.5?-1:1)*rr(.5,1),len*rr(.25,.45),w*.7,al*.85,dp+1);});}
// blob(): draws an irregular blob shape (used for chipped/damaged patches).
function blob(g,r){g.beginPath();for(var i=0;i<9;i++){var a=i/9*6.283,q=r*rr(.7,1.15),px=Math.cos(a)*q,py=Math.sin(a)*q;if(i)g.lineTo(px,py);else g.moveTo(px,py);}g.closePath();}
// mkDecalTex(kind): procedurally draws a decal texture on a canvas ("hole" bullet hole or "chip" chipped paint). No image files.
function mkDecalTex(kind){
  var c=document.createElement("canvas");c.width=c.height=128;var g=c.getContext("2d");g.translate(64,64);g.lineCap="round";g.lineJoin="round";var i,a,n;
  if(kind==="scorch"){var gr=g.createRadialGradient(0,0,4,0,0,62);gr.addColorStop(0,"rgba(0,0,0,.78)");gr.addColorStop(.55,"rgba(10,8,6,.5)");gr.addColorStop(1,"rgba(0,0,0,0)");g.fillStyle=gr;g.beginPath();g.arc(0,0,62,0,6.283);g.fill();
    for(i=0;i<10;i++){a=rr(0,6.283);crk(g,Math.cos(a)*20,Math.sin(a)*20,a,rr(14,34),1.4,.5,0);}}
  else{
    var hl=g.createRadialGradient(0,0,5,0,0,44);hl.addColorStop(0,"rgba(238,232,220,.5)");hl.addColorStop(1,"rgba(238,232,220,0)");g.fillStyle=hl;g.beginPath();g.arc(0,0,44,0,6.283);g.fill();
    if(kind==="chip"){g.fillStyle="rgba(22,19,16,.55)";blob(g,rr(24,32));g.fill();g.fillStyle="rgba(236,230,216,.6)";blob(g,rr(15,20));g.fill();g.fillStyle="rgba(12,10,8,.9)";blob(g,rr(6,10));g.fill();}
    n=kind==="chip"?Math.round(rr(9,13)):Math.round(rr(5,8));
    for(i=0;i<n;i++){a=i/n*6.283+rr(-.4,.4);crk(g,Math.cos(a)*7,Math.sin(a)*7,a,kind==="chip"?rr(36,58):rr(22,52),kind==="chip"?1.8:1.5,.62,0);}
    if(kind!=="chip"){var hr=rr(7,9);g.fillStyle="rgba(10,10,10,.95)";g.beginPath();g.arc(0,0,hr,0,6.283);g.fill();g.strokeStyle="rgba(255,255,255,.28)";g.lineWidth=1.5;g.beginPath();g.arc(0,0,hr+1.2,0,6.283);g.stroke();}}
  return new T.MeshBasicMaterial({map:new T.CanvasTexture(c),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
}
var TXH=[mkDecalTex("hole"),mkDecalTex("hole"),mkDecalTex("hole")],TXC=[mkDecalTex("chip"),mkDecalTex("chip")],TXS=mkDecalTex("scorch"),dcG=new T.PlaneGeometry(1,1),bw={x:0,z:0,hw:A,hd:A,h:3,c:0x7a8aa0,dm:0};
// obsAt(): true if point (x,y,z) is inside any solid box (bullet-vs-wall point test).
function obsAt(x,z,y){for(var i=0;i<OB.length;i++){var o=OB[i];if(o.fl||y>o.h||y<(o.y0||0))continue;if(Math.abs(x-o.x)<o.hw+.1&&Math.abs(z-o.z)<o.hd+.1)return o;}return null;}

// ---- SWEPT COLLISION: bullets are tested along the segment they travelled, so fast bullets can never skip through thin walls. ----
// ---- FIX: swept collision so bullets can never skip through a wall ----
// sweepObs(): true if the segment (x0,y0,z0)->(x1,y1,z1) hits any solid box in OB.
function sweepObs(x0,y0,z0,x1,y1,z1){var i,o,m=.1,bx0=Math.min(x0,x1)-m-1,bx1=Math.max(x0,x1)+m+1,bz0=Math.min(z0,z1)-m-1,bz1=Math.max(z0,z1)+m+1,e={x:0,z:0,hw:0,hd:0,h:0,y0:0};
  for(i=0;i<OB.length;i++){o=OB[i];if(o.fl)continue;if(o.x+o.hw<bx0||o.x-o.hw>bx1||o.z+o.hd<bz0||o.z-o.hd>bz1)continue;
    e.x=o.x;e.z=o.z;e.hw=o.hw+m;e.hd=o.hd+m;e.h=o.h;e.y0=o.y0||0;if(segBox(e,x0,y0,z0,x1,y1,z1))return o;}
  return null;}
// sweepLT(): same as sweepObs() but for LT (overhead lintels and roofs).
function sweepLT(x0,y0,z0,x1,y1,z1){for(var i=0;i<LT.length;i++){var o=LT[i];if(segBox(o,x0,y0,z0,x1,y1,z1))return o;}return null;}
// los(): exact line-of-sight test between two ground points at height y (default 1.3). Used by bots to decide if they can see a target.
// exact line-of-sight (old version sampled every 1.2 units and could skip thin walls)
function los(x0,z0,x1,z1,y){y=y||1.3;var i,o,e={x:0,z:0,hw:0,hd:0,h:0,y0:0};
  for(i=0;i<OB.length;i++){o=OB[i];if(o.fl||y>o.h||y<(o.y0||0))continue;
    e.x=o.x;e.z=o.z;e.hw=o.hw+.1;e.hd=o.hd+.1;e.h=o.h+1;e.y0=(o.y0||0)-1;
    if(Math.abs(x0-o.x)<e.hw&&Math.abs(z0-o.z)<e.hd)continue;
    if(segBox(e,x0,y,z0,x1,y,z1))return false;}
  return true;}
// clearTo(): splash/melee reachability check; skips the first bit near the start because explosions sit on the wall face.
// splash/melee line check: ignores the first bit near the start (blast point sits on the wall face)
function clearTo(x0,z0,x1,z1,skip){var n=Math.ceil(Math.hypot(x1-x0,z1-z0)/.2),i,d=Math.hypot(x1-x0,z1-z0);
  for(i=1;i<n;i++){if(d*i/n<(skip||0))continue;if(obsAt(x0+(x1-x0)*i/n,z0+(z1-z0)*i/n,1.0))return false;}return true;}
// segBox(): segment-vs-box intersection (slab method). Returns hit info (entry t and hit face axis/sign) or null.
function segBox(o,x0,y0,z0,x1,y1,z1){var tn=0,tx=1,ax=-1,sg=0,d=[x1-x0,y1-y0,z1-z0],lo=[o.x-o.hw,o.y0||0,o.z-o.hd],hi=[o.x+o.hw,o.h,o.z+o.hd],q=[x0,y0,z0];
  for(var k=0;k<3;k++){if(Math.abs(d[k])<1e-9){if(q[k]<lo[k]||q[k]>hi[k])return null;}
    else{var t1=(lo[k]-q[k])/d[k],t2=(hi[k]-q[k])/d[k],sn=-1;if(t1>t2){var tq=t1;t1=t2;t2=tq;sn=1;}if(t1>tn){tn=t1;ax=k;sg=sn;}if(t2<tx)tx=t2;if(tn>tx)return null;}}
  return ax<0?null:{t:tn,ax:ax,sg:sg};}
// faceOf(): which face of box o a hit point p lies on (axis ax and sign sg), used to place decals and cracks.
function faceOf(o,x0,y0,z0,p){var r=segBox(o,x0,y0,z0,p.x,p.y,p.z),x,y,z,ax,sg;
  if(r){x=x0+(p.x-x0)*r.t;y=y0+(p.y-y0)*r.t;z=z0+(p.z-z0)*r.t;ax=r.ax;sg=r.sg;}
  else{var a1=Math.abs(o.x+o.hw-p.x),a2=Math.abs(p.x-(o.x-o.hw)),a3=Math.abs(o.z+o.hd-p.z),a4=Math.abs(p.z-(o.z-o.hd)),a5=Math.abs(o.h-p.y),m=Math.min(a1,a2,a3,a4,a5);x=p.x;y=p.y;z=p.z;
    if(m===a5){ax=1;sg=1;y=o.h;}else if(m===a1){ax=0;sg=1;x=o.x+o.hw;}else if(m===a2){ax=0;sg=-1;x=o.x-o.hw;}else if(m===a3){ax=2;sg=1;z=o.z+o.hd;}else{ax=2;sg=-1;z=o.z-o.hd;}}
  return{x:x,y:y,z:z,ax:ax,sg:sg};}
// addDecal(): places a bullet-hole/chip decal mesh on the hit face of box o.
function addDecal(mat,h,o,sz){var ax=h.ax,sg=h.sg,ul,uh,vl,vh;
  if(ax===0){ul=o.z-o.hd;uh=o.z+o.hd;vl=0;vh=o.h;}else if(ax===2){ul=o.x-o.hw;uh=o.x+o.hw;vl=0;vh=o.h;}else{ul=o.x-o.hw;uh=o.x+o.hw;vl=o.z-o.hd;vh=o.z+o.hd;}
  sz=Math.min(sz,uh-ul,vh-vl);var u=ax===0?h.z:h.x,v=ax===1?h.z:h.y;
  u=Math.max(ul+sz/2,Math.min(uh-sz/2,u));v=Math.max(vl+sz/2,Math.min(vh-sz/2,v));
  var m=new T.Mesh(dcG,mat),e=.012+Math.random()*.004,rl=rr(0,6.283);m.scale.set(sz,sz,1);
  if(ax===0){m.position.set(h.x+sg*e,v,u);m.rotation.set(0,sg>0?Math.PI/2:-Math.PI/2,rl);}
  else if(ax===2){m.position.set(u,v,h.z+sg*e);m.rotation.set(0,sg>0?0:Math.PI,rl);}
  else{m.position.set(u,h.y+e,v);m.rotation.set(-Math.PI/2,0,rl);}
  S.add(m);DC.push(m);if(DC.length>DCMAX)S.remove(DC.shift());}
// gDecal(): places a flat decal on the GROUND at (x,z) (explosion scorch marks, ground bullet holes). Fades over DECAY seconds.
function gDecal(mat,x,z,sz){var m=new T.Mesh(dcG,mat.clone());m.userData.t=DECAY;m.scale.set(sz,sz,1);m.position.set(x,.085+gh(x,z,0),z);m.rotation.set(-Math.PI/2,0,rr(0,6.283));S.add(m);DC.push(m);if(DC.length>DCMAX)S.remove(DC.shift());}
// Debris chunks: small cubes thrown when walls break. addChunk() spawns them, updCh() moves them.
var cgM={},cgG=new T.BoxGeometry(1,1,1);
function addChunk(x,y,z,col,n,nx,ny,nz,sp,sc){var m0=cgM[col]||(cgM[col]=new T.MeshLambertMaterial({color:col}));
  for(var i=0;i<n;i++){if(CH.length>=CHMAX)S.remove(CH.shift().m);var m=new T.Mesh(cgG,m0),s0=rr(.035,.085)*(sc||1),sx=s0,sy=s0*rr(.6,1.3),sz=s0*rr(.7,1.2),k=sp*rr(.4,1.2);
    m.scale.set(sx,sy,sz);m.position.set(x,y,z);S.add(m);
    CH.push({m:m,vx:nx*k+rr(-.5,.5)*sp*.6,vy:ny*k+rr(.2,1.6)+rr(-.3,.3)*sp*.4,vz:nz*k+rr(-.5,.5)*sp*.6,rx:rr(-9,9),ry:rr(-9,9),sx:sx,sy:sy,sz:sz,t:0,l:rr(1.1,2),rest:false});}}
// updCh(dt): physics step for debris chunks CH.
function updCh(dt){for(var i=CH.length-1;i>=0;i--){var c=CH[i],m=c.m;c.t+=dt;
  if(!c.rest){c.vy-=14*dt;m.position.x+=c.vx*dt;m.position.y+=c.vy*dt;m.position.z+=c.vz*dt;m.rotation.x+=c.rx*dt;m.rotation.y+=c.ry*dt;
    if(m.position.y<=.03){m.position.y=.03;if(Math.abs(c.vy)>1.5){c.vy=-c.vy*.35;c.vx*=.5;c.vz*=.5;}else c.rest=true;}}
  if(c.t>c.l){var k=1-(c.t-c.l)/.35;if(k<=0){S.remove(m);CH.splice(i,1);continue;}m.scale.set(c.sx*k,c.sy*k,c.sz*k);}}}
// ---- PROGRESSIVE WALL DAMAGE ----
// Each wall face gets its own crack canvas (FD map keyed "boxId:axis:sign"). Hits paint cracks; after enough hits chunks break off.
// --- progressive wall damage: each wall side has its own crack canvas ---
var FD=new Map(),CLA=[],CLP=[],CLMAX=36,CS=4.6,CPX=256,OID=0,DECAY=2,mzf=[],sndN=0,SND=true,nbuf=null,mzfM=new T.MeshBasicMaterial({color:0xffd27a,transparent:true,opacity:.95,blending:T.AdditiveBlending,depthWrite:false});
// clrFD(): removes all crack overlays (called on reset).
function clrFD(){CLA.forEach(function(c){c.mesh.visible=false;CLP.push(c);});CLA=[];FD.clear();}
// getFace(): gets or creates the crack canvas/mesh for the wall face that was hit.
function getFace(o,h){var ax=h.ax,sg=h.sg,k=(o.id||(o.id=++OID))+":"+ax+":"+sg,f=FD.get(k);if(f)return f;
  var ul,uh,vl,vh;if(ax===0){ul=o.z-o.hd;uh=o.z+o.hd;vl=o.y0||0;vh=o.h;}else if(ax===2){ul=o.x-o.hw;uh=o.x+o.hw;vl=o.y0||0;vh=o.h;}else{ul=o.x-o.hw;uh=o.x+o.hw;vl=o.z-o.hd;vh=o.z+o.hd;}
  f={key:k,ax:ax,sg:sg,ul:ul,uh:uh,vl:vl,vh:vh};FD.set(k,f);return f;}
// mkCl(): creates one crack overlay (canvas + mesh); reused from the pool CLP when possible.
function mkCl(){var cv=document.createElement("canvas");cv.width=cv.height=CPX;var g=cv.getContext("2d");g.lineCap="round";g.lineJoin="round";
  var tex=new T.CanvasTexture(cv);tex.generateMipmaps=false;tex.minFilter=T.LinearFilter;
  var mat=new T.MeshLambertMaterial({map:tex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),m=new T.Mesh(dcG,mat);S.add(m);
  return{cv:cv,g:g,tex:tex,mesh:m,dirty:false};}
// shd(): builds an rgba() color string from an [r,g,b] array with brightness multiplier m and offset add.
function shd(rgb,m,add,al){return "rgba("+Math.min(255,rgb[0]*m+add|0)+","+Math.min(255,rgb[1]*m+add|0)+","+Math.min(255,rgb[2]*m+add|0)+","+al+")";}
// paintHit(): paints a bullet hit (or a big rocket hit) with cracks and chips onto face f. Returns the damage level of the face.
function paintHit(f,h,big,col){var u,v,i,c=null,ax=f.ax,sg=f.sg;
  if(ax===0){u=h.z;v=h.y;}else if(ax===2){u=h.x;v=h.y;}else{u=h.x;v=h.z;}
  for(i=0;i<CLA.length;i++){var q=CLA[i];if(q.key===f.key&&Math.hypot(q.u-u,q.v-v)<.5){c=q;break;}}
  if(!c){c=CLA.length>=CLMAX?CLA.shift():(CLP.pop()||mkCl());
    var S2=Math.min(CS,f.uh-f.ul,f.vh-f.vl),cu=Math.max(f.ul+S2/2,Math.min(f.uh-S2/2,u)),cvv=Math.max(f.vl+S2/2,Math.min(f.vh-S2/2,v)),m=c.mesh;
    c.g.clearRect(0,0,CPX,CPX);m.visible=true;m.rotation.set(0,0,0);m.scale.set(S2,S2,1);
    if(ax===0){m.position.set(h.x+sg*.05,cvv,cu);m.rotation.y=sg>0?Math.PI/2:-Math.PI/2;}
    else if(ax===2){m.position.set(cu,cvv,h.z+sg*.05);m.rotation.y=sg>0?0:Math.PI;}
    else{m.position.set(cu,h.y+.02*sg,cvv);m.rotation.x=-Math.PI/2*sg;}
    var ppu=CPX/S2,dx=u-cu,dy=v-cvv,dir=(ax===0?(sg>0?-1:1):ax===2?(sg>0?1:-1):1);
    c.key=f.key;c.u=u;c.v=v;c.n=0;c.ppu=ppu;c.px=CPX/2+dx*ppu*dir;c.py=ax===1?CPX/2+dy*ppu*sg:CPX/2-dy*ppu;CLA.push(c);}
  c.n+=big?4:1;c.t=DECAY;c.mesh.material.opacity=1;c.dirty=true;
  var s=c.n,g=c.g,ppu2=c.ppu,cx=c.px,cy=c.py,cell=Math.max(2,Math.round(ppu2*.06)),rad=Math.min(ppu2*1.3,cell*(1.3+Math.min(s,10)*.85)*(big?1.8:1)),
   rgb=[(col>>16)&255,(col>>8)&255,col&255],dk=shd(rgb,.36,0,.96),lt=shd(rgb,.35,170,.62),x,y,d,lim=CPX/2-4;
  var hr=Math.min(rad*2.3,lim),dg2=g.createRadialGradient(cx,cy,2,cx,cy,hr);dg2.addColorStop(0,"rgba(238,230,214,.3)");dg2.addColorStop(1,"rgba(238,230,214,0)");g.fillStyle=dg2;g.beginPath();g.arc(cx,cy,hr,0,6.283);g.fill();
  if(big){var sr=Math.min(rad*2.6,lim),sc=g.createRadialGradient(cx,cy,3,cx,cy,sr);sc.addColorStop(0,"rgba(0,0,0,.8)");sc.addColorStop(.6,"rgba(12,10,8,.45)");sc.addColorStop(1,"rgba(0,0,0,0)");g.fillStyle=sc;g.beginPath();g.arc(cx,cy,sr,0,6.283);g.fill();}
  var R2=Math.ceil(rad*1.4/cell)*cell;
  g.fillStyle=lt;for(x=-R2;x<=R2;x+=cell)for(y=-R2;y<=R2;y+=cell){d=Math.hypot(x,y);if(d<rad*(1.05+Math.random()*.3)&&d>rad*.55)g.fillRect(Math.round((cx+x)/cell)*cell,Math.round((cy+y)/cell)*cell,cell,cell);}
  g.fillStyle=dk;for(x=-R2;x<=R2;x+=cell)for(y=-R2;y<=R2;y+=cell){d=Math.hypot(x,y);if(d<rad*(.62+Math.random()*.3))g.fillRect(Math.round((cx+x)/cell)*cell,Math.round((cy+y)/cell)*cell,cell,cell);}
  g.fillStyle="rgba(8,7,6,.97)";for(x=-R2;x<=R2;x+=cell)for(y=-R2;y<=R2;y+=cell){d=Math.hypot(x,y);if(d<rad*(.2+Math.min(s,6)*.05+Math.random()*.12))g.fillRect(Math.round((cx+x)/cell)*cell,Math.round((cy+y)/cell)*cell,cell,cell);}
  var nc=Math.min(14,3+Math.round(s*1.3)),ln=ppu2*(big?1.6:1)*(1+Math.min(s,8)*.35);
  for(i=0;i<nc;i++){var a=rr(0,6.283);crk(g,cx+Math.cos(a)*rad*.6,cy+Math.sin(a)*rad*.6,a,rr(.18,.32)*ln,Math.max(1,ppu2*.022),rr(.5,.75),0);}
  if(s>=3){g.fillStyle=dk;for(i=0;i<Math.min(6,s);i++){var a2=rr(0,6.283),r2=rad*rr(1.3,2.1);g.fillRect(Math.round((cx+Math.cos(a2)*r2)/cell)*cell,Math.round((cy+Math.sin(a2)*r2)/cell)*cell,cell*(Math.random()<.4?2:1),cell);}}
  return s;}
// updCl(dt): fades old crack overlays and recycles them into the pool.
function updCl(dt){var i;
  for(i=CLA.length-1;i>=0;i--){var c=CLA[i];c.t-=dt;if(c.t<=0){c.mesh.visible=false;CLP.push(c);CLA.splice(i,1);continue;}c.mesh.material.opacity=Math.min(1,c.t/.6);if(c.dirty){c.tex.needsUpdate=true;c.dirty=false;}}
  for(i=DC.length-1;i>=0;i--){var d=DC[i],ud=d.userData;if(ud.t===undefined)continue;ud.t-=dt;if(ud.t<=0){S.remove(d);d.material.dispose();DC.splice(i,1);}else d.material.opacity=Math.min(1,ud.t/.6);}}
// impact(): called when bullet b hits wall box o at hit info h. Adds damage, cracks, sparks, debris and may break the wall piece.
function impact(o,h,b){o.dm=(o.dm||0)+1;var big=!!b.rk,f=getFace(o,h),s=paintHit(f,h,big,o.c),brk=!big&&s>1&&s%4===0,
  nx=h.ax===0?h.sg:0,ny=h.ax===1?h.sg:0,nz=h.ax===2?h.sg:0;
  addChunk(h.x+nx*.04,h.y+ny*.04,h.z+nz*.04,o.c,big?14:brk?9:s>1?3:2,nx,ny,nz,big?3.2:brk?2.6:1.7,big||brk?2.2:1);
  spark(h.x+nx*.06,h.y+ny*.06,h.z+nz*.06,0xd9d0bb,big?8:brk?7:3,big?3:brk?2.4:1.8,.1);}
// ---- SMOKE (rocket and grenade) ----
// Pooled puffs: SM = active, SMP = free pool, SMMAX = cap.
// --- smoke (RPG & grenade) ---
var SM=[],SMP=[],SMMAX=190,smG=new T.IcosahedronGeometry(1,1);
// smoke(): spawns n smoke puffs.
function smoke(x,y,z,n,sp,sz,life,rise,dark){
  for(var i=0;i<n;i++){
    var q;if(SM.length>=SMMAX){q=SM.shift();}else q=SMP.pop();
    if(!q){var mt=new T.MeshBasicMaterial({color:0x777777,transparent:true,opacity:0,depthWrite:false});q={m:new T.Mesh(smG,mt)};S.add(q.m);}
    var a=Math.random()*6.283,v=sp*(.3+Math.random()*.7);
    q.m.visible=true;q.m.position.set(x+rr(-.15,.15)*sz,y+rr(-.1,.1)*sz,z+rr(-.15,.15)*sz);q.m.rotation.set(rr(0,6),rr(0,6),rr(0,6));
    q.vx=Math.cos(a)*v;q.vz=Math.sin(a)*v;q.vy=rise*(.5+Math.random()*.7)+Math.random()*sp*.25;
    q.t=0;q.l=life*(.75+Math.random()*.5);q.s0=sz*(.5+Math.random()*.5);q.s1=q.s0*(2.2+Math.random()*1.2);q.d=dark;q.m.scale.setScalar(q.s0);q.m.material.opacity=0;SM.push(q);}}
// clrSm(): hides all smoke puffs and returns them to the pool.
function clrSm(){SM.forEach(function(q){q.m.visible=false;SMP.push(q);});SM=[];}
// updSm(dt): grows and fades smoke puffs.
function updSm(dt){for(var i=SM.length-1;i>=0;i--){var q=SM[i];q.t+=dt;var k=q.t/q.l;
  if(k>=1){q.m.visible=false;SMP.push(q);SM.splice(i,1);continue;}
  var dr=Math.max(0,1-dt*2.4),p=q.m.position;q.vx*=dr;q.vz*=dr;q.vy*=Math.max(0,1-dt*.9);p.x+=q.vx*dt;p.y+=q.vy*dt;p.z+=q.vz*dt;
  q.m.scale.setScalar(q.s0+(q.s1-q.s0)*(1-(1-k)*(1-k)));q.m.rotation.y+=dt*.4;
  var op=(k<.1?k/.1:Math.pow(1-(k-.1)/.9,1.3))*(q.d?.62:.45),dd=Math.hypot(p.x-pl.x,p.y-(1.5+pl.y),p.z-pl.z);op*=Math.max(0,Math.min(1,(dd-.8)/2.2));
  q.m.material.opacity=op;var c=q.d?.16+.4*k:.55+.22*k;q.m.material.color.setRGB(c,c,c);}}
