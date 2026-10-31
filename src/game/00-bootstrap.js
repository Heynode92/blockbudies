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
