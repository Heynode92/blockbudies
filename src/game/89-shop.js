// Shop unlocks the existing non-starter primaries without inventing a coin economy.
// New players only own K2. Shop unlock is free until a priced economy is specified.
var shopFilter="ALL",shopAnim=true,shopFlashId=-1,shopAcc={},shopSelectedId=null;
var SHOP_ACCENTS=["#ff922b","#4dc3ff","#ff5c6c","#b388ff","#70e1a5","#ffd43b","#f783ac","#74c0fc"];
function shopCatalog(){
  return inventoryCatalogMain().filter(function(id){return id!==WEAPON_STARTER_ID;});
}
function shopEl(tag,cls,text){
  var e=document.createElement(tag);
  if(cls)e.className=cls;
  if(text!==undefined)e.textContent=text;
  return e;
}
function shopNum(v){var n=parseFloat(v);return isFinite(n)?n:0;}
function shopRole(id){return inventoryWeaponRole(WP[id].stats.kind);}
// Each weapon class keeps the same accent colour in the filter bar and on its cards.
function shopAccent(role){
  if(!shopAcc[role])shopAcc[role]=SHOP_ACCENTS[Object.keys(shopAcc).length%SHOP_ACCENTS.length];
  return shopAcc[role];
}
function shopStat(label,value,max){
  var row=shopEl("div","shop-stat"),bar=shopEl("span","ss-b"),fill=shopEl("span");
  fill.style.width=Math.max(6,Math.min(100,max>0?shopNum(value)/max*100:0))+"%";
  bar.appendChild(fill);
  row.appendChild(shopEl("span","ss-l",label));row.appendChild(bar);row.appendChild(shopEl("span","ss-v",value));
  return row;
}
function shopBuildFilter(roles,ids){
  var grid=document.getElementById("shopGrid"),bar=document.getElementById("shopFilter");
  if(!bar){bar=shopEl("div","shop-filter");bar.id="shopFilter";grid.parentNode.insertBefore(bar,grid);}
  bar.textContent="";
  if(roles.indexOf(shopFilter)<0)shopFilter="ALL";
  ["ALL"].concat(roles).forEach(function(r){
    var n=r==="ALL"?ids.length:ids.filter(function(id){return shopRole(id)===r;}).length;
    var chip=shopEl("button","shop-chip"+(r===shopFilter?" shop-chip-on":""),r);
    chip.type="button";chip.style.setProperty("--acc",r==="ALL"?"#ff922b":shopAccent(r));
    chip.appendChild(shopEl("span","",n));
    chip.onclick=function(){shopFilter=r;shopAnim=true;grid.scrollTop=0;shopRender();};
    bar.appendChild(chip);
  });
}
function shopRender(){
  var grid=document.getElementById("shopGrid"),ids=shopCatalog(),owned=inventoryOwned("main"),
      roles=[],max={d:1,s:1,m:1},flash=shopFlashId,shown=0,scrollPosition=grid.scrollTop;
  shopFlashId=-1;
  // Bar lengths are relative to the strongest weapon in the shop, so no assumptions about stat scales.
  ids.forEach(function(id){
    var w=WP[id],r=shopRole(id);
    if(roles.indexOf(r)<0)roles.push(r);
    shopAccent(r);
    max.d=Math.max(max.d,shopNum(w.stats.damage));
    max.s=Math.max(max.s,shopNum(w.stats.speed));
    max.m=Math.max(max.m,shopNum(w.mag));
  });
  shopBuildFilter(roles,ids);
  if(ids.indexOf(shopSelectedId)<0)shopSelectedId=ids[0];
  if(shopFilter!=="ALL"&&shopRole(shopSelectedId)!==shopFilter)shopSelectedId=ids.filter(function(id){return shopRole(id)===shopFilter;})[0];
  shopRenderSelection(ids,owned,max);
  grid.textContent="";
  ids.forEach(function(id,index){
    var w=WP[id],role=shopRole(id);
    if(shopFilter!=="ALL"&&role!==shopFilter)return;
    var isOwned=owned.indexOf(id)>=0;
    var tile=shopEl("article","shop-weapon"+(id===shopSelectedId?" shop-weapon-active":"")+(isOwned?" shop-owned":"")+(shopAnim?" shop-enter":"")+(id===flash?" shop-unlocked":""));
    tile.style.setProperty("--acc",shopAccent(role));tile.style.setProperty("--i",shown);
    tile.tabIndex=0;tile.setAttribute("role","button");tile.setAttribute("aria-pressed",String(id===shopSelectedId));
    tile.onclick=function(){shopSelectedId=id;shopAnim=false;shopRender();};
    tile.onkeydown=function(e){if(e.target===tile&&(e.key==="Enter"||e.key===" ")){e.preventDefault();tile.click();}};
    var media=shopEl("div","shop-art");
    media.appendChild(shopEl("span","shop-num",(index<9?"0":"")+(index+1)));
    media.appendChild(shopEl("span","shop-tag",role));
    if(INVENTORY_THUMBS[id]){
      var img=document.createElement("img");img.src=INVENTORY_THUMBS[id];
      img.alt=w.n+" weapon model";img.loading="lazy";media.appendChild(img);
    }else{
      media.appendChild(shopEl("span","","PREVIEW UNAVAILABLE"));
    }
    if(isOwned)media.appendChild(shopEl("span","shop-ribbon","OWNED"));
    var details=shopEl("div","shop-details");
    details.appendChild(shopEl("h3","",w.n));
    var stats=shopEl("div","shop-stats");
    stats.appendChild(shopStat("DAMAGE",w.stats.damage,max.d));
    stats.appendChild(shopStat("SPEED",w.stats.speed,max.s));
    stats.appendChild(shopStat("MAGAZINE",w.mag,max.m));
    details.appendChild(stats);
    var ammo=shopEl("div","shop-ammo","AMMO ");
    ammo.appendChild(shopEl("b","",w.mag+" / "+w.res));
    details.appendChild(ammo);
    var action=shopEl("button","shop-action"+(isOwned?" shop-action-owned":""),isOwned?"\u2713 OWNED":"UNLOCK FREE");
    action.type="button";action.disabled=isOwned;
    action.onclick=function(e){e.stopPropagation();
      if(inventoryClaimPrimary(id)){shopAnim=false;shopFlashId=id;shopRender();toast("UNLOCKED: "+w.n);}
    };
    tile.appendChild(media);tile.appendChild(details);tile.appendChild(action);
    grid.appendChild(tile);shown++;
  });
  grid.scrollTop=scrollPosition;
  shopAnim=false;
}
function shopRenderSelection(ids,owned,max){
 var id=shopSelectedId,host=document.getElementById("shopSelected");
 if(!host||id===undefined||!WP[id])return;
 var w=WP[id],role=shopRole(id),isOwned=owned.indexOf(id)>=0;
 var changed=host.dataset.selected!==String(id);
 host.textContent="";host.style.setProperty("--acc",shopAccent(role));
 host.dataset.selected=String(id);if(changed)host.scrollTop=0;
 var head=shopEl("div","shop-sel-heading");
 head.appendChild(shopEl("span","shop-sel-role",role));
 head.appendChild(shopEl("span","shop-sel-badge",isOwned?"OWNED":"AVAILABLE"));
 head.appendChild(shopEl("h3","",w.n));
 head.appendChild(shopEl("p","",INVENTORY_DESCRIPTIONS[w.stats.kind]||""));
 host.appendChild(head);
 var preview=shopEl("div","shop-sel-preview");
 if(INVENTORY_THUMBS[id]){var img=document.createElement("img");img.src=INVENTORY_THUMBS[id];img.alt=w.n+" model preview";preview.appendChild(img);}
 else preview.appendChild(shopEl("span","","PREVIEW UNAVAILABLE"));
 host.appendChild(preview);
 host.appendChild(shopEl("h4","shop-sel-stats-title","WEAPON STATS"));
 var stats=shopEl("div","shop-sel-stats");
 [["DAMAGE",w.stats.damage],["FIRE RATE",w.stats.rpm],["CONTROL",w.stats.control],["SPEED",w.stats.speed],["VERTICAL RECOIL",w.stats.vRecoil],["HORIZONTAL RECOIL",w.stats.hRecoil],["RANGE",w.stats.range],["MAGAZINE",w.mag]].forEach(function(pair){
 if(pair[1]===undefined)return;
 stats.appendChild(shopStat(pair[0],pair[1],pair[0]==="DAMAGE"?max.d:pair[0]==="MAGAZINE"?max.m:pair[0]==="RANGE"?180:100));
 });
 host.appendChild(stats);
 var ammo=shopEl("div","shop-sel-ammo","AMMO ");
 ammo.appendChild(shopEl("b","",w.mag+" / "+w.res));host.appendChild(ammo);
 var action=shopEl("button","shop-action shop-sel-action"+(isOwned?" shop-action-owned":""),isOwned?"✓ OWNED":"UNLOCK FREE");
 action.type="button";action.disabled=isOwned;
 action.onclick=function(){if(inventoryClaimPrimary(id)){shopAnim=false;shopFlashId=id;shopRender();toast("UNLOCKED: "+w.n);}};
 host.appendChild(action);
}
function shopOpen(){
  lobP("lbshop");shopAnim=true;inventoryBuildThumbnails();document.getElementById("shopGrid").scrollTop=0;shopRender();
}
document.getElementById("lshop").addEventListener("click",shopOpen);
document.getElementById("shopBack").addEventListener("click",function(){lobP("lbs");});