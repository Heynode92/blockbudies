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
 {n:"BOMB MODE",tg:"TEAM \u00b7 TACTICAL",st:"AVAILABLE",bt:"PLAY NOW",lock:0,df:4,
  d:"Indoor 5 vs 5: Terrorists plant a bomb at site A or B. Police must eliminate the attackers or defuse before detonation. No respawns until the next round.",
  sp:[["PLAYERS",BOMB_RULES.teamSize+" VS "+BOMB_RULES.teamSize],["ROUNDS",String(BOMB_RULES.rounds)],["TIME",BOMB_RULES.roundSeconds/60+" MIN/ROUND"],["ROLE","PLANT / DEFUSE"]],
  hw:["A random Terrorist carries the bomb. Walk into the highlighted site and hold <b>E</b> for "+BOMB_RULES.plantSeconds+" seconds to plant.","Police hold <b>E</b> for "+BOMB_RULES.defuseSeconds+" seconds near the planted bomb to defuse. Both actions leave you vulnerable.","A fallen bomb carrier drops the device; a teammate can pick it up. After death, spectate surviving teammates.","First team to win "+BOMB_RULES.wins+" rounds wins. The match is limited to "+BOMB_RULES.rounds+" rounds."]},
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
function spawnPt(tm){if(isBombMode())return bombSpawnPt(tm);var cz=tm?-38:38,hist=SPH[tm?1:0],ok=[],all=[],k,x,z,i,o,d,dE,dF,h,near,c,p;
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
function placeBot(b){var s=spawnPt(b.tm);b.x=s[0];b.z=s[1];b.y=0;defenseSpawn(b);if(b.hm)b.hm.visible=true;b.inv=2;b.cd=1+Math.random();b.dead=false;b.tg=null;b.bn=0;b.wx=b.x;b.wz=b.z;b.stk=0;b.g.rotation.y=b.tm?0:Math.PI;botInitialLoadout(b);en.push(b);}
// startMatch(tm): sets up scores, timer (60 s) and the countdown, spawns the player and 4+5 bots, resets weapons to the chosen primary.
function startMatch(tm){starsReset();SPH=[[],[]];var s=spawnPt(tm);pl.tm=tm;pl.x=s[0];pl.z=s[1];pl.face=tm?0:Math.PI;pl.inv=2;ts=[0,0];rq=[];mt={t:60,cd:5,over:false};pl.prim=favPrim;pl.w=favPrim;pl.mag=WP[favPrim].mag;pl.res=WP[favPrim].res;scopeOn=false;ROS=[];pl.st={name:"You",tm:tm,k:0,d:0};ROS.push(pl.st);
  S.remove(pm.g);pm=mkPm(tm);pm.g.visible=false;[armR,armL].forEach(function(ar){ar.children[0].material.color.setHex(tm?0x4b5320:0x1c4a8a);ar.children[1].material.color.setHex(tm?0x23272b:0x142a52);});
  [0,1].forEach(function(t){for(var i=0;i<(isBombMode()?BOMB_RULES.teamSize-(t===tm?1:0):(t===tm?4:5));i++){var b=newBot(t,i);b.st={name:b.name,tm:t,k:0,d:0};ROS.push(b.st);placeBot(b);}});
  if(isBombMode())bombStartMatch();toast("YOU ARE "+(tm?"TERRORIST":"POLICE"));}
// respawnPl(): respawns the player after the 5 s death timer with full ammo and spawn shield.
function respawnPl(){var s=spawnPt(pl.tm);pl.dead=false;pl.dt=pl.rt=pl.rl=pl.cd=pl.sw=pl.stab=pl.thr=0;pl.pend=pl.sth=false;pl.ghide=0;defenseSpawn(pl);pl.x=s[0];pl.z=s[1];pl.y=pl.vy=0;pl.face=pl.tm?0:Math.PI;pl.pitch=0;pl.inv=2;pl.prim=favPrim;
  pl.ammo={};WP.forEach(function(w,i){pl.ammo[i]={mag:w.mag,res:w.res};});pl.w=favPrim;pl.mag=WP[favPrim].mag;pl.res=WP[favPrim].res;pl.slot=0;camY=0;scopeOn=false;resetPm();setHm();document.body.classList.remove("dead");toast("RESPAWNED");}
// tmUpd(): updates the top HUD (timer, scores, respawn text, spawn-shield text).
function tmUpd(){var g=function(i){return document.getElementById(i);},r=g("rsp");g("imm").style.display=(pl.inv>0&&!pl.dead&&!mt.over)?"block":"none";var sp0=g("tp"),sq0=g("tq");if(sp0.textContent!=ts[0]){sp0.textContent=ts[0];sp0.classList.remove("pop");void sp0.offsetWidth;sp0.classList.add("pop");}if(sq0.textContent!=ts[1]){sq0.textContent=ts[1];sq0.classList.remove("pop");void sq0.offsetWidth;sq0.classList.add("pop");}g("tt").textContent=mmss(Math.max(0,Math.ceil(mt.t)));g("tbf").style.width=Math.max(0,Math.min(100,mt.t/(isBombMode()?(bombMatch&&bombMatch.state==="planted"?BOMB_RULES.fuseSeconds:BOMB_RULES.roundSeconds):60)*100))+"%";g("tm").classList.toggle("lo",mt.t<=10&&mt.cd<=0&&!mt.over);g("tmP").classList.toggle("you",pl.tm===0);g("tmT").classList.toggle("you",pl.tm===1);
  r.innerHTML=isBombMode()?(mt.cd>0?Math.ceil(mt.cd):(pl.dead&&!mt.over?"SPECTATING":(bombMatch&&bombMatch.done?"ROUND OVER":""))):mt.cd>0?Math.ceil(mt.cd):mt.t>59.2?"GO!":(pl.dead&&!mt.over?"RESPAWN IN "+Math.max(1,Math.ceil(pl.rsT))+(pl.kb?"<small>KILLED BY "+pl.kb.toUpperCase()+"</small>":""):"");}
