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
