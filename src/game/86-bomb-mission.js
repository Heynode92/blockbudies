// BOMB MISSION match state (isolated from Team Deathmatch logic).
var bombMatch=null,bombHold=false,bombSpectatorIndex=0;
var bombInfo=document.getElementById('bombInfo'),bombStatus=document.getElementById('bombStatus'),
  bombActionLabel=document.getElementById('bombActionLabel'),bombActionBar=document.getElementById('bombActionBar'),
  bombTouch=document.getElementById('bombTouch'),bombSpec=document.getElementById('bombSpec');
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
  mt.t=BOMB_RULES.roundSeconds;mt.cd=BOMB_RULES.freezeSeconds;
  var options=bombCandidates();bombMatch.carrier=options[(Math.random()*options.length)|0]||null;
  en.concat([pl]).forEach(function(e){e.bAction=null;});
  if(bombMatch.carrier===pl)toast(BOMB_TEXT.carrier);
  bombSpectatorIndex=0;document.body.classList.remove('bomb-spectator');
}
function bombDrop(holder){
  if(!isBombMode()||!bombMatch||bombMatch.state!=='idle')return;
  if(holder===bombMatch.carrier){bombMatch.carrier=null;bombMatch.dropped={x:holder.x,z:holder.z};bombMatch.device.visible=true;
    bombMatch.device.position.set(holder.x,0,holder.z);toast(BOMB_TEXT.dropped);}
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
function bombAct(e,dt,enabled){
  var wanted=enabled?bombActionFor(e):null;
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
  b.done=true;b.winner=winner;b.finishDelay=BOMB_RULES.roundBreakSeconds;ts[winner]++;
  b.roundWins=ts.slice();
  en.concat([pl]).forEach(function(e){e.bAction=null;});
  toast((winner?BOMB_TEXT.terrorWin:BOMB_TEXT.policeWin)+' - '+reason);
}
function bombNextRound(){var old=bombMatch,team=pl.tm,wins=ts.slice(),stats={};
  ROS.forEach(function(s){stats[s.tm+':'+s.name]={k:s.k,d:s.d};});
  bombCleanup();old.keepRound=true;
  reset();startMatch(team);
  ts=wins;ROS.forEach(function(s){var h=stats[s.tm+':'+s.name];if(h){s.k=h.k;s.d=h.d;}});
}
function bombBotGoal(e){var b=bombMatch;if(!b||b.done)return null;
  if(b.state==='planted'){
    var pos=b.device.position;
    if(e.tm===0)return[pos.x,pos.z];
    return[pos.x+(e.idx%2?4:-4),pos.z+(e.idx%3?4:-4)];
  }
  if(e.tm===1){
    if(b.dropped)return[b.dropped.x,b.dropped.z];
    if(e===b.carrier){var site=BOMB_SITES[e.siteChoice===undefined?(e.siteChoice=(e.idx+b.round)%BOMB_SITES.length):e.siteChoice];return[site.x,site.z];}
    if(b.carrier)return[b.carrier.x+(e.idx%2?3:-3),b.carrier.z+(e.idx%3?3:-3)];
  }
  var area=BOMB_SITES[(e.idx+b.round)%BOMB_SITES.length];return[area.x,area.z];
}
function bombSpectatorTarget(){
  if(!isBombMode()||!pl.dead||!bombMatch||mt.over)return null;
  var living=en.filter(function(e){return e.tm===pl.tm&&!e.dead;});
  if(!living.length)return null;
  bombSpectatorIndex=((bombSpectatorIndex%living.length)+living.length)%living.length;
  return living[bombSpectatorIndex];
}
function bombSpectatorNext(d){if(isBombMode()&&pl.dead){bombSpectatorIndex+=d;}}
function bombUpdate(dt){if(!isBombMode()||!bombMatch||mt.over)return;
  var b=bombMatch;
  if(b.done){b.finishDelay-=dt;if(b.finishDelay<=0){if(ts[0]>=BOMB_RULES.wins||ts[1]>=BOMB_RULES.wins||b.round>=BOMB_RULES.rounds)endMatch();else bombNextRound();}return;}
  if(mt.cd>0)return;
  if(b.state==='idle'&&b.dropped){
    var candidates=bombCandidates();
    for(var i=0;i<candidates.length;i++){
      var p=candidates[i];if(Math.hypot(p.x-b.dropped.x,p.z-b.dropped.z)>BOMB_RULES.pickupRadius)continue;
      b.carrier=p;b.dropped=null;b.device.visible=false;if(p===pl)toast(BOMB_TEXT.picked);break;
    }
  }
  if(!pl.dead)bombAct(pl,dt,!!(keys.KeyE||bombHold));
  en.forEach(function(e){var canAct=!!bombActionFor(e),near=canAct&&!(e.tg&&e.lok&&Math.hypot(e.tg.x-e.x,e.tg.z-e.z)<6);
    // AI interaction is unarmed and stationary while operating the device.
    bombAct(e,dt,near);});
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
  if(!show)return;
  var b=bombMatch,roundLabel=BOMB_TEXT.round+' '+b.round+' / '+BOMB_RULES.rounds;
  bombInfo.textContent=roundLabel+(b.state==='planted'?'  |  '+BOMB_TEXT.planted+' '+BOMB_SITES[b.site].id:'');
  var action=!pl.dead?bombActionFor(pl):null;
  var label='',progress=0;
  if(pl.dead){var target=bombSpectatorTarget();bombSpec.style.display='block';bombSpec.textContent=target?BOMB_TEXT.spectating+': '+target.name+' | '+BOMB_TEXT.switchView:BOMB_TEXT.noTeam;}
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
