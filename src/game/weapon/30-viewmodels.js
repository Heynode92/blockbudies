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
var mt={t:60,cd:0,over:true},ts=[0,0],rq=[],ROS=[],curK=null,pl,en,bl,cr,fx,sk,score,run=false,spawnT,crateT,tt=0,toastT=0,adsT=0,sprT=0,ADF=[56,44,58,58,70,70,50,70,14,44,42,44,36,54,54,42],AP=[[0,-.066,-.5],[0,-.125,-.5],[0,-.22,-.56],[.22,-.24,-.62],[0,-.1,-.5],[0,-.1,-.5],[0,-.21,-.55],[0,-.13,-.5],[0,-.14,-.5],[0,-.215,-.53],[0,-.25,-.58],[0,-.27,-.56],[0,-.18,-.64],[0,-.245,-.56],[0,-.235,-.54],[0,-.21,-.60]],bobP=0,bobL=performance.now(),lob=true;
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
var RG=[[0,-.2,-.1],[0,-.2,-.15],[0,-.13,-.08],[0,-.14,-.2],[0,.02,-.09],[0,-.1,-.3],[0,-.22,-.1],[0,-.22,-.1],[0,-.19,-.06],[0,-.2,-.19],[0,-.22,-.10],[0,-.24,-.10],[0,-.205,-.15],[0,-.21,-.12],[0,-.21,-.12],[0,-.21,-.16]],
 RL=[[-.03,-.22,-.22],[0,-.09,-.62],[0,-.1,-.58],[0,-.1,-.7],[-.3,-.5,-.1],[-.3,-.5,-.1],[0,-.09,-.5],[-.52,-.22,-.1],[0,-.1,-.62],[0,-.09,-.72],[0,-.16,-.54],[0,-.15,-.56],[0,-.18,-.84],[0,-.16,-.65],[0,-.17,-.66],[0,-.17,-.88]],
 PT=[[0,-.2,-.28],[0,-.24,-.4],[0,-.12,-.2],[0,.02,-.95],[0,0,0],[0,0,0],[0,-.24,-.35],[0,0,0],[0,-.24,-.42],[0,-.24,-.43],[0,-.32,-.30],[0,-.23,-.42],[0,-.31,-.45],[0,-.29,-.30],[0,-.28,-.32],[0,-.30,-.40]],
 MODE=[0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0],NC=[1,1,3,1,1,1,1,1,1,1,1,1,1,1,1,1],DD=[-.1,-.34,-.28];
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
