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
document.getElementById("ivback").addEventListener("click",roomQuickBack);
