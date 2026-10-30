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
