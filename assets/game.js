(function(){
// =====================================================================================
// BLOK BUDDIES FPS - SINGLE-FILE GAME (HTML + CSS + JS, Three.js r128 loaded from cdnjs)
// =====================================================================================
// READ THIS FIRST (notes for humans and for future AI edits). Everything below is ONE IIFE.
// Do not invent APIs: only Three.js r128 and plain browser APIs exist. No build step, no modules.
//
// COORDINATES
//  - World: x/z are the ground plane, y is up. The arena spans x,z in [-A, A] with A = 60.
//  - Entities store x, y (feet height), z. Player = `pl`, bots = items of `en`.
//  - `face` = yaw in radians. Forward on the ground = (sin(face), cos(face)) in (x, z).
//    Right = (-cos(face), sin(face)). `pitch` = look up/down, clamped to +-1.2.
//  - Viewmodel (first-person gun) local space: +x right, +y up, -z forward (barrel points to -z).
//
// TWO SCENES / TWO CAMERAS (see loop() at the bottom)
//  - S + C  = the world and its camera.
//  - VS + VC = the first-person viewmodel (group `hold` with the gun models, handR/handL, armR/armL).
//    It is rendered AFTER the world with the depth buffer cleared, so the gun never clips into walls.
//
// WEAPON IDS (index into WP and into many parallel arrays)
//  0 Pistol, 1 Rifle, 2 Shotgun, 3 Rocket, 4 Knife, 5 Grenade, 6 Kriss, 7 Dual Kriss, 8 AWP (sniper).
//  Parallel arrays indexed by weapon id: WP, guns, MZ, ADF, AP, RG, RL, PT, MODE, NC, GSC, GH,
//  CKV, CKS, CKY, CKR, SFXI, SV. If you add a weapon you must extend ALL of them.
//  Weapon slots (swSlot): 0 = primary (pl.prim), 1 = pistol (0), 2 = knife (4), 3 = grenade (5).
//  Primary choices during the 5 s pre-match countdown: WSEL = [1, 2, 3, 6, 8].
//
// PLAYER STATE `pl` (created in reset())
//  mag/res = magazine and reserve ammo of the CURRENT weapon only. swW() stores them into
//  pl.ammo[id] and loads the next weapon's. Use amo(id) to access any weapon's ammo.
//  Timers: rl = reload time left, cd = fire cooldown, sw = weapon-switch anim, stab = knife anim,
//  thr = grenade throw anim, bolt = AWP bolt-action cycle time left (see BOLT_T).
//  tm = team: 0 = Police (random spawn in the zone around z=+38), 1 = Terrorist (random spawn around z=-38). See spawnPt().
//
// GAME STATE
//  lob = lobby/menu showing, run = match loop active, mt = {t: seconds left, cd: pre-match
//  countdown (weapon select), over: match finished}. update(dt) is the simulation, hud() the UI.
//
// ENTITY LISTS
//  en = bots (BOTH enemies and the AI teammates; field `tm` tells the team), bl = bullets,
//  cr = airdrop crates, fx = explosion rings, sk = spark particles, dg = dropped guns and
//  ejected shell casings (casings have `cs`=1), grs = thrown grenades, chutes = parachutes.
//  In Team Death Match there are NO airdrops: DM_RULES.crates is false, so cr stays empty (no dropped weapons, ammo or medkits).
//
// SHOOTING PIPELINE
//  update() -> fire(o, face, w, own, adv) spawns bullet objects into `bl` -> the bullet loop in
//  update() moves them in small sub-steps, tests walls (sweepObs/sweepLT/obsAt) and characters,
//  then calls dmgE()/hurt()/impact(). Headshot = 3x damage. Range falloff comes from fall().
//  Muzzle origin for the player comes from `hold.position` + MZ[weapon] so tracers leave the
//  visible gun. Dual Kriss alternates sides using `shotSide` (0 = right gun, 1 = left gun).
//
// OTHER FACTS THAT PREVENT MISTAKES
//  - Comments that start with "FIX" mark old bug fixes. Do not revert them.
//  - botsUpd() is the live bot AI (grid path-finding). botsUpdOld() is UNUSED legacy code.
//  - All sound is synthesised with WebAudio (no audio files). `AC` is created lazily.
//  - Only localStorage use: best score, key "bbfps_best", always wrapped in try/catch.
//  - Never use fetch/network for gameplay. Fonts and three.js are the only external requests.
// =====================================================================================

// Basic setup: T = THREE alias, A = arena half-size (world is [-A..A] on x and z), touch = phone/tablet mode.
var T=THREE,A=60,touch=matchMedia("(pointer:coarse)").matches;
if(touch)document.body.classList.add("touch");
// Renderer. autoClear is OFF because loop() clears manually to draw two scenes (world, then viewmodel).
var R=new T.WebGLRenderer({antialias:true});R.setPixelRatio(Math.min(devicePixelRatio,2));R.shadowMap.enabled=true;R.domElement.id="gl";R.autoClear=false;document.body.prepend(R.domElement);
// S = world scene (sky-colored background + fog). C = world camera (the player's eyes).
var S=new T.Scene();S.background=new T.Color(0xa6d5f2);S.fog=new T.Fog(0xa6d5f2,60,150);
var C=new T.PerspectiveCamera(70,1,.1,430);S.add(C);var VS=new T.Scene(),VC=new T.PerspectiveCamera(70,1,.1,10);VS.add(new T.HemisphereLight(0xffffff,0x9a8f70,1.1));var vl=new T.DirectionalLight(0xffffff,.5);vl.position.set(1,2,1);VS.add(vl);
// Resize handler: keeps renderer size and both camera aspects in sync with the window.
function rs(){R.setSize(innerWidth,innerHeight);C.aspect=VC.aspect=innerWidth/innerHeight;C.updateProjectionMatrix();VC.updateProjectionMatrix();}
addEventListener("resize",rs);rs();
S.add(new T.HemisphereLight(0xffffff,0x9a8f70,.95));
// Sun light + shadow camera. loop() moves the sun with the player so shadows stay around the player.
var sun=new T.DirectionalLight(0xffffff,.6);sun.position.set(14,30,10);sun.castShadow=true;
var sc=sun.shadow.camera;sc.left=-28;sc.right=28;sc.top=28;sc.bottom=-28;sc.far=80;sun.shadow.mapSize.set(2048,2048);S.add(sun);
// mk(): adds a colored box mesh (width,height,depth,color,x,y,z) to the world scene. Basic building block of the map.
function mk(w,h,d,c,x,y,z){var m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshLambertMaterial({color:c}));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;S.add(m);return m;}
// Collision data. OB = solid boxes {x,z,hw,hd,h,c,[y0,fl,st]} (hw/hd = half width/depth, h = top height,
// y0 = bottom height for floating boxes, fl = walkable floor-like piece ignored by inObs, st = max step-up height).
// BR = building footprints (used by inB() to keep spawns/crates out of buildings).
// LT = overhead blockers of buildings (door lintels and roofs: bullets hit them, players walk under them).
var OB=[],BR=[],LT=[];
mk(2*A+4,1,2*A+4,0xe9dcb8,0,-.5,0).castShadow=false;
var gr=new T.GridHelper(2*A+4,A+2,0xcbbd96,0xd6c9a4);gr.position.y=.01;S.add(gr);
mk(2*A+4,.05,8,0x4a4f5a,0,.025,0).castShadow=false;mk(8,.05,2*A+4,0x4a4f5a,0,.03,0).castShadow=false;
for(var q=-A+2;q<A;q+=8){mk(3,.06,.3,0xf1f3f5,q,.04,0).castShadow=false;mk(.3,.06,3,0xf1f3f5,0,.05,q).castShadow=false;}
[[0,-(A+.5),2*A+3,1],[0,A+.5,2*A+3,1],[-(A+.5),0,1,2*A+3],[A+.5,0,1,2*A+3]].forEach(function(w){mk(w[2],3,w[3],0x7a8aa0,w[0],1.5,w[1]);});
// wl(): creates a wall/solid box AND registers it in OB so players, bots and bullets collide with it.
function wl(x,z,w,d,h,c){mk(w,h,d,c,x,h/2,z);OB.push({x:x,z:z,hw:w/2,hd:d/2,h:h,c:c});}
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
// resolve(): pushes entity p (radius r) out of solid boxes so characters cannot walk through walls.
function resolve(p,r){
  p.x=Math.max(-A,Math.min(A,p.x));p.z=Math.max(-A,Math.min(A,p.z));
  OB.forEach(function(o){if(o.fl||(p.y||0)>=o.h-.05||(p.y||0)+1.8<=(o.y0||0))return;var nx=Math.max(o.x-o.hw,Math.min(o.x+o.hw,p.x)),nz=Math.max(o.z-o.hd,Math.min(o.z+o.hd,p.z)),dx=p.x-nx,dz=p.z-nz,d=Math.hypot(dx,dz);
    if(d<r){if(d>0){p.x+=dx/d*(r-d);p.z+=dz/d*(r-d);}else p.x+=r;}});
}
// mkHelm(): builds a helmet mesh group (can fly off when a headshot pops it, see popHelm()).
function mkHelm(col,ms){var h=new T.Group();
  function b(w,hh,d,c,x,y,z){var m=new T.Mesh(new T.BoxGeometry(w,hh,d),new T.MeshLambertMaterial({color:c}));m.position.set(x,y,z);m.castShadow=true;h.add(m);if(ms)ms.push(m.material);return m;}
  b(.74,.3,.74,col,0,0,0);b(.78,.07,.78,0x1d2024,0,-.14,0);b(.5,.05,.16,0x1d2024,0,-.1,.42);b(.18,.06,.56,0x1d2024,0,.17,0);b(.06,.12,.06,0xffd54a,0,.05,.38);
  h.position.set(0,1.92,0);return h;}
// buddy(): builds the blocky Police character model (arms, legs, head, gun) in the given color.
function buddy(col){
  var g=new T.Group(),ms=[],legs=[],arms=[],body=new T.Group();g.add(body);
  function p(w,h,d,c,x,y,z,par){var m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshLambertMaterial({color:c}));m.position.set(x,y,z);m.castShadow=true;(par||body).add(m);ms.push(m.material);return m;}
  function pv(x,y){var q=new T.Group();q.position.set(x,y,0);body.add(q);return q;}
  p(.8,.8,.5,col,0,.95,0);p(.6,.6,.6,0xffd9a0,0,1.65,0);p(.12,.12,.05,0x222,-.15,1.7,.31);p(.12,.12,.05,0x222,.15,1.7,.31);var hg=p(.22,.22,.8,0x2b2f3d,.55,1,.4);
  [-.2,.2].forEach(function(x){var q=pv(x,.55);p(.3,.55,.35,0x333a4d,0,-.275,0,q);legs.push(q);});
  [-.55,.55].forEach(function(x){var q=pv(x,1.3);p(.3,.7,.3,col,0,-.3,0,q);arms.push(q);});
  var hm=mkHelm(0x1864ab,ms);body.add(hm);S.add(g);return{g:g,body:body,ms:ms,legs:legs,arms:arms,fl:0,hg:hg,hm:hm};
}
// terro(tm): builds a character model for either team (despite the name). tm 0 = Police look, tm 1 = Terrorist look.
// Returns an object with the mesh group `g` plus references used by animation (arms, legs, body, helmet `hm`, gun `rg`).
// Used for bots (newBot) and for the visible player body pm (mkPm).
function terro(tm){var K=tm?{s:0x4b5320,v:0x23272b,hd:0x15161a,sl:0xffd9a0,hb:0xc92a2a,pt:0x5a5a3a,hm:0x3b4a2a}:{s:0x1c4a8a,v:0x142a52,hd:0xffd9a0,sl:0x1d2024,hb:0x1864ab,pt:0x1d2c4a,hm:0x1c3d7a};
  var g=new T.Group(),ms=[],legs=[],arms=[],body=new T.Group();g.add(body);
  function p(w,h,d,c,x,y,z,par){var m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshLambertMaterial({color:c}));m.position.set(x,y,z);m.castShadow=true;(par||body).add(m);ms.push(m.material);return m;}
  function pv(x,y){var q=new T.Group();q.position.set(x,y,0);body.add(q);return q;}
  // body: olive green shirt + black tactical vest
  p(.8,.8,.5,K.s,0,.95,0);p(.86,.62,.56,K.v,0,1,0);
  p(.12,.1,.56,K.v,-.25,1.38,0);p(.12,.1,.56,K.v,.25,1.38,0);
  [-.27,0,.27].forEach(function(x){p(.2,.2,.1,0x3a3f35,x,.8,.3);});
  p(.84,.1,.54,0x111111,0,.58,0);p(.16,.2,.12,0x3a3f35,.5,.5,0);
  // head: black balaclava, eye slit, red headband
  p(.6,.6,.6,K.hd,0,1.65,0);p(.5,.14,.05,K.sl,0,1.7,.31);
  p(.1,.08,.05,0x222222,-.13,1.7,.34);p(.1,.08,.05,0x222222,.13,1.7,.34);
  p(.64,.1,.64,K.hb,0,1.88,0);p(.1,.22,.05,K.hb,.22,1.78,-.33);
  // rifle
  var gun=new T.Group();body.add(gun);g.userData.gun=gun;var rg=mkGun(1);rg.rotation.y=Math.PI;rg.scale.setScalar(1.2);rg.position.set(.2,1.05,-.16);gun.add(rg);g.userData.rg=rg;rg.traverse(function(m){if(m.material)ms.push(m.material);});
  [-.2,.2].forEach(function(x){var q=pv(x,.55);p(.3,.55,.35,K.pt,0,-.275,0,q);p(.32,.18,.4,0x1a1a1a,0,-.46,.03,q);legs.push(q);});
  [-.55,.55].forEach(function(x){var q=pv(x,1.3);p(.3,.4,.3,K.s,0,-.2,0,q);var fa=new T.Group();fa.position.set(0,-.4,0);q.add(fa);p(.28,.44,.28,K.s,0,-.22,0,fa);p(.31,.16,.31,0x1a1a1a,0,-.46,0,fa);q.userData.fa=fa;arms.push(q);});
  var hm=mkHelm(K.hm,ms);body.add(hm);S.add(g);return{g:g,body:body,ms:ms,legs:legs,arms:arms,fl:0,hm:hm,helm:true};
}
// Scratch vectors/quaternions reused by the bot arm IK code (aimA) to avoid allocating every frame.
var QD=new T.Vector3(0,-1,0),qa=new T.Quaternion(),qb=new T.Quaternion(),va=new T.Vector3(),vb=new T.Vector3(),vp=new T.Vector3();
// aimA(): 2-bone arm IK. Bends an arm (upper arm + forearm, lengths L1/L2) so the hand reaches target (tx,ty,tz) from shoulder (px,py).
function aimA(q,px,py,tx,ty,tz,sd){var L1=.4,L2=.46;va.set(tx-px,ty-py,tz);var d=Math.max(.2,Math.min(L1+L2-.01,va.length()));va.normalize();
  var cA=(L1*L1+d*d-L2*L2)/(2*L1*d),sA=Math.sqrt(Math.max(0,1-cA*cA));
  vp.set(sd*.7,-1,-.1);vp.addScaledVector(va,-vp.dot(va)).normalize();
  vb.copy(va).multiplyScalar(cA).addScaledVector(vp,sA);qa.setFromUnitVectors(QD,vb);q.quaternion.copy(qa);q.scale.y=1;
  var ex=px+vb.x*L1,ey=py+vb.y*L1,ez=vb.z*L1;vp.set(tx-ex,ty-ey,tz-ez).normalize();qb.setFromUnitVectors(QD,vp);
  q.userData.fa.quaternion.copy(qa).invert().multiply(qb);}
// aimArms(): positions both arms of bot e so the right hand holds its gun and the left hand supports it (or raises when celebrating).
function aimArms(e){var r=e.rc||0,ce=0,ph=tt*7+e.ph,gx0=Math.sin(tt*1.1+e.ph)*.015,gy0=.05*r+Math.sin(tt*1.7+e.ph)*.012,gx=gx0+ce*(.3+Math.sin(ph*.5)*.05),gy=gy0+ce*(.9+Math.abs(Math.sin(ph))*.1),gz=-.14*r;e.g.userData.gun.position.set(-.15+gx,gy,-.1+gz);aimA(e.arms[1],.55,1.3,.05+gx,.85+gy,.24+gz,1);aimA(e.arms[0],-.55,1.3,(.05+gx0)*(1-ce)-.6*ce,(.98+gy0)*(1-ce)+(2.25+Math.abs(Math.sin(ph+1))*.15)*ce,(.5+gz)*(1-ce)+.05*ce,-1);}
// flash(): hit-flash/knockback wobble of a bot after it takes damage (e.fl timer, e.hv/e.hx wobble).
function flash(e,dt){e.fl=Math.max(0,e.fl-dt);if(e.tm===undefined)return;e.hv=e.hv||0;e.hx=e.hx||0;e.hv+=(-e.hx*170-e.hv*13)*dt;e.hx+=e.hv*dt;var h=Math.max(-.5,Math.min(.9,e.hx));e.body.rotation.x-=h*.75;e.body.rotation.y+=h*(e.hs||1)*.35;e.body.position.y-=Math.abs(h)*.06;e.g.position.x+=(e.hdx||0)*h*.3;e.g.position.z+=(e.hdz||0)*h*.3;}
// ---- WEAPON TABLE ----
// Fields: n name | cd seconds between shots | dmg damage per pellet | spd bullet speed (units/s) | life bullet lifetime (s)
// pel pellets per shot | spr random spread (radians) | mag magazine size | res reserve ammo | rt reload time (s)
// r0/r1/rm damage falloff (full damage until r0, down to rm*dmg at r1) | rk rocket | melee knife | gr grenade
// dual = Dual Kriss | snp = sniper (bolt action).
// RANGE: a bullet flies spd x life units before it disappears (Dual Kriss: 150 x .6 = 90 units, Kriss: 150 x .22 = 33 units).
// If life is too small the bullet vanishes in mid-air and leaves no mark on far walls. r0/r1 only change the DAMAGE, not how far it flies.
// weapons
var WP=[{n:"Pistol",cd:.35,dmg:10,spd:140,life:.25,pel:1,spr:0,mag:12,res:Infinity,rt:1},
 {n:"Rifle",cd:.09,dmg:6,spd:160,life:.24,pel:1,spr:.07,mag:30,res:90,rt:1.4},
 {n:"Shotgun",cd:.65,dmg:8,spd:110,life:.13,pel:6,spr:.3,mag:6,res:24,rt:2.2},
 {n:"Rocket",cd:1,dmg:45,spd:15,life:2,pel:1,spr:0,mag:1,res:6,rt:1.8,rk:1},
 {n:"Knife",cd:.55,dmg:30,mag:1,res:Infinity,rt:1,melee:1,spd:0,life:0,pel:0,spr:0},
 {n:"Grenade",cd:1.1,dmg:45,mag:3,res:0,rt:1,gr:1,spd:0,life:0,pel:0,spr:0},
 // r0 = full-damage range, r1 = range where damage bottoms out at rm x dmg (bullet also dies near r1)
 {n:"Kriss",cd:.07,dmg:6,spd:150,life:.22,pel:1,spr:.025,mag:25,res:150,rt:1.5,r0:10,r1:32,rm:.45},
 {n:"Dual Kriss",cd:.05,dmg:5,spd:150,life:.6,pel:1,spr:.035,mag:150,res:0,rt:2.4,r0:14,r1:70,rm:.4,dual:1},
 {n:"AWP",cd:1.35,dmg:110,spd:420,life:.55,pel:1,spr:.14,mag:5,res:20,rt:2.6,r0:60,r1:200,rm:.85,snp:1}];
// EW: stats used for bot (enemy) bullets. Bots do not use the WP table.
var EW={dmg:7,spd:100,life:.55,pel:1,spr:0};
// CC: crate colors by contents (index = weapon crate type, see mkCrate/rci).
var CC=[0xffd23f,0x51cf66,0xb197fc];
// Shared geometries/materials for bullets and rockets (created once, reused).
var bG=new T.SphereGeometry(.15,8,8),rG=new T.SphereGeometry(.3,10,10),
 bpM=new T.MeshBasicMaterial({color:0xffe066}),beM=new T.MeshBasicMaterial({color:0xff4d4d}),rM=new T.MeshBasicMaterial({color:0xff922b});
// Main game-state variables. mt = match timer {t: time left, cd: pre-match countdown, over}. ts = team scores [police, terrorist].
// tt = global time. adsT = aim-down-sights blend 0..1. sprT = sprint blend 0..1. ADF = per-weapon FOV while aiming.
// AP = per-weapon viewmodel position while aiming. lob = true while the lobby/menu is shown.
// TEAM DEATH MATCH RULES. crates:false = NO airdrops at all. Crates are the only source of dropped weapons, ammo and medkits,
// so with this flag off nothing can be picked up during a match. Set to true only to bring the old airdrop behavior back.
// The flag guards BOTH crate sources: the random airdrop in update() and the loot crate dropped where a bot dies (killE).
// (Dead characters still toss their gun model as a visual effect, but it can NOT be picked up.)
var DM_RULES={crates:false};
var mt={t:60,cd:0,over:true},ts=[0,0],rq=[],ROS=[],curK=null,pl,en,bl,cr,fx,sk,score,run=false,spawnT,crateT,tt=0,toastT=0,adsT=0,sprT=0,ADF=[56,44,58,50,70,70,50,70,14],AP=[[0,-.066,-.5],[0,-.125,-.5],[0,-.078,-.5],[0,-.16,-.5],[0,-.1,-.5],[0,-.1,-.5],[0,-.13,-.5],[0,-.13,-.5],[0,-.14,-.5]],bobP=0,bobL=performance.now(),lob=true;
// mkPm()/pm: the visible body of the player (seen when dead/spectating). Its gun is hidden because the viewmodel is used instead.
function mkPm(tm){var m=terro(tm);if(m.g.userData.gun)m.g.userData.gun.visible=false;return m;}
var pm=mkPm(0);pm.g.visible=false;function resetPm(){pm.g.visible=false;if(pm.hm)pm.hm.visible=true;if(pm.hg)pm.hg.visible=true;if(pm.body){pm.body.rotation.set(0,0,0);pm.body.position.y=0;}(pm.arms||[]).concat(pm.legs||[]).forEach(function(q){q.rotation.z=0;});}
// bx()/cy(): helpers that return a colored box / cylinder mesh at (x,y,z). Used to build gun models and props.
function bx(w,h,d,c,x,y,z,rx){var m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshLambertMaterial({color:c}));m.position.set(x,y,z);if(rx)m.rotation.x=rx;return m;}
function cy(r1,r2,l,c,x,y,z){var m=new T.Mesh(new T.CylinderGeometry(r1,r2,l,12),new T.MeshLambertMaterial({color:c}));m.rotation.x=Math.PI/2;m.position.set(x,y,z);return m;}
// mkGun(i): builds the 3D model of weapon id i (see WEAPON IDS in the header). Barrel points to -z.
// Dual Kriss (7) = two Kriss models: right one at x=0, left one at x=-0.52.
// The AWP (8) stores its bolt handle in group.userData.bolt so animHands() can move it during the bolt cycle.
function mkGun(i){var g=new T.Group(),a=function(){for(var k=0;k<arguments.length;k++)g.add(arguments[k]);};
  if(i===0)a(bx(.09,.1,.45,0x9aa1ad,0,0,-.3),bx(.07,.06,.3,0x2b2f3d,0,-.07,-.3),bx(.08,.22,.1,0x2b2f3d,0,-.15,-.12,.25),cy(.028,.028,.12,0x1d2129,0,.01,-.58));
  else if(i===1)a(bx(.1,.12,.7,0x3b4252,0,0,-.35),cy(.025,.025,.5,0x1d2129,0,.02,-.9),bx(.12,.1,.3,0x6b4f3a,0,-.01,-.65),bx(.07,.22,.1,0x1d2129,0,-.17,-.4,.2),bx(.08,.14,.3,0x6b4f3a,0,-.02,.05),bx(.04,.05,.1,0x111111,0,.09,-.4),bx(.07,.16,.08,0x2b2f3d,0,-.13,-.15,.2));
  else if(i===2)a(cy(.035,.035,.9,0x4a4f5a,0,.03,-.55),cy(.03,.03,.7,0x333b48,0,-.03,-.5),bx(.1,.08,.22,0x8a5a2b,0,-.04,-.6),bx(.1,.12,.35,0x3b4252,0,0,-.1),bx(.08,.14,.4,0x8a5a2b,0,-.03,.2));
  else if(i===4){var ks=new T.Shape();ks.moveTo(0,-.045);ks.lineTo(.3,-.045);ks.lineTo(.44,-.02);ks.lineTo(.34,.035);ks.lineTo(.2,.047);ks.lineTo(0,.047);ks.closePath();
    var kg=new T.ExtrudeGeometry(ks,{depth:.016,bevelEnabled:false});kg.translate(0,0,-.008);kg.rotateX(-Math.PI/2);kg.rotateY(Math.PI/2);
    var kb=new T.Mesh(kg,new T.MeshLambertMaterial({color:0xdfe6ee}));kb.position.set(0,0,-.22);kb.castShadow=true;
    var pv2=new T.Group();pv2.add(kb,bx(.016,.006,.26,0x8f9aa8,0,.011,-.36),bx(.15,.03,.035,0x7a828f,0,0,-.215),bx(.05,.06,.2,0x2b2f3d,0,0,-.1),bx(.056,.064,.02,0x555c68,0,0,-.06),bx(.056,.064,.02,0x555c68,0,0,-.11),bx(.056,.064,.02,0x555c68,0,0,-.16),bx(.065,.07,.035,0x7a828f,0,0,.01));
    pv2.rotation.set(.55,0,.3);g.add(pv2);}
  else if(i===6)a(
    bx(.085,.1,.52,0x9c8b5e,0,.03,-.28),                       // upper receiver (FDE tan)
    bx(.08,.07,.34,0x2b2f3d,0,-.04,-.2),                        // lower receiver (dark polymer)
    bx(.09,.1,.2,0x8f7f55,0,.025,-.62),                         // barrel shroud
    bx(.092,.035,.03,0x111111,0,.03,-.56),bx(.092,.035,.03,0x111111,0,.03,-.62),bx(.092,.035,.03,0x111111,0,.03,-.68), // shroud vents
    cy(.017,.017,.14,0x1d2129,0,.03,-.79),cy(.026,.026,.05,0x111111,0,.03,-.87), // barrel + flash hider
    bx(.04,.022,.42,0x111111,0,.087,-.26),                      // top rail
    bx(.088,.03,.1,0x555c68,0,.05,-.12),                        // ejection port / bolt cover
    bx(.05,.02,.12,0x1d2129,0,.108,-.2),                        // red-dot base
    bx(.008,.05,.012,0x111111,-.026,.13,-.15),bx(.008,.05,.012,0x111111,.026,.13,-.15),bx(.06,.008,.012,0x111111,0,.158,-.15), // sight rear frame
    bx(.008,.05,.012,0x111111,-.026,.13,-.25),bx(.008,.05,.012,0x111111,.026,.13,-.25),bx(.06,.008,.012,0x111111,0,.158,-.25), // sight front frame
    bx(.007,.007,.004,0xff2a2a,0,.13,-.256),                    // red dot
    bx(.07,.26,.095,0x1d2129,0,-.17,-.12,-.3),                  // grip + magazine (angled back, Vector style)
    bx(.02,.025,.1,0x2b2f3d,0,-.09,-.22),                       // trigger guard
    bx(.05,.06,.035,0x2b2f3d,0,.03,0),bx(.06,.1,.03,0x1d2129,0,.0,.03)); // short folded stock + pad (kept tiny)
  else if(i===7){var kr=mkGun(6),kl=mkGun(6);kl.position.x=-.52;a(kr,kl);}
  else if(i===8){var bh=bx(.1,.025,.03,0x888e98,.07,.03,-.08);g.userData.bolt=bh;a(bx(.09,.13,.6,0x3b4a2a,0,0,-.1),cy(.018,.018,1,0x1d2129,0,.025,-.95),cy(.03,.03,.16,0x2b2f3d,0,.025,-1.5),bx(.085,.17,.45,0x3b4a2a,0,-.02,.4),bx(.09,.06,.18,0x2b2f3d,0,.07,.18),cy(.04,.04,.34,0x111111,0,.13,-.2),cy(.05,.05,.07,0x111111,0,.13,-.4),cy(.045,.045,.06,0x111111,0,.13,.0),bx(.03,.05,.04,0x333333,0,.09,-.3),bx(.07,.2,.09,0x2b2f3d,0,-.15,-.05,.2),bx(.06,.14,.1,0x2b2f3d,0,-.12,-.3),bh);}
  else if(i===5)a(bx(.15,.15,.15,0x4a5a2a,0,0,-.3),bx(.16,.03,.16,0x3a4620,0,.03,-.3),bx(.06,.05,.06,0x888e98,0,.1,-.3),bx(.04,.03,.14,0xaab0b9,0,.13,-.27),bx(.1,.02,.02,0xd4a017,.06,.1,-.36));
  else a(cy(.1,.1,1.1,0x5c6b3c,0,.03,-.4),cy(.1,.17,.2,0x3b4a2a,0,.03,-1),cy(.09,0,.28,0xe03131,0,.03,-1.2),bx(.07,.16,.08,0x2b2f3d,0,-.12,-.2,.2),bx(.04,.06,.1,0x111111,0,.12,-.3));
  return g;}
// hold = the first-person gun group (child of VS). guns[i] = model of weapon i; only guns[pl.w] is visible (set in loop()).
// mflash/mflash2 = muzzle flash spheres (mflash2 is the LEFT gun flash for Dual Kriss at x=-0.52).
var hold=new T.Group(),guns=[0,1,2,3,4,5,6,7,8].map(mkGun);guns[3].scale.setScalar(.8);guns.forEach(function(g){hold.add(g);});
var mflash=new T.Mesh(new T.SphereGeometry(.09,8,8),new T.MeshBasicMaterial({color:0xffe08a,transparent:true,opacity:.95}));mflash.visible=false;hold.add(mflash);var mflash2=mflash.clone();mflash2.visible=false;hold.add(mflash2);
VS.add(hold);
// ---- FIRST-PERSON HANDS & ANIMATION ----
// handR/handL/armR/armL are children of `hold`, so their positions are in viewmodel space (see header).
// hands and reload animation
// skin(): a skin-colored box (used for the hand model).
function skin(w,h,d,x,y,z){return bx(w,h,d,0xffd9a0,x,y,z);}
var handR=new T.Group(),handL=new T.Group();
handR.add(skin(.13,.13,.17,0,0,0));handL.add(skin(.13,.13,.17,0,0,0));
var mvAmt=0,wtT=0,camY=0;
// mkArm(): builds one first-person sleeve (long box scaled by aim() so it stretches from shoulder to hand).
function mkArm(){var g=new T.Group(),m=bx(.13,.13,1,0x339af0,0,0,0);m.geometry.translate(0,0,.5);g.add(m,bx(.16,.16,.1,0x1c7ed6,0,0,.09));g.rotation.order="YXZ";return g;}
var armR=mkArm(),armL=mkArm(),SHR=[.24,-.6,.65],SHL=[-.76,-.6,.65];
// aim(): stretches/rotates arm group `a` so it goes from shoulder s to hand position h.
function aim(a,h,s){var dx=s[0]-h[0],dy=s[1]-h[1],dz=s[2]-h[2],hz=Math.hypot(dx,dz);a.position.set(h[0],h[1],h[2]);a.rotation.y=Math.atan2(dx,dz);a.rotation.x=-Math.atan2(dy,hz);a.children[0].scale.z=Math.hypot(hz,dy);}
var magP=new T.Group(),shP=new T.Group(),rkP=new T.Group();
magP.add(bx(.07,.2,.1,0x1d2129,0,.13,0),bx(.065,.03,.095,0xd4a017,0,.24,0));
shP.add(cy(.035,.035,.14,0xe03131,0,.07,0),cy(.036,.036,.04,0xd4a017,0,.07,.09));
rkP.add(cy(.07,.07,.3,0x5c6b3c,0,.1,0),cy(.07,0,.2,0xe03131,0,.1,-.24));
magP.visible=shP.visible=rkP.visible=false;
handL.add(magP,shP,rkP);hold.add(handR,handL,armR,armL);
// Hand/anim tables, indexed by weapon id: RG = right-hand grip position, RL = left-hand rest position,
// PT = left-hand "port" position for the reload animation, MODE = reload style (0 = mag swap, 1 = loop-load shells/rocket),
// NC = number of loop cycles in a loop reload, DD = left-hand "drop" position (below the gun) used in reload animations.
var RG=[[0,-.2,-.1],[0,-.2,-.15],[0,-.13,-.08],[0,-.14,-.2],[0,.02,-.09],[0,-.1,-.3],[0,-.22,-.1],[0,-.22,-.1],[0,-.19,-.06]],
 RL=[[-.03,-.22,-.22],[0,-.09,-.62],[0,-.1,-.58],[0,-.1,-.7],[-.3,-.5,-.1],[-.3,-.5,-.1],[0,-.09,-.5],[-.52,-.22,-.1],[0,-.1,-.62]],
 PT=[[0,-.2,-.28],[0,-.24,-.4],[0,-.12,-.2],[0,.02,-.95],[0,0,0],[0,0,0],[0,-.24,-.35],[0,0,0],[0,-.24,-.42]],
 MODE=[0,0,1,1,0,0,0,0,0],NC=[1,1,3,1,1,1,1,1,1],DD=[-.1,-.34,-.28];
// xp(w): extra viewmodel offsets [x,y,z,rotX,rotY,rotZ] for weapon switch, knife stab and grenade throw animations.
function xp(w){var r=[0,0,0,0,0,0],u,p,s,q,b,f;
  if(pl.sw>0){u=pl.sw/.28;u=u*u;r[1]-=u*.55;r[3]+=u*.7;r[4]+=u*.3;}
  if(w===4){r[3]+=.1;r[4]+=.15;r[5]-=.1;
    if(pl.stab>0){p=1-pl.stab/.42;var wa=[.28,.16,.16,-.35,.7,-.7],sa=[-.6,-.22,-.3,.3,-1.25,.95],k,i2;
      if(p<.25){k=p/.25;k=k*k*(3-2*k);for(i2=0;i2<6;i2++)r[i2]+=wa[i2]*k;}
      else if(p<.6){k=(p-.25)/.35;k=1-(1-k)*(1-k);for(i2=0;i2<6;i2++)r[i2]+=wa[i2]+(sa[i2]-wa[i2])*k;}
      else{k=(p-.6)/.4;k=1-k*k*(3-2*k);for(i2=0;i2<6;i2++)r[i2]+=sa[i2]*k;}}}
  if(w===5&&pl.thr>0){q=1-pl.thr/.5;b=0;f=0;
    if(q<.45)b=Math.sin(q/.45*Math.PI/2);else{b=Math.max(0,1-(q-.45)/.15);f=Math.sin(Math.min(1,(q-.45)/.15)*Math.PI/2)*Math.max(0,1-(q-.6)/.4);}
    r[1]+=b*.12-f*.05;r[2]+=b*.28-f*.35;r[3]+=b*.9-f*1.2;r[4]+=b*.2;}
  return r;}
// lp(): smoothstep interpolation between 3D points a and b (t is clamped to 0..1).
function lp(a,b,t){t=Math.max(0,Math.min(1,t));t=t*t*(3-2*t);return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
// animHands(): called every frame from loop(). Positions the gun (`hold`), hands and arms for: idle bob, walking, sprint,
// aim-down-sights, recoil kick, reload animation (progress t = 1 - pl.rl / reload time), and the AWP bolt-action cycle (pl.bolt).
function animHands(){
  var w=pl.w,rest=RL[w],port=PT[w],t=pl.rl>0?1-pl.rl/WP[w].rt:-1,pos=rest,pr=0,tilt=0;
  handR.position.set(RG[w][0],RG[w][1],RG[w][2]);
  if(t>=0){tilt=Math.sin(Math.PI*t);
    if(w===7){}else if(MODE[w]===0){
      if(t<.2)pos=lp(rest,port,t/.2);
      else if(t<.4){pos=lp(port,DD,(t-.2)/.2);pr=1;}
      else if(t<.5)pos=DD;
      else if(t<.55){pos=DD;pr=1;}
      else if(t<.8){pos=lp(DD,port,(t-.55)/.25);pr=1;}
      else if(t<.88){pos=[port[0],port[1]+.04*Math.sin(Math.PI*(t-.8)/.08),port[2]];pr=t<.85?1:0;}
      else pos=lp(port,rest,(t-.88)/.12);
    }else{
      var n=NC[w];
      if(t<.12)pos=lp(rest,DD,t/.12);
      else if(t<.82){var u=((t-.12)/.7*n)%1;
        if(u<.45){pos=lp(DD,port,u/.45);pr=w===3?3:2;}else if(u<.6)pos=port;else pos=lp(port,DD,(u-.6)/.4);}
      else{var q=(t-.82)/.18;pos=lp(DD,rest,Math.min(1,q*1.6));if(w===2&&q>.6)pos[2]+=.2*Math.sin(Math.PI*(q-.6)/.4);}
    }
  }
  var tm=performance.now()/1000;bobP+=(tm*1000-bobL)/1000*(7.5+4*sprT)*(1-.2*wtT);bobL=tm*1000;var sw=Math.sin(bobP),bm=mvAmt,idle=Math.sin(tm*1.7),rl=t>=0,wob=rl?Math.sin(Math.PI*t*3)*.02:0;
  handR.position.y+=rl?-tilt*.05:0;handR.position.z+=rl?tilt*.04:0;
  var lx=pos[0],ly=pos[1]+wob,lz=pos[2];
  handL.position.set(lx,ly,lz);handL.rotation.set(rl?-tilt*.6:0,0,rl?Math.sin(t*20)*.15*tilt:0);
  magP.visible=pr===1;shP.visible=pr===2;rkP.visible=pr===3;
  var X=xp(w);
  var a=canAds(w)?adsT*adsT*(3-2*adsT):0,sp=sprT*(1-a),bb=bm*(1-.85*a)*(1+.7*sp)*(1+.5*wtT),AA=AP[w]||AP[0];
  hold.position.set((.26+sw*.012*bb+X[0]-.09*sp)*(1-a)+AA[0]*a,(-.17-tilt*.12-Math.abs(sw)*.02*bb+idle*.004+X[1]-.07*sp)*(1-a)+AA[1]*a,(-.5+kick*(1-.5*a)+tilt*.06+X[2]+.03*sp)*(1-a)+AA[2]*a);
  hold.rotation.set((kick*.6+tilt*.45+idle*.004+X[3])*(1-.8*a)-.42*sp,(tilt*.3+X[4])*(1-a)+.55*sp,(-tilt*.35+sw*.012*bb+X[5])*(1-a)+.18*sp);
  var bh8=guns[8].userData.bolt;
  if(bh8){var bo=(w===8&&pl.rl<=0)?(pl.bolt||0):0;
    if(bo>0){var bp=1-bo/BOLT_T,hg=0,pu=0,lf=0;
      if(bp<.15)hg=bp/.15;else if(bp<.3){hg=1;lf=(bp-.15)/.15;}else if(bp<.5){hg=lf=1;pu=(bp-.3)/.2;}else if(bp<.6){hg=lf=pu=1;}else if(bp<.78){hg=lf=1;pu=1-(bp-.6)/.18;}else if(bp<.88){hg=1;lf=1-(bp-.78)/.1;}else hg=1-(bp-.88)/.12;
      hg=hg*hg*(3-2*hg);lf=lf*lf*(3-2*lf);pu=pu*pu*(3-2*pu);
      if(bp>=.4&&!pl.bc){pl.bc=1;ejectShell(8,1);}
      var by=.03+.04*lf,bz=-.08+.17*pu;bh8.position.set(.07,by,bz);
      handR.position.set(RG[8][0]+(.07-RG[8][0])*hg,RG[8][1]+(by-.04-RG[8][1])*hg,RG[8][2]+(bz-RG[8][2])*hg);}
    else bh8.position.set(.07,.03,-.08);}
  aim(armR,[handR.position.x,handR.position.y,handR.position.z],SHR);aim(armL,[lx,ly,lz],SHL);handL.visible=armL.visible=(w<4||w>5);
}
// BOLT_T = AWP bolt-action cycle length in seconds (must stay <= the AWP fire cooldown so the next shot is possible when it ends).
// MZ = per-weapon muzzle z offset in viewmodel space (where bullets and muzzle flash start). kick = recoil offset. flashT = muzzle flash time left.
var BOLT_T=1.1,MZ=[-.7,-1,-1.15,-1.2,-.9,-.3,-.9,-.9,-1.62],kick=0,flashT=0;
// mkPick(): small floating weapon model shown on top of a crate. ci = crate type (weapon id = ci + 1).
function mkPick(ci){var g=new T.Group(),gn=mkGun(ci+1);gn.scale.setScalar(ci===2?1.2:1.5);gn.position.z=[0,.5,.45,.72][ci+1];g.add(gn);
  g.add(new T.Mesh(new T.SphereGeometry(.85,16,12),new T.MeshBasicMaterial({color:CC[ci],transparent:true,opacity:.22,depthWrite:false})));return g;}
// mkMed(): medkit model for crates with ci === 3 (heals +40 HP, see pick()).
function mkMed(){var g=new T.Group(),r=0xe03131;g.add(bx(.8,.6,.8,0xf8f9fa,0,0,0));
  for(var k=0;k<4;k++){var s=new T.Group();s.rotation.y=k*Math.PI/2;s.add(bx(.36,.1,.03,r,0,0,.41),bx(.1,.36,.03,r,0,0,.41));g.add(s);}
  g.add(bx(.36,.03,.1,r,0,.31,0),bx(.1,.03,.36,r,0,.31,0));
  g.add(new T.Mesh(new T.SphereGeometry(.85,16,12),new T.MeshBasicMaterial({color:0x69db7c,transparent:true,opacity:.2,depthWrite:false})));return g;}
// rci(): random crate contents. Returns 3 (medkit) more often when the player HP is low, otherwise 0..2 (rifle/shotgun/rocket crates).
function rci(){return Math.random()<(pl.hp<50?.5:.25)?3:Math.floor(Math.random()*3);}
// Tracer (bullet streak) geometry and materials. coreM = white core, glP = player glow (yellow), glE = enemy glow (red), glR = rocket glow (orange).
var trG=new T.CylinderGeometry(1,1,1,6);trG.rotateX(Math.PI/2);
var coreM=new T.MeshBasicMaterial({color:0xffffff}),
 glP=new T.MeshBasicMaterial({color:0xffc233,transparent:true,opacity:.28,blending:T.AdditiveBlending,depthWrite:false}),
 glE=new T.MeshBasicMaterial({color:0xff3b3b,transparent:true,opacity:.3,blending:T.AdditiveBlending,depthWrite:false}),
 glR=new T.MeshBasicMaterial({color:0xff7a1a,transparent:true,opacity:.6,blending:T.AdditiveBlending,depthWrite:false});
// tracer(): builds a bullet mesh (white core + additive glow). own = "p" (player) or "e" (enemy), rk = rocket (bigger).
function tracer(own,rk){var g=new T.Group(),L=rk?.9:1.1,r=rk?.1:.016;
  var c=new T.Mesh(trG,coreM);c.scale.set(r,r,L);var gl=new T.Mesh(trG,own==="p"?(rk?glR:glP):glE);gl.scale.set(r*2.6,r*2.6,L*1.15);g.add(c,gl);return g;}
// spark(): spawns n small additive particles at (x,y,z). Stored in `sk`, moved/faded in update().
var spG=new T.SphereGeometry(1,6,6),spM={};
function spark(x,y,z,col,n,sp,sz){var m0=spM[col]||(spM[col]=new T.MeshBasicMaterial({color:col,transparent:true,opacity:.9,blending:T.AdditiveBlending,depthWrite:false}));
  for(var i=0;i<n;i++){var m=new T.Mesh(spG,m0),a=Math.random()*6.28,b=Math.random()*2-1,k=Math.sqrt(1-b*b),v=sp*(.4+Math.random()*.6);
    m.position.set(x,y,z);S.add(m);sk.push({m:m,vx:Math.cos(a)*k*v,vy:b*v+(n>1?2:.4),vz:Math.sin(a)*k*v,t:0,l:n>1?.3+Math.random()*.25:.5,sz:sz});}}
// reset(): clears the whole world state (bullets, bots, particles, decals) and re-creates the player object `pl` for a fresh match.
function reset(){
  [].concat(en||[],bl||[],cr||[],fx||[],sk||[],dead||[],grs||[],dg||[],chutes||[]).forEach(function(o){S.remove(o.g||o.m);});document.getElementById("kn").innerHTML="";DC.forEach(function(m){S.remove(m);});DC=[];CH.forEach(function(c){S.remove(c.m);});CH=[];cs.k=cs.s=cs.kv=cs.y=cs.yv=cs.r=cs.rv=0;clrSm();clrFD();mzf.forEach(function(q){S.remove(q.m);});mzf=[];
  pl={helm:true,dead:false,dt:0,rt:0,life:0,x:0,z:10,hp:100,w:1,mag:30,res:90,rl:0,cd:0,face:Math.PI,pitch:0,y:0,vy:0,slot:0,prim:1,sw:0,stab:0,sth:false,thr:0,pend:false,ghide:0,ammo:(function(){var o={};WP.forEach(function(w,i){o[i]={mag:w.mag,res:w.res};});return o;})()};en=[];bl=[];cr=[];fx=[];sk=[];dead=[];dg=[];grs=[];chutes=[];ck={n:0,t:0,hs:0};shakeT=0;score=0;spawnT=1;crateT=.5;adsT=sprT=0;resetPm();hlms.forEach(function(h){S.remove(h.m);});hlms=[];setHm();document.body.classList.remove("dead");
}
// toast(): shows a short message in the middle of the screen (toastT = time left).
function toast(t){var e=document.getElementById("toast");e.textContent=t;e.style.opacity=1;toastT=1.4;}
// fire(o, face, w, own, adv): shoots weapon table entry `w` from shooter `o` (player `pl` or a bot) facing `face`.
//  own = "p" (player) or "e" (enemy bot). adv = extra time already elapsed (lets high fire-rate weapons catch up within a frame).
//  Player bullets start at the visible muzzle (hold.position + MZ) and are aimed at the crosshair distance D.
//  Dual Kriss: shotSide flips each shot (0 = right gun, 1 = left gun at x-0.52) and the bullet spawns from that gun.
//  Tracers are only visible for every 3rd bullet of rapid-fire weapons (performance); collision still happens for all bullets.
function fire(o,face,w,own,adv){var D=w.snp?90:w.dual?45:20;
  for(var i=0;i<w.pel;i++){var a=face+(Math.random()-.5)*2*w.spr*(own==="p"?(w.snp?1-adsT:1-.65*adsT):1),g=tracer(own,w.rk);
    var mx0,my0,mz0;if(own==="p"){if(w.dual)shotSide=shotSide?0:1;var lx=hold.position.x-(w.dual&&shotSide?.52:0),dd=-(hold.position.z+MZ[pl.w]);mx0=o.x+Math.sin(face)*dd-Math.cos(face)*lx;mz0=o.z+Math.cos(face)*dd+Math.sin(face)*lx;my0=1.5+(o.y||0)+hold.position.y+.02;a+=Math.atan(lx/D);}else{var ey=face;mx0=o.x+Math.sin(ey)*1.1+Math.cos(ey)*.05;mz0=o.z+Math.cos(ey)*1.1-Math.sin(ey)*.05;my0=1.07+(o.y||0)-.3*(o.crA||0);}
    var vy0=own==="p"?w.spd*(1.5+(o.y||0)+D*Math.tan(pl.pitch)-my0)/D:0;o.tc=(o.tc||0)+1;g.visible=!!(w.rk||w.pel>1||w.snp||o.tc%3===1);g.rotation.order="YXZ";g.rotation.set(-Math.atan2(vy0,w.spd||1),a,0);if(Math.abs(mx0)>=A||Math.abs(mz0)>=A||sweepObs(o.x,my0,o.z,mx0,my0,mz0)||sweepLT(o.x,my0,o.z,mx0,my0,mz0)||obsAt(mx0,mz0,my0)){mx0=o.x;mz0=o.z;}
    g.position.set(mx0,my0,mz0);S.add(g);
    var ad=adv||0;
    bl.push({m:g,vx:Math.sin(a)*w.spd,vy:vy0,vz:Math.cos(a)*w.spd,life:w.life,ad:ad,dmg:w.dmg,own:own,tm:o.tm,by:o,rk:w.rk,sx:o.x,sz:o.z,wid:WP.indexOf(w),fo:w.r1?[w.r0,w.r1,w.rm]:null});if(own==="e"&&i===0)enemyShotFx(o,mx0,my0,mz0);if(w.rk&&own==="p")smoke(mx0,my0,mz0,6,1.4,.3,1.3,.25,0);}
}
// boom(): explosion (rocket or grenade) at (x,z): splash damage with line-of-sight check, scorch decal, particles, camera shake. lab = kill-feed label.
function boom(x,z,dmg,lab,by){curK=pl;boomLab=lab||"RPG";killW=boomLab==="GRENADE"?5:3;if((by===undefined||by<1.1)&&Math.abs(x)<A&&Math.abs(z)<A)gDecal(TXS,x,z,3.2+Math.random()*.6);
  var m=new T.Mesh(new T.SphereGeometry(1,14,14),new T.MeshBasicMaterial({color:0xffa94d,transparent:true,opacity:.7}));
  m.position.set(x,Math.max(.3,Math.min(1.5,by||1)),z);S.add(m);fx.push({m:m,t:0});spark(x,1,z,0xffa94d,26,9,.28);spark(x,1,z,0xfff3bf,10,5,.2);var sy=Math.max(.3,Math.min(1.5,by||1));smoke(x,sy,z,8,3.2,1,2.4,1.2,1);smoke(x,.35,z,10,4.5,.9,2.2,.25,0);smoke(x,sy+.4,z,5,1.2,1.2,3,1.6,1);
  boomN=0;inBoom=true;
  en.slice().forEach(function(e){if(e.tm===pl.tm)return;var dd=Math.hypot(e.x-x,e.z-z);if(dd<4.2&&clearTo(x,z,e.x,e.z,.45)){var k=dd||1;dmgE(e,dmg,(e.x-x)/k,(e.z-z)/k,1);}});
  inBoom=false;var pd=Math.hypot(pl.x-x,pl.z-z);if(pd<4.2&&clearTo(x,z,pl.x,pl.z,.45))hurt(Math.ceil(dmg*(1-pd/4.2*.8)),x,z);shakeT=Math.max(shakeT,.35);if(boomN>0)killNotify(boomN>2);
}
// Parachute system for airdrop crates: mkChute builds one, updChutes animates the fall, dropChute detaches it on landing.
var chutes=[],CHC=[0xf08c00,0x1c7ed6,0x7048e8,0xe03131];
function mkChute(ci){var g=new T.Group(),c1=new T.MeshLambertMaterial({color:CHC[ci]||0xf08c00}),c2=new T.MeshLambertMaterial({color:0xf8f9fa}),rp=new T.MeshLambertMaterial({color:0x343a40});
  [[3.6,.3,0],[3.0,.3,.3],[2.2,.3,.6],[1.2,.3,.9]].forEach(function(l){var w=l[0],sw=w/3;[[-1,c1],[0,c2],[1,c1]].forEach(function(q){var m=new T.Mesh(new T.BoxGeometry(sw,l[1],w),q[1]);m.position.set(q[0]*sw,l[2],0);m.castShadow=true;g.add(m);});});
  [[-1.6,-1.6,-.3,-.3],[1.6,-1.6,.3,-.3],[-1.6,1.6,-.3,.3],[1.6,1.6,.3,.3]].forEach(function(q){var a=new T.Vector3(q[0],-.15,q[1]),b=new T.Vector3(q[2],-2.5,q[3]),len=a.distanceTo(b),m=new T.Mesh(new T.BoxGeometry(.05,.05,len),rp);m.position.copy(a).add(b).multiplyScalar(.5);m.lookAt(b);g.add(m);});
  return g;}
function dropChute(c){var pc=c.pc;if(!pc)return;c.pc=null;c.m.remove(pc);pc.position.set(c.x,c.y+3.05,c.z);pc.rotation.set(0,c.m.rotation.y,0);S.add(pc);
  chutes.push({m:pc,t:0,y0:c.y+3.05,sx:pc.scale.x,sy:pc.scale.y,wx:(Math.random()-.5)*3,wz:(Math.random()-.5)*3,tw:(Math.random()-.5)*1.2});spark(c.x,.5,c.z,0xdee2e6,10,2.2,.1);}
function updChutes(dt){for(var ki=chutes.length-1;ki>=0;ki--){var h=chutes[ki],m=h.m,u,e,f;h.t+=dt;u=Math.min(1,h.t/1.8);e=u*u*(3-2*u);
  m.scale.set(h.sx*(1+.5*e),h.sy*(1-.82*e),h.sx*(1+.5*e));m.position.y=h.y0+(.25-h.y0)*e*e;m.position.x+=h.wx*dt*(1-u);m.position.z+=h.wz*dt*(1-u);m.rotation.z=h.tw*e;
  if(h.t>2.6){f=(h.t-2.6)/.8;if(!h.fd){h.fd=1;m.traverse(function(o){if(o.material)o.material.transparent=true;});}m.traverse(function(o){if(o.material)o.material.opacity=Math.max(0,1-f);});if(f>=1){S.remove(m);chutes.splice(ki,1);}}}}
// mkCrate(): spawns an airdrop crate (cr list) at (x,z) falling from height y with a parachute. ci = contents (0..2 weapon, 3 medkit).
function mkCrate(x,z,y,ci){
  var g=ci===3?mkMed():mkPick(ci);g.position.set(x,y,z);S.add(g);var c={m:g,x:x,z:z,y:y,vy:0,ci:ci,land:y<=.45+gh(x,z,0)+.001,age:0};
  if(!c.land){c.pc=mkChute(ci);c.pc.position.y=3.05;c.pc.scale.setScalar(.2);g.add(c.pc);}cr.push(c);
}
// dg = physics "drops": dropped guns and ejected shell casings (items with sp/life/cs fields). Updated by updDrops().
var dg=[];
// addDrop(): gives mesh m a velocity and puts it in the dg list so it falls, bounces and settles. h = rest height, keep = never expire, tz = lying rotation.
function addDrop(m,vx,vy,vz,h,keep,tz){m.rotation.order="YXZ";m.traverse(function(o){if(o.isMesh)o.castShadow=true;});
  dg.push({m:m,vx:vx,vy:vy,vz:vz,sp:(Math.random()<.5?-1:1)*(4+Math.random()*3),h:h,tz:tz,keep:keep,t:0,land:false,bn:0,life:7});}

// Shell casings. CSP = ejection port position per casing type (hold-local). Casing types: 0 pistol/SMG brass, 1 rifle brass, 2 shotgun hull.
// --- ejected shell casings (right side of weapon; shape matches the weapon) ---
var CSM={br:new T.MeshLambertMaterial({color:0xd9a93a}),bl:new T.MeshLambertMaterial({color:0xf0cf70}),rd:new T.MeshLambertMaterial({color:0xd6362b})},CSG={},CSR=[.024,.026,.037],
CSP=[[.05,.02,-.25],[.06,.03,-.35],[.06,.03,-.1]];
// csGeo(): cached cylinder geometry for casing parts.
function csGeo(a,b,l){var k=a+"_"+b+"_"+l;return CSG[k]||(CSG[k]=new T.CylinderGeometry(a,b,l,8));}
// mkCasing(w): builds a casing mesh. w = casing type 0/1/2 (NOT always the weapon id; Kriss uses 0, AWP uses 1).
function mkCasing(w){var g=new T.Group();function c(a,b,l,m,y){var q=new T.Mesh(csGeo(a,b,l),m);q.position.y=y;g.add(q);}
  if(w===0){c(.024,.024,.012,CSM.bl,-.034);c(.02,.02,.06,CSM.br,0);}                                   // pistol: short straight-wall 9mm brass
  else if(w===1){c(.026,.026,.012,CSM.bl,-.061);c(.024,.022,.08,CSM.br,-.012);c(.012,.022,.03,CSM.br,.043);} // rifle: long bottleneck brass
  else{c(.037,.037,.045,CSM.bl,-.05);c(.034,.034,.11,CSM.rd,.03);}                                      // shotgun: red plastic hull + brass base
  g.scale.setScalar(.5);return g;}
// ejectShell(w, side): throws a spent casing from the gun port. Supports weapons 0-2, Kriss (6), Dual Kriss (7) and AWP (8).
//  side = +1 throws to the player's RIGHT, -1 to the LEFT. Single guns always use +1. Dual Kriss uses -1 for the left gun (shotSide = 1).
//  The AWP casing is thrown from the bolt (called mid bolt-cycle from animHands(), not from the shot itself).
function ejectShell(w,side){var sm=(w===6||w===7);if(w>2&&!sm&&w!==8)return;side=side||1;var cw=sm?0:(w===8?1:w);
  var v=new T.Vector3(CSP[cw][0],CSP[cw][1],CSP[cw][2]);if(sm){v.x=side<0?-.52-CSP[0][0]:CSP[0][0];}if(w===8)v.set(.09,.06,-.08);hold.localToWorld(v);
  var k=Math.tan(35*Math.PI/180)/Math.tan(C.fov*Math.PI/360);v.x*=k;v.y*=k;C.localToWorld(v);
  var d=new T.Vector3((2.5+Math.random()*.4)*side,1.1+Math.random()*.25,.02+Math.random()*.06).applyQuaternion(C.quaternion);
  var m=mkCasing(cw);m.position.copy(v);m.rotation.set(0,0,Math.random()*6);S.add(m);
  addDrop(m,d.x,d.y,d.z,CSR[cw]*.5,false,Math.PI/2);
  var q=dg[dg.length-1];q.sp=8+Math.random()*3;q.life=1;q.cs=1;
  m.traverse(function(o){o.castShadow=false;});
  var n=0;for(var i=dg.length-1;i>=0;i--)if(dg[i].cs&&++n>20){S.remove(dg[i].m);dg.splice(i,1);}}
// GSC = size of a dropped gun model per weapon id, GH = rest height of a dropped gun per weapon id.
var GSC=[1.5,1.2,1.2,1,2,2,1.2,1,1.2],GH=[.07,.09,.09,.17,.03,.1,.09,.09,.09];
// dropPlayerGun(): when the player dies, throws the current weapon model onto the ground.
function dropPlayerGun(){var w=pl.w,g=mkGun(w),f=pl.face,s=Math.sin(f),c=Math.cos(f);
  g.scale.setScalar(GSC[w]);g.rotation.order="YXZ";g.rotation.y=f+Math.PI;
  g.position.set(pl.x+.55*c+.4*s,1.05,pl.z-.55*s+.4*c);S.add(g);
  addDrop(g,s*1.8+c*.9,2.4,c*1.8-s*.9,GH[w],true,(w===4||w===5)?0:(w===3?.6:Math.PI/2));}
// detachGun(): when a bot dies, its gun flies off. kx/kz = knock direction, ex = exaggerated (explosion) throw.
function detachGun(e,kx,kz,ex){var rg=e.g.userData.rg;if(!rg)return;e.g.userData.rg=null;
  var gm=Math.hypot(kx||0,kz||0)||1,k=ex?5:1.6;rg.rotation.order="YXZ";S.attach(rg);
  addDrop(rg,(kx||0)/gm*k+(Math.random()-.5)*1.2,ex?5:2.2,(kz||0)/gm*k+(Math.random()-.5)*1.2,.09,false,Math.PI/2);}
// wrapA(): wraps an angle to the range [-PI, PI].
function wrapA(a){return((a+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;}
// updDrops(dt): physics step for dg (falling, bouncing, sliding, fading casings and guns).
function updDrops(dt){
  for(var i=dg.length-1;i>=0;i--){var d=dg[i],m=d.m;d.t+=dt;
    if(!d.land){
      d.vy-=16*dt;m.position.x+=d.vx*dt;m.position.z+=d.vz*dt;m.position.y+=d.vy*dt;resolve(m.position,.25);
      m.rotation.z+=d.sp*dt;m.rotation.x+=d.sp*.35*dt;
      var gy=gh(m.position.x,m.position.z,m.position.y)+d.h;
      if(m.position.y<=gy&&d.vy<0){m.position.y=gy;
        if(d.bn<1&&-d.vy>3){d.vy=-d.vy*.3;d.bn++;d.vx*=.5;d.vz*=.5;d.sp*=.5;if(!d.cs)spark(m.position.x,gy,m.position.z,0xcfcfcf,4,1.6,.08);}
        else{d.land=true;d.vx=d.vz=d.vy=0;if(d.tz===undefined)d.tz=Math.PI/2;if(d.tz!==0&&d.tz!==.6)d.tz=(Math.sin(m.rotation.z)>=0?1:-1)*d.tz;else if(d.tz===.6)d.tz=(Math.sin(m.rotation.z)>=0?1:-1)*.6;}}
    }else{
      var k=Math.min(1,dt*12);m.rotation.x+=wrapA(0-m.rotation.x)*k;m.rotation.z+=wrapA(d.tz-m.rotation.z)*k;
      if(!d.keep&&d.t>d.life){var b=d.t-d.life;m.visible=Math.floor(b*14)%2===0;if(b>.6){S.remove(m);dg.splice(i,1);}}
    }
  }
}
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
// ---- SOUND & MUZZLE FLASH ----
// GS = synthesized gun sound presets {f frequency, v volume, d decay, t type}. SFXI maps weapon id -> preset index (AWP uses preset 4).
// No audio files: sounds are generated with WebAudio. SND = master sound switch.
// --- sound & muzzle flash ---
var GS=[{f:1800,v:.22,d:.09,t:180},{f:1400,v:.2,d:.1,t:140},{f:900,v:.45,d:.22,t:100},{f:500,v:.5,d:.4,t:70},{f:700,v:.8,d:.6,t:55}],SFXI=[0,1,2,3,3,3,1,1,4];
// gunSfx(): plays a synthesized gun/explosion sound from preset k at volume vol (does nothing if sound is off or too quiet).
function gunSfx(k,vol){if(!SND||vol<=.02)return;try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();if(AC.state==="suspended")AC.resume();
  if(!nbuf){nbuf=AC.createBuffer(1,Math.floor(AC.sampleRate*.25),AC.sampleRate);var dd=nbuf.getChannelData(0);for(var i=0;i<dd.length;i++)dd[i]=Math.random()*2-1;}
  var t=AC.currentTime,sr=AC.createBufferSource(),fl=AC.createBiquadFilter(),g=AC.createGain(),o=AC.createOscillator(),g2=AC.createGain(),v=vol*k.v;
  sr.buffer=nbuf;fl.type="bandpass";fl.frequency.value=k.f*(.9+Math.random()*.2);fl.Q.value=.7;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+k.d);sr.connect(fl);fl.connect(g);g.connect(AC.destination);sr.start(t);sr.stop(t+k.d+.02);
  o.type="sine";o.frequency.setValueAtTime(k.t,t);o.frequency.exponentialRampToValueAtTime(40,t+k.d);g2.gain.setValueAtTime(v*.9,t);g2.gain.exponentialRampToValueAtTime(.0001,t+k.d);o.connect(g2);g2.connect(AC.destination);o.start(t);o.stop(t+k.d+.02);}catch(e){}}
// enemyShotFx(): muzzle flash and sound for a bot shot (volume depends on distance to the player).
function enemyShotFx(o,x,y,z){var m=new T.Mesh(spG,mzfM);m.position.set(x,y,z);m.scale.setScalar(.14+Math.random()*.1);S.add(m);mzf.push({m:m,t:.05});
  if(sndN<3){sndN++;gunSfx(GS[1],.45*Math.max(0,1-Math.hypot(pl.x-o.x,pl.z-o.z)/20));}}
// gImpact(): bullet impact on the ground at point p (small decal + dust).
function gImpact(p){if(Math.abs(p.x)>A||Math.abs(p.z)>A)return;gDecal(TXH[(Math.random()*3)|0],p.x,p.z,.38*rr(.85,1.15));spark(p.x,.08,p.z,0xd9d0bb,3,1.6,.1);}
// Camera recoil per weapon id: CKV = pitch kick, CKS = shake strength, CKY = random yaw kick, CKR = random roll kick (camShot() applies them, reduced while aiming).
var CKV=[.55,.38,1.4,1.7,0,0,.25,.2,2.4],CKS=[.6,.5,1,1,0,0,.3,.3,1.2],CKY=[.25,.3,.6,.7,0,0,.08,.05,.4],CKR=[.5,.6,1,1.2,0,0,.15,.12,.8];
// camShot(w): adds camera recoil for weapon w. Knife and grenade have none.
function camShot(w){if(w===4||w===5)return;var a=1-.45*adsT;cs.kv+=CKV[w]*a;if(cs.k>.12)cs.kv*=.3;cs.yv+=(Math.random()-.5)*CKY[w]*a;cs.rv+=(Math.random()-.5)*CKR[w]*a;cs.s=Math.max(cs.s,CKS[w]);}
// spr(): spring-damper step used for camera recoil recovery (value o[a], velocity o[b]).
function spr(o,a,b,dt){o[b]+=(-o[a]*150-o[b]*15)*dt;o[a]+=o[b]*dt;if(o[a]>.16)o[a]=.16;else if(o[a]<-.16)o[a]=-.16;}
// snz(): cheap smooth pseudo-noise in about [-1,1] for camera shake (t = time, k = channel seed).
function snz(t,k){return Math.sin(t*(31+k*7.3)+k*1.7)*.6+Math.sin(t*(53+k*3.1)+k*4.3)*.4;}
// ck = kill-chain tracker {n kills in chain, t timer, hs headshot streak}. Other globals: dead = ragdoll list, shakeT = screen shake time, AC = AudioContext, grs = grenades.
var ck={n:0,t:0,hs:0},hsF=false,dead=[],inBoom=false,boomN=0,shakeT=0,AC=null,boomLab="RPG",grs=[];
// dmgE(): applies damage d to bot e (knock direction kx,kz). Handles invulnerability, hit flash and calls killE() at 0 HP.
function dmgE(e,d,kx,kz,ex){if(e.inv>0||e.dead)return;e.hp-=d;e.fl=.14;e.hs=Math.random()<.5?-1:1;e.hv=(e.hv||0)+Math.min(9,3+d*.5);var hm=Math.hypot(kx||0,kz||0);if(hm>.01){e.hdx=kx/hm;e.hdz=kz/hm;}if(e.hp<=0)killE(e,kx||0,kz||0,ex);}
// hlms = flying helmets (popped by headshots). popHelm()/popPl() pop a bot/player helmet; updH() animates them.
var hlms=[];
function popHelm(e,vx,vz){var h=e.hm;if(!h||!e.helm)return;e.helm=false;h.updateMatrixWorld(true);
  var wp=new T.Vector3(),q=new T.Quaternion();h.getWorldPosition(wp);h.getWorldQuaternion(q);
  e.body.remove(h);S.add(h);h.position.copy(wp);h.quaternion.copy(q);
  var m=Math.hypot(vx||0,vz||0)||1;
  hlms.push({m:h,vx:(vx||0)/m*3.2+(Math.random()-.5)*2,vy:5.5+Math.random()*2,vz:(vz||0)/m*3.2+(Math.random()-.5)*2,sx:(Math.random()-.5)*18,sz:(Math.random()-.5)*18,t:0,rest:false});
  spark(wp.x,wp.y,wp.z,0xffd54a,12,4.5,.09);spark(wp.x,wp.y,wp.z,0xcfd4da,6,3,.07);e.fl=.12;
  if(AC){tn(2600,1500,.1,"triangle",.1);tn(1700,800,.14,"square",.05,.03);}}
function updH(dt){for(var i=hlms.length-1;i>=0;i--){var h=hlms[i],m=h.m;h.t+=dt;
  if(!h.rest){h.vy-=16*dt;m.position.x=Math.max(-A,Math.min(A,m.position.x+h.vx*dt));m.position.z=Math.max(-A,Math.min(A,m.position.z+h.vz*dt));m.position.y+=h.vy*dt;m.rotation.x+=h.sx*dt;m.rotation.z+=h.sz*dt;
    if(m.position.y<=.16){m.position.y=.16;if(Math.abs(h.vy)>2.2){h.vy*=-.38;h.vx*=.6;h.vz*=.6;h.sx*=.5;h.sz*=.5;if(AC)tn(1200,700,.05,"triangle",.04);}else{h.rest=true;m.rotation.x=0;m.rotation.z=0;}}}
  else if(h.t>6){var u=(h.t-6)/.6;if(!h.fd){h.fd=1;m.traverse(function(o){if(o.material){o.material.transparent=true;}});}
    m.traverse(function(o){if(o.material)o.material.opacity=Math.max(0,1-u);});if(u>=1){S.remove(m);hlms.splice(i,1);}}}}
// setHm(): shows/hides the helmet icon in the HUD (pop = play the pop animation).
function setHm(pop){var e=document.getElementById("hmt");if(!e)return;e.className=pl.helm?"":"off";if(pop){e.classList.add("pop");setTimeout(function(){e.classList.remove("pop");},700);}}
function popPl(){pl.helm=false;if(pm.hm)pm.hm.visible=false;var f=document.getElementById("hmfly");f.classList.remove("go");void f.offsetWidth;f.classList.add("go");setHm(true);toast("HELMET POPPED!");shakeT=Math.max(shakeT,.25);if(AC){tn(2600,1500,.1,"triangle",.12);tn(1700,800,.14,"square",.06,.03);}}
// killE(): kills bot e: scoring, kill feed, ragdoll, gun drop, respawn timer. Credit goes to curK (the last damage dealer).
function killE(e,kx,kz,ex){
  var K=curK,pk=K===pl;kFeed(K,killW,hsF,e);if(e.mk)e.mk.visible=false;if(e.nm)e.nm.visible=false;
  en.splice(en.indexOf(e),1);e.dead=true;e.st.d++;rq.push({b:e,t:5});if(K){K.st.k++;ts[K.tm]++;}
  if(pk){score++;if(score%4===0)addGren();if(DM_RULES.crates)mkCrate(e.x,e.z,.45+gh(e.x,e.z,0),rci());starKill();}
  detachGun(e,kx,kz,ex);e.ms.forEach(function(m){m.emissive.setHex(0);});e.arms.forEach(function(q){q.rotation.set(0,0,0);q.scale.y=1;q.userData.fa.quaternion.set(0,0,0,1);});e.g.userData.gun.position.set(0,0,0);e.body.rotation.x=0;e.body.rotation.y=0;
  var m=Math.hypot(kx,kz);if(m<.01){kx=-Math.sin(e.g.rotation.y);kz=-Math.cos(e.g.rotation.y);m=1;}kx/=m;kz/=m;
  e.g.rotation.y=Math.atan2(-kx,-kz);
  dead.push({g:e.g,body:e.body,legs:e.legs,arms:e.arms,x:e.x,z:e.z,y:e.y||0,by:e.y||0,vx:kx*(ex?7:2.6),vz:kz*(ex?7:2.6),vy:ex?8:0,t:0,T:ex?.73:.55,flip:ex?1:0,w:0,land:false});
  spark(e.x,1.2,e.z,0xff6b6b,8,4,.1);
  if(pk){if(ck.t<=0){ck.n=0;ck.hs=0;}ck.t=4;ck.n++;if(hsF)ck.hs++;
  if(inBoom)boomN++;else killNotify(false);}
}
// updDead(dt): animates ragdolls/corpses and respawns bots after their timer.
function updDead(dt){
  updH(dt);
  ck.t=Math.max(0,ck.t-dt);updG(dt);updDrops(dt);updCh(dt);
  for(var di=dead.length-1;di>=0;di--){var d=dead[di];d.t+=dt;
    var p=Math.min(1,d.t/d.T),s=p*p*(3-2*p),ang=-(Math.PI/2+d.flip*Math.PI*2)*s;
    if(!d.land){
      d.by=gh(d.x,d.z,0);d.y=d.by+(d.flip?Math.max(0,d.vy*d.t-11*d.t*d.t):0);
      var sl=d.flip?1:1-p;d.x+=d.vx*dt*sl;d.z+=d.vz*dt*sl;resolve(d,.4);
      if(p>=1){d.land=true;d.y=d.by;spark(d.x,.15,d.z,0xcfcfcf,d.flip?10:5,2.2,.12);}
    }else{
      var u=d.t-d.T;ang+=Math.exp(-u*7)*Math.abs(Math.sin(u*20))*.25;d.w+=dt;
      if(d.w>1.5){d.b=(d.b||0)+dt;d.g.visible=Math.floor(d.b*14)%2===0;
        if(d.b>.6){spark(d.x,.4,d.z,0xb0b4ba,10,2.5,.18);S.remove(d.g);dead.splice(di,1);continue;}}
    }
    d.g.position.set(d.x,d.y,d.z);
    d.body.rotation.set(ang,0,0);d.body.position.y=.3*Math.abs(Math.sin(ang));
    d.arms[0].rotation.z=-1.1*s;d.arms[1].rotation.z=1.1*s;
    d.legs[0].rotation.z=-.3*s;d.legs[1].rotation.z=.3*s;
  }
}
// ---- KILL NOTIFICATIONS (banners, streak text, blood splash, sounds) ----
// Point Blank-style kill notifications
var kn=document.getElementById("kn"),kf=document.getElementById("kf");
// tn(): plays one synthesized tone (start freq, end freq, duration, wave type, volume, delay). Needs AC to exist.
function tn(f0,f1,d,ty,v,dl){var t=AC.currentTime+(dl||0),o=AC.createOscillator(),g=AC.createGain();o.type=ty;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+d);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+d+.02);}
// killSfx(): kill sound for chain level c.
function killSfx(c){try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();if(AC.state==="suspended")AC.resume();
  if(c==="dk"){tn(520,780,.12,"square",.07);tn(780,1040,.16,"square",.07,.09);}
  else if(c==="tk"){tn(520,780,.1,"square",.07);tn(660,990,.1,"square",.07,.08);tn(880,1320,.18,"square",.08,.16);}
  else if(c==="chain"){tn(300,1200,.35,"sawtooth",.06);tn(440,880,.3,"square",.06,.1);tn(660,1320,.4,"square",.07,.25);}
  else if(c==="hs"){tn(900,1800,.08,"square",.09);tn(1400,500,.18,"sawtooth",.08,.06);}
  else{tn(140,30,.9,"sine",.35);tn(200,50,.7,"sawtooth",.1);tn(400,1600,.5,"sawtooth",.06,.05);tn(523,1046,.5,"square",.07,.4);tn(659,1318,.5,"square",.07,.5);}}catch(e){}}
// skull(): returns an inline SVG skull string with CSS class c.
function skull(c){return '<svg class="'+c+'" viewBox="0 0 32 32"><path d="M16 2C8.8 2 3.5 7.2 3.5 14c0 4.2 2.2 7.6 5.5 9.6V28h4.5v-3h1.8v3h1.4v-3h1.8v3H23v-4.4c3.3-2 5.5-5.4 5.5-9.6C28.5 7.2 23.2 2 16 2z"/><circle cx="11" cy="14.5" r="3.4" fill="#05060c"/><circle cx="21" cy="14.5" r="3.4" fill="#05060c"/><path d="M16 17.6l-2.2 4.2h4.4z" fill="#05060c"/></svg>';}
// blood(): returns an inline SVG blood splash string (h = bigger version for headshots).
function blood(h){var s='<svg class="kbl" viewBox="0 0 600 160">',i,j,x,y,r,a,d,w,l,n=h?12:6;
  for(i=0;i<n;i++){x=40+Math.random()*520;y=30+Math.random()*100;r=8+Math.random()*(h?30:18);s+='<circle cx="'+x+'" cy="'+y+'" r="'+r+'"/>';
    for(j=0;j<5;j++){a=Math.random()*6.28;d=r+4+Math.random()*r*1.2;s+='<circle cx="'+(x+Math.cos(a)*d)+'" cy="'+(y+Math.sin(a)*d*.6)+'" r="'+(2+Math.random()*5)+'"/>';}}
  for(i=0;i<(h?7:3);i++){x=60+Math.random()*480;w=6+Math.random()*7;l=30+Math.random()*(h?60:35);s+='<rect class="dr" x="'+x+'" y="'+(70+Math.random()*30)+'" width="'+w+'" height="'+l+'" rx="'+(w/2)+'" style="animation-delay:'+(.15+Math.random()*.4)+'s"/>';}
  return s+'</svg>';}
// showKill(): shows the big kill banner (text, chain count, css class, subtitle).
function showKill(txt,n,cls,sub){
  var h='<div class="ksl"></div>';
  for(var i=0;i<14;i++)h+='<i class="kr" style="--a:'+(i*360/14+Math.random()*10)+'deg"></i>';
  if(cls==="mass")h+='<i class="kring"></i>';
  if(cls!=="dk")h+=blood(cls!=="tk");
  h+='<div class="krow">'+skull("sk")+'<div class="kt">'+txt+'</div>'+skull("sk")+'</div><div class="ks"><span>'+sub+'</span><em>'+new Array(Math.min(n,6)+1).join(skull("sm"))+'</em></div>';
  var b=document.createElement("div");b.className="kb "+cls;b.innerHTML=h;kn.innerHTML="";kn.appendChild(b);
  kf.className="";void kf.offsetWidth;kf.className="kfl "+cls;
  shakeT=Math.max(shakeT,cls==="mass"?.7:.12);killSfx(cls);
}
// killNotify(): decides which banner/sound to show from the current chain ck (normal, headshot, multi-kill). mass = many kills at once (explosion).
function killNotify(mass){var n=ck.n;
  if(mass)showKill("MASS KILL",boomN,"mass",boomN+" DOWN WITH 1 "+boomLab);
  else if(ck.hs===n)showKill(n>1?"CHAIN HEADSHOT":"HEADSHOT",n,"hs",n>1?n+" HEADSHOT STREAK":"LIGHTS OUT");
  else if(n===2)showKill("DOUBLE KILL",2,"dk","2 DOWN");
  else if(n===3)showKill("TRIPLE KILL",3,"tk","3 DOWN");
  else if(n>=4)showKill("CHAIN KILLER",n,"chain","x"+n+" STREAK");}
// ---- KILL FEED (top-right list, max 5 rows, fades out) ----
// favPrim = chosen primary weapon id, scopeOn = AWP scoped, shotSide = Dual Kriss side of the LAST shot (0 right, 1 left), scopedNow = scope overlay visible.
// --- Point Blank-style kill feed (max 5, fades out) ---
var favPrim=1,scopeOn=false,shotSide=0,scopedNow=false;
var killW=1,KF=document.getElementById("kfd"),KFL=[],
HSI='<span class="hsi"><svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.2" fill="none" stroke="#ff4d4d" stroke-width="1.6"/><circle cx="8" cy="8" r="1.5" fill="#ff4d4d"/><path d="M8 0v3.6M8 12.4V16M0 8h3.6M12.4 8H16" stroke="#ff4d4d" stroke-width="1.6"/></svg></span>';
// kFeed(): adds a row to the kill feed (killer, weapon id, headshot flag, victim).
function kFeed(k,w,hs,v){if(!KF)return;var el=document.createElement("div");el.className="kfr";
  var nm=function(o){return o===pl?'You':o.name;},tc=function(o){return o.tm?'#ff8a65':'#4dabf7';};el.innerHTML=(k?'<span style="color:'+tc(k)+'">'+nm(k)+'</span><span class="wp">'+(SV[w]||SV[1])+'</span>':'')+(hs?HSI:'')+'<span style="color:'+tc(v)+'">'+nm(v)+'</span>';
  KF.appendChild(el);KFL.push({el:el,t:4.6});
  while(KFL.length>5){var o=KFL.shift();o.el.style.transition="opacity .2s linear";o.el.classList.add("out");(function(n){setTimeout(function(){if(n.parentNode)n.parentNode.removeChild(n);},240);})(o.el);}
  void el.offsetWidth;el.classList.add("in");}
// kfUpd(): ages kill-feed rows and removes them.
function kfUpd(dt){for(var i=KFL.length-1;i>=0;i--){var k=KFL[i];k.t-=dt;if(k.t<=.8)k.el.classList.add("out");if(k.t<=0){if(k.el.parentNode)k.el.parentNode.removeChild(k.el);KFL.splice(i,1);}}}
// ---- DAMAGE DIRECTION ARROWS (HUD arrows pointing to where hits came from) ----
// --- hit direction arrows ---
var HD=[],hdEl=document.getElementById("hd");
// hdHit(): registers a hit from world position (sx,sz) (merges with an existing arrow if close).
function hdHit(sx,sz){for(var i=0;i<HD.length;i++){var h=HD[i];if(Math.hypot(h.x-sx,h.z-sz)<2.5){h.t=1.6;h.x=sx;h.z=sz;return;}}
  if(HD.length>=8)return;var el=document.createElement("div");el.className="hda";
  el.innerHTML='<svg viewBox="-16 -16 32 32" width="34" height="34"><path d="M0-14L13 11L0 5L-13 11Z" fill="#ff3b3b" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  hdEl.appendChild(el);HD.push({x:sx,z:sz,t:1.6,el:el});}
// hdUpd(): positions and fades the arrows around the crosshair using the player facing.
function hdUpd(dt){var R=Math.min(innerWidth,innerHeight)*.3,sf=Math.sin(pl.face),cf=Math.cos(pl.face);
  for(var i=HD.length-1;i>=0;i--){var h=HD[i];h.t-=dt;if(h.t<=0||pl.dead){hdEl.removeChild(h.el);HD.splice(i,1);continue;}
    var dx=h.x-pl.x,dz=h.z-pl.z,an=Math.atan2(-dx*cf+dz*sf,dx*sf+dz*cf);
    h.el.style.transform="translate(-50%,-50%) rotate("+an+"rad) translateY("+(-R)+"px)";h.el.style.opacity=Math.min(1,h.t/.6);}}
// hurt(): damages the PLAYER by d (from position sx,sz). Ignored while dead or spawn-protected. Calls die() at 0 HP.
function hurt(d,sx,sz){if(pl.dead||pl.inv>0)return;if(sx!==undefined&&Math.hypot(sx-pl.x,sz-pl.z)>.6)hdHit(sx,sz);pl.hp-=d;pm.fl=.1;cs.s=Math.max(cs.s,.55);var hs2=0;if(sx!==undefined){var ddx=sx-pl.x,ddz=sz-pl.z;hs2=Math.sign(-ddx*Math.cos(pl.face)+ddz*Math.sin(pl.face));}cs.kv+=.7;cs.yv+=hs2*1.5;cs.rv+=hs2*.5+(Math.random()-.5)*.4;document.getElementById("hit").style.opacity=1;if(pl.hp<=0){pl.hp=0;die();}}
// die(): player death: starts the 5 s respawn timer, drops the gun, updates stats and the killer credit.
function die(){pl.dead=true;pl.rsT=5;pl.st.d++;pl.kb=curK&&curK!==pl?curK.name:"";if(curK&&curK!==pl){curK.st.k++;ts[curK.tm]++;}kFeed(curK,1,false,pl);mouse.right=false;mouse.down=false;fireHeld=false;kn.innerHTML="";pm.g.visible=true;if(pm.hg)pm.hg.visible=false;dropPlayerGun();document.body.classList.add("dead");
  try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();tn(260,40,1.2,"sawtooth",.12);tn(120,30,1.6,"sine",.3);}catch(e){}}
// mmss(): formats seconds as m:ss.
function mmss(t){t=Math.floor(t);return Math.floor(t/60)+":"+("0"+t%60).slice(-2);}
// cnt(): animated count-up of a number in an element (end-of-match results).
function cnt(el,to,fmt,dur,dl){var t0=performance.now()+dl;el.textContent=fmt(0);(function f(n){var k=Math.max(0,Math.min(1,(n-t0)/dur));el.textContent=fmt(Math.round(to*(1-Math.pow(1-k,3))));if(k<1)requestAnimationFrame(f);})(performance.now());}
// begin(tm): starts a match as team tm (0 = Police, 1 = Terrorist): hides menus, resets the world, spawns bots, starts the countdown.
function begin(tm){document.getElementById("tsel").style.display="none";lb.style.display="none";lob=false;document.body.classList.remove("lobby","over","dead");reset();startMatch(tm);ov.style.display="none";run=true;if(!touch){try{R.domElement.requestPointerLock();}catch(e){}}}
document.getElementById("tsP").onclick=function(){begin(0);};document.getElementById("tsT").onclick=function(){begin(1);};document.getElementById("tsX").onclick=function(){document.getElementById("tsel").style.display="none";};
// endMatch(): ends the match: stops the simulation, releases the mouse, shows the results screen (stars, scores, best score).
function endMatch(){escHide();mt.over=true;mt.t=0;run=false;if(document.exitPointerLock)document.exitPointerLock();mouse.down=mouse.right=false;fireHeld=false;kn.innerHTML="";document.body.classList.remove("dead");document.body.classList.add("over");pl.dui=true;
  var $=function(i){return document.getElementById(i);},me=pl.tm,w=ts[me]>ts[1-me]?1:ts[me]<ts[1-me]?-1:0,st=pl.st,b=0,h2=document.querySelector("#dc h2"),ti=w>0?"VICTORY":w<0?"DEFEAT":"DRAW";
  try{b=+localStorage.getItem("bbfps_tdm")||0;}catch(e){}var nb=st.k>b;if(nb){b=st.k;try{localStorage.setItem("bbfps_tdm",b);}catch(e){}}
  $("dv").classList.add("tdm");h2.setAttribute("data-t",ti);h2.firstChild.textContent=ti;
  document.querySelector(".dtag").lastChild.nodeValue="MATCH OVER // "+(w>0?"YOUR TEAM WINS":w<0?"ENEMY TEAM WINS":"NO WINNER");
  $("dsub").textContent="POLICE "+ts[0]+"  \u2014  "+ts[1]+" TERRORIST";
  cnt($("dsc"),st.k,String,900,500);cnt($("dtm"),st.d,String,900,600);cnt($("dbs"),b,String,900,700);
  var th=[0,5,10,16],nm=["Recruit","Private","Veteran","Legend"],ri=st.k<5?0:st.k<10?1:st.k<16?2:3,pr=ri<3?(st.k-th[ri])/(th[ri+1]-th[ri]):1;
  $("drk").innerHTML='<div class="rbd"><div><small>RANK</small><b>'+nm[ri].toUpperCase()+'</b></div></div>'+(nb&&st.k>0?'<span class="nr">\u2605 NEW RECORD!</span>':'');
  $("dxp").style.width="0";setTimeout(function(){$("dxp").style.width=Math.round(pr*100)+"%";},60);
  $("dnx").textContent=ri<3?(th[ri+1]-st.k)+" KILLS TO "+nm[ri+1].toUpperCase():"MAX RANK REACHED";
  $("sbd").innerHTML=ROS.slice().sort(function(a,c){return c.k-a.k||a.d-c.d;}).map(function(r){return '<div class="sbr'+(r===st?' me':'')+'" style="--c:'+(r.tm?'#ff8a65':'#4dabf7')+'"><span>'+r.name+(r===st?' (YOU)':'')+'</span><b>'+r.k+'</b><b>'+r.d+'</b></div>';}).join("");
  $("dv").classList.add("show");}
// again(): restarts a match on the same team.
function again(){document.getElementById("dv").classList.remove("show");begin(pl.tm);}
document.getElementById("dgo").onclick=again;
// setW(): hard-sets the current weapon to i with full ammo (no ammo saving). For normal switching use swW().
function setW(i){pl.w=i;pl.mag=WP[i].mag;pl.res=WP[i].res;pl.rl=0;}
// reload(): starts a reload of the current weapon if allowed (needs reserve ammo, magazine not full, not already reloading).
//  Dual Kriss (7) cannot reload: when empty the player must press V to go back to the single Kriss.
//  AWP (8) does NOT reload after each shot (it uses the bolt cycle); reload() is only called when its magazine is empty.
function reload(){var w=WP[pl.w];if(!run||pl.dead||pl.rl>0||pl.mag>=w.mag)return;if(pl.w===7){if(pl.mag<=0&&toastT<=0)toast("DUAL EMPTY - PRESS V");return;}if(pl.res<=0){if(pl.mag<=0&&toastT<=0)toast("NO AMMO");return;}pl.rl=w.rt;}
// pick(ci): player collects crate type ci: medkit (3) heals, otherwise resupplies or swaps the primary weapon.
function pick(ci){
  if(ci===3){pl.hp=Math.min(100,pl.hp+40);toast("Medkit +40 HP");return;}
  var w=ci+1;
  if(pl.prim>=6){var pw=pl.prim,aa=amo(pw),ad=pw===8?10:pw===7?75:60;if(pw===7)aa.mag=Math.min(WP[7].mag,aa.mag+ad);else aa.res+=ad;toast("Resupplied: "+WP[pw].n+" +"+ad);return;}
  if(pl.prim===w){var a=amo(w);a.res+=WP[w].res;toast("Resupplied: "+WP[w].n+" +"+WP[w].res);}
  else{pl.prim=w;pl.ammo[w]={mag:WP[w].mag,res:WP[w].res};toast("Picked up "+WP[w].n+"!");swSlot(0);}
}
// ---- WEAPON SLOTS ----
// Slot 0 = primary (pl.prim), 1 = pistol, 2 = knife, 3 = grenade.
// Point Blank-style weapon slots: 1 primary, 2 pistol, 3 knife, 4 grenade
// amo(id): returns the object holding {mag,res} for weapon id (the live `pl` for the current weapon, otherwise pl.ammo[id]).
function amo(id){return id===pl.w?pl:pl.ammo[id];}
// swW(i): switches to weapon i, saving the current weapon's ammo into pl.ammo and loading the new one. Cancels reload.
function swW(i){pl.ammo[pl.w]={mag:pl.mag,res:pl.res};pl.w=i;var a=pl.ammo[i];pl.mag=a.mag;pl.res=a.res;pl.rl=0;pl.sw=.28;pl.thr=0;pl.pend=false;pl.sth=false;pl.stab=0;pl.ghide=0;pl.cd=Math.max(pl.cd,.2);}
// swSlot(s): switches to slot s (0 primary, 1 pistol, 2 knife, 3 grenade) with the switch animation.
function swSlot(s){var id=[pl.prim,0,4,5][s],a=amo(id);
  if(id===pl.w){pl.slot=s;return;}
  if((id===5&&a.mag<=0)||(id===pl.prim&&a.mag+a.res<=0)){toast(id===5?"Out of grenades":"Out of ammo");return;}
  pl.slot=s;swW(id);}
// addGren(): +1 grenade (max 6).
function addGren(){var a=amo(5);if(a.mag<6){a.mag++;toast("Grenade +1");}}
// doStab(): knife attack: damages enemies in a short cone in front of the player.
function doStab(){killW=4;curK=pl;var w=WP[4],fx=Math.sin(pl.face),fz=Math.cos(pl.face),hit=0;
  en.slice().forEach(function(e){if(e.tm===pl.tm)return;var dx=e.x-pl.x,dz=e.z-pl.z,d=Math.hypot(dx,dz)||1;if(d<2.7&&(dx*fx+dz*fz)/d>.3&&clearTo(pl.x,pl.z,e.x,e.z,0)){dmgE(e,w.dmg,fx,fz);hit++;}});
  spark(pl.x+fx*1.3,1.2+pl.y,pl.z+fz*1.3,hit?0xff6b6b:0xffffff,hit?8:4,3,.07);
  var sh=document.getElementById("slh");sh.className="";void sh.offsetWidth;sh.className="go";}
// mkGren(): builds a grenade mesh.
function mkGren(){var g=new T.Group(),m=new T.Mesh(new T.SphereGeometry(.17,10,8),new T.MeshLambertMaterial({color:0x4a5a2a}));m.castShadow=true;g.add(m,bx(.06,.08,.06,0x888e98,0,.18,0),bx(.05,.03,.16,0xaab0b9,0,.23,.04));S.add(g);return g;}
// throwG(): spawns a thrown grenade using the player's facing and pitch.
function throwG(){pl.mag--;pl.ghide=.65;var f=pl.face,pt=pl.pitch,sp=16+pt*3;
  grs.push({m:mkGren(),x:pl.x+Math.sin(f)*.6,z:pl.z+Math.cos(f)*.6,y:1.3+pl.y,vx:Math.sin(f)*sp,vz:Math.cos(f)*sp,vy:5.5+pt*9,t:1.7});}
// updG(dt): physics for thrown grenades (arc, bounce, fuse, explosion via boom()).
function updG(dt){
  for(var gi=grs.length-1;gi>=0;gi--){var g=grs[gi];
    g.vy-=22*dt;g.t-=dt;
    var nx=g.x+g.vx*dt,nz=g.z+g.vz*dt;
    if(Math.abs(nx)>A-.3||inObs(nx,g.z,.15,g.y)){g.vx*=-.5;nx=g.x;}
    if(Math.abs(nz)>A-.3||inObs(g.x,nz,.15,g.y)){g.vz*=-.5;nz=g.z;}
    g.x=nx;g.z=nz;g.y+=g.vy*dt;
    var fl=gh(g.x,g.z,g.y)+.17;
    if(g.y<fl){g.y=fl;if(g.vy<-1.5)spark(g.x,fl,g.z,0xcfcfcf,2,1.5,.06);g.vy=-g.vy*.4;g.vx*=.72;g.vz*=.72;if(Math.abs(g.vy)<1)g.vy=0;}
    g.m.position.set(g.x,g.y,g.z);g.m.rotation.x+=dt*(Math.abs(g.vx)+Math.abs(g.vz)+1)*1.2;
    g.m.children[0].material.emissive.setHex(g.t<.8&&Math.floor(g.t*10)%2?0x771111:0);
    if(g.t<=0){S.remove(g.m);grs.splice(gi,1);boom(g.x,g.z,45,"GRENADE");}
  }
}
// SV: inline SVG icons of each weapon id for the HUD.
var SV={0:'<svg viewBox="0 0 48 20"><rect x="10" y="4" width="30" height="6" rx="1"/><rect x="40" y="5" width="4" height="3"/><rect x="12" y="10" width="18" height="3"/><polygon points="12,10 20,10 19,19 12,19"/><rect x="22" y="13.5" width="7" height="1.5"/><rect x="27.5" y="10" width="1.5" height="5"/><rect x="12" y="2.5" width="2" height="1.5"/><rect x="36" y="2.5" width="2" height="1.5"/></svg>',
 1:'<svg viewBox="0 0 48 20"><polygon points="1,7 9,7 9,13 3,14 1,13"/><rect x="9" y="7" width="14" height="5"/><rect x="12" y="5.5" width="7" height="1.5"/><rect x="23" y="7.5" width="11" height="4.5" rx=".5"/><rect x="34" y="8" width="11" height="2"/><rect x="45" y="7.5" width="2" height="3"/><rect x="40" y="6" width="1.5" height="2"/><polygon points="16,12 21,12 23,19 18,19"/><polygon points="10,12 14,12 13,18 9.5,18"/></svg>',
 2:'<svg viewBox="0 0 48 20"><polygon points="1,8 9,8 9,13 4,14 1,12"/><rect x="9" y="7.5" width="10" height="5"/><rect x="19" y="7.5" width="26" height="2.2"/><rect x="19" y="10.2" width="22" height="2.2"/><rect x="26" y="9.5" width="9" height="4.5" rx="1" opacity=".7"/><polygon points="11,12.5 14.5,12.5 14,17 10.5,17"/><rect x="45" y="7" width="2" height="3"/></svg>',
 3:'<svg viewBox="0 0 48 20"><polygon points="1,5 6,7 6,12 1,14"/><rect x="4" y="7" width="30" height="5" rx="2"/><polygon points="34,5 38,5 46,9.5 38,14 34,14"/><polygon points="16,12 19.5,12 19,18.5 15.5,18.5"/><rect x="20" y="3" width="6" height="1"/><rect x="22" y="3.5" width="2" height="3.5"/><rect x="26" y="12" width="2.5" height="4"/></svg>',
 4:'<svg viewBox="0 0 48 20"><rect x="3" y="7.5" width="12" height="5" rx="1.5"/><rect x="15" y="5" width="2.5" height="10"/><polygon points="17.5,8 34,7 46,11 38,13 17.5,12"/></svg>',
 5:'<svg viewBox="0 0 48 20"><ellipse cx="22" cy="12" rx="8" ry="8.5"/><path d="M14.5 10h15M14.2 14h15.6M22 4v16" stroke="var(--hud)" stroke-width="1" fill="none"/><rect x="19.500" y="1.500" width="5" height="3.500" rx=".8"/><polygon points="24.5,2 35,3.5 35,5.5 24.5,5"/><circle cx="38" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
 6:'<svg viewBox="0 0 48 20"><rect x="8" y="5" width="24" height="7" rx="1.5"/><rect x="32" y="6.5" width="12" height="4" rx="1"/><rect x="43" y="7.2" width="4" height="2.4"/><polygon points="17,12 24,12 22,19.5 15,19.5"/><polygon points="9,12 14,12 12,18 8,18"/><rect x="2" y="6.5" width="7" height="3"/><rect x="14" y="3" width="14" height="1.6"/></svg>',
 7:'<svg viewBox="0 0 48 20"><g transform="translate(0,-3) scale(.62)"><rect x="8" y="5" width="24" height="7" rx="1.5"/><rect x="32" y="6.5" width="12" height="4" rx="1"/><polygon points="17,12 24,12 22,19.5 15,19.5"/><polygon points="9,12 14,12 12,18 8,18"/></g><g transform="translate(14,6) scale(.62)"><rect x="8" y="5" width="24" height="7" rx="1.5"/><rect x="32" y="6.5" width="12" height="4" rx="1"/><polygon points="17,12 24,12 22,19.5 15,19.5"/><polygon points="9,12 14,12 12,18 8,18"/></g></svg>',
 8:'<svg viewBox="0 0 48 20"><rect x="1" y="8" width="10" height="5" rx="1.2"/><rect x="11" y="8.5" width="16" height="3.6"/><rect x="27" y="9.6" width="19" height="1.4"/><rect x="45" y="8.8" width="2.6" height="3"/><rect x="16" y="4.4" width="12" height="3" rx="1.4"/><polygon points="12,12 17,12 16,18 11,18"/><rect x="21" y="12" width="4" height="4"/></svg>'};
// Weapon-slot HUD elements and their cached keys (so the DOM is only touched when something changed).
var slEls=[],slKey=[];
(function(){var el=document.getElementById("wsb");for(var s=0;s<4;s++){(function(s){var d=document.createElement("div");d.className="sl";d.innerHTML='<b class="k">'+(s+1)+'</b><span class="ic"></span><span class="nm"></span><span class="sa"></span>';d.addEventListener("pointerdown",function(e){e.stopPropagation();e.preventDefault();if(run&&!pl.dead)swSlot(s);});el.appendChild(d);slEls.push(d);})(s);}})();
// slotUI(w): updates the bottom weapon-slot bar.
function slotUI(w){
  var ids=[pl.prim,0,4,5],i,id,a,el,txt,em,on,key;
  for(i=0;i<4;i++){id=ids[i];a=amo(id);
    txt=id===4?"\u221e":id===5?"x"+a.mag:a.mag+"/"+(a.res===Infinity?"\u221e":a.res);
    em=id===4?false:id===5?a.mag<=0:a.mag+a.res<=0;on=id===pl.w;
    key=id+"|"+on+"|"+em+"|"+txt;
    if(slKey[i]!==key){slKey[i]=key;el=slEls[i];el.className="sl"+(on?" on":"")+(em?" em":"");
      el.children[1].innerHTML=SV[id];el.children[2].textContent=i===0?WP[id].n:["","Pistol","Knife","Grenade"][i];el.children[3].textContent=txt;}}
  if(w.melee){E.mg.textContent="\u221e";E.rs.textContent="";}else if(w.gr){E.rs.textContent="";}
}
// ===== PRIMARY WEAPON SELECT / KRISS <-> DUAL / AWP SCOPE =====
// ===== primary weapon select / Kriss <-> Dual / AWP scope =====
// WSEL = weapon ids offered in the pre-match select (keys 1-5). WDESC = descriptions shown on the cards.
var WSEL=[1,2,3,6,8],WDESC={1:"Balanced · mid range",2:"Close range · high burst",3:"Explosive splash",6:"Fast SMG · V = DUAL",8:"1-shot sniper · RMB scope"};
// canAds(w): which weapons can aim down sights: ids 0-3, Kriss (6) and AWP (8). Dual Kriss, knife, grenade cannot.
function canAds(w){return w<4||w===6||w===8;}
// fall(b,p): damage falloff multiplier (0..1) for bullet b at hit point p from its start (sx,sz), using the weapon's r0/r1/rm.
function fall(b,p){var f=b.fo;if(!f)return 1;var d=Math.hypot(p.x-b.sx,p.z-b.sz);if(d<=f[0])return 1;if(d>=f[1])return f[2];return 1-(1-f[2])*(d-f[0])/(f[1]-f[0]);}
// DOM references for the weapon-select screen, the scope overlay and the alt (V / scope) touch button.
var wsEl=document.getElementById("wsel"),scopeEl=document.getElementById("scope"),abEl=document.getElementById("ab"),wsOn=false,wsCards=[],wsBar,wsT;
(function(){wsEl.innerHTML='<div class="wt"></div><div class="wb"><i></i></div><div class="wc"></div>';wsT=wsEl.children[0];wsBar=wsEl.children[1].firstChild;var box=wsEl.children[2];
  WSEL.forEach(function(id,i){var d=document.createElement("div");d.className="wcd";d.innerHTML='<b class="k">'+(i+1)+'</b>'+SV[id]+'<b>'+WP[id].n+'</b><small>'+WDESC[id]+'</small>';
    d.addEventListener("pointerdown",function(e){e.stopPropagation();e.preventDefault();chooseWeapon(id);});box.appendChild(d);wsCards.push(d);});})();
// chooseWeapon(id): picks the primary weapon during the pre-match countdown.
function chooseWeapon(id){if(!run||pl.dead||!(mt.cd>0)||mt.over||WSEL.indexOf(id)<0)return;
  favPrim=id;pl.prim=id;scopeOn=false;
  if(pl.w!==id){pl.ammo[id]={mag:WP[id].mag,res:WP[id].res};swW(id);}else{pl.mag=WP[id].mag;pl.res=WP[id].res;}}
// wselUpd(): shows/hides the weapon-select panel and updates its countdown bar.
function wselUpd(){var sh=run&&!lob&&mt.cd>0&&!mt.over&&!pl.dead;if(wsOn!==sh){wsOn=sh;wsEl.classList.toggle("show",sh);}
  if(sh){wsT.textContent="CHOOSE PRIMARY WEAPON \u00b7 "+Math.ceil(mt.cd)+"s";wsBar.style.width=Math.max(0,mt.cd/5*100)+"%";
    for(var i=0;i<wsCards.length;i++){var id=WSEL[i],on=pl.prim===id||(id===6&&pl.prim===7);if(wsCards[i]._on!==on){wsCards[i]._on=on;wsCards[i].classList.toggle("on",on);}}}}
// V key: Kriss <-> Dual Kriss. Each mode keeps its OWN magazine and reserve ammo.
// V: Kriss <-> Dual Kriss. Each mode keeps its own magazine + reserve
function toggleDual(){if(!run||pl.dead||mt.over||(pl.w!==6&&pl.w!==7))return;
  var to=pl.w===6?7:6;pl.prim=to;favPrim=to;scopeOn=false;swW(to);toast(to===7?"DUAL KRISS":"KRISS");}
// altBtn(): the touch "alt" button: toggles the AWP scope, or Kriss <-> Dual for the Kriss.
function altBtn(){if(!run||pl.dead||mt.over)return;if(pl.w===8){if(mt.cd<=0&&pl.rl<=0)scopeOn=!scopeOn;}else toggleDual();}
abEl.addEventListener("pointerdown",function(e){e.stopPropagation();e.preventDefault();altBtn();});
// abUpd(): shows/updates the touch alt button text (SCOPE/UNSCOPE, DUAL/SINGLE).
function abUpd(){var show=touch&&run&&!pl.dead&&!lob&&!mt.over&&(pl.w===6||pl.w===7||pl.w===8);abEl.style.display=show?"block":"none";if(show){var t=pl.w===8?(scopeOn?"UNSCOPE":"SCOPE"):(pl.w===6?"DUAL":"SINGLE");if(abEl.textContent!==t)abEl.textContent=t;}}
// ---- INPUT ----
// keys = pressed KeyboardEvent.code map, mouse = {down,right}, ST = touch sticks, fireHeld/jumpHeld = touch buttons.
// input
var fireHeld=false,jumpHeld=false,keys={},mouse={x:innerWidth/2,y:0,down:false,right:false},ST={l:{x:0,y:0,on:false},r:{x:0,y:0,on:false}};
addEventListener("keydown",function(e){if(e.code==="Space")e.preventDefault();keys[e.code]=true;if(mt.over&&e.code==="Enter"&&document.getElementById("dv").classList.contains("show")){again();return;}if(e.code==="KeyR")reload();if(e.code==="KeyV")toggleDual();if(run&&!pl.dead){var dm=/^(Digit|Numpad)([1-5])$/.exec(e.code);if(dm){if(mt.cd>0&&!mt.over)chooseWeapon(WSEL[+dm[2]-1]);else if(+dm[2]<=4)swSlot(+dm[2]-1);}}});
document.getElementById("rl").addEventListener("pointerdown",function(e){e.stopPropagation();reload();});
(function(){var jb=document.getElementById("jb");jb.addEventListener("pointerdown",function(e){e.stopPropagation();jb.setPointerCapture(e.pointerId);jumpHeld=true;});["pointerup","pointercancel"].forEach(function(t){jb.addEventListener(t,function(){jumpHeld=false;});});var b=document.getElementById("fb");b.addEventListener("pointerdown",function(e){e.stopPropagation();b.setPointerCapture(e.pointerId);fireHeld=true;});["pointerup","pointercancel"].forEach(function(t){b.addEventListener(t,function(){fireHeld=false;});});})();addEventListener("keyup",function(e){keys[e.code]=false;});
R.domElement.addEventListener("pointermove",function(e){if(e.pointerType==="mouse"){mouse.down=!!(e.buttons&1);mouse.right=!!(e.buttons&2);}if(e.pointerType==="mouse"&&run&&!pl.dead&&(document.pointerLockElement===R.domElement||(e.buttons&1))){var sn=.003*(1-(pl.w===8?.82:.5)*adsT);pl.face-=(e.movementX||0)*sn;pl.pitch=Math.max(-1.2,Math.min(1.2,pl.pitch-(e.movementY||0)*sn));}});
R.domElement.addEventListener("pointerdown",function(e){if(e.pointerType==="mouse"){if(e.button===2){mouse.right=true;e.preventDefault();if(run&&!pl.dead&&pl.w===8&&mt.cd<=0&&!mt.over)scopeOn=!scopeOn;}else if(e.button===0)mouse.down=true;if(run&&!pl.dead&&!document.pointerLockElement&&R.domElement.requestPointerLock){try{R.domElement.requestPointerLock();}catch(x){}}}});
addEventListener("pointerup",function(e){if(e.pointerType==="mouse"){mouse.down=!!(e.buttons&1);mouse.right=!!(e.buttons&2);}});addEventListener("blur",function(){mouse.right=false;mouse.down=false;keys={};});
R.domElement.addEventListener("contextmenu",function(e){e.preventDefault();});
// stick(): wires up a touch joystick element and stores its x/y in state st.
function stick(el,st){var kn=el.firstChild,id=null;
  function mv(e){var r=el.getBoundingClientRect(),dx=e.clientX-(r.left+60),dy=e.clientY-(r.top+60),l=Math.hypot(dx,dy),m=45;if(l>m){dx*=m/l;dy*=m/l;}
    kn.style.transform="translate("+dx+"px,"+dy+"px)";st.x=dx/m;st.y=dy/m;st.on=true;}
  el.addEventListener("pointerdown",function(e){id=e.pointerId;el.setPointerCapture(id);mv(e);});
  el.addEventListener("pointermove",function(e){if(e.pointerId===id)mv(e);});
  function end(e){if(e.pointerId===id){id=null;st.x=st.y=0;st.on=false;kn.style.transform="";}}
  el.addEventListener("pointerup",end);el.addEventListener("pointercancel",end);}
stick(document.getElementById("stl"),ST.l);stick(document.getElementById("str"),ST.r);
// Raycaster/plane helpers for converting screen touches to world positions.
var ray=new T.Raycaster(),plane=new T.Plane(new T.Vector3(0,1,0),-1),tv=new T.Vector3(),v2=new T.Vector2();
// ---- OVERLAY / MENUS ----
// overlay
var ov=document.getElementById("ov"),ovt=document.getElementById("ovt");
// show(): shows the generic overlay card (title, body html, button label).
function show(h,b,btn){document.querySelector("#card h1").textContent=h;ovt.innerHTML=b;document.getElementById("go").textContent=btn;ov.style.display="flex";}
show("Blok Buddies FPS",'<p>Survive the terrorist assault. There are no drops in this mode: no weapons, ammo or medkits fall from the sky, so every fight is decided by aim.</p><p>'+
 (touch?"Left joystick to move, right joystick to look around. The Shoot, Jump, and Reload buttons are on the right.":"WASD to move, Space to jump, mouse to look around (click the screen first to lock the mouse, or hold left click and drag), left click or F to shoot, R to reload, hold Shift to sprint, hold right click to aim down sights. Press V to switch the Kriss between single and dual. With the AWP, right click once to scope and again to unscope. You get 5 seconds at match start to pick your primary weapon (keys 1-5).")+
 '</p><p>Your weapon and ammo come from the primary weapon you pick at the start. You get full ammo again after every respawn.</p>',"Start");
document.getElementById("go").onclick=function(){this.blur();reset();ov.style.display="none";run=true;};
// Lobby (mode select screen). lobBest() reads the best score from localStorage key "bbfps_best" (try/catch).
var lb=document.getElementById("lb");
function lobBest(){var b=0;try{b=+localStorage.getItem("bbfps_best")||0;}catch(e){}document.getElementById("lbbest").textContent=b;}
function lobP(id){["lbs","lbm"].forEach(function(i){document.getElementById(i).classList.toggle("on",i===id);});if(id==="lbs")lobBest();document.getElementById("lbn").classList.remove("on");}
lobBest();
(function(){var n=document.getElementById("lbn"),nt=document.getElementById("lbnt"),tm=0;[].forEach.call(document.querySelectorAll(".mb[data-n]"),function(b){b.onclick=function(){this.blur();nt.textContent=this.getAttribute("data-n");n.classList.remove("on","shk");void n.offsetWidth;n.classList.add("on","shk");clearTimeout(tm);tm=setTimeout(function(){n.classList.remove("on");},2800);};});})();
// MODES: lobby cards. Only TEAM DEATH MATCH is playable (lock:0). BOMB MODE and BATTLEGROUND are "coming soon" placeholders (lock:1).
var MODES=[
 {n:"TEAM DEATH MATCH",tg:"5 VS 5 \u00b7 POLICE vs TERRORIST",st:"AVAILABLE",bt:"PLAY NOW",lock:0,df:3,
  d:"Police against Terrorists, 5 vs 5. You fight with 4 AI teammates against 5 AI enemies. When the 1-minute timer ends, the team with the most kills wins.",
  sp:[["PLAYERS","5 VS 5"],["TIME","1 MINUTE"],["RESPAWN","5 SECONDS"],["TEAMS","POLICE / TERRORIST"]],
  hw:["Pick your side: <b>Police</b> or <b>Terrorist</b>. Your 4 teammates are AI and show as blue markers.","Every kill adds 1 point to your team. Teammates' kills count too.","When you die you respawn after <b>5 seconds</b>, with a short spawn shield.","Headshots deal 3x damage. No airdrops: weapons, ammo and medkits are never dropped, so choose your primary weapon wisely."]},
 {n:"BOMB MODE",tg:"TEAM \u00b7 TACTICAL",st:"COMING SOON",bt:"COMING SOON",lock:1,df:4,
  d:"Two teams face off in short rounds. One team plants the bomb, and the other must defuse it before time runs out. Teamwork and accurate aim decide the win.",
  sp:[["PLAYERS","5 VS 5"],["ROUNDS","12"],["TIME","2 MIN/ROUND"],["ROLE","PLANT / DEFUSE"]],
  hw:["The attacking team plants the bomb at the target site.","The defending team defuses the bomb before it detonates.","Buy weapons and gear at the start of each round.","The first team to win 7 rounds takes the match."]},
 {n:"BATTLEGROUND",tg:"SOLO \u00b7 LAST STANDING",st:"COMING SOON",bt:"COMING SOON",lock:1,df:5,
  d:"Dozens of players drop into a single arena. The safe zone keeps shrinking, forcing everyone toward the center. Scavenge weapons, survive, and be the last one standing.",
  sp:[["PLAYERS","30 SOLO"],["ZONE","SHRINKING"],["DURATION","\u00b1 15 MIN"],["WIN","LAST ALIVE"]],
  hw:["Land anywhere and scavenge for weapons and armor.","The safe zone closes in every few minutes.","Outside the zone, your HP keeps draining.","The last player standing wins."]}];
var selM=0,miEl=document.querySelectorAll(".mi");
// selMode(i): selects a lobby mode card and fills the description panel.
function selMode(i){selM=i;var $=function(x){return document.getElementById(x);},m=MODES[i],t=$("mdt"),k;
  [].forEach.call(miEl,function(e,j){e.classList.toggle("on",j===i);});
  $("mnm").textContent=m.n;$("mst").textContent=m.st;$("mtg").textContent=m.tg;$("mds").textContent=m.d;
  $("msp").innerHTML=m.sp.map(function(p){return"<div><span>"+p[0]+"</span><b>"+p[1]+"</b></div>";}).join("");
  $("mhw").innerHTML=m.hw.map(function(h){return"<li>"+h+"</li>";}).join("");
  var df="";for(k=1;k<=5;k++)df+='<i'+(k<=m.df?' class="f"':'')+'></i>';$("mdf").innerHTML=df;
  $("mk").innerHTML=miEl[i].querySelector("svg").outerHTML;
  $("mdm").firstChild.nodeValue=m.bt;t.classList.toggle("lk",!!m.lock);
  t.classList.remove("sw");void t.offsetWidth;t.classList.add("sw");}
[].forEach.call(miEl,function(e,i){e.onclick=function(){selMode(i);};e.ondblclick=function(){document.getElementById("mdm").click();};});
addEventListener("keydown",function(e){var l=document.getElementById("lbm");if(lb.style.display==="none"||!l.classList.contains("on"))return;
  if(e.code==="ArrowDown"||e.code==="KeyS")selMode((selM+1)%3);else if(e.code==="ArrowUp"||e.code==="KeyW")selMode((selM+2)%3);
  else if(e.code==="Enter")document.getElementById("mdm").click();else if(e.code==="Escape"||e.code==="Backspace")lobP("lbs");});
selMode(0);
document.getElementById("lbst").onclick=function(){this.blur();lobP("lbm");selMode(selM);};
document.getElementById("lbb").onclick=function(){lobP("lbs");};
document.getElementById("mdm").onclick=function(){if(MODES[selM].lock){this.classList.remove("shk");void this.offsetWidth;this.classList.add("shk");return;}document.getElementById("tsel").style.display="flex";};
[].forEach.call(document.querySelectorAll(".md.lock"),function(c){c.onclick=function(){c.classList.remove("shk");void c.offsetWidth;c.classList.add("shk");};});
document.getElementById("dmn").onclick=function(){document.getElementById("dv").classList.remove("show");document.body.classList.remove("over","dead");reset();mt={t:60,cd:0,over:true};run=false;lob=true;document.body.classList.add("lobby");lb.style.display="flex";lobP("lbs");};
ov.style.display="none";
reset();
// Star rating on the results screen.
var starsEl=document.getElementById("stars"),stnEl=document.getElementById("stn"),STAR='<svg class="s" viewBox="0 0 24 24"><path d="M12 1.8l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.5 5.7 21.2l1.5-7.1L1.8 9.2 9 8.4z" fill="#ffd43b" stroke="#b45f06" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 4.6l1.9 4.2 4.6.5-3.4 3.1" fill="none" stroke="#fff6c8" stroke-width="1.3" stroke-linecap="round"/></svg>';
function starsReset(){[].forEach.call(starsEl.querySelectorAll(".st"),function(x){x.remove();});stnEl.textContent="";}
function starKill(){var el=document.createElement("div"),h=STAR+'<i class="rg"></i>',i,all;for(i=0;i<10;i++)h+='<i class="ry" style="--a:'+(i*36+Math.random()*12)+'deg"></i>';el.className="st nw";el.innerHTML=h;starsEl.insertBefore(el,stnEl);
  all=starsEl.querySelectorAll(".st");if(all.length>8)all[0].remove();stnEl.textContent="\u00d7"+score;stnEl.classList.remove("pop");void stnEl.offsetWidth;stnEl.classList.add("pop");
  setTimeout(function(){el.classList.remove("nw");[].forEach.call(el.querySelectorAll(".rg,.ry"),function(x){x.remove();});},1100);
  try{if(AC){tn(1046,2093,.1,"triangle",.09);tn(1568,3136,.18,"square",.05,.07);}}catch(e){}}
// BN = bot names per team [police names, terrorist names].
var BN=[["Jack","Mike","Ryan","Alex","Owen"],["Viper","Razor","Hawk","Shadow","Ghost"]];
// spawnPt(tm): returns a RANDOM spawn point [x,z] inside the team's own zone: Police z in about +28..+48, Terrorist z in about -48..-28,
// x across the whole width. It is random on purpose so nobody can camp one fixed spawn spot. A candidate is accepted only if it is
//  - not inside a wall/building, - at least 22 units from every enemy, - at least 3 units from teammates,
//  - at least 9 units from the last 8 spawn points used by this team (SPH history, reset in startMatch).
// One accepted candidate is chosen at random. If none is acceptable (crowded map) it falls back to the safest candidate.
var SPH=[[],[]];
function spawnPt(tm){var cz=tm?-38:38,hist=SPH[tm?1:0],ok=[],all=[],k,x,z,i,o,d,dE,dF,h,near,c,p;
  for(k=0;k<60;k++){x=(Math.random()*2-1)*(A-12);z=cz+(Math.random()*2-1)*10;if(inObs(x,z,1.2)||inB(x,z))continue;
    dE=1e9;dF=1e9;for(i=0;i<en.length;i++){o=en[i];d=Math.hypot(o.x-x,o.z-z);if(o.tm===tm)dF=Math.min(dF,d);else dE=Math.min(dE,d);}
    if(!pl.dead&&pl.tm!==undefined){d=Math.hypot(pl.x-x,pl.z-z);if(pl.tm===tm)dF=Math.min(dF,d);else dE=Math.min(dE,d);}
    near=false;for(h=0;h<hist.length;h++)if(Math.hypot(hist[h][0]-x,hist[h][1]-z)<9){near=true;break;}
    c={x:x,z:z,sc:Math.min(dE*.5,dF)};all.push(c);if(dE>=22&&dF>=3&&!near)ok.push(c);}
  if(ok.length)p=ok[(Math.random()*ok.length)|0];else{p=null;for(i=0;i<all.length;i++)if(!p||all[i].sc>p.sc)p=all[i];}
  if(!p)return[0,cz];hist.push([p.x,p.z]);if(hist.length>8)hist.shift();return[p.x,p.z];}
// newBot(tm,i): creates bot number i of team tm (adds its model to the scene and sets AI fields).
function newBot(tm,i){var b=terro(tm);b.tm=tm;b.idx=i;b.name=BN[tm][i];b.ph=Math.random()*6;
  var mk=new T.Mesh(new T.OctahedronGeometry(.26),new T.MeshBasicMaterial({color:tm?0xff6b3d:0x4dabf7,depthTest:false,transparent:true,opacity:.9}));mk.position.set(0,2.65,0);mk.renderOrder=999;mk.visible=false;b.mk=mk;
  var cv=document.createElement("canvas");cv.width=256;cv.height=64;var cx=cv.getContext("2d"),nt=b.name.toUpperCase();cx.font='700 40px Rajdhani,"Trebuchet MS",sans-serif';cx.textAlign="center";cx.textBaseline="middle";cx.lineWidth=7;cx.strokeStyle="rgba(0,0,0,.85)";cx.strokeText(nt,128,34);cx.fillStyle=tm?"#ff8a65":"#74c0fc";cx.fillText(nt,128,34);
  var sp=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(cv),depthTest:false,transparent:true,fog:false}));sp.scale.set(3,.75,1);sp.position.set(0,2.75,0);sp.renderOrder=1000;sp.visible=tm===pl.tm;b.g.add(sp);b.nm=sp;return b;}
// placeBot(b): (re)spawns bot b at a spawn point with full HP and short invulnerability.
function placeBot(b){var s=spawnPt(b.tm);b.x=s[0];b.z=s[1];b.y=0;b.hp=100;b.inv=2;b.cd=1+Math.random();b.dead=false;b.tg=null;b.bn=0;b.wx=b.x;b.wz=b.z;b.stk=0;b.g.rotation.y=b.tm?0:Math.PI;en.push(b);}
// startMatch(tm): sets up scores, timer (60 s) and the countdown, spawns the player and 4+5 bots, resets weapons to the chosen primary.
function startMatch(tm){starsReset();SPH=[[],[]];var s=spawnPt(tm);pl.tm=tm;pl.x=s[0];pl.z=s[1];pl.face=tm?0:Math.PI;pl.inv=2;ts=[0,0];rq=[];mt={t:60,cd:5,over:false};pl.prim=favPrim;pl.w=favPrim;pl.mag=WP[favPrim].mag;pl.res=WP[favPrim].res;scopeOn=false;ROS=[];pl.st={name:"You",tm:tm,k:0,d:0};ROS.push(pl.st);
  S.remove(pm.g);pm=mkPm(tm);pm.g.visible=false;[armR,armL].forEach(function(ar){ar.children[0].material.color.setHex(tm?0x4b5320:0x1c4a8a);ar.children[1].material.color.setHex(tm?0x23272b:0x142a52);});
  [0,1].forEach(function(t){for(var i=0;i<(t===tm?4:5);i++){var b=newBot(t,i);b.st={name:b.name,tm:t,k:0,d:0};ROS.push(b.st);placeBot(b);}});
  toast("YOU ARE "+(tm?"TERRORIST":"POLICE"));}
// respawnPl(): respawns the player after the 5 s death timer with full ammo and spawn shield.
function respawnPl(){var s=spawnPt(pl.tm);pl.dead=false;pl.dt=pl.rt=pl.rl=pl.cd=pl.sw=pl.stab=pl.thr=0;pl.pend=pl.sth=false;pl.ghide=0;pl.hp=100;pl.helm=true;pl.x=s[0];pl.z=s[1];pl.y=pl.vy=0;pl.face=pl.tm?0:Math.PI;pl.pitch=0;pl.inv=2;pl.prim=favPrim;
  pl.ammo={};WP.forEach(function(w,i){pl.ammo[i]={mag:w.mag,res:w.res};});pl.w=favPrim;pl.mag=WP[favPrim].mag;pl.res=WP[favPrim].res;pl.slot=0;camY=0;scopeOn=false;resetPm();setHm();document.body.classList.remove("dead");toast("RESPAWNED");}
// tmUpd(): updates the top HUD (timer, scores, respawn text, spawn-shield text).
function tmUpd(){var g=function(i){return document.getElementById(i);},r=g("rsp");g("imm").style.display=(pl.inv>0&&!pl.dead&&!mt.over)?"block":"none";var sp0=g("tp"),sq0=g("tq");if(sp0.textContent!=ts[0]){sp0.textContent=ts[0];sp0.classList.remove("pop");void sp0.offsetWidth;sp0.classList.add("pop");}if(sq0.textContent!=ts[1]){sq0.textContent=ts[1];sq0.classList.remove("pop");void sq0.offsetWidth;sq0.classList.add("pop");}g("tt").textContent=mmss(Math.max(0,Math.ceil(mt.t)));g("tbf").style.width=Math.max(0,Math.min(100,mt.t/60*100))+"%";g("tm").classList.toggle("lo",mt.t<=10&&mt.cd<=0&&!mt.over);g("tmP").classList.toggle("you",pl.tm===0);g("tmT").classList.toggle("you",pl.tm===1);
  r.innerHTML=mt.cd>0?Math.ceil(mt.cd):mt.t>59.2?"GO!":(pl.dead&&!mt.over?"RESPAWN IN "+Math.max(1,Math.ceil(pl.rsT))+(pl.kb?"<small>KILLED BY "+pl.kb.toUpperCase()+"</small>":""):"");}
// ---- BOT PATH-FINDING GRID ----
// GB = walkability grid (GN x GN cells). GCS = grid cell size in world units.
// NOTE: the cell size is named GCS (not GS) on purpose. GS is already the array of gun sound presets; reusing the name GS here would overwrite it and silence the player gun sounds.
var GN=0,GB=null,GCS=1;
// gc(): converts a world coordinate to a grid cell index.
function gc(v){return Math.max(0,Math.min(GN-1,Math.floor((v+A)/GCS)));}
// gInit(): builds the walkability grid from OB (solid boxes).
function gInit(){GN=Math.ceil(2*A/GCS);GB=new Uint8Array(GN*GN);for(var cz=0;cz<GN;cz++)for(var cx=0;cx<GN;cx++){var x=-A+(cx+.5)*GCS,z=-A+(cz+.5)*GCS;GB[cz*GN+cx]=(inObs(x,z,.6)||Math.abs(x)>A-1||Math.abs(z)>A-1)?1:0;}}
// gFree(): nearest free cell to (cx,cz) (spiral search).
function gFree(cx,cz){var r,a,b,x,z;if(!GB[cz*GN+cx])return[cx,cz];for(r=1;r<10;r++)for(a=-r;a<=r;a++)for(b=-r;b<=r;b++){if(Math.max(Math.abs(a),Math.abs(b))!==r)continue;x=cx+a;z=cz+b;if(x>=0&&z>=0&&x<GN&&z<GN&&!GB[z*GN+x])return[x,z];}return null;}
// gClear(): true if the straight line between two points crosses only free cells.
function gClear(x0,z0,x1,z1){var n=Math.ceil(Math.hypot(x1-x0,z1-z0)/.4),i;for(i=1;i<=n;i++)if(GB[gc(z0+(z1-z0)*i/n)*GN+gc(x0+(x1-x0)*i/n)])return false;return true;}
// gPath(): A*-style path from (x0,z0) to (x1,z1). Returns a list of waypoints or null.
function gPath(x0,z0,x1,z1){if(!GB)gInit();var N=GN,s=gFree(gc(x0),gc(z0)),g=gFree(gc(x1),gc(z1));if(!s||!g)return null;
  var si=s[1]*N+s[0],gi=g[1]*N+g[0],gx=g[0],gz=g[1];if(si===gi)return[[x1,z1]];
  var gs=new Float32Array(N*N).fill(1e9),fs=new Float32Array(N*N),par=new Int32Array(N*N).fill(-1),cl=new Uint8Array(N*N),hp=[];
  function push(i){hp.push(i);var k=hp.length-1,p,t;while(k>0){p=(k-1)>>1;if(fs[hp[p]]<=fs[hp[k]])break;t=hp[p];hp[p]=hp[k];hp[k]=t;k=p;}}
  function pop(){var r=hp[0],l=hp.pop(),k=0,n,a,b,m,t;if(hp.length){hp[0]=l;n=hp.length;for(;;){a=2*k+1;b=a+1;m=k;if(a<n&&fs[hp[a]]<fs[hp[m]])m=a;if(b<n&&fs[hp[b]]<fs[hp[m]])m=b;if(m===k)break;t=hp[m];hp[m]=hp[k];hp[k]=t;k=m;}}return r;}
  var DX=[1,-1,0,0,1,1,-1,-1],DZ=[0,0,1,-1,1,-1,1,-1],it=0,c,cx,cz,d,nx,nz,ni,ng;gs[si]=0;push(si);
  while(hp.length&&it++<30000){c=pop();if(cl[c])continue;cl[c]=1;if(c===gi)break;cx=c%N;cz=(c/N)|0;
    for(d=0;d<8;d++){nx=cx+DX[d];nz=cz+DZ[d];if(nx<0||nz<0||nx>=N||nz>=N)continue;ni=nz*N+nx;if(GB[ni]||cl[ni])continue;if(d>3&&(GB[cz*N+nx]||GB[nz*N+cx]))continue;
      ng=gs[c]+(d>3?1.414:1);if(ng<gs[ni]){gs[ni]=ng;par[ni]=c;fs[ni]=ng+Math.hypot(nx-gx,nz-gz);push(ni);}}}
  if(par[gi]<0)return null;
  var pts=[],j,best,out=[],cur=0;c=gi;while(c>=0&&c!==si){pts.push([-A+(c%N+.5)*GCS,-A+(((c/N)|0)+.5)*GCS]);c=par[c];}pts.reverse();pts.unshift([x0,z0]);
  pts.push(GB[gc(z1)*N+gc(x1)]?[-A+(gx+.5)*GCS,-A+(gz+.5)*GCS]:[x1,z1]);
  while(cur<pts.length-1){best=cur+1;for(j=cur+2;j<pts.length&&j<=cur+30;j++)if(gClear(pts[cur][0],pts[cur][1],pts[j][0],pts[j][1]))best=j;out.push(pts[best]);cur=best;}
  return out;}
// botPath(): assigns bot e a path to goal (gx,gz) and a repath timer.
function botPath(e,gx,gz){var p=gPath(e.x,e.z,gx,gz);e.path=p||[[gx,gz]];e.pi=0;e.pt=1.1+Math.random()*.8;}
// botsUpd(dt): LIVE bot AI (movement along paths, target choice, line-of-sight, shooting with fire(..., "e")).
function botsUpd(dt){var i,cdn=mt.cd>0;if(!GB)gInit();
  for(i=rq.length-1;i>=0;i--){var q=rq[i];q.t-=dt;if(q.t<=0&&!mt.over){var nb=newBot(q.b.tm,q.b.idx);nb.st=q.b.st;placeBot(nb);rq.splice(i,1);}}
  en.forEach(function(e){var t,dx=0,dz=0,d=99,f,mvx=0,mvz=0,sp=4.8,ox=e.x,oz=e.z,combat,gx,gz,wp,ml;
    e.inv=Math.max(0,(e.inv||0)-(cdn?0:dt));e.vis=Math.max(0,(e.vis||0)-dt);e.tq=(e.tq||0)-dt;e.navT=Math.max(0,(e.navT||0)-dt);
    if(e.tq<=0){e.tq=.35+Math.random()*.2;var bd=1e9,bt=null;
      en.forEach(function(o){if(o.tm!==e.tm){var dd=Math.hypot(o.x-e.x,o.z-e.z);if(dd<bd&&dd<45&&los(e.x,e.z,o.x,o.z)){bd=dd;bt=o;}}});
      if(pl.tm!==e.tm&&!pl.dead){var d2=Math.hypot(pl.x-e.x,pl.z-e.z);if(d2<bd&&d2<45&&los(e.x,e.z,pl.x,pl.z)){bd=d2;bt=pl;}}
      e.tg=bt;e.lok=!!bt;
      if(!bt){var ob=null,od=1e9;en.concat(pl.dead?[]:[pl]).forEach(function(o){if(o.tm!==e.tm){var dd=Math.hypot(o.x-e.x,o.z-e.z);if(dd<od){od=dd;ob=o;}}});
        if(ob){e.wx=ob.x+(Math.random()-.5)*12;e.wz=ob.z+(Math.random()-.5)*12;}else{e.wx=(Math.random()-.5)*2*(A-8);e.wz=(Math.random()-.5)*2*(A-8);}}}
    t=e.tg;if(t&&(t.dead||(t===pl&&pl.dead)))t=e.tg=null;
    e.lt=(e.lt||0)-dt;if(t&&e.lt<=0){e.lt=.15;e.lok=los(e.x,e.z,t.x,t.z);}
    if(t){dx=t.x-e.x;dz=t.z-e.z;d=Math.hypot(dx,dz)||1;}
    combat=!!t&&e.lok&&e.navT<=0;
    if(combat){var fw=d>16?1:d<7?-.6:0,st;e.bt=(e.bt||0)-dt;if(e.bt<=0){e.bt=.7+Math.random()*1.4;e.sd=[-1,0,1][(Math.random()*3)|0];}st=(e.sd||0)*.9;
      mvx=dx/d*fw+(dz/d)*st;mvz=dz/d*fw-(dx/d)*st;
      if(GB[gc(e.z+mvz*sp*dt*4)*GN+gc(e.x+mvx*sp*dt*4)]){e.sd=-(e.sd||1);mvx=dx/d*fw;mvz=dz/d*fw;}}
    else{gx=t?t.x:e.wx;gz=t?t.z:e.wz;e.pt=(e.pt||0)-dt;
      if(!e.path||e.pt<=0||e.stk>.5){botPath(e,gx,gz);e.stk=0;}
      wp=e.path[e.pi];while(wp&&e.pi<e.path.length-1&&Math.hypot(wp[0]-e.x,wp[1]-e.z)<1.1){e.pi++;wp=e.path[e.pi];}
      if(wp){var wx=wp[0]-e.x,wz=wp[1]-e.z,wl=Math.hypot(wx,wz)||1;if(wl>.4){mvx=wx/wl;mvz=wz/wl;}}}
    en.forEach(function(o){if(o!==e){var sx=e.x-o.x,sz=e.z-o.z,sq=Math.hypot(sx,sz);if(sq<1.8&&sq>.01){mvx+=sx/sq*.7;mvz+=sz/sq*.7;}}});
    ml=Math.hypot(mvx,mvz);if(ml>1){mvx/=ml;mvz/=ml;}if(cdn)mvx=mvz=0;
    f=(t&&e.lok)?Math.atan2(dx,dz):(mvx||mvz)?Math.atan2(mvx,mvz):e.g.rotation.y;
    e.x+=mvx*sp*dt;e.z+=mvz*sp*dt;resolve(e,.55);
    var dm=Math.hypot(e.x-ox,e.z-oz);
    if((mvx||mvz)&&dm<sp*dt*.3){e.stk=(e.stk||0)+dt;if(combat&&e.stk>.5){e.navT=1.2;e.sd=-(e.sd||1);e.stk=0;e.pt=0;}}else e.stk=0;
    e.g.rotation.y=f;e.cd-=dt;
    if(t&&e.lok&&!cdn&&e.cd<=0&&d<32){if(!(e.bn>0))e.bn=3+((Math.random()*4)|0);fire(e,f+(Math.random()-.5)*(.05+d*.0045),EW,"e",0);e.rc=1;e.vis=1.6;e.bn--;e.cd=e.bn>0?.11:.5+Math.random()*.6;}
    e.y=(e.y||0)+(gh(e.x,e.z,0)-(e.y||0))*Math.min(1,dt*10);e.g.position.set(e.x,e.y,e.z);e.g.visible=e.inv>0?Math.floor(tt*12)%2===0:true;
    e.wp=(e.wp||0)+dm*2.4;var am=Math.min(1,dm/dt/2.2);e.legs[0].rotation.x=Math.sin(e.wp)*.8*am;e.legs[1].rotation.x=-e.legs[0].rotation.x;e.rc=Math.max(0,(e.rc||0)-dt*6);aimArms(e);
    e.body.position.y=Math.abs(Math.sin(e.wp))*.07*am;e.body.rotation.z=Math.sin(e.wp)*.05*am;e.body.rotation.x=-.05*(e.rc||0);e.body.rotation.y=0;flash(e,dt);});}
// botsUpdOld(dt): UNUSED legacy AI kept for reference. Nothing calls it. Do not edit it expecting gameplay changes.
function botsUpdOld(dt){var i,cdn=mt.cd>0;
  for(i=rq.length-1;i>=0;i--){var q=rq[i];q.t-=dt;if(q.t<=0&&!mt.over){var nb=newBot(q.b.tm,q.b.idx);nb.st=q.b.st;placeBot(nb);rq.splice(i,1);}}
  en.forEach(function(e){var t,dx,dz,d,f,mv=0,st=0,sp=4.3,ox=e.x,oz=e.z;
    e.inv=Math.max(0,(e.inv||0)-(cdn?0:dt));e.vis=Math.max(0,(e.vis||0)-dt);e.tq=(e.tq||0)-dt;
    if(e.tq<=0){e.tq=.35+Math.random()*.2;var bd=1e9,bt=null;
      en.forEach(function(o){if(o.tm!==e.tm){var dd=Math.hypot(o.x-e.x,o.z-e.z);if(dd<bd&&dd<45&&los(e.x,e.z,o.x,o.z)){bd=dd;bt=o;}}});
      if(pl.tm!==e.tm&&!pl.dead){var d2=Math.hypot(pl.x-e.x,pl.z-e.z);if(d2<bd&&d2<45&&los(e.x,e.z,pl.x,pl.z)){bd=d2;bt=pl;}}
      e.tg=bt;
      if(!bt){var ob=null,od=1e9;en.concat(pl.dead?[]:[pl]).forEach(function(o){if(o.tm!==e.tm){var dd=Math.hypot(o.x-e.x,o.z-e.z);if(dd<od){od=dd;ob=o;}}});if(ob){e.wx=ob.x+(Math.random()-.5)*10;e.wz=ob.z+(Math.random()-.5)*10;}}}
    t=e.tg;
    if(t&&!t.dead&&!(t===pl&&pl.dead)){dx=t.x-e.x;dz=t.z-e.z;d=Math.hypot(dx,dz)||1;f=Math.atan2(dx,dz);mv=d>14?1:d<7?-.5:0;e.bt=(e.bt||0)-dt;if(e.bt<=0){e.bt=.7+Math.random()*1.4;e.sd=[-1,0,1][(Math.random()*3)|0];}st=(e.sd||0)*.9;}
    else{t=null;dx=e.wx-e.x;dz=e.wz-e.z;d=Math.hypot(dx,dz)||1;f=Math.atan2(dx,dz);mv=d>2?1:0;}
    if(cdn)mv=st=0;
    e.x+=(dx/d*mv+(dz/d)*st)*sp*dt;e.z+=(dz/d*mv-(dx/d)*st)*sp*dt;resolve(e,.55);
    var dm=Math.hypot(e.x-ox,e.z-oz);
    if((mv||st)&&dm<sp*dt*.3){e.stk+=dt;if(e.stk>.6){e.stk=0;e.sd=Math.random()<.5?-1:1;e.bt=1;e.wx=e.x+(Math.random()-.5)*30;e.wz=e.z+(Math.random()-.5)*30;}}else e.stk=0;
    e.g.rotation.y=f;e.cd-=dt;
    if(t&&!cdn&&e.cd<=0&&d<32){if(!(e.bn>0))e.bn=3+((Math.random()*4)|0);fire(e,f+(Math.random()-.5)*(.05+d*.0045),EW,"e",0);e.rc=1;e.vis=1.6;e.bn--;e.cd=e.bn>0?.11:.5+Math.random()*.6;}
    e.y=(e.y||0)+(gh(e.x,e.z,0)-(e.y||0))*Math.min(1,dt*10);e.g.position.set(e.x,e.y,e.z);e.g.visible=e.inv>0?Math.floor(tt*12)%2===0:true;
    e.wp=(e.wp||0)+dm*2.4;var am=Math.min(1,dm/dt/2.2);e.legs[0].rotation.x=Math.sin(e.wp)*.8*am;e.legs[1].rotation.x=-e.legs[0].rotation.x;e.rc=Math.max(0,(e.rc||0)-dt*6);aimArms(e);
    e.body.position.y=Math.abs(Math.sin(e.wp))*.07*am;e.body.rotation.z=Math.sin(e.wp)*.05*am;e.body.rotation.x=-.05*(e.rc||0);e.body.rotation.y=0;flash(e,dt);});}
// ESC/pause menu helpers (shown when the mouse lock is released during a match).
var escEl=document.getElementById("esc"),escT=0;
// escShow(): shows the pause overlay.
function escShow(){if(!run||mt.over||lob||escEl.style.display==="flex")return;escEl.style.display="flex";escT=performance.now();}
// escHide(): hides the pause overlay.
function escHide(){escEl.style.display="none";}
// lockTry(): tries to re-capture the mouse (pointer lock), retrying a few times.
function lockTry(n){if(touch||!run||mt.over||lob||document.pointerLockElement||escEl.style.display==="flex")return;try{R.domElement.requestPointerLock();}catch(e){}if(n<4)setTimeout(function(){lockTry(n+1);},400);}
// escResume(): closes the pause overlay and re-locks the mouse.
function escResume(){escHide();lockTry(0);}
document.addEventListener("pointerlockchange",function(){if(!document.pointerLockElement)escShow();});
addEventListener("keydown",function(e){if(e.code!=="Escape"||!run||mt.over||lob)return;if(escEl.style.display==="flex"){if(performance.now()-escT>300)escResume();}else escShow();});
document.getElementById("escR").onclick=function(){this.blur();escResume();};
document.getElementById("escB").onclick=function(){this.blur();escHide();if(document.exitPointerLock)document.exitPointerLock();document.getElementById("dmn").onclick();};
// ---- MAIN SIMULATION ----
// update(dt): one simulation step (dt in seconds, capped at .05 in loop()). Order: timers -> player movement/jump ->
// aiming (ADS) and weapon timers (AWP bolt) -> player shooting -> crates -> grenades -> bots -> bullets -> particles -> HUD.
// update
function update(dt){
  tt+=dt;sndN=0;if(mt.cd<=0)pl.inv=Math.max(0,(pl.inv||0)-dt);
  if(mt.cd>0)mt.cd-=dt;else if(!mt.over){mt.t-=dt;if(mt.t<=0){endMatch();return;}}
  var mx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+ST.l.x,mz=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0)+ST.l.y,ml=Math.hypot(mx,mz);
  if(pl.dead||mt.cd>0){mx=mz=ml=0;}if(ml>1){mx/=ml;mz/=ml;ml=1;}
  var shoot=!pl.dead&&mt.cd<=0&&(!!keys.KeyF||fireHeld||(mouse.down&&document.pointerLockElement===R.domElement));
  var pb0=pl.bolt||0;pl.bolt=Math.max(0,pb0-dt);if(pl.w!==8||pl.dead)pl.bolt=0;if(pb0>0&&pl.bolt===0&&pl.w===8&&!pl.dead&&pl.mag<=0)reload();
  if(pl.w!==8||pl.dead||pl.rl>0||pl.bolt>0)scopeOn=false;
  var wA=!pl.dead&&(pl.w===8?scopeOn:mouse.right)&&canAds(pl.w)&&pl.rl<=0&&pl.sw<=0&&pl.thr<=0&&pl.stab<=0,wS=!pl.dead&&(keys.ShiftLeft||keys.ShiftRight)&&-mz>.25&&!wA&&!shoot;
  adsT+=((wA?1:0)-adsT)*Math.min(1,dt*12);sprT+=((wS?1:0)-sprT)*Math.min(1,dt*9);
  if(!pl.dead)pl.life+=dt;else{pl.dt+=dt;pl.rsT-=dt;if(pl.rsT<=0&&!mt.over)respawnPl();}
  var spd=6.5*(1+.62*sprT)*(1-.38*adsT)*(1-.12*wtT);
  mvAmt+=(ml-mvAmt)*Math.min(1,dt*8);wtT+=((pl.w>=1&&pl.w<=3||pl.w===6||pl.w===8?1:0)-wtT)*Math.min(1,dt*6);
  var fw=-mz,sf=Math.sin(pl.face),cf=Math.cos(pl.face);pl.x+=(fw*sf-mx*cf)*spd*dt;pl.z+=(fw*cf+mx*sf)*spd*dt;resolve(pl,.55);
  var py=pl.y,gy=gh(pl.x,pl.z,py);
  if(!pl.dead&&(keys.Space||jumpHeld)&&pl.y<=gy+.001)pl.vy=9;
  pl.vy-=28*dt;pl.y+=pl.vy*dt;gy=gh(pl.x,pl.z,py);
  if(pl.y<=gy){pl.y=gy;pl.vy=0;}
  if(pl.vy===0&&Math.abs(pl.y-camY)<1.2)camY+=(pl.y-camY)*Math.min(1,dt*16);else camY=pl.y;
  var rk=pl.dead?0:1;pl.face-=ST.r.x*2.4*dt*rk;pl.pitch=Math.max(-1.2,Math.min(1.2,pl.pitch-ST.r.y*1.6*dt*rk));
  var cdo=pl.cd;pl.cd-=dt;pl.ov=(cdo>0&&pl.cd<0)?-pl.cd:0;var w=WP[pl.w];pl.sw=Math.max(0,pl.sw-dt);pl.stab=Math.max(0,pl.stab-dt);pl.ghide=Math.max(0,pl.ghide-dt);if(pl.sth&&pl.stab<=.23){pl.sth=false;doStab();}if(pl.thr>0){pl.thr=Math.max(0,pl.thr-dt);if(pl.pend&&pl.thr<=.225){pl.pend=false;throwG();}}
  if(pl.rl>0){pl.rl-=dt;if(pl.rl<=0){var n=Math.min(w.mag-pl.mag,pl.res);pl.mag+=n;pl.res-=n;}}
  for(var sn=0;sn<3&&shoot&&pl.cd<=0&&pl.rl<=0&&pl.thr<=0&&pl.sw<=0;sn++){if(sn>0)pl.ov=-pl.cd;if(w.melee){pl.cd=w.cd;pl.stab=.42;pl.sth=true;}else if(w.gr){if(pl.mag>0){pl.thr=.5;pl.pend=true;pl.cd=1.1;}}else if(pl.mag>0){fire(pl,pl.face,w,"p",pl.ov);ejectShell(pl.w,(pl.w===7&&shotSide)?-1:1);pl.cd=w.cd-pl.ov;kick=Math.min(.26,kick+(w.snp?.26:w.rk?.25:w.pel>1?.2:pl.w===0?.09:.065));flashT=Math.min(.06,w.cd*.75);camShot(pl.w);gunSfx(GS[SFXI[pl.w]],1);if(w.snp){scopeOn=false;pl.mag--;pl.bolt=BOLT_T;pl.bc=0;}else if(--pl.mag===0)reload();}else reload();}
  if(!pl.dead&&pl.w===7&&pl.mag<=0&&pl.res<=0){var kk=pl.ammo[6];if(kk&&kk.mag+kk.res>0)toggleDual();}
  if(!pl.dead&&pl.mag<=0&&pl.res<=0&&pl.rl<=0&&pl.thr<=0&&pl.w!==0&&pl.w!==4){swSlot(1);toast("Out of ammo");}
  // crates
  crateT-=dt;if(DM_RULES.crates&&crateT<=0&&cr.length<12){crateT=2;var x,z,k=0;do{x=(Math.random()*2-1)*(A-3);z=(Math.random()*2-1)*(A-3);}while(inObs(x,z,1)&&k++<12);mkCrate(x,z,46,rci());}
  for(var i=cr.length-1;i>=0;i--){var c=cr[i];
    if(!c.land){var fb=.45+gh(c.x,c.z,0);c.age+=dt;var tv=-Math.max(1.2,Math.min(6,(c.y-fb)*.8));c.vy+=(tv-c.vy)*Math.min(1,dt*2);c.y+=c.vy*dt;
      var swy=Math.min(1,(c.y-fb)/4);c.m.rotation.x=Math.sin(tt*1.5+c.x)*.08*swy;c.m.rotation.z=Math.cos(tt*1.2+c.z)*.08*swy;
      if(c.pc){var u0=Math.min(1,c.age/1.4),k3=u0-1,eb=1+2.70158*k3*k3*k3+1.70158*k3*k3,sc=.2+.8*eb,fx2=1+.02*Math.sin(tt*3.1+c.x);c.pc.scale.set(sc*fx2,sc*(1+.035*Math.sin(tt*2.3+c.z)),sc*fx2);}
      if(c.y<=fb){c.y=fb;c.land=true;c.m.rotation.x=c.m.rotation.z=0;dropChute(c);}}
    c.m.position.y=c.y+(c.land?Math.sin(tt*3+c.x)*.08:0);c.m.rotation.y+=dt*(c.land?1.5:.3);
    if(!pl.dead&&c.land&&Math.hypot(c.x-pl.x,c.z-pl.z)<1.2&&!(c.ci===3&&pl.hp>=100)){S.remove(c.m);cr.splice(i,1);pick(c.ci);}}
  updChutes(dt);
  // enemies
  botsUpd(dt);
  updDead(dt);
  // bullets
  for(i=bl.length-1;i>=0;i--){var b2=bl[i],p=b2.m.position,hit=false,ho=null,hn=null,ddt=dt+(b2.ad||0),ns=Math.max(1,Math.ceil(Math.hypot(b2.vx,b2.vz,b2.vy||0)*ddt/.2)),sd=ddt/ns;b2.ad=0;
    for(var ss=0;ss<ns&&!hit;ss++){
      var qx=p.x,qy=p.y,qz=p.z;p.x+=b2.vx*sd;p.z+=b2.vz*sd;p.y+=(b2.vy||0)*sd;b2.life-=sd;hn=null;
      if(b2.rk&&ss===0){spark(p.x,p.y,p.z,0x9aa0a8,1,.6,.16);spark(p.x,p.y,p.z,0xff9f1c,1,.8,.1);smoke(p.x,p.y,p.z,1,.15,.22,1.1,.3,0);}
      ho=sweepObs(qx,qy,qz,p.x,p.y,p.z)||obsAt(p.x,p.z,p.y);
      if(ho)hn=faceOf(ho,qx,qy,qz,p);
      else if(p.y<3&&(Math.abs(p.x)>A||Math.abs(p.z)>A)){ho=bw;hn=Math.abs(p.x)>Math.abs(p.z)?{x:p.x>0?A:-A,y:p.y,z:p.z,ax:0,sg:p.x>0?-1:1}:{x:p.x,y:p.y,z:p.z>0?A:-A,ax:2,sg:p.z>0?-1:1};}
      if(!ho){var lt2=sweepLT(qx,qy,qz,p.x,p.y,p.z);if(lt2){ho=lt2;hn=faceOf(lt2,qx,qy,qz,p);}}
      if(!ho)for(var li=0;li<LT.length;li++){var lt=LT[li];if(Math.abs(p.x-lt.x)<lt.hw&&Math.abs(p.z-lt.z)<lt.hd&&p.y>=lt.y0&&p.y<=lt.h){ho=lt;hn=faceOf(lt,qx,qy,qz,p);break;}}
      hit=b2.life<=0||p.y<gh(p.x,p.z,p.y)+.03||Math.abs(p.x)>A+1||Math.abs(p.z)>A+1||!!ho;
      if(!hit){var bt=b2.tm;
        for(var j=0;j<en.length;j++){var EE=en[j];if(EE.tm===bt||EE.inv>0)continue;if(Math.hypot(EE.x-p.x,EE.z-p.z)<.85&&p.y-(EE.y||0)<2.1){
          if(!b2.rk){curK=b2.by;var hd=p.y-(EE.y||0)>=1.38;
            if(b2.own==="p"){killW=b2.wid;var fm=fall(b2,p);if(hd&&EE.helm){popHelm(EE,b2.vx,b2.vz);dmgE(EE,b2.dmg*fm,b2.vx,b2.vz);}else{hsF=hd;dmgE(EE,b2.dmg*fm*(hd?3:1),b2.vx,b2.vz);hsF=false;}}
            else{killW=1;dmgE(EE,b2.dmg*(hd?3:1),b2.vx,b2.vz);}}
          hit=true;break;}}
        if(!hit&&pl.tm!==bt&&!pl.dead&&pl.inv<=0&&Math.hypot(pl.x-p.x,pl.z-p.z)<.7&&Math.abs(p.y-(pl.y+1))<1.1){curK=b2.by;var phd=p.y>=pl.y+1.38;if(phd&&pl.helm){popPl();hurt(b2.dmg,b2.sx,b2.sz);}else hurt(b2.dmg*(phd?2:1),b2.sx,b2.sz);hit=true;}}
    }
    if(hit){if(hn)impact(ho,hn,b2);else if(p.y<gh(p.x,p.z,p.y)+.03)gImpact(p);if(b2.rk)boom(p.x,p.z,b2.dmg,0,p.y);else spark(p.x,p.y,p.z,b2.own==="p"?0xffd54a:0xff5c5c,7,5,.07);S.remove(b2.m);bl.splice(i,1);}}
  for(i=sk.length-1;i>=0;i--){var q=sk[i];q.t+=dt;q.m.position.x+=q.vx*dt;q.m.position.y+=q.vy*dt;q.m.position.z+=q.vz*dt;q.vy-=9*dt;q.m.scale.setScalar(Math.max(.001,q.sz*(1-q.t/q.l)));if(q.t>=q.l){S.remove(q.m);sk.splice(i,1);}}
  for(i=mzf.length-1;i>=0;i--){mzf[i].t-=dt;if(mzf[i].t<=0){S.remove(mzf[i].m);mzf.splice(i,1);}}
  updCl(dt);updSm(dt);
  for(i=fx.length-1;i>=0;i--){var f2=fx[i];f2.t+=dt*3;f2.m.scale.setScalar(.5+f2.t*4);f2.m.material.opacity=Math.max(0,.7-f2.t*.7);if(f2.t>=1){S.remove(f2.m);fx.splice(i,1);}}
  pm.g.position.set(pl.x,pl.y,pl.z);pm.g.rotation.y=pl.face;pm.legs[0].rotation.x=Math.sin(tt*10)*.6*ml;pm.legs[1].rotation.x=-pm.legs[0].rotation.x;pm.body.rotation.y=0;flash(pm,dt);if(pl.dead){var dp=Math.min(1,pl.dt/.6),ds=dp*dp*(3-2*dp),an=-Math.PI/2*ds;pm.body.rotation.set(an,0,0);pm.body.position.y=.3*Math.abs(Math.sin(an));pm.arms[0].rotation.z=-1.1*ds;pm.arms[1].rotation.z=1.1*ds;pm.legs[0].rotation.z=-.3*ds;pm.legs[1].rotation.z=.3*ds;}
  // HUD
  hud();hdUpd(dt);kfUpd(dt);
  if(toastT>0&&(toastT-=dt)<=0)document.getElementById("toast").style.opacity=0;var ht=document.getElementById("hit");ht.style.opacity=Math.max(0,ht.style.opacity-dt*2);
}
// E = cached DOM elements of the HUD (score, HP, weapon name/icon, ammo, reload bar).
var E={};["sc","hpf","hpt","wn","wi","mg","rs","rbf"].forEach(function(k){E[k]=document.getElementById(k);});
// More HUD element references and caches (wiK = last weapon icon shown).
var wiK=-1,hhi=document.getElementById("hhi"),chE=document.getElementById("ch"),rbEl=document.getElementById("rb"),mx2=document.getElementById("map").getContext("2d");
// Radar constants (canvas size, center, rings) and compass labels CDN.
var RS=320,RC=160,RO=156,RI=116,RWD=30,CDN=["N","NE","E","SE","S","SW","W","NW"];
// cfont(): returns the CSS font string used on the radar canvas.
function cfont(n){return "700 "+n+'px Rajdhani,"Trebuchet MS",sans-serif';}
// rrect(): draws a rounded-rectangle path on canvas context X.
function rrect(X,x,y,w,h,r){X.beginPath();X.moveTo(x+r,y);X.arcTo(x+w,y,x+w,y+h,r);X.arcTo(x+w,y+h,x,y+h,r);X.arcTo(x,y+h,x,y,r);X.arcTo(x,y,x+w,y,r);X.closePath();}
// radar(): draws the mini-map radar (player at center, rotates with facing; teammates blue, enemies red when visible).
function radar(){
  var X=mx2,f=pl.face,co=Math.cos(f),sn=Math.sin(f),k=RI/RWD,a=-k*co,b=-k*sn,c=k*sn,d=-k*co,now=performance.now()/1000,th=Math.PI-f,i,g,gx,gz;
  X.setTransform(1,0,0,1,0,0);X.clearRect(0,0,RS,RS);X.lineCap="round";
  // base disc
  g=X.createRadialGradient(RC,RC,10,RC,RC,RO);g.addColorStop(0,"rgba(16,30,46,.9)");g.addColorStop(1,"rgba(5,9,16,.95)");
  X.fillStyle=g;X.beginPath();X.arc(RC,RC,RO,0,6.2832);X.fill();
  // ---- map content (clipped to the inner circle) ----
  X.save();X.beginPath();X.arc(RC,RC,RI,0,6.2832);X.clip();
  X.setTransform(a,b,c,d,RC-(a*pl.x+c*pl.z),RC-(b*pl.x+d*pl.z));
  X.strokeStyle="rgba(110,190,255,.10)";X.lineWidth=1/k;X.beginPath();
  for(gx=Math.floor((pl.x-RWD)/8)*8;gx<=pl.x+RWD;gx+=8){X.moveTo(gx,pl.z-RWD);X.lineTo(gx,pl.z+RWD);}
  for(gz=Math.floor((pl.z-RWD)/8)*8;gz<=pl.z+RWD;gz+=8){X.moveTo(pl.x-RWD,gz);X.lineTo(pl.x+RWD,gz);}
  X.stroke();
  X.fillStyle="rgba(120,160,200,.5)";X.strokeStyle="rgba(190,225,255,.8)";X.lineWidth=1.2/k;
  BR.forEach(function(q){if(Math.abs(q.x-pl.x)<RWD+q.hw+4&&Math.abs(q.z-pl.z)<RWD+q.hd+4){X.fillRect(q.x-q.hw,q.z-q.hd,q.hw*2,q.hd*2);X.strokeRect(q.x-q.hw,q.z-q.hd,q.hw*2,q.hd*2);}});
  X.strokeStyle="rgba(255,110,50,.95)";X.lineWidth=2.5/k;X.strokeRect(-A,-A,2*A,2*A);
  X.fillStyle="#69db7c";X.shadowColor="#2fe06a";X.shadowBlur=8;
  cr.forEach(function(q){if(q.ci===3&&q.land&&Math.hypot(q.x-pl.x,q.z-pl.z)<RWD*.95){var m=2.6/k;X.fillRect(q.x-m,q.z-m*.35,m*2,m*.7);X.fillRect(q.x-m*.35,q.z-m,m*.7,m*2);}});
  en.forEach(function(q){var al=q.tm===pl.tm;if(!al&&!(q.vis>0))return;var ddx=q.x-pl.x,ddz=q.z-pl.z,dl=Math.hypot(ddx,ddz),mxr=RWD*.93,px=q.x,pz=q.z;if(dl>mxr){px=pl.x+ddx/dl*mxr;pz=pl.z+ddz/dl*mxr;}X.shadowColor=al?"#4dabf7":"#ff4d4d";X.shadowBlur=al?10:0;X.fillStyle=al?"#4dabf7":"#ff4d4d";X.strokeStyle="#fff";X.lineWidth=2/k;X.beginPath();X.arc(px,pz,(al?8:6)/k,0,6.29);X.fill();X.stroke();});
  X.shadowBlur=0;X.setTransform(1,0,0,1,0,0);
  // range rings + cross lines
  X.strokeStyle="rgba(120,200,255,.2)";X.lineWidth=1.5;
  X.beginPath();X.arc(RC,RC,RI/3,0,6.2832);X.stroke();X.beginPath();X.arc(RC,RC,RI*2/3,0,6.2832);X.stroke();
  X.strokeStyle="rgba(120,200,255,.13)";X.beginPath();X.moveTo(RC-RI,RC);X.lineTo(RC+RI,RC);X.moveTo(RC,RC-RI);X.lineTo(RC,RC+RI);X.stroke();
  // radar sweep
  var sw=(now*1.6)%6.2832;
  if(X.createConicGradient){g=X.createConicGradient(sw-1.1,RC,RC);g.addColorStop(0,"rgba(0,255,200,0)");g.addColorStop(.17,"rgba(0,255,200,.2)");g.addColorStop(.175,"rgba(0,255,200,0)");g.addColorStop(1,"rgba(0,255,200,0)");X.fillStyle=g;X.fillRect(0,0,RS,RS);}
  X.strokeStyle="rgba(0,255,200,.35)";X.lineWidth=2;X.beginPath();X.moveTo(RC,RC);X.lineTo(RC+Math.cos(sw)*RI,RC+Math.sin(sw)*RI);X.stroke();
  // view cone + player
  g=X.createRadialGradient(RC,RC,0,RC,RC,RI);g.addColorStop(0,"rgba(255,214,90,.4)");g.addColorStop(1,"rgba(255,214,90,0)");
  X.fillStyle=g;X.beginPath();X.moveTo(RC,RC);X.arc(RC,RC,RI,-Math.PI/2-.62,-Math.PI/2+.62);X.closePath();X.fill();
  X.fillStyle="#ffd23f";X.strokeStyle="#1b1206";X.lineWidth=2.5;X.lineJoin="round";
  X.beginPath();X.moveTo(RC,RC-12);X.lineTo(RC+9,RC+10);X.lineTo(RC,RC+4);X.lineTo(RC-9,RC+10);X.closePath();X.fill();X.stroke();
  X.restore();
  // ---- compass ring ----
  X.beginPath();X.arc(RC,RC,(RI+RO)/2,0,6.2832);X.lineWidth=RO-RI;X.strokeStyle="rgba(18,30,48,.92)";X.stroke();
  for(i=0;i<72;i++){var dg=i*5;if(dg%45===0)continue;var len=dg%15===0?10:5;
    X.save();X.translate(RC,RC);X.rotate(dg*Math.PI/180-th);X.beginPath();X.moveTo(0,-(RO-4));X.lineTo(0,-(RO-4-len));
    X.strokeStyle=dg%15===0?"rgba(200,220,245,.75)":"rgba(170,200,230,.4)";X.lineWidth=2;X.stroke();X.restore();}
  X.textAlign="center";X.textBaseline="middle";X.lineJoin="round";
  for(i=0;i<8;i++){var dl=i*Math.PI/4-th,cd=i%2===0,rr=RI+(cd?17:15),tx=RC+rr*Math.sin(dl),ty=RC-rr*Math.cos(dl);
    X.font=cfont(cd?28:17);X.lineWidth=4;X.strokeStyle="rgba(0,0,0,.7)";X.strokeText(CDN[i],tx,ty);
    if(i===0){X.shadowColor="#ff3b3b";X.shadowBlur=10;X.fillStyle="#ff5a4d";}else{X.shadowBlur=0;X.fillStyle=cd?"#ffffff":"#8fa6c0";}
    X.fillText(CDN[i],tx,ty);X.shadowBlur=0;}
  // heading readout
  var hd=Math.round(((th*180/Math.PI)%360+360)%360)%360,tt=CDN[Math.round(hd/45)%8]+"  "+("00"+hd).slice(-3)+"\u00b0";
  X.font=cfont(24);var tw=X.measureText(tt).width+24;
  rrect(X,RC-tw/2,RC+RI*.5-15,tw,30,8);X.fillStyle="rgba(5,10,18,.88)";X.fill();X.lineWidth=2;X.strokeStyle="rgba(255,169,77,.95)";X.stroke();
  X.fillStyle="#fff";X.fillText(tt,RC,RC+RI*.5+1);
  // borders + forward marker
  X.shadowColor="rgba(255,140,60,.8)";X.shadowBlur=10;X.lineWidth=4;X.strokeStyle="#ff8a3d";X.beginPath();X.arc(RC,RC,RO,0,6.2832);X.stroke();X.shadowBlur=0;
  X.lineWidth=2;X.strokeStyle="rgba(120,200,255,.65)";X.beginPath();X.arc(RC,RC,RI,0,6.2832);X.stroke();
  X.shadowColor="#ffd23f";X.shadowBlur=12;X.lineWidth=7;X.strokeStyle="#ffd23f";X.beginPath();X.arc(RC,RC,RO,-Math.PI/2-.2,-Math.PI/2+.2);X.stroke();X.shadowBlur=0;}
// hud(): updates all HUD pieces every frame: timer, HP, ammo, crosshair spread, reload bar, scope overlay (scopedNow when AWP aim blend > .92),
// hides the gun model while scoped, kill banners, radar.
function hud(){var w=WP[pl.w],hp=pl.hp;tmUpd();wselUpd();abUpd();scopedNow=pl.w===8&&adsT>.92&&!pl.dead&&!lob&&!mt.over;scopeEl.style.display=scopedNow?"block":"none";document.body.classList.toggle("scoped",scopedNow);hold.visible=!scopedNow;
  E.hpf.style.width=hp+"%";E.hpf.style.background=hp>60?"linear-gradient(90deg,#2f9e44,#69db7c)":hp>30?"linear-gradient(90deg,#f08c00,#ffd43b)":"linear-gradient(90deg,#c92a2a,#ff6b6b)";
  E.hpt.textContent=Math.ceil(hp);E.sc.textContent=score;E.wn.textContent=w.n;
  E.mg.textContent=pl.mag;E.mg.style.color=pl.mag<=w.mag*.25?"#ff6b6b":"";
  E.rs.textContent="/ "+(pl.res===Infinity?"\u221e":pl.res);
  slotUI(w);if(wiK!==pl.w){wiK=pl.w;E.wi.innerHTML=SV[pl.w];}hhi.className=hp>0&&hp<=30?"low":"";chE.style.setProperty("--g",((6+mvAmt*4+sprT*8+kick*30)*(1-.6*adsT))+"px");rbEl.style.opacity=pl.rl>0?1:0;E.rbf.style.width=pl.rl>0?(100*(1-pl.rl/w.rt))+"%":"0";radar();}
// ---- MAIN LOOP ----
// loop(now): runs update(dt) while a match is on, then positions the camera (normal view, lobby orbit, or death cam),
// applies recoil/shake/FOV, animates the viewmodel (animHands), and renders: world first, then the viewmodel on top with depth cleared.
var last=performance.now();
(function loop(now){var dt=Math.min((now-last)/1000,.05);last=now;if(run)update(pl.dead&&pl.dt<.8?dt*(.3+.7*pl.dt/.8):dt);
  shakeT=Math.max(0,shakeT-dt);var sh=shakeT*.5;cs.s*=Math.max(0,1-dt*6);spr(cs,"k","kv",dt);spr(cs,"y","yv",dt);spr(cs,"r","rv",dt);var ft=70+(ADF[pl.w]-70)*adsT+6*sprT+Math.max(0,cs.k)*45*(1-.5*adsT);if(lob||mt.over){var la=performance.now()/9000;C.position.set(Math.sin(la)*34,13,Math.cos(la)*34);C.lookAt(0,2,0);ft=62;}else if(pl.dead){pl.rt+=dt;var u=Math.min(pl.rt,3.5),an=pl.face+2.4+pl.rt*.5,rd=3+u*1.1,hh=2.2+u*1.5;ft=62;C.position.set(Math.max(-A,Math.min(A,pl.x+Math.sin(an)*rd)),hh+pl.y,Math.max(-A,Math.min(A,pl.z+Math.cos(an)*rd)));C.lookAt(pl.x,.3+pl.y,pl.z);}
  else{var cb=mvAmt*wtT*(1-.75*adsT)*(pl.vy===0?1:0)*(1+.35*sprT),bY=-cb*.022*(.5-.5*Math.cos(2*bobP)),tr=cs.s*(1-.4*adsT),ta=tr*tr,nt=performance.now()/1000,sj=sh+ta*.06,ads2=1-.4*adsT,pp=pl.pitch+cs.k*(1-.35*adsT)+snz(nt,1)*ta*.05,fy=pl.face+cs.y*ads2+snz(nt,2)*ta*.05;C.position.set(pl.x+snz(nt,3)*sj,1.5+camY+bY+snz(nt,4)*sj,pl.z+snz(nt,5)*sj);C.lookAt(pl.x+Math.sin(fy)*Math.cos(pp),1.5+camY+bY+Math.sin(pp),pl.z+Math.cos(fy)*Math.cos(pp));C.rotateZ(cs.r*ads2+snz(nt,6)*ta*.06+Math.sin(bobP)*.004*cb);}
  if(Math.abs(C.fov-ft)>.02){C.fov=ft;C.updateProjectionMatrix();}
  kick*=Math.max(0,1-dt*14);flashT-=dt;var dl=pl.w===7;mflash.visible=flashT>0&&run&&!(dl&&shotSide);mflash2.visible=flashT>0&&run&&dl&&!!shotSide;mflash.scale.setScalar(.7+Math.random()*.8);mflash2.scale.setScalar(.7+Math.random()*.8);mflash.position.set(0,.02,MZ[pl.w]);mflash2.position.set(-.52,.02,MZ[pl.w]);animHands();guns.forEach(function(g,i){g.visible=i===pl.w&&!(i===5&&pl.ghide>0);});sun.position.set(pl.x+14,30,pl.z+10);sun.target.position.set(pl.x,0,pl.z);sun.target.updateMatrixWorld();
  updSky(dt);R.clear();R.render(S,C);if(!pl.dead&&!lob&&!mt.over){R.clearDepth();R.render(VS,VC);}requestAnimationFrame(loop);})(last);
})();
