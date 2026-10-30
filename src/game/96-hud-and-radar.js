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
