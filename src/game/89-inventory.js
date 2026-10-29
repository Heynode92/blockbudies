// LOBBY INVENTORY. Built from existing WP/SV/terro/mkGun, not fabricated weapon assets.
var INVENTORY_STORAGE="bbfps_inventory_v1";
var INVENTORY_TABS=[
 {key:"main",label:"MAIN WEAPON",kinds:["rifle","shotgun","rocket","smg","dual","sniper"]},
 {key:"secondary",label:"SECONDARY",kinds:["pistol"]},
 {key:"mele",label:"MELE",kinds:["knife"]},
 {key:"explosive",label:"EXPLOSIVE",kinds:["grenade"]},
 {key:"item",label:"ITEM",kinds:[]}
];
var INVENTORY_DESCRIPTIONS={
 rifle:"Reliable mid-range automatic rifle.",shotgun:"Heavy close-range damage.",
 rocket:"Explosive projectile launcher.",smg:"Rapid-fire submachine gun.",
 dual:"Dual Kriss with a large magazine.",sniper:"Precision rifle with a scope.",
 pistol:"Secondary weapon assigned automatically.",knife:"Melee weapon assigned automatically.",
 grenade:"Explosive slot automatically equipped."
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
var inventoryPreview=null,inventoryPreviewLive=false,inventoryAngle=.3;
function inventoryPreviewInit(){
 if(inventoryPreview)return;
 var host=document.getElementById("ivpreview"),scene=new T.Scene(),
 camera=new T.PerspectiveCamera(40,1,.1,60);
 camera.position.set(3.25,2.5,5.2);camera.lookAt(0,1.25,0);
 scene.add(new T.HemisphereLight(0xffffff,0x65748c,1.9));
 var a=new T.DirectionalLight(0xffdfb4,1.35);a.position.set(4,6,5);scene.add(a);
 var b=new T.DirectionalLight(0x86b9ff,.95);b.position.set(-3,2,-4);scene.add(b);
 // Actual in-game character, detached from the gameplay scene and rendered separately.
 var actor=terro(0);S.remove(actor.g);scene.add(actor.g);
 var mount=actor.g.userData.gun;
 if(actor.g.userData.rg)mount.remove(actor.g.userData.rg);
 var guns=WP.map(function(w,id){
   var g=mkGun(id);g.rotation.y=Math.PI;g.scale.setScalar(id===3?.96:1.2);
   g.position.set(.2,1.05,-.16);g.visible=false;mount.add(g);return g;
 });
 var renderer=new T.WebGLRenderer({alpha:true,antialias:true});
 renderer.setClearColor(0x000000,0);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
 renderer.domElement.className="ivcanvas";host.insertBefore(renderer.domElement,host.firstChild);
 var down=false,x=0;
 renderer.domElement.addEventListener("pointerdown",function(e){down=true;x=e.clientX;try{this.setPointerCapture(e.pointerId);}catch(err){}});
 renderer.domElement.addEventListener("pointermove",function(e){if(down){inventoryAngle+=(e.clientX-x)*.012;x=e.clientX;}});
 renderer.domElement.addEventListener("pointerup",function(){down=false;});
 renderer.domElement.addEventListener("pointercancel",function(){down=false;});
 inventoryPreview={host:host,actor:actor,guns:guns,renderer:renderer,scene:scene,camera:camera,selected:null};
}
function inventoryShowModel(id){
 inventoryPreviewInit();
 inventoryPreview.selected=id;
 inventoryPreview.guns.forEach(function(g,j){g.visible=id===j;});
}
function inventoryPreviewFrame(now){
 if(!document.getElementById("lbiv").classList.contains("on")){inventoryPreviewLive=false;return;}
 var p=inventoryPreview,w=Math.max(1,p.host.clientWidth),h=Math.max(1,p.host.clientHeight);
 if(p.renderer.domElement.width!==Math.round(w*p.renderer.getPixelRatio())||
    p.renderer.domElement.height!==Math.round(h*p.renderer.getPixelRatio())){
   p.renderer.setSize(w,h,false);p.camera.aspect=w/h;p.camera.updateProjectionMatrix();
 }
 p.actor.g.rotation.y=inventoryAngle+Math.sin(now*.00045)*.03;
 p.actor.body.position.y=Math.sin(now*.0017)*.018;
 p.renderer.render(p.scene,p.camera);
 requestAnimationFrame(inventoryPreviewFrame);
}
function inventoryStartPreview(){
 inventoryPreviewInit();
 if(!inventoryPreviewLive){inventoryPreviewLive=true;requestAnimationFrame(inventoryPreviewFrame);}
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
   item.innerHTML='<span class="ivweaponicon">'+SV[id]+'</span><span class="ivweaponinfo"><strong>'+
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
 inventoryTab="main";inventoryAngle=.3;lobP("lbiv");inventoryRender();inventoryStartPreview();
}
inventoryLoad();
document.getElementById("lbin").addEventListener("click",inventoryOpen);
document.getElementById("ivback").addEventListener("click",function(){lobP("lbs");});
