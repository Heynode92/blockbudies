// Inventory: weapon collection and loadout. Render using REAL game meshes and colors.
var INVENTORY_STORAGE="bbfps_inventory_v1";
// Dual Kriss is a firing mode of Kriss (V in-match), not a second owned weapon.
var INVENTORY_TABS=[
 {key:"main",label:"MAIN WEAPON",kinds:["rifle","shotgun","rocket","smg","sniper"]},
 {key:"secondary",label:"SECONDARY",kinds:["pistol"]},
 {key:"mele",label:"MELE",kinds:["knife"]},
 {key:"explosive",label:"EXPLOSIVE",kinds:["grenade"]},
 {key:"item",label:"ITEM",kinds:[]}
];
var INVENTORY_DESCRIPTIONS={
 rifle:"Reliable mid-range automatic rifle.",shotgun:"Heavy close-range damage.",
 rocket:"Explosive projectile launcher.",smg:"Kriss includes Dual Mode. Press V in a match to switch.",
 sniper:"Precision rifle with a scope.",pistol:"Secondary weapon assigned automatically.",
 knife:"Melee weapon assigned automatically.",grenade:"Explosive slot automatically equipped."
};
var inventoryTab="main",inventoryPick={},inventoryState={equipped:{}};
function inventoryOwned(cat){
 var c=INVENTORY_TABS.filter(function(t){return t.key===cat;})[0],ids=[];
 if(!c)return ids;
 WP.forEach(function(w,id){if(c.kinds.indexOf(w.stats.kind)>=0)ids.push(id);});
 return ids;
}
function inventoryEquipped(cat){
 var ids=inventoryOwned(cat),id=inventoryState.equipped[cat];
 return ids.indexOf(id)>=0?id:(ids.length?ids[0]:null);
}
function inventoryLoad(){
 var saved=null;try{saved=JSON.parse(localStorage.getItem(INVENTORY_STORAGE));}catch(err){}
 INVENTORY_TABS.forEach(function(c){
   var ids=inventoryOwned(c.key),wish=saved&&saved.equipped&&saved.equipped[c.key];
   // Migrate older inventory saves that treated Dual Kriss as an owned item.
   if(c.key==="main"&&wish===7)wish=6;
   inventoryState.equipped[c.key]=ids.indexOf(wish)>=0?wish:(ids.length?ids[0]:null);
 });
 var primary=inventoryEquipped("main");if(primary!==null)favPrim=primary;
}
function inventoryForNewMatch(){
 var id=inventoryEquipped("main");if(id!==null)favPrim=id;
}
function inventoryEquip(cat,id){
 if(inventoryOwned(cat).indexOf(id)<0)return false;
 inventoryState.equipped[cat]=id;
 if(cat==="main")favPrim=id;
 try{localStorage.setItem(INVENTORY_STORAGE,JSON.stringify(inventoryState));}catch(err){}
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
 inventoryPreview={host:host,actor:actor,mount:mount,guns:guns,renderer:renderer,scene:scene,camera:camera,selected:null};
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
 if(!document.getElementById("lbiv").classList.contains("on")){inventoryPreviewLive=false;return;}
 var p=inventoryPreview,w=Math.max(1,p.host.clientWidth),h=Math.max(1,p.host.clientHeight);
 if(p.renderer.domElement.width!==Math.round(w*p.renderer.getPixelRatio())||
    p.renderer.domElement.height!==Math.round(h*p.renderer.getPixelRatio())){
   p.renderer.setSize(w,h,false);p.camera.aspect=w/h;p.camera.updateProjectionMatrix();
 }
 inventoryPoseFrame(p,now);
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
   var ids=[];INVENTORY_TABS.forEach(function(tab){inventoryOwned(tab.key).forEach(function(id){if(ids.indexOf(id)<0)ids.push(id);});});
   ids.forEach(function(id){
     var gun=mkGun(id);scene.add(gun);
     gun.rotation.set(-.13,Math.PI/2+.12,0);
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
function inventoryRender(){
 var ids=inventoryOwned(inventoryTab),equipped=inventoryEquipped(inventoryTab),
 selected=inventoryPick[inventoryTab];
 if(ids.indexOf(selected)<0)selected=equipped;
 inventoryPick[inventoryTab]=selected;
 var tabs=document.getElementById("ivtabs"),cards=document.getElementById("ivcards"),stats=document.getElementById("ivstats");
 tabs.textContent="";
 INVENTORY_TABS.forEach(function(c){
   var b=document.createElement("button");b.type="button";b.textContent=c.label;
   b.className=c.key===inventoryTab?"on":"";
   b.setAttribute("aria-pressed",c.key===inventoryTab?"true":"false");
   b.onclick=function(){inventoryTab=c.key;inventoryRender();};tabs.appendChild(b);
 });
 cards.textContent="";
 if(!ids.length){var empty=document.createElement("p");empty.className="ivempty";empty.textContent="NO ITEMS OWNED YET";cards.appendChild(empty);}
 ids.forEach(function(id){
   var item=document.createElement("button"),p=WP[id].stats;item.type="button";
   item.className="ivcard"+(id===selected?" selected":"")+(id===equipped?" equipped":"");
   var image=INVENTORY_THUMBS[id]?
     '<img class="ivthumb" src="'+INVENTORY_THUMBS[id]+'" alt="'+WP[id].n+' 3D weapon preview">':
     '<span class="ivthumb-fallback">3D PREVIEW UNAVAILABLE</span>';
   item.innerHTML='<span class="ivweaponicon">'+image+'</span><span class="ivweaponinfo"><strong>'+
     WP[id].n+'</strong><small>DMG '+p.damage+' · SPD '+p.speed+' · RANGE '+inventoryValue(p.range)+
     '</small></span><span class="ivmark">'+(id===equipped?"IN USE":"VIEW")+'</span>';
   item.onclick=function(){inventoryPick[inventoryTab]=id;inventoryRender();};
   cards.appendChild(item);
 });
 document.getElementById("ivcategory").textContent=INVENTORY_TABS.filter(function(c){return c.key===inventoryTab;})[0].label;
 document.getElementById("ivname").textContent=selected===null?"NO ITEM":WP[selected].n;
 document.getElementById("ivstatus").textContent=selected===null?"EMPTY":selected===equipped?"EQUIPPED":"AVAILABLE";
 document.getElementById("ivdescription").textContent=selected===null?"Items you obtain will appear here.":
   (INVENTORY_DESCRIPTIONS[WP[selected].stats.kind]||"Ready for your loadout.");
 stats.textContent="";
 if(selected!==null){
   var st=WP[selected].stats;
   [["DAMAGE",st.damage],["SPEED",st.speed],["CONTROL",st.control],
    ["RANGE",st.range],["BULLETS",st.mag+"/"+inventoryValue(st.res)],["RPM",st.rpm]].forEach(function(pair){
     var node=document.createElement("div"),label=document.createElement("span"),value=document.createElement("strong");
     label.textContent=pair[0];value.textContent=inventoryValue(pair[1]);
     node.appendChild(label);node.appendChild(value);stats.appendChild(node);
   });
 }
 var use=document.getElementById("ivuse");
 use.disabled=selected===null||selected===equipped;
 use.textContent=selected===null?"NO ITEM":selected===equipped?"IN USE":"USE";
 use.onclick=function(){if(selected!==null)inventoryEquip(inventoryTab,selected);};
 inventoryShowModel(selected);
}
function inventoryOpen(){
 inventoryTab="main";inventoryAngle=.14;lobP("lbiv");
 inventoryPreviewInit();inventoryBuildThumbnails();inventoryRender();inventoryStartPreview();
}
inventoryLoad();
document.getElementById("lbin").addEventListener("click",inventoryOpen);
document.getElementById("ivback").addEventListener("click",function(){lobP("lbs");});
