// ===== city decoration (visual only, collision unchanged) =====
// rnd(): small seeded random generator so the city decoration is identical on every load (seed cSd).
var cSd=7;function rnd(){cSd=cSd*16807%2147483647;return cSd/2147483647;}
// shade()/lite(): darken or lighten a hex color by a factor. Used for building and prop colors.
function shade(c,f){return new T.Color(c).multiplyScalar(f).getHex();}
function lite(c,f){var k=new T.Color(c);k.lerp(new T.Color(0xffffff),f);return k.getHex();}
var DB=[];
// Decoration boxes are queued in DB (via wnd/dk) and merged into a few big meshes by flushDeco() for speed. Visual only, no collision.
function wnd(x,y,z,w,h,d,col){DB.push([x,y,z,w,h,d,col]);}
var FN=[[1,0,0,[[1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1]]],[-1,0,0,[[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,-1,-1]]],[0,1,0,[[-1,1,-1],[-1,1,1],[1,1,1],[1,1,-1]]],[0,-1,0,[[-1,-1,1],[-1,-1,-1],[1,-1,-1],[1,-1,1]]],[0,0,1,[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]],[0,0,-1,[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]]];
// flushDeco(): merges all queued decoration boxes (DB) into chunked BufferGeometry meshes. Call after the map is built.
function flushDeco(){var CH2=2400,i0,i,j,k,n,pos,nor,col,idx,vi,b,cc=new T.Color(),g,m,mat=new T.MeshLambertMaterial({vertexColors:true});
  for(i0=0;i0<DB.length;i0+=CH2){n=Math.min(CH2,DB.length-i0);pos=new Float32Array(n*72);nor=new Float32Array(n*72);col=new Float32Array(n*72);idx=new Uint16Array(n*36);vi=0;
    for(i=0;i<n;i++){b=DB[i0+i];cc.setHex(b[6]);
      for(j=0;j<6;j++){var f=FN[j],o=(i*6+j)*12;
        for(k=0;k<4;k++){var v=f[3][k];pos[o+k*3]=b[0]+v[0]*b[3]/2;pos[o+k*3+1]=b[1]+v[1]*b[4]/2;pos[o+k*3+2]=b[2]+v[2]*b[5]/2;nor[o+k*3]=f[0];nor[o+k*3+1]=f[1];nor[o+k*3+2]=f[2];col[o+k*3]=cc.r;col[o+k*3+1]=cc.g;col[o+k*3+2]=cc.b;}
        var q=(i*6+j)*4,ii=(i*6+j)*6;idx[ii]=q;idx[ii+1]=q+1;idx[ii+2]=q+2;idx[ii+3]=q;idx[ii+4]=q+2;idx[ii+5]=q+3;}}
    g=new T.BufferGeometry();g.setAttribute("position",new T.BufferAttribute(pos,3));g.setAttribute("normal",new T.BufferAttribute(nor,3));g.setAttribute("color",new T.BufferAttribute(col,3));g.setIndex(new T.BufferAttribute(idx,1));
    m=new T.Mesh(g,mat);m.frustumCulled=false;S.add(m);}
  DB=[];}
// dk(): queue one decoration box (no collision).
function dk(w,h,d,c,x,y,z){wnd(x,y,z,w,h,d,c);}
var ACC=[0x1c3d5a,0x2b2d42,0xf59f00,0x087f5b,0x862e9c,0xc92a2a,0xe8590c,0x1864ab],GLS=[0x2c4a6b,0x3b5b7e,0x23394f,0x4a6f94],bdN=0;
// bld(): builds a hollow building (walls with door gaps, windows, roof, floors). dr = which sides have doors ("n","s","e","w"). Registers OB/BR/LT entries.
function bld(cx,cz,w,d,h,c,dr){if(Math.abs(cx)+w/2+1>A-1||Math.abs(cz)+d/2+1>A-1)return;var g=3,sg,st=bdN%4,ac=ACC[(bdN*3+1)%ACC.length],gl=GLS[bdN%GLS.length];bdN++;
  [["n",-1],["s",1]].forEach(function(s){var z=cz+s[1]*d/2;
    if(dr.indexOf(s[0])<0)wl(cx,z,w,1,h,c);else{sg=(w-g)/2;wl(cx-(g+sg)/2,z,sg,1,h,c);wl(cx+(g+sg)/2,z,sg,1,h,c);mk(g,h-3,1,c,cx,3+(h-3)/2,z);}});
  [["w",-1],["e",1]].forEach(function(s){var x=cx+s[1]*w/2;
    if(dr.indexOf(s[0])<0)wl(x,cz,1,d-1,h,c);else{sg=(d-1-g)/2;wl(x,cz-(g+sg)/2,1,sg,h,c);wl(x,cz+(g+sg)/2,1,sg,h,c);mk(1,h-3,g,c,x,3+(h-3)/2,cz);}});
  // roof, cornice, and foundation
  mk(w+1.4,.6,d+1.4,shade(c,.55),cx,h+.3,cz);OB.push({x:cx,z:cz,hw:(w+1.4)/2,hd:(d+1.4)/2,h:h+.6,y0:h,fl:1,st:.7});
  dk(w+1.75,.24,d+1.75,ac,cx,h-.12,cz);
  dk(w+1.25,.9,d+1.25,shade(c,.6),cx,.45,cz);OB.push({x:cx,z:cz,hw:(w+1.25)/2,hd:(d+1.25)/2,h:.9,fl:1,st:.95});
  // facade per side
  ["n","s","w","e"].forEach(function(sd0){var ns=sd0==="n"||sd0==="s",L=ns?w:d,sgn=(sd0==="s"||sd0==="e")?1:-1,o=(ns?d:w)/2+.53,door=dr.indexOf(sd0)>=0,y,t,k,col,x0;
    if(st===2){for(y=4.6;y<h-1.2;y+=2.6){if(ns)wnd(cx,y,cz+sgn*o,L-3.4,1.5,.08,gl);else wnd(cx+sgn*o,y,cz,.08,1.5,L-3.4,gl);
        for(t=-L/2+2.4;t<L/2-2;t+=2.5){if(ns)dk(.14,1.5,.1,0xf1f3f5,cx+t,y,cz+sgn*o);else dk(.1,1.5,.14,0xf1f3f5,cx+sgn*o,y,cz+t);}}}
    else{for(y=1.7;y<h-1.2;y+=2.5)for(t=-L/2+1.8;t<=L/2-1.79;t+=2.4){if(door&&y<3.6&&Math.abs(t)<g/2+.9)continue;
        col=rnd()<.2?0xffd980:(rnd()<.3?0x9fd3f2:gl);
        if(ns)wnd(cx+t,y,cz+sgn*o,1.1,1.1,.08,col);else wnd(cx+sgn*o,y,cz+t,.08,1.1,1.1,col);}}
    if(st===0)for(y=2.95,k=0;y<h-.6;y+=2.5,k++){if(ns)dk(L+1.1,.35,.14,ac,cx,y,cz+sgn*(o-.03));else dk(.14,.35,L+1.1,ac,cx+sgn*(o-.03),y,cz);}
    if(st===3)for(t=-L/2+3,x0=0;t<L/2-1.5;t+=2.4,x0++){if(ns)dk(.5,h-3.4,.1,lite(c,.35),cx+t,3.2+(h-3.4)/2,cz+sgn*(o-.01));else dk(.1,h-3.4,.5,lite(c,.35),cx+sgn*(o-.01),3.2+(h-3.4)/2,cz+t);}
  });
  if(st===1)[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(q){dk(1.5,h,1.5,shade(c,.7),cx+q[0]*(w/2+.45),h/2,cz+q[1]*(d/2+.45));});
  // door canopies
  dr.split("").forEach(function(s0){var ns=s0==="n"||s0==="s",sg2=(s0==="s"||s0==="e")?1:-1;
    if(ns)dk(g+1.6,.22,1.5,ac,cx,3.3,cz+sg2*(d/2+.5+.75));else dk(1.5,.22,g+1.6,ac,cx+sg2*(w/2+.5+.75),3.3,cz);});
  // rooftop props
  var ry=h+.6,n,i,px,pz;n=1+((rnd()*2)|0);
  for(i=0;i<n;i++){px=cx+(rnd()-.5)*(w-3);pz=cz+(rnd()-.5)*(d-3);mk(1,.8,1,0xced4da,px,ry+.4,pz);OB.push({x:px,z:pz,hw:.5,hd:.5,h:ry+.8,y0:ry});dk(.7,.08,.7,0x495057,px,ry+.84,pz);}
  if(rnd()<.55){px=cx+(rnd()-.5)*(w-3.5);pz=cz+(rnd()-.5)*(d-3.5);mk(.9,.6,.9,0x5c4a3d,px,ry+.3,pz);OB.push({x:px,z:pz,hw:.7,hd:.7,h:ry+1.95,y0:ry});var tk=new T.Mesh(new T.CylinderGeometry(.7,.7,1.3,10),new T.MeshLambertMaterial({color:0x8d6e63}));tk.position.set(px,ry+1.25,pz);tk.castShadow=true;S.add(tk);dk(1.5,.12,1.5,0x343a40,px,ry+1.95,pz);}
  if(rnd()<.5){px=cx+(rnd()-.5)*(w-2);pz=cz+(rnd()-.5)*(d-2);mk(.12,2.6,.12,0x343a40,px,ry+1.3,pz);dk(.22,.22,.22,0xff4d4d,px,ry+2.7,pz);}
  if(h>=8){var pw=w*.5,pd=d*.5;mk(pw,2.2,pd,shade(c,.85),cx,ry+1.1,cz);OB.push({x:cx,z:cz,hw:pw/2,hd:pd/2,h:ry+2.2,y0:ry});dk(pw+.5,.22,pd+.5,ac,cx,ry+2.3,cz);
    [-1,1].forEach(function(q){wnd(cx,ry+1.3,cz+q*(pd/2+.03),pw-1,.8,.08,gl);wnd(cx+q*(pw/2+.03),ry+1.3,cz,.08,.8,pd-1,gl);});}
  BR.push({x:cx,z:cz,hw:w/2,hd:d/2});
  if(dr.indexOf("n")>=0)LT.push({x:cx,z:cz-d/2,hw:g/2,hd:.5,y0:3,h:h,c:c});if(dr.indexOf("s")>=0)LT.push({x:cx,z:cz+d/2,hw:g/2,hd:.5,y0:3,h:h,c:c});
  if(dr.indexOf("w")>=0)LT.push({x:cx-w/2,z:cz,hw:.5,hd:g/2,y0:3,h:h,c:c});if(dr.indexOf("e")>=0)LT.push({x:cx+w/2,z:cz,hw:.5,hd:g/2,y0:3,h:h,c:c});
  LT.push({x:cx,z:cz,hw:(w+1.4)/2,hd:(d+1.4)/2,y0:h,h:h+.6,c:0x495057});}
// boxes: cargo containers & crates
var BPAL=[0xe8590c,0x1c7ed6,0xf08c00,0x2f9e44,0xc2255c,0x7048e8,0x0ca678,0xd9480f],bxN=0;
// stripe(): hazard/paint stripes on top of crates and containers (decoration).
function stripe(x,z,w,d,y,hh,ca,cb){var n,i,s;n=Math.max(2,Math.round(w/.5));for(i=0;i<n;i++){s=w/n;[1,-1].forEach(function(q){dk(s,hh,.06,i%2?ca:cb,x-w/2+s*(i+.5),y,z+q*(d/2+.03));});}
  n=Math.max(2,Math.round(d/.5));for(i=0;i<n;i++){s=d/n;[1,-1].forEach(function(q){dk(.06,hh,s,i%2?ca:cb,x+q*(w/2+.03),y,z-d/2+s*(i+.5));});}}
// cBox(): builds a cargo container/crate prop from a config array [x,z,w,d,...] and registers its collision in OB.
function cBox(o){if(Math.abs(o[0])+o[2]/2>A-1||Math.abs(o[1])+o[3]/2>A-1)return;var x=o[0],z=o[1],w=o[2],d=o[3],h=2.4,c=BPAL[bxN++%BPAL.length],dkc=shade(c,.55),ltc=lite(c,.4),i,n;
  wl(x,z,w,d,h,c);dk(w+.1,.16,d+.1,dkc,x,h+.08,z);dk(w+.1,.16,d+.1,dkc,x,.08,z);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(q){dk(.26,h,.26,shade(c,.45),x+q[0]*(w/2),h/2,z+q[1]*(d/2));});
  if(w!==d){var al=w>d;n=Math.round((al?w:d)/.45);
    for(i=0;i<n;i++){var u=((i+.5)/n-.5)*((al?w:d)-.5);[1,-1].forEach(function(q){if(al)dk(.12,h-.4,.07,dkc,x+u,h/2,z+q*(d/2+.03));else dk(.07,h-.4,.12,dkc,x+q*(w/2+.03),h/2,z+u);});}
    [1,-1].forEach(function(q){[-.2,.2].forEach(function(e){if(al)dk(.09,h-.4,.07,ltc,x+q*(w/2+.03),h/2,z+e*d*.7);else dk(.09,h-.4,.07,ltc,x+e*w*.7,h/2,z+q*(d/2+.03));});});
    if(al)dk(w*.35,.4,.08,0xf8f9fa,x,h*.62,z+d/2+.04);else dk(.08,.4,d*.35,0xf8f9fa,x+w/2+.04,h*.62,z);}
  else{dk(w+.1,.3,d+.1,ltc,x,h*.5,z);dk(w+.12,.18,d+.12,dkc,x,h*.5+.35,z);dk(w+.12,.18,d+.12,dkc,x,h*.5-.35,z);
    dk(w*.5,.5,.08,0xf8f9fa,x,h*.78,z+d/2+.04);}}
// cBar(): builds a barrier/low wall prop from a config array and registers its collision.
function cBar(o){if(Math.abs(o[0])+o[2]/2>A-1||Math.abs(o[1])+o[3]/2>A-1)return;var x=o[0],z=o[1],w=o[2],d=o[3],h=1.3;wl(x,z,w,d,h,0xadb5bd);dk(w+.1,.2,d+.1,0xfcc419,x,h+.1,z);dk(w+.14,.18,d+.14,0x6c757d,x,.09,z);stripe(x,z,w,d,h-.3,.3,0x212529,0xfcc419);}
// inB(): true if (x,z) is inside (or within 1 unit of) any building footprint in BR. Used to avoid spawning in buildings.
function inB(x,z){for(var i=0;i<BR.length;i++){var b=BR[i];if(Math.abs(x-b.x)<b.hw+1&&Math.abs(z-b.z)<b.hd+1)return true;}return false;}
bld(14,-16,12,10,7,0xc8553d,"sw");bld(30,-12,8,8,12,0x868e96,"s");bld(14,-32,10,8,5,0xb08968,"we");
bld(-16,-16,10,12,6,0x6c8ea4,"se");bld(-32,-14,8,8,10,0xa98467,"e");bld(-14,-33,12,8,5,0x8d99ae,"s");
bld(16,16,12,12,6,0xe6b566,"nw");bld(32,18,8,10,9,0x9a8c98,"w");bld(16,33,10,7,4,0xcc7e85,"n");
bld(-18,18,12,10,8,0x7ea172,"ne");bld(-33,16,8,8,5,0xc9ada7,"e");bld(-16,33,9,7,4,0x6d6875,"n");
[[14,-16,2,2],[-16,-16,2,3],[16,16,3,2],[-18,18,2,2],[32,18,2,2],[-32,-14,2,2]].forEach(function(o){cBar(o);});
[[-10,-7,4,4,0xf08c8c],[10,7,4,4,0x8cc7f0],[0,-20,5,2,0xf0d98c],[0,22,5,2,0xa6e0a0],[22,0,2,5,0xc9a6f0],[-24,0,2,5,0xf0b48c],[24,-24,3,3,0xf08c8c],[-26,-26,3,3,0x8cc7f0],[26,26,3,3,0xa6e0a0],[-26,28,3,3,0xf0d98c]].forEach(function(o){cBox(o);});
// --- extra area (arena expanded 2x) ---
bld(50,-14,10,10,8,0xb5838d,"w");bld(-52,-12,12,8,6,0x6d9886,"e");bld(52,20,8,12,10,0xa68a64,"sw");bld(-50,22,10,8,5,0x9b8bb4,"n");
bld(14,-56,12,10,7,0xd08c60,"s");bld(-18,-58,10,8,9,0x7a8b99,"se");bld(30,-52,8,8,5,0xc9b79c,"w");
bld(16,56,10,10,6,0x8fb996,"n");bld(-20,58,12,8,8,0xbc6c25,"ne");bld(32,54,8,8,11,0x778da9,"s");
bld(60,-50,12,10,6,0xdda15e,"sw");bld(-62,-52,10,12,7,0x8d99ae,"e");bld(60,58,10,10,9,0x9c6644,"nw");bld(-60,60,12,10,5,0xb7b7a4,"se");
bld(-36,-34,8,8,6,0xe5989b,"s");bld(-36,36,8,8,7,0x84a59d,"e");
[[-48,-24,3,3,0xf08c8c],[44,-34,3,3,0x8cc7f0],[46,40,3,3,0xa6e0a0],[-46,44,3,3,0xf0d98c],[30,-70,5,2,0xc9a6f0],[-30,70,5,2,0xf0b48c],[70,-20,2,5,0xf0d98c],[-72,10,2,5,0xa6e0a0],[68,30,3,3,0x8cc7f0],[-68,-30,3,3,0xf08c8c],[0,-50,5,2,0xf0d98c],[0,52,5,2,0xa6e0a0],[50,0,2,5,0xc9a6f0],[-50,0,2,5,0xf0b48c],[-8,-72,4,3,0x8cc7f0],[10,74,4,3,0xf08c8c]].forEach(function(o){cBox(o);});
[[24,-40,2,2],[-30,46,2,2],[40,-60,2,2],[-40,60,2,2],[66,0,2,2],[-66,0,2,2]].forEach(function(o){cBar(o);});
flushDeco();
