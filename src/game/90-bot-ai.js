// ---- BOT PATH-FINDING GRID ----
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
  // Never charge directly into a solid wall if A* finds no route.
  e.path=p||(isBombMode()?[]:[[gx,gz]]);e.pi=0;e.pt=1.1+Math.random()*.8;e.goalX=gx;e.goalZ=gz;
}
// botsUpd(dt): LIVE bot AI (movement along paths, target choice, line-of-sight, shooting with fire(..., "e")).
function botsUpd(dt){var i,cdn=mt.cd>0;if(!GB)gInit();
  for(i=rq.length-1;i>=0;i--){var q=rq[i];q.t-=dt;if(q.t<=0&&!mt.over&&!isBombMode()){var nb=newBot(q.b.tm,q.b.idx);nb.st=q.b.st;placeBot(nb);rq.splice(i,1);}}
  en.forEach(function(e){var t,dx=0,dz=0,d=99,f,mvx=0,mvz=0,sp=isBombMode()?BOMB_AI.navSpeed*(e.tm===0&&bombUncontestedRetake()?BOMB_AI.clearSiteSpeedMultiplier:1):4.8,ox=e.x,oz=e.z,combat,gx,gz,wp,ml;
    botUpdateReload(e,dt);e.inv=Math.max(0,(e.inv||0)-(cdn?0:dt));e.vis=Math.max(0,(e.vis||0)-dt);e.tq=(e.tq||0)-dt;e.navT=Math.max(0,(e.navT||0)-dt);
    if(e.tq<=0){e.tq=.35+Math.random()*.2;var bd=1e9,bt=null;
      en.forEach(function(o){if(o.tm!==e.tm){var dd=Math.hypot(o.x-e.x,o.z-e.z);if(dd<bd&&dd<45&&los(e.x,e.z,o.x,o.z)){bd=dd;bt=o;}}});
      if(pl.tm!==e.tm&&!pl.dead){var d2=Math.hypot(pl.x-e.x,pl.z-e.z);if(d2<bd&&d2<45&&los(e.x,e.z,pl.x,pl.z)){bd=d2;bt=pl;}}
      e.tg=bt;e.lok=!!bt;
      if(isBombMode()){var objective=bombBotGoal(e);if(objective){e.wx=objective[0];e.wz=objective[1];}}
      if(!bt&&!isBombMode()){var ob=null,od=1e9;en.concat(pl.dead?[]:[pl]).forEach(function(o){if(o.tm!==e.tm){var dd=Math.hypot(o.x-e.x,o.z-e.z);if(dd<od){od=dd;ob=o;}}});
        if(ob){e.wx=ob.x+(Math.random()-.5)*12;e.wz=ob.z+(Math.random()-.5)*12;}else{e.wx=(Math.random()-.5)*2*(A-8);e.wz=(Math.random()-.5)*2*(A-8);}}}
    t=e.tg;if(t&&(t.dead||(t===pl&&pl.dead)))t=e.tg=null;
    // Bomb carriers and designated defusers prioritize the objective unless an enemy is close.
    if(t&&bombBotWantsObjective(e,t))t=null;
    e.lt=(e.lt||0)-dt;if(t&&e.lt<=0){e.lt=.15;e.lok=los(e.x,e.z,t.x,t.z);}
    if(t){dx=t.x-e.x;dz=t.z-e.z;d=Math.hypot(dx,dz)||1;}
    combat=!!t&&e.lok&&e.navT<=0;
    if(isBombMode()&&e.bAction)combat=false;
    if(combat){var fw=botNeedsMelee(e)?1:(isBombMode()&&bombMatch&&bombMatch.state==='planted'&&e.tm===0)?
      (d>BOMB_AI.retakeCombatDistance?1:-.3):(d>16?1:d<7?-.6:0),st;e.bt=(e.bt||0)-dt;if(e.bt<=0){e.bt=.7+Math.random()*1.4;e.sd=[-1,0,1][(Math.random()*3)|0];}st=(e.sd||0)*.9;
      mvx=dx/d*fw+(dz/d)*st;mvz=dz/d*fw-(dx/d)*st;
      if(GB[gc(e.z+mvz*sp*dt*4)*GN+gc(e.x+mvx*sp*dt*4)]){e.sd=-(e.sd||1);mvx=dx/d*fw;mvz=dz/d*fw;}}
    else{gx=t?t.x:e.wx;gz=t?t.z:e.wz;e.pt=(e.pt||0)-dt;
      if(!e.path||e.pt<=0||e.stk>.5||
         (isBombMode()&&Math.hypot((e.goalX||0)-gx,(e.goalZ||0)-gz)>BOMB_AI.repathGoalDistance)){
        botPath(e,gx,gz);e.stk=0;
      }
      wp=e.path[e.pi];while(wp&&e.pi<e.path.length-1&&Math.hypot(wp[0]-e.x,wp[1]-e.z)<1.1){e.pi++;wp=e.path[e.pi];}
      if(wp){var wx=wp[0]-e.x,wz=wp[1]-e.z,wl=Math.hypot(wx,wz)||1;if(wl>.4){mvx=wx/wl;mvz=wz/wl;}}}
    if(isBombMode()&&e.bAction)mvx=mvz=0;
    if(!e.bAction&&!(isBombMode()&&e.tm===0&&bombUncontestedRetake()&&bombPickDefuser()===e))en.forEach(function(o){if(o!==e&&!o.dead){
      var sx=e.x-o.x,sz=e.z-o.z,sq=Math.hypot(sx,sz),space=isBombMode()?BOMB_AI.teammateSpacing:1.8;
      if(sq<space&&sq>.01){mvx+=sx/sq*.75;mvz+=sz/sq*.75;}
    }});
    ml=Math.hypot(mvx,mvz);if(ml>1){mvx/=ml;mvz/=ml;}if(cdn)mvx=mvz=0;
    f=(t&&e.lok)?Math.atan2(dx,dz):(mvx||mvz)?Math.atan2(mvx,mvz):e.g.rotation.y;
    e.x+=mvx*sp*dt;e.z+=mvz*sp*dt;resolve(e,.55);
    if(isBombMode()&&!e.bAction&&(mvx||mvz)){
      // If a narrow corner blocks movement, try sliding instead of oscillating into it.
      var forward=Math.hypot(e.x-ox,e.z-oz);
      if(forward<sp*dt*.2){
        var side=e.idx%2?1:-1,tx=e.x+side*(-mvz)*sp*dt,tz=e.z+side*mvx*sp*dt;
        if(!inObs(tx,tz,.65)){e.x=tx;e.z=tz;resolve(e,.55);}
      }
    }
    var dm=Math.hypot(e.x-ox,e.z-oz);
    if((mvx||mvz)&&dm<sp*dt*.3){e.stk=(e.stk||0)+dt;if(combat&&e.stk>.5){e.navT=1.2;e.sd=-(e.sd||1);e.stk=0;e.pt=0;}}else e.stk=0;
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
