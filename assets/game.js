(function(){
// =====================================================================================
// POINT BLOCK FPS - modular source, bundled browser IIFE (Three.js r128)
// =====================================================================================
// READ THIS FIRST (notes for humans and for future AI edits). Everything below is ONE IIFE.
// Do not invent APIs: browser runtime uses Three.js r128 + native APIs; ordered sources are bundled with tools/build.mjs.
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
//  0 Handgun, 1 AK-47 (assault), 2 Shotgun, 3 RPG, 4 Knife, 5 Grenade,
 //  6 Kriss, 7 Dual Kriss, 8 AWP (sniper), 9 K2 (starter assault), 10 MP7, 11 P90, 12 AK SOPMOD.
//  Parallel arrays indexed by weapon id: WP, guns, MZ, ADF, AP, RG, RL, PT, MODE, NC, GSC, GH,
//  CKV, CKS, CKY, CKR, SFXI, SV. If you add a weapon you must extend ALL of them.
//  Weapon slots (swSlot): 0 = primary (pl.prim), 1 = pistol (0), 2 = knife (4), 3 = grenade (5).
//  Pre-match choices: WSEL is dynamically built from owned primary weapons; new players start with K2.
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
//  - localStorage stores best score plus browser-local inventory ownership/equipped IDs; always handle unavailable storage.
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
var BOMB_CITY=S.children.filter(function(o){return o.isMesh||o.isGridHelper||o.type==="GridHelper";});
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
      town=bombActive&&id==="block-town",
      hospital=bombActive&&id==="hospital",
      labs=!bombActive&&tdmMapId(selectedTdmMapId)==="block-labs";
  BOMB_CITY.forEach(function(m){m.visible=!bombActive&&!labs;});
  if(BOMB_WORLD)BOMB_WORLD.forEach(function(m){m.visible=bombActive&&!town&&!hospital;});
  if(BLOCK_TOWN_WORLD)BLOCK_TOWN_WORLD.forEach(function(m){m.visible=!!town;});
  if(HOSPITAL_WORLD)HOSPITAL_WORLD.forEach(function(m){m.visible=!!hospital;});
  if(BLOCK_LABS_WORLD)BLOCK_LABS_WORLD.forEach(function(m){m.visible=!!labs;});
  // Labs is indoor: hide the outdoor TDM sky dome/clouds but preserve all old maps.
  if(typeof SKF!=="undefined")SKF.visible=!(labs||hospital);
  if(typeof SKW!=="undefined")SKW.visible=!(labs||hospital);
  OB.length=0;BR.length=0;LT.length=0;
  if(bombActive){
    A=BOMB_RULES.cellSize*BOMB_RULES.cells/2;
    bombMapSites(id);
    if(town){
      if(!BLOCK_TOWN_WORLD)makeBlockTown();
      else{Array.prototype.push.apply(OB,BLOCK_TOWN_OB);Array.prototype.push.apply(BR,BLOCK_TOWN_BR);Array.prototype.push.apply(LT,BLOCK_TOWN_LT);}
      var visibility=BLOCK_TOWN_DEF.visibility;
      S.background=new T.Color(visibility.haze);
      S.fog=new T.Fog(visibility.haze,visibility.near,visibility.far);
    }else if(hospital){
      if(!HOSPITAL_WORLD)makeHospital();
      else{Array.prototype.push.apply(OB,HOSPITAL_OB);Array.prototype.push.apply(BR,HOSPITAL_BR);Array.prototype.push.apply(LT,HOSPITAL_LT);}
      S.background=new T.Color(0x647e89);S.fog=new T.Fog(0x647e89,36,110);
    }else{
      if(!BOMB_WORLD)makeBombMap();
      else{Array.prototype.push.apply(OB,BOMB_OB);Array.prototype.push.apply(BR,BOMB_BR);Array.prototype.push.apply(LT,BOMB_LT);}
      S.background=new T.Color(0x1b2735);S.fog=new T.Fog(0x1b2735,25,95);
    }
  }else{
    A=BOMB_CITY_HALF;
    bombMapSites("lockdown");
    if(labs){
      if(!BLOCK_LABS_WORLD)makeBlockLabs();
      else{Array.prototype.push.apply(OB,BLOCK_LABS_OB);Array.prototype.push.apply(BR,BLOCK_LABS_BR);Array.prototype.push.apply(LT,BLOCK_LABS_LT);}
      S.background=new T.Color(0x263642);S.fog=new T.Fog(0x263642,35,115);
    }else{
      Array.prototype.push.apply(OB,BOMB_CITY_OB);Array.prototype.push.apply(BR,BOMB_CITY_BR);Array.prototype.push.apply(LT,BOMB_CITY_LT);
      S.background=BOMB_BACKGROUND;S.fog=BOMB_FOG;
    }
  }
  GB=null;
}
function bombSpawnPt(team){
  if(bombMapId(selectedBombMapId)==="hospital")return hospitalSpawnPt(team);
  if(bombMapId(selectedBombMapId)==="block-town")return townSpawnPt(team);
  var hist=SPH[team],step=BOMB_RULES.cellSize,candidates=[],z=team?-65:65;
  [-35,-15,-5,5,15,35].forEach(function(x){if(!inObs(x,z,.85)&&!hist.some(function(p){return Math.hypot(p[0]-x,p[1]-z)<5;}))candidates.push([x,z]);});
  var pick=candidates.length?candidates[(Math.random()*candidates.length)|0]:[(Math.random()-.5)*10,z];
  hist.push(pick);return pick;
}
// BLOCK TOWN - outdoor Bomb Mission arena, same 160x160 footprint and collision API as Lockdown.
// All structures, palette, spawns, site centers and props are declared once in a data definition.
// All surfaces use the original Three.js Lambert mk()/wl() and batched dk()/flushDeco().
var BOMB_MAP_REGISTRY=Object.freeze({
  lockdown:Object.freeze({id:"lockdown",name:"LOCKDOWN",caption:"Indoor Tactical Arena",
    sites:Object.freeze([{id:"A",x:-25,z:-5,col:0xffa94d},{id:"B",x:25,z:5,col:0x4dabf7}])}),
  "block-town":Object.freeze({id:"block-town",name:"BLOCK TOWN",caption:"Outdoor Urban Town",
    sites:Object.freeze([{id:"A",x:55,z:-58,col:0xffa94d},{id:"B",x:-16,z:8,col:0x4dabf7}]),
    preview:Object.freeze({x:12,y:47,z:35,lookX:0,lookY:0,lookZ:-12,fov:74})}),
  hospital:Object.freeze({id:"hospital",name:"HOSPITAL",caption:"Indoor Medical Center",
    sites:Object.freeze([{id:"A",x:67,z:-43,col:0xffa94d},{id:"B",x:-67,z:3,col:0x4dabf7}]),
    preview:Object.freeze({x:-67,y:5.2,z:-28,lookX:-67,lookY:2,lookZ:-5,fov:73})})
});
var selectedBombMapId="lockdown",BLOCK_TOWN_WORLD=null,BLOCK_TOWN_OB=[],BLOCK_TOWN_BR=[],BLOCK_TOWN_LT=[];
function bombMapId(value){return Object.prototype.hasOwnProperty.call(BOMB_MAP_REGISTRY,value)?value:"lockdown";}
function bombMapInfo(value){return BOMB_MAP_REGISTRY[bombMapId(value)];}
function bombMapOptions(mode){return mode===1?[BOMB_MAP_REGISTRY.lockdown,BOMB_MAP_REGISTRY["block-town"],BOMB_MAP_REGISTRY.hospital]:[];}
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
 // Painted, non-collidable crossings tied to real city intersections, not an
 // artificial world grid. These never overlap the base at the same depth plane.
 crossings:Object.freeze([[-59,-8,0],[-30,15,1],[10,-52,1],[43,46,0]]),
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
 if(bombMapId(selectedBombMapId)==="hospital")return hospitalSpawnYaw(team,x,z);
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
   // Per-story accent joints and architectural breakups stop uniform window
   // repetition along the long facades. All are ABOVE walkable head height.
   for(var floor=1;floor<stories;floor++){
     detail(w+.11,.16,dep+.11,style%2?shade(col,.81):lite(col,.15),
       x,floor*3.55+.42,z);
   }
   if(style===1||style===3){
     // Balcony/fire-escape treatment on residential/shop elevations.
     var by=4.0,frontZ=z+dep/2+.52,bw2=Math.min(w*.55,8.2);
     detail(bw2,.19,.82,shade(roof,.77),x,by,frontZ);
     detail(bw2,.63,.12,c.metal,x,by+.40,frontZ+.43);
     for(var bal=-bw2/2+.50;bal<bw2/2;bal+=1.12)
       detail(.10,.80,.12,c.metal,x+bal,by+.45,frontZ+.45);
     if(stories>2)detail(bw2*.65,.18,.72,shade(roof,.78),x,by+3.55,frontZ-.06);
   }else if(style===2||style===4){
     // Warehouse vent and overhead loading signage on the street facade.
     detail(Math.min(w*.58,9),.72,.15,style===4?0x31515b:0x87664f,
       x,h*.70,z+dep/2+.18);
     for(var vent=-1;vent<=1;vent++)
       detail(w*.09,.08,.17,c.frame,x+vent*w*.13,h*.70,z+dep/2+.29);
   }
   // Rooftop utility hardware; these are visual skyline details, not
   // combat-range obstacles or collisionless walkable objects.
   if(style!==1&&style!==5){
     detail(Math.min(w*.24,4.2),.78,Math.min(dep*.23,3.8),c.metal,
       x+w*.22,h+.94,z-dep*.15);
     detail(Math.min(w*.23,3.7),.12,Math.min(dep*.20,3.1),0x2e444f,
       x+w*.22,h+1.39,z-dep*.15);
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
 // Crossings and roadside warning paint supply lived-in urban street cues.
 // At y=.108 they float safely ABOVE asphalt, paving and prior lane stripes.
 d.crossings.forEach(function(q,idx){
   for(var stripe=-2;stripe<=2;stripe++){
     var xx=q[0]+(q[2]?stripe*1.05:0),
         zz=q[1]+(q[2]?0:stripe*1.05);
     detail(q[2]?.60:5.8,.012,q[2]?5.8:.60,
       idx%2?0xf0e1bf:0xd9e5e2,xx,.112,zz);
   }
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
// BLOCK LABS — data-driven 120x120 indoor Team Deathmatch arena.
// The owner blueprint is authoritative: Police NORTH, Terrorist SOUTH, six
// impassable lab blocks, left/center/right lanes, perimeter and green reactors.
// The map is independent from Block District, Lockdown and Block Town.
var TDM_MAP_REGISTRY=Object.freeze({
 "block-district":Object.freeze({id:"block-district",name:"BLOCK DISTRICT",caption:"Outdoor Urban Combat"}),
 "block-labs":Object.freeze({id:"block-labs",name:"BLOCK LABS",caption:"Indoor Research Facility",
   preview:Object.freeze({x:-40,y:5.2,z:14,lookX:-40,lookY:2.1,lookZ:-20,fov:72})})
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
// HOSPITAL — indoor 160x160 Bomb Mission arena from owner's white-block/gray-hall blueprint.
// Independent of Lockdown and Block Town. Data owns all geometry, materials and spawn slots.
// White rectangles are sealed SOLID wings; gray areas are playable medical corridors.
var HOSPITAL_WORLD=null,HOSPITAL_OB=[],HOSPITAL_BR=[],HOSPITAL_LT=[];
// The photographed 632x627 owner blueprint, NOT inferred random hospital rooms.
var HOSPITAL_BLUEPRINT=Object.freeze({
 width:632,height:627,
 // Ordered perimeter of the GREY walkable footprint, including every indentation.
 // The polygon is captured from the unannotated original image; the arrow-marked
 // image confirms these passages must remain traversable.
 outlinePx:Object.freeze([
  [16,14],[16,268],[215,268],[215,328],[317,328],[317,359],
  [196,359],[196,296],[14,296],[14,536],[84,536],[84,625],
  [269,625],[269,566],[317,566],[317,625],[621,625],[621,568],
  [569,568],[569,459],[381,459],[381,416],[572,416],[572,328],
  [618,328],[618,97],[458,97],[458,14],[216,14],[216,105],
  [80,105],[80,14]
 ]),
 // Rectangular decompositions of WHITE room islands; three final boxes
 // join into the irregular L-shaped room in the lower-left hospital wing.
 // x,y,w,h,department; no illustrated grey corridor is turned into a room.
 roomsPx:Object.freeze([
  [79,169,138,36,0],[280,75,103,90,1],[457,161,97,104,2],
  [280,228,103,37,3],[381,327,131,51,3],[381,520,125,42,5],
  [77,360,55,130,4],[196,422,121,98,4],
  [196,519,28,17,4],[127,535,97,45,4]
 ])
});
function hospitalPxPoint(x,y){
 var size=BOMB_RULES.cells*BOMB_RULES.cellSize;
 return [(x/HOSPITAL_BLUEPRINT.width-.5)*size,
         (y/HOSPITAL_BLUEPRINT.height-.5)*size];
}
function hospitalPxRoom(b){
 var center=hospitalPxPoint(b[0]+b[2]/2,b[1]+b[3]/2),
     size=BOMB_RULES.cells*BOMB_RULES.cellSize;
 return [center[0],center[1],b[2]*size/HOSPITAL_BLUEPRINT.width,
         b[3]*size/HOSPITAL_BLUEPRINT.height,b[4]];
}
function hospitalPxCover(q){
 var pt=hospitalPxPoint(q[1],q[2]);
 return [q[0],pt[0],pt[1],q[3],q[4],q[5],q[6]];
}

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
 // Walls follow actual WHITE islands extracted from the owner blueprint.
 // 10 rectangular pieces represent eight isolated islands, including the L shape.
 blueprint:HOSPITAL_BLUEPRINT,
 outlinePx:HOSPITAL_BLUEPRINT.outlinePx,
 wings:Object.freeze(HOSPITAL_BLUEPRINT.roomsPx.map(hospitalPxRoom)),
 // Actual non-penetrable clinical props. Every [kind,x,z,w,d,h,zone] is one
 // grounded real wl()/OB collider with small raised, non-colliding decorations.
 // Furniture starts from locations confirmed INSIDE the GREY corridor mask.
 // x/y in blueprint pixels, actual collider width/depth in game units.
 furniture:Object.freeze([
  ["triage-desk",102,127,3,2.3,1.5,0],
  ["nurse-station",220,147,3,3,2,0],
  ["medicine-trolley",266,196,2,1.8,1.65,1],
  ["waiting-bench",410,125,3,1.6,1.15,1],
  ["hospital-bed",583,205,3,2,1.35,2],
  ["medical-cabinet",422,287,3,2.1,2.5,2],
  ["stretcher",329,214,2.5,2,1.25,1],
  ["medicine-trolley",260,288,2.5,2,1.65,3],
  ["nurse-station",136,319,3,2.3,2,4],
  ["wheelchair",47,390,2,2,1.5,4],
  ["linen-storage",147,405,2,2,2.6,4],
  ["stretcher",150,514,2.5,2,1.25,4],
  ["medicine-trolley",342,382,2.5,2,1.65,3],
  ["waiting-bench",541,389,2.5,2,1.15,3],
  ["imaging-machine",354,492,3,2.2,3.2,4],
  ["service-rack",541,536,2.5,2,2.6,5],
  ["triage-desk",450,578,2.5,2,1.5,5],
  ["isolation-cabinet",53,231,2,2,2.6,0],
  ["medical-monitor",407,186,2.5,2,2.4,2],
  ["security-desk",550,291,2.5,2,2,2]
 ].map(hospitalPxCover)),
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
 // This is the west Emergency corridor from the blueprint, not a white room.
 preview:Object.freeze({x:-67,y:5.2,z:-28,lookX:-67,lookY:2,lookZ:-5,fov:73})
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
 // Physical walls follow ALL steps of the exact grey footprint outline,
 // including the deep notches in the left, bottom and right edges. No universal
 // rectangular perimeter that would incorrectly make WHITE regions playable.
 d.outlinePx.forEach(function(a,i){
   var b=d.outlinePx[(i+1)%d.outlinePx.length],
       p0=hospitalPxPoint(a[0],a[1]),p1=hospitalPxPoint(b[0],b[1]),
       dx=Math.abs(p1[0]-p0[0]),dz=Math.abs(p1[1]-p0[1]),
       horizontal=dx>=dz,
       x=(p0[0]+p1[0])/2,z=(p0[1]+p1[1])/2,
       w=horizontal?dx+.8:1.1,dep=horizontal?1.1:dz+.8;
   wall(x,z,w,dep,d.wallHeight,p.base);
   detail(w+.1,.22,dep+.1,p.trim,x,d.wallHeight-.18,z);
   // Different medical corridor sections get contrasting wall protection rails.
   if(i%3===0)detail(w+.13,.18,dep+.13,p.teal,x,1.28,z);
 });
 // All WHITE room shapes are physical sealed clinical wings; the irregular L
 // remains a contiguous collision mass made from three touching rectangles.
 // Gray corridors never gain an imaginary wall from the old map arrangement.
 // Clinical facade details sit proud of the real wall, never suggesting a walkable doorway.
 d.wings.forEach(function(b,i){
   var x=b[0],z=b[1],w=b[2],dep=b[3],zone=d.departments[b[4]],
       height=d.wallHeight,col=i%5===0?0xcbdce1:p.wall;
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
    if(d<r){if(d>0){p.x+=dx/d*(r-d);p.z+=dz/d*(r-d);}else if(isBombMode())bombPushOutOfSolid(p,o,r);else p.x+=r;}});
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
// Common damage rules for human and AI characters. Armor is restored on every spawn/round.
var DEFENSE_RULES=Object.freeze({maxHp:100,vestMax:50,bodyReduction:.20,headshotMultiplier:3});
function defenseSpawn(actor){actor.hp=DEFENSE_RULES.maxHp;actor.vest=DEFENSE_RULES.vestMax;actor.helm=true;}
// Vest only mitigates body bullet damage. Damage absorbed consumes equal durability.
// If the vest runs out mid-hit, any leftover damage lands at full strength.
function defenseDamage(actor,raw,kind){
  var damage=Math.max(0,Number.isFinite(raw)?raw:0);
  if(kind==='bullet-body'&&actor.vest>0){
    var absorbed=Math.min(actor.vest,damage*DEFENSE_RULES.bodyReduction);
    actor.vest=Math.max(0,actor.vest-absorbed);damage-=absorbed;
  }
  return damage;
}
// Headshot after helmet removal is identical for bots and player.
function defenseHeadshotDamage(base){return base*DEFENSE_RULES.headshotMultiplier;}
// ---- WEAPON REGISTRY: stable IDs for save files, bot loadouts and all weapon arrays ----
var WEAPON_PROFILES=[],WEAPON_MODEL_BUILDERS=[],WEAPON_RANGE_MODIFIERS=[];
var WEAPON_STARTER_ID=9;
// CS:GO damage falloff is damage*modifier^(distance/500 CS units).
// For POINT BLOCK, 20 world units are one falloff interval; the two unit systems differ.
var DAMAGE_FALLOFF=Object.freeze({referenceUnits:20,defaultModifiers:Object.freeze({pistol:.91,rifle:.98,smg:.85,dual:.85,shotgun:.70,sniper:.99})});
var WEAPON_CLASS_LABELS=Object.freeze({pistol:"HANDGUN",rifle:"ASSAULT RIFLE",shotgun:"SHOTGUN",rocket:"LAUNCHER",knife:"MELEE",grenade:"THROWABLE",smg:"SUBMACHINE GUN",dual:"SUBMACHINE GUN",sniper:"SNIPER RIFLE"});
// Handgun: stable weapon ID 0 (pistol). Profile ratings and range modifier are weapon-local.
WEAPON_PROFILES[0]=Object.freeze({name:"Handgun",damage:26,rpm:84,control:87,speed:93,vRecoil:61,hRecoil:61,mag:13,res:52,range:45,kind:"pistol"});
WEAPON_RANGE_MODIFIERS[0]=0.91;
WEAPON_MODEL_BUILDERS[0]=function(g,a){
 a(bx(.09,.1,.45,0x9aa1ad,0,0,-.3),bx(.07,.06,.3,0x2b2f3d,0,-.07,-.3),bx(.08,.22,.1,0x2b2f3d,0,-.15,-.12,.25),cy(.028,.028,.12,0x1d2129,0,.01,-.58));
};
// AK-47: stable weapon ID 1 (rifle). Profile ratings and range modifier are weapon-local.
WEAPON_PROFILES[1]=Object.freeze({name:"AK-47",damage:33,rpm:88,control:44,speed:74,vRecoil:69,hRecoil:62,mag:30,res:90,range:140,kind:"rifle"});
WEAPON_RANGE_MODIFIERS[1]=0.98;
WEAPON_MODEL_BUILDERS[1]=function(g,a){
 a(bx(.1,.12,.7,0x3b4252,0,0,-.35),cy(.025,.025,.5,0x1d2129,0,.02,-.9),bx(.12,.1,.3,0x6b4f3a,0,-.01,-.65),bx(.07,.22,.1,0x1d2129,0,-.17,-.4,.2),bx(.08,.14,.3,0x6b4f3a,0,-.02,.05),bx(.04,.05,.1,0x111111,0,.09,-.4),bx(.07,.16,.08,0x2b2f3d,0,-.13,-.15,.2));
};
// Shotgun: stable weapon ID 2 (shotgun). Profile ratings and range modifier are weapon-local.
WEAPON_PROFILES[2]=Object.freeze({name:"Shotgun",damage:168,rpm:48,control:58,speed:79,vRecoil:100,hRecoil:78,mag:6,res:30,range:70,kind:"shotgun",pump:true});
WEAPON_RANGE_MODIFIERS[2]=0.7;
WEAPON_MODEL_BUILDERS[2]=function(g,a){
 var slide=bx(.1,.08,.22,0x8a5a2b,0,-.04,-.6);g.userData.pumpSlide=slide;
 a(cy(.035,.035,.9,0x4a4f5a,0,.03,-.55),cy(.03,.03,.7,0x333b48,0,-.03,-.5),slide,bx(.1,.12,.35,0x3b4252,0,0,-.1),bx(.08,.14,.4,0x8a5a2b,0,-.03,.2));
};
// RPG: stable weapon ID 3 (rocket). Profile ratings and range modifier are weapon-local.
WEAPON_PROFILES[3]=Object.freeze({name:"RPG",damage:85,rpm:35,control:25,speed:48,vRecoil:100,hRecoil:85,mag:1,res:6,range:65,kind:"rocket"});
WEAPON_RANGE_MODIFIERS[3]=null;
WEAPON_MODEL_BUILDERS[3]=function(g,a){
 a(cy(.1,.1,1.1,0x5c6b3c,0,.03,-.4),cy(.1,.17,.2,0x3b4a2a,0,.03,-1),cy(.09,0,.28,0xe03131,0,.03,-1.2),bx(.07,.16,.08,0x2b2f3d,0,-.12,-.2,.2),bx(.04,.06,.1,0x111111,0,.12,-.3));
};
// Knife: stable weapon ID 4 (knife). Profile ratings and range modifier are weapon-local.
WEAPON_PROFILES[4]=Object.freeze({name:"Knife",damage:60,rpm:null,control:100,speed:98,vRecoil:null,hRecoil:null,mag:1,res:Infinity,range:1,kind:"knife"});
WEAPON_RANGE_MODIFIERS[4]=null;
WEAPON_MODEL_BUILDERS[4]=function(g,a){
 {var ks=new T.Shape();ks.moveTo(0,-.045);ks.lineTo(.3,-.045);ks.lineTo(.44,-.02);ks.lineTo(.34,.035);ks.lineTo(.2,.047);ks.lineTo(0,.047);ks.closePath();
    var kg=new T.ExtrudeGeometry(ks,{depth:.016,bevelEnabled:false});kg.translate(0,0,-.008);kg.rotateX(-Math.PI/2);kg.rotateY(Math.PI/2);
    var kb=new T.Mesh(kg,new T.MeshLambertMaterial({color:0xdfe6ee}));kb.position.set(0,0,-.22);kb.castShadow=true;
    var pv2=new T.Group();pv2.add(kb,bx(.016,.006,.26,0x8f9aa8,0,.011,-.36),bx(.15,.03,.035,0x7a828f,0,0,-.215),bx(.05,.06,.2,0x2b2f3d,0,0,-.1),bx(.056,.064,.02,0x555c68,0,0,-.06),bx(.056,.064,.02,0x555c68,0,0,-.11),bx(.056,.064,.02,0x555c68,0,0,-.16),bx(.065,.07,.035,0x7a828f,0,0,.01));
    pv2.rotation.set(.55,0,.3);g.add(pv2);}
};
// Grenade: stable weapon ID 5 (grenade). Profile ratings and range modifier are weapon-local.
WEAPON_PROFILES[5]=Object.freeze({name:"Grenade",damage:40,rpm:null,control:null,speed:98,vRecoil:null,hRecoil:null,mag:2,res:2,range:null,kind:"grenade"});
WEAPON_RANGE_MODIFIERS[5]=null;
WEAPON_MODEL_BUILDERS[5]=function(g,a){
 a(bx(.15,.15,.15,0x4a5a2a,0,0,-.3),bx(.16,.03,.16,0x3a4620,0,.03,-.3),bx(.06,.05,.06,0x888e98,0,.1,-.3),bx(.04,.03,.14,0xaab0b9,0,.13,-.27),bx(.1,.02,.02,0xd4a017,.06,.1,-.36));
};
// Kriss: stable weapon ID 6 (smg). Profile ratings and range modifier are weapon-local.
WEAPON_PROFILES[6]=Object.freeze({name:"Kriss",damage:21,rpm:93,control:59,speed:90,vRecoil:48,hRecoil:48,mag:30,res:210,range:60,kind:"smg"});
WEAPON_RANGE_MODIFIERS[6]=0.83;
WEAPON_MODEL_BUILDERS[6]=function(g,a){
 a(
    bx(.085,.1,.52,0x9c8b5e,0,.03,-.28),                       // upper receiver (FDE tan)
    bx(.08,.07,.34,0x2b2f3d,0,-.04,-.2),                        // lower receiver (dark polymer)
    bx(.09,.1,.2,0x8f7f55,0,.025,-.62),                         // barrel shroud
    bx(.092,.035,.03,0x111111,0,.03,-.56),bx(.092,.035,.03,0x111111,0,.03,-.62),bx(.092,.035,.03,0x111111,0,.03,-.68), // shroud vents
    cy(.017,.017,.14,0x1d2129,0,.03,-.79),cy(.026,.026,.05,0x111111,0,.03,-.87), // barrel + flash hider
    bx(.04,.022,.42,0x111111,0,.087,-.26),                      // top rail
    bx(.088,.03,.1,0x555c68,0,.05,-.12)                         // ejection port / bolt cover
 );
 // Register the complete single-Kriss reflex sight: these parts disappear only
 // while its 2D ADS reticle is active. Dual Kriss uses independent nested models,
 // stays hip-fire only and never activates this overlay.
 var opticParts=[
    bx(.05,.02,.12,0x1d2129,0,.108,-.2),                        // red-dot base
    bx(.008,.05,.012,0x111111,-.026,.13,-.15),bx(.008,.05,.012,0x111111,.026,.13,-.15),bx(.06,.008,.012,0x111111,0,.158,-.15), // sight rear frame
    bx(.008,.05,.012,0x111111,-.026,.13,-.25),bx(.008,.05,.012,0x111111,.026,.13,-.25),bx(.06,.008,.012,0x111111,0,.158,-.25), // sight front frame
    bx(.007,.007,.004,0xff2a2a,0,.13,-.256)                     // red dot
 ];
 opticParts.forEach(function(mesh){a(mesh);});
 g.userData.opticParts=opticParts;
 a(
    bx(.07,.26,.095,0x1d2129,0,-.17,-.12,-.3),                  // grip + magazine (angled back, Vector style)
    bx(.02,.025,.1,0x2b2f3d,0,-.09,-.22),                       // trigger guard
    bx(.05,.06,.035,0x2b2f3d,0,.03,0),bx(.06,.1,.03,0x1d2129,0,.0,.03)); // short folded stock + pad (kept tiny)
};
// Dual Kriss: stable weapon ID 7 (dual). Profile ratings and range modifier are weapon-local.
WEAPON_PROFILES[7]=Object.freeze({name:"Dual Kriss",damage:18,rpm:93,control:59,speed:90,vRecoil:48,hRecoil:48,mag:125,res:0,range:60,kind:"dual"});
WEAPON_RANGE_MODIFIERS[7]=0.83;
WEAPON_MODEL_BUILDERS[7]=function(g,a){
 {var kr=mkGun(6),kl=mkGun(6);kl.position.x=-.52;a(kr,kl);}
};
// AWP: stable weapon ID 8 (sniper). Profile ratings and range modifier are weapon-local.
WEAPON_PROFILES[8]=Object.freeze({name:"AWP",damage:81,rpm:39,control:66,speed:69,vRecoil:60,hRecoil:60,mag:5,res:64,range:180,kind:"sniper"});
WEAPON_RANGE_MODIFIERS[8]=0.99;
WEAPON_MODEL_BUILDERS[8]=function(g,a){
 {var bh=bx(.1,.025,.03,0x888e98,.07,.03,-.08);g.userData.bolt=bh;a(bx(.09,.13,.6,0x3b4a2a,0,0,-.1),cy(.018,.018,1,0x1d2129,0,.025,-.95),cy(.03,.03,.16,0x2b2f3d,0,.025,-1.5),bx(.085,.17,.45,0x3b4a2a,0,-.02,.4),bx(.09,.06,.18,0x2b2f3d,0,.07,.18),cy(.04,.04,.34,0x111111,0,.13,-.2),cy(.05,.05,.07,0x111111,0,.13,-.4),cy(.045,.045,.06,0x111111,0,.13,.0),bx(.03,.05,.04,0x333333,0,.09,-.3),bx(.07,.2,.09,0x2b2f3d,0,-.15,-.05,.2),bx(.06,.14,.1,0x2b2f3d,0,-.12,-.3),bh);}
};
// K2: stable weapon ID 9 (rifle). Profile ratings and range modifier are weapon-local.
WEAPON_PROFILES[9]=Object.freeze({name:"K2",damage:36,rpm:96,control:75,speed:79,vRecoil:66,hRecoil:33,mag:40,res:200,range:120,kind:"rifle"});
WEAPON_RANGE_MODIFIERS[9]=0.98;
WEAPON_MODEL_BUILDERS[9]=function(g,a){
 {
    // K2: unscoped silver rifle with low-profile iron sights, black rail,
    // ventilated handguard, 40-round curved magazine and telescopic stock.
    // Keep the centerline clear when aiming; this rifle has no reflex optic.
    // The provided reference informs this dedicated low-poly mesh.
    a(
      bx(.105,.12,.48,0x969f9e,0,0,-.23),      // receiver
      bx(.109,.046,.43,0x5f6c6e,0,.076,-.23),  // upper rail mount
      bx(.11,.07,.38,0x536265,0,-.005,-.65),   // handguard
      bx(.118,.024,.37,0x242a2e,0,.077,-.66), // top accessory rail
      cy(.022,.022,.40,0x20272b,0,.005,-1.03),// long exposed barrel
      cy(.031,.031,.10,0x101719,0,.005,-1.27),// muzzle
      bx(.08,.045,.19,0x343b40,0,-.015,-1.01),// gas block
      bx(.012,.025,.03,0x303c40,-.038,.102,-.22), // low rear iron sight ear
      bx(.012,.025,.03,0x303c40,.038,.102,-.22),  // low rear iron sight ear
      bx(.012,.037,.024,0x303c40,0,.105,-.91),    // small front iron post
      bx(.07,.08,.12,0x30373b,0,-.17,-.19,.26), // grip
      bx(.082,.20,.10,0x1e2428,0,-.22,-.46,-.22),// curved magazine
      bx(.084,.045,.1,0x424d50,0,-.32,-.50,-.3), // magazine base
      bx(.025,.018,.08,0x1d2428,0,-.09,-.23), // trigger guard
      bx(.05,.05,.33,0x242b2f,0,-.003,.31),   // stock beam
      bx(.09,.125,.28,0x20272b,0,-.02,.48),  // adjustable rear stock
      bx(.11,.17,.035,0x111719,0,-.02,.67),  // rubber butt plate
      bx(.14,.018,.13,0xb2bdb6,0,.066,-.50) // handguard metal strap
    );
    for(var k2v=0;k2v<5;k2v++){
      a(bx(.016,.013,.034,0x171d20,.054,.058,-.82+k2v*.071));
      a(bx(.016,.013,.034,0x171d20,-.054,.058,-.82+k2v*.071));
    }
    for(var k2m=0;k2m<4;k2m++){
      a(bx(.087,.009,.014,0x707d72,0,-.16-k2m*.038,-.46-k2m*.008));
    }
  }
};
// MP7: stable weapon ID 10 (smg). Profile ratings and range modifier are weapon-local.
WEAPON_PROFILES[10]=Object.freeze({name:"MP7",damage:21,rpm:93,control:60,speed:88,vRecoil:45,hRecoil:54,mag:30,res:200,range:60,kind:"smg"});
WEAPON_RANGE_MODIFIERS[10]=0.85;
WEAPON_MODEL_BUILDERS[10]=function(g,a){
 {
    // MP7: compact black receiver, foregrip, curved 30-round magazine,
    // collapsing wire stock and rail optic. Reference: supplied mp7.png.
    a(
      bx(.105,.15,.69,0x222829,0,0,-.24),bx(.110,.075,.62,0x111719,0,.086,-.23),
      bx(.116,.025,.58,0x3b4243,0,.127,-.26), // Picatinny top rail
      bx(.101,.115,.20,0x303739,0,-.012,-.67), // forward barrel shroud
      cy(.023,.023,.24,0x121618,0,.018,-.86),cy(.031,.031,.055,0x444e50,0,.018,-1.015),
      bx(.062,.2,.10,0x1b2023,0,-.21,-.48,.07), // vertical front grip
      bx(.073,.24,.105,0x171b1d,0,-.19,-.08,-.22), // pistol grip
      bx(.075,.22,.087,0x252a2d,0,-.22,-.33,-.16), // detachable magazine
      bx(.08,.035,.06,0x475053,0,-.36,-.40),
      bx(.026,.028,.47,0x181e21,0,.014,.34), // folding stock beam
      bx(.10,.23,.028,0x191f21,0,-.025,.61), // buttpad
      bx(.065,.025,.10,0x495457,0,-.036,-.05), // ejection panel
      bx(.12,.033,.08,0x111517,0,-.07,-.42)  // trigger guard
    );
    // Hide the physical MP7 optic frame during ADS: the tactical overlay supplies the reticle.
    // The receiver and Picatinny rail remain visible; only the five sight pieces disappear.
    var opticParts=[
      bx(.07,.014,.18,0x596062,0,.145,-.24), // optic rail base
      bx(.055,.015,.16,0x101819,0,.203,-.27), // holo upper
      bx(.013,.084,.018,0x0d1517,-.045,.174,-.28),
      bx(.013,.084,.018,0x0d1517,.045,.174,-.28),
      bx(.080,.016,.016,0x0c1418,0,.220,-.28)
    ];
    opticParts.forEach(function(m){a(m);});
    g.userData.opticParts=opticParts;
    for(var mp=0;mp<6;mp++){
      a(bx(.014,.013,.035,0x495054,-.059,.123,-.50+mp*.075));
      a(bx(.014,.013,.035,0x495054,.059,.123,-.50+mp*.075));
    }
    for(var mr=0;mr<4;mr++){
      a(bx(.083,.010,.013,0x626b6e,0,-.18-mr*.045,-.31-mr*.013));
    }
  }
};
// P90: stable weapon ID 11 (smg). Profile ratings and range modifier are weapon-local.
WEAPON_PROFILES[11]=Object.freeze({name:"P90",damage:24,rpm:92,control:54,speed:88,vRecoil:45,hRecoil:48,mag:50,res:200,range:65,kind:"smg"});
WEAPON_RANGE_MODIFIERS[11]=0.86;
WEAPON_MODEL_BUILDERS[11]=function(g,a){
 {
    // P90: distinctive bullpup thumb-hole stock, broad olive-grey shell,
    // horizontal top magazine and integrated optic. Reference: p90.png.
    var body=bx(.16,.205,.78,0x777b70,0,-.012,-.10);a(body);
    a(
      bx(.17,.08,.31,0x333a3b,0,.119,-.22), // receiver optic housing
      bx(.175,.057,.62,0x535d5a,0,.139,-.19), // top-mounted magazine
      bx(.166,.016,.53,0x1a2123,0,.181,-.23), // rail top
      bx(.20,.076,.25,0x666d65,0,-.002,-.60), // front barrel housing
      cy(.031,.031,.29,0x1c2427,0,.025,-.79),
      cy(.040,.040,.06,0x32383b,0,.025,-.98),
      bx(.165,.235,.39,0x7b7d71,0,-.045,.39), // long rear buttstock
      bx(.19,.265,.075,0x6d7169,0,-.056,.60),
      bx(.14,.039,.28,0x1c2628,0,-.146,.26), // grip undercut bridge
      bx(.080,.19,.08,0x4a4e45,0,-.20,-.10,-.20), // forward handle
      bx(.078,.13,.11,0x51554e,0,-.23,-.29,.15)
    );
    // Optic bracket and sight posts. Hidden while the 2D tactical sight overlay is active, otherwise the dark parts
    // sit in the line of sight and clutter the red dot (see src/game/76-tactical-optics.js).
    var opticParts=[
      bx(.11,.04,.21,0x454c48,0,.204,-.16), // optic bracket
      bx(.055,.045,.21,0x182224,0,.253,-.16),
      bx(.074,.018,.06,0x8f9996,0,.289,-.22),
      bx(.035,.028,.04,0x111a1d,0,.245,-.34)
    ];
    opticParts.forEach(function(m){a(m);});
    g.userData.opticParts=opticParts;
    // Cutout is visual rather than actual CSG; dark inset and perimeter
    // reproduces the P90's iconic large thumb-hole grip in low-poly style.
    a(bx(.172,.118,.23,0x131a1d,0,-.184,.25));
    a(bx(.164,.024,.26,0x8b8d80,0,-.120,.24));
    a(bx(.164,.023,.27,0x777b70,0,-.241,.25));
    for(var ps=0;ps<5;ps++)a(bx(.173,.011,.015,0x353d40,0,.173,-.43+ps*.095));
  }
};
// AK SOPMOD: stable weapon ID 12 (rifle). Profile ratings and range modifier are weapon-local.
WEAPON_PROFILES[12]=Object.freeze({name:"AK SOPMOD",damage:33,rpm:90,control:50,speed:74,vRecoil:64,hRecoil:60,mag:30,res:150,range:160,kind:"rifle"});
WEAPON_RANGE_MODIFIERS[12]=0.97;
WEAPON_MODEL_BUILDERS[12]=function(g,a){
 {
    // AK SOPMOD: black carbine body, curved magazine, tactical forward
    // rail + vertical grip, red-dot optic and folding stock. ak-sopmod.png.
    a(
      bx(.12,.146,.60,0x161b1f,0,0,-.25), // core receiver
      bx(.116,.055,.44,0x2e353a,0,.084,-.30), // upper receiver
      bx(.138,.1,.49,0x1d2427,0,.015,-.69), // long modular handguard
      bx(.145,.026,.59,0x343c41,0,.104,-.62), // full-length top rail
      cy(.023,.023,.43,0x22292d,0,.013,-1.13),
      cy(.032,.032,.085,0x515b5f,0,.013,-1.36), // muzzle device
      bx(.080,.28,.095,0x141a1d,0,-.185,-.13,-.25), // grip
      bx(.090,.28,.105,0x23282b,0,-.219,-.41,-.28), // curved magazine
      bx(.095,.040,.09,0x4b5558,0,-.350,-.49,-.25),
      bx(.064,.22,.10,0x181d1f,0,-.202,-.78), // vertical foregrip
      bx(.040,.018,.25,0x555d63,0,.024,.27), // stock tube
      bx(.115,.112,.27,0x1e2529,0,-.032,.46), // adjustable stock
      bx(.130,.17,.031,0x151a1d,0,-.034,.65), // buttstock
      bx(.055,.065,.13,0x31383a,0,-.018,-.38), // receiver controls
      bx(.070,.023,.13,0x5d6260,0,-.02,-.16) // ejection cover
    );
    // Optic frame (base, roof, posts, top bar). Hidden while the 2D tactical sight overlay is active, otherwise the
    // dark frame sits in the line of sight and covers the dot (see src/game/76-tactical-optics.js).
    var opticParts=[
      bx(.08,.027,.21,0x59666a,0,.149,-.26),
      bx(.065,.02,.125,0x161c20,0,.210,-.26), // optic roof
      bx(.014,.09,.015,0x151b1e,-.043,.183,-.27),
      bx(.014,.09,.015,0x151b1e,.043,.183,-.27),
      bx(.080,.014,.015,0x303d42,0,.232,-.27)
    ];
    opticParts.forEach(function(m){a(m);});
    g.userData.opticParts=opticParts;
    for(var sr=0;sr<8;sr++){
      a(bx(.018,.019,.026,0x596468,-.076,.096,-.88+sr*.070));
      a(bx(.018,.019,.026,0x596468,.076,.096,-.88+sr*.070));
    }
    for(var sm=0;sm<5;sm++)a(bx(.093,.009,.016,0x7e8580,0,-.18-sm*.045,-.37-sm*.018));
  }
};
// MP5K Ext: new stable weapon ID 13 (SMG). Never renumber existing weapon IDs.
// The long integral suppressor, black steel receiver, vertical foregrip and
// compact magazine follow the player-supplied silhouette, built with native Three.js primitives.
WEAPON_PROFILES[13]=Object.freeze({name:"MP5K Ext",damage:22,rpm:92,control:46,speed:86,vRecoil:49,hRecoil:60,mag:30,res:210,range:45,kind:"smg"});
// Inherit the existing SMG distance modifier; do not invent another falloff rule.
WEAPON_RANGE_MODIFIERS[13]=DAMAGE_FALLOFF.defaultModifiers.smg;
WEAPON_MODEL_BUILDERS[13]=function(g,a){
  var steel=0x171c21,body=0x242b31,edge=0x394249,dark=0x0c1014;
  a(
    bx(.127,.152,.62,steel,0,.006,-.17),      // stamped steel receiver
    bx(.132,.065,.59,body,0,.088,-.18),       // top receiver cover
    bx(.128,.024,.42,edge,0,.128,-.21),       // shallow top rail
    bx(.135,.118,.32,0x1b2228,0,-.01,-.61),  // front trunnion and shroud
    cy(.028,.028,.20,dark,0,.005,-.84),       // hidden barrel to suppressor
    cy(.064,.064,.66,0x151a1f,0,.005,-1.20), // long integral black suppressor
    cy(.068,.068,.035,edge,0,.005,-.91),      // suppressor rear collar
    cy(.069,.069,.029,0x343b42,0,.005,-1.49),// recessed muzzle cap
    cy(.039,.039,.031,dark,0,.005,-1.51),     // muzzle bore
    bx(.101,.035,.27,0x2d373e,0,-.024,-.62), // foregrip shroud
    bx(.067,.255,.095,dark,0,-.216,-.57),    // vertical front grip
    bx(.080,.22,.105,dark,0,-.179,.015,-.20), // rear pistol grip
    bx(.084,.278,.092,0x252b30,0,-.237,-.27,-.17), // magazine
    bx(.089,.029,.100,edge,0,-.376,-.33),     // magazine floorplate
    bx(.069,.022,.15,dark,0,-.102,-.12),     // trigger guard
    bx(.056,.045,.13,edge,.065,.01,-.12),    // selector housing
    bx(.125,.115,.11,0x1c2228,0,-.016,.20), // rear receiver end cap
    bx(.019,.050,.06,edge,-.095,.09,-.42)    // charging handle
  );
  // Minimal open iron sights: no optic frame and no scope overlay.
  a(
    bx(.016,.026,.028,edge,-.039,.150,.055),
    bx(.016,.026,.028,edge,.039,.150,.055),
    bx(.014,.033,.026,edge,0,.158,-.70)
  );
  // Suppressor markings and magazine seams are physical low-poly details.
  for(var k=0;k<4;k++){
    a(bx(.010,.009,.028,0x40464b,-.060,.014,-1.35+k*.105));
    a(bx(.010,.009,.028,0x40464b,.060,.014,-1.35+k*.105));
  }
  for(var m=0;m<4;m++)a(bx(.087,.007,.012,edge,0,-.198-m*.036,-.26-m*.007));
};
// UMP45 Ext D: stable weapon ID 14 (SMG). Keep every pre-existing ID unchanged.
// Low-poly Three.js interpretation of the user-supplied black UMP silhouette:
// elongated receiver, short barrel, angled 33-round magazine, vertical front
// grip, selector detail, slotted handguard, open iron sights, skeletal fold stock.
WEAPON_PROFILES[14]=Object.freeze({
 name:"UMP45 Ext D",damage:25,rpm:90,control:47,speed:87,
 vRecoil:48,hRecoil:48,mag:33,res:260,range:50,kind:"smg"
});
// Reuse the canonical SMG damage falloff and tuning, not a parallel damage system.
WEAPON_RANGE_MODIFIERS[14]=DAMAGE_FALLOFF.defaultModifiers.smg;
WEAPON_MODEL_BUILDERS[14]=function(g,a){
 var receiver=0x20262b,metal=0x30383e,polymer=0x151a1e,edge=0x4a555a,dark=0x0d1114;
 a(
  bx(.142,.172,.71,receiver,0,.01,-.21),       // long UMP upper receiver
  bx(.147,.055,.68,metal,0,.113,-.21),         // top receiver cover
  bx(.150,.023,.61,dark,0,.146,-.24),          // integrated accessory rail
  bx(.145,.127,.27,polymer,0,-.023,-.65),      // front handguard
  cy(.025,.025,.25,dark,0,.005,-.85),          // exposed short barrel
  cy(.039,.039,.060,metal,0,.005,-.995),       // unsuppressed muzzle device
  bx(.065,.018,.14,edge,0,.02,-.43),          // stamped ejection cover
  bx(.071,.035,.11,dark,0,-.112,-.14),         // trigger guard
  bx(.084,.260,.102,polymer,0,-.195,.013,-.24), // pistol grip
  bx(.087,.34,.095,metal,0,-.276,-.34,-.24),  // extended curved magazine
  bx(.089,.029,.104,dark,0,-.438,-.41),        // magazine base
  bx(.072,.220,.093,polymer,0,-.199,-.72),    // angled front vertical grip
  bx(.08,.033,.11,edge,0,-.318,-.73),          // front grip end cap
  bx(.060,.043,.16,metal,0,-.003,.22),         // stock hinge
  bx(.130,.052,.11,polymer,0,-.01,.29),       // fold-joint housing
  bx(.030,.032,.57,metal,-.087,-.050,.60,-.13), // left rear stock rail
  bx(.030,.032,.57,metal,.087,-.050,.60,-.13),  // right rear stock rail
  bx(.032,.030,.44,edge,-.081,-.143,.66,.22),  // angled stock bracing
  bx(.032,.030,.44,edge,.081,-.143,.66,.22),
  bx(.143,.215,.051,polymer,0,-.125,.93),      // open folding buttplate
  bx(.095,.040,.06,metal,0,.072,.27),         // stock catch
  bx(.018,.040,.045,edge,-.103,.028,-.39)      // charging handle
 );
 // Iron sights stay low and open; right-click ADS does not introduce an optic overlay.
 a(
  bx(.012,.028,.025,metal,-.041,.169,.075),
  bx(.012,.028,.025,metal,.041,.169,.075),
  bx(.014,.038,.021,edge,0,.165,-.78)
 );
 // Angled rail cuts, receiver markings and magazine ribs remain actual mesh detail.
 for(var i=0;i<6;i++){
  var z=-.77+i*.068;
  a(bx(.013,.024,.027,edge,-.077,.017,z));
  a(bx(.013,.024,.027,edge,.077,.017,z));
 }
 for(var j=0;j<5;j++)
  a(bx(.090,.009,.013,edge,0,-.20-j*.038,-.32-j*.013));
 a(bx(.019,.014,.075,0x8d352a,.075,-.025,.02)); // muted fire-selector mark
};
// HK417: stable weapon ID 15, assault rifle. Keep IDs 0–14 and their saves unchanged.
// Dedicated black low-poly model based on the supplied HK417 rifle silhouette:
// long quad-rail handguard, extended barrel, vertical foregrip, straight magazine,
// adjustable stock, and a box-shaped reflex sight with red-dot illumination.
WEAPON_PROFILES[15]=Object.freeze({
 name:"HK417",damage:33,rpm:92,control:50,speed:74,
 vRecoil:64,hRecoil:60,mag:30,res:150,range:160,kind:"rifle"
});
// Existing assault-rifle distance falloff. No parallel ballistics system.
WEAPON_RANGE_MODIFIERS[15]=DAMAGE_FALLOFF.defaultModifiers.rifle;
WEAPON_MODEL_BUILDERS[15]=function(g,a){
 var dark=0x101519,body=0x212a30,metal=0x394249,rail=0x4d575b,grip=0x181d21;
 a(
  bx(.128,.160,.63,body,0,.00,-.20),         // black receiver
  bx(.129,.058,.57,metal,0,.104,-.24),        // upper receiver
  bx(.145,.117,.83,body,0,.016,-.84),        // HK417 full-length handguard
  bx(.151,.031,.82,dark,0,.111,-.84),        // long Picatinny top rail
  bx(.158,.040,.77,metal,0,-.038,-.86),      // lower rail
  cy(.026,.026,.40,dark,0,-.006,-1.39),      // exposed barrel
  cy(.036,.036,.077,metal,0,-.006,-1.61),    // standard muzzle brake (not suppressed)
  bx(.070,.025,.15,rail,0,.015,-1.18),       // gas block
  bx(.100,.067,.16,metal,0,-.015,-.13),      // magazine well
  bx(.093,.315,.115,0x1b3029,0,-.242,-.28,-.08), // dark olive magazine
  bx(.095,.025,.121,dark,0,-.396,-.30),       // magazine floorplate
  bx(.080,.255,.112,grip,0,-.204,.095,-.25),  // rear pistol grip
  bx(.077,.042,.112,dark,0,-.108,-.03),       // trigger guard
  bx(.066,.270,.102,grip,0,-.226,-.84),      // vertical tactical front grip
  bx(.078,.028,.116,metal,0,-.369,-.84),     // foregrip grip-end
  bx(.050,.043,.36,metal,0,.000,.40),         // buffer tube
  bx(.121,.125,.37,grip,0,-.033,.57),        // telescopic polymer stock
  bx(.135,.196,.044,dark,0,-.038,.78),       // rubber stock buttplate
  bx(.045,.045,.085,rail,.083,.055,-.11),    // charging handle
  bx(.050,.016,.065,rail,.082,-.030,-.21)    // safety selector
 );
 // Receivers are mirrored geometry: top-and-side modular rail cuts.
 for(var i=0;i<11;i++){
  var z=-1.18+i*.065;
  a(
   bx(.016,.014,.028,rail,-.073,.127,z),
   bx(.016,.014,.028,rail,.073,.127,z),
   bx(.010,.022,.027,metal,-.080,.055,z),
   bx(.010,.022,.027,metal,.080,.055,z)
  );
 }
 for(var m=0;m<5;m++)a(bx(.096,.009,.013,metal,0,-.17-m*.049,-.25));
 // Actual low-poly box sight is displayed when hip-firing. The existing
 // tactical ADS overlay replaces it when aiming, so no geometry occludes the dot.
 var opticParts=[
  bx(.084,.023,.21,rail,0,.157,-.20),        // sight mounting base
  bx(.081,.035,.145,metal,0,.220,-.20),      // lower optic housing
  bx(.016,.092,.020,dark,-.059,.255,-.20),   // left window side
  bx(.016,.092,.020,dark,.059,.255,-.20),    // right window side
  bx(.136,.018,.025,dark,0,.301,-.20),      // rectangular roof
  bx(.017,.033,.020,rail,-.055,.321,-.20),  // left hood
  bx(.017,.033,.020,rail,.055,.321,-.20),   // right hood
  bx(.009,.009,.009,0xe73234,0,.259,-.215) // red dot for 3D display
 ];
 opticParts.forEach(function(part){a(part);});
 g.userData.opticParts=opticParts;
};
// XM8: stable weapon ID 16, assault rifle. Do not renumber saved weapon IDs 0–15.
// Dedicated grey/black low-poly XM8 silhouette based on the supplied image:
// polymer full-length shell, slotted elevated carry handle, round reflex optic,
// ribbed fore-end, magazine, grip and swept integrated shoulder stock.
WEAPON_PROFILES[16]=Object.freeze({
 name:"XM8",damage:25,rpm:92,control:63,speed:82,
 vRecoil:49,hRecoil:28,mag:30,res:150,range:100,kind:"rifle"
});
// Share the existing rifle damage-falloff and rate-of-fire tuning.
WEAPON_RANGE_MODIFIERS[16]=DAMAGE_FALLOFF.defaultModifiers.rifle;
WEAPON_MODEL_BUILDERS[16]=function(g,a){
 var shell=0x555d64,upper=0x666e74,high=0x858d94,shade=0x394148;
 var dark=0x1d2328,rail=0x30373d,grip=0x282f34,highlight=0x929a9d;
 a(
  bx(.176,.168,.82,shell,0,.010,-.24),       // XM8 extended upper polymer shell
  bx(.174,.096,.61,upper,0,.083,-.29),       // elevated, rounded-looking receiver
  bx(.177,.130,.60,shade,0,-.014,-.67),      // forward shell / ventilation shroud
  bx(.171,.085,.42,shell,0,-.021,-.92),      // broad curved-look fore-end
  bx(.120,.032,.64,rail,0,.153,-.30),        // top bridge underneath carry handle
  cy(.022,.022,.27,dark,0,-.009,-1.29),      // projecting barrel
  cy(.032,.032,.077,shade,0,-.009,-1.46),    // short XM8 muzzle brake
  bx(.112,.075,.29,upper,0,.02,.31),         // rear receiver
  bx(.128,.115,.38,shell,0,-.002,.52),       // integrated rear shoulder housing
  bx(.136,.165,.26,shade,0,-.010,.75),       // folding / telescoping stock
  bx(.153,.200,.042,dark,0,-.01,.90),        // textured rubber buttplate
  bx(.084,.237,.106,grip,0,-.209,.11,-.26), // angled main pistol grip
  bx(.083,.030,.123,dark,0,-.112,-.03),      // trigger guard
  bx(.097,.302,.117,0x323a3f,0,-.244,-.25,-.16), // long dark magazine
  bx(.102,.032,.123,dark,0,-.397,-.30),      // magazine base
  bx(.075,.245,.09,grip,0,-.219,-.74),      // vertical forward grip
  bx(.085,.027,.108,rail,0,-.361,-.74),     // foregrip cap
  bx(.061,.021,.110,highlight,.089,.024,.12), // side marking panel
  bx(.055,.038,.022,dark,.097,-.003,.032)   // fire selector
 );
 // Top carry handle: open center with side rails, raised rear arch and short struts.
 // Do not fill this open void with a solid box.
 a(
  bx(.024,.034,.72,shade,-.088,.222,-.26), // left carry-handle runner
  bx(.024,.034,.72,shade,.088,.222,-.26),  // right carry-handle runner
  bx(.184,.041,.12,high,0,.248,-.57),     // forward arch
  bx(.180,.047,.12,upper,0,.255,.045),    // rear arch
  bx(.025,.145,.065,shade,-.085,.189,-.57),
  bx(.025,.145,.065,shade,.085,.189,-.57),
  bx(.025,.125,.06,shade,-.082,.184,.044),
  bx(.025,.125,.06,shade,.082,.184,.044)
 );
 // Receiver side grooves and vent slots, identical to generic low-poly geometry.
 for(var i=0;i<6;i++){
  var z=-.95+i*.085;
  a(
   bx(.011,.024,.056,dark,-.087,.035,z),
   bx(.011,.024,.056,dark,.087,.035,z)
  );
 }
 for(var j=0;j<5;j++){
  var rib=-.91+j*.085;
  a(bx(.014,.011,.047,highlight,-.083,-.091,rib));
  a(bx(.014,.011,.047,highlight,.083,-.091,rib));
 }
 for(var k=0;k<4;k++)a(bx(.10,.009,.020,shade,0,-.215-k*.047,-.24-k*.012));
 // Compact round 3D optic between carry-handle rails. The optic is hidden
 // by the existing tactical ADS renderer during RMB so geometry cannot obstruct aim.
 var opticParts=[
  bx(.100,.030,.150,rail,0,.287,-.12),          // base
  bx(.076,.071,.070,dark,0,.334,-.12),         // mount neck
  cy(.079,.079,.23,shade,0,.402,-.12),         // cylindrical optic tube
  cy(.087,.087,.032,dark,0,.402,-.232),        // front eyepiece rim
  cy(.087,.087,.031,upper,0,.402,-.004),       // rear eyepiece rim
  bx(.029,.035,.067,shade,.073,.476,-.085),   // adjustment turret
  bx(.067,.031,.071,shade,0,.491,-.113),       // top adjustment housing
  bx(.012,.012,.012,0xff3838,0,.402,-.252)   // red point when hip-firing
 ];
 opticParts.forEach(function(item){a(item);});
 g.userData.opticParts=opticParts;
};
// XM2010, stable ID 17. Tan modular bolt-action sniper from supplied reference.
// Uses original AWP bolt/scoping mechanics; no new gameplay or ammo system.
WEAPON_PROFILES[17]=Object.freeze({name:"XM2010",damage:82,rpm:0,control:86,speed:69,vRecoil:64,hRecoil:60,mag:5,res:30,range:200,kind:"sniper"});
WEAPON_RANGE_MODIFIERS[17]=DAMAGE_FALLOFF.defaultModifiers.sniper;
WEAPON_MODEL_BUILDERS[17]=function(g,a){
 var tan=0x8d724c,light=0xa68a60,brown=0x685339,dark=0x1a1e21,steel=0x3b4347,black=0x0e1215;
 a(bx(.15,.14,.72,tan,0,0,-.18),bx(.15,.06,.68,light,0,.09,-.2),
   bx(.17,.11,1.05,brown,0,.005,-.92),bx(.172,.029,1.06,light,0,.088,-.92),
   bx(.172,.028,1.0,dark,0,-.064,-.94),
   cy(.024,.024,.50,steel,0,0,-1.58),cy(.055,.055,.68,dark,0,0,-2.06),
   cy(.062,.062,.04,steel,0,0,-1.75),cy(.060,.060,.035,steel,0,0,-2.405),
   cy(.029,.029,.035,black,0,0,-2.43),
   bx(.105,.05,.15,tan,0,-.07,-.1),bx(.103,.19,.12,steel,0,-.19,-.17,-.08),
   bx(.107,.024,.12,black,0,-.29,-.2),bx(.075,.24,.095,dark,0,-.2,.13,-.25),
   bx(.08,.035,.13,steel,0,-.1,.06),bx(.082,.046,.43,steel,0,-.01,.42),
   bx(.042,.034,.46,brown,-.075,-.125,.66,.1),bx(.042,.034,.46,brown,.075,-.125,.66,.1),
   bx(.135,.09,.20,tan,0,.004,.77),bx(.15,.18,.06,black,0,-.06,.94),
   bx(.14,.13,.11,light,0,-.07,1.01),
   bx(.025,.25,.03,black,-.05,-.24,-1.23,-.1),
   bx(.025,.25,.03,black,.05,-.24,-1.23,.1),
   bx(.12,.028,.085,steel,0,-.365,-1.23),
   bx(.13,.028,.26,steel,0,.145,-.18),
   bx(.025,.095,.06,steel,-.055,.185,-.18),
   bx(.025,.095,.06,steel,.055,.185,-.18),
   cy(.053,.053,.62,black,0,.253,-.24),
   cy(.084,.084,.13,steel,0,.253,-.56),
   cy(.064,.064,.07,steel,0,.253,.08),
   cy(.045,.045,.075,steel,0,.328,-.24),
   cy(.031,.031,.057,steel,.07,.276,-.25)
 );
 for(var i=0;i<10;i++){var z=-1.36+i*.089;
   a(bx(.012,.024,.050,dark,-.087,.016,z),bx(.012,.024,.050,dark,.087,.016,z),
     bx(.012,.011,.039,light,-.085,.090,z),bx(.012,.011,.039,light,.085,.090,z));}
 // Bolt knob is parented to the bolt handle and moves with the original AWP animation.
 var handle=bx(.095,.025,.06,steel,.07,.03,-.08);
 handle.add(cy(.025,.025,.065,black,.06,.008,0));
 g.userData.bolt=handle;a(handle);
};
// Saiga-12, stable ID 18: box-mag semi-auto shotgun with no pump between shots.
WEAPON_PROFILES[18]=Object.freeze({name:"Saiga-12",damage:100,rpm:53,control:0,speed:78,vRecoil:100,hRecoil:58,mag:6,res:30,range:70,kind:"shotgun"});
WEAPON_RANGE_MODIFIERS[18]=DAMAGE_FALLOFF.defaultModifiers.shotgun;
WEAPON_MODEL_BUILDERS[18]=function(g,a){
 var c=0x242a2f,s=0x343d42,r=0x495259,p=0x1b2227,b=0x0d1317;
 a(bx(.154,.172,.69,c,0,.006,-.18),bx(.160,.045,.61,s,0,.103,-.20),
 bx(.149,.119,.67,p,0,-.015,-.72),bx(.165,.028,.69,r,0,.078,-.74),
 bx(.166,.035,.55,s,0,-.080,-.72),cy(.038,.038,.53,b,0,-.008,-1.24),
 cy(.044,.044,.09,s,0,-.008,-1.50),bx(.105,.064,.20,s,0,-.080,-.14),
 bx(.102,.305,.134,0x2b3337,0,-.272,-.24,-.17),bx(.108,.026,.14,b,0,-.428,-.30),
 bx(.077,.245,.113,p,0,-.213,.12,-.30),bx(.077,.035,.15,b,0,-.123,.005),
 bx(.113,.113,.39,p,0,-.040,.46),bx(.157,.165,.40,c,0,-.032,.72),
 bx(.165,.205,.056,b,0,-.045,.96),bx(.028,.018,.10,r,.091,.016,-.02),
 bx(.033,.025,.084,s,-.090,.035,-.14),bx(.115,.028,.37,r,0,.139,-.20));
 for(var i=0;i<7;i++){var z=-.99+i*.087;a(bx(.01,.022,.038,b,-.08,.007,z),
 bx(.01,.022,.038,b,.08,.007,z),bx(.01,.012,.036,r,-.08,-.085,z),
 bx(.01,.012,.036,r,.08,-.085,z));}
 for(var j=0;j<5;j++)a(bx(.105,.008,.012,r,0,-.22-j*.04,-.25-j*.012));
 // Nine physical sight meshes hidden by tactical ADS to keep the aim clear.
 var opticParts=[bx(.09,.028,.17,s,0,.176,-.18),bx(.095,.034,.12,p,0,.228,-.18),
 bx(.016,.10,.027,b,-.067,.266,-.18),bx(.016,.10,.027,b,.067,.266,-.18),
 bx(.144,.025,.033,b,0,.327,-.18),bx(.03,.024,.11,r,0,.215,-.18),
 bx(.013,.018,.027,s,-.062,.331,-.18),bx(.013,.018,.027,s,.062,.331,-.18),
 bx(.01,.01,.009,0xff4242,0,.275,-.20)];
 opticParts.forEach(function(m){a(m);});g.userData.opticParts=opticParts;
};
// The score->engine conversion is game balancing, NOT an unofficial Point Blank formula.
// min/max are real rounds-per-minute bounds for each archetype; spread is angular.
var WEAPON_TUNING={
 pistol:{rpmMin:180,rpmMax:360,spread:.09,bulletSpeed:160,reload:1,viewKick:1.1,recoilScale:.35},
 rifle:{rpmMin:400,rpmMax:750,spread:.13,bulletSpeed:180,reload:1.4,viewKick:.9,recoilScale:.65},
 shotgun:{rpmMin:45,rpmMax:90,spread:.6,bulletSpeed:125,reload:2.2,pellets:6,viewKick:1.7,recoilScale:1.2},
 rocket:{rpmMin:25,rpmMax:45,spread:.02,bulletSpeed:15,reload:1.8,viewKick:2,recoilScale:1.3},
 knife:{cooldown:.55,reload:1},
 grenade:{cooldown:1.1,reload:1},
 smg:{rpmMin:650,rpmMax:1050,spread:.075,bulletSpeed:170,reload:1.5,viewKick:.65,recoilScale:.45},
 dual:{rpmMin:850,rpmMax:1250,spread:.095,bulletSpeed:170,reload:2.4,viewKick:.55,recoilScale:.4},
 sniper:{rpmMin:30,rpmMax:65,spread:.21,bulletSpeed:420,reload:2.6,viewKick:2.8,recoilScale:1.5}
};
function weaponProfile(p,id){var t=WEAPON_TUNING[p.kind],pel=t.pellets||1;
  var rangeModifier=WEAPON_RANGE_MODIFIERS[id];
  if(rangeModifier===undefined)rangeModifier=DAMAGE_FALLOFF.defaultModifiers[p.kind]||null;
  var realRpm=p.rpm===null?null:t.rpmMin+(t.rpmMax-t.rpmMin)*p.rpm/100;
  var speed=t.bulletSpeed||0;
  var w={n:p.name,stats:p,cd:realRpm===null?t.cooldown:60/realRpm,
    dmg:p.damage/pel,spd:speed,life:p.range===null?0:p.range/speed,
    pel:p.kind==='knife'||p.kind==='grenade'?0:pel,
    spr:p.control===null?0:(t.spread||0)*(100-p.control)/100,
    mag:p.mag,res:p.res,rt:t.reload,
    range:p.range,moveMult:p.speed/100,
    rangeModifier:rangeModifier,rangeUnit:rangeModifier?DAMAGE_FALLOFF.referenceUnits:null,
    viewKick:t.viewKick?Math.min(.26,(.015+.001*p.vRecoil)*t.viewKick):0,
    recoilScale:t.recoilScale||0};
  if(p.kind==='rocket')w.rk=1;
  if(p.kind==='knife')w.melee=1;
  if(p.kind==='grenade')w.gr=1;
  if(p.kind==='dual')w.dual=1;
  if(p.kind==='sniper')w.snp=1;
  if(p.pump===true){w.pump=1;w.pumpDuration=Math.min(.68,w.cd*.8);}
  return w;
}
var WP=WEAPON_PROFILES.map(weaponProfile);
// Fixed 2D pellet spread inspired by CS:GO's learnable shotgun concept.
// Golden-angle disk distributes pellets near/around the crosshair; no RNG,
// fixed weapon IDs, extra projectile system or copies of Valve's pattern data.
function shotgunPelletSpread(index,count){
 if(count<=1)return[0,0];
 var radius=.88*Math.sqrt((index+.5)/count);
 var angle=index*Math.PI*(3-Math.sqrt(5));
 return[Math.cos(angle)*radius,Math.sin(angle)*radius];
}
// EW: stats used for bot (enemy) bullets are retired; bots now use WP / WEAPON_PROFILES.
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
var mt={t:60,cd:0,over:true},ts=[0,0],rq=[],ROS=[],curK=null,pl,en,bl,cr,fx,sk,score,run=false,spawnT,crateT,tt=0,toastT=0,adsT=0,sprT=0,ADF=[56,44,58,58,70,70,50,70,14,44,42,44,36,54,54,42,46,14,49],AP=[[0,-0.066,-0.5],[0,-0.125,-0.5],[0,-0.22,-0.56],[0.22,-0.24,-0.62],[0,-0.1,-0.5],[0,-0.1,-0.5],[0,-0.21,-0.55],[0,-0.13,-0.5],[0,-0.14,-0.5],[0,-0.215,-0.53],[0,-0.25,-0.58],[0,-0.27,-0.56],[0,-0.18,-0.64],[0,-0.245,-0.56],[0,-0.235,-0.54],[0,-0.21,-0.6],[0,-0.245,-0.57],[0,-0.14,-0.5],[0,-0.21,-0.55]],bobP=0,bobL=performance.now(),lob=true;
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
  var build=WEAPON_MODEL_BUILDERS[i];if(!build)throw Error("Unknown weapon model "+i);
  build(g,a);return g;}
// hold = the first-person gun group (child of VS). guns[i] = model of weapon i; only guns[pl.w] is visible (set in loop()).
// mflash/mflash2 = muzzle flash spheres (mflash2 is the LEFT gun flash for Dual Kriss at x=-0.52).
var hold=new T.Group(),guns=WEAPON_PROFILES.map(function(p,i){return mkGun(i);});guns[3].scale.setScalar(.8);guns.forEach(function(g){hold.add(g);});
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
var RG=[[0,-0.2,-0.1],[0,-0.2,-0.15],[0,-0.13,-0.08],[0,-0.14,-0.2],[0,0.02,-0.09],[0,-0.1,-0.3],[0,-0.22,-0.1],[0,-0.22,-0.1],[0,-0.19,-0.06],[0,-0.2,-0.19],[0,-0.22,-0.1],[0,-0.24,-0.1],[0,-0.205,-0.15],[0,-0.21,-0.12],[0,-0.21,-0.12],[0,-0.21,-0.16],[0,-0.21,-0.1],[0,-0.19,-0.06],[0,-0.19,-0.09]],
 RL=[[-0.03,-0.22,-0.22],[0,-0.09,-0.62],[0,-0.1,-0.58],[0,-0.1,-0.7],[-0.3,-0.5,-0.1],[-0.3,-0.5,-0.1],[0,-0.09,-0.5],[-0.52,-0.22,-0.1],[0,-0.1,-0.62],[0,-0.09,-0.72],[0,-0.16,-0.54],[0,-0.15,-0.56],[0,-0.18,-0.84],[0,-0.16,-0.65],[0,-0.17,-0.66],[0,-0.17,-0.88],[0,-0.18,-0.74],[0,-0.1,-0.62],[0,-0.12,-0.56]],
 PT=[[0,-0.2,-0.28],[0,-0.24,-0.4],[0,-0.12,-0.2],[0,0.02,-0.95],[0,0,0],[0,0,0],[0,-0.24,-0.35],[0,0,0],[0,-0.24,-0.42],[0,-0.24,-0.43],[0,-0.32,-0.3],[0,-0.23,-0.42],[0,-0.31,-0.45],[0,-0.29,-0.3],[0,-0.28,-0.32],[0,-0.3,-0.4],[0,-0.3,-0.35],[0,-0.24,-0.42],[0,-0.28,-0.24]],
 MODE=[0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],NC=[1,1,3,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],DD=[-.1,-.34,-.28];
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
  // Pump and the supporting hand follow a complete back/forward stroke.
  var slide=guns[w]&&guns[w].userData.pumpSlide,pull=0;
  if(WP[w].pump&&pl.pump>0&&pl.rl<=0){
    var phase=Math.max(0,Math.min(1,1-pl.pump/WP[w].pumpDuration));
    if(phase<.18)pull=0;else if(phase<.5)pull=(phase-.18)/.32;
    else if(phase<.69)pull=1;else pull=Math.max(0,1-(phase-.69)/.31);
    pos=[rest[0],rest[1],rest[2]+.19*pull];
    if(phase>=.48&&!pl.pumpEjected){pl.pumpEjected=true;ejectShell(w,1);}
  }
  if(slide)slide.position.z=-.6+.19*pull;
  var tm=performance.now()/1000;bobP+=(tm*1000-bobL)/1000*(7.5+4*sprT)*(1-.2*wtT);bobL=tm*1000;var sw=Math.sin(bobP),bm=mvAmt,idle=Math.sin(tm*1.7),rl=t>=0,wob=rl?Math.sin(Math.PI*t*3)*.02:0;
  handR.position.y+=rl?-tilt*.05:0;handR.position.z+=rl?tilt*.04:0;
  var lx=pos[0],ly=pos[1]+wob,lz=pos[2];
  handL.position.set(lx,ly,lz);handL.rotation.set(rl?-tilt*.6:0,0,rl?Math.sin(t*20)*.15*tilt:0);
  magP.visible=pr===1;shP.visible=pr===2;rkP.visible=pr===3;
  var X=xp(w);
  var a=canAds(w)?adsT*adsT*(3-2*adsT):0,sp=sprT*(1-a),bb=bm*(1-.85*a)*(1+.7*sp)*(1+.5*wtT),AA=AP[w]||AP[0];
  hold.position.set((.26+sw*.012*bb+X[0]-.09*sp)*(1-a)+AA[0]*a,(-.17-tilt*.12-Math.abs(sw)*.02*bb+idle*.004+X[1]-.07*sp)*(1-a)+AA[1]*a,(-.5+kick*(1-.5*a)+tilt*.06+X[2]+.03*sp)*(1-a)+AA[2]*a);
  hold.rotation.set((kick*.6+tilt*.45+idle*.004+X[3])*(1-.8*a)-.42*sp,(tilt*.3+X[4])*(1-a)+.55*sp,(-tilt*.35+sw*.012*bb+X[5])*(1-a)+.18*sp);
  var boltGun=WP[w]&&WP[w].snp?guns[w]:null,bh8=boltGun&&boltGun.userData.bolt;
  if(bh8){var bo=pl.rl<=0?(pl.bolt||0):0;
    if(bo>0){var bp=1-bo/BOLT_T,hg=0,pu=0,lf=0;
      if(bp<.15)hg=bp/.15;else if(bp<.3){hg=1;lf=(bp-.15)/.15;}else if(bp<.5){hg=lf=1;pu=(bp-.3)/.2;}else if(bp<.6){hg=lf=pu=1;}else if(bp<.78){hg=lf=1;pu=1-(bp-.6)/.18;}else if(bp<.88){hg=1;lf=1-(bp-.78)/.1;}else hg=1-(bp-.88)/.12;
      hg=hg*hg*(3-2*hg);lf=lf*lf*(3-2*lf);pu=pu*pu*(3-2*pu);
      if(bp>=.4&&!pl.bc){pl.bc=1;ejectShell(w,1);}
      var by=.03+.04*lf,bz=-.08+.17*pu;bh8.position.set(.07,by,bz);
      handR.position.set(RG[8][0]+(.07-RG[8][0])*hg,RG[8][1]+(by-.04-RG[8][1])*hg,RG[8][2]+(bz-RG[8][2])*hg);}
    else bh8.position.set(.07,.03,-.08);}
  aim(armR,[handR.position.x,handR.position.y,handR.position.z],SHR);aim(armL,[lx,ly,lz],SHL);handL.visible=armL.visible=(w<4||w>5);
}
// M2 BOT fire control: legal live-sight 3D yaw/pitch and bounded human-like response.
// Never read target coordinates after LOS is lost. Never change shared weapon damage.
var BOT_AIM=Object.freeze({
 reactionMin:.18,reactionMax:.46,turnYaw:4.6,turnPitch:2.8,
 maxLeadSeconds:.18,maxObservedVelocity:8,torsoHeight:1.12,
 yawTolerance:.19,pitchTolerance:.15,maxPitch:1.08,
 classNoise:Object.freeze({pistol:.034,rifle:.025,smg:.043,dual:.052,
   shotgun:.046,sniper:.014,rocket:.035})
});
function botAimDelta(a,b){
 return Math.atan2(Math.sin(b-a),Math.cos(b-a));
}
function botAimClear(e){
 if(typeof botQaEnabled!=='undefined'&&botQaEnabled)botQaSightLost(e);
 e.aimTarget=null;e.aimReadyAt=0;e.aimCanFire=false;
 e.aimSample=null;e.aimShotPitch=null;e.aimShots=0;
}
function botAimUpdate(e,target,dt){
 if(!target||!botIntelVisible(e,target)){
  botAimClear(e);return false;
 }
 var current=e.aimTarget===target;
 if(!current){
  if(typeof botQaEnabled!=='undefined'&&botQaEnabled)botQaObserve(e,target);
  e.aimTarget=target;
  e.aimReadyAt=tt+BOT_AIM.reactionMin+
    Math.random()*(BOT_AIM.reactionMax-BOT_AIM.reactionMin);
  // Start each new engagement from the body's actual current orientation.
  // Reusing a previous target's stale yaw would visually snap after patrolling.
  e.aimYaw=e.g&&e.g.rotation&&Number.isFinite(e.g.rotation.y)?
    e.g.rotation.y:Number.isFinite(e.aimYaw)?e.aimYaw:0;
  e.aimPitch=Number.isFinite(e.aimPitch)?e.aimPitch:0;
  e.aimSample=null;e.aimShots=0;
 }
 // Sample velocity only while the opponent is actually visible.
 var sample=e.aimSample,vx=0,vz=0,vy=0;
 if(sample&&tt>sample.at&&tt-sample.at<.35){
  var elapsed=tt-sample.at;
  vx=(target.x-sample.x)/elapsed;vz=(target.z-sample.z)/elapsed;
  vy=((target.y||0)-sample.y)/elapsed;
  var speed=Math.hypot(vx,vz,vy);
  if(speed>BOT_AIM.maxObservedVelocity){
   var scale=BOT_AIM.maxObservedVelocity/speed;
   vx*=scale;vz*=scale;vy*=scale;
  }
 }
 e.aimSample={x:target.x,z:target.z,y:target.y||0,at:tt};
 var w=WP[e.weapon]||WP[e.primary]||WP[0],
     dx=target.x-e.x,dz=target.z-e.z,dist=Math.hypot(dx,dz)||.01,
     lead=Math.min(BOT_AIM.maxLeadSeconds,dist/Math.max(1,w.spd||160));
 // Predictions originate ONLY from fresh visual samples; do not pursue unseen positions.
 var tx=target.x+vx*lead,tz=target.z+vz*lead,
     horizontal=Math.max(.01,Math.hypot(tx-e.x,tz-e.z)),
     targetHeight=(target.y||0)+vy*lead+BOT_AIM.torsoHeight-.3*(target.crA||0),
     muzzleHeight=(e.y||0)+1.07-.3*(e.crA||0),
     desiredYaw=Math.atan2(tx-e.x,tz-e.z),
     desiredPitch=Math.max(-BOT_AIM.maxPitch,Math.min(BOT_AIM.maxPitch,
       Math.atan2(targetHeight-muzzleHeight,horizontal))),
     yawStep=Math.max(-BOT_AIM.turnYaw*dt,Math.min(BOT_AIM.turnYaw*dt,
       botAimDelta(e.aimYaw,desiredYaw))),
     pitchStep=Math.max(-BOT_AIM.turnPitch*dt,Math.min(BOT_AIM.turnPitch*dt,
       desiredPitch-e.aimPitch));
 e.aimYaw+=yawStep;
 e.aimPitch+=pitchStep;
 e.aimYawError=Math.abs(botAimDelta(e.aimYaw,desiredYaw));
 e.aimPitchError=Math.abs(desiredPitch-e.aimPitch);
 e.aimShots=Math.max(0,(e.aimShots||0)-dt*2.2);
 e.aimCanFire=tt>=e.aimReadyAt&&
   e.aimYawError<=BOT_AIM.yawTolerance&&
   e.aimPitchError<=BOT_AIM.pitchTolerance;
 return e.aimCanFire;
}
function botAimShot(e,w,d){
 // One lawful bullet direction, with independent class-specific angular error.
 // Shared fire() still applies canonical spread, pellet pattern, hitboxes and damage.
 if(!e.aimCanFire||!e.aimTarget||!botIntelVisible(e,e.aimTarget))return null;
 var kind=w.stats&&w.stats.kind||'rifle',
     base=BOT_AIM.classNoise[kind]||.032,
     distancePenalty=Math.min(.065,Math.max(0,d)*.0013),
     burstPenalty=Math.min(.04,(e.aimShots||0)*.006),
     spread=base+distancePenalty+burstPenalty,
     yaw=(Math.random()-.5)*2*spread,
     pitch=(Math.random()-.5)*2*spread;
 e.aimShots=(e.aimShots||0)+1;
 return {yaw:e.aimYaw+yaw,
  pitch:Math.max(-BOT_AIM.maxPitch,Math.min(BOT_AIM.maxPitch,e.aimPitch+pitch))};
}
// AI weapons share exactly the same WP profiles, ballistics, ammo and reload as players.
// Only accuracy and loadout selection are AI-specific, not bullet damage.
var BOT_WEAPONS=Object.freeze({
  primaries:[1,1,1,2,2,6,6,6,7,8],
  sidearm:0,knife:4,grenade:5,
  meleeRange:1.7,grenadeMinDistance:9,grenadeMaxDistance:18,grenadeChance:.035,
  grenadeCooldown:12,aimNoise:.055,noisePerUnit:.0045,
  safeRocketDistance:7
});
function botVisualWeapon(e,id){
  if(e.visualWeapon===id)return;
  var group=e.g&&e.g.userData&&e.g.userData.gun;
  if(group){
    var old=e.g.userData.rg;if(old)group.remove(old);
    var model=mkGun(id);model.rotation.y=Math.PI;model.scale.setScalar(1.2);
    model.position.set(.2,1.05,-.16);group.add(model);e.g.userData.rg=model;
    model.traverse(function(m){if(m.material&&e.ms)e.ms.push(m.material);});
  }
  e.visualWeapon=id;
}
function botInitialLoadout(e){
  var pool=BOT_WEAPONS.primaries,primary=pool[(Math.random()*pool.length)|0];
  e.primary=primary;e.weapon=primary;e.visualWeapon=-1;e.ammo={};
  [primary,BOT_WEAPONS.sidearm,BOT_WEAPONS.grenade].forEach(function(id){
    e.ammo[id]={mag:WP[id].mag,res:WP[id].res};
  });
  e.reloadId=null;e.reloadLeft=0;e.grenadeAt=0;
  botVisualWeapon(e,primary);
}
function botUpdateReload(e,dt){
  if(e.reloadId===null||e.reloadId===undefined)return;
  e.reloadLeft=Math.max(0,e.reloadLeft-dt);
  if(e.reloadLeft>0)return;
  var id=e.reloadId,a=e.ammo[id],w=WP[id];
  if(a){var n=Math.min(w.mag-a.mag,a.res);a.mag+=n;a.res-=n;}
  e.reloadId=null;
}
function botStartReload(e,id){
  var a=e.ammo[id],w=WP[id];if(!a||!w||a.mag>=w.mag||a.res<=0||e.reloadId!==null)return false;
  e.reloadId=id;e.reloadLeft=WP[id].rt;return true;
}
function botChooseWeapon(e,d){
  if(d<=BOT_WEAPONS.meleeRange)return BOT_WEAPONS.knife;
  var p=e.primary,primary=e.ammo[p],secondary=e.ammo[BOT_WEAPONS.sidearm];
  if(primary&&primary.mag>0&&e.reloadId!==p&&!(p===3&&d<BOT_WEAPONS.safeRocketDistance))return p;
  if(primary&&primary.res>0&&primary.mag<=0)botStartReload(e,p);
  if(secondary&&secondary.mag>0&&e.reloadId!==BOT_WEAPONS.sidearm)return BOT_WEAPONS.sidearm;
  if(secondary&&secondary.res>0&&secondary.mag<=0)botStartReload(e,BOT_WEAPONS.sidearm);
  return null;
}
function botThrowGrenade(e,face){
  var a=e.ammo[BOT_WEAPONS.grenade];if(!a||!a.mag||e.reloadId!==null)return false;
  a.mag--;e.grenadeAt=tt+BOT_WEAPONS.grenadeCooldown;
  var sp=16;grs.push({m:mkGren(),by:e,x:e.x+Math.sin(face)*.6,z:e.z+Math.cos(face)*.6,
    y:1.3+(e.y||0),vx:Math.sin(face)*sp,vz:Math.cos(face)*sp,vy:5.5,t:1.7});
  if(a.mag===0)botStartReload(e,BOT_WEAPONS.grenade);
  return true;
}
function botAttack(e,target,face,d){
  var id=botChooseWeapon(e,d);
  if(id===null||e.reloadId===id)return false;
  var w=WP[id];
  if(id!==BOT_WEAPONS.knife&&d>w.range)return false;
  if(id===BOT_WEAPONS.knife){
    if(!clearTo(e.x,e.z,target.x,target.z,0))return false;
    curK=e;killW=id;hsF=false;
    if(target===pl)hurt(w.dmg,e.x,e.z,'melee');
    else dmgE(target,w.dmg,Math.sin(face),Math.cos(face),0,'melee');
  }else{
    var ammo=e.ammo[id];if(!ammo||ammo.mag<=0)return false;
    var solution=botAimShot(e,w,d);
    if(!solution)return false;
    ammo.mag--;
    e.aimShotPitch=solution.pitch;
    fire(e,solution.yaw,w,'e',0);
    e.aimShotPitch=null;
  }
  e.weapon=id;botVisualWeapon(e,id);e.cd=w.cd;e.rc=1;e.vis=1.6;
  return true;
}
function botNeedsMelee(e){var a=e.ammo||{},p=a[e.primary],s=a[BOT_WEAPONS.sidearm];return (!p||p.mag+p.res===0)&&(!s||s.mag+s.res===0);}
function botCombatTick(e,target,face,d){
  if(!target||target.dead||(e.smartRetreat&&d>8))return;
  if(d>=BOT_WEAPONS.grenadeMinDistance&&d<=BOT_WEAPONS.grenadeMaxDistance&&
     tt>=e.grenadeAt&&e.ammo&&e.ammo[5]&&e.ammo[5].mag>0&&
     Math.random()<BOT_WEAPONS.grenadeChance&&botSmartGrenadeSafe(e,target)&&clearTo(e.x,e.z,target.x,target.z,0)){
    if(botThrowGrenade(e,face))return;
  }
  botAttack(e,target,face,d);
}
// Unified bullet impact resolution for bot and human targets.
// The armor/headshot rules are identical, independent of who fired.
function projectileHitCharacter(b,target,head){
  if(typeof botQaEnabled!=='undefined'&&botQaEnabled)botQaHit(b);
  var damage=b.dmg*(b.fo?fall(b,b.m.position):1),source=b.by;
  if(head){
    if(target.helm){
      if(target===pl)popPl();else popHelm(target,b.vx,b.vz);
    }else damage=defenseHeadshotDamage(damage);
  }
  curK=source;killW=b.wid>=0?b.wid:1;hsF=!!head;
  if(target===pl)hurt(damage,b.sx,b.sz,head?'head':'bullet-body');
  else dmgE(target,damage,b.vx,b.vz,0,head?'head':'bullet-body');
  hsF=false;
}
// Global movement rules: speed rating is maximum sprint as a percentage of baseline.
// 100 rating = 100% of baseSpeed when sprinting. Walking is 15% slower
// relative to the sprint speed, so sprint is exactly 15% faster than walk.
// These are project mechanics (not a reverse-engineered Point Blank formula).
var MOVEMENT_RULES=Object.freeze({
  baseSpeed:6.5,
  sprintBonus:.15,
  adsSlowdown:.38
});
// sprintBlend/adsBlend are interpolated 0..1 by the existing input system.
// The heavy-weapon wtT animation is visual only and does not alter speed.
function weaponMovementSpeed(weaponId,sprintBlend,adsBlend){
  var r=MOVEMENT_RULES;
  var speedRatio=WP[weaponId].moveMult;
  var walk=r.baseSpeed*speedRatio/(1+r.sprintBonus);
  return walk*(1+r.sprintBonus*sprintBlend)*(1-r.adsSlowdown*adsBlend);
}
// BOLT_T = AWP bolt-action cycle length in seconds (must stay <= the AWP fire cooldown so the next shot is possible when it ends).
// MZ = per-weapon muzzle z offset in viewmodel space (where bullets and muzzle flash start). kick = recoil offset. flashT = muzzle flash time left.
var BOLT_T=1.1,MZ=[-0.7,-1,-1.15,-1.2,-0.9,-0.3,-0.9,-0.9,-1.62,-1.3,-1.04,-1,-1.38,-1.51,-1.02,-1.63,-1.49,-2.43,-1.54],kick=0,flashT=0;
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
// Character impact blood: small non-additive world-space droplets, never ammo or damage.
// Share the existing particle update/reset path and cap live drops to protect frame time.
var BLOOD_FX=Object.freeze({max:96,body:9,head:14}),bloodActive=0,
 bloodM=new T.MeshBasicMaterial({color:0xa31124,transparent:true,opacity:.95,depthWrite:false});
function bloodHit(x,y,z,dx,dz,head){
 if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))return;
 var length=Math.hypot(dx||0,dz||0)||1,n=Math.min(head?BLOOD_FX.head:BLOOD_FX.body,BLOOD_FX.max-bloodActive);
 for(var i=0;i<n;i++){
  var a=Math.random()*Math.PI*2,speed=1.2+Math.random()*2.6,
   m=new T.Mesh(spG,bloodM),forward=1.5+Math.random()*1.8;
  m.position.set(x+(Math.random()-.5)*.12,y+(Math.random()-.5)*.16,z+(Math.random()-.5)*.12);
  S.add(m);
  sk.push({m:m,vx:(dx||0)/length*forward+Math.cos(a)*speed*.6,
   vy:.7+Math.random()*2.8,vz:(dz||0)/length*forward+Math.sin(a)*speed*.6,
   t:0,l:.28+Math.random()*.23,sz:.045+Math.random()*(head?.085:.055),blood:true});
  bloodActive++;
 }
}
// reset(): clears the whole world state (bullets, bots, particles, decals) and re-creates the player object `pl` for a fresh match.
function reset(){
  [].concat(en||[],bl||[],cr||[],fx||[],sk||[],dead||[],grs||[],dg||[],chutes||[]).forEach(function(o){S.remove(o.g||o.m);});document.getElementById("kn").innerHTML="";DC.forEach(function(m){S.remove(m);});DC=[];CH.forEach(function(c){S.remove(c.m);});CH=[];cs.k=cs.s=cs.kv=cs.y=cs.yv=cs.r=cs.rv=0;clrSm();clrFD();mzf.forEach(function(q){S.remove(q.m);});mzf=[];
  if(typeof botIntelReset==='function')botIntelReset();bloodPoolClear();bloodActive=0;pl={helm:true,vest:DEFENSE_RULES.vestMax,dead:false,dt:0,rt:0,life:0,x:0,z:10,hp:DEFENSE_RULES.maxHp,w:1,mag:30,res:90,rl:0,pump:0,pumpEjected:false,cd:0,face:Math.PI,pitch:0,y:0,vy:0,slot:0,prim:1,sw:0,stab:0,sth:false,thr:0,pend:false,ghide:0,ammo:(function(){var o={};WP.forEach(function(w,i){o[i]={mag:w.mag,res:w.res};});return o;})()};en=[];bl=[];cr=[];fx=[];sk=[];dead=[];dg=[];grs=[];chutes=[];resetKillStreak();shakeT=0;score=0;spawnT=1;crateT=.5;adsT=sprT=0;resetPm();hlms.forEach(function(h){S.remove(h.m);});hlms=[];setHm();document.body.classList.remove("dead");
}
// toast(): shows a short message in the middle of the screen (toastT = time left).
function toast(t){var e=document.getElementById("toast");e.textContent=t;e.style.opacity=1;toastT=1.4;}
// fire(o, face, w, own, adv): shoots weapon table entry `w` from shooter `o` (player `pl` or a bot) facing `face`.
//  own = "p" (player) or "e" (enemy bot). adv = extra time already elapsed (lets high fire-rate weapons catch up within a frame).
//  Player bullets start at the visible muzzle (hold.position + MZ) and are aimed at the crosshair distance D.
//  Dual Kriss: shotSide flips each shot (0 = right gun, 1 = left gun at x-0.52) and the bullet spawns from that gun.
//  Tracers are only visible for every 3rd bullet of rapid-fire weapons (performance); collision still happens for all bullets.
function fire(o,face,w,own,adv){
  if(typeof botSoundEmit==='function')botSoundEmit(o,'gunshot');
  var D=w.snp?90:w.dual?45:20,
      patternedShotgun=w.pel>1&&w.stats&&w.stats.kind==="shotgun";
  for(var i=0;i<w.pel;i++){
    // Fixed shotgun pattern on both axes; other weapons keep their original RNG.
    var pelletOffset=patternedShotgun?shotgunPelletSpread(i,w.pel):null,
        spreadScale=own==="p"?(w.snp?1-adsT:1-.65*adsT):1,
        yawOffset=patternedShotgun?pelletOffset[0]:(Math.random()-.5)*2,
        a=face+yawOffset*w.spr*spreadScale,g=tracer(own,w.rk);
    var mx0,my0,mz0;if(own==="p"){if(w.dual)shotSide=shotSide?0:1;var lx=hold.position.x-(w.dual&&shotSide?.52:0),dd=-(hold.position.z+MZ[pl.w]);mx0=o.x+Math.sin(face)*dd-Math.cos(face)*lx;mz0=o.z+Math.cos(face)*dd+Math.sin(face)*lx;my0=1.5+(o.y||0)+hold.position.y+.02;a+=Math.atan(lx/D);}else{var ey=face;mx0=o.x+Math.sin(ey)*1.1+Math.cos(ey)*.05;mz0=o.z+Math.cos(ey)*1.1-Math.sin(ey)*.05;my0=1.07+(o.y||0)-.3*(o.crA||0);}
    var vy0=own==="p"?w.spd*(1.5+(o.y||0)+D*Math.tan(pl.pitch)-my0)/D:
      (Number.isFinite(o.aimShotPitch)?w.spd*Math.tan(o.aimShotPitch):0);
    // Add elevation only to shotgun pellets, on top of the existing
    // player muzzle-to-crosshair pitch or bot's original flat trajectory.
    if(patternedShotgun)vy0+=w.spd*Math.tan(pelletOffset[1]*w.spr*spreadScale);
    o.tc=(o.tc||0)+1;g.visible=!!(w.rk||w.pel>1||w.snp||o.tc%3===1);g.rotation.order="YXZ";g.rotation.set(-Math.atan2(vy0,w.spd||1),a,0);if(Math.abs(mx0)>=A||Math.abs(mz0)>=A||sweepObs(o.x,my0,o.z,mx0,my0,mz0)||sweepLT(o.x,my0,o.z,mx0,my0,mz0)||obsAt(mx0,mz0,my0)){mx0=o.x;mz0=o.z;}
    g.position.set(mx0,my0,mz0);S.add(g);
    var ad=adv||0;
    bl.push({m:g,vx:Math.sin(a)*w.spd,vy:vy0,vz:Math.cos(a)*w.spd,life:w.life,ad:ad,dmg:w.dmg,own:own,tm:o.tm,by:o,rk:w.rk,sx:o.x,sz:o.z,wid:WP.indexOf(w),fo:w.rangeModifier?[w.rangeModifier,w.rangeUnit]:null});if(typeof botQaEnabled!=='undefined'&&botQaEnabled)botQaShot(o,w,own,bl[bl.length-1]);if(own==="e"&&i===0)enemyShotFx(o,mx0,my0,mz0);if(w.rk&&own==="p")smoke(mx0,my0,mz0,6,1.4,.3,1.3,.25,0);}
}
// boom(): explosion (rocket or grenade) at (x,z): splash damage with line-of-sight check, scorch decal, particles, camera shake. lab = kill-feed label.
function boom(x,z,dmg,lab,by,shooter){var attacker=shooter||pl;curK=attacker;boomLab=lab||"RPG";killW=boomLab==="GRENADE"?5:3;if((by===undefined||by<1.1)&&Math.abs(x)<A&&Math.abs(z)<A)gDecal(TXS,x,z,3.2+Math.random()*.6);
  var m=new T.Mesh(new T.SphereGeometry(1,14,14),new T.MeshBasicMaterial({color:0xffa94d,transparent:true,opacity:.7}));
  m.position.set(x,Math.max(.3,Math.min(1.5,by||1)),z);S.add(m);fx.push({m:m,t:0});spark(x,1,z,0xffa94d,26,9,.28);spark(x,1,z,0xfff3bf,10,5,.2);var sy=Math.max(.3,Math.min(1.5,by||1));smoke(x,sy,z,8,3.2,1,2.4,1.2,1);smoke(x,.35,z,10,4.5,.9,2.2,.25,0);smoke(x,sy+.4,z,5,1.2,1.2,3,1.6,1);
  boomN=0;inBoom=true;
  en.slice().forEach(function(e){if(e.tm===attacker.tm||e.dead)return;var dd=Math.hypot(e.x-x,e.z-z);if(dd<4.2&&clearTo(x,z,e.x,e.z,.45)){var k=dd||1;dmgE(e,dmg,(e.x-x)/k,(e.z-z)/k,1,"explosive");}});
  if(attacker!==pl&&!attacker.dead){var selfDistance=Math.hypot(attacker.x-x,attacker.z-z);if(selfDistance<4.2&&clearTo(x,z,attacker.x,attacker.z,.45))dmgE(attacker,Math.ceil(dmg*(1-selfDistance/4.2*.8)),0,0,1,"explosive");}
  inBoom=false;var pd=Math.hypot(pl.x-x,pl.z-z);if((pl.tm!==attacker.tm||attacker===pl)&&pd<4.2&&clearTo(x,z,pl.x,pl.z,.45))hurt(Math.ceil(dmg*(1-pd/4.2*.8)),x,z,"explosive");shakeT=Math.max(shakeT,.35);if(boomN>0)killNotify(boomN>2);
}
// Transient, animated blood pools on the ground under fallen characters.
// Uses shared procedural geometry, capped and recycled mesh groups: no permanent decals.
var BLOOD_POOL_RULES=Object.freeze({max:24,playerLifetime:4.6,playerFadeStart:3.3,corpseFadeStart:1.5,corpseFadeTime:.6}),
 bloodPoolLive=[],bloodPoolFree=[];
function bloodPoolShape(points){
 var shape=new T.Shape();
 for(var i=0;i<points.length;i++){
  var a=i*Math.PI*2/points.length,x=Math.cos(a)*points[i],y=Math.sin(a)*points[i];
  if(!i)shape.moveTo(x,y);else shape.lineTo(x,y);
 }
 shape.closePath();return new T.ShapeGeometry(shape);
}
var bloodPoolMainGeometry=bloodPoolShape([.91,.82,1.05,.93,.79,1.08,.9,1.02,.84,.98,.87,1.06,.83,.94,1.11,.89,.99,.8]),
 bloodPoolFlowShape=new T.Shape();
bloodPoolFlowShape.moveTo(.34,-.12);bloodPoolFlowShape.lineTo(.56,-.09);
bloodPoolFlowShape.lineTo(.76,-.14);bloodPoolFlowShape.lineTo(.94,-.11);
bloodPoolFlowShape.lineTo(1.12,-.19);bloodPoolFlowShape.lineTo(1.36,-.16);
bloodPoolFlowShape.lineTo(1.49,-.12);bloodPoolFlowShape.lineTo(1.53,-.07);
bloodPoolFlowShape.lineTo(1.33,-.05);bloodPoolFlowShape.lineTo(1.18,-.08);
bloodPoolFlowShape.lineTo(.95,-.035);bloodPoolFlowShape.lineTo(.76,.005);
bloodPoolFlowShape.lineTo(.5,-.01);bloodPoolFlowShape.closePath();
var bloodPoolFlowGeometry=new T.ShapeGeometry(bloodPoolFlowShape);
function bloodPoolMake(){
 var baseMat=new T.MeshBasicMaterial({color:0x75121c,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}),
  flowMat=new T.MeshBasicMaterial({color:0x9a1c26,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}),
  group=new T.Group(),base=new T.Mesh(bloodPoolMainGeometry,baseMat),flows=[];
 base.renderOrder=2;group.add(base);
 for(var i=0;i<3;i++){
  var m=new T.Mesh(bloodPoolFlowGeometry,flowMat);
  m.rotation.z=i*Math.PI*2/3+(i===1?.34:-.19);
  m.renderOrder=3;group.add(m);flows.push(m);
 }
 group.rotation.x=-Math.PI/2;group.visible=false;
 return{g:group,base:base,flows:flows,baseMat:baseMat,flowMat:flowMat,age:0,corpse:null};
}
function bloodPoolSpawn(x,y,z,corpse){
 if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z)||bloodPoolLive.length>=BLOOD_POOL_RULES.max)return null;
 var p=bloodPoolFree.pop()||bloodPoolMake();
 p.age=0;p.corpse=corpse||null;p.x=x;p.y=y;p.z=z;
 p.g.position.set(x,(corpse?y:gh(x,z,y))+.035,z);
 p.g.rotation.z=Math.random()*Math.PI*2;
 p.g.visible=false;p.baseMat.opacity=0;p.flowMat.opacity=0;
 bloodPoolLive.push(p);S.add(p.g);return p;
}
function bloodPoolRemove(p){
 if(!p)return;
 var i=bloodPoolLive.indexOf(p);if(i<0)return;
 bloodPoolLive.splice(i,1);S.remove(p.g);p.g.visible=false;
 p.corpse=null;p.baseMat.opacity=0;p.flowMat.opacity=0;
 bloodPoolFree.push(p);
}
function bloodPoolClear(){
 while(bloodPoolLive.length)bloodPoolRemove(bloodPoolLive[bloodPoolLive.length-1]);
}
function bloodPoolUpdate(dt){
 for(var i=bloodPoolLive.length-1;i>=0;i--){
  var p=bloodPoolLive[i],c=p.corpse,fade=1;
  if(c){
   p.g.position.set(c.x,(c.by===undefined?p.y:c.by)+.035,c.z);
   if(!c.land){p.g.visible=false;continue;}
   fade=Math.max(0,Math.min(1,1-Math.max(0,(c.w||0)-BLOOD_POOL_RULES.corpseFadeStart)/BLOOD_POOL_RULES.corpseFadeTime));
  }else{
   fade=Math.max(0,Math.min(1,(BLOOD_POOL_RULES.playerLifetime-p.age)/(BLOOD_POOL_RULES.playerLifetime-BLOOD_POOL_RULES.playerFadeStart)));
  }
  p.age+=dt;
  if(!c&&p.age>=BLOOD_POOL_RULES.playerLifetime){bloodPoolRemove(p);continue;}
  var grow=Math.min(1,p.age/1.4),smooth=grow*grow*(3-2*grow),emerge=Math.min(1,p.age/.3),a=fade*emerge;
  p.g.visible=a>.005;
  p.base.scale.set(.12+1.0*smooth,.09+.78*smooth,1);
  for(var j=0;j<p.flows.length;j++){
   var extra=Math.max(0,Math.min(1,(p.age-.2-j*.16)/1.15)),g=extra*extra*(3-2*extra);
   p.flows[j].scale.set(.05+(j===0?1.08:.78)*g,.18+.75*g,1);
  }
  p.baseMat.opacity=.74*a;p.flowMat.opacity=.64*a;
 }
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
// side = +1 for right and -1 for dual left. AWP's special bolt ejection is unchanged.
// Weapon IDs are NOT casing types. Reuse the three existing casing meshes by class.
function weaponCasingType(w){
  var kind=WP[w]&&WP[w].stats.kind;
  if(kind==="pistol"||kind==="smg"||kind==="dual")return 0;
  if(kind==="rifle"||kind==="sniper")return 1;
  if(kind==="shotgun")return 2;
  return -1;
}
// ejectShell(w, side): throw the matching casing from any supported weapon ID.
function ejectShell(w,side){var kind=WP[w]&&WP[w].stats.kind,sm=kind==="smg"||kind==="dual",cw=weaponCasingType(w);if(cw<0)return;side=side||1;
  var v=new T.Vector3(CSP[cw][0],CSP[cw][1],CSP[cw][2]);if(sm){v.x=side<0?-.52-CSP[0][0]:CSP[0][0];}if(w===8)v.set(.09,.06,-.08);hold.localToWorld(v);
  var k=Math.tan(35*Math.PI/180)/Math.tan(C.fov*Math.PI/360);v.x*=k;v.y*=k;C.localToWorld(v);
  var d=new T.Vector3((2.5+Math.random()*.4)*side,1.1+Math.random()*.25,.02+Math.random()*.06).applyQuaternion(C.quaternion);
  var m=mkCasing(cw);m.position.copy(v);m.rotation.set(0,0,Math.random()*6);S.add(m);
  addDrop(m,d.x,d.y,d.z,CSR[cw]*.5,false,Math.PI/2);
  var q=dg[dg.length-1];q.sp=8+Math.random()*3;q.life=1;q.cs=1;
  m.traverse(function(o){o.castShadow=false;});
  var n=0;for(var i=dg.length-1;i>=0;i--)if(dg[i].cs&&++n>20){S.remove(dg[i].m);dg.splice(i,1);}}
// GSC = original dropped-gun scales; GH = rest heights. New weapons reuse the
// earliest legacy entry in their weapon class instead of indexing beyond these arrays.
var GSC=[1.5,1.2,1.2,1,2,2,1.2,1,1.2,1.2,1.2,1.18,1.23],GH=[.07,.09,.09,.17,.03,.1,.09,.09,.09,.09,.08,.08,.09];
function dropVisualIndex(w){
  if(GSC[w]!==undefined&&GH[w]!==undefined)return w;
  var kind=WP[w]&&WP[w].stats.kind;
  for(var i=0;i<GSC.length;i++)if(WP[i]&&WP[i].stats.kind===kind)return i;
  return 0;
}
// dropPlayerGun(): when the player dies, throws the current weapon model onto the ground.
function dropPlayerGun(){var w=pl.w,visual=dropVisualIndex(w),g=mkGun(w),f=pl.face,s=Math.sin(f),c=Math.cos(f);
  g.scale.setScalar(GSC[visual]);g.rotation.order="YXZ";g.rotation.y=f+Math.PI;
  g.position.set(pl.x+.55*c+.4*s,1.05,pl.z-.55*s+.4*c);S.add(g);
  addDrop(g,s*1.8+c*.9,2.4,c*1.8-s*.9,GH[visual],false,(w===4||w===5)?0:(w===3?.6:Math.PI/2));}
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
var GS=[{f:1800,v:.22,d:.09,t:180},{f:1400,v:.2,d:.1,t:140},{f:900,v:.45,d:.22,t:100},{f:500,v:.5,d:.4,t:70},{f:700,v:.8,d:.6,t:55},{f:720,v:.15,d:.073,t:92,suppressed:true}],SFXI=[0,1,2,3,3,3,1,1,4,1,1,1,1,5,1,1,1,4,2];
// gunSfx(): plays a synthesized gun/explosion sound from preset k at volume vol (does nothing if sound is off or too quiet).
function gunSfx(k,vol){if(!SND||vol<=.02)return;try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();if(AC.state==="suspended")AC.resume();
  if(!nbuf){nbuf=AC.createBuffer(1,Math.floor(AC.sampleRate*.25),AC.sampleRate);var dd=nbuf.getChannelData(0);for(var i=0;i<dd.length;i++)dd[i]=Math.random()*2-1;}
  var t=AC.currentTime,sr=AC.createBufferSource(),fl=AC.createBiquadFilter(),g=AC.createGain(),o=AC.createOscillator(),g2=AC.createGain(),v=vol*k.v;
  sr.buffer=nbuf;fl.type=k.suppressed?"lowpass":"bandpass";fl.frequency.value=k.f*(.9+Math.random()*.2);fl.Q.value=k.suppressed?.48:.7;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+k.d);sr.connect(fl);fl.connect(g);g.connect(AC.destination);sr.start(t);sr.stop(t+k.d+.02);
  o.type=k.suppressed?"triangle":"sine";o.frequency.setValueAtTime(k.t,t);o.frequency.exponentialRampToValueAtTime(40,t+k.d);g2.gain.setValueAtTime(v*(k.suppressed?.5:.9),t);g2.gain.exponentialRampToValueAtTime(.0001,t+k.d);o.connect(g2);g2.connect(AC.destination);o.start(t);o.stop(t+k.d+.02);}catch(e){}}
// enemyShotFx(): muzzle flash and sound for a bot shot (volume depends on distance to the player).
function enemyShotFx(o,x,y,z){var m=new T.Mesh(spG,mzfM);m.position.set(x,y,z);m.scale.setScalar(.14+Math.random()*.1);S.add(m);mzf.push({m:m,t:.05});
  if(sndN<3){sndN++;gunSfx(GS[SFXI[o.weapon]||1],.45*Math.max(0,1-Math.hypot(pl.x-o.x,pl.z-o.z)/20));}}
// gImpact(): bullet impact on the ground at point p (small decal + dust).
function gImpact(p){if(Math.abs(p.x)>A||Math.abs(p.z)>A)return;gDecal(TXH[(Math.random()*3)|0],p.x,p.z,.38*rr(.85,1.15));spark(p.x,.08,p.z,0xd9d0bb,3,1.6,.1);}
// Camera recoil per weapon id: CKV = pitch kick, CKS = shake strength, CKY = random yaw kick, CKR = random roll kick (camShot() applies them, reduced while aiming).
var CKV=WP.map(function(w){return w.stats.vRecoil===null?0:.12+.015*w.stats.vRecoil*w.recoilScale;}),
    CKY=WP.map(function(w){return w.stats.hRecoil===null?0:.005*w.stats.hRecoil*(1-w.stats.control/200)*Math.max(.45,w.recoilScale);}),
    CKR=CKY.map(function(y){return y*1.5;}),
    CKS=WP.map(function(w){return w.stats.vRecoil===null?0:Math.min(1.2,.25+.009*w.stats.vRecoil);});
// camShot(w): adds camera recoil for weapon w. Knife and grenade have none.
function camShot(w){if(w===4||w===5)return;var a=1-.45*adsT;cs.kv+=CKV[w]*a;if(cs.k>.12)cs.kv*=.3;cs.yv+=(Math.random()-.5)*CKY[w]*a;cs.rv+=(Math.random()-.5)*CKR[w]*a;cs.s=Math.max(cs.s,CKS[w]);}
// spr(): spring-damper step used for camera recoil recovery (value o[a], velocity o[b]).
function spr(o,a,b,dt){o[b]+=(-o[a]*150-o[b]*15)*dt;o[a]+=o[b]*dt;if(o[a]>.16)o[a]=.16;else if(o[a]<-.16)o[a]=-.16;}
// snz(): cheap smooth pseudo-noise in about [-1,1] for camera shake (t = time, k = channel seed).
function snz(t,k){return Math.sin(t*(31+k*7.3)+k*1.7)*.6+Math.sin(t*(53+k*3.1)+k*4.3)*.4;}
// ck = kill tracker {n kills this life, hs headshot kills this life}; death, not time, resets it. Other globals: dead = ragdoll list, shakeT = screen shake time, AC = AudioContext, grs = grenades.
var ck={n:0,hs:0},hsF=false,dead=[],inBoom=false,boomN=0,shakeT=0,AC=null,boomLab="RPG",grs=[];
function resetKillStreak(){ck.n=0;ck.hs=0;}
function registerPlayerKill(headshot){ck.n++;if(headshot)ck.hs++;}
// dmgE(): applies damage d to bot e (knock direction kx,kz). Handles invulnerability, hit flash and calls killE() at 0 HP.
function dmgE(e,d,kx,kz,ex,kind){if(e.inv>0||e.dead)return;if(isBombMode())bombInterruptPlant(e);d=defenseDamage(e,d,kind||"bullet-body");if(d>0)bloodHit(e.x,(e.y||0)+(kind==="head"?1.7:1.12),e.z,kx,kz,kind==="head");e.hp-=d;e.fl=.14;e.hs=Math.random()<.5?-1:1;e.hv=(e.hv||0)+Math.min(9,3+d*.5);var hm=Math.hypot(kx||0,kz||0);if(hm>.01){e.hdx=kx/hm;e.hdz=kz/hm;}if(e.hp<=0)killE(e,kx||0,kz||0,ex);}
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
  en.splice(en.indexOf(e),1);e.dead=true;e.st.d++;if(!isBombMode())rq.push({b:e,t:5});bombDrop(e);if(K){K.st.k++;if(!isBombMode())ts[K.tm]++;}
  if(pk){score++;if(DM_RULES.crates)mkCrate(e.x,e.z,.45+gh(e.x,e.z,0),rci());starKill();}
  detachGun(e,kx,kz,ex);e.ms.forEach(function(m){m.emissive.setHex(0);});e.arms.forEach(function(q){q.rotation.set(0,0,0);q.scale.y=1;q.userData.fa.quaternion.set(0,0,0,1);});e.g.userData.gun.position.set(0,0,0);e.body.rotation.x=0;e.body.rotation.y=0;
  var m=Math.hypot(kx,kz);if(m<.01){kx=-Math.sin(e.g.rotation.y);kz=-Math.cos(e.g.rotation.y);m=1;}kx/=m;kz/=m;
  e.g.rotation.y=Math.atan2(-kx,-kz);
  var corpse={g:e.g,body:e.body,legs:e.legs,arms:e.arms,x:e.x,z:e.z,y:e.y||0,by:e.y||0,vx:kx*(ex?7:2.6),vz:kz*(ex?7:2.6),vy:ex?8:0,t:0,T:ex?.73:.55,flip:ex?1:0,w:0,land:false};
  corpse.bloodPool=bloodPoolSpawn(e.x,e.y||0,e.z,corpse);dead.push(corpse);
  spark(e.x,1.2,e.z,0xff6b6b,8,4,.1);
  if(pk){registerPlayerKill(hsF);
  if(inBoom)boomN++;else killNotify(false);}
}
// updDead(dt): animates ragdolls/corpses and respawns bots after their timer.
function updDead(dt){
  updH(dt);
  updG(dt);updDrops(dt);updCh(dt);
  for(var di=dead.length-1;di>=0;di--){var d=dead[di];d.t+=dt;
    var p=Math.min(1,d.t/d.T),s=p*p*(3-2*p),ang=-(Math.PI/2+d.flip*Math.PI*2)*s;
    if(!d.land){
      d.by=gh(d.x,d.z,0);d.y=d.by+(d.flip?Math.max(0,d.vy*d.t-11*d.t*d.t):0);
      var sl=d.flip?1:1-p;d.x+=d.vx*dt*sl;d.z+=d.vz*dt*sl;resolve(d,.4);
      if(p>=1){d.land=true;d.y=d.by;spark(d.x,.15,d.z,0xcfcfcf,d.flip?10:5,2.2,.12);}
    }else{
      var u=d.t-d.T;ang+=Math.exp(-u*7)*Math.abs(Math.sin(u*20))*.25;d.w+=dt;
      if(d.w>1.5){d.b=(d.b||0)+dt;d.g.visible=Math.floor(d.b*14)%2===0;
        if(d.b>.6){spark(d.x,.4,d.z,0xb0b4ba,10,2.5,.18);bloodPoolRemove(d.bloodPool);S.remove(d.g);dead.splice(di,1);continue;}}
    }
    d.g.position.set(d.x,d.y,d.z);
    d.body.rotation.set(ang,0,0);d.body.position.y=.3*Math.abs(Math.sin(ang));
    d.arms[0].rotation.z=-1.1*s;d.arms[1].rotation.z=1.1*s;
    d.legs[0].rotation.z=-.3*s;d.legs[1].rotation.z=.3*s;
  }
}
// Surface-aware Web Audio tactical footsteps. No external sound files.
// Steps are driven by actual player / BOT displacement, not a repeating timer.
var FOOTSTEP_RULES=Object.freeze({radius:24,near:2.2,maxVoices:16,walkStride:2.05,sprintStride:1.78}),
 footstepBuffers=null,footstepVoices=0,footstepListenerDirection=new T.Vector3(),
 footstepTypes=["concrete","asphalt","indoor","metal","tile"];
function footstepSurface(x,y,z){
 if(isBombMode()){
  // 11-bomb-map.js sectors: SECURITY, WAREHOUSE, REACTOR, LABORATORY.
  var n=BOMB_RULES.cells,s=BOMB_RULES.cellSize,
   i=Math.max(0,Math.min(n-1,Math.round(x/s+(n-1)/2))),
   j=Math.max(0,Math.min(n-1,Math.round(z/s+(n-1)/2))),
   sector=(i<n/2?0:1)+(j<n/2?0:2);
  return ["tile","metal","concrete","indoor"][sector];
 }
 if(y>1.25)return "metal";
 if(inB(x,z))return "indoor";
 if(Math.abs(x)<4||Math.abs(z)<4)return "asphalt";
 return "concrete";
}
function footstepUnlock(){
 if(!SND)return;
 try{
  if(!AC)AC=new(window.AudioContext||window.webkitAudioContext)();
  if(AC.state==="suspended"){
   var p=AC.resume();if(p&&p.catch)p.catch(function(){});
  }
 }catch(e){} // Browser media activation policy is enforced by the platform.
}
document.addEventListener("pointerdown",footstepUnlock,{passive:true});
document.addEventListener("keydown",footstepUnlock);
function footstepGenerateBuffers(){
 if(!AC||footstepBuffers)return;
 footstepBuffers={};
 var sr=AC.sampleRate,profiles={
  concrete:{body:142,noise:.56,ring:.08,click:.46,decay:.105},
  asphalt:{body:95,noise:.72,ring:.02,click:.2,decay:.125},
  indoor:{body:155,noise:.38,ring:.24,click:.56,decay:.115},
  metal:{body:210,noise:.27,ring:.64,click:.46,decay:.165},
  tile:{body:167,noise:.36,ring:.3,click:.55,decay:.1}
 };
 footstepTypes.forEach(function(type){
  footstepBuffers[type]=[];
  for(var variant=0;variant<3;variant++){
   var p=profiles[type],length=Math.floor(.19*sr),
    buffer=AC.createBuffer(1,length,sr),data=buffer.getChannelData(0),
    seed=(type.length*104729+variant*8191+117)&0x7fffffff,prev=0,prev2=0,phase=variant*.7;
   for(var i=0;i<length;i++){
    var t=i/sr,envelope=Math.min(1,t/.004)*Math.exp(-t/p.decay),
     body=Math.sin(2*Math.PI*(p.body*(1-.23*t))*t+phase),
     ring=Math.sin(2*Math.PI*(type==="metal"?875:type==="indoor"?510:415)*t+phase);
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    var noise=seed/2147483648-1;
    prev+=(noise-prev)*.25;prev2+=(prev-prev2)*.11;
    var crack=(noise-prev)*p.click*Math.exp(-t/.031),
     scuff=(prev2*.75+prev*.25)*p.noise,
     sample=envelope*(body*.48+scuff+crack+ring*p.ring*Math.exp(-t/.12));
    data[i]=Math.max(-.94,Math.min(.94,sample*.65));
   }
   footstepBuffers[type].push(buffer);
  }
 });
}
function footstepSetPosition(node,x,y,z){
 if(node.positionX){node.positionX.value=x;node.positionY.value=y;node.positionZ.value=z;}
 else if(node.setPosition)node.setPosition(x,y,z);
}
function footstepUpdateListener(){
 if(!AC||AC.state!=="running"||!run||lob||mt.over)return;
 C.updateMatrixWorld();C.getWorldDirection(footstepListenerDirection);
 var dir=footstepListenerDirection,l=AC.listener,p=C.position;
 if(l.positionX){l.positionX.value=p.x;l.positionY.value=p.y;l.positionZ.value=p.z;}
 else if(l.setPosition)l.setPosition(p.x,p.y,p.z);
 if(l.forwardX){
  l.forwardX.value=dir.x;l.forwardY.value=dir.y;l.forwardZ.value=dir.z;
  l.upX.value=0;l.upY.value=1;l.upZ.value=0;
 }else if(l.setOrientation)l.setOrientation(dir.x,dir.y,dir.z,0,1,0);
}
function footstepPlay(actor,local,sprint){
 if(!SND||!AC||AC.state!=="running"||footstepVoices>=FOOTSTEP_RULES.maxVoices)return;
 var x=actor.x,y=actor.y||0,z=actor.z,cam=C.position,
     distance=local?0:Math.hypot(cam.x-x,cam.z-z);
 if(distance>FOOTSTEP_RULES.radius)return;
 try{
  footstepGenerateBuffers();
  var surface=footstepSurface(x,y,z),list=footstepBuffers[surface]||footstepBuffers.concrete,
   step=actor.stepIndex||0,src=AC.createBufferSource(),filter=AC.createBiquadFilter(),
   gain=AC.createGain(),panner=null,t=AC.currentTime;
  src.buffer=list[step%list.length];src.playbackRate.value=(sprint?1.07:1)*(.96+Math.random()*.07);
  filter.type="lowpass";
  // LOS muffling preserves awareness without letting walls transmit full volume.
  var blocked=!local&&typeof los==="function"&&!los(cam.x,cam.z,x,z);
  filter.frequency.value=blocked?920:surface==="metal"?4700:surface==="indoor"?3400:3000;
  var volume=(local?.18:.66)*(sprint?1.18:1)*(blocked?.52:1);
  gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(volume,t+.004);
  gain.gain.exponentialRampToValueAtTime(.0001,t+.18);
  src.connect(filter);filter.connect(gain);
  if(!local&&AC.createPanner){
   panner=AC.createPanner();panner.panningModel="HRTF";panner.distanceModel="inverse";
   panner.refDistance=FOOTSTEP_RULES.near;panner.maxDistance=FOOTSTEP_RULES.radius;
   panner.rolloffFactor=1.35;footstepSetPosition(panner,x,y+.18,z);
   gain.connect(panner);panner.connect(AC.destination);
  }else gain.connect(AC.destination);
  footstepVoices++;
  src.onended=function(){
   footstepVoices=Math.max(0,footstepVoices-1);
   src.disconnect();filter.disconnect();gain.disconnect();
   if(panner)panner.disconnect();
  };
  src.start(t);src.stop(t+.195);
 }catch(e){} // Audio failure must never interrupt movement or bot AI.
}
function footstepAdvance(actor,dist,grounded,sprint,local){
 if(!actor||actor.dead||!run||lob||mt.over||mt.cd>0||!grounded||!Number.isFinite(dist)||dist>2.6){
  if(actor)actor.stepTrail=0;
  return;
 }
 if(dist<.0005)return;
 var stride=sprint?FOOTSTEP_RULES.sprintStride:FOOTSTEP_RULES.walkStride;
 actor.stepTrail=(actor.stepTrail||0)+dist;
 if(actor.stepTrail>=stride){
  actor.stepTrail-=stride;
  actor.stepIndex=(actor.stepIndex||0)+1;
  if(typeof botSoundEmit==='function')botSoundEmit(actor,'footstep');
  footstepPlay(actor,local,sprint);
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
// killNotify(): life streak controls milestones; the latest headshot overrides its banner, not the streak. mass = several explosion kills.
function killNotify(mass){var n=ck.n;
  if(mass)showKill("MASS KILL",boomN,"mass",boomN+" DOWN WITH 1 "+boomLab);
  else if(hsF)showKill("HEADSHOT",n,"hs","LIGHTS OUT");
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
function hurt(d,sx,sz,kind){if(pl.dead||pl.inv>0)return;if(isBombMode())bombInterruptPlant(pl);d=defenseDamage(pl,d,kind||"bullet-body");if(sx!==undefined&&Math.hypot(sx-pl.x,sz-pl.z)>.6)hdHit(sx,sz);if(d>0)bloodHit(pl.x,(pl.y||0)+(kind==="head"?1.65:1.12),pl.z,(sx===undefined?0:pl.x-sx),(sz===undefined?0:pl.z-sz),kind==="head");pl.hp-=d;pm.fl=.1;cs.s=Math.max(cs.s,.55);var hs2=0;if(sx!==undefined){var ddx=sx-pl.x,ddz=sz-pl.z;hs2=Math.sign(-ddx*Math.cos(pl.face)+ddz*Math.sin(pl.face));}cs.kv+=.7;cs.yv+=hs2*1.5;cs.rv+=hs2*.5+(Math.random()-.5)*.4;document.getElementById("hit").style.opacity=1;if(pl.hp<=0){pl.hp=0;die();}}
// die(): player death: starts the 5 s respawn timer, drops the gun, updates stats and the killer credit.
function die(){pl.dead=true;resetKillStreak();pl.rsT=5;pl.st.d++;pl.kb=curK&&curK!==pl?curK.name:"";if(curK&&curK!==pl){curK.st.k++;if(!isBombMode())ts[curK.tm]++;}kFeed(curK,1,false,pl);mouse.right=false;mouse.down=false;fireHeld=false;kn.innerHTML="";pm.g.visible=true;if(pm.hg)pm.hg.visible=false;pl.bloodPool=bloodPoolSpawn(pl.x,pl.y||0,pl.z,null);dropPlayerGun();if(isBombMode()){bombDrop(pl);document.body.classList.add("bomb-spectator");}else document.body.classList.add("dead");
  try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();tn(260,40,1.2,"sawtooth",.12);tn(120,30,1.6,"sine",.3);}catch(e){}}
// mmss(): formats seconds as m:ss.
function mmss(t){t=Math.floor(t);return Math.floor(t/60)+":"+("0"+t%60).slice(-2);}
// cnt(): animated count-up of a number in an element (end-of-match results).
function cnt(el,to,fmt,dur,dl){var t0=performance.now()+dl;el.textContent=fmt(0);(function f(n){var k=Math.max(0,Math.min(1,(n-t0)/dur));el.textContent=fmt(Math.round(to*(1-Math.pow(1-k,3))));if(k<1)requestAnimationFrame(f);})(performance.now());}
// begin(tm): starts a match as team tm (0 = Police, 1 = Terrorist): hides menus, resets the world, spawns bots, starts the countdown.
function begin(tm){document.getElementById("tsel").style.display="none";lb.style.display="none";lob=false;document.body.classList.remove("lobby","over","dead");bombCleanup();reset();selectedGameMode=selM;selectedBombMapId=selM===1&&roomMatchConfig?bombMapId(roomMatchConfig.mapId):"lockdown";selectedTdmMapId=selM===0&&roomMatchConfig?tdmMapId(roomMatchConfig.mapId):"block-district";selectGameMap(isBombMode());startMatch(tm);ov.style.display="none";run=true;/* Keep cursor free for pre-round loadout selection. */}
document.getElementById("tsP").onclick=function(){begin(0);};document.getElementById("tsT").onclick=function(){begin(1);};document.getElementById("tsX").onclick=function(){document.getElementById("tsel").style.display="none";};
// endMatch(): ends the match: stops the simulation, releases the mouse, shows the results screen (stars, scores, best score).
function endMatch(){escHide();mt.over=true;mt.t=0;run=false;if(document.exitPointerLock)document.exitPointerLock();mouse.down=mouse.right=false;fireHeld=false;kn.innerHTML="";document.body.classList.remove("dead","bomb-spectator","loadout-active","loadout-cursor-hidden");document.body.classList.add("over");pl.dui=true;
  var $=function(i){return document.getElementById(i);},me=pl.tm,w=ts[me]>ts[1-me]?1:ts[me]<ts[1-me]?-1:0,st=pl.st,b=0,h2=document.querySelector("#dc h2"),ti=w>0?"VICTORY":w<0?"DEFEAT":"DRAW";
  try{b=+localStorage.getItem(isBombMode()?"bbfps_bomb":"bbfps_tdm")||0;}catch(e){}var nb=st.k>b;if(nb){b=st.k;try{localStorage.setItem(isBombMode()?"bbfps_bomb":"bbfps_tdm",b);}catch(e){}}
  $("dv").classList.add("tdm");document.querySelector(".dhd").textContent=isBombMode()?"BOMB MISSION REPORT":"BATTLE REPORT";h2.setAttribute("data-t",ti);h2.firstChild.textContent=ti;
  document.querySelector(".dtag").lastChild.nodeValue="MATCH OVER // "+(w>0?"YOUR TEAM WINS":w<0?"ENEMY TEAM WINS":"NO WINNER");
  $("dsub").textContent="POLICE "+ts[0]+"  \u2014  "+ts[1]+" TERRORIST"+(isBombMode()?" | BOMB MISSION":"");
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
function reload(){var w=WP[pl.w];if(!run||pl.dead||pl.rl>0||(w.pump&&pl.pump>0)||pl.mag>=w.mag||w.melee)return;if(pl.w===7){if(pl.mag<=0&&toastT<=0)toast("DUAL EMPTY - PRESS V");return;}if(pl.res<=0){if(pl.mag<=0&&toastT<=0)toast("NO AMMO");return;}pl.rl=w.rt;}
// pick(ci): player collects crate type ci: medkit (3) heals, otherwise resupplies or swaps the primary weapon.
function pick(ci){
  if(ci===3){pl.hp=Math.min(100,pl.hp+40);toast("Medkit +40 HP");return;}
  var w=ci+1;
  if(pl.prim>=6){var pw=pl.prim,aa=amo(pw),ad=WP[pw].snp?10:pw===7?75:60;if(pw===7)aa.mag=Math.min(WP[7].mag,aa.mag+ad);else aa.res+=ad;toast("Resupplied: "+WP[pw].n+" +"+ad);return;}
  if(pl.prim===w){var a=amo(w);a.res+=WP[w].res;toast("Resupplied: "+WP[w].n+" +"+WP[w].res);}
  else{pl.prim=w;pl.ammo[w]={mag:WP[w].mag,res:WP[w].res};toast("Picked up "+WP[w].n+"!");swSlot(0);}
}
// ---- WEAPON SLOTS ----
// Slot 0 = primary (pl.prim), 1 = pistol, 2 = knife, 3 = grenade.
// Point Blank-style weapon slots: 1 primary, 2 pistol, 3 knife, 4 grenade
// amo(id): returns the object holding {mag,res} for weapon id (the live `pl` for the current weapon, otherwise pl.ammo[id]).
function amo(id){return id===pl.w?pl:pl.ammo[id];}
// swW(i): switches to weapon i, saving the current weapon's ammo into pl.ammo and loading the new one. Cancels reload.
function swW(i){pl.ammo[pl.w]={mag:pl.mag,res:pl.res};pl.w=i;var a=pl.ammo[i];pl.mag=a.mag;pl.res=a.res;pl.rl=0;pl.pump=0;pl.pumpEjected=false;pl.sw=.28;pl.thr=0;pl.pend=false;pl.sth=false;pl.stab=0;pl.ghide=0;pl.cd=Math.max(pl.cd,.2);}
// swSlot(s): switches to slot s (0 primary, 1 pistol, 2 knife, 3 grenade) with the switch animation.
function swSlot(s){var id=[pl.prim,inventoryEquipped("secondary"),inventoryEquipped("mele"),inventoryEquipped("explosive")][s],a=amo(id);
  if(id===pl.w){pl.slot=s;return;}
  if((id===5&&a.mag+a.res<=0)||(id===pl.prim&&a.mag+a.res<=0)){toast(id===5?"Out of grenades":"Out of ammo");return;}
  pl.slot=s;swW(id);if(id===5&&pl.mag===0&&pl.res>0)reload();}
// doStab(): knife attack: damages enemies in a short cone in front of the player.
function doStab(){killW=4;curK=pl;var w=WP[4],fx=Math.sin(pl.face),fz=Math.cos(pl.face),hit=0;
  en.slice().forEach(function(e){if(e.tm===pl.tm)return;var dx=e.x-pl.x,dz=e.z-pl.z,d=Math.hypot(dx,dz)||1;if(d<WP[4].range+.8&&(dx*fx+dz*fz)/d>.3&&clearTo(pl.x,pl.z,e.x,e.z,0)){dmgE(e,w.dmg,fx,fz,0,"melee");hit++;}});
  spark(pl.x+fx*1.3,1.2+pl.y,pl.z+fz*1.3,hit?0xff6b6b:0xffffff,hit?8:4,3,.07);
  var sh=document.getElementById("slh");sh.className="";void sh.offsetWidth;sh.className="go";}
// mkGren(): builds a grenade mesh.
function mkGren(){var g=new T.Group(),m=new T.Mesh(new T.SphereGeometry(.17,10,8),new T.MeshLambertMaterial({color:0x4a5a2a}));m.castShadow=true;g.add(m,bx(.06,.08,.06,0x888e98,0,.18,0),bx(.05,.03,.16,0xaab0b9,0,.23,.04));S.add(g);return g;}
// throwG(): spawns a thrown grenade using the player's facing and pitch.
function throwG(){pl.mag--;pl.ghide=.65;if(pl.mag===0&&pl.res>0)reload();var f=pl.face,pt=pl.pitch,sp=16+pt*3;
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
    if(g.t<=0){S.remove(g.m);grs.splice(gi,1);if(g.by)boom(g.x,g.z,WP[5].dmg,"GRENADE",undefined,g.by);else boom(g.x,g.z,WP[5].dmg,"GRENADE");}
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
 8:'<svg viewBox="0 0 48 20"><rect x="1" y="8" width="10" height="5" rx="1.2"/><rect x="11" y="8.5" width="16" height="3.6"/><rect x="27" y="9.6" width="19" height="1.4"/><rect x="45" y="8.8" width="2.6" height="3"/><rect x="16" y="4.4" width="12" height="3" rx="1.4"/><rect x="22" y="5" width="3" height="4"/><polygon points="12,12 17,12 16,18 11,18"/><rect x="21" y="12" width="4" height="4"/></svg>',
 9:'<svg viewBox="0 0 48 20"><rect x="13" y="7" width="17" height="5"/><rect x="28" y="8" width="11" height="3"/><rect x="39" y="9" width="8" height="1.5"/><path d="M1 6h8v3H5v3h9v-3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="5" width="13" height="2"/><rect x="22" y="2" width="4" height="3"/><polygon points="19,12 23,12 26,19 21,19"/><polygon points="14,12 17,12 16,18 12,18"/><rect x="11" y="6" width="2" height="6"/></svg>',
 10:'<svg viewBox="0 0 48 20"><path d="M2 9h6v4H4v-2H2z"/><rect x="8" y="6" width="24" height="7" rx="1"/><rect x="32" y="8" width="11" height="3"/><rect x="43" y="8.5" width="4" height="1.5"/><rect x="14" y="4" width="15" height="2"/><rect x="20" y="2" width="5" height="2"/><polygon points="23,13 27,13 29,19 25,19"/><rect x="11" y="13" width="4" height="6"/></svg>',
 11:'<svg viewBox="0 0 48 20"><path d="M6 6h36l4 5-8 3H8L2 12z"/><rect x="10" y="3" width="31" height="3"/><rect x="17" y="1" width="8" height="2"/><path d="M13 11h8l-4 8h-6l-3-4z" fill="none" stroke="currentColor" stroke-width="2"/><rect x="23" y="11" width="12" height="4"/></svg>',
 12:'<svg viewBox="0 0 48 20"><path d="M2 7h7v3H5v3H2z"/><rect x="9" y="6" width="18" height="7"/><rect x="27" y="7" width="14" height="5"/><rect x="41" y="9" width="6" height="2"/><rect x="12" y="4" width="26" height="2"/><rect x="20" y="1" width="5" height="3"/><path d="M19 12h5l3 7h-5z"/><rect x="30" y="12" width="3" height="7"/></svg>',
 13:'<svg viewBox="0 0 48 20"><rect x="1" y="8" width="17" height="4" rx="2"/><rect x="17" y="7" width="18" height="7" rx="1"/><rect x="34" y="8" width="9" height="5" rx="1"/><polygon points="24,13 29,13 30,20 25,20"/><polygon points="33,13 38,13 40,20 35,20"/><rect x="10" y="6" width="26" height="2"/><rect x="21" y="4" width="5" height="2"/></svg>',
 14:'<svg viewBox="0 0 48 20"><rect x="2" y="7" width="9" height="4" rx="1"/><rect x="10" y="6" width="24" height="8" rx="1"/><rect x="34" y="8" width="8" height="4" rx="1"/><path d="M42 8 L47 5 L47 17 L42 13 Z"/><rect x="12" y="4" width="24" height="2"/><polygon points="19,13 24,13 26,20 20,20"/><polygon points="11,12 15,12 13,18 10,18"/><rect x="22" y="2" width="3" height="2"/></svg>',
 15:'<svg viewBox="0 0 48 20"><rect x="1" y="9" width="7" height="4"/><rect x="7" y="7" width="19" height="6"/><rect x="26" y="7" width="13" height="7"/><rect x="39" y="8" width="7" height="3"/><rect x="7" y="5" width="32" height="2"/><rect x="20" y="2" width="6" height="3"/><rect x="21" y="0" width="1" height="3"/><rect x="25" y="0" width="1" height="3"/><polygon points="19,13 23,13 25,20 20,20"/><polygon points="31,13 34,13 34,19 31,19"/><path d="M42 7v9h-4V7" /></svg>',
 16:'<svg viewBox="0 0 48 20"><path d="M1 10h7l3-4h19l5 3h10v5H34l-4-1H10l-2-2H1z"/><rect x="12" y="4" width="20" height="2"/><path d="M17 4l3-3h10l3 3" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="24" y="0" width="5" height="3" rx="1.5"/><polygon points="19,13 24,13 23,20 17,20"/><polygon points="31,13 35,13 38,20 33,20"/><path d="M41 13v4h4v-4"/></svg>',
 17:'<svg viewBox="0 0 48 20"><rect x="1" y="9" width="10" height="3"/><rect x="10" y="7" width="23" height="6" rx="1"/><path d="M33 9h9l5 2v6h-4v-4H33z"/><rect x="12" y="5" width="24" height="2"/><rect x="20" y="3" width="13" height="2"/><rect x="23" y="1" width="9" height="3" rx="2"/><polygon points="19,13 23,13 22,19 18,19"/><polygon points="27,13 30,13 32,18 29,19"/><path d="M42 13v5M38 14v4" stroke="currentColor" fill="none"/></svg>',
 18:'<svg viewBox="0 0 48 20"><path d="M1 8h9v3H1z"/><rect x="10" y="6" width="23" height="8" rx="1"/><path d="M33 8h9l5 3v5h-4v-3H33z"/><rect x="14" y="4" width="18" height="2"/><rect x="20" y="2" width="7" height="3"/><path d="M21 14h5l2 6h-5z"/><path d="M30 14h4l3 5h-4z"/></svg>'};
// Weapon-slot HUD elements and their cached keys (so the DOM is only touched when something changed).
var slEls=[],slKey=[];
(function(){var el=document.getElementById("wsb");for(var s=0;s<4;s++){(function(s){var d=document.createElement("div");d.className="sl";d.innerHTML='<b class="k">'+(s+1)+'</b><span class="ic"></span><span class="nm"></span><span class="sa"></span>';d.addEventListener("pointerdown",function(e){e.stopPropagation();e.preventDefault();if(run&&!pl.dead)swSlot(s);});el.appendChild(d);slEls.push(d);})(s);}})();
// slotUI(w): updates the bottom weapon-slot bar.
function slotUI(w){
  var ids=[pl.prim,inventoryEquipped("secondary"),inventoryEquipped("mele"),inventoryEquipped("explosive")],i,id,a,el,txt,em,on,key;
  for(i=0;i<4;i++){id=ids[i];a=amo(id);
    txt=id===4?"\u221e":a.mag+"/"+(a.res===Infinity?"\u221e":a.res);
    em=id===4?false:a.mag+a.res<=0;on=id===pl.w;
    key=id+"|"+on+"|"+em+"|"+txt;
    if(slKey[i]!==key){slKey[i]=key;el=slEls[i];el.className="sl"+(on?" on":"")+(em?" em":"");
      el.children[1].innerHTML=SV[id];el.children[2].textContent=i===0?WP[id].n:["","Handgun","Knife","Grenade"][i];el.children[3].textContent=txt;}}
  if(w.melee){E.mg.textContent="\u221e";E.rs.textContent="";}
}
// ===== PRIMARY WEAPON SELECT / KRISS <-> DUAL / AWP SCOPE =====
// Weapon behavior stays here. UI presentation and cursor lifecycle live in 77-loadout-picker.js.
var WSEL=[],WDESC={1:"Balanced · Mid range",2:"Close range · High burst",3:"Explosive splash",
 6:"Fast fire rate",8:"High damage · Long range",9:"Standard-issue rifle",
 10:"Compact · Rapid fire",11:"High capacity · Fast SMG",12:"Tactical rifle · Optic",13:"Suppressed · Iron sights",14:"UMP45 · Iron sights",15:"HK417 · Red-dot optic",16:"XM8 · Round red-dot sight",17:"XM2010 · Bolt-action sniper",18:"Saiga-12 · Box red-dot sight"};
function canAds(w){if(w===7)return false;return w<4||w===6||(WP[w]&&WP[w].snp)||w===WEAPON_STARTER_ID||w===13||w===14||!!tacticalOpticConfig(w);}
function fall(b,p){var f=b.fo;if(!f)return 1;var d=Math.max(0,Math.hypot(p.x-b.sx,p.z-b.sz));return Math.pow(f[0],d/f[1]);}
var scopeEl=document.getElementById("scope"),abEl=document.getElementById("ab");
function refreshWeaponSelection(){
 var owned=inventoryOwned("main");
 WSEL=[WEAPON_STARTER_ID].concat(owned.filter(function(id){return id!==WEAPON_STARTER_ID;}));
 loadoutRender();
}
function chooseWeapon(id){
 if(!run||pl.dead||!(mt.cd>0||wsLiveTime>0)||mt.over||wsConfirmed||WSEL.indexOf(id)<0||inventoryOwned("main").indexOf(id)<0)return;
 favPrim=id;pl.prim=id;scopeOn=false;
 if(pl.w!==id){pl.ammo[id]={mag:WP[id].mag,res:WP[id].res};swW(id);}
 else{pl.mag=WP[id].mag;pl.res=WP[id].res;}
 loadoutRefreshSelected();
}
function wselUpd(){loadoutUpdate();}
// V key: Kriss <-> Dual Kriss. Each mode keeps its OWN magazine and reserve ammo.
// V: Kriss <-> Dual Kriss. Each mode keeps its own magazine + reserve
function toggleDual(){if(!run||pl.dead||mt.over||(pl.w!==6&&pl.w!==7))return;
  var to=pl.w===6?7:6;pl.prim=to;favPrim=to;scopeOn=false;swW(to);toast(to===7?"DUAL KRISS":"KRISS");}
// altBtn(): the touch "alt" button: toggles the AWP scope, or Kriss <-> Dual for the Kriss.
function altBtn(){if(!run||pl.dead||mt.over)return;if(WP[pl.w].snp){if(mt.cd<=0&&pl.rl<=0&&!(pl.bolt>0))scopeOn=!scopeOn;}else toggleDual();}
abEl.addEventListener("pointerdown",function(e){e.stopPropagation();e.preventDefault();altBtn();});
// abUpd(): shows/updates the touch alt button text (SCOPE/UNSCOPE, DUAL/SINGLE).
function abUpd(){var show=touch&&run&&!pl.dead&&!lob&&!mt.over&&(pl.w===6||pl.w===7||WP[pl.w].snp);abEl.style.display=show?"block":"none";if(show){var t=WP[pl.w].snp?(scopeOn?"UNSCOPE":"SCOPE"):(pl.w===6?"DUAL":"SINGLE");if(abEl.textContent!==t)abEl.textContent=t;}}
// ADS visuals: unscoped K2/Shotgun use a clear crosshair; RPG gets a non-magnified launcher reticle.
 // Single Kriss/MP7/P90/AK SOPMOD retain their own reflex sights; Dual Kriss is hip-fire only.
// Different from AWP scope: no opaque full-screen sniper mask and RMB is held.
var TACTICAL_OPTICS={
 3:{style:"rpg",name:"RPG"},
 6:{style:"kriss",name:"Kriss"},
 10:{style:"mp7",name:"MP7"},
 11:{style:"p90",name:"P90"},
 12:{style:"sopmod",name:"AK SOPMOD"},
 15:{style:"hk417",name:"HK417"},
 16:{style:"xm8",name:"XM8",hideViewmodelOnAds:true},
 18:{style:"saiga12",name:"Saiga-12",hideViewmodelOnAds:true}
};
function tacticalOpticConfig(w){return TACTICAL_OPTICS[w]||null;}
// XM8 uses a centered 2D circular reflex sight. Its tall 3D receiver/carry handle
// otherwise obstruct the sight picture; only opt-in weapon configs hide the viewmodel.
function tacticalOpticHidesViewmodel(w,active){var spec=tacticalOpticConfig(w);return !!(active&&spec&&spec.hideViewmodelOnAds);}
var tacticalAimEl=document.getElementById("tacticalAim");
function tacticalOpticUpdate(){
 var spec=pl&&!pl.dead&&!lob&&!mt.over&&mt.cd<=0&&run?tacticalOpticConfig(pl.w):null;
 var active=!!spec&&adsT>.05&&pl.rl<=0&&pl.sw<=0&&!(isBombMode()&&pl.bAction);
 tacticalAimEl.style.display=active?"block":"none";
 tacticalAimEl.style.opacity=active?String(Math.min(1,adsT*1.6)): "0";
 if(active){
   tacticalAimEl.className="tactical-aim tactical-aim-"+spec.style;
 }
 document.body.classList.toggle("tactical-ads",active&&adsT>.65);
 // The 2D overlay draws the sight, so hide the 3D optic frame while aiming (it would block the view and double the optic).
 guns.forEach(function(g,i){var parts=g.userData.opticParts;if(!parts)return;var hide=active&&pl.w===i&&adsT>.35;parts.forEach(function(m){m.visible=!hide;});});
 return active;
}
// Mouse-first primary weapon picker shared by Team Deathmatch and Bomb Mission.
// Weapon profiles, ballistics, inventory ownership and 4-slot HUD remain authoritative elsewhere.
var wsEl=document.getElementById("wsel"),wsOn=false,wsCards=[],wsConfirmed=false,wsPage=0,wsCategory="rifle",WS_VISIBLE=5;
// During room launch, weapon selection uses a live timer independent of match freeze.
var wsLiveTime=0,wsLiveDuration=0;
var WS_ORDER=[9,1,12,15,16,2,18,6,13,14,8,17,10,11,3],WS_TABS=[
 ["rifle","ASSAULT RIFLE"],["smg","SMG"],["sniper","SNIPER"],["shotgun","SHOTGUN"],["rocket","LAUNCHER"]];
function loadoutCatalog(){
 var all=inventoryCatalogMain();
 return WS_ORDER.filter(function(id){return all.indexOf(id)>=0;}).concat(all.filter(function(id){return WS_ORDER.indexOf(id)<0;}));
}
function loadoutElement(tag,cls,label){
 var el=document.createElement(tag);el.className=cls||"";if(label!==undefined)el.textContent=label;return el;
}
function loadoutPage(p){var all=loadoutCatalog();wsPage=Math.max(0,Math.min(Math.max(0,all.length-WS_VISIBLE),p));loadoutRender();}
function loadoutCategory(kind){
 var all=loadoutCatalog(),id=all.filter(function(i){return WP[i].stats.kind===kind;})[0];
 if(id===undefined)return;
 wsCategory=kind;loadoutPage(all.indexOf(id));
}
function loadoutRender(){
 var ids=loadoutCatalog(),owned=inventoryOwned("main"),shell=loadoutElement("section","wp-shell");
 wsEl.textContent="";wsCards=[];
 var header=loadoutElement("header","wp-head"),title=loadoutElement("div","wp-title");
 title.appendChild(loadoutElement("i","wp-mark"));
 title.appendChild(loadoutElement("strong","","CHOOSE PRIMARY WEAPON"));
 title.appendChild(loadoutElement("small","","Click weapon to select"));header.appendChild(title);
 var tabs=loadoutElement("nav","wp-tabs");tabs.setAttribute("aria-label","Weapon categories");
 WS_TABS.forEach(function(item){
  var tab=loadoutElement("button","wp-tab"+(wsCategory===item[0]?" on":""),item[1]);tab.type="button";
  tab.onclick=function(){loadoutCategory(item[0]);};tabs.appendChild(tab);
 });
 header.appendChild(tabs);shell.appendChild(header);
 var rail=loadoutElement("div","wp-rail");
 var prev=loadoutElement("button","wp-arrow","❮");prev.type="button";prev.disabled=wsPage===0;
 prev.setAttribute("aria-label","Previous weapons");prev.onclick=function(){loadoutPage(wsPage-1);};rail.appendChild(prev);
 var cards=loadoutElement("div","wp-cards");
 ids.slice(wsPage,wsPage+WS_VISIBLE).forEach(function(id){
  var w=WP[id],ownedNow=owned.indexOf(id)>=0;
  var b=loadoutElement("button","wp-card"+(ownedNow?"":" locked"));b.type="button";b.disabled=!ownedNow;
  b.setAttribute("aria-label",w.n+(ownedNow?"":" locked: unlock in Shop"));
  var art=loadoutElement("span","wp-art");art.innerHTML=SV[id];b.appendChild(art);
  b.appendChild(loadoutElement("strong","wp-name",w.n));
  b.appendChild(loadoutElement("span","wp-kind",WEAPON_CLASS_LABELS[w.stats.kind]||w.stats.kind));
  b.appendChild(loadoutElement("small","wp-desc",ownedNow?(WDESC[id]||"Ready for battle"):"UNLOCK IN SHOP"));
  if(ownedNow)b.onclick=function(){chooseWeapon(id);};
  cards.appendChild(b);wsCards.push({id:id,el:b});
 });
 rail.appendChild(cards);
 var next=loadoutElement("button","wp-arrow","❯");next.type="button";
 next.disabled=wsPage+WS_VISIBLE>=ids.length;next.setAttribute("aria-label","Next weapons");
 next.onclick=function(){loadoutPage(wsPage+1);};rail.appendChild(next);shell.appendChild(rail);
 var foot=loadoutElement("footer","wp-foot"),time=loadoutElement("div","wp-time");
 time.appendChild(loadoutElement("span","","AUTO DEPLOY IN "));
 time.appendChild(loadoutElement("b","wp-seconds","5s"));
 var track=loadoutElement("div","wp-track");track.appendChild(loadoutElement("i","wp-track-fill"));time.appendChild(track);
 foot.appendChild(time);
 var confirm=loadoutElement("button","wp-confirm","CONFIRM LOADOUT");confirm.type="button";
 confirm.onclick=function(){loadoutFinish(true);};foot.appendChild(confirm);
 var enter=loadoutElement("div","wp-enter");enter.appendChild(loadoutElement("kbd","","ENTER"));
 enter.appendChild(loadoutElement("span","","Press Enter to deploy"));foot.appendChild(enter);
 shell.appendChild(foot);wsEl.appendChild(shell);loadoutRefreshSelected();
}
function loadoutRefreshSelected(){
 wsCards.forEach(function(c){
  var selected=pl&&(pl.prim===c.id||(pl.prim===7&&c.id===6));
  c.el.classList.toggle("on",!!selected);c.el.setAttribute("aria-pressed",selected?"true":"false");
 });
}
function loadoutPrepareRound(){
 wsLiveTime=wsLiveDuration=0;
 wsConfirmed=false;wsOn=false;wsEl.classList.remove("show");
 wsCategory=WP[favPrim]?WP[favPrim].stats.kind:"rifle";
 var ids=loadoutCatalog();wsPage=Math.min(Math.max(0,ids.length-WS_VISIBLE),Math.max(0,ids.indexOf(favPrim)-1));
 loadoutRender();document.body.classList.remove("loadout-active","loadout-cursor-hidden");
}
function loadoutBeginLiveWindow(seconds){
 // Duration comes from startMatch()/bombStartMatch() before freeze suppression.
 wsLiveTime=wsLiveDuration=Math.max(0,Number(seconds)||0);
 wsConfirmed=wsLiveTime<=0;
 loadoutUpdate();
}
function loadoutReleaseInput(){
 mouse.down=false;mouse.right=false;fireHeld=false;
 if(typeof lookStopDrag==="function")lookStopDrag();
}
function loadoutFinish(userGesture){
 if(wsConfirmed||!run||mt.over||pl.dead)return;
 wsConfirmed=true;wsLiveTime=0;
 var id=pl.prim===7?6:pl.prim;
 if(inventoryOwned("main").indexOf(id)>=0){inventoryState.equipped.main=id;inventorySave();}
 loadoutReleaseInput();loadoutUpdate();
 // User confirmation requests pointer lock; on timeout ordinary mouse movement already aims without a click.
 if(userGesture&&!touch&&!lob&&R.domElement.requestPointerLock){
  try{var req=R.domElement.requestPointerLock();if(req&&req.catch)req.catch(function(){});}catch(e){}
 }
}
function loadoutUpdate(){
 if(wsOn&&!wsConfirmed&&mt.cd<=0&&wsLiveTime<=0)loadoutFinish(false);
 var open=!!(run&&!lob&&!mt.over&&!pl.dead&&(mt.cd>0||wsLiveTime>0)&&!wsConfirmed);
 if(open!==wsOn){
  wsOn=open;wsEl.classList.toggle("show",open);
  document.body.classList.toggle("loadout-active",open);
  document.body.classList.toggle("loadout-cursor-hidden",!open&&run&&!lob);
  if(open){
   loadoutReleaseInput();
   if(document.pointerLockElement===R.domElement&&document.exitPointerLock)document.exitPointerLock();
  }
 }
 if(open){
  var remaining=wsLiveTime>0?wsLiveTime:mt.cd;
  var duration=wsLiveTime>0?wsLiveDuration:(isBombMode()?BOMB_RULES.freezeSeconds:5);
  var seconds=wsEl.querySelector(".wp-seconds"),fill=wsEl.querySelector(".wp-track-fill");
  if(seconds)seconds.textContent=Math.max(1,Math.ceil(remaining))+"s";
  if(fill)fill.style.width=Math.min(100,Math.max(0,remaining/Math.max(duration,.001)*100))+"%";
 }
}
// Global first-person camera input (shared by Deathmatch and Bomb Mission).
// Browser pointer lock can emit discontinuous movementX/Y values. Reject anomalous
// individual events instead of letting one bad event rotate the view backwards.
var LOOK_CONFIG={
  sensitivity:.003,             // Original desktop mouse sensitivity (unchanged).
  sniperAdsReduction:.82,       // Original AWP ADS multiplier (unchanged).
  otherAdsReduction:.5,        // Original non-AWP ADS multiplier (unchanged).
  maxMouseDeltaPerEvent:200     // Pixels; discard impossible jumps, not normal aim.
};
var lookDragPoint=null,lookHoverPoint=null,lookSkipLockedMove=false;
// Timer callbacks cannot obtain Pointer Lock without browser user activation.
// Fallback mouse-look immediately responds to normal movement after auto-deploy.
function lookFreeAimEnabled(){
 return typeof wsConfirmed!=="undefined"&&
        ((wsConfirmed&&typeof wsOn!=="undefined"&&!wsOn)||
         (!wsConfirmed&&typeof wsLiveTime!=="undefined"&&wsLiveTime>0&&typeof wsOn!=="undefined"&&wsOn))&&
        typeof touch!=="undefined"&&!touch&&
        mt&&mt.cd<=0&&!mt.over&&run&&!lob&&pl&&!pl.dead&&
        document.pointerLockElement!==R.domElement&&
        (typeof escEl==="undefined"||escEl.style.display!=="flex");
}
function lookStartDrag(e){
  if(e.pointerType!=="mouse"||document.pointerLockElement===R.domElement)return;
  if(Number.isFinite(e.clientX)&&Number.isFinite(e.clientY))lookDragPoint={x:e.clientX,y:e.clientY};
}
function lookStopDrag(){lookDragPoint=null;lookHoverPoint=null;}
function lookLockChanged(){
  lookStopDrag();
  // The first relative movement can contain a cursor-warp delta after lock acquisition.
  lookSkipLockedMove=document.pointerLockElement===R.domElement;
}
function lookMove(e){
  if(e.pointerType!=="mouse"||!run||lob||mt.over||!pl||pl.dead||
     (typeof wsOn!=="undefined"&&wsOn&&!(typeof wsLiveTime!=="undefined"&&wsLiveTime>0))||
     (typeof escEl!=="undefined"&&escEl.style.display==="flex"))return;
  var locked=document.pointerLockElement===R.domElement,dragging=!!(e.buttons&1),
      freeAim=!locked&&!dragging&&lookFreeAimEnabled(),dx,dy;
  if(!locked&&!dragging&&!freeAim){lookStopDrag();return;}
  if(locked){
    if(lookSkipLockedMove){lookSkipLockedMove=false;return;}
    dx=e.movementX;dy=e.movementY;
  }else if(dragging){
    // Screen coordinates are stable during unlocked click-and-drag; movementX/Y
    // can jump when the browser switches between locked and unlocked pointers.
    if(!lookDragPoint){lookStartDrag(e);return;}
    dx=e.clientX-lookDragPoint.x;dy=e.clientY-lookDragPoint.y;
    lookStartDrag(e);
  }else{
    // Timer ended without pointer lock: aim immediately from mouse hover,
    // using stable screen coordinates rather than unreliable movementX.
    if(!Number.isFinite(e.clientX)||!Number.isFinite(e.clientY)){
      lookHoverPoint=null;return;
    }
    if(!lookHoverPoint){lookHoverPoint={x:e.clientX,y:e.clientY};return;}
    dx=e.clientX-lookHoverPoint.x;dy=e.clientY-lookHoverPoint.y;
    lookHoverPoint={x:e.clientX,y:e.clientY};
  }
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||
      Math.abs(dx)>LOOK_CONFIG.maxMouseDeltaPerEvent||
      Math.abs(dy)>LOOK_CONFIG.maxMouseDeltaPerEvent)return;
  var sn=LOOK_CONFIG.sensitivity*(1-(WP[pl.w].snp?LOOK_CONFIG.sniperAdsReduction:LOOK_CONFIG.otherAdsReduction)*adsT);
  pl.face-=dx*sn;
  pl.pitch=Math.max(-1.2,Math.min(1.2,pl.pitch-dy*sn));
}
// ---- INPUT ----
// keys = pressed KeyboardEvent.code map, mouse = {down,right}, ST = touch sticks, fireHeld/jumpHeld = touch buttons.
// input
var fireHeld=false,jumpHeld=false,keys={},mouse={x:innerWidth/2,y:0,down:false,right:false},ST={l:{x:0,y:0,on:false},r:{x:0,y:0,on:false}};
addEventListener("keydown",function(e){if(e.code==="Space")e.preventDefault();keys[e.code]=true;
// A real WASD/arrow key press can grant browser activation to upgrade from
// hover-aim to unrestricted Pointer Lock; auto-timeout itself cannot.
if(typeof wsConfirmed!=="undefined"&&wsConfirmed&&run&&!lob&&
   !mt.over&&mt.cd<=0&&!pl.dead&&!document.pointerLockElement&&
   (typeof escEl==="undefined"||escEl.style.display!=="flex")&&
   /^(Key[WASD]|Arrow(Up|Down|Left|Right))$/.test(e.code)&&
   R.domElement.requestPointerLock){
 try{var request=R.domElement.requestPointerLock();if(request&&request.catch)request.catch(function(){});}catch(err){}
}
if(typeof wsOn!=="undefined"&&wsOn&&e.code==="Enter"){e.preventDefault();loadoutFinish(true);keys[e.code]=false;return;}if(mt.over&&e.code==="Enter"&&document.getElementById("dv").classList.contains("show")){again();return;}if(e.code==="KeyR"&&!(isBombMode()&&pl.bAction))reload();if(e.code==="KeyV")toggleDual();if(run&&!pl.dead){var dm=/^(Digit|Numpad)([1-5])$/.exec(e.code);if(dm){if((mt.cd>0||wsLiveTime>0)&&!mt.over)chooseWeapon(WSEL[+dm[2]-1]);else if(+dm[2]<=4)swSlot(+dm[2]-1);}}});
document.getElementById("rl").addEventListener("pointerdown",function(e){e.stopPropagation();reload();});
(function(){var jb=document.getElementById("jb");jb.addEventListener("pointerdown",function(e){e.stopPropagation();jb.setPointerCapture(e.pointerId);jumpHeld=true;});["pointerup","pointercancel"].forEach(function(t){jb.addEventListener(t,function(){jumpHeld=false;});});var b=document.getElementById("fb");b.addEventListener("pointerdown",function(e){e.stopPropagation();b.setPointerCapture(e.pointerId);fireHeld=true;});["pointerup","pointercancel"].forEach(function(t){b.addEventListener(t,function(){fireHeld=false;});});})();addEventListener("keyup",function(e){keys[e.code]=false;});
R.domElement.addEventListener("pointermove",function(e){if(e.pointerType==="mouse"){mouse.down=!!(e.buttons&1);mouse.right=!!(e.buttons&2);lookMove(e);}});
// HUD layers intercept some pointer events. Forward those too, once,
// only while free aim is active and not already handled by the canvas.
addEventListener("pointermove",function(e){
 if(e.pointerType==="mouse"&&e.target!==R.domElement&&lookFreeAimEnabled()&&
    !(e.target&&e.target.closest&&e.target.closest("#wsel")))lookMove(e);
});
R.domElement.addEventListener("pointerdown",function(e){if(e.pointerType==="mouse"){if((typeof wsOn!=="undefined"&&wsOn)||
  (typeof escEl!=="undefined"&&escEl.style.display==="flex")){e.preventDefault();return;}lookStartDrag(e);if(e.button===2){mouse.right=true;e.preventDefault();if(run&&!pl.dead&&WP[pl.w].snp&&mt.cd<=0&&!mt.over&&!(pl.bolt>0))scopeOn=!scopeOn;}else if(e.button===0)mouse.down=true;if(run&&!pl.dead&&!document.pointerLockElement&&R.domElement.requestPointerLock){try{R.domElement.requestPointerLock();}catch(x){}}}});
addEventListener("pointerup",function(e){if(e.pointerType==="mouse"){mouse.down=!!(e.buttons&1);mouse.right=!!(e.buttons&2);if(!mouse.down)lookStopDrag();}});addEventListener("blur",function(){mouse.right=false;mouse.down=false;keys={};lookStopDrag();});
document.addEventListener("pointerlockchange",lookLockChanged);
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
// Home menu showcase: local gameplay videos, separate from the Three.js map render.
// Only the HOME panel owns playback; inventory, room lobby and matches stay unaffected.
var HOME_DEMOS=Object.freeze({
 deathmatch:Object.freeze({src:"./src/assets/video/deatch_match_demo.mp4",label:"DEATHMATCH",detail:"5V5 · ALL-OUT COMBAT",number:"01"}),
 bomb:Object.freeze({src:"./src/assets/video/bomb_mission_demo.mp4",label:"BOMB MISSION",detail:"TACTICAL · PLANT & DEFUSE",number:"02"})
});
var homeDemoKey="deathmatch",homeDemoHasError=false;
var homeDemoVideo=document.getElementById("homeDemoVideo"),
 homeDemoNextVideo=document.getElementById("homeDemoNextVideo"),
 homeDemoScreen=document.querySelector("#lbs .home-demo-screen"),
 homeDemoStatus=document.getElementById("homeDemoStatus"),
 homeDemoLabel=document.getElementById("homeDemoLabel"),
 homeDemoDetail=document.getElementById("homeDemoDetail"),
 homeDemoCounter=document.getElementById("homeDemoCounter"),
 homeDemoProgress=document.getElementById("homeDemoProgress"),
 homeDemoEmpty=document.getElementById("homeDemoEmpty");
var homeDemoInterval=null,homeDemoFadeTimer=null,homeDemoTransitioning=false;
function homeDemoVisible(){
 return !document.hidden&&!run&&!!lob&&document.getElementById("lbs").classList.contains("on");
}
function homeDemoSetStatus(message){homeDemoStatus.textContent=message;}
function homeDemoAttemptPlay(video){
 if(!homeDemoVisible()||homeDemoHasError)return;
 var target=video||homeDemoVideo;target.muted=true;
 var attempt=target.play();
 if(attempt&&typeof attempt.catch==="function")attempt.catch(function(){
   if(homeDemoVisible()&&!homeDemoHasError)homeDemoSetStatus("GAMEPLAY PREVIEW");
 });
}
function homeDemoUpdateLabel(value){
 var demo=HOME_DEMOS[value];homeDemoKey=value;
 homeDemoLabel.textContent=demo.label;homeDemoDetail.textContent=demo.detail;
 homeDemoCounter.textContent=demo.number+" / 02";
 homeDemoEmpty.hidden=true;homeDemoSetStatus("GAMEPLAY FOOTAGE");
}
function homeDemoResetProgress(){
 if(!homeDemoProgress)return;
 homeDemoProgress.style.animation="none";
 void homeDemoProgress.offsetWidth;
 homeDemoProgress.style.animation="";
}
function homeDemoRotate(){
 if(!homeDemoVisible()||homeDemoTransitioning)return;
 homeDemoTransitioning=true;
 var nextKey=homeDemoKey==="deathmatch"?"bomb":"deathmatch";
 var outgoing=homeDemoVideo,incoming=homeDemoNextVideo;
 incoming.classList.remove("is-current");incoming.muted=true;
 incoming.src=HOME_DEMOS[nextKey].src;incoming.load();
 function finish(){
   if(!homeDemoTransitioning)return;
   incoming.classList.add("is-current");
   homeDemoUpdateLabel(nextKey);
   homeDemoResetProgress();
   clearTimeout(homeDemoFadeTimer);
   homeDemoFadeTimer=setTimeout(function(){
     outgoing.pause();outgoing.classList.remove("is-current");outgoing.removeAttribute("src");outgoing.load();
     homeDemoVideo=incoming;homeDemoNextVideo=outgoing;homeDemoTransitioning=false;
   },780);
 }
 var play=incoming.play();
 if(play&&typeof play.then==="function"){
   play.then(function(){if(homeDemoVisible())finish();else homeDemoTransitioning=false;})
   .catch(function(){homeDemoTransitioning=false;homeDemoSetStatus("GAMEPLAY PREVIEW");});
 }else finish();
}
function homeShowcaseSync(){
 if(!homeDemoVideo)return;
 if(homeDemoVisible()){
   homeDemoAttemptPlay();
   if(homeDemoInterval===null){
     homeDemoResetProgress();
     homeDemoInterval=setInterval(homeDemoRotate,10000);
   }
 }else{
   homeDemoVideo.pause();homeDemoNextVideo.pause();
   if(homeDemoInterval!==null){clearInterval(homeDemoInterval);homeDemoInterval=null;}
   clearTimeout(homeDemoFadeTimer);
   homeDemoVideo.classList.add("is-current");
   homeDemoNextVideo.classList.remove("is-current");
   homeDemoTransitioning=false;
 }
}
[homeDemoVideo,homeDemoNextVideo].forEach(function(video){
 video.muted=true;
 video.addEventListener("error",function(){
   if(video!==homeDemoVideo)return;
   homeDemoHasError=true;
   homeDemoEmpty.hidden=false;homeDemoSetStatus("PREVIEW UNAVAILABLE");
 });
});
document.addEventListener("visibilitychange",homeShowcaseSync);
homeDemoUpdateLabel("deathmatch");
homeShowcaseSync();
// Wallet connection is optional UI preparation; it does not authenticate gameplay.
var homeWalletButton=document.getElementById("homeWalletConnect");
var homeWalletAccount=null;
var homeWalletLabel=document.getElementById("homeWalletLabel");
function homeWalletRender(){
 homeWalletLabel.textContent=homeWalletAccount?
  homeWalletAccount.slice(0,6)+"…"+homeWalletAccount.slice(-4):"CONNECT WALLET";
 homeWalletButton.classList.toggle("connected",!!homeWalletAccount);
 homeWalletButton.setAttribute("aria-label",homeWalletAccount?"Connected wallet "+homeWalletAccount:"Connect wallet");
}
homeWalletButton.addEventListener("click",function(){
 var provider=window.ethereum;
 if(!provider||typeof provider.request!=="function"){
   homeWalletLabel.textContent="WALLET NOT FOUND";
   return;
 }
 homeWalletButton.disabled=true;homeWalletLabel.textContent="CONNECTING…";
 provider.request({method:"eth_requestAccounts"}).then(function(accounts){
   homeWalletAccount=Array.isArray(accounts)&&typeof accounts[0]==="string"&&/^0x[a-fA-F0-9]{40}$/.test(accounts[0])?accounts[0]:null;
   homeWalletRender();
 }).catch(function(){
   homeWalletRender();
 }).finally(function(){homeWalletButton.disabled=false;});
});
if(window.ethereum&&typeof window.ethereum.on==="function"){
 window.ethereum.on("accountsChanged",function(accounts){
   homeWalletAccount=Array.isArray(accounts)&&typeof accounts[0]==="string"&&/^0x[a-fA-F0-9]{40}$/.test(accounts[0])?accounts[0]:null;
   homeWalletRender();
 });
}
homeWalletRender();
// PBT is a visual placeholder until the token system has an audited contract and trusted balance source.
var homePbtAdd=document.getElementById("homePbtAdd");
var homePbtNotice=document.getElementById("homePbtNotice");
var homePbtNoticeTimer=null;
if(homePbtAdd&&homePbtNotice){
 homePbtAdd.addEventListener("click",function(){
  homePbtNotice.hidden=false;
  clearTimeout(homePbtNoticeTimer);
  homePbtNoticeTimer=setTimeout(function(){homePbtNotice.hidden=true;},3500);
 });
}
// Room Lobby: browser-local room master flow; no network rooms or invented pings.
// Uses existing mode maps, 5v5 bots, and canonical combat/plant/defuse systems.
var ROOM_STORAGE_KEY="bbfps_local_rooms_v1";
var ROOM_LIMITS=Object.freeze({kills:[20,30,50,75,100],minutes:[1,3,5,10,15],rounds:[3,5,7,9,12],roundMinutes:[1,2,3,4]});
var roomList=[],roomCurrent=null,roomMatchConfig=null,roomDraftMode=0,roomDraftMapId="block-district";

/* Team slots preview the real 5v5 roster. AI is created by startMatch, never here. */
var ROOM_START_COUNTDOWN=3,roomSide=0,roomSeat=0,roomLog=[];
var roomStartFlow={active:false,phase:"idle",token:0,raf:0,timer:0,deadline:0,config:null,team:0,mapReady:false,loadoutSeconds:0};
function roomLiveLog(message){
 roomLog.push(String(message));if(roomLog.length>12)roomLog.shift();
 var root=document.getElementById("rmlLogLines");root.replaceChildren();
 roomLog.forEach(function(entry){var row=document.createElement("div");row.className="rml-log-line";row.textContent=entry;root.appendChild(row);});
 root.scrollTop=root.scrollHeight;
}
function roomLiveTeams(){
 var size=BOMB_RULES.teamSize;
 for(var side=0;side<2;side++){
  var target=document.getElementById(side===0?"rmlPoliceSlots":"rmlTerrorSlots");target.replaceChildren();
  roomText(side===0?"rmlPoliceCount":"rmlTerrorCount",size+" / "+size+" ON START");
  for(var slot=0;slot<size;slot++){
   (function(team,seat){
    var own=team===roomSide&&seat===roomSeat,idx=team===roomSide?(seat<roomSeat?seat:seat-1):seat;
    var bot=BN[team]&&BN[team][idx],row=document.createElement("button");row.type="button";
    row.className="rml-slot"+(own?" is-you":"");row.setAttribute("aria-pressed",String(own));
    var num=document.createElement("span");num.className="rml-slot-index";num.textContent=String(seat+1);
    var name=document.createElement("span");name.className="rml-slot-name";name.textContent=own?"YOU · ROOM MASTER":bot?"BOT "+bot:"BOT ON START";
    var hint=document.createElement("em");hint.textContent=own?"SELECTED":"ON START";
    row.appendChild(num);row.appendChild(name);row.appendChild(hint);
    row.addEventListener("click",function(){
     if(!roomCurrent||roomSide===team&&roomSeat===seat)return;
     roomSide=team;roomSeat=seat;roomLiveTeams();inventoryRoomPreviewOpen(roomSide);
     roomLiveLog("You moved to "+(team===0?"Police":"Terrorists")+" slot "+(seat+1)+".");
    });
    target.appendChild(row);
   })(side,slot);
  }
 }
}
function roomLiveOpen(room){
 if(!room)return;
 roomEditState(room);
 var map=roomMapsForMode(room.mode,room.mapId);
 roomText("rmlBotSummary","1 PLAYER + "+(BOMB_RULES.teamSize*2-1)+" BOTS ON START");
 roomText("rmlRoomName",room.name);roomText("rmlMapName",map?map.name:"UNAVAILABLE");roomText("rmlMapCaption",map?map.caption:"");
 roomText("rmlGameMode",room.mode===1?"BOMB MODE":"TEAM DEATH MATCH");
 roomText("rmlGoalLabel",room.mode===1?"MAX ROUNDS":"KILL LIMIT");
 roomText("rmlGoal",room.mode===1?room.rounds+" ROUNDS":room.kills+" KILLS");
 roomText("rmlTimeLabel",room.mode===1?"ROUND TIME":"MATCH TIME");
 roomText("rmlTime",(room.mode===1?room.roundMinutes:room.minutes)+" MINUTES");
 roomLiveTeams();lobP("lbroomlive");
 // Inventory owns the soldier, real mkGun models, equipped weapon and 3D renderer.
 inventoryRoomPreviewOpen(roomSide);
}

// In-room settings have their own unsaved draft; the room browser stays untouched.
var roomModalDraft=null,roomModalReturnFocus=null;
function roomModalActive(){return !document.getElementById("roomSettingsModal").hidden;}
// Populate from the same authoritative limits as Create Room; no duplicated values.
function roomModalPopulateOptions(){
 [["kills"," KILLS"],["minutes"," MINUTES"],["rounds"," ROUNDS"],["roundMinutes"," MINUTES"]].forEach(function(entry){
  var key=entry[0],select=document.getElementById("roomModal"+key.charAt(0).toUpperCase()+key.slice(1));
  select.replaceChildren();
  ROOM_LIMITS[key].forEach(function(value){
   var option=document.createElement("option");option.value=String(value);
   option.textContent=value+entry[1];select.appendChild(option);
  });
 });
}
function roomModalPaint(){
 if(!roomModalDraft)return;
 var mode=roomModalDraft.mode;
 ["roomModalTdm","roomModalBomb"].forEach(function(id,index){
  var button=document.getElementById(id),active=index===mode;
  button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));
 });
 document.getElementById("roomModalTdmGroup").hidden=mode!==0;
 document.getElementById("roomModalBombGroup").hidden=mode!==1;
 ["kills","minutes","rounds","roundMinutes"].forEach(function(key){
  document.getElementById("roomModal"+key.charAt(0).toUpperCase()+key.slice(1)).value=String(roomModalDraft[key]);
 });
 var map=roomMapsForMode(mode,roomModalDraft.mapId);
 var select=document.getElementById("roomModalMap");
 roomFillMapSelect(select,mode,roomModalDraft.mapId);
 roomText("roomModalMapName",map?map.name:"UNAVAILABLE");
 roomText("roomModalMapCaption",map?map.caption:"");
}
function roomModalChooseMode(mode){
 if(!roomModalDraft)return;
 roomModalDraft.mode=mode===1?1:0;
 roomModalDraft.mapId=mode===1?bombMapId(roomModalDraft.mapId):tdmMapId(roomModalDraft.mapId);
 roomModalPaint();
 // Only the 3D preview changes until SAVE; roomCurrent remains unchanged.
 selM=roomModalDraft.mode;selectedBombMapId=bombMapId(roomModalDraft.mapId);selectedTdmMapId=tdmMapId(roomModalDraft.mapId);modePreviewSelect(selM);
}
function roomModalChooseMap(value){
 if(!roomModalDraft)return;
 roomModalDraft.mapId=roomModalDraft.mode===1?bombMapId(value):tdmMapId(value);
 roomModalPaint();
 selM=roomModalDraft.mode;selectedBombMapId=bombMapId(roomModalDraft.mapId);modePreviewSelect(selM);
}
function roomModalSelect(key,value){
 if(!roomModalDraft||ROOM_LIMITS[key]===undefined)return;
 // A forged DOM value cannot bypass the same whitelist used by roomNormalize.
 roomModalDraft[key]=roomAllowed(value,ROOM_LIMITS[key],roomModalDraft[key]);
 roomModalPaint();
}
function roomModalHide(restorePreview){
 if(!roomModalActive())return;
 document.getElementById("roomSettingsModal").hidden=true;
 roomModalDraft=null;
 roomText("roomModalError","");
 if(restorePreview&&roomCurrent){
  selM=roomCurrent.mode;selectedBombMapId=bombMapId(roomCurrent.mapId);selectedTdmMapId=tdmMapId(roomCurrent.mapId);modePreviewSelect(selM);
 }
 var focus=roomModalReturnFocus;roomModalReturnFocus=null;
 if(focus&&typeof focus.focus==="function")focus.focus();
}
function roomShowSettings(){
 if(!roomCurrent||roomStartFlow.active||roomModalActive())return;
 roomModalReturnFocus=document.activeElement||document.getElementById("rmlSettings");
 roomModalDraft=Object.assign({},roomCurrent);
 roomModalPopulateOptions();
 document.getElementById("roomModalName").value=roomCurrent.name;
 roomText("roomModalError","");
 roomModalPaint();
 document.getElementById("roomSettingsModal").hidden=false;
 // The lobby map frame fills the thumbnail immediately; next render updates the live map.
 var source=document.getElementById("rmlMapPreview"),dest=document.getElementById("roomModalMapPreview");
 try{dest.getContext("2d",{alpha:false}).drawImage(source,0,0,dest.width,dest.height);}catch(err){}
 if(typeof document.getElementById("roomModalName").focus==="function")document.getElementById("roomModalName").focus();
}
function roomModalSave(){
 if(!roomCurrent||!roomModalDraft)return;
 var draft=Object.assign({},roomModalDraft,{name:document.getElementById("roomModalName").value.trim().slice(0,32)});
 if(!draft.name){roomText("roomModalError","Enter a room name before saving.");return;}
 var saved=roomSaveDraft(draft);
 if(!saved){roomText("roomModalError","Could not save these room settings.");return;}
 roomModalHide(false);roomLiveLog("Room settings updated.");roomLiveOpen(saved);
}

function roomLeaveLive(){roomCloseLocal();lobP("lbrooms");}

function roomAllowed(value,list,fallback){var n=Number(value);return list.indexOf(n)>=0?n:fallback;}
function roomNormalize(obj){
 if(!obj||typeof obj!=="object"||typeof obj.id!=="string"||!/^[0-9]{8,20}$/.test(obj.id))return null;
 if(obj.mode!==0&&obj.mode!==1)return null;
 var name=String(obj.name||"").trim().slice(0,32);
 if(!name)return null;
 return{id:obj.id,name:name,mode:obj.mode,
 mapId:obj.mode===1?bombMapId(obj.mapId):tdmMapId(obj.mapId),
 kills:roomAllowed(obj.kills,ROOM_LIMITS.kills,50),
 minutes:roomAllowed(obj.minutes,ROOM_LIMITS.minutes,10),
 rounds:roomAllowed(obj.rounds,ROOM_LIMITS.rounds,12),
 roundMinutes:roomAllowed(obj.roundMinutes,ROOM_LIMITS.roundMinutes,2)};
}
function roomLoad(){
 var data=[];try{data=JSON.parse(localStorage.getItem(ROOM_STORAGE_KEY)||"[]");}catch(err){}
 roomList=Array.isArray(data)?data.slice(0,40).map(roomNormalize).filter(Boolean):[];
}
function roomPersist(){try{localStorage.setItem(ROOM_STORAGE_KEY,JSON.stringify(roomList));return true;}catch(err){return false;}}
function roomMapsForMode(mode,mapId){
 var m=mode===1?bombMapInfo(mapId):mode===0?tdmMapInfo(mapId):MODE_MAP_PREVIEWS[mode];
 return m?{name:m.name,caption:m.caption}:null;
}
function roomFillMapSelect(select,mode,mapId){
 select.replaceChildren();
 var options=mode===1?bombMapOptions(mode):tdmMapOptions();
 options.forEach(function(m){
  var option=document.createElement("option");option.value=m.id;option.textContent=m.name;
  select.appendChild(option);
 });
 select.value=mode===1?bombMapId(mapId):tdmMapId(mapId);
 select.disabled=options.length<2;
}
function roomText(id,value){document.getElementById(id).textContent=String(value);}
function roomModeSelect(mode){
 roomDraftMode=mode===1?1:0;
 ["roomTdm","roomBomb"].forEach(function(id,i){
  var active=i===roomDraftMode,btn=document.getElementById(id);
  btn.classList.toggle("active",active);btn.setAttribute("aria-pressed",String(active));
 });
 document.getElementById("roomTdmSettings").hidden=roomDraftMode!==0;
 document.getElementById("roomBombSettings").hidden=roomDraftMode!==1;
 roomDraftMapId=roomDraftMode===1?bombMapId(roomDraftMapId):tdmMapId(roomDraftMapId);
 var map=roomMapsForMode(roomDraftMode,roomDraftMapId),mapSelect=document.getElementById("roomMap");
 roomFillMapSelect(mapSelect,roomDraftMode,roomDraftMapId);
 roomText("roomMapName",map?map.name:"UNAVAILABLE");
 roomText("roomMapCaption",map?map.caption:"");
 selM=roomDraftMode;selectedBombMapId=bombMapId(roomDraftMapId);selectedTdmMapId=tdmMapId(roomDraftMapId);
 modePreviewSelect(roomDraftMode);
}
function roomChooseMap(value){
 roomDraftMapId=roomDraftMode===1?bombMapId(value):tdmMapId(value);
 roomModeSelect(roomDraftMode);
}
function roomFormData(){
 var name=document.getElementById("roomName").value.trim().slice(0,32);
 if(!name)return null;
 return{name:name,mode:roomDraftMode,mapId:roomDraftMode===1?bombMapId(document.getElementById("roomMap").value):tdmMapId(document.getElementById("roomMap").value),
  kills:roomAllowed(document.getElementById("roomKills").value,ROOM_LIMITS.kills,50),
  minutes:roomAllowed(document.getElementById("roomMinutes").value,ROOM_LIMITS.minutes,10),
  rounds:roomAllowed(document.getElementById("roomRounds").value,ROOM_LIMITS.rounds,12),
  roundMinutes:roomAllowed(document.getElementById("roomRoundMinutes").value,ROOM_LIMITS.roundMinutes,2)};
}
function roomRender(){
 var list=document.getElementById("roomEntries");list.replaceChildren();
 document.getElementById("roomEmpty").hidden=roomList.length>0;
 roomText("roomCount",roomList.length+" LOCAL ROOM"+(roomList.length===1?"":"S"));
 roomList.forEach(function(r){
  var row=document.createElement("div");row.className="room-entry";
  function cell(tag,text,className){var el=document.createElement(tag);el.textContent=text;if(className)el.className=className;row.appendChild(el);return el;}
  cell("span","#"+r.id.slice(-4));
  cell("strong",r.name);
  var map=document.createElement("div");map.className="rm-map";
  var mapTitle=document.createElement("span");mapTitle.textContent=(roomMapsForMode(r.mode,r.mapId)||{}).name||"UNKNOWN";
  var mode=document.createElement("small");mode.textContent=r.mode===1?"BOMB MODE":"TDM";
  map.appendChild(mapTitle);map.appendChild(mode);row.appendChild(map);
  cell("span","1 / 10");cell("span","WAITING","rm-status");
  var open=document.createElement("button");open.type="button";open.textContent="OPEN";open.addEventListener("click",function(){roomOpenSaved(r.id);});row.appendChild(open);
  list.appendChild(row);
 });
}
function roomSetMessage(message){roomText("roomMessage",message||"");}
function roomEditState(room){
 roomCurrent=room||null;
 var owned=!!room;
 document.getElementById("roomCreate").hidden=owned;
 document.getElementById("roomMasterActions").hidden=!owned;
 document.getElementById("roomMasterStatus").hidden=!owned;
 roomText("roomPanelTitle",owned?"ROOM SETTINGS":"CREATE ROOM");
 roomText("roomPanelSub",owned?"YOU ARE ROOM MASTER":"BECOME ROOM MASTER");
 if(owned){
  document.getElementById("roomName").value=room.name;
  document.getElementById("roomKills").value=String(room.kills);
  document.getElementById("roomMinutes").value=String(room.minutes);
  document.getElementById("roomRounds").value=String(room.rounds);
  document.getElementById("roomRoundMinutes").value=String(room.roundMinutes);
  roomDraftMapId=room.mapId;roomModeSelect(room.mode);
 }else roomModeSelect(roomDraftMode);
}
function roomOpenSaved(id){
 var match=roomList.find(function(r){return r.id===id;});
 if(!match){roomSetMessage("Room not found in this browser.");return;}
 roomSide=0;roomSeat=0;roomLog=[];roomLiveLog("Room opened. You are Room Master.");roomLiveOpen(match);roomSetMessage("Room ready.");
}
function roomCreateLocal(){
 var draft=roomFormData();if(!draft){roomSetMessage("Enter a room name before creating.");return;}
 if(roomList.length>=40){roomSetMessage("Maximum 40 saved local rooms. Close one first.");return;}
 var id=String(Date.now())+String(Math.floor(Math.random()*90000)+10000);
 var room=roomNormalize(Object.assign({id:id},draft));
 if(!room){roomSetMessage("Invalid room settings.");return;}
 roomList.unshift(room);roomPersist();roomRender();roomSide=0;roomSeat=0;roomLog=[];
 roomLiveLog("Room created. You are Room Master.");roomLiveOpen(room);
 roomSetMessage("Room created locally. You are the Room Master.");
}
function roomSaveDraft(draft){
 if(!roomCurrent||!draft||!String(draft.name||"").trim()){roomSetMessage("Room name cannot be empty.");return null;}
 var next=roomNormalize(Object.assign({},draft,{id:roomCurrent.id}));
 if(!next)return null;
 var i=roomList.findIndex(function(r){return r.id===roomCurrent.id;});
 if(i<0){roomSetMessage("Room no longer exists.");roomEditState(null);return null;}
 roomList[i]=next;roomCurrent=next;roomPersist();roomRender();
 roomSetMessage("Room settings saved.");return next;
}
function roomSaveLocal(){return roomSaveDraft(roomFormData());}
function roomCloseLocal(){
 roomModalHide(false);
 roomStartAbort();
 if(!roomCurrent)return;
 roomList=roomList.filter(function(r){return r.id!==roomCurrent.id;});roomPersist();roomRender();
 roomEditState(null);roomMatchConfig=null;roomLog=[];roomSetMessage("Local room closed.");
}

function roomStartMark(percent,label){
 document.getElementById("roomStartPercent").textContent=percent+"%";
 document.getElementById("roomStartBar").style.width=percent+"%";
 document.getElementById("roomStartPhase").textContent=label;
}
function roomStartAbort(){
 var flow=roomStartFlow;flow.token++;
 if(flow.raf)cancelAnimationFrame(flow.raf);
 if(flow.timer)clearTimeout(flow.timer);
 flow.raf=flow.timer=0;flow.active=false;flow.phase="idle";flow.config=null;flow.mapReady=false;flow.loadoutSeconds=0;
 document.getElementById("roomPrestart").hidden=true;
 var overlay=document.getElementById("roomTransition");
 overlay.classList.remove("on","leaving");overlay.hidden=true;
}
// Copy a *real* frame of the current 3D WebGL map, no fabricated loading image.
function roomStartCaptureMap(){
 var source=R.domElement,dest=document.getElementById("roomStartMap"),ctx=dest.getContext("2d",{alpha:false});
 if(!source.width||!source.height||!ctx)return false;
 var sw=source.width,sh=source.height,ratio=dest.width/dest.height,
     cw=Math.min(sw,sh*ratio),ch=Math.min(sh,sw/ratio);
 ctx.drawImage(source,(sw-cw)/2,(sh-ch)/2,cw,ch,0,0,dest.width,dest.height);
 roomStartFlow.mapReady=true;
 return true;
}
function roomStartCountdown(now,token){
 var flow=roomStartFlow;if(!flow.active||token!==flow.token||flow.phase!=="countdown")return;
 var seconds=Math.max(0,Math.ceil((flow.deadline-now)/1000));
 if(!seconds){roomStartLoading(token);return;}
 document.getElementById("roomPrestartNumber").textContent=String(seconds);
 flow.raf=requestAnimationFrame(function(next){roomStartCountdown(next,token);});
}
function roomStartLoading(token){
 var flow=roomStartFlow;if(!flow.active||token!==flow.token)return;
 flow.phase="loading";flow.raf=0;flow.mapReady=false;
 var overlay=document.getElementById("roomTransition");
 overlay.hidden=false;overlay.classList.remove("leaving");
 roomStartMark(0,"CAPTURING 3D MAP");
 flow.raf=requestAnimationFrame(function(){
  if(!flow.active||token!==flow.token)return;
  overlay.classList.add("on");
  roomStartLoadingCover(token,performance.now());
 });
}
function roomStartLoadingCover(token,openedAt){
 var flow=roomStartFlow;if(!flow.active||token!==flow.token||flow.phase!=="loading")return;
 if(flow.mapReady&&document.getElementById("roomStartPercent").textContent==="0%")roomStartMark(25,"3D MAP READY");
 var elapsed=performance.now()-openedAt;
 if(!flow.mapReady&&elapsed>5500){roomStartAbort();roomLiveLog("3D map is not ready. Try again.");return;}
 if(!flow.mapReady||elapsed<500){
  flow.raf=requestAnimationFrame(function(){roomStartLoadingCover(token,openedAt);});
  return;
 }
 flow.raf=0;roomStartPrepareGame(token);
}
function roomStartPrepareGame(token){
 var flow=roomStartFlow;if(!flow.active||token!==flow.token||flow.phase!=="loading")return;
 var room=flow.config;
 if(!roomCurrent||roomCurrent.id!==room.id){roomStartAbort();return;}
 flow.phase="preparing";roomStartMark(50,"PREPARING MATCH");
 try{
  // Existing engine builds actual map, 5v5 BOTs and equipped weapon behind an opaque cover.
  roomMatchConfig=Object.assign({},room);selM=room.mode;begin(flow.team);
  flow.loadoutSeconds=mt.cd; // Preserve the original per-mode weapon selection duration.
  mt.cd=0;run=false;document.getElementById("rsp").textContent="";
  roomStartMark(85,"INITIALIZING GAMEPLAY");
 }catch(err){
  run=false;lob=true;lb.style.display="flex";document.body.classList.add("lobby");
  lobP("lbroomlive");roomStartAbort();roomSetMessage("Match could not start. Please retry.");
  if(typeof console!=="undefined")console.error("Room launch failed",err);
  return;
 }
 // Let the render loop draw gameplay frames but never simulate the match until fade finishes.
 flow.raf=requestAnimationFrame(function(){
  if(!flow.active||token!==flow.token)return;
  flow.raf=requestAnimationFrame(function(){
   if(!flow.active||token!==flow.token)return;
   flow.raf=0;roomStartMark(100,"READY TO DEPLOY");roomStartReveal(token);
  });
 });
}
function roomStartReveal(token){
 var flow=roomStartFlow;if(!flow.active||token!==flow.token||flow.phase!=="preparing")return;
 // Let the 100% progress bar actually finish rendering before fading out.
 flow.phase="ready";
 flow.timer=setTimeout(function(){
  if(!flow.active||token!==flow.token||flow.phase!=="ready")return;
  flow.phase="fading";var overlay=document.getElementById("roomTransition");overlay.classList.add("leaving");
  flow.timer=setTimeout(function(){
   if(!flow.active||token!==flow.token||flow.phase!=="fading")return;
   overlay.classList.remove("on","leaving");overlay.hidden=true;
   document.getElementById("roomPrestart").hidden=true;
   var selectionSeconds=flow.loadoutSeconds;
   flow.active=false;flow.phase="idle";flow.timer=0;flow.config=null;flow.loadoutSeconds=0;
   mt.cd=0;document.getElementById("rsp").textContent="";
   run=true;loadoutBeginLiveWindow(selectionSeconds);
  },550);
 },600);
}
function roomLaunch(){
 if(roomStartFlow.active||roomModalActive())return;
 var room=roomSaveLocal();if(!room)return;
 var flow=roomStartFlow;flow.active=true;flow.phase="countdown";flow.token++;
 flow.team=roomSide;flow.config=Object.assign({},room);
 flow.deadline=performance.now()+ROOM_START_COUNTDOWN*1000;
 document.getElementById("roomPrestartNumber").textContent=String(ROOM_START_COUNTDOWN);
 document.getElementById("roomPrestart").hidden=false;
 var token=flow.token;
 flow.raf=requestAnimationFrame(function(now){roomStartCountdown(now,token);});
}

function roomMatchSeconds(){return roomMatchConfig&&roomMatchConfig.mode===0?roomMatchConfig.minutes*60:60;}
function roomKillLimit(){return roomMatchConfig&&roomMatchConfig.mode===0?roomMatchConfig.kills:0;}
function roomReachedKillLimit(){var n=roomKillLimit();return !!(n>0&&(ts[0]>=n||ts[1]>=n));}
function roomRoundLimit(){return roomMatchConfig&&roomMatchConfig.mode===1?roomMatchConfig.rounds:BOMB_RULES.rounds;}
function roomRoundSeconds(){return roomMatchConfig&&roomMatchConfig.mode===1?roomMatchConfig.roundMinutes*60:BOMB_RULES.roundSeconds;}
function roomRoundsToWin(){return roomMatchConfig&&roomMatchConfig.mode===1?Math.floor(roomRoundLimit()/2)+1:BOMB_RULES.wins;}
function roomLobbyOpen(){
 roomModalHide(false);
 var browserOverlay=document.getElementById("roomCreateOverlay");
 if(browserOverlay)browserOverlay.hidden=true;
 roomLoad();roomRender();
 if(roomCurrent){var found=roomList.find(function(r){return r.id===roomCurrent.id;});if(found){roomLiveOpen(found);return;}roomEditState(null);}
 else {
  // Block District remains the real animated lobby background, not a stock image.
  // Mode/map changes inside the Create popup still use the existing authoritative previews.
  roomDraftMode=0;roomDraftMapId="block-district";roomEditState(null);
 }
 roomSetMessage("");
 lobP("lbrooms");
 if(typeof inventoryBrowserPreviewOpen==="function")inventoryBrowserPreviewOpen();
}
// The browser's full Create Room form is presented in a modal without cloning inputs,
// validation, map options, mode switches or the original Room Master launch flow.
function roomBrowserCreateClose(){
 var overlay=document.getElementById("roomCreateOverlay");if(!overlay||overlay.hidden)return;
 overlay.hidden=true;
 selM=0;selectedTdmMapId="block-district";modePreviewSelect(0);
 var trigger=document.getElementById("roomCreateOpen");
 if(trigger&&typeof trigger.focus==="function")trigger.focus();
}
document.getElementById("roomCreateOpen").addEventListener("click",function(){
 if(roomCurrent)return;
 var overlay=document.getElementById("roomCreateOverlay");
 overlay.hidden=false;
 roomModeSelect(roomDraftMode);
 var name=document.getElementById("roomName");if(name&&typeof name.focus==="function")name.focus();
});
document.getElementById("roomCreateCancel").addEventListener("click",roomBrowserCreateClose);
document.addEventListener("keydown",function(event){
 var overlay=document.getElementById("roomCreateOverlay");
 if(event.key==="Escape"&&overlay&&!overlay.hidden&&document.getElementById("lbrooms").classList.contains("on")){
  if(typeof event.preventDefault==="function")event.preventDefault();
  roomBrowserCreateClose();
 }
});
document.getElementById("roomBack").addEventListener("click",function(){if(roomCurrent)roomLiveOpen(roomCurrent);else lobP("lbs");});
document.getElementById("roomRefresh").addEventListener("click",function(){roomLoad();roomRender();roomSetMessage("Local room list refreshed.");});
document.getElementById("roomTdm").addEventListener("click",function(){roomModeSelect(0);});
document.getElementById("roomBomb").addEventListener("click",function(){roomModeSelect(1);});
document.getElementById("roomMap").addEventListener("change",function(){roomChooseMap(this.value);});
document.getElementById("roomModalMap").addEventListener("change",function(){roomModalChooseMap(this.value);});
document.getElementById("roomCreate").addEventListener("click",roomCreateLocal);
document.getElementById("roomSave").addEventListener("click",function(){var saved=roomSaveLocal();if(saved){roomLiveLog("Room settings updated.");roomLiveOpen(saved);}});
document.getElementById("roomClose").addEventListener("click",roomCloseLocal);
document.getElementById("roomStart").addEventListener("click",roomLaunch);

document.getElementById("rmlSettings").addEventListener("click",roomShowSettings);
document.getElementById("roomModalCancel").addEventListener("click",function(){roomModalHide(true);});
document.getElementById("roomModalSave").addEventListener("click",roomModalSave);
document.getElementById("roomModalTdm").addEventListener("click",function(){roomModalChooseMode(0);});
document.getElementById("roomModalBomb").addEventListener("click",function(){roomModalChooseMode(1);});
["kills","minutes","rounds","roundMinutes"].forEach(function(key){
 var id="roomModal"+key.charAt(0).toUpperCase()+key.slice(1);
 document.getElementById(id).addEventListener("change",function(){roomModalSelect(key,this.value);});
});
document.getElementById("roomSettingsModal").addEventListener("click",function(e){
 if(e.target===this)roomModalHide(true);
});
document.addEventListener("keydown",function(e){
 if(!roomModalActive())return;
 if(e.key==="Escape"){e.preventDefault();roomModalHide(true);return;}
 if(e.key!=="Tab")return;
 var elements=Array.prototype.filter.call(
  document.getElementById("roomSettingsModal").querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled)"),
  function(el){return !el.closest("[hidden]");}
 );
 if(!elements.length)return;
 var first=elements[0],last=elements[elements.length-1];
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
 else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
});
document.getElementById("rmlLeave").addEventListener("click",roomLeaveLive);
document.getElementById("rmlStart").addEventListener("click",roomLaunch);
addEventListener("pagehide",function(){roomStartAbort();if(roomCurrent)roomCloseLocal();});
// Live mode-map video reuses the same WebGL canvas as the 3D lobby.
// Capture a center-cropped 2D frame at up to 30 FPS while SELECT MODE is open, on desktop and touch.
var mapPreviewCanvas=document.getElementById("mapPreviewCanvas"),
    mapPreviewCtx=mapPreviewCanvas.getContext("2d",{alpha:false}),
    mapPreviewSceneBomb=false,mapPreviewMapId="lockdown",mapPreviewTdmId="block-district",mapPreviewLastFrame=-1e9,mapPreviewFrameMs=1000/30;
function modePreviewSelect(i){
 if(!lob||run)return;
 var bomb=i===1;
 if(mapPreviewSceneBomb!==bomb||bomb&&mapPreviewMapId!==selectedBombMapId||!bomb&&mapPreviewTdmId!==selectedTdmMapId){selectGameMap(bomb);mapPreviewSceneBomb=bomb;mapPreviewMapId=selectedBombMapId;mapPreviewTdmId=selectedTdmMapId;}
 mapPreviewLastFrame=-1e9;
 mapPreviewCtx.clearRect(0,0,mapPreviewCanvas.width,mapPreviewCanvas.height);
}
function modePreviewDraw(now){
 if(!lob||run||document.hidden||selM===2)return;
 var inMode=document.getElementById("lbm").classList.contains("on"),
     inRoom=document.getElementById("lbrooms").classList.contains("on"),
     inLive=document.getElementById("lbroomlive").classList.contains("on");
 if(!inMode&&!inRoom&&!inLive)return;
 if(now-mapPreviewLastFrame<mapPreviewFrameMs)return;
 var src=R.domElement,sw=src.width,sh=src.height,dw=mapPreviewCanvas.width,dh=mapPreviewCanvas.height;
 if(!sw||!sh)return;
 mapPreviewLastFrame=now;
 var ratio=dw/dh,ww=Math.min(sw,sh*ratio),hh=Math.min(sh,sw/ratio);
 if(inMode)mapPreviewCtx.drawImage(src,(sw-ww)/2,(sh-hh)/2,ww,hh,0,0,dw,dh);
 if(inRoom||inLive){var c=document.getElementById(inLive?"rmlMapPreview":"roomMapPreview"),ctx=c.getContext("2d",{alpha:false});
   ctx.drawImage(src,(sw-ww)/2,(sh-hh)/2,ww,hh,0,0,c.width,c.height);
   if(inLive&&!document.getElementById("roomSettingsModal").hidden){
    var modalCanvas=document.getElementById("roomModalMapPreview"),modalCtx=modalCanvas.getContext("2d",{alpha:false});
    modalCtx.drawImage(src,(sw-ww)/2,(sh-hh)/2,ww,hh,0,0,modalCanvas.width,modalCanvas.height);
   }
 }
 // Only read WebGL pixels synchronously after this frame's R.render().
 if(inLive&&roomStartFlow.active&&roomStartFlow.phase==="loading")roomStartCaptureMap();
}
// M1 BOT perception: evidence-only sight, acoustic cues and bounded team radio.
// Never expose hidden live enemy objects via tactical goal helpers.
var BOT_SENSE=Object.freeze({
 sightRange:45,memorySeconds:3.6,radioSeconds:2.4,
 radioInterval:.35,footstepRange:17,gunshotRange:37,
 soundSeconds:1.35,maxSounds:28,hearingCooldown:.45,
 auditoryUncertainty:2.4
});
var botSoundEvents=[],botTeamReports=[null,null];
function botIntelReset(){
 botSoundEvents.length=0;botTeamReports=[null,null];
 // Also clear per-life evidence when a match/round is rebuilt.
 if(typeof en!=='undefined'&&en)en.forEach(function(e){
  if(e){e.lastSeen=null;e.heard=null;e.tg=null;e.lok=false;}
 });
}
function botIntelVisible(e,foe){
 return !!(e&&foe&&e!==foe&&!e.dead&&!foe.dead&&e.tm!==foe.tm&&
  Math.hypot(foe.x-e.x,foe.z-e.z)<=BOT_SENSE.sightRange&&
  los(e.x,e.z,foe.x,foe.z));
}
function botIntelObserve(e,foe){
 if(!botIntelVisible(e,foe))return false;
 // Capture coordinates at observation time; do not retain enemy object pointers.
 var report={x:foe.x,z:foe.z,seenAt:tt,until:tt+BOT_SENSE.memorySeconds,
  source:'sight',team:e.tm,observer:e.idx};
 e.lastSeen=report;
 var old=botTeamReports[e.tm];
 if(!old||old.until<=tt||tt-old.seenAt>=BOT_SENSE.radioInterval||
    Math.hypot(old.x-report.x,old.z-report.z)>2){
  botTeamReports[e.tm]={x:report.x,z:report.z,seenAt:tt,
   until:tt+BOT_SENSE.radioSeconds,source:'radio',team:e.tm,observer:e.idx};
 }
 return true;
}
function botIntelAcquire(e){
 var target=null,best=Infinity;
 en.forEach(function(o){if(botIntelVisible(e,o)){
  var d=Math.hypot(o.x-e.x,o.z-e.z);if(d<best){best=d;target=o;}
 }});
 if(!pl.dead&&botIntelVisible(e,pl)){
  var dist=Math.hypot(pl.x-e.x,pl.z-e.z);
  if(dist<best)target=pl;
 }
 if(target)botIntelObserve(e,target);
 return target;
}
function botSoundEmit(actor,kind){
 if(!actor||actor.dead||!run||lob||mt.over||mt.cd>0||
    (kind!=='footstep'&&kind!=='gunshot'))return;
 // Only auditory evidence: no actor reference, identity, HP, target or enemy pointer.
 var item={x:actor.x,z:actor.z,at:tt,until:tt+BOT_SENSE.soundSeconds,
  kind:kind,team:actor.tm};
 botSoundEvents.push(item);
 if(botSoundEvents.length>BOT_SENSE.maxSounds)botSoundEvents.shift();
}
function botIntelHearing(e){
 if(!e||e.dead)return null;
 var current=e.heard,nearest=null,weight=Infinity;
 for(var i=botSoundEvents.length-1;i>=0;i--){
  var a=botSoundEvents[i];
  if(a.until<=tt)continue;
  // Ignore allied sounds; team membership can be inferred from known squad roster,
  // but never expose which individual produced an enemy noise.
  if(a.team===e.tm)continue;
  var d=Math.hypot(e.x-a.x,e.z-a.z),max=a.kind==='gunshot'?
    BOT_SENSE.gunshotRange:BOT_SENSE.footstepRange;
  // Walls attenuate hearing but never create perfect visual intel.
  if(d>max||d>max*(los(e.x,e.z,a.x,a.z)?1:.6))continue;
  var score=d+(tt-a.at)*3;
  if(score<weight){weight=score;nearest=a;}
 }
 if(nearest&&(!current||current.until<=tt||nearest.at>current.heardAt)){
  // Coarse-grid localization is intentionally not exact (no through-wall tracking).
  var grid=BOT_SENSE.auditoryUncertainty;
  e.heard={x:Math.round(nearest.x/grid)*grid,
   z:Math.round(nearest.z/grid)*grid,heardAt:nearest.at,
   until:Math.min(nearest.until,tt+BOT_SENSE.soundSeconds),
   source:'sound',kind:nearest.kind};
 }
 return e.heard&&e.heard.until>tt?e.heard:null;
}
function botIntelKnown(e){
 if(!e||e.dead)return null;
 var own=e.lastSeen&&e.lastSeen.until>tt?e.lastSeen:null,
     team=botTeamReports[e.tm],shared=team&&team.until>tt?team:null;
 // Hearing cannot replace a fresh, confirmed sighting or become a shootable target.
 return own||shared||(e.heard&&e.heard.until>tt?e.heard:null);
}
function botIntelNearest(e,x,z,radius){
 if(!e||e.dead)return null;
 // Evidence is immutable positional snapshots. It must never be a live enemy actor.
 var own=e.lastSeen&&e.lastSeen.until>tt?e.lastSeen:null,
     shared=botTeamReports[e.tm],radio=shared&&shared.until>tt?shared:null,
     sound=e.heard&&e.heard.until>tt?e.heard:null,
     best=null,distance=radius;
 [own,radio,sound].forEach(function(q){
  if(!q)return;
  var d=Math.hypot(q.x-x,q.z-z);
  if(d<distance){best=q;distance=d;}
 });
 return best;
}
// M3 movement tactics: bounded cover, legal last-seen peeks, dodge and obstacle recovery.
// Uses existing A* (gPath), solid geometry (inObs), canonical resolve(), and M1 clues.
// Does not teleport or inspect hidden enemy actor positions.
var BOT_MOVE=Object.freeze({
 coverTriggerHP:70,coverRetry:2.8,coverTravel:3.6,holdSeconds:.38,
 peekTravel:2.3,peekRetry:2.1,peekOffsets:[1.9,3.1,4.3],
 dodgeWindow:.32,dodgeCooldown:1.4,dodgeStrength:.85,
 velocityBlend:9,probeSeconds:.32,probeRadius:.62,
 stuckAfter:.52,recoverSeconds:.55,recoverCooldown:1.05,
 maxStallCycles:3
});
function botMoveReset(e){
 e.m3Mode=null;e.m3Goal=null;e.m3Expires=0;e.m3RetryAt=0;
 e.m3DodgeUntil=0;e.m3DodgeAt=0;e.m3DodgeSide=0;
 e.m3RecoverUntil=0;e.m3RecoverAt=0;e.m3RecoverSide=0;
 e.m3StallCycles=0;e.m3VX=0;e.m3VZ=0;
}
function botMoveUrgent(e){
 // No new peek/cover maneuver may prevent planting, defusing or urgent retake.
 return !!(e.bAction||(isBombMode()&&bombMatch&&!bombMatch.done&&
  (bombMatch.state==='planted'&&e.tm===0||
   bombMatch.state==='idle'&&bombMatch.carrier===e)));
}
function botMoveReachable(e,x,z){
 if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>A-1.5||
    Math.abs(z)>A-1.5||inObs(x,z,.72))return false;
 var p=gPath(e.x,e.z,x,z);
 return !!(p&&p.length);
}
function botMovePeek(e,clue){
 if(!clue||clue.until<=tt)return null;
 var dx=clue.x-e.x,dz=clue.z-e.z,dist=Math.hypot(dx,dz);
 if(dist<1||dist>BOT_TACTICS.threatRange*1.5)return null;
 // Sample lateral edges from the last AUTHORIZED observed position only.
 var sideX=dz/dist,sideZ=-dx/dist,candidates=[];
 for(var i=0;i<BOT_MOVE.peekOffsets.length;i++)
 for(var sign=-1;sign<=1;sign+=2){
  var offset=BOT_MOVE.peekOffsets[i]*sign,
      x=e.x+sideX*offset,z=e.z+sideZ*offset;
  if(Math.abs(x)>A-1.5||Math.abs(z)>A-1.5||
     inObs(x,z,.72)||!los(x,z,clue.x,clue.z))continue;
  var score=Math.abs(offset)*1.2;
  for(var j=0;j<en.length;j++){
   var ally=en[j];
   if(ally!==e&&!ally.dead&&ally.tm===e.tm&&
      Math.hypot(x-ally.x,z-ally.z)<1.8)score+=6;
  }
  candidates.push({x:x,z:z,score:score});
 }
 candidates.sort(function(a,b){return a.score-b.score;});
 // Bound A* cost on crowded 5v5 scenes.
 for(var n=0;n<Math.min(2,candidates.length);n++){
  var c=candidates[n];
  if(botMoveReachable(e,c.x,c.z))return [c.x,c.z];
 }
 return null;
}
function botMoveIntent(e,t,intent){
 if(e.dead||botMoveUrgent(e)||intent.retreat){
  e.m3Mode=null;e.m3Goal=null;return;
 }
 if(e.m3Mode&&e.m3Mode!=='hold'&&tt>(e.m3Expires||0)){
  e.m3Mode=null;e.m3Goal=null;e.m3RetryAt=Math.max(e.m3RetryAt||0,tt+.7);
 }
 if(e.m3Mode==='cover'&&e.m3Goal){
  if(Math.hypot(e.x-e.m3Goal[0],e.z-e.m3Goal[1])<1.15){
   e.m3Mode='hold';e.m3Expires=tt+BOT_MOVE.holdSeconds;
   e.m3Goal=null;
  }else{
   intent.goal=e.m3Goal;return;
  }
 }
 if(e.m3Mode==='hold'){
  if(tt<e.m3Expires){intent.hold=true;return;}
  e.m3Mode='peeking';e.m3Goal=null;e.m3Expires=tt+BOT_MOVE.peekTravel;
 }
 if(e.m3Mode==='peeking'){
  if(t){e.m3Mode=null;e.m3Goal=null;return;} // resume combat on fresh sight
  if(!e.m3Goal){
   var clue=botIntelKnown(e);
   e.m3Goal=botMovePeek(e,clue);
   if(!e.m3Goal){e.m3Mode=null;e.m3RetryAt=tt+BOT_MOVE.peekRetry;return;}
  }
  if(Math.hypot(e.x-e.m3Goal[0],e.z-e.m3Goal[1])<.9){
   e.m3Mode=null;e.m3Goal=null;e.m3RetryAt=tt+BOT_MOVE.peekRetry;
  }else{intent.goal=e.m3Goal;return;}
 }
 if(!t||!botIntelVisible(e,t)||tt<(e.m3RetryAt||0)||
    e.hp<=BOT_TACTICS.criticalHP)return;
 // Only under actual recent damage; do not become passive in every engagement.
 if(e.fl>.035&&e.hp<BOT_MOVE.coverTriggerHP){
  e.m3RetryAt=tt+BOT_MOVE.coverRetry;
  var cover=botSmartCover(e,t);
  if(cover&&botMoveReachable(e,cover[0],cover[1])){
   e.m3Goal=[cover[0],cover[1]];
   e.m3Mode='cover';e.m3Expires=tt+BOT_MOVE.coverTravel;
   intent.goal=e.m3Goal;
  }
 }
}
function botMoveDodge(e,t,dt,fw,strafe){
 if(!t||!botIntelVisible(e,t)||botMoveUrgent(e)||
    e.hp<=BOT_TACTICS.criticalHP)return [fw,strafe];
 if(e.fl>.025&&tt>=(e.m3DodgeAt||0)){
  e.m3DodgeAt=tt+BOT_MOVE.dodgeCooldown;
  e.m3DodgeUntil=tt+BOT_MOVE.dodgeWindow;
  e.m3DodgeSide=(e.idx%2===0?1:-1)*
    ((Math.floor(tt*2)%2)===0?1:-1);
 }
 if(tt<(e.m3DodgeUntil||0))
  strafe+=e.m3DodgeSide*BOT_MOVE.dodgeStrength;
 return [fw,strafe];
}
function botMoveIsClear(e,vx,vz,sp,dt){
 if(!vx&&!vz)return true;
 var length=Math.max(.22,sp*Math.min(BOT_MOVE.probeSeconds,dt*3)),
     x=e.x+vx*length,z=e.z+vz*length;
 return Math.abs(x)<A-.8&&Math.abs(z)<A-.8&&!inObs(x,z,BOT_MOVE.probeRadius);
}
function botMoveSteer(e,vx,vz,sp,dt,hold){
 if(hold){e.m3VX=e.m3VZ=0;return [0,0];}
 // Smooth decisions without modifying player movement or BOT max speed.
 var blend=Math.min(1,Math.max(0,dt)*BOT_MOVE.velocityBlend);
 e.m3VX=(e.m3VX||0)+(vx-(e.m3VX||0))*blend;
 e.m3VZ=(e.m3VZ||0)+(vz-(e.m3VZ||0))*blend;
 var norm=Math.hypot(e.m3VX,e.m3VZ);
 if(norm>1){e.m3VX/=norm;e.m3VZ/=norm;}
 vx=e.m3VX;vz=e.m3VZ;
 if(botMoveIsClear(e,vx,vz,sp,dt))return [vx,vz];
 // Slide along a legal axis. No manual position write or collision bypass.
 if(Math.abs(vx)>=Math.abs(vz)){
  if(botMoveIsClear(e,vx,0,sp,dt)){e.m3VZ=0;return [vx,0];}
  if(botMoveIsClear(e,0,vz,sp,dt)){e.m3VX=0;return [0,vz];}
 }else{
  if(botMoveIsClear(e,0,vz,sp,dt)){e.m3VX=0;return [0,vz];}
  if(botMoveIsClear(e,vx,0,sp,dt)){e.m3VZ=0;return [vx,0];}
 }
 e.m3VX=e.m3VZ=0;
 return [0,0];
}
function botMoveTrack(e,ox,oz,dt,sp,wanted,combat){
 if(!wanted){e.stk=0;e.m3StallCycles=0;return;}
 var moved=Math.hypot(e.x-ox,e.z-oz);
 if(moved>=Math.max(.003,sp*dt*.22)){
  e.stk=0;e.m3StallCycles=0;return;
 }
 e.stk=(e.stk||0)+dt;
 if(e.stk<BOT_MOVE.stuckAfter||tt<(e.m3RecoverAt||0))return;
 e.stk=0;e.m3StallCycles=Math.min(BOT_MOVE.maxStallCycles,
    (e.m3StallCycles||0)+1);
 e.m3RecoverAt=tt+BOT_MOVE.recoverCooldown;
 e.m3RecoverUntil=tt+BOT_MOVE.recoverSeconds;
 e.m3RecoverSide=((e.idx+e.m3StallCycles)%2)?1:-1;
 e.pt=0;e.navT=combat?.55:0;
 if(e.m3StallCycles>=BOT_MOVE.maxStallCycles){
  e.m3Mode=null;e.m3Goal=null;e.m3RetryAt=tt+BOT_MOVE.coverRetry;
 }
}
function botMoveRecovery(e,vx,vz,sp,dt,hold){
 if(hold||tt>=(e.m3RecoverUntil||0))return [vx,vz];
 var side=e.m3RecoverSide||1;
 var sx=-vz*side,sz=vx*side;
 if(Math.hypot(sx,sz)<.1){
  sx=side;sz=0;
 }
 var n=Math.hypot(sx,sz)||1;
 sx/=n;sz/=n;
 if(botMoveIsClear(e,sx,sz,sp,dt))
  return [sx*.75,sz*.75];
 if(botMoveIsClear(e,-sx,-sz,sp,dt))
  return [-sx*.75,-sz*.75];
 return [0,0];
}
// M4 — deterministic squad roles, legitimate shared-contact flank lanes and bounded entry synchronization.
// All enemy coordinates originate only from M1 timestamped, same-team sight/radio snapshots.
// No hidden enemy scan, forced hits, direct-wall movement or Bomb objective overrides.
var BOT_SQUAD=Object.freeze({
 thinkSeconds:1.05,goalSeconds:2.0,flankRadius:5.5,supportRadius:4.2,
 goalReach:1.3,contactRange:33,allyGoalSpacing:2.0,
 laneRadius:2.35,laneStrength:.26,
 entryWaitMax:.34,entryNearMin:5,entryNearMax:13
});
function botSquadReset(e){
 e.squadRole=null;e.squadGoal=null;e.squadUntil=0;
 e.squadRetryAt=0;e.squadReportAt=-1;
 e.squadEntryWaitUntil=0;e.squadEntryCooldownUntil=0;
}
function botSquadRoster(team){
 // This roster reveals only friendly public positions and survival, no enemy identity.
 return en.filter(function(o){return o&&!o.dead&&o.tm===team;})
   .sort(function(a,b){return a.idx-b.idx;});
}
function botSquadRole(e){
 var allies=botSquadRoster(e.tm),rank=allies.indexOf(e);
 if(rank<0)return null;
 return ['entry','flank-left','flank-right','support'][rank%4];
}
function botSquadReport(e){
 var r=botTeamReports[e.tm];
 // M1 alone owns this report. Team, source and expiry are mandatory, not inferred.
 if(!r||r.team!==e.tm||r.source!=='radio'||r.until<=tt||
    !Number.isFinite(r.x)||!Number.isFinite(r.z)||!Number.isFinite(r.seenAt))
   return null;
 return r;
}
function botSquadCanFlank(e){
 if(isBombMode()){
  // Bomb authority remains in bombTacticalGoal: planted defense, escort,
  // recovery, carrier, retake and defuse are not overwritten by a squad move.
  return false;
 }
 return true;
}
function botSquadFlankPoint(e,role,r){
 var dx=r.x-e.x,dz=r.z-e.z,dist=Math.hypot(dx,dz);
 if(dist<2||dist>BOT_SQUAD.contactRange)return null;
 var ux=dx/dist,uz=dz/dist,lx=uz,lz=-ux,
     x,z;
 if(role==='flank-left'){
  x=r.x+lx*BOT_SQUAD.flankRadius-ux*2.2;
  z=r.z+lz*BOT_SQUAD.flankRadius-uz*2.2;
 }else if(role==='flank-right'){
  x=r.x-lx*BOT_SQUAD.flankRadius-ux*2.2;
  z=r.z-lz*BOT_SQUAD.flankRadius-uz*2.2;
 }else if(role==='support'){
  x=r.x-ux*BOT_SQUAD.supportRadius;
  z=r.z-uz*BOT_SQUAD.supportRadius;
 }else return null;
 if(!Number.isFinite(x)||!Number.isFinite(z)||
    Math.abs(x)>=A-1.8||Math.abs(z)>=A-1.8||
    inObs(x,z,.72))return null;
 // Reserve separate safe lanes; never send different bots to one flank waypoint.
 for(var i=0;i<en.length;i++){
  var ally=en[i];
  if(ally===e||ally.dead||ally.tm!==e.tm||!ally.squadGoal||
     ally.squadUntil<=tt)continue;
  if(Math.hypot(x-ally.squadGoal[0],z-ally.squadGoal[1])<
       BOT_SQUAD.allyGoalSpacing)return null;
 }
 // Exactly one bounded A* check per fresh candidate, throttled by squadRetryAt.
 return botMoveReachable(e,x,z)?[x,z]:null;
}
function botSquadIntent(e,target,intent){
 if(!e||e.dead)return;
 e.squadRole=botSquadRole(e);
 if(!e.squadRole)return;
 if(target||intent.retreat||intent.hold||botMoveUrgent(e)||
    e.m3Mode||!botSquadCanFlank(e)){
  e.squadGoal=null;e.squadUntil=0;return;
 }
 var report=botSquadReport(e),allies=botSquadRoster(e.tm);
 if(!report||allies.length<2){
  e.squadGoal=null;e.squadUntil=0;e.squadEntryWaitUntil=0;return;
 }
 if(e.squadRole==='entry'){
  // Wait only once for a new authentic contact, and NEVER wait indefinitely.
  var dist=Math.hypot(report.x-e.x,report.z-e.z);
  if(tt>=(e.squadEntryCooldownUntil||0)&&allies.length>=3&&
     dist>BOT_SQUAD.entryNearMin&&dist<BOT_SQUAD.entryNearMax){
   e.squadEntryCooldownUntil=tt+4;
   e.squadEntryWaitUntil=Math.min(tt+BOT_SQUAD.entryWaitMax,report.until);
  }
  if(tt<e.squadEntryWaitUntil)intent.hold=true;
  return;
 }
 if(e.squadGoal&&e.squadUntil>tt&&
    Math.hypot(e.x-e.squadGoal[0],e.z-e.squadGoal[1])>BOT_SQUAD.goalReach&&
    Math.hypot(report.x-e.squadAnchorX,report.z-e.squadAnchorZ)<4){
  intent.goal=e.squadGoal;return;
 }
 if(tt<(e.squadRetryAt||0))return;
 e.squadRetryAt=tt+BOT_SQUAD.thinkSeconds;
 e.squadGoal=null;e.squadUntil=0;
 var goal=botSquadFlankPoint(e,e.squadRole,report);
 if(!goal)return; // Fallback to ordinary M1/M3 navigation, never freeze.
 e.squadGoal=goal;e.squadReportAt=report.seenAt;
 e.squadAnchorX=report.x;e.squadAnchorZ=report.z;
 e.squadUntil=Math.min(report.until,tt+BOT_SQUAD.goalSeconds);
 intent.goal=goal;
}
function botSquadLane(e,vx,vz){
 if(!e||e.dead||botMoveUrgent(e)||(!vx&&!vz))return[vx,vz];
 var len=Math.hypot(vx,vz),ux=vx/len,uz=vz/len,
     rx=0,rz=0,rank=botSquadRoster(e.tm).indexOf(e),side=rank%2?1:-1;
 if(rank<0)return[vx,vz];
 for(var i=0;i<en.length;i++){
  var ally=en[i];
  if(!ally||ally===e||ally.dead||ally.tm!==e.tm)continue;
  var dx=ally.x-e.x,dz=ally.z-e.z,d=Math.hypot(dx,dz);
  // Only divert if a friendly actually occupies the next forward lane.
  if(d>.2&&d<BOT_SQUAD.laneRadius&&(dx*ux+dz*uz)/d>.3){
   rx+=uz*side*BOT_SQUAD.laneStrength;
   rz-=ux*side*BOT_SQUAD.laneStrength;
  }
 }
 var ax=vx+rx,az=vz+rz,n=Math.hypot(ax,az);
 return n>1?[ax/n,az/n]:[ax,az];
}
// M6 — TDM-only situational threat scoring, class-driven engagement and fair patrol lanes.
// No change to weapons, aim dispersion, projectile damage, spawn points, or Bomb tactics.
var BOT_TDM=Object.freeze({
 thinkSeconds:3.8,maxPatrolChecks:3,spawnMargin:13,
 patrolFraction:.46,patrolLimit:24,patrolArrival:2.3,
 targetHysteresis:3.5,repositionRetry:3.5,searchRange:45,
 bands:Object.freeze({
  shotgun:Object.freeze({min:3.5,near:7,far:12}),
  smg:Object.freeze({min:5,near:10,far:18}),
  dual:Object.freeze({min:4,near:8,far:15}),
  rifle:Object.freeze({min:9,near:17,far:27}),
  sniper:Object.freeze({min:20,near:28,far:42}),
  pistol:Object.freeze({min:6,near:11,far:19})
 })
});
function botTdmReset(e){
 e.tdmRouteAt=0;e.tdmRouteIndex=0;e.tdmRouteGoal=null;
 e.tdmEngagementAt=0;e.tdmContactAt=0;
}
function botTdmWeaponKind(e){
 var weapon=WP[e.weapon]||WP[e.primary];
 return weapon&&weapon.stats&&weapon.stats.kind||'rifle';
}
function botTdmBand(e){
 return BOT_TDM.bands[botTdmWeaponKind(e)]||BOT_TDM.bands.rifle;
}
function botTdmScore(e,foe){
 if(!botIntelVisible(e,foe))return Infinity;
 var distance=Math.hypot(foe.x-e.x,foe.z-e.z),
     band=botTdmBand(e),
     score=distance;
 // A visible enemy with spawn protection is not a preferred target.
 if((foe.inv||0)>0)return Infinity;
 // A currently visible, wounded opponent is a sensible finishing target,
 // without revealing unknown enemy health to the squad.
 if(Number.isFinite(foe.hp)&&foe.hp>0&&foe.hp<40)score-=2;
 // Avoid keeping a shotgun BOT focused on an extreme-range target when an
 // equally visible closer threat exists. No fire-range/stat modification.
 if(distance>band.far)score+=(distance-band.far)*.45;
 // Minor hysteresis prevents instant target swapping in 5v5 encounters.
 if(e.tg===foe)score-=BOT_TDM.targetHysteresis;
 return score;
}
function botTdmAcquire(e){
 if(!e||e.dead||isBombMode())return null;
 var target=null,best=Infinity;
 function consider(o){
  if(!o||o===e||o.dead||o.tm===e.tm)return;
  var score=botTdmScore(e,o);
  if(Number.isFinite(score)&&score<best){best=score;target=o;}
 }
 en.forEach(consider);
 if(!pl.dead)consider(pl);
 // The only authorized target object is one that passes *live* M1 LOS.
 if(target)botIntelObserve(e,target);
 return target;
}
function botTdmCombatMove(e,d,fw,strafe){
 if(isBombMode()||e.dead||e.hp<=BOT_TACTICS.criticalHP||
    e.smartRetreat||botNeedsMelee(e))return [fw,strafe];
 var band=botTdmBand(e);
 if(d>band.far)fw=1.08;
 else if(d>band.near)fw=.55;
 else if(d<band.min)fw=-.85;
 else fw=Math.max(-.22,Math.min(.24,fw));
 // No movement-speed modification. M3 handles genuine dodge/collision.
 return [fw,strafe];
}
function botTdmPatrolGoal(e){
 if(!e||e.dead||isBombMode())return null;
 var lim=Math.min(BOT_TDM.patrolLimit,Math.max(6,A*BOT_TDM.patrolFraction)),
     side=(e.tm?1:-1),rank=e.idx||0,
     anchors=[[-.8,-.4],[-.3,.7],[.5,-.55],[.9,.4],
       [0,0],[.4,.85],[-.65,.35],[.65,-.15]],
     start=(rank*3+(e.tdmRouteIndex||0))%anchors.length;
 // Anchors stay in central map-control area, outside opponent spawn band
 // (the canonical TDM spawn center is z=+/-38, +/-10 drift).
 for(var i=0;i<BOT_TDM.maxPatrolChecks;i++){
  var a=anchors[(start+i)%anchors.length],
      x=a[0]*lim,z=a[1]*lim*side;
  if(!Number.isFinite(x)||!Number.isFinite(z)||
     Math.abs(x)>A-2||Math.abs(z)>A-2||
     Math.abs(z)>38-BOT_TDM.spawnMargin||inObs(x,z,.72))continue;
  if(botMoveReachable(e,x,z))return [x,z];
 }
 return null;
}
function botTdmPatrol(e){
 if(!e||e.dead||isBombMode())return;
 var fresh=botIntelKnown(e);
 // Valid M1 vision/radio/audio reports are always handled first.
 if(fresh&&fresh.until>tt){e.tdmRouteGoal=null;return;}
 if(!e.tdmRouteGoal&&tt<(e.tdmRouteAt||0))return;
 if(e.tdmRouteGoal&&tt<(e.tdmRouteAt||0)&&
    Math.hypot(e.x-e.tdmRouteGoal[0],e.z-e.tdmRouteGoal[1])>
      BOT_TDM.patrolArrival){
  e.wx=e.tdmRouteGoal[0];e.wz=e.tdmRouteGoal[1];return;
 }
 // One bounded planning pass per route, never every animation frame.
 e.tdmRouteAt=tt+BOT_TDM.thinkSeconds;
 e.tdmRouteIndex=(e.tdmRouteIndex||0)+1;
 var goal=botTdmPatrolGoal(e);
 if(!goal){
  // A dead-end patrol must not keep chasing an expired M1 contact.
  e.tdmRouteGoal=null;e.wx=e.x;e.wz=e.z;return;
 }
 e.tdmRouteGoal=goal;e.wx=goal[0];e.wz=goal[1];
}
// Five-star BOT decision layer: uses existing A* navigation, LOS, HP,
// canonical weapon ammo, and Bomb Mission objectives. No duplicate combat engine.
var BOT_TACTICS=Object.freeze({
 difficulty:5,thinkInterval:.7,memorySeconds:3.6,criticalHP:34,cautionHP:60,
 coverRadii:[3.5,6,9,12],coverSamples:12,coverHold:1.3,
 retreatSpeed:1.22,approachSpeed:1.2,fightSpeed:.94,
 proactiveReloadFraction:.28,threatRange:24,coverRecheck:1.6
});
function botSmartSight(e,t){return botIntelVisible(e,t);}
function botSmartRemember(e,t){return botIntelObserve(e,t);}
function botSmartCover(e,threat){
 if(!threat||!GB)return null;
 var saved=e.coverGoal,stable=Math.hypot((e.coverThreatX||0)-threat.x,(e.coverThreatZ||0)-threat.z)<4;
 // Cache negative lookups as well; otherwise nine bots can rescan cover every frame
 // on an open map where no LOS-blocking geometry exists.
 if(tt<(e.coverExpires||0)&&stable)return saved||null;
 var opts=[],radii=BOT_TACTICS.coverRadii,heading=Math.atan2(e.z-threat.z,e.x-threat.x),limit=A-2;
 for(var r=0;r<radii.length;r++)for(var i=0;i<BOT_TACTICS.coverSamples;i++){
  var angle=heading+(i/BOT_TACTICS.coverSamples-.5)*Math.PI*1.7,
      x=e.x+Math.cos(angle)*radii[r],z=e.z+Math.sin(angle)*radii[r];
  if(Math.abs(x)>limit||Math.abs(z)>limit||inObs(x,z,.7)||los(x,z,threat.x,threat.z))continue;
  var score=radii[r]+Math.hypot(x-e.x,z-e.z)*.15;
  for(var j=0;j<en.length;j++){
   var ally=en[j];if(ally!==e&&!ally.dead&&ally.tm===e.tm&&Math.hypot(x-ally.x,z-ally.z)<2.5)score+=7;
  }
  opts.push({x:x,z:z,score:score});
 }
 opts.sort(function(a,b){return a.score-b.score;});
 for(var n=0;n<Math.min(3,opts.length);n++){
  var c=opts[n],path=gPath(e.x,e.z,c.x,c.z);
  if(!path||!path.length)continue;
  e.coverGoal=[c.x,c.z];e.coverExpires=tt+BOT_TACTICS.coverRecheck;
  e.coverThreatX=threat.x;e.coverThreatZ=threat.z;return e.coverGoal;
 }
 e.coverGoal=null;e.coverExpires=tt+.8;e.coverThreatX=threat.x;e.coverThreatZ=threat.z;return null;
}
function botSmartIntent(e,target){
 var out={retreat:false,goal:null,hold:false},last=botIntelKnown(e),
     threat=target||(last&&last.until>tt?last:null),
     distance=threat?Math.hypot(threat.x-e.x,threat.z-e.z):Infinity,
     critical=e.hp<=BOT_TACTICS.criticalHP,reloading=e.reloadId!==null,
     urgent=isBombMode()&&bombMatch&&!bombMatch.done&&
       (e.bAction||bombMatch.state==='planted'&&e.tm===0&&bombMatch.defuser===e);
 if(threat&&distance<BOT_TACTICS.threatRange&&(critical||reloading)&&!urgent){
  out.retreat=true;out.goal=botSmartCover(e,threat);
  if(out.goal&&Math.hypot(out.goal[0]-e.x,out.goal[1]-e.z)<1.5){
    out.hold=true;e.coverHoldUntil=tt+BOT_TACTICS.coverHold;
  }
 }else if((e.coverHoldUntil||0)>tt&&!urgent&&!target)out.hold=true;
 if(!out.goal&&!target&&!isBombMode()&&last&&last.until>tt&&!critical)
   out.goal=[last.x,last.z];
 return out;
}
function botSmartVelocity(e,d,fw,strafe){
 if(e.hp<=BOT_TACTICS.criticalHP){fw=-1.05;strafe*=1.35;}
 else if(e.hp<BOT_TACTICS.cautionHP&&d<12)fw=-.75;
 else if(!isBombMode()&&d>11)fw=1.15;
 return[fw,strafe];
}
function botSmartReload(e,target){
 if(e.reloadId!==null||!e.ammo)return;
 var p=e.ammo[e.primary],s=e.ammo[BOT_WEAPONS.sidearm],w=WP[e.primary],
     close=target&&botSmartSight(e,target)&&Math.hypot(target.x-e.x,target.z-e.z)<BOT_TACTICS.threatRange;
 if(p&&p.res>0&&p.mag<w.mag&&
    (p.mag===0||(!close&&p.mag<=Math.max(1,Math.floor(w.mag*BOT_TACTICS.proactiveReloadFraction))))){
  if(botStartReload(e,e.primary)&&close&&s&&s.mag>0){e.weapon=BOT_WEAPONS.sidearm;botVisualWeapon(e,e.weapon);}
 }else if(s&&s.res>0&&s.mag===0&&(!close||!p||p.mag<=0))botStartReload(e,BOT_WEAPONS.sidearm);
}
function botSmartGrenadeSafe(e,target){
 if(!botSmartSight(e,target))return false;
 return !en.concat(pl.dead?[]:[pl]).some(function(a){
  return a!==e&&!a.dead&&a.tm===e.tm&&Math.hypot(a.x-target.x,a.z-target.z)<4.5;
 });
}
// ---- OVERLAY / MENUS ----
// overlay
var ov=document.getElementById("ov"),ovt=document.getElementById("ovt");
// show(): shows the generic overlay card (title, body html, button label).
function show(h,b,btn){document.querySelector("#card h1").textContent=h;ovt.innerHTML=b;document.getElementById("go").textContent=btn;ov.style.display="flex";}
show("Point Block FPS",'<p>Survive the terrorist assault. There are no drops in this mode: no weapons, ammo or medkits fall from the sky, so every fight is decided by aim.</p><p>'+
 (touch?"Left joystick to move, right joystick to look around. The Shoot, Jump, and Reload buttons are on the right.":"WASD to move, Space to jump, mouse to look around (click the screen first to lock the mouse, or hold left click and drag), left click or F to shoot, R to reload, hold Shift to sprint, hold right click to aim down sights. Press V to switch the Kriss between single and dual. With the AWP, right click once to scope and again to unscope. Choose your primary weapon with the mouse, confirm it, or wait for auto-deploy.")+
 '</p><p>Your weapon and ammo come from the primary weapon you pick at the start. You get full ammo again after every respawn.</p>',"Start");
document.getElementById("go").onclick=function(){this.blur();reset();ov.style.display="none";run=true;};
// Lobby (mode select screen). lobBest() reads the best score from localStorage key "bbfps_best" (try/catch).
var lb=document.getElementById("lb");
function lobBest(){var b=0;try{b=+localStorage.getItem("bbfps_best")||0;}catch(e){}var el=document.getElementById("lbbest");if(el)el.textContent=b;}
function lobP(id){
 if(id==="lbs"&&roomCurrent)roomCloseLocal();
 ["lbs","lbm","lbrooms","lbroomlive","lbiv","lbshop"].forEach(function(i){
  document.getElementById(i).classList.toggle("on",i===id);
 });
 var header=document.getElementById("gameLobbyHeader"),activePanel=document.getElementById(id);
 if(header)header.hidden=!(activePanel&&activePanel.hasAttribute("data-shared-header"));
 if(id==="lbs"){
  lobBest();
  // The main menu cinematic is ALWAYS the authentic Block District world,
  // even after visiting Hospital, Block Town or the indoor Deathmatch map.
  if(lob&&!run){
   selectedTdmMapId="block-district";selectGameMap(false);
   mapPreviewSceneBomb=false;mapPreviewTdmId="block-district";
  }
 }
 document.getElementById("lbn").classList.remove("on");
 homeShowcaseSync();
}
lobBest();
(function(){var n=document.getElementById("lbn"),nt=document.getElementById("lbnt"),tm=0;[].forEach.call(document.querySelectorAll(".mb[data-n]"),function(b){b.onclick=function(){this.blur();nt.textContent=this.getAttribute("data-n");n.classList.remove("on","shk");void n.offsetWidth;n.classList.add("on","shk");clearTimeout(tm);tm=setTimeout(function(){n.classList.remove("on");},2800);};});})();
// MODES: lobby cards. Only TEAM DEATH MATCH is playable (lock:0). BOMB MODE and BATTLEGROUND are "coming soon" placeholders (lock:1).
var MODES=[
 {n:"TEAM DEATH MATCH",tg:"5 VS 5 \u00b7 POLICE vs TERRORIST",st:"AVAILABLE",bt:"PLAY NOW",lock:0,df:BOT_TACTICS.difficulty,
  d:"Police against Terrorists, 5 vs 5. You fight with 4 AI teammates against 5 AI enemies. When the 1-minute timer ends, the team with the most kills wins.",
  sp:[["PLAYERS","5 VS 5"],["TIME","1 MINUTE"],["RESPAWN","5 SECONDS"],["TEAMS","POLICE / TERRORIST"]],
  hw:["Pick your side: <b>Police</b> or <b>Terrorist</b>. Your 4 teammates are AI and show as blue markers.","Every kill adds 1 point to your team. Teammates' kills count too.","When you die you respawn after <b>5 seconds</b>, with a short spawn shield.","Headshots deal 3x damage. No airdrops: weapons, ammo and medkits are never dropped, so choose your primary weapon wisely."]},
 {n:"BOMB MODE",tg:"TEAM \u00b7 TACTICAL",st:"AVAILABLE",bt:"PLAY NOW",lock:0,df:BOT_TACTICS.difficulty,
  d:"Indoor or outdoor 5 vs 5: Terrorists plant a bomb at site A or B. Police must eliminate the attackers or defuse before detonation. No respawns until the next round.",
  sp:[["PLAYERS",BOMB_RULES.teamSize+" VS "+BOMB_RULES.teamSize],["ROUNDS",String(BOMB_RULES.rounds)],["TIME",BOMB_RULES.roundSeconds/60+" MIN/ROUND"],["ROLE","PLANT / DEFUSE"]],
  hw:["A random Terrorist carries the bomb. Walk into the highlighted site and hold <b>E</b> for "+BOMB_RULES.plantSeconds+" seconds to plant.","Police hold <b>E</b> for "+BOMB_RULES.defuseSeconds+" seconds near the planted bomb to defuse. Both actions leave you vulnerable.","A fallen bomb carrier drops the device; a teammate can pick it up. After death, spectate surviving teammates.","First team to win "+BOMB_RULES.wins+" rounds wins. The match is limited to "+BOMB_RULES.rounds+" rounds."]},
 {n:"BATTLEGROUND",tg:"SOLO \u00b7 LAST STANDING",st:"COMING SOON",bt:"COMING SOON",lock:1,df:5,
  d:"Dozens of players drop into a single arena. The safe zone keeps shrinking, forcing everyone toward the center. Scavenge weapons, survive, and be the last one standing.",
  sp:[["PLAYERS","30 SOLO"],["ZONE","SHRINKING"],["DURATION","\u00b1 15 MIN"],["WIN","LAST ALIVE"]],
  hw:["Land anywhere and scavenge for weapons and armor.","The safe zone closes in every few minutes.","Outside the zone, your HP keeps draining.","The last player standing wins."]}];
// Presentation-only map briefing; original MODES owns all combat and mode rules.
var MODE_MAP_PREVIEWS=[
 {name:"BLOCK DISTRICT",caption:"Urban Combat Zone",stats:[["PLAYERS","5 VS 5"],["TIME","1 MINUTE"],["RESPAWN","5 SECONDS"]],features:["Urban lanes","Elevated sightlines","Close-quarter fights"]},
 {name:"LOCKDOWN",caption:"Indoor Tactical Arena",stats:[["PLAYERS","5 VS 5"],["ROUNDS","12"],["RESPAWN","NONE"]],features:["Two bomb sites","Plant or defuse","Tactical rounds"]},
 {name:"COMING SOON",caption:"Map not available",stats:[["PLAYERS","SOLO"],["MAP","TBA"],["STATUS","SOON"]],features:["Last survivor","Shrinking zone","In development"]}
];
var selM=0,miEl=document.querySelectorAll(".mi");
// selMode(i): selects a lobby mode card and fills the description panel.
function selMode(i){selM=i;var $=function(x){return document.getElementById(x);},m=MODES[i],t=$("mdt"),k;
  [].forEach.call(miEl,function(e,j){e.classList.toggle("on",j===i);});
  $("mnm").textContent=m.n;$("mst").textContent=m.st;$("mtg").textContent=m.tg;
  var preview=MODE_MAP_PREVIEWS[i];
  $("mapName").textContent=preview.name;$("mapCaption").textContent=preview.caption;
  $("mmap").classList.toggle("unavailable",!!m.lock);
  $("msp").innerHTML=preview.stats.map(function(p){return"<div><span>"+p[0]+"</span><b>"+p[1]+"</b></div>";}).join("");
  $("mapOverview").innerHTML=preview.features.map(function(x){return"<span>"+x+"</span>";}).join("");
  modePreviewSelect(i);
  $("mk").innerHTML=miEl[i].querySelector("svg").outerHTML;
  $("mdm").firstChild.nodeValue=m.bt;t.classList.toggle("lk",!!m.lock);
  t.classList.remove("sw");void t.offsetWidth;t.classList.add("sw");}
[].forEach.call(miEl,function(e,i){e.onclick=function(){selMode(i);};e.ondblclick=function(){document.getElementById("mdm").click();};});
addEventListener("keydown",function(e){var l=document.getElementById("lbm");if(lb.style.display==="none"||!l.classList.contains("on"))return;
  if(e.code==="ArrowDown"||e.code==="KeyS")selMode((selM+1)%3);else if(e.code==="ArrowUp"||e.code==="KeyW")selMode((selM+2)%3);
  else if(e.code==="Enter")document.getElementById("mdm").click();else if(e.code==="Escape"||e.code==="Backspace")lobP("lbs");});
selMode(0);
document.getElementById("lbst").onclick=function(){this.blur();roomLobbyOpen();};
document.getElementById("lbb").onclick=function(){lobP("lbs");};
document.getElementById("mdm").onclick=function(){if(MODES[selM].lock){this.classList.remove("shk");void this.offsetWidth;this.classList.add("shk");return;}document.getElementById("tsel").style.display="flex";};
[].forEach.call(document.querySelectorAll(".md.lock"),function(c){c.onclick=function(){c.classList.remove("shk");void c.offsetWidth;c.classList.add("shk");};});
document.getElementById("dmn").onclick=function(){document.getElementById("dv").classList.remove("show");document.body.classList.remove("over","dead","bomb-spectator");bombCleanup();reset();selectedGameMode=0;selectGameMap(false);bombMatch=null;mt={t:60,cd:0,over:true};run=false;lob=true;document.body.classList.add("lobby");lb.style.display="flex";lobP("lbs");};
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
function spawnPt(tm){if(isBombMode())return bombSpawnPt(tm);if(tdmMapId(selectedTdmMapId)==="block-labs")return labsSpawnPt(tm);var cz=tm?-38:38,hist=SPH[tm?1:0],ok=[],all=[],k,x,z,i,o,d,dE,dF,h,near,c,p;
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
function placeBot(b){var s=spawnPt(b.tm);b.stepTrail=0;b.stepIndex=0;b.x=s[0];b.z=s[1];b.y=0;defenseSpawn(b);if(b.hm)b.hm.visible=true;b.inv=2;b.cd=1+Math.random();b.dead=false;b.tg=null;b.bn=0;b.wx=b.x;b.wz=b.z;b.stk=0;b.lastSeen=null;b.coverGoal=null;b.coverExpires=0;b.coverHoldUntil=0;b.smartRetreat=false;if(typeof botMoveReset==='function')botMoveReset(b);if(typeof botSquadReset==='function')botSquadReset(b);if(typeof bombM5Reset==='function')bombM5Reset(b);if(typeof botTdmReset==='function')botTdmReset(b);b.siteChoice=undefined;b.g.rotation.y=bombMapSpawnYaw(b.tm,b.x,b.z);botInitialLoadout(b);en.push(b);}
// startMatch(tm): sets up scores, timer (60 s) and the countdown, spawns the player and 4+5 bots, resets weapons to the chosen primary.
function startMatch(tm){inventoryForNewMatch();starsReset();SPH=[[],[]];var s=spawnPt(tm);pl.tm=tm;pl.x=s[0];pl.z=s[1];pl.face=bombMapSpawnYaw(tm,pl.x,pl.z);pl.inv=2;ts=[0,0];rq=[];mt={t:roomMatchSeconds(),cd:5,over:false};pl.prim=favPrim;pl.w=favPrim;pl.mag=WP[favPrim].mag;pl.res=WP[favPrim].res;scopeOn=false;ROS=[];pl.st={name:"You",tm:tm,k:0,d:0};ROS.push(pl.st);
  S.remove(pm.g);pm=mkPm(tm);pm.g.visible=false;[armR,armL].forEach(function(ar){ar.children[0].material.color.setHex(tm?0x4b5320:0x1c4a8a);ar.children[1].material.color.setHex(tm?0x23272b:0x142a52);});
  [0,1].forEach(function(t){for(var i=0;i<BOMB_RULES.teamSize-(t===tm?1:0);i++){var b=newBot(t,i);b.st={name:b.name,tm:t,k:0,d:0};ROS.push(b.st);placeBot(b);}});
  if(isBombMode())bombStartMatch();loadoutPrepareRound();toast("YOU ARE "+(tm?"TERRORIST":"POLICE"));}
// respawnPl(): respawns the player after the 5 s death timer with full ammo and spawn shield.
function respawnPl(){bloodPoolRemove(pl.bloodPool);pl.bloodPool=null;pl.stepTrail=0;pl.stepIndex=0;var s=spawnPt(pl.tm);pl.dead=false;pl.dt=pl.rt=pl.rl=pl.cd=pl.sw=pl.stab=pl.thr=0;pl.pend=pl.sth=false;pl.ghide=0;defenseSpawn(pl);pl.x=s[0];pl.z=s[1];pl.y=pl.vy=0;pl.face=bombMapSpawnYaw(pl.tm,pl.x,pl.z);pl.pitch=0;pl.inv=2;pl.prim=favPrim;
  pl.ammo={};WP.forEach(function(w,i){pl.ammo[i]={mag:w.mag,res:w.res};});pl.w=favPrim;pl.mag=WP[favPrim].mag;pl.res=WP[favPrim].res;pl.slot=0;camY=0;scopeOn=false;resetPm();setHm();document.body.classList.remove("dead");toast("RESPAWNED");}
// tmUpd(): updates the top HUD (timer, scores, respawn text, spawn-shield text).
function tmUpd(){var g=function(i){return document.getElementById(i);},r=g("rsp");g("imm").style.display=(pl.inv>0&&!pl.dead&&!mt.over)?"block":"none";var sp0=g("tp"),sq0=g("tq");if(sp0.textContent!=ts[0]){sp0.textContent=ts[0];sp0.classList.remove("pop");void sp0.offsetWidth;sp0.classList.add("pop");}if(sq0.textContent!=ts[1]){sq0.textContent=ts[1];sq0.classList.remove("pop");void sq0.offsetWidth;sq0.classList.add("pop");}g("tt").textContent=mmss(Math.max(0,Math.ceil(mt.t)));g("tbf").style.width=Math.max(0,Math.min(100,mt.t/(isBombMode()?(bombMatch&&bombMatch.state==="planted"?BOMB_RULES.fuseSeconds:roomRoundSeconds()):roomMatchSeconds())*100))+"%";g("tm").classList.toggle("lo",mt.t<=10&&mt.cd<=0&&!mt.over);g("tmP").classList.toggle("you",pl.tm===0);g("tmT").classList.toggle("you",pl.tm===1);
  r.innerHTML=isBombMode()?(mt.cd>0?Math.ceil(mt.cd):(pl.dead&&!mt.over?"SPECTATING":(bombMatch&&bombMatch.done?"ROUND OVER":""))):mt.cd>0?Math.ceil(mt.cd):(pl.dead&&!mt.over?"RESPAWN IN "+Math.max(1,Math.ceil(pl.rsT))+(pl.kb?"<small>KILLED BY "+pl.kb.toUpperCase()+"</small>":""):"");}
// BOMB MISSION match state (isolated from Team Deathmatch logic).
var bombMatch=null,bombHold=false,bombSpectatorIndex=0,bombSpectatorView='team';
var bombInfo=document.getElementById('bombInfo'),bombStatus=document.getElementById('bombStatus'),
  bombActionLabel=document.getElementById('bombActionLabel'),bombActionBar=document.getElementById('bombActionBar'),
  bombTouch=document.getElementById('bombTouch'),bombSpec=document.getElementById('bombSpec');
// A dropped, unplanted bomb is visible only to the Terrorist team.
var bombDropMarker=document.getElementById('bombDropMarker');
function bombDroppedSignalVisible(){
 return !!(isBombMode()&&bombMatch&&!bombMatch.done&&bombMatch.state==='idle'&&bombMatch.dropped&&pl&&pl.tm===1);
}
// Track the actual dropped position in the camera, clamping the indicator to screen edges.
function bombDropMarkerUpdate(){
 var visible=bombDroppedSignalVisible()&&run&&!mt.over;
 bombDropMarker.style.display=visible?'flex':'none';
 if(!visible)return;
 var pos=bombMatch.dropped,target=new T.Vector3(pos.x,1.2,pos.z),
     fwd=C.getWorldDirection(new T.Vector3()),
     behind=target.clone().sub(C.position).dot(fwd)<=0;
 target.project(C);
 var w=innerWidth,h=innerHeight,sx=(target.x+1)*w/2,sy=(1-target.y)*h/2;
 if(behind){sx=w-sx;sy=h-sy;}
 if(!Number.isFinite(sx)||!Number.isFinite(sy)){sx=w/2;sy=h+100;}
 if(behind&&Math.abs(sx-w/2)<4&&Math.abs(sy-h/2)<4)sy=h+100;
 var x=Math.max(90,Math.min(w-90,sx)),y=Math.max(100,Math.min(h-115,sy)),
     edge=behind||sx!==x||sy!==y;
 bombDropMarker.style.left=x+'px';bombDropMarker.style.top=y+'px';
 bombDropMarker.classList.toggle('edge',edge);
 bombDropMarker.style.setProperty('--bomb-bearing',Math.atan2(sx-w/2,h/2-sy)*180/Math.PI+'deg');
 bombDropMarker.querySelector('.bomb-drop-distance').textContent=Math.round(Math.hypot(pos.x-pl.x,pos.z-pl.z))+' UNITS';
}
function bombCandidates(){return en.filter(function(b){return b.tm===1&&!b.dead;}).concat(pl.tm===1&&!pl.dead?[pl]:[]);}
function bombCreateDevice(){
  var g=new T.Group(),base=new T.MeshLambertMaterial({color:0x28323e}),screen=new T.MeshBasicMaterial({color:0xf85d48});
  function piece(w,h,d,mat,x,y,z){var m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);g.add(m);}
  piece(.7,.19,.5,base,0,.13,0);piece(.42,.02,.2,screen,0,.24,-.08);
  for(var i=0;i<8;i++)piece(.07,.022,.055,new T.MeshLambertMaterial({color:i%2?0xd8d6c9:0x4e6479}),-.23+(i%4)*.15,.25,.1+Math.floor(i/4)*.1);
  var antenna=new T.Mesh(new T.CylinderGeometry(.015,.015,.38,6),new T.MeshLambertMaterial({color:0xe8590c}));antenna.position.set(.25,.41,.15);g.add(antenna);
  var led=new T.Mesh(new T.SphereGeometry(.055,8,8),new T.MeshBasicMaterial({color:0xff3333}));led.position.set(.2,.26,-.1);g.add(led);g.userData.led=led;
  S.add(g);return g;
}
function bombCreateHands(){
  var g=new T.Group(),dark=new T.MeshLambertMaterial({color:0x1e2430}),skinM=new T.MeshLambertMaterial({color:0xffd9a0});
  function part(parent,w,h,d,x,y,z,mat){var q=new T.Mesh(new T.BoxGeometry(w,h,d),mat);q.position.set(x,y,z);parent.add(q);return q;}
  // Planting: both hands press the keypad of the explosive device.
  var kit=new T.Group();g.add(kit);part(kit,.62,.15,.37,0,-.21,-.7,dark);
  part(kit,.38,.02,.17,0,-.12,-.76,new T.MeshBasicMaterial({color:0xff673b}));
  for(var i=0;i<9;i++)part(kit,.05,.014,.04,-.17+i%3*.16,-.10,-.63+Math.floor(i/3)*.07,new T.MeshBasicMaterial({color:0xced4da}));
  // Defusing: wire harness + two colored cutting-tool jaws, distinct from the planting keypad.
  var tool=new T.Group();g.add(tool);
  part(tool,.45,.12,.28,0,-.23,-.7,dark);
  part(tool,.24,.028,.06,-.08,-.12,-.72,new T.MeshBasicMaterial({color:0xff6b6b}));
  part(tool,.24,.028,.06,.08,-.11,-.68,new T.MeshBasicMaterial({color:0x4dabf7}));
  var jaw1=part(tool,.04,.08,.27,.18,-.06,-.55,new T.MeshLambertMaterial({color:0xadb5bd}));
  var jaw2=part(tool,.04,.08,.27,.25,-.06,-.55,new T.MeshLambertMaterial({color:0xadb5bd}));
  var right=part(g,.18,.2,.27,.29,-.17,-.53,skinM),left=part(g,.18,.2,.27,-.31,-.22,-.7,skinM);
  g.userData={right:right,left:left,kit:kit,tool:tool,jaws:[jaw1,jaw2]};
  VS.add(g);g.visible=false;return g;
}
var bombHands=bombCreateHands();
function bombCleanup(){if(!bombMatch)return;
  if(bombMatch.device)S.remove(bombMatch.device);
  en.concat([pl]).forEach(function(e){if(e)e.bAction=null;});
  bombHands.visible=false;bombHold=false;
}
function bombStartMatch(){
  var old=bombMatch&&bombMatch.keepRound?bombMatch:null,round=old?old.round+1:1;
  bombMatch={round:round,state:'idle',carrier:null,dropped:null,device:bombCreateDevice(),
    site:-1,roundWins:old?old.roundWins:[0,0],fuseLeft:BOMB_RULES.fuseSeconds,
    done:false,finishDelay:0,keepRound:false,winner:null};
  bombMatch.device.visible=false;
  mt.t=roomRoundSeconds();mt.cd=BOMB_RULES.freezeSeconds;
  var options=bombCandidates();bombMatch.carrier=options[(Math.random()*options.length)|0]||null;
  en.concat([pl]).forEach(function(e){e.bAction=null;});
  if(bombMatch.carrier===pl)toast(BOMB_TEXT.carrier);
  bombSpectatorIndex=0;bombSpectatorView='team';bombResetSpectatorCamera();document.body.classList.remove('bomb-spectator');
}
function bombDrop(holder){
  if(!isBombMode()||!bombMatch||bombMatch.state!=='idle')return;
  if(holder===bombMatch.carrier){bombMatch.carrier=null;bombMatch.dropped={x:holder.x,z:holder.z};bombMatch.device.visible=true;
    bombMatch.device.position.set(holder.x,0,holder.z);if(pl.tm===1)toast(BOMB_TEXT.dropped);}
  holder.bAction=null;
}
function bombArea(e){
  for(var i=0;i<BOMB_SITES.length;i++)if(Math.hypot(e.x-BOMB_SITES[i].x,e.z-BOMB_SITES[i].z)<=BOMB_RULES.siteRadius)return i;
  return -1;
}
function bombActionFor(e){
  var b=bombMatch;if(!b||b.done||mt.cd>0||e.dead)return null;
  if(b.state==='idle'&&e.tm===1&&b.carrier===e){var site=bombArea(e);if(site>=0)return{type:'plant',site:site};}
  if(b.state==='planted'&&e.tm===0&&Math.hypot(e.x-b.device.position.x,e.z-b.device.position.z)<=BOMB_RULES.interactRadius)
    return{type:'defuse',site:b.site};
  return null;
}
function bombInterruptPlant(e){
  if(!isBombMode()||!e||!e.bAction||e.bAction.type!=='plant')return;
  e.bAction=null;
  e.bHitUntil=tt+BOMB_RULES.plantHitRecoverySeconds;
}
function bombAct(e,dt,enabled){
  var wanted=enabled?bombActionFor(e):null;
  if(wanted&&wanted.type==='plant'&&tt<(e.bHitUntil||0))wanted=null;
  if(!wanted){e.bAction=null;return;}
  if(!e.bAction||e.bAction.type!==wanted.type||e.bAction.site!==wanted.site)e.bAction={type:wanted.type,site:wanted.site,t:0};
  // A character taking damage remains vulnerable and keeps working unless killed.
  e.bAction.t+=dt;
  var required=wanted.type==='plant'?BOMB_RULES.plantSeconds:BOMB_RULES.defuseSeconds;
  if(e.bAction.t<required)return;
  e.bAction=null;
  if(wanted.type==='plant')bombPlant(e,wanted.site);else bombDefuse(e);
}
function bombPlant(e,site){var b=bombMatch;if(!b||b.done||b.state!=='idle'||b.carrier!==e)return;
  var s=BOMB_SITES[site];b.state='planted';b.carrier=null;b.site=site;b.dropped=null;
  b.device.visible=true;b.device.position.set(s.x,0,s.z);b.fuseLeft=BOMB_RULES.fuseSeconds;mt.t=b.fuseLeft;
  toast(BOMB_TEXT.planted+' - '+s.id);
}
function bombDefuse(e){if(bombMatch&&bombMatch.state==='planted'&&!bombMatch.done){toast(BOMB_TEXT.defused);bombFinish(0,BOMB_TEXT.defused);}}
function bombFinish(winner,reason){var b=bombMatch;if(!b||b.done)return;
  if(typeof botQaEnabled!=='undefined'&&botQaEnabled)botQaBomb(winner,b.site,b.state);
  b.done=true;b.winner=winner;b.finishDelay=BOMB_RULES.roundBreakSeconds;ts[winner]++;
  b.roundWins=ts.slice();
  en.concat([pl]).forEach(function(e){e.bAction=null;});
  toast((winner?BOMB_TEXT.terrorWin:BOMB_TEXT.policeWin)+' - '+reason);
}
function bombNextRound(){var old=bombMatch,team=pl.tm,wins=ts.slice(),stats={};
  // Kill notifications restart for every round, including surviving players.
  // Preserve match-wide career kills and team scores without carrying the streak.
  ROS.forEach(function(s){stats[s.tm+':'+s.name]={k:s.k,d:s.d};});
  bombCleanup();old.keepRound=true;
  reset();startMatch(team);resetKillStreak();
  ts=wins;ROS.forEach(function(s){var h=stats[s.tm+':'+s.name];if(h){s.k=h.k;s.d=h.d;}});
}
// The tactical director assigns moving, separate objectives to every team member.
function bombBotGoal(e){return bombTacticalGoal(e);}
function bombSpectatorTarget(){
  if(!isBombMode()||!pl.dead||!bombMatch||mt.over)return null;
  var living=en.filter(function(e){return e.tm===pl.tm&&!e.dead;});
  var enemyView=false;
  // A wiped Terrorist team may watch the Police retake their planted bomb.
  // Teammates ALWAYS take precedence while any of them are alive.
  if(!living.length&&pl.tm===1&&bombMatch.state==='planted'&&!bombMatch.done){
    living=en.filter(function(e){return e.tm===0&&!e.dead;});
    enemyView=living.length>0;
    if(enemyView){
      var defuser=bombPickDefuser();
      living.sort(function(a,b){return a===defuser?-1:b===defuser?1:(a.idx||0)-(b.idx||0);});
    }
  }
  var view=enemyView?'police':'team';
  if(view!==bombSpectatorView){
    bombSpectatorView=view;bombSpectatorIndex=0;bombResetSpectatorCamera();
  }
  if(!living.length)return null;
  bombSpectatorIndex=((bombSpectatorIndex%living.length)+living.length)%living.length;
  return living[bombSpectatorIndex];
}
function bombSpectatorNext(d){if(isBombMode()&&pl.dead){bombSpectatorIndex+=d;bombResetSpectatorCamera();}}
function bombUpdate(dt){if(!isBombMode()||!bombMatch||mt.over)return;
  var b=bombMatch;
  if(b.done){b.finishDelay-=dt;if(b.finishDelay<=0){if(ts[0]>=roomRoundsToWin()||ts[1]>=roomRoundsToWin()||b.round>=roomRoundLimit())endMatch();else bombNextRound();}return;}
  if(mt.cd>0)return;
  if(b.state==='idle'&&b.dropped){
    var candidates=bombCandidates();
    for(var i=0;i<candidates.length;i++){
      var p=candidates[i];if(Math.hypot(p.x-b.dropped.x,p.z-b.dropped.z)>BOMB_RULES.pickupRadius)continue;
      b.carrier=p;b.dropped=null;b.device.visible=false;if(p===pl)toast(BOMB_TEXT.picked);break;
    }
  }
  if(!pl.dead)bombAct(pl,dt,!!(keys.KeyE||bombHold));
  if(b.state==='planted')bombPickDefuser();
  en.forEach(function(e){
    // Only the assigned defuser handles the device. Others cover approaches.
    // Plant and defuse leave the actor vulnerable to bullets.
    bombAct(e,dt,bombBotCanAct(e));
  });
  if(b.state==='planted'){
    b.fuseLeft=mt.t;
    b.device.userData.led.visible=Math.floor(tt*4)%2===0;
    if(mt.t<=0){bombFinish(1,BOMB_TEXT.explosion);return;}
  }else if(mt.t<=0){bombFinish(0,BOMB_TEXT.timeout);return;}
  var cops=en.filter(function(e){return e.tm===0&&!e.dead;}).length+(pl.tm===0&&!pl.dead?1:0),
    terror=en.filter(function(e){return e.tm===1&&!e.dead;}).length+(pl.tm===1&&!pl.dead?1:0);
  if(!cops){bombFinish(1,BOMB_TEXT.elimination);return;}
  if(!terror&&b.state!=='planted')bombFinish(0,BOMB_TEXT.elimination);
}
function bombHudUpdate(){
  var show=isBombMode()&&run&&bombMatch&&!mt.over;
  bombInfo.style.display=show?'flex':'none';bombStatus.style.display=show?'block':'none';bombTouch.style.display='none';bombSpec.style.display='none';
  bombHands.visible=false;
  bombDropMarkerUpdate();
  if(!show)return;
  var b=bombMatch,roundLabel=BOMB_TEXT.round+' '+b.round+' / '+roomRoundLimit();
  bombInfo.textContent=roundLabel+(b.state==='planted'?'  |  '+BOMB_TEXT.planted+' '+BOMB_SITES[b.site].id:'');
  var action=!pl.dead?bombActionFor(pl):null;
  var label='',progress=0;
  if(pl.dead){
    var target=bombSpectatorTarget(),enemyTarget=target&&target.tm!==pl.tm;
    bombSpec.style.display='block';
    bombSpec.textContent=target?
      (enemyTarget?BOMB_TEXT.spectatingPolice:BOMB_TEXT.spectating)+': '+target.name+
      ' | '+(enemyTarget?BOMB_TEXT.switchPolice:BOMB_TEXT.switchView):BOMB_TEXT.noTeam;
    var nextButton=document.getElementById('bombNext');
    if(nextButton)nextButton.textContent=enemyTarget?'NEXT POLICE':'NEXT TEAMMATE';
    if(enemyTarget&&target.bAction&&target.bAction.type==='defuse'){
      label=BOMB_TEXT.defusing+' '+Math.min(100,Math.floor(target.bAction.t/BOMB_RULES.defuseSeconds*100))+'%';
      progress=target.bAction.t/BOMB_RULES.defuseSeconds;
    }
  }
  else if(pl.bAction){var time=pl.bAction.type==='plant'?BOMB_RULES.plantSeconds:BOMB_RULES.defuseSeconds;
    label=(pl.bAction.type==='plant'?BOMB_TEXT.planting:BOMB_TEXT.defusing)+' '+Math.min(100,Math.floor(pl.bAction.t/time*100))+'%';progress=pl.bAction.t/time;
    bombHands.visible=true;
    bombHands.userData.kit.visible=pl.bAction.type==='plant';
    bombHands.userData.tool.visible=pl.bAction.type==='defuse';
    bombHands.userData.jaws[0].rotation.y=Math.sin(tt*14)*.12;
    bombHands.userData.jaws[1].rotation.y=-Math.sin(tt*14)*.12;
    bombHands.rotation.x=pl.bAction.type==='plant'?.15:-.25;
    bombHands.userData.right.position.y=-.17+Math.sin(tt*15)*.05;
    bombHands.userData.left.position.x=-.31+Math.sin(tt*8)*.02;
  }else if(action){label=(action.type==='plant'?BOMB_TEXT.plant:BOMB_TEXT.defuse)+'  |  '+BOMB_TEXT.hold;}
  else if(b.carrier===pl)label=BOMB_TEXT.carrier+'  |  '+BOMB_TEXT.plant;
  else if(b.dropped&&pl.tm===1)label=BOMB_TEXT.dropped;
  else if(b.state==='planted')label=BOMB_TEXT.planted+' '+BOMB_SITES[b.site].id+'  |  '+mmss(Math.ceil(mt.t));
  else label=pl.tm===0?'DEFEND BOMB SITES':'ATTACK BOMB SITES';
  bombActionLabel.textContent=label;bombActionBar.style.width=Math.min(100,progress*100)+'%';
  if(touch&&action){bombTouch.style.display='block';bombTouch.textContent=action.type==='plant'?'PLANT':'DEFUSE';}
}
// E is held continuously for planting and defusing. Other original key actions are unchanged.
addEventListener('keydown',function(e){if(e.code==='KeyE'&&isBombMode()&&run)e.preventDefault();
  if(isBombMode()&&pl.dead&&(e.code==='ArrowRight'||e.code==='ArrowLeft'))bombSpectatorNext(e.code==='ArrowRight'?1:-1);});
bombTouch.addEventListener('pointerdown',function(e){e.stopPropagation();e.preventDefault();bombHold=true;bombTouch.setPointerCapture(e.pointerId);});
['pointerup','pointercancel','lostpointercapture'].forEach(function(ev){bombTouch.addEventListener(ev,function(){bombHold=false;});});
addEventListener('blur',function(){bombHold=false;});
document.getElementById('bombNext').addEventListener('click',function(){bombSpectatorNext(1);});
// M5 Bomb Mission tactical intelligence. Decisions only: never alter Bomb rules,
// plant/defuse progress, fuse/scoring, weapon damage, or hidden opponent coordinates.
var BOMB_M5=Object.freeze({
 siteThreatRadius:14,siteSwitchCooldown:9,maxSiteSwitches:1,
 lateFuseMargin:2.5,postPlantHoldSeconds:3.2,
 postPlantRadii:[5.5,7.5,6.5,8],
 supportRadius:1.7,safeGoalSpacing:1.8,
 navCheckMax:1
});
function bombM5Reset(e){
 if(!e)return;
 e.m5Round=0;e.m5Switches=0;e.m5SwitchAt=0;
 e.m5Goal=null;e.m5GoalUntil=0;e.m5GoalStage='';
}
function bombM5Round(e){
 if(!bombMatch||!e)return;
 if(e.m5Round!==bombMatch.round){
  bombM5Reset(e);e.m5Round=bombMatch.round;
 }
}
// M1 provenance only: audible hints aren't a verified guard at a particular site.
function bombM5Contact(e){
 if(!e||e.dead||typeof botIntelKnown!=='function')return null;
 var seen=botIntelKnown(e);
 return seen&&(seen.source==='sight'||seen.source==='radio')&&
    seen.until>tt&&seen.team===e.tm&&
    Number.isFinite(seen.x)&&Number.isFinite(seen.z)?seen:null;
}
function bombM5ChooseSite(e){
 if(!e||e.dead||e.tm!==1||!bombMatch||bombMatch.done||
    bombMatch.state!=='idle'||bombMatch.carrier!==e||
    bombMatch.dropped||e.bAction)return;
 bombM5Round(e);
 if(e.siteChoice===undefined||e.m5Switches>=BOMB_M5.maxSiteSwitches||
    tt<(e.m5SwitchAt||0)||BOMB_SITES.length<2)return;
 var contact=bombM5Contact(e);
 if(!contact)return;
 var origin=BOMB_SITES[e.siteChoice],risk=Math.hypot(contact.x-origin.x,contact.z-origin.z);
 if(risk>BOMB_M5.siteThreatRadius)return;
 var selected=e.siteChoice,best=Infinity;
 for(var i=0;i<BOMB_SITES.length;i++){
  if(i===e.siteChoice)continue;
  var site=BOMB_SITES[i],threatDist=Math.hypot(contact.x-site.x,contact.z-site.z);
  if(threatDist<=BOMB_M5.siteThreatRadius*1.35)continue;
  if(typeof botMoveReachable!=='function'||!botMoveReachable(e,site.x,site.z))continue;
  var dist=Math.hypot(e.x-site.x,e.z-site.z);
  if(dist<best){best=dist;selected=i;}
 }
 if(selected!==e.siteChoice){
  e.siteChoice=selected;e.m5Switches++;
  e.m5SwitchAt=tt+BOMB_M5.siteSwitchCooldown;
 }
}
function bombM5CriticalFuse(){
 return !!(bombMatch&&!bombMatch.done&&bombMatch.state==='planted'&&
  Number.isFinite(bombMatch.fuseLeft)&&
  bombMatch.fuseLeft<=BOMB_RULES.defuseSeconds+BOMB_M5.lateFuseMargin);
}
function bombM5SelectDefuser(team,current){
 if(!bombM5CriticalFuse()||!team.length)return null;
 if(current&&!current.dead&&team.indexOf(current)>=0&&current.bAction&&
    current.bAction.type==='defuse')return current;
 var b=bombMatch,p=b.device.position,best=null,score=Infinity;
 team.forEach(function(e){
  if(!e||e.dead||e===pl)return;
  var d=Math.hypot(e.x-p.x,e.z-p.z);
  // A closer living bot can start the original 7-second interaction sooner;
  // never fabricate time reductions, extra speed, or guaranteed success.
  if(d<score){score=d;best=e;}
 });
 return best;
}
function bombM5Recoverer(){
 if(!bombMatch||bombMatch.state!=='idle'||!bombMatch.dropped)return null;
 var p=bombMatch.dropped,best=null,score=Infinity;
 bombLiving(1).forEach(function(e){
  if(e===pl||e.dead)return;
  var dist=Math.hypot(e.x-p.x,e.z-p.z);
  var penalty=e.hp!==undefined&&e.hp<35?2:0;
  var v=dist+penalty;
  if(v<score){score=v;best=e;}
 });
 return best;
}
function bombM5SafePosition(e,x,z){
 if(typeof botMoveReachable!=='function'||!Number.isFinite(x)||!Number.isFinite(z)||
    Math.abs(x)>=A-2||Math.abs(z)>=A-2||inObs(x,z,.85))return null;
 // Defuser and carrier must retain the objective's canonical direct destination.
 var teammates=bombLiving(e.tm);
 for(var j=0;j<teammates.length;j++){
  var ally=teammates[j];
  if(ally===e||ally.dead||!ally.m5Goal||ally.m5GoalUntil<=tt)continue;
  if(Math.hypot(x-ally.m5Goal[0],z-ally.m5Goal[1])<BOMB_M5.safeGoalSpacing)return null;
 }
 return botMoveReachable(e,x,z)?[x,z]:null;
}
function bombM5PostPlantGoal(e,stage){
 if(!e||e.tm!==1||!bombMatch||bombMatch.done||
    bombMatch.state!=='planted'||(stage!=='hold'&&stage!=='intercept')||
    bombLiving(1).length<2||!bombMatch.device)return null;
 bombM5Round(e);
 if(e.m5Goal&&e.m5GoalStage===stage&&e.m5GoalUntil>tt)return e.m5Goal;
 var p=bombMatch.device.position,idx=e.idx||0,contact=bombM5Contact(e);
 // Defenders face different angles, weighting a REAL observed attacker lane.
 // Never read live enemy coordinates or chase expired sound.
 var a=(idx*2+Math.floor(bombMatch.round||1))*(Math.PI/4);
 if(contact&&Math.hypot(contact.x-p.x,contact.z-p.z)<24){
  a=Math.atan2(contact.z-p.z,contact.x-p.x)+(idx%2?.35:-.35);
 }
 var radius=BOMB_M5.postPlantRadii[idx%BOMB_M5.postPlantRadii.length];
 for(var k=0;k<2;k++){
  var theta=a+(k?Math.PI/3:0),x=p.x+Math.cos(theta)*radius,z=p.z+Math.sin(theta)*radius;
  var goal=bombM5SafePosition(e,x,z);
  if(goal){
   e.m5Goal=goal;e.m5GoalUntil=tt+BOMB_M5.postPlantHoldSeconds;
   e.m5GoalStage=stage;return goal;
  }
 }
 e.m5Goal=null;e.m5GoalUntil=0;return null;
}
function bombM5RetakeSupportGoal(e,stage){
 if(!e||e.tm!==0||stage!=='retake-support'||!bombMatch||
    bombMatch.done||bombMatch.state!=='planted'||!bombMatch.device)return null;
 bombM5Round(e);
 if(e.m5Goal&&e.m5GoalStage===stage&&e.m5GoalUntil>tt)return e.m5Goal;
 var p=bombMatch.device.position,i=e.idx||0,angle=(i*2+1)*Math.PI/4;
 for(var k=0;k<2;k++){
  var a=angle+k*Math.PI/2;
  var goal=bombM5SafePosition(e,p.x+Math.cos(a)*BOMB_M5.supportRadius,
                              p.z+Math.sin(a)*BOMB_M5.supportRadius);
  if(goal){
   e.m5Goal=goal;e.m5GoalUntil=tt+Math.min(2,BOMB_M5.postPlantHoldSeconds);
   e.m5GoalStage=stage;return goal;
  }
 }
 return null;
}
// Bomb Mission tactical director. Every position and behavior is local to Bomb Mode.
var BOMB_AI=Object.freeze({
  engagementRange:26,urgentThreatRange:6,coverRadius:11,roamRadius:23,
  destinationRefresh:6,defuserReview:.75,defusePriorityRadius:4,
  teammateSpacing:2.5,repathGoalDistance:2.4,navSpeed:5.3,
  retakeThreatRadius:34,retakeSeekRadius:36,retakeSweepRadius:4,retakeSweepStep:3,
  retakeCombatDistance:5,
  soloDefuseThreatRadius:18,plantClearRadius:13,plantEngageRange:19,
  huntedEnemyRange:160,
  clearSiteSpeedMultiplier:1.4,clearSiteSupportRadius:1.35,defuserSwapMargin:1.2
});
function bombLiving(team){return en.filter(function(e){return e.tm===team&&!e.dead;}).concat(!pl.dead&&pl.tm===team?[pl]:[]);}
function bombNearestOpponent(e){
  // Public elimination state can invalidate stale clues, never reveal coordinates.
  if(!bombLiving(1-e.tm).length)return null;
  // Never return a living opponent: only timestamped, authorized observation data.
  return botIntelNearest(e,e.x,e.z,Infinity);
}
function bombNearestThreat(team,x,z,radius,observer){
  // The observer is mandatory. Team- or site-wide perfect-knowledge scans
  // are forbidden; teammate radio reports must come from legitimate sight.
  if(!observer||observer.tm!==team||!bombLiving(1-team).length)return null;
  return botIntelNearest(observer,x,z,radius);
}
function bombSoloPoliceThreat(e){
  if(!bombMatch||bombMatch.done||bombMatch.state!=='planted'||e.tm!==0||
      bombLiving(0).length!==1)return null;
  var p=bombMatch.device.position;
  return bombNearestThreat(0,p.x,p.z,BOMB_AI.soloDefuseThreatRadius,e);
}
function bombSmartCarrierThreat(e){var foe=bombPlantThreat(e);return !!(foe&&
 Math.hypot(foe.x-e.x,foe.z-e.z)<BOMB_AI.urgentThreatRange*1.5&&los(e.x,e.z,foe.x,foe.z));}
function bombPlantThreat(e){
  if(!bombMatch||bombMatch.done||bombMatch.state!=='idle'||e.tm!==1||
     !bombLiving(0).length)return null;
  // Threats in the plant site or close enough to engage the carrier must be cleared.
  var near=bombNearestThreat(1,e.x,e.z,BOMB_AI.plantEngageRange,e),site=bombArea(e);
  if(site>=0){var s=BOMB_SITES[site],atSite=bombNearestThreat(1,s.x,s.z,BOMB_AI.plantClearRadius,e);
    if(atSite)return atSite;}
  return near;
}
// Once the bomb is planted and no Terrorists survive, retake is purely a race to defuse.
function bombUncontestedRetake(){
  return !!(bombMatch&&!bombMatch.done&&bombMatch.state==='planted'&&bombLiving(1).length===0);
}
function bombPickDefuser(){
  if(!bombMatch||bombMatch.done||bombMatch.state!=='planted')return null;
  var b=bombMatch,team=bombLiving(0),current=b.defuser;
  // A sole surviving officer clears a nearby Terrorist before risking the 7s defuse.
  if(team.length===1&&team[0]!==pl&&bombSoloPoliceThreat(team[0])&&!bombM5CriticalFuse()){ 
    b.defuser=null;return null;
  }
  // A human who is merely standing near the bomb must not block bot defuse attempts.
  var humansDefusing=!pl.dead&&pl.tm===0&&pl.bAction&&pl.bAction.type==='defuse';
  if(humansDefusing){b.defuser=pl;return pl;}
  var botOptions=team.filter(function(e){return e!==pl;});
  if(botOptions.length)team=botOptions;
  var urgent=bombM5SelectDefuser(team,current);
  if(urgent){b.defuser=urgent;return urgent;}
  if(bombUncontestedRetake()&&botOptions.length){
    // In an uncontested retake, use whichever officer can defuse soonest.
    // A bot already defusing must finish; otherwise reassign if a closer officer arrives.
    var target=b.device.position,best=null,bestDist=Infinity;
    botOptions.forEach(function(e){
      var dist=Math.hypot(e.x-target.x,e.z-target.z);
      if(dist<bestDist){bestDist=dist;best=e;}
    });
    var active=current&&!current.dead&&botOptions.indexOf(current)>=0?current:null;
    if(active&&active.bAction&&active.bAction.type==='defuse')return active;
    var activeDist=active?Math.hypot(active.x-target.x,active.z-target.z):Infinity;
    if(!active||best!==active&&(
        bestDist+BOMB_AI.defuserSwapMargin<activeDist||
        bestDist<=BOMB_RULES.interactRadius&&activeDist>BOMB_RULES.interactRadius)){
      b.defuser=best;
    }else b.defuser=active;
    return b.defuser;
  }
  if(current&&!current.dead&&team.indexOf(current)>=0)return current;
  var target=b.device.position;
  team.sort(function(a,c){return Math.hypot(a.x-target.x,a.z-target.z)-Math.hypot(c.x-target.x,c.z-target.z);});
  b.defuser=team[0]||null;return b.defuser;
}
// One designated recoverer retrieves a dropped device while others screen it.
function bombSmartRecoverer(){
 if(!bombMatch||!bombMatch.dropped)return null;
 var selected=bombM5Recoverer();if(selected)return selected;
 var p=bombMatch.dropped,best=null,d=Infinity;
 bombLiving(1).forEach(function(e){if(e===pl)return;
  var n=Math.hypot(e.x-p.x,e.z-p.z);if(n<d){d=n;best=e;}
 });
 return best;
}
function bombTacticalStage(e){
  if(!bombMatch||bombMatch.done)return 'none';
  var b=bombMatch;
  if(b.state==='planted'){
    if(e.tm===0){
      if(bombUncontestedRetake())return bombPickDefuser()===e?'retake-defuse':'retake-support';
      return bombPickDefuser()===e?'retake-defuse':'retake-assault';
    }
    // A lone survivor cannot simply camp a random cover point: find and fight CTs.
    if(bombLiving(1).length===1)return 'hunt';
    return e.idx%3===1?'intercept':'hold';
  }
  if(e.tm===0)return e.idx%3===0?'patrol':'site-defense';
  if(b.dropped)return e===bombSmartRecoverer()?'recover':'recover-cover';
  if(e===b.carrier)return bombSmartCarrierThreat(e)?'clear':'plant';
  return e.idx%3===0?'hunt':'escort';
}
// Compute a reachable tactical candidate rather than stacking all bots on a single site.
function bombSafeGoal(x,z,e){
  var min=-A+2,max=A-2;x=Math.max(min,Math.min(max,x));z=Math.max(min,Math.min(max,z));
  if(!inObs(x,z,.85))return[x,z];
  for(var radius=2;radius<=9;radius+=1.5)for(var j=0;j<12;j++){
    var angle=j*Math.PI/6+(e.idx||0)*.25,nx=x+Math.cos(angle)*radius,nz=z+Math.sin(angle)*radius;
    if(!inObs(nx,nz,.85))return[nx,nz];
  }
  return[e.x,e.z];
}
function bombStrategicSite(e){
  if(e.siteChoice===undefined){var round=bombMatch?bombMatch.round:1;e.siteChoice=(e.idx+round+(e.tm?1:0))%BOMB_SITES.length;}
  bombM5ChooseSite(e);
  return BOMB_SITES[e.siteChoice];
}
function bombTacticalGoal(e){
  var b=bombMatch;if(!b||b.done)return null;
  var stage=bombTacticalStage(e),site,phase=Math.floor(tt/BOMB_AI.destinationRefresh),idx=e.idx||0,
    angle=((idx*3+phase%4)*Math.PI/4),radius=BOMB_AI.coverRadius,foe;
  if(b.state==='planted'){
    site=BOMB_SITES[b.site];
    if(stage==='retake-defuse')return bombSafeGoal(b.device.position.x,b.device.position.z,e);
    if(stage==='retake-support'){
      var reinforcement=bombM5RetakeSupportGoal(e,stage);
      if(reinforcement)return reinforcement;
      // Do not camp the other bomb site. Keep a replacement officer at defuse range.
      angle=(idx*2+Math.floor(tt/BOMB_AI.retakeSweepStep))*Math.PI/4;
      return bombSafeGoal(b.device.position.x+Math.cos(angle)*BOMB_AI.clearSiteSupportRadius,
        b.device.position.z+Math.sin(angle)*BOMB_AI.clearSiteSupportRadius,e);
    }
    if(stage==='retake-assault'){
      // The last seconds are for clearing/covering the real device, not hunting
      // a stale attacker position on the far side of the map.
      if(bombM5CriticalFuse())return bombSafeGoal(b.device.position.x+Math.cos(angle)*3.7,
                                                 b.device.position.z+Math.sin(angle)*3.7,e);
      // When alone against a nearby defender, clear the threat before defusing.
      foe=bombSoloPoliceThreat(e);
      if(foe)return bombSafeGoal(foe.x,foe.z,e);
      // Every available officer retakes the PLANTED site; no guarding the other site
      // and no static camping at distant cover points while the fuse is ticking.
      foe=bombNearestOpponent(e);
      if(foe&&Math.hypot(foe.x-site.x,foe.z-site.z)<BOMB_AI.retakeThreatRadius&&
          Math.hypot(foe.x-e.x,foe.z-e.z)<BOMB_AI.retakeSeekRadius){
        return bombSafeGoal(foe.x,foe.z,e);
      }
      // Stagger the final sweep so squadmates enter from different angles.
      radius=BOMB_AI.retakeSweepRadius;
      angle=(idx*2+Math.floor(tt/BOMB_AI.retakeSweepStep))*Math.PI/4;
      return bombSafeGoal(b.device.position.x+Math.cos(angle)*radius,
        b.device.position.z+Math.sin(angle)*radius,e);
    }
    if(stage==='intercept'){
      var interceptGoal=bombM5PostPlantGoal(e,stage);
      foe=bombNearestThreat(1,site.x,site.z,BOMB_AI.roamRadius,e);
      if(interceptGoal&&!foe)return interceptGoal;
      if(foe)return bombSafeGoal(foe.x,foe.z,e);
      radius=8+idx%3*2;
    }
    if(stage==='hold'){
      var guarded=bombM5PostPlantGoal(e,stage);
      if(guarded)return guarded;
    }
    if(stage==='hunt'){
      foe=bombNearestOpponent(e);
      if(foe&&(bombLiving(1).length===1||Math.hypot(foe.x-site.x,foe.z-site.z)<BOMB_AI.roamRadius))
        return bombSafeGoal(foe.x,foe.z,e);
      radius=11+idx%3*4;
    }else if(stage!=='intercept')radius=5+idx%3*2;
    return bombSafeGoal(site.x+Math.cos(angle)*radius,site.z+Math.sin(angle)*radius,e);
  }
  if(e.tm===1){
    if(b.dropped){
      if(stage==='recover')return bombSafeGoal(b.dropped.x,b.dropped.z,e);
      var flank=(idx*2+1)*Math.PI/4;
      return bombSafeGoal(b.dropped.x+Math.cos(flank)*(5+idx%3*2),
        b.dropped.z+Math.sin(flank)*(5+idx%3*2),e);
    }
    var carrier=b.carrier;
    if(stage==='plant'){
      site=bombStrategicSite(e);
      // Enter the center of the site to trigger the actual planting interaction.
      return bombSafeGoal(site.x,site.z,e);
    }
    if(stage==='clear'){
      foe=bombPlantThreat(e);
      if(foe)return bombSafeGoal(foe.x,foe.z,e);
    }
    if(stage==='hunt'){
      foe=bombNearestOpponent(e);
      if(foe)return bombSafeGoal(foe.x,foe.z,e);
    }
    if(carrier){
      // Move with the carrier using different flanking lanes; no identical objectives.
      var bearing=Math.atan2(carrier.x-e.x,carrier.z-e.z);
      angle=bearing+(idx%2?1:-1)*Math.PI/2;
      radius=5+idx%3*2;
      var cx=carrier.x+Math.sin(angle)*radius,cz=carrier.z+Math.cos(angle)*radius;
      return bombSafeGoal(cx,cz,e);
    }
  }
  site=bombStrategicSite(e);
  if(stage==='patrol'){
    // Roam the middle between sites, occasionally reinforce a side.
    var p=(phase+idx)%4;
    return bombSafeGoal(p===0?site.x:p===1?-site.x:0,p===2?site.z:-site.z,e);
  }
  // Site anchors move between actual covering positions, not the planting center.
  angle=(idx*2+phase%3)*Math.PI/4;
  return bombSafeGoal(site.x+Math.cos(angle)*8,site.z+Math.sin(angle)*8,e);
}
function bombBotWantsObjective(e,t){
  if(!isBombMode()||!bombMatch||bombMatch.done)return false;
  if(e.bAction)return true;
  var role=bombTacticalStage(e);
  if(role==='retake-defuse'||role==='retake-support'||role==='plant'||role==='recover'){
    // Do not abandon the objective for distant gunfire; fight close threats normally.
    return !t||Math.hypot(t.x-e.x,t.z-e.z)>BOMB_AI.urgentThreatRange;
  }
  return false;
}
function bombBotCanAct(e){
  var a=bombActionFor(e);if(!a)return false;
  if(a.type==='defuse'&&bombPickDefuser()!==e)return false;
  if(a.type==='defuse'&&bombUncontestedRetake())return true;
  if(a.type==='plant'&&(bombSmartCarrierThreat(e)||tt<(e.bHitUntil||0)))return false;
  if(e.tg&&e.lok&&Math.hypot(e.tg.x-e.x,e.tg.z-e.z)<BOMB_AI.defusePriorityRadius)return false;
  return true;
}
// Bomb Mission third-person chase camera. Renders teammates' entire visible character.
var SPECTATOR_CAMERA=Object.freeze({
  followDistance:5.2,height:2.75,targetHeight:1.05,
  collisionRadius:.34,step:.18,minDistance:1.05,followSmoothing:11,fieldOfView:63
});
var spectatorCameraLast=null;
function bombResetSpectatorCamera(){spectatorCameraLast=null;}
function bombSpectatorCamera(dt){
  var target=bombSpectatorTarget();if(!target){
    C.position.set(pl.x,2.5+pl.y,pl.z);C.lookAt(pl.x,1+pl.y,pl.z+3);return;
  }
  var c=SPECTATOR_CAMERA,y=target.y||0,face=target.g.rotation.y,sx=Math.sin(face),sz=Math.cos(face);
  // Follow from behind the character, ray-testing the wall so the view never clips.
  var cameraDist=c.followDistance;
  for(var d=c.step;d<=c.followDistance;d+=c.step){
    var testY=y+c.targetHeight+(c.height-c.targetHeight)*d/c.followDistance;
    if(inObs(target.x-sx*d,target.z-sz*d,c.collisionRadius,testY)){
      cameraDist=Math.max(c.minDistance,d-c.step*2);break;
    }
  }
  var x=target.x-sx*cameraDist,z=target.z-sz*cameraDist;
  var dest=new T.Vector3(x,y+c.height,z);
  if(spectatorCameraLast!==target){C.position.copy(dest);spectatorCameraLast=target;}
  else C.position.lerp(dest,Math.min(1,dt*c.followSmoothing));
  C.lookAt(target.x,y+c.targetHeight,target.z);
}
// Inventory: weapon collection and loadout. Render using REAL game meshes and colors.
var INVENTORY_STORAGE="bbfps_inventory_v1";
// Dual Kriss is a firing mode of Kriss (V in-match), not a second owned weapon.
var INVENTORY_TABS=[
 {key:"main",label:"MAIN WEAPON",kinds:["rifle","shotgun","rocket","smg","sniper"]},
 {key:"secondary",label:"SECONDARY",kinds:["pistol"]},
 {key:"mele",label:"MELEE",kinds:["knife"]},
 {key:"explosive",label:"EXPLOSIVE",kinds:["grenade"]},
 {key:"helm",label:"HELM",kinds:[]},
 {key:"item",label:"ITEM",kinds:[]}
];
// Helmets are gear, not weapon profiles. Add future cosmetic helmets here.
var INVENTORY_GEAR={
 helm:[{id:"standard_helmet",name:"Standard Helmet",
 description:"Every soldier starts with a Standard Helmet. Custom helmets will arrive in future updates."}]
};
function inventoryGear(id){
 var gear=null;Object.keys(INVENTORY_GEAR).forEach(function(key){
  INVENTORY_GEAR[key].forEach(function(g){if(g.id===id)gear=g;});
 });return gear;
}
var INVENTORY_HINTS={
 main:"Pick your favorite. You can still change your main weapon before the round starts.",
 secondary:"Your sidearm is always ready when you need it.",
 mele:"Keep your knife close for a quick finish.",
 explosive:"Pick the gear you want to bring into battle.",
 helm:"Every soldier has a Standard Helmet. Custom helmets are coming soon.",
 item:"New tactical gear will be available in future updates."
};
var INVENTORY_DESCRIPTIONS={
 rifle:"A dependable pick for every firefight.",shotgun:"Make every close-range shot count.",
 rocket:"Bring heavy firepower to the fight.",smg:"Compact automatic firepower for close engagements.",
 sniper:"Stay sharp and own the long sightlines.",pistol:"Your trusty backup when the fight gets close.",
 knife:"Move fast and finish the fight up close.",grenade:"Clear a path when the enemy has cover."
};
function inventoryWeaponDescription(id){
 if(id===6)return "Fast and agile. Press V in a match to switch to Dual Kriss.";
 return INVENTORY_DESCRIPTIONS[WP[id].stats.kind]||"Ready for your loadout.";
}
var inventoryTab="main",inventoryPick={},inventoryScroll={},inventoryState={equipped:{},unlockedMain:[]};
// Inventory filters are visual-only. Shop ownership and equipped weapons remain authoritative.
var inventoryClass="all";
var INVENTORY_CLASSES=[["all","ALL"],["rifle","ASSAULT"],["smg","SMG"],["sniper","SNIPER"],["shotgun","SHOTGUN"],["rocket","LAUNCHER"]];
function inventoryViewIds(){
 var ids=inventoryTab==="main"?inventoryCatalogMain():inventoryOwned(inventoryTab);
 if(inventoryTab!=="main")return ids;
 if(inventoryClass!=="all")ids=ids.filter(function(id){return WP[id].stats.kind===inventoryClass;});
 return ids;
}
function inventoryStatPercent(label,value,weapon){
 var n=Number(value);if(!Number.isFinite(n))return null;
 var max=label==="DAMAGE"?200:label==="RANGE"?180:label==="AMMO"?weapon.mag+weapon.res:100;
 return Math.max(0,Math.min(100,Math.round(n/Math.max(1,max)*100)));
}
function inventoryCatalogMain(){
  var kinds=INVENTORY_TABS[0].kinds;
  return WP.reduce(function(ids,w,id){if(kinds.indexOf(w.stats.kind)>=0)ids.push(id);return ids;},[]);
}
function inventoryOwned(cat){
 var c=INVENTORY_TABS.filter(function(t){return t.key===cat;})[0],ids=[];
 if(!c)return ids;
 if(INVENTORY_GEAR[cat])return INVENTORY_GEAR[cat].map(function(gear){return gear.id;});
 if(cat==="main"){
   // Only the issued K2 is owned on a fresh profile. Old inventory settings
   // never implied that other rifles were purchased or unlocked.
   return inventoryCatalogMain().filter(function(id){
     return id===WEAPON_STARTER_ID||inventoryState.unlockedMain.indexOf(id)>=0;
   });
 }
 WP.forEach(function(w,id){if(c.kinds.indexOf(w.stats.kind)>=0)ids.push(id);});
 return ids;
}
function inventorySave(){
 try{localStorage.setItem(INVENTORY_STORAGE,JSON.stringify(inventoryState));}catch(err){}
}
function inventoryClaimPrimary(id){
 if(id===WEAPON_STARTER_ID||inventoryCatalogMain().indexOf(id)<0||inventoryOwned("main").indexOf(id)>=0)return false;
 inventoryState.unlockedMain.push(id);
 inventorySave();refreshWeaponSelection();
 return true;
}
function inventoryEquipped(cat){
 var ids=inventoryOwned(cat),id=inventoryState.equipped[cat];
 return ids.indexOf(id)>=0?id:(ids.length?ids[0]:null);
}
function inventoryLoad(){
 var saved=null;try{saved=JSON.parse(localStorage.getItem(INVENTORY_STORAGE));}catch(err){}
 inventoryState.unlockedMain=Array.isArray(saved&&saved.unlockedMain)?
   saved.unlockedMain.filter(function(id){return Number.isInteger(id)&&id!==WEAPON_STARTER_ID&&inventoryCatalogMain().indexOf(id)>=0;}):[];
 inventoryState.unlockedMain=inventoryState.unlockedMain.filter(function(id,i,list){return list.indexOf(id)===i;});
 INVENTORY_TABS.forEach(function(c){
   var ids=inventoryOwned(c.key),wish=saved&&saved.equipped&&saved.equipped[c.key];
   // Migrate older inventory saves that treated Dual Kriss as an owned item.
   if(c.key==="main"&&wish===7)wish=6;
   inventoryState.equipped[c.key]=ids.indexOf(wish)>=0?wish:(ids.length?ids[0]:null);
 });
 var primary=inventoryEquipped("main");if(primary!==null)favPrim=primary;
 refreshWeaponSelection();
}
function inventoryForNewMatch(){
 var id=inventoryEquipped("main");if(id!==null)favPrim=id;
}
function inventoryEquip(cat,id){
 if(inventoryOwned(cat).indexOf(id)<0)return false;
 inventoryState.equipped[cat]=id;
 if(cat==="main")favPrim=id;
 inventorySave();
 inventoryRender();return true;
}
// Pose specifications apply to a weapon TYPE, not duplicated weapon IDs.
// Positions are in the character's body space; IK handles the hands and elbows.
var INVENTORY_POSES={
 rifle:{gun:[.05,1.1,.35],rot:[-.04,Math.PI,-.04],scale:1.55,right:[.14,.95,.56],left:[-.17,1.10,.59]},
 shotgun:{gun:[.04,1.06,.35],rot:[-.08,Math.PI,-.09],scale:1.65,right:[.13,.94,.54],left:[-.15,1.08,.63]},
 smg:{gun:[.09,1.10,.43],rot:[-.06,Math.PI,-.07],scale:1.65,right:[.19,.95,.62],left:[-.13,1.10,.62]},
 dual:{gun:[.10,1.10,.43],rot:[-.06,Math.PI,-.07],scale:1.45,right:[.20,.95,.62],left:[-.12,1.10,.62]},
 sniper:{gun:[.06,1.12,.35],rot:[-.03,Math.PI,-.06],scale:1.45,right:[.16,.99,.58],left:[-.18,1.12,.60]},
 rocket:{gun:[.23,1.40,.33],rot:[-.03,Math.PI,-.10],scale:1.25,right:[.29,1.20,.56],left:[-.12,1.17,.65]},
 pistol:{gun:[.19,1.10,.48],rot:[-.03,Math.PI,-.07],scale:1.7,right:[.24,1.03,.60],left:[.08,.99,.57]},
 knife:{gun:[.34,.91,.43],rot:[-.42,Math.PI,-.12],scale:1.55,right:[.34,.90,.47],left:[-.21,.94,.20]},
 grenade:{gun:[.31,1.11,.41],rot:[-.48,Math.PI,-.08],scale:1.6,right:[.32,1.08,.44],left:[-.19,.96,.23]}
};
function inventoryPoseFor(id){
 return INVENTORY_POSES[WP[id]&&WP[id].stats.kind]||INVENTORY_POSES.rifle;
}
var inventoryPreview=null,inventoryPreviewLive=false,inventoryAngle=.14;
// A single transparent 3D preview; no separate web asset or fake character image.
function inventoryPreviewInit(){
 if(inventoryPreview)return;
 var host=document.getElementById("ivpreview"),scene=new T.Scene(),
 camera=new T.PerspectiveCamera(37,1,.1,60);
 camera.position.set(2.45,2.30,3.8);camera.lookAt(0,1.22,0);
 scene.add(new T.HemisphereLight(0xffffff,0x65748c,1.9));
 var light=new T.DirectionalLight(0xffdfb4,1.5);light.position.set(4,6,5);scene.add(light);
 var rim=new T.DirectionalLight(0x86b9ff,1.0);rim.position.set(-3,2,-4);scene.add(rim);
 var actor=terro(0);S.remove(actor.g);scene.add(actor.g);
 var mount=actor.g.userData.gun;
 if(actor.g.userData.rg)mount.remove(actor.g.userData.rg);
 var guns=WP.map(function(w,id){
   var g=mkGun(id);g.visible=false;mount.add(g);return g;
 });
 var renderer=new T.WebGLRenderer({alpha:true,antialias:true});
 renderer.setClearColor(0x000000,0);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
 renderer.domElement.className="ivcanvas";host.insertBefore(renderer.domElement,host.firstChild);
 var down=false,x=0;
 renderer.domElement.addEventListener("pointerdown",function(e){down=true;x=e.clientX;try{this.setPointerCapture(e.pointerId);}catch(err){}});
 renderer.domElement.addEventListener("pointermove",function(e){if(down){inventoryAngle+=(e.clientX-x)*.012;x=e.clientX;}});
 renderer.domElement.addEventListener("pointerup",function(){down=false;});
 renderer.domElement.addEventListener("pointercancel",function(){down=false;});
 inventoryPreview={host:host,actor:actor,actors:[actor,null],side:0,mount:mount,guns:guns,renderer:renderer,scene:scene,camera:camera,selected:null};
}
// Reuse ONE renderer/scene and move its canvas between Inventory and Room Lobby.
function inventoryPreviewMount(hostId){
 inventoryPreviewInit();
 var p=inventoryPreview,host=document.getElementById(hostId);
 if(p.host!==host){
  host.insertBefore(p.renderer.domElement,host.firstChild);
  p.host=host;
 }
}
// Reuse the same renderer and weapon meshes for both real gameplay team actors.
function inventoryPreviewSetSide(side){
 inventoryPreviewInit();
 var p=inventoryPreview,next=side===1?1:0;
 if(p.side===next)return;
 var actor=p.actors[next];
 if(!actor){
  actor=terro(next);S.remove(actor.g);p.scene.add(actor.g);
  if(actor.g.userData.rg)actor.g.userData.gun.remove(actor.g.userData.rg);
  p.actors[next]=actor;
 }
 p.actor.g.visible=false;
 var mount=actor.g.userData.gun;
 p.guns.forEach(function(g){mount.add(g);});
 p.actor=actor;p.mount=mount;p.side=next;actor.g.visible=true;
}
// Room always displays the primary weapon actually equipped (IN USE), not a
// highlighted catalog item, guessed weapon ID, or temporary in-match pickup.
function inventoryRoomPreviewOpen(side){
 var id=inventoryEquipped("main"),weapon=id===null?null:WP[id];
 document.getElementById("rmlWeaponName").textContent=weapon?weapon.n:"NO PRIMARY";
 document.getElementById("rmlWeaponClass").textContent=weapon?inventoryWeaponRole(weapon.stats.kind):"PRIMARY";
 inventoryPreviewSetSide(side);
 inventoryShowModel(weapon?id:null);
 inventoryPreviewMount("rmlpreview");
 inventoryStartPreview();
}
// Room Browser reuses Inventory's ONE live soldier renderer and equipped primary.
// This is the same actual Police character and mkGun geometry, never a mock asset.
function inventoryBrowserPreviewOpen(){
 var id=inventoryEquipped("main");
 inventoryPreviewSetSide(0);
 inventoryShowModel(id);
 inventoryPreviewMount("roomBrowserPreview");
 inventoryStartPreview();
}
function inventoryShowModel(id){
 inventoryPreviewInit();
 var p=inventoryPreview;p.selected=id;
 p.guns.forEach(function(g,j){g.visible=id===j;});
}
function inventoryPoseFrame(p,now){
 var a=p.actor,id=p.selected,pose=inventoryPoseFor(id===null?1:id),
 t=now*.001,breath=Math.sin(t*1.8),sway=Math.sin(t*.9);
 // Neutral combat-ready posture: gun on chest, one/two-handed grip and small breathing sway.
 a.g.rotation.y=inventoryAngle+Math.sin(t*.55)*.024;
 a.body.position.y=breath*.013;
 a.body.rotation.set(-.018+breath*.008,sway*.012,Math.sin(t*.7)*.010);
 a.legs[0].rotation.x=-.025+sway*.018;
 a.legs[1].rotation.x=.025-sway*.018;
 if(typeof id!=="number"){
  // No invisible rifle in the helm or utility preview.
  p.mount.visible=false;
  aimA(a.arms[1],.55,1.3,.62,.69,.10,1);
  aimA(a.arms[0],-.55,1.3,-.62,.69,.10,-1);
  return;
 }
 p.mount.visible=true;
 p.mount.position.set(pose.gun[0]+sway*.008,pose.gun[1]+breath*.014,pose.gun[2]);
 p.mount.rotation.set(0,0,0);
 // mkGun points toward -z, so rotate it toward the character's forward (+z).
 var gun=p.guns[id===null?1:id];
 gun.position.set(0,0,0);
 gun.rotation.set(pose.rot[0]+breath*.008,pose.rot[1]+sway*.008,pose.rot[2]);
 gun.scale.setScalar(pose.scale);
 // Use the game's production two-bone IK for both arms. Fingers stay on the gun
 // instead of the old mannequin pose with a weapon hovering beside the hand.
 var r=pose.right,l=pose.left,y=breath*.012;
 aimA(a.arms[1],.55,1.3,r[0],r[1]+y,r[2],1);
 aimA(a.arms[0],-.55,1.3,l[0],l[1]+y,l[2],-1);
}
function inventoryPreviewFrame(now){
 // The lobby class may remain on its page while #lb is hidden in a match.
 // Do not spend GPU time rendering an invisible Inventory/Room 3D preview.
 var inInventory=lob&&document.getElementById("lbiv").classList.contains("on"),
     inRoom=lob&&document.getElementById("lbroomlive").classList.contains("on"),
     inBrowser=lob&&document.getElementById("lbrooms").classList.contains("on");
 if(!inInventory&&!inRoom&&!inBrowser){inventoryPreviewLive=false;return;}
 var p=inventoryPreview,hostId=inRoom?"rmlpreview":inBrowser?"roomBrowserPreview":"ivpreview";
 inventoryPreviewMount(hostId);
 var w=Math.max(1,p.host.clientWidth),h=Math.max(1,p.host.clientHeight);
 if(p.renderer.domElement.width!==Math.round(w*p.renderer.getPixelRatio())||
    p.renderer.domElement.height!==Math.round(h*p.renderer.getPixelRatio())){
   p.renderer.setSize(w,h,false);p.camera.aspect=w/h;p.camera.updateProjectionMatrix();
 }
 inventoryPoseFrame(p,now);
 if(inInventory&&inventoryTab==="helm"){
  p.camera.position.set(1.35,2.05,2.35);
  p.camera.lookAt(0,1.68,0);
 }else if(inRoom||inBrowser){
  // Keep the actual soldier and held weapon visible in tall, narrow lobby panels.
  var pullback=Math.max(1,Math.min(1.75,.73/(w/h)));
  p.camera.position.set(2.45*pullback,2.30+(pullback-1)*1.05,3.8*pullback);
  p.camera.lookAt(0,1.22,0);
 }else{
  p.camera.position.set(2.45,2.30,3.8);
  p.camera.lookAt(0,1.22,0);
 }
 p.renderer.render(p.scene,p.camera);
 requestAnimationFrame(inventoryPreviewFrame);
}
function inventoryStartPreview(){
 inventoryPreviewInit();
 if(!inventoryPreviewLive){inventoryPreviewLive=true;requestAnimationFrame(inventoryPreviewFrame);}
}
// One-time COLOR thumbnails rendered from mkGun() with its original materials.
// One temporary WebGL renderer draws each card, then releases its context.
var INVENTORY_THUMBS={};
function inventoryBuildThumbnails(){
 if(INVENTORY_THUMBS.ready)return;
 var renderer=null,scene=null;
 try{
   renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
   renderer.setPixelRatio(1);renderer.setSize(256,120,false);
   renderer.setClearColor(0x000000,0);
   scene=new T.Scene();
   scene.add(new T.HemisphereLight(0xffffff,0x65748c,2.1));
   var key=new T.DirectionalLight(0xffe2bd,1.6);key.position.set(1,3,5);scene.add(key);
   var fill=new T.DirectionalLight(0xb9d8ff,1.2);fill.position.set(-2,1,-3);scene.add(fill);
   var camera=new T.OrthographicCamera(-1.55,1.55,.73,-.73,.1,40);
   camera.position.set(0,.32,6);camera.lookAt(0,0,0);
   var ids=inventoryCatalogMain();INVENTORY_TABS.forEach(function(tab){
     if(tab.key==="main")return;
     inventoryOwned(tab.key).forEach(function(id){if(ids.indexOf(id)<0)ids.push(id);});
   });
   ids.forEach(function(id){
     // Use the same real helmet geometry as the live Police character.
     var helm=!!inventoryGear(id);
     var gun=helm?mkHelm(0x1c3d7a):mkGun(id);
     if(helm)gun.position.set(0,0,0);
     scene.add(gun);
     gun.rotation.set(-.13,helm?.42:Math.PI/2+.12,0);
     gun.updateMatrixWorld(true);
     var box=new T.Box3().setFromObject(gun),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
     gun.position.sub(center);
     gun.scale.setScalar(Math.min(2.65/Math.max(size.x,.001),1.07/Math.max(size.y,.001),2.3));
     renderer.render(scene,camera);
     INVENTORY_THUMBS[id]=renderer.domElement.toDataURL("image/png");
     scene.remove(gun);
     gun.traverse(function(o){if(o.geometry)o.geometry.dispose();if(o.material){var mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(function(m){m.dispose();});}});
   });
   INVENTORY_THUMBS.ready=true;
 }catch(err){
   // Leave empty thumbnails rather than substitute misleading white silhouettes.
   INVENTORY_THUMBS.ready=true;
   if(typeof console!=="undefined")console.warn("Inventory weapon thumbnails unavailable",err);
 }finally{
   if(renderer){renderer.dispose();if(renderer.forceContextLoss)renderer.forceContextLoss();}
 }
}
function inventoryValue(v){return v===null||v===undefined?"—":v===Infinity?"∞":String(v);}
function inventoryWeaponRole(kind){return WEAPON_CLASS_LABELS[kind]||"WEAPON";}
var INVENTORY_CRATE_SVG='<svg viewBox="0 0 220 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+
 '<path d="M37 45h146l18 26v63H19V71z" fill="#182d45" stroke="#ffae58" stroke-width="4"/>'+
 '<path d="M37 45h146l-20 28H57z" fill="#38546a" stroke="#a8c8d5" stroke-width="3"/>'+
 '<path d="M19 72h182M65 72v62m90-62v62" stroke="#46677f" stroke-width="4"/>'+
 '<path d="M95 88h30v29H95z" fill="#e87b20"/><path d="M104 94h12m-6-6v18" stroke="#fff3ca" stroke-width="3"/>'+
 '<path d="M19 125h34m114 0h34" stroke="#ffae58" stroke-width="5"/>'+
 '<path d="M30 37h160" stroke="#7fc2e4" stroke-width="2" stroke-dasharray="8 7"/>'+
 '</svg>';
function inventoryRender(){
 var ids=inventoryViewIds(),owned=inventoryOwned(inventoryTab),equipped=inventoryEquipped(inventoryTab),
 selected=inventoryPick[inventoryTab];
 if(ids.indexOf(selected)<0)selected=ids.indexOf(equipped)>=0?equipped:(ids.length?ids[0]:null);
 inventoryPick[inventoryTab]=selected;
 var tabs=document.getElementById("ivtabs"),cards=document.getElementById("ivcards"),stats=document.getElementById("ivstats"),
 root=document.getElementById("lbiv"),filters=document.getElementById("ivfilters");
 tabs.textContent="";
 INVENTORY_TABS.forEach(function(c){
   var b=document.createElement("button");b.type="button";b.textContent=c.label;
   b.className=c.key===inventoryTab?"on":"";
   b.setAttribute("aria-pressed",c.key===inventoryTab?"true":"false");
   b.onclick=function(){inventoryScroll[inventoryTab]=cards.scrollTop;inventoryTab=c.key;inventoryRender();};
   tabs.appendChild(b);
 });
 root.classList.toggle("iv-main",inventoryTab==="main");
 root.classList.toggle("iv-helm",inventoryTab==="helm");
 root.classList.toggle("iv-item",inventoryTab==="item");
 filters.style.display=inventoryTab==="main"?"flex":"none";
 var classes=document.getElementById("ivclasses");classes.textContent="";
 INVENTORY_CLASSES.forEach(function(item){
   var btn=document.createElement("button");btn.type="button";btn.textContent=item[1];
   btn.className=inventoryClass===item[0]?"on":"";
   btn.setAttribute("aria-pressed",inventoryClass===item[0]?"true":"false");
   btn.onclick=function(){inventoryClass=item[0];inventoryScroll[inventoryTab]=0;inventoryRender();};
   classes.appendChild(btn);
 });
 cards.textContent="";
 cards.classList.toggle("ivcards-empty",!ids.length);
 if(!ids.length){
   var empty=document.createElement("div");empty.className="ivempty ivempty-gear";
   if(inventoryTab==="main"){
     empty.innerHTML='<strong>NO WEAPONS IN THIS CLASS</strong><p>Choose a different category.</p>';
   }else{
     empty.innerHTML='<span class="ivempty-kicker">TACTICAL SUPPLIES</span>'+
      '<div class="ivempty-image">'+INVENTORY_CRATE_SVG+'</div>'+
      '<span class="ivempty-pill">COMING SOON</span>'+
      '<strong>NO TACTICAL ITEM YET</strong>'+
      '<p>New utility gear will be available in future updates.</p>';
   }
   cards.appendChild(empty);
 }
 ids.forEach(function(id){
   var item=document.createElement("button"),gear=inventoryGear(id),name=gear?gear.name:WP[id].n;
   var locked=owned.indexOf(id)<0,kind=gear?"HELM":inventoryWeaponRole(WP[id].stats.kind);
   item.type="button";
   item.className="ivcard"+(gear?" ivcard-helm":"")+(id===selected?" selected":"")+
       (id===equipped?" equipped":"")+(locked?" locked":"");
   item.setAttribute("aria-label",name+(locked?" locked, unlock in Shop":"")+"; view details");
   var image=INVENTORY_THUMBS[id]?
      '<img class="ivthumb" src="'+INVENTORY_THUMBS[id]+'" alt="'+name+' 3D gear preview">':
      '<span class="ivthumb-fallback">3D PREVIEW UNAVAILABLE</span>';
   item.innerHTML='<span class="ivweaponicon">'+image+'</span><span class="ivweaponinfo"><strong>'+
      name+'</strong><small>'+kind+'</small></span><span class="ivmark">'+
      (gear?"DEFAULT":locked?"LOCKED":id===equipped?"IN USE":"")+'</span>';
   item.onclick=function(){inventoryScroll[inventoryTab]=cards.scrollTop;inventoryPick[inventoryTab]=id;inventoryRender();};
   cards.appendChild(item);
 });
 if(inventoryTab==="helm"&&ids.length===1){
   var coming=document.createElement("div");coming.className="ivfuture";
   coming.innerHTML='<span>COMING SOON</span><strong>CUSTOM HELMETS</strong>'+
     '<p>New looks for your soldier are on the way.</p>';
   cards.appendChild(coming);
 }
 cards.scrollTop=inventoryScroll[inventoryTab]||0;
 document.querySelector("#lbiv .ivhint").textContent=INVENTORY_HINTS[inventoryTab];
 var gear=inventoryGear(selected),lockedSelection=selected!==null&&owned.indexOf(selected)<0,
     name=gear?gear.name:selected===null?"TACTICAL GEAR":WP[selected].n,
     role=gear?"HELM":selected===null?"ITEM":inventoryWeaponRole(WP[selected].stats.kind),
     status=gear?"DEFAULT":selected===null?"COMING SOON":lockedSelection?"LOCKED":selected===equipped?"IN USE":"OWNED";
 document.getElementById("ivcategory").textContent=role;
 document.getElementById("ivname").textContent=name;
 document.getElementById("ivstatus").textContent=status;
 document.getElementById("ivdetailname").textContent=name;
 document.getElementById("ivdetailclass").textContent=role;
 var detail=document.getElementById("ivdetailthumb");
 detail.hidden=!INVENTORY_THUMBS[selected];
 if(!detail.hidden){detail.src=INVENTORY_THUMBS[selected];detail.alt=name+" 3D gear preview";}
 document.getElementById("ivdescription").textContent=gear?gear.description:selected===null?
   "New utility gear will be available in future updates.":
   inventoryWeaponDescription(selected);
 stats.textContent="";
 var rows=[];
 if(gear)rows=[["SLOT","HEAD"],["TYPE","STANDARD"],["STATUS","EQUIPPED"]];
 else if(selected!==null){
   var st=WP[selected].stats;
   rows=[["DAMAGE",st.damage],["CONTROL",st.control],["SPEED",st.speed],["RANGE",st.range],
     ["FIRE RATE",st.rpm],["AMMO",st.mag+"/"+inventoryValue(st.res)]];
 }
 rows.forEach(function(pair){
   var node=document.createElement("div"),label=document.createElement("span"),value=document.createElement("strong");
   node.className="ivstat";label.textContent=pair[0];value.textContent=inventoryValue(pair[1]);
   node.appendChild(label);node.appendChild(value);
   var track=document.createElement("span"),fill=document.createElement("i");
   track.className="ivstat-track";
   var weapon=selected!==null&&!gear?WP[selected]:null;
   var numeric=pair[0]==="AMMO"?weapon&&weapon.mag:pair[1],
     pct=weapon?inventoryStatPercent(pair[0],numeric,weapon):null;
   if(pct===null)node.className+=" ivstat-text";
   else fill.style.width=pct+"%";
   track.appendChild(fill);node.appendChild(track);stats.appendChild(node);
 });
 var use=document.getElementById("ivuse");
 use.disabled=selected===null||(!lockedSelection&&selected===equipped);
 use.textContent=selected===null?"COMING SOON":lockedSelection?"UNLOCK IN SHOP":
     gear?"EQUIPPED":selected===equipped?"EQUIPPED":"EQUIP";
 use.onclick=function(){
   if(selected===null)return;
   if(lockedSelection){if(typeof shopOpen==="function")shopOpen();return;}
   inventoryEquip(inventoryTab,selected);
 };
 inventoryShowModel(selected);
}
function inventoryOpen(){
 inventoryTab="main";inventoryClass="all";
 inventoryAngle=.14;lobP("lbiv");
 inventoryPreviewMount("ivpreview");inventoryPreviewSetSide(0);inventoryBuildThumbnails();inventoryRender();inventoryStartPreview();
}
inventoryLoad();
document.getElementById("ivcards").addEventListener("scroll",function(){
 inventoryScroll[inventoryTab]=this.scrollTop;
},{passive:true});
document.getElementById("lbin").addEventListener("click",inventoryOpen);
document.getElementById("ivback").addEventListener("click",function(){lobP("lbs");});
// Shop unlocks the existing non-starter primaries without inventing a coin economy.
// New players only own K2. Shop unlock is free until a priced economy is specified.
var shopFilter="ALL",shopAnim=true,shopFlashId=-1,shopAcc={},shopSelectedId=null;
var SHOP_ACCENTS=["#ff922b","#4dc3ff","#ff5c6c","#b388ff","#70e1a5","#ffd43b","#f783ac","#74c0fc"];
function shopCatalog(){
  return inventoryCatalogMain().filter(function(id){return id!==WEAPON_STARTER_ID;});
}
function shopEl(tag,cls,text){
  var e=document.createElement(tag);
  if(cls)e.className=cls;
  if(text!==undefined)e.textContent=text;
  return e;
}
function shopNum(v){var n=parseFloat(v);return isFinite(n)?n:0;}
function shopRole(id){return inventoryWeaponRole(WP[id].stats.kind);}
// Each weapon class keeps the same accent colour in the filter bar and on its cards.
function shopAccent(role){
  if(!shopAcc[role])shopAcc[role]=SHOP_ACCENTS[Object.keys(shopAcc).length%SHOP_ACCENTS.length];
  return shopAcc[role];
}
function shopStat(label,value,max){
  var row=shopEl("div","shop-stat"),bar=shopEl("span","ss-b"),fill=shopEl("span");
  fill.style.width=Math.max(6,Math.min(100,max>0?shopNum(value)/max*100:0))+"%";
  bar.appendChild(fill);
  row.appendChild(shopEl("span","ss-l",label));row.appendChild(bar);row.appendChild(shopEl("span","ss-v",value));
  return row;
}
function shopBuildFilter(roles,ids){
  var grid=document.getElementById("shopGrid"),bar=document.getElementById("shopFilter");
  if(!bar){bar=shopEl("div","shop-filter");bar.id="shopFilter";grid.parentNode.insertBefore(bar,grid);}
  bar.textContent="";
  if(roles.indexOf(shopFilter)<0)shopFilter="ALL";
  ["ALL"].concat(roles).forEach(function(r){
    var n=r==="ALL"?ids.length:ids.filter(function(id){return shopRole(id)===r;}).length;
    var chip=shopEl("button","shop-chip"+(r===shopFilter?" shop-chip-on":""),r);
    chip.type="button";chip.style.setProperty("--acc",r==="ALL"?"#ff922b":shopAccent(r));
    chip.appendChild(shopEl("span","",n));
    chip.onclick=function(){shopFilter=r;shopAnim=true;grid.scrollTop=0;shopRender();};
    bar.appendChild(chip);
  });
}
function shopRender(){
  var grid=document.getElementById("shopGrid"),ids=shopCatalog(),owned=inventoryOwned("main"),
      roles=[],max={d:1,s:1,m:1},flash=shopFlashId,shown=0,scrollPosition=grid.scrollTop;
  shopFlashId=-1;
  // Bar lengths are relative to the strongest weapon in the shop, so no assumptions about stat scales.
  ids.forEach(function(id){
    var w=WP[id],r=shopRole(id);
    if(roles.indexOf(r)<0)roles.push(r);
    shopAccent(r);
    max.d=Math.max(max.d,shopNum(w.stats.damage));
    max.s=Math.max(max.s,shopNum(w.stats.speed));
    max.m=Math.max(max.m,shopNum(w.mag));
  });
  shopBuildFilter(roles,ids);
  if(ids.indexOf(shopSelectedId)<0)shopSelectedId=ids[0];
  if(shopFilter!=="ALL"&&shopRole(shopSelectedId)!==shopFilter)shopSelectedId=ids.filter(function(id){return shopRole(id)===shopFilter;})[0];
  shopRenderSelection(ids,owned,max);
  grid.textContent="";
  ids.forEach(function(id,index){
    var w=WP[id],role=shopRole(id);
    if(shopFilter!=="ALL"&&role!==shopFilter)return;
    var isOwned=owned.indexOf(id)>=0;
    var tile=shopEl("article","shop-weapon"+(id===shopSelectedId?" shop-weapon-active":"")+(isOwned?" shop-owned":"")+(shopAnim?" shop-enter":"")+(id===flash?" shop-unlocked":""));
    tile.style.setProperty("--acc",shopAccent(role));tile.style.setProperty("--i",shown);
    tile.tabIndex=0;tile.setAttribute("role","button");tile.setAttribute("aria-pressed",String(id===shopSelectedId));
    tile.onclick=function(){shopSelectedId=id;shopAnim=false;shopRender();};
    tile.onkeydown=function(e){if(e.target===tile&&(e.key==="Enter"||e.key===" ")){e.preventDefault();tile.click();}};
    var media=shopEl("div","shop-art");
    media.appendChild(shopEl("span","shop-num",(index<9?"0":"")+(index+1)));
    media.appendChild(shopEl("span","shop-tag",role));
    if(INVENTORY_THUMBS[id]){
      var img=document.createElement("img");img.src=INVENTORY_THUMBS[id];
      img.alt=w.n+" weapon model";img.loading="lazy";media.appendChild(img);
    }else{
      media.appendChild(shopEl("span","","PREVIEW UNAVAILABLE"));
    }
    if(isOwned)media.appendChild(shopEl("span","shop-ribbon","OWNED"));
    var details=shopEl("div","shop-details");
    details.appendChild(shopEl("h3","",w.n));
    var stats=shopEl("div","shop-stats");
    stats.appendChild(shopStat("DAMAGE",w.stats.damage,max.d));
    stats.appendChild(shopStat("SPEED",w.stats.speed,max.s));
    stats.appendChild(shopStat("MAGAZINE",w.mag,max.m));
    details.appendChild(stats);
    var ammo=shopEl("div","shop-ammo","AMMO ");
    ammo.appendChild(shopEl("b","",w.mag+" / "+w.res));
    details.appendChild(ammo);
    var action=shopEl("button","shop-action"+(isOwned?" shop-action-owned":""),isOwned?"\u2713 OWNED":"UNLOCK FREE");
    action.type="button";action.disabled=isOwned;
    action.onclick=function(e){e.stopPropagation();
      if(inventoryClaimPrimary(id)){shopAnim=false;shopFlashId=id;shopRender();toast("UNLOCKED: "+w.n);}
    };
    tile.appendChild(media);tile.appendChild(details);tile.appendChild(action);
    grid.appendChild(tile);shown++;
  });
  grid.scrollTop=scrollPosition;
  shopAnim=false;
}
function shopRenderSelection(ids,owned,max){
 var id=shopSelectedId,host=document.getElementById("shopSelected");
 if(!host||id===undefined||!WP[id])return;
 var w=WP[id],role=shopRole(id),isOwned=owned.indexOf(id)>=0;
 var changed=host.dataset.selected!==String(id);
 host.textContent="";host.style.setProperty("--acc",shopAccent(role));
 host.dataset.selected=String(id);if(changed)host.scrollTop=0;
 var head=shopEl("div","shop-sel-heading");
 head.appendChild(shopEl("span","shop-sel-role",role));
 head.appendChild(shopEl("span","shop-sel-badge",isOwned?"OWNED":"AVAILABLE"));
 head.appendChild(shopEl("h3","",w.n));
 head.appendChild(shopEl("p","",inventoryWeaponDescription(id)));
 host.appendChild(head);
 var preview=shopEl("div","shop-sel-preview");
 if(INVENTORY_THUMBS[id]){var img=document.createElement("img");img.src=INVENTORY_THUMBS[id];img.alt=w.n+" model preview";preview.appendChild(img);}
 else preview.appendChild(shopEl("span","","PREVIEW UNAVAILABLE"));
 host.appendChild(preview);
 host.appendChild(shopEl("h4","shop-sel-stats-title","WEAPON STATS"));
 var stats=shopEl("div","shop-sel-stats");
 [["DAMAGE",w.stats.damage],["FIRE RATE",w.stats.rpm],["CONTROL",w.stats.control],["SPEED",w.stats.speed],["VERTICAL RECOIL",w.stats.vRecoil],["HORIZONTAL RECOIL",w.stats.hRecoil],["RANGE",w.stats.range],["MAGAZINE",w.mag]].forEach(function(pair){
 if(pair[1]===undefined)return;
 stats.appendChild(shopStat(pair[0],pair[1],pair[0]==="DAMAGE"?max.d:pair[0]==="MAGAZINE"?max.m:pair[0]==="RANGE"?180:100));
 });
 host.appendChild(stats);
 var ammo=shopEl("div","shop-sel-ammo","AMMO ");
 ammo.appendChild(shopEl("b","",w.mag+" / "+w.res));host.appendChild(ammo);
 var action=shopEl("button","shop-action shop-sel-action"+(isOwned?" shop-action-owned":""),isOwned?"✓ OWNED":"UNLOCK FREE");
 action.type="button";action.disabled=isOwned;
 action.onclick=function(){if(inventoryClaimPrimary(id)){shopAnim=false;shopFlashId=id;shopRender();toast("UNLOCKED: "+w.n);}};
 host.appendChild(action);
}
function shopOpen(){
  lobP("lbshop");shopAnim=true;inventoryBuildThumbnails();document.getElementById("shopGrid").scrollTop=0;shopRender();
}
document.getElementById("lshop").addEventListener("click",shopOpen);
document.getElementById("shopBack").addEventListener("click",function(){lobP("lbs");});// ---- BOT PATH-FINDING GRID ----
// GB = walkability grid (GN x GN cells). GCS = grid cell size in world units.
// NOTE: the cell size is named GCS (not GS) on purpose. GS is already the array of gun sound presets; reusing the name GS here would overwrite it and silence the player gun sounds.
var GN=0,GB=null,GCS=1;
// gc(): converts a world coordinate to a grid cell index.
function gc(v){return Math.max(0,Math.min(GN-1,Math.floor((v+A)/GCS)));}
// gInit(): builds the walkability grid from OB (solid boxes).
function gInit(){GCS=isBombMode()?1.5:1;GN=Math.ceil(2*A/GCS);GB=new Uint8Array(GN*GN);for(var cz=0;cz<GN;cz++)for(var cx=0;cx<GN;cx++){var x=-A+(cx+.5)*GCS,z=-A+(cz+.5)*GCS;GB[cz*GN+cx]=(inObs(x,z,.6)||Math.abs(x)>A-1||Math.abs(z)>A-1)?1:0;}}
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
function botPath(e,gx,gz){var p=gPath(e.x,e.z,gx,gz);
  if(typeof botQaEnabled!=='undefined'&&botQaEnabled)botQaPath(p);
  // Never charge directly into a solid wall if A* finds no route.
  // Never fall back to a direct wall-crossing goal if A* has no route.
  e.path=p||[];e.pi=0;e.pt=1.1+Math.random()*.8;e.goalX=gx;e.goalZ=gz;
}
// botsUpd(dt): LIVE bot AI (movement along paths, target choice, line-of-sight, shooting with fire(..., "e")).
function botsUpd(dt){var i,cdn=mt.cd>0;if(!GB)gInit();
  for(i=rq.length-1;i>=0;i--){var q=rq[i];q.t-=dt;if(q.t<=0&&!mt.over&&!isBombMode()){var nb=newBot(q.b.tm,q.b.idx);nb.st=q.b.st;placeBot(nb);rq.splice(i,1);}}
  en.forEach(function(e){var t,dx=0,dz=0,d=99,f,mvx=0,mvz=0,sp=isBombMode()?BOMB_AI.navSpeed*(e.tm===0&&bombUncontestedRetake()?BOMB_AI.clearSiteSpeedMultiplier:1):4.8,ox=e.x,oz=e.z,combat,gx,gz,wp,ml,intent;
    botUpdateReload(e,dt);e.inv=Math.max(0,(e.inv||0)-(cdn?0:dt));e.vis=Math.max(0,(e.vis||0)-dt);e.tq=(e.tq||0)-dt;e.navT=Math.max(0,(e.navT||0)-dt);
    if(e.tq<=0){e.tq=.22+Math.random()*.16;
      // Target acquisition is an actual observation, never an unseen enemy pointer.
      e.tg=isBombMode()?botIntelAcquire(e):botTdmAcquire(e);e.lok=!!e.tg;
      botIntelHearing(e);
      if(isBombMode()){var objective=bombBotGoal(e);if(objective){e.wx=objective[0];e.wz=objective[1];}}
      if(!e.tg&&!isBombMode()){
        // Pursue the last visible contact, never unseen live player coordinates.
        var clue=botIntelKnown(e);
        if(clue){e.wx=clue.x;e.wz=clue.z;}
        else botTdmPatrol(e);}}
    t=e.tg;
    // Reject the old actor reference immediately after LOS loss. Even pathing
    // must use the last observed snapshot, never new hidden coordinates.
    if(t&&!botIntelVisible(e,t)){t=e.tg=null;e.lok=false;}
    else if(t){botIntelObserve(e,t);e.lok=true;}
    // Bomb carriers and designated defusers prioritize the objective unless an enemy is close.
    if(t&&bombBotWantsObjective(e,t))t=null;
    // Post-plant guards do not pursue opponents far from the device.
    if(t&&isBombMode()&&bombMatch&&bombMatch.state==='planted'&&e.tm===1&&
       bombTacticalStage(e)==='hold'&&Math.hypot(t.x-bombMatch.device.position.x,t.z-bombMatch.device.position.z)>BOMB_AI.roamRadius)t=null;
    botAimUpdate(e,t,dt);
    e.lt=(e.lt||0)-dt;if(t&&e.lt<=0){e.lt=.15;e.lok=los(e.x,e.z,t.x,t.z);}
    if(t){dx=t.x-e.x;dz=t.z-e.z;d=Math.hypot(dx,dz)||1;}
    botSmartReload(e,t);intent=botSmartIntent(e,t);e.smartRetreat=intent.retreat;
    botMoveIntent(e,t,intent);
    botSquadIntent(e,t,intent);
    combat=!!t&&e.lok&&e.navT<=0&&!(intent.retreat&&intent.goal)&&
      !(e.m3Mode==='cover'&&intent.goal)&&!intent.hold;
    sp*=intent.retreat?BOT_TACTICS.retreatSpeed:combat?BOT_TACTICS.fightSpeed:BOT_TACTICS.approachSpeed;
    if(isBombMode()&&e.bAction)combat=false;
    if(combat){var fw=botNeedsMelee(e)?1:(isBombMode()&&bombMatch&&bombMatch.state==='planted'&&e.tm===0)?
      (d>BOMB_AI.retakeCombatDistance?1:-.3):(d>16?1:d<7?-.6:0),st;e.bt=(e.bt||0)-dt;if(e.bt<=0){e.bt=.7+Math.random()*1.4;e.sd=[-1,0,1][(Math.random()*3)|0];}st=(e.sd||0)*.9;
      var dodge=botSmartVelocity(e,d,fw,st);fw=dodge[0];st=dodge[1];
      dodge=botTdmCombatMove(e,d,fw,st);fw=dodge[0];st=dodge[1];
      dodge=botMoveDodge(e,t,dt,fw,st);fw=dodge[0];st=dodge[1];
      mvx=dx/d*fw+(dz/d)*st;mvz=dz/d*fw-(dx/d)*st;
      if(!botMoveIsClear(e,mvx,mvz,sp,dt)){e.sd=-(e.sd||1);}}
    else{gx=intent.goal?intent.goal[0]:(t?t.x:e.wx);gz=intent.goal?intent.goal[1]:(t?t.z:e.wz);e.pt=(e.pt||0)-dt;
      if(!e.path||e.pt<=0||e.stk>.5||
         Math.hypot((e.goalX||0)-gx,(e.goalZ||0)-gz)>(isBombMode()?BOMB_AI.repathGoalDistance:2.4)){
        botPath(e,gx,gz);e.stk=0;
      }
      wp=e.path[e.pi];while(wp&&e.pi<e.path.length-1&&Math.hypot(wp[0]-e.x,wp[1]-e.z)<1.1){e.pi++;wp=e.path[e.pi];}
      if(wp){var wx=wp[0]-e.x,wz=wp[1]-e.z,wl=Math.hypot(wx,wz)||1;if(wl>.4){mvx=wx/wl;mvz=wz/wl;}}}
    if(isBombMode()&&e.bAction||intent.hold)mvx=mvz=0;
    if(!e.bAction&&!intent.hold&&!(isBombMode()&&e.tm===0&&bombUncontestedRetake()&&bombPickDefuser()===e))en.forEach(function(o){if(o!==e&&!o.dead){
      var sx=e.x-o.x,sz=e.z-o.z,sq=Math.hypot(sx,sz),space=isBombMode()?BOMB_AI.teammateSpacing:1.8;
      if(sq<space&&sq>.01){mvx+=sx/sq*.75;mvz+=sz/sq*.75;}
    }});
    var squadLane=botSquadLane(e,mvx,mvz);mvx=squadLane[0];mvz=squadLane[1];
    ml=Math.hypot(mvx,mvz);if(ml>1){mvx/=ml;mvz/=ml;}if(cdn)mvx=mvz=0;
    var wantedMovement=!!(mvx||mvz),holdMovement=cdn||(isBombMode()&&e.bAction)||intent.hold;
    var recovery=botMoveRecovery(e,mvx,mvz,sp,dt,holdMovement);
    var steering=botMoveSteer(e,recovery[0],recovery[1],sp,dt,holdMovement);
    mvx=steering[0];mvz=steering[1];
    f=(t&&e.lok)?e.aimYaw:(mvx||mvz)?Math.atan2(mvx,mvz):e.g.rotation.y;
    e.x+=mvx*sp*dt;e.z+=mvz*sp*dt;resolve(e,.55);
    var dm=Math.hypot(e.x-ox,e.z-oz);
    footstepAdvance(e,dm,!cdn&&dm>.002,sp>4.4,false);
    if(typeof botQaEnabled!=='undefined'&&botQaEnabled)botQaMove(wantedMovement,dm,sp,dt);
    botMoveTrack(e,ox,oz,dt,sp,wantedMovement,combat);
    e.g.rotation.y=f;e.cd-=dt;
    if(t&&e.lok&&!cdn&&!(isBombMode()&&e.bAction)&&e.cd<=0){botCombatTick(e,t,f,d);}
    e.y=(e.y||0)+(gh(e.x,e.z,0)-(e.y||0))*Math.min(1,dt*10);e.g.position.set(e.x,e.y,e.z);e.g.visible=e.inv>0?Math.floor(tt*12)%2===0:true;
    e.wp=(e.wp||0)+dm*2.4;var am=Math.min(1,dm/dt/2.2);e.legs[0].rotation.x=Math.sin(e.wp)*.8*am;e.legs[1].rotation.x=-e.legs[0].rotation.x;e.rc=Math.max(0,(e.rc||0)-dt*6);aimArms(e);
    e.body.position.y=Math.abs(Math.sin(e.wp))*.07*am;e.body.rotation.z=Math.sin(e.wp)*.05*am;e.body.rotation.x=-.05*(e.rc||0);e.body.rotation.y=0;flash(e,dt);
    if(isBombMode()&&e.bAction){e.body.position.y=-.43;e.body.rotation.x=.23;e.legs[0].rotation.x=-.95;e.legs[1].rotation.x=-1.05;e.arms[1].rotation.z=-.7;e.arms[0].rotation.z=.7;}
  });}
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
function escShow(){
 if(!run||mt.over||lob||escEl.style.display==="flex")return;
 escEl.style.display="flex";document.body.classList.add("game-menu-open");escT=performance.now();
 // ESC must free the pointer for actual buttons, not merely show a visual overlay.
 mouse.down=mouse.right=false;fireHeld=false;
 if(typeof keys!=="undefined")keys={};
 if(typeof lookStopDrag==="function")lookStopDrag();
 if(document.pointerLockElement===R.domElement&&document.exitPointerLock)document.exitPointerLock();
}
// escHide(): hides the pause overlay.
function escHide(){escEl.style.display="none";document.body.classList.remove("game-menu-open");}
// lockTry(): tries to re-capture the mouse (pointer lock), retrying a few times.
function lockTry(n){if(touch||!run||mt.over||lob||document.pointerLockElement||escEl.style.display==="flex"||
 (typeof wsOn!=="undefined"&&wsOn))return;try{R.domElement.requestPointerLock();}catch(e){}if(n<4)setTimeout(function(){lockTry(n+1);},400);}
// escResume(): closes the pause overlay and re-locks the mouse.
function escResume(){escHide();lockTry(0);}
document.addEventListener("pointerlockchange",function(){
 // Opening the loadout deliberately releases Pointer Lock; that is not an ESC request.
 if(!document.pointerLockElement&&!(typeof wsOn!=="undefined"&&wsOn))escShow();
});
addEventListener("keydown",function(e){if(e.code!=="Escape"||!run||mt.over||lob)return;if(escEl.style.display==="flex"){if(performance.now()-escT>300)escResume();}else escShow();});
document.getElementById("escR").onclick=function(){this.blur();escResume();};
document.getElementById("escB").onclick=function(){
 this.blur();escHide();
 // Switch to lobby first: pointerlockchange must not reopen GAME MENU mid-transition.
 document.getElementById("dmn").onclick();
 if(document.pointerLockElement&&document.exitPointerLock)document.exitPointerLock();
};
// M7 diagnostic instrumentation: local, opt-in, bounded, decision-independent.
// Enable only via index.html?bbBotQa=1 (including file://); no telemetry by default.
// No network calls, persistence, user identity, coordinates, gameplay changes or UI.
var botQaEnabled=false;
try{
 botQaEnabled=typeof location!=='undefined'&&
   new URLSearchParams(location.search).get('bbBotQa')==='1';
}catch(_qaError){botQaEnabled=false;}
var BOT_QA=Object.freeze({
 maxFrames:2400,maxCpuTicks:2400,maxReactions:500,
 ranges:['0-10','10-20','20-30','30+','unknown']
});
function botQaState(){
 return {startedAt:Date.now(),frames:[],frameJs:[],cpu:[],reactions:[],
  projectiles:0,hits:0,shots:{},blockedSeconds:0,movingSeconds:0,
  pathAttempts:0,pathFailures:0,rounds:[],lostSight:0,observations:0,
  outOfWindowFrames:0,renderSamples:0};
}
var botQaData=botQaState();
function botQaBounded(arr,value,max){
 if(arr.length>=max)arr.shift();
 arr.push(value);
}
function botQaPercentiles(values){
 if(!values.length)return {count:0,median:null,p95:null,max:null};
 var s=values.slice().sort(function(a,b){return a-b;});
 return {count:s.length,
  median:Math.round(s[Math.floor((s.length-1)*.5)]*1000)/1000,
  p95:Math.round(s[Math.floor((s.length-1)*.95)]*1000)/1000,
  max:Math.round(s[s.length-1]*1000)/1000};
}
function botQaFrame(deltaMs,renderMs,active){
 if(!botQaEnabled||!active||!Number.isFinite(deltaMs))return;
 // RequestAnimationFrame wall-clock period: no game-dt clamp (which is 50ms).
 if(deltaMs>0&&deltaMs<500){
  botQaBounded(botQaData.frames,deltaMs,BOT_QA.maxFrames);
  if(Number.isFinite(renderMs)&&renderMs>=0)
   botQaBounded(botQaData.frameJs,renderMs,BOT_QA.maxFrames);
  botQaData.renderSamples++;
 }else botQaData.outOfWindowFrames++;
}
function botQaCpu(elapsedMs,bots){
 if(!botQaEnabled||!Number.isFinite(elapsedMs)||bots<1)return;
 botQaBounded(botQaData.cpu,elapsedMs,BOT_QA.maxCpuTicks);
}
function botQaObserve(e,target){
 if(!botQaEnabled||!e||!target)return;
 e.qaContactAt=tt;e.qaContactTarget=target;e.qaContactFired=false;
 botQaData.observations++;
}
function botQaSightLost(e){
 if(!botQaEnabled||!e)return;
 if(e.qaContactTarget&&!e.qaContactFired)botQaData.lostSight++;
 e.qaContactTarget=null;e.qaContactFired=false;
}
function botQaBand(distance){
 if(!Number.isFinite(distance))return 'unknown';
 return distance<10?'0-10':distance<20?'10-20':distance<30?'20-30':'30+';
}
function botQaShot(shooter,weapon,own,bullet){
 if(!botQaEnabled||own!=='e'||!bullet)return;
 var kind=weapon&&weapon.stats&&weapon.stats.kind||'unknown',
     mode=typeof isBombMode==='function'&&isBombMode()?'bomb':'tdm',
     target=shooter&&shooter.aimTarget,
     distance=target&&typeof botIntelVisible==='function'&&
       botIntelVisible(shooter,target)?
       Math.hypot(target.x-shooter.x,target.z-shooter.z):NaN,
     band=botQaBand(distance),
     key=mode+'|'+kind+'|'+band,
     stat=botQaData.shots[key]||(botQaData.shots[key]={mode:mode,kind:kind,
       range:band,projectiles:0,hits:0});
 bullet.qaKey=key;stat.projectiles++;botQaData.projectiles++;
 // Shot-to-sight timing: first fired projectile after a live reacquisition.
 if(shooter&&target&&shooter.qaContactTarget===target&&!shooter.qaContactFired){
  var lag=(tt-shooter.qaContactAt)*1000;
  if(Number.isFinite(lag)&&lag>=0&&lag<10000)
   botQaBounded(botQaData.reactions,lag,BOT_QA.maxReactions);
  shooter.qaContactFired=true;
 }
}
function botQaHit(b){
 if(!botQaEnabled||!b||!b.qaKey)return;
 var row=botQaData.shots[b.qaKey];
 if(!row)return;
 row.hits++;botQaData.hits++;
}
function botQaMove(wanted,moved,speed,dt){
 if(!botQaEnabled||!wanted||!Number.isFinite(dt)||dt<=0)return;
 botQaData.movingSeconds+=dt;
 if(moved<Math.max(.003,speed*dt*.22))botQaData.blockedSeconds+=dt;
}
function botQaPath(p){
 if(!botQaEnabled)return;
 botQaData.pathAttempts++;
 if(!p||!p.length)botQaData.pathFailures++;
}
function botQaBomb(winner,site,state){
 if(!botQaEnabled)return;
 if(botQaData.rounds.length>=150)botQaData.rounds.shift();
 botQaData.rounds.push({winner:winner,site:site,
  planted:state==='planted'});
}
function botQaReport(){
 var frames=botQaPercentiles(botQaData.frames),
     frameJs=botQaPercentiles(botQaData.frameJs),
     cpu=botQaPercentiles(botQaData.cpu),
     latency=botQaPercentiles(botQaData.reactions);
 var rows=Object.keys(botQaData.shots).sort().map(function(k){
  var r=botQaData.shots[k];
  return {mode:r.mode,weaponKind:r.kind,rangeBand:r.range,
   projectiles:r.projectiles,characterHits:r.hits,
   projectileHitPercent:r.projectiles?
    Math.round(r.hits/r.projectiles*10000)/100:null};
 });
 var bomb={completed:botQaData.rounds.length,policeWins:0,
  terroristWins:0,plantedAtFinish:0,siteA:0,siteB:0,noSite:0};
 botQaData.rounds.forEach(function(r){
  if(r.winner===0)bomb.policeWins++;
  else if(r.winner===1)bomb.terroristWins++;
  if(r.planted)bomb.plantedAtFinish++;
  if(r.site===0)bomb.siteA++;
  else if(r.site===1)bomb.siteB++;
  else bomb.noSite++;
 });
 return {schema:'POINT_BLOCK_M7_QA_V1',enabled:true,
  recordedStartUnixMs:botQaData.startedAt,
  limitation:'Only events observed in this browser tab with opt-in flag; samples are rolling windows, not M0 paired baseline. Projectile hit rate is character-hit projectile / fired projectile, not trigger accuracy; shotgun pellets counted separately. CPU measures botsUpd only. No claims of full map coverage.',
  frameTimeMs:frames,frameJavaScriptWorkMs:frameJs,botUpdateCpuMs:cpu,
  firstSightToShotMs:latency,
  approximateFpsMedian:frames.median?Math.round(1000/frames.median*10)/10:null,
  projectileCount:botQaData.projectiles,
  characterProjectileHits:botQaData.hits,
  projectileHitPercent:botQaData.projectiles?
   Math.round(botQaData.hits/botQaData.projectiles*10000)/100:null,
  byWeaponRange:rows,observations:botQaData.observations,
  lostUnfiredSightings:botQaData.lostSight,
  movementAttemptSeconds:Math.round(botQaData.movingSeconds*100)/100,
  lowDisplacementSeconds:Math.round(botQaData.blockedSeconds*100)/100,
  pathAttempts:botQaData.pathAttempts,pathFailures:botQaData.pathFailures,
  bombRounds:bomb,invalidOrSuspendedFrames:botQaData.outOfWindowFrames,
  frameSampleLimit:BOT_QA.maxFrames,cpuSampleLimit:BOT_QA.maxCpuTicks,
  reactionSampleLimit:BOT_QA.maxReactions};
}
function botQaDownload(){
 if(!botQaEnabled||typeof document==='undefined'||typeof Blob==='undefined')return false;
 var data=JSON.stringify(botQaReport(),null,2),
     blob=new Blob([data],{type:'application/json'}),
     url=URL.createObjectURL(blob),
     a=document.createElement('a');
 a.href=url;a.download='point-block-m7-qa.json';
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(function(){URL.revokeObjectURL(url);},2000);
 return true;
}
if(botQaEnabled&&typeof window!=='undefined'){
 // Explicit, opt-in console API. Never sends data to any server.
 window.PointBlockQA=Object.freeze({
  report:botQaReport,download:botQaDownload,
  reset:function(){botQaData=botQaState();}
 });
 console.info('POINT BLOCK local M7 QA enabled: PointBlockQA.report() / .download()');
}
// ---- MAIN SIMULATION ----
// update(dt): one simulation step (dt in seconds, capped at .05 in loop()). Order: timers -> player movement/jump ->
// aiming (ADS) and weapon timers (AWP bolt) -> player shooting -> crates -> grenades -> bots -> bullets -> particles -> HUD.
// update
function update(dt){
  tt+=dt;sndN=0;
  if(wsLiveTime>0)wsLiveTime=Math.max(0,wsLiveTime-dt);
  if(mt.cd<=0)pl.inv=Math.max(0,(pl.inv||0)-dt);
  if(mt.cd>0)mt.cd-=dt;else if(!mt.over){mt.t-=dt;if(!isBombMode()&&(mt.t<=0||roomReachedKillLimit())){endMatch();return;}}
  var mx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+ST.l.x,mz=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0)+ST.l.y,ml=Math.hypot(mx,mz);
  if(pl.dead||mt.cd>0||(isBombMode()&&pl.bAction)){mx=mz=ml=0;}if(ml>1){mx/=ml;mz/=ml;ml=1;}
  var shoot=!pl.dead&&mt.cd<=0&&!(isBombMode()&&pl.bAction)&&(!!keys.KeyF||fireHeld||(mouse.down&&document.pointerLockElement===R.domElement));
  var pb0=pl.bolt||0;pl.bolt=Math.max(0,pb0-dt);if(!WP[pl.w].snp||pl.dead)pl.bolt=0;if(pb0>0&&pl.bolt===0&&WP[pl.w].snp&&!pl.dead&&pl.mag<=0)reload();
  if(!WP[pl.w].snp||pl.dead||pl.rl>0||pl.bolt>0)scopeOn=false;
  var wA=!pl.dead&&(WP[pl.w].snp?scopeOn:mouse.right)&&canAds(pl.w)&&pl.rl<=0&&pl.sw<=0&&pl.thr<=0&&pl.stab<=0,wS=!pl.dead&&(keys.ShiftLeft||keys.ShiftRight)&&-mz>.25&&!wA&&!shoot;
  adsT+=((wA?1:0)-adsT)*Math.min(1,dt*12);sprT+=((wS?1:0)-sprT)*Math.min(1,dt*9);
  if(!pl.dead)pl.life+=dt;else{pl.dt+=dt;pl.rsT-=dt;if(pl.rsT<=0&&!mt.over&&!isBombMode())respawnPl();}
  var spd=weaponMovementSpeed(pl.w,sprT,adsT);
  mvAmt+=(ml-mvAmt)*Math.min(1,dt*8);wtT+=((pl.w>=1&&pl.w<=3||["rifle","smg","dual","sniper","rocket"].indexOf(WP[pl.w].stats.kind)>=0?1:0)-wtT)*Math.min(1,dt*6);
  var oldStepX=pl.x,oldStepZ=pl.z;
  var fw=-mz,sf=Math.sin(pl.face),cf=Math.cos(pl.face);pl.x+=(fw*sf-mx*cf)*spd*dt;pl.z+=(fw*cf+mx*sf)*spd*dt;resolve(pl,.55);
  var py=pl.y,gy=gh(pl.x,pl.z,py);
  if(!pl.dead&&!(isBombMode()&&pl.bAction)&&(keys.Space||jumpHeld)&&pl.y<=gy+.001)pl.vy=9;
  pl.vy-=28*dt;pl.y+=pl.vy*dt;gy=gh(pl.x,pl.z,py);
  if(pl.y<=gy){pl.y=gy;pl.vy=0;}
  footstepAdvance(pl,Math.hypot(pl.x-oldStepX,pl.z-oldStepZ),!pl.dead&&pl.vy===0,sprT>.4,true);
  if(pl.vy===0&&Math.abs(pl.y-camY)<1.2)camY+=(pl.y-camY)*Math.min(1,dt*16);else camY=pl.y;
  var rk=pl.dead?0:1;pl.face-=ST.r.x*2.4*dt*rk;pl.pitch=Math.max(-1.2,Math.min(1.2,pl.pitch-ST.r.y*1.6*dt*rk));
  var cdo=pl.cd;pl.cd-=dt;pl.ov=(cdo>0&&pl.cd<0)?-pl.cd:0;var w=WP[pl.w],priorPump=pl.pump||0;
  pl.pump=Math.max(0,priorPump-dt);
  if(!w.pump||pl.dead)pl.pump=0;
  if(priorPump>0&&pl.pump===0&&w.pump&&pl.mag<=0&&!pl.dead)reload();
  pl.sw=Math.max(0,pl.sw-dt);pl.stab=Math.max(0,pl.stab-dt);pl.ghide=Math.max(0,pl.ghide-dt);if(pl.sth&&pl.stab<=.23){pl.sth=false;doStab();}if(pl.thr>0){pl.thr=Math.max(0,pl.thr-dt);if(pl.pend&&pl.thr<=.225){pl.pend=false;throwG();}}
  if(pl.rl>0){pl.rl-=dt;if(pl.rl<=0){var n=Math.min(w.mag-pl.mag,pl.res);pl.mag+=n;pl.res-=n;}}
  for(var sn=0;sn<3&&shoot&&pl.cd<=0&&pl.rl<=0&&pl.thr<=0&&pl.sw<=0&&!(w.snp&&pl.bolt>0)&&!(w.pump&&pl.pump>0);sn++){if(sn>0)pl.ov=-pl.cd;if(w.melee){pl.cd=w.cd;pl.stab=.42;pl.sth=true;}else if(w.gr){if(pl.mag>0){pl.thr=.5;pl.pend=true;pl.cd=w.cd;}}else if(pl.mag>0){fire(pl,pl.face,w,"p",pl.ov);if(!w.pump)ejectShell(pl.w,(pl.w===7&&shotSide)?-1:1);pl.cd=w.cd-pl.ov;kick=Math.min(.26,kick+w.viewKick);flashT=Math.min(.06,w.cd*.75);camShot(pl.w);gunSfx(GS[SFXI[pl.w]],1);if(w.snp){scopeOn=false;pl.mag--;pl.bolt=BOLT_T;pl.bc=0;}else if(w.pump){pl.mag--;pl.pump=w.pumpDuration;pl.pumpEjected=false;}else if(--pl.mag===0)reload();}else reload();}
  if(!pl.dead&&pl.w===7&&pl.mag<=0&&pl.res<=0){var kk=pl.ammo[6];if(kk&&kk.mag+kk.res>0)toggleDual();}
  if(!pl.dead&&pl.mag<=0&&pl.res<=0&&pl.rl<=0&&pl.thr<=0&&!WP[pl.w].melee&&!WP[pl.w].gr){
    var pistol=amo(0),next=pistol.mag+pistol.res>0?1:2;
    swSlot(next);toast("Out of ammo");}
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
  var qaBotStart=botQaEnabled?performance.now():0;
  botsUpd(dt);
  if(botQaEnabled)botQaCpu(performance.now()-qaBotStart,en.length);
  updDead(dt);bloodPoolUpdate(dt);
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
          if(!b2.rk){projectileHitCharacter(b2,EE,p.y-(EE.y||0)>=1.38);}
          hit=true;break;}}
        if(!hit&&pl.tm!==bt&&!pl.dead&&pl.inv<=0&&Math.hypot(pl.x-p.x,pl.z-p.z)<.7&&Math.abs(p.y-(pl.y+1))<1.1){projectileHitCharacter(b2,pl,p.y>=pl.y+1.38);hit=true;}}
    }
    if(hit){if(hn)impact(ho,hn,b2);else if(p.y<gh(p.x,p.z,p.y)+.03)gImpact(p);if(b2.rk)boom(p.x,p.z,b2.dmg,0,p.y,b2.by);else spark(p.x,p.y,p.z,b2.own==="p"?0xffd54a:0xff5c5c,7,5,.07);S.remove(b2.m);bl.splice(i,1);}}
  for(i=sk.length-1;i>=0;i--){var q=sk[i];q.t+=dt;q.m.position.x+=q.vx*dt;q.m.position.y+=q.vy*dt;q.m.position.z+=q.vz*dt;q.vy-=9*dt;q.m.scale.setScalar(Math.max(.001,q.sz*(1-q.t/q.l)));if(q.t>=q.l){S.remove(q.m);sk.splice(i,1);if(q.blood)bloodActive=Math.max(0,bloodActive-1);}}
  for(i=mzf.length-1;i>=0;i--){mzf[i].t-=dt;if(mzf[i].t<=0){S.remove(mzf[i].m);mzf.splice(i,1);}}
  updCl(dt);updSm(dt);
  for(i=fx.length-1;i>=0;i--){var f2=fx[i];f2.t+=dt*3;f2.m.scale.setScalar(.5+f2.t*4);f2.m.material.opacity=Math.max(0,.7-f2.t*.7);if(f2.t>=1){S.remove(f2.m);fx.splice(i,1);}}
  pm.g.position.set(pl.x,pl.y,pl.z);pm.g.rotation.y=pl.face;pm.legs[0].rotation.x=Math.sin(tt*10)*.6*ml;pm.legs[1].rotation.x=-pm.legs[0].rotation.x;pm.body.rotation.y=0;flash(pm,dt);if(pl.dead){var dp=Math.min(1,pl.dt/.6),ds=dp*dp*(3-2*dp),an=-Math.PI/2*ds;pm.body.rotation.set(an,0,0);pm.body.position.y=.3*Math.abs(Math.sin(an));pm.arms[0].rotation.z=-1.1*ds;pm.arms[1].rotation.z=1.1*ds;pm.legs[0].rotation.z=-.3*ds;pm.legs[1].rotation.z=.3*ds;}
  // Bomb objective and round resolution run after damage so an eliminated actor cannot finish an action.
  if(isBombMode())bombUpdate(dt);
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
// Planted-bomb beacon uses the ACTUAL device position, not the static site label.
// The radar zooms out only while the device is active so its exact position stays visible.
var BOMB_RADAR=Object.freeze({baseRange:50,padding:1.25,pulseHz:1.8,
  ringPixels:11,ringGrowthPixels:11,dotPixels:4,color:'#ff4d4d',core:'#fff0bd'});
function bombRadarRange(observer){
  if(!isBombMode()||!bombMatch||bombMatch.done)return BOMB_RADAR.baseRange;
  var p=bombMatch.state==='planted'?bombMatch.device.position:
    bombDroppedSignalVisible()?bombMatch.dropped:null;
  if(!p)return BOMB_RADAR.baseRange;
  return Math.max(BOMB_RADAR.baseRange,
    Math.hypot(p.x-observer.x,p.z-observer.z)*BOMB_RADAR.padding);
}
function bombRadarBeacon(X,k,now){
  if(!isBombMode()||!bombMatch||bombMatch.state!=='planted'||bombMatch.done)return;
  var pos=bombMatch.device.position,p=(now*BOMB_RADAR.pulseHz)%1;
  X.save();X.shadowColor=BOMB_RADAR.color;X.shadowBlur=12;
  X.strokeStyle=BOMB_RADAR.color;X.lineWidth=2.5/k;
  X.beginPath();X.arc(pos.x,pos.z,(BOMB_RADAR.ringPixels+p*BOMB_RADAR.ringGrowthPixels)/k,0,6.2832);X.stroke();
  X.globalAlpha=1-p;X.beginPath();X.arc(pos.x,pos.z,BOMB_RADAR.ringPixels/k,0,6.2832);X.stroke();
  X.globalAlpha=1;X.fillStyle=BOMB_RADAR.core;X.beginPath();X.arc(pos.x,pos.z,BOMB_RADAR.dotPixels/k,0,6.2832);X.fill();
  X.restore();
}
// Only Terrorists see the dropped bomb. Both teams retain the planted-bomb beacon.
function bombDroppedRadarBeacon(X,k,now){
 if(!bombDroppedSignalVisible())return;
 var pos=bombMatch.dropped,p=(now*1.8)%1,r=(7+p*10)/k,s=5/k;
 X.save();X.shadowColor='#ffb938';X.shadowBlur=12;X.strokeStyle='#ffb938';X.lineWidth=2/k;
 X.beginPath();X.arc(pos.x,pos.z,r,0,6.2832);X.stroke();
 X.fillStyle='#fff0b0';X.beginPath();
 X.moveTo(pos.x,pos.z-s);X.lineTo(pos.x+s,pos.z);X.lineTo(pos.x,pos.z+s);X.lineTo(pos.x-s,pos.z);
 X.closePath();X.fill();X.restore();
}
// cfont(): returns the CSS font string used on the radar canvas.
function cfont(n){return "700 "+n+'px Rajdhani,"Trebuchet MS",sans-serif';}
// rrect(): draws a rounded-rectangle path on canvas context X.
function rrect(X,x,y,w,h,r){X.beginPath();X.moveTo(x+r,y);X.arcTo(x+w,y,x+w,y+h,r);X.arcTo(x+w,y+h,x,y+h,r);X.arcTo(x,y+h,x,y,r);X.arcTo(x,y,x+w,y,r);X.closePath();}
// radar(): draws the mini-map radar (player at center, rotates with facing; teammates blue, enemies red when visible).
function radar(){
  var rp=isBombMode()&&pl.dead?bombSpectatorTarget()||pl:pl,originFace=rp===pl?pl.face:rp.g.rotation.y;
  var range=isBombMode()?bombRadarRange(rp):RWD;
  var X=mx2,f=originFace,co=Math.cos(f),sn=Math.sin(f),k=RI/range,a=-k*co,b=-k*sn,c=k*sn,d=-k*co,now=performance.now()/1000,th=Math.PI-f,i,g,gx,gz;
  X.setTransform(1,0,0,1,0,0);X.clearRect(0,0,RS,RS);X.lineCap="round";
  // base disc
  g=X.createRadialGradient(RC,RC,10,RC,RC,RO);g.addColorStop(0,"rgba(16,30,46,.9)");g.addColorStop(1,"rgba(5,9,16,.95)");
  X.fillStyle=g;X.beginPath();X.arc(RC,RC,RO,0,6.2832);X.fill();
  // ---- map content (clipped to the inner circle) ----
  X.save();X.beginPath();X.arc(RC,RC,RI,0,6.2832);X.clip();
  X.setTransform(a,b,c,d,RC-(a*rp.x+c*rp.z),RC-(b*rp.x+d*rp.z));
  X.strokeStyle="rgba(110,190,255,.10)";X.lineWidth=1/k;X.beginPath();
  for(gx=Math.floor((rp.x-range)/8)*8;gx<=rp.x+range;gx+=8){X.moveTo(gx,rp.z-range);X.lineTo(gx,rp.z+range);}
  for(gz=Math.floor((rp.z-range)/8)*8;gz<=rp.z+range;gz+=8){X.moveTo(rp.x-range,gz);X.lineTo(rp.x+range,gz);}
  X.stroke();
  if(isBombMode()){
    // Actual 160×160 indoor wall plan, using gameplay collision walls rather than decorative geometry.
    X.fillStyle='rgba(164,187,204,.46)';X.strokeStyle='rgba(214,236,249,.65)';X.lineWidth=.75/k;
    BOMB_NAV_WALLS.forEach(function(q){
      if(Math.abs(q.x-rp.x)>range+q.hw||Math.abs(q.z-rp.z)>range+q.hd)return;
      X.fillRect(q.x-q.hw,q.z-q.hd,q.hw*2,q.hd*2);
    });
    X.fillStyle='rgba(255,195,110,.65)';
    OB.forEach(function(q){if(q.h>2||q.fl)return;
      if(Math.abs(q.x-rp.x)<range&&Math.abs(q.z-rp.z)<range)
        X.fillRect(q.x-q.hw,q.z-q.hd,q.hw*2,q.hd*2);
    });
  }
  X.fillStyle="rgba(120,160,200,.5)";X.strokeStyle="rgba(190,225,255,.8)";X.lineWidth=1.2/k;
  BR.forEach(function(q){if(Math.abs(q.x-rp.x)<range+q.hw+4&&Math.abs(q.z-rp.z)<range+q.hd+4){X.fillRect(q.x-q.hw,q.z-q.hd,q.hw*2,q.hd*2);X.strokeRect(q.x-q.hw,q.z-q.hd,q.hw*2,q.hd*2);}});
  X.strokeStyle="rgba(255,110,50,.95)";X.lineWidth=2.5/k;X.strokeRect(-A,-A,2*A,2*A);
  X.fillStyle="#69db7c";X.shadowColor="#2fe06a";X.shadowBlur=8;
  cr.forEach(function(q){if(q.ci===3&&q.land&&Math.hypot(q.x-rp.x,q.z-rp.z)<range*.95){var m=2.6/k;X.fillRect(q.x-m,q.z-m*.35,m*2,m*.7);X.fillRect(q.x-m*.35,q.z-m,m*.7,m*2);}});
  if(isBombMode()){BOMB_SITES.forEach(function(site){X.fillStyle="#ffe066";X.shadowBlur=0;X.font=cfont(12/k);X.textAlign="center";X.fillText(site.id,site.x,site.z);});}
  en.forEach(function(q){var al=q.tm===pl.tm;if(!al&&!(q.vis>0))return;var ddx=q.x-rp.x,ddz=q.z-rp.z,dl=Math.hypot(ddx,ddz),mxr=range*.93,px=q.x,pz=q.z;if(dl>mxr){px=rp.x+ddx/dl*mxr;pz=rp.z+ddz/dl*mxr;}X.shadowColor=al?"#4dabf7":"#ff4d4d";X.shadowBlur=al?10:0;X.fillStyle=al?"#4dabf7":"#ff4d4d";X.strokeStyle="#fff";X.lineWidth=2/k;X.beginPath();X.arc(px,pz,(al?8:6)/k,0,6.29);X.fill();X.stroke();});
  // Draw after character dots, at the planted device world coordinates.
  bombRadarBeacon(X,k,now);bombDroppedRadarBeacon(X,k,now);
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
function hud(){var w=WP[pl.w],hp=pl.hp;tmUpd();wselUpd();abUpd();var tacticalAdsActive=tacticalOpticUpdate();scopedNow=!!w.snp&&adsT>.92&&!pl.dead&&!lob&&!mt.over;scopeEl.style.display=scopedNow?"block":"none";document.body.classList.toggle("scoped",scopedNow);hold.visible=!scopedNow&&!tacticalOpticHidesViewmodel(pl.w,tacticalAdsActive)&&!(isBombMode()&&pl.bAction);
  E.hpf.style.width=hp+"%";E.hpf.style.background=hp>60?"linear-gradient(90deg,#2f9e44,#69db7c)":hp>30?"linear-gradient(90deg,#f08c00,#ffd43b)":"linear-gradient(90deg,#c92a2a,#ff6b6b)";
  E.hpt.textContent=Math.ceil(hp);var vestEl=document.getElementById("vestHud");if(vestEl){vestEl.textContent="VEST "+Math.ceil(pl.vest);vestEl.classList.toggle("empty",pl.vest<=0);}E.sc.textContent=score;E.wn.textContent=w.n;
  E.mg.textContent=pl.mag;E.mg.style.color=pl.mag<=w.mag*.25?"#ff6b6b":"";
  E.rs.textContent="/ "+(pl.res===Infinity?"\u221e":pl.res);
  slotUI(w);if(wiK!==pl.w){wiK=pl.w;E.wi.innerHTML=SV[pl.w];}hhi.className=hp>0&&hp<=30?"low":"";chE.style.setProperty("--g",((6+mvAmt*4+sprT*8+kick*30)*(1-.6*adsT))+"px");rbEl.style.opacity=pl.rl>0?1:0;E.rbf.style.width=pl.rl>0?(100*(1-pl.rl/w.rt))+"%":"0";radar();bombHudUpdate();}
// ---- MAIN LOOP ----
// loop(now): runs update(dt) while a match is on, then positions the camera (normal view, lobby orbit, or death cam),
// applies recoil/shake/FOV, animates the viewmodel (animHands), and renders: world first, then the viewmodel on top with depth cleared.
var last=performance.now();
(function loop(now){var qaDeltaMs=now-last,qaFrameStart=botQaEnabled?performance.now():0;var dt=Math.min((now-last)/1000,.05);last=now;if(run)update(pl.dead&&pl.dt<.8?dt*(.3+.7*pl.dt/.8):dt);
  shakeT=Math.max(0,shakeT-dt);var sh=shakeT*.5;cs.s*=Math.max(0,1-dt*6);spr(cs,"k","kv",dt);spr(cs,"y","yv",dt);spr(cs,"r","rv",dt);var ft=70+(ADF[pl.w]-70)*adsT+6*sprT+Math.max(0,cs.k)*45*(1-.5*adsT);if(lob||mt.over){var la=performance.now()/9000;
    if(lob&&mapPreviewSceneBomb){var an=performance.now()/7500,cam=bombMapInfo(selectedBombMapId).preview;if(cam){C.position.set(cam.x+Math.sin(an)*2,cam.y,cam.z+Math.cos(an)*2);C.lookAt(cam.lookX,cam.lookY,cam.lookZ);ft=cam.fov;}else{C.position.set(25+Math.sin(an)*1.6,2.25,5+Math.cos(an)*1.6);C.lookAt(25+Math.sin(an+0.8)*12,2.1,5+Math.cos(an+0.8)*12);ft=72;}}
    else if(lob&&selM===0&&tdmMapId(selectedTdmMapId)==="block-labs"){var cc=tdmMapInfo(selectedTdmMapId).preview;C.position.set(cc.x+Math.sin(la)*.8,cc.y,cc.z+Math.cos(la)*.8);C.lookAt(cc.lookX,cc.lookY,cc.lookZ);ft=cc.fov;}
     else{C.position.set(Math.sin(la)*34,13,Math.cos(la)*34);C.lookAt(0,2,0);ft=62;}
  }else if(pl.dead&&isBombMode()){ft=SPECTATOR_CAMERA.fieldOfView;bombSpectatorCamera(dt);}else if(pl.dead){pl.rt+=dt;var u=Math.min(pl.rt,3.5),an=pl.face+2.4+pl.rt*.5,rd=3+u*1.1,hh=2.2+u*1.5;ft=62;C.position.set(Math.max(-A,Math.min(A,pl.x+Math.sin(an)*rd)),hh+pl.y,Math.max(-A,Math.min(A,pl.z+Math.cos(an)*rd)));C.lookAt(pl.x,.3+pl.y,pl.z);}
  else{var cb=mvAmt*wtT*(1-.75*adsT)*(pl.vy===0?1:0)*(1+.35*sprT),bY=-cb*.022*(.5-.5*Math.cos(2*bobP)),tr=cs.s*(1-.4*adsT),ta=tr*tr,nt=performance.now()/1000,sj=sh+ta*.06,ads2=1-.4*adsT,pp=pl.pitch+cs.k*(1-.35*adsT)+snz(nt,1)*ta*.05,fy=pl.face+cs.y*ads2+snz(nt,2)*ta*.05;C.position.set(pl.x+snz(nt,3)*sj,1.5+camY+bY+snz(nt,4)*sj-(isBombMode()&&pl.bAction?.55:0),pl.z+snz(nt,5)*sj);C.lookAt(pl.x+Math.sin(fy)*Math.cos(pp),1.5+camY+bY+Math.sin(pp)-(isBombMode()&&pl.bAction?.55:0),pl.z+Math.cos(fy)*Math.cos(pp));C.rotateZ(cs.r*ads2+snz(nt,6)*ta*.06+Math.sin(bobP)*.004*cb);}
  if(Math.abs(C.fov-ft)>.02){C.fov=ft;C.updateProjectionMatrix();}
  kick*=Math.max(0,1-dt*14);flashT-=dt;var dl=pl.w===7;mflash.visible=flashT>0&&run&&!(dl&&shotSide);mflash2.visible=flashT>0&&run&&dl&&!!shotSide;var suppressedFlash=!!(GS[SFXI[pl.w]]&&GS[SFXI[pl.w]].suppressed);mflash.scale.setScalar((suppressedFlash?.17:.7)+Math.random()*(suppressedFlash?.12:.8));mflash2.scale.setScalar(.7+Math.random()*.8);mflash.position.set(0,.02,MZ[pl.w]);mflash2.position.set(-.52,.02,MZ[pl.w]);animHands();guns.forEach(function(g,i){g.visible=i===pl.w&&!(i===5&&pl.ghide>0);});sun.position.set(pl.x+14,30,pl.z+10);sun.target.position.set(pl.x,0,pl.z);sun.target.updateMatrixWorld();
  footstepUpdateListener();updSky(dt);R.clear();R.render(S,C);modePreviewDraw(now);if(!pl.dead&&!lob&&!mt.over){R.clearDepth();R.render(VS,VC);}if(botQaEnabled)botQaFrame(qaDeltaMs,performance.now()-qaFrameStart,run&&!lob&&!mt.over);requestAnimationFrame(loop);})(last);
})();
