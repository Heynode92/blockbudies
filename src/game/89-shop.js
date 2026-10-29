// Shop unlocks the existing non-starter primaries without inventing a coin economy.
// New players only own K2. Shop unlock is free until a priced economy is specified.
function shopCatalog(){
  return inventoryCatalogMain().filter(function(id){return id!==WEAPON_STARTER_ID;});
}
function shopRender(){
  var grid=document.getElementById("shopGrid");
  grid.textContent="";
  shopCatalog().forEach(function(id){
    var w=WP[id],isOwned=inventoryOwned("main").indexOf(id)>=0;
    var tile=document.createElement("article");tile.className="shop-weapon"+(isOwned?" shop-owned":"");
    var media=document.createElement("div");media.className="shop-art";
    if(INVENTORY_THUMBS[id]){
      var img=document.createElement("img");img.src=INVENTORY_THUMBS[id];
      img.alt=w.n+" weapon model";img.loading="lazy";media.appendChild(img);
    }else{
      var missing=document.createElement("span");missing.textContent="PREVIEW UNAVAILABLE";media.appendChild(missing);
    }
    var details=document.createElement("div");details.className="shop-details";
    var name=document.createElement("h3");name.textContent=w.n;
    var type=document.createElement("p");type.textContent=inventoryWeaponRole(w.stats.kind);
    var specs=document.createElement("span");specs.className="shop-specs";
    specs.textContent="DAMAGE "+w.stats.damage+"  ·  SPEED "+w.stats.speed+"  ·  "+w.mag+"/"+w.res+" AMMO";
    details.appendChild(name);details.appendChild(type);details.appendChild(specs);
    var action=document.createElement("button");action.type="button";
    action.className="shop-action"+(isOwned?" shop-action-owned":"");
    action.disabled=isOwned;action.textContent=isOwned?"OWNED":"UNLOCK FREE";
    action.onclick=function(){
      if(inventoryClaimPrimary(id)){shopRender();toast("UNLOCKED: "+w.n);}
    };
    tile.appendChild(media);tile.appendChild(details);tile.appendChild(action);
    grid.appendChild(tile);
  });
}
function shopOpen(){
  lobP("lbshop");inventoryBuildThumbnails();shopRender();
}
document.getElementById("lshop").addEventListener("click",shopOpen);
document.getElementById("shopBack").addEventListener("click",function(){lobP("lbs");});
