// ---- WEAPON SLOTS ----
// Slot 0 = primary (pl.prim), 1 = pistol, 2 = knife, 3 = grenade.
// Point Blank-style weapon slots: 1 primary, 2 pistol, 3 knife, 4 grenade
// amo(id): returns the object holding {mag,res} for weapon id (the live `pl` for the current weapon, otherwise pl.ammo[id]).
function amo(id){return id===pl.w?pl:pl.ammo[id];}
// swW(i): switches to weapon i, saving the current weapon's ammo into pl.ammo and loading the new one. Cancels reload.
function swW(i){pl.ammo[pl.w]={mag:pl.mag,res:pl.res};pl.w=i;var a=pl.ammo[i];pl.mag=a.mag;pl.res=a.res;pl.rl=0;pl.sw=.28;pl.thr=0;pl.pend=false;pl.sth=false;pl.stab=0;pl.ghide=0;pl.cd=Math.max(pl.cd,.2);}
// swSlot(s): switches to slot s (0 primary, 1 pistol, 2 knife, 3 grenade) with the switch animation.
function swSlot(s){var id=[pl.prim,inventoryEquipped("secondary"),inventoryEquipped("mele"),inventoryEquipped("explosive")][s],a=amo(id);
  if(id===pl.w){pl.slot=s;return;}
  if((id===5&&a.mag+a.res<=0)||(id===pl.prim&&a.mag+a.res<=0)){toast(id===5?"Out of grenades":"Out of ammo");return;}
  pl.slot=s;swW(id);if(id===5&&pl.mag===0&&pl.res>0)reload();}
// addGren(): +1 grenade (max 6).
function addGren(){var a=amo(5),w=WP[5];if(a.mag+a.res<w.mag+w.res){a.res++;toast("Grenade +1");}}
// doStab(): knife attack: damages enemies in a short cone in front of the player.
function doStab(){killW=4;curK=pl;var w=WP[4],fx=Math.sin(pl.face),fz=Math.cos(pl.face),hit=0;
  en.slice().forEach(function(e){if(e.tm===pl.tm)return;var dx=e.x-pl.x,dz=e.z-pl.z,d=Math.hypot(dx,dz)||1;if(d<WP[4].range+.8&&(dx*fx+dz*fz)/d>.3&&clearTo(pl.x,pl.z,e.x,e.z,0)){dmgE(e,w.dmg,fx,fz,0,"melee");hit++;}});
  spark(pl.x+fx*1.3,1.2+pl.y,pl.z+fz*1.3,hit?0xff6b6b:0xffffff,hit?8:4,3,.07);
  var sh=document.getElementById("slh");sh.className="";void sh.offsetWidth;sh.className="go";}
// mkGren(): builds a grenade mesh.
function mkGren(){var g=new T.Group(),m=new T.Mesh(new T.SphereGeometry(.17,10,8),new T.MeshLambertMaterial({color:0x4a5a2a}));m.castShadow=true;g.add(m,bx(.06,.08,.06,0x888e98,0,.18,0),bx(.05,.03,.16,0xaab0b9,0,.23,.04));S.add(g);return g;}
// throwG(): spawns a thrown grenade using the player's facing and pitch.
function throwG(){pl.mag--;pl.ghide=.65;if(pl.mag===0&&pl.res>0)reload();var f=pl.face,pt=pl.pitch,sp=16+pt*3;
  grs.push({m:mkGren(),x:pl.x+Math.sin(f)*.6,z:pl.z+Math.cos(f)*.6,y:1.3+pl.y,vx:Math.sin(f)*sp,vz:Math.cos(f)*sp,vy:5.5+pt*9,t:1.7});}
// updG(dt): physics for thrown grenades (arc, bounce, fuse, explosion via boom()).
function updG(dt){
  for(var gi=grs.length-1;gi>=0;gi--){var g=grs[gi];
    g.vy-=22*dt;g.t-=dt;
    var nx=g.x+g.vx*dt,nz=g.z+g.vz*dt;
    if(Math.abs(nx)>A-.3||inObs(nx,g.z,.15,g.y)){g.vx*=-.5;nx=g.x;}
    if(Math.abs(nz)>A-.3||inObs(g.x,nz,.15,g.y)){g.vz*=-.5;nz=g.z;}
    g.x=nx;g.z=nz;g.y+=g.vy*dt;
    var fl=gh(g.x,g.z,g.y)+.17;
    if(g.y<fl){g.y=fl;if(g.vy<-1.5)spark(g.x,fl,g.z,0xcfcfcf,2,1.5,.06);g.vy=-g.vy*.4;g.vx*=.72;g.vz*=.72;if(Math.abs(g.vy)<1)g.vy=0;}
    g.m.position.set(g.x,g.y,g.z);g.m.rotation.x+=dt*(Math.abs(g.vx)+Math.abs(g.vz)+1)*1.2;
    g.m.children[0].material.emissive.setHex(g.t<.8&&Math.floor(g.t*10)%2?0x771111:0);
    if(g.t<=0){S.remove(g.m);grs.splice(gi,1);if(g.by)boom(g.x,g.z,WP[5].dmg,"GRENADE",undefined,g.by);else boom(g.x,g.z,WP[5].dmg,"GRENADE");}
  }
}
// SV: inline SVG icons of each weapon id for the HUD.
var SV={0:'<svg viewBox="0 0 48 20"><rect x="10" y="4" width="30" height="6" rx="1"/><rect x="40" y="5" width="4" height="3"/><rect x="12" y="10" width="18" height="3"/><polygon points="12,10 20,10 19,19 12,19"/><rect x="22" y="13.5" width="7" height="1.5"/><rect x="27.5" y="10" width="1.5" height="5"/><rect x="12" y="2.5" width="2" height="1.5"/><rect x="36" y="2.5" width="2" height="1.5"/></svg>',
 1:'<svg viewBox="0 0 48 20"><polygon points="1,7 9,7 9,13 3,14 1,13"/><rect x="9" y="7" width="14" height="5"/><rect x="12" y="5.5" width="7" height="1.5"/><rect x="23" y="7.5" width="11" height="4.5" rx=".5"/><rect x="34" y="8" width="11" height="2"/><rect x="45" y="7.5" width="2" height="3"/><rect x="40" y="6" width="1.5" height="2"/><polygon points="16,12 21,12 23,19 18,19"/><polygon points="10,12 14,12 13,18 9.5,18"/></svg>',
 2:'<svg viewBox="0 0 48 20"><polygon points="1,8 9,8 9,13 4,14 1,12"/><rect x="9" y="7.5" width="10" height="5"/><rect x="19" y="7.5" width="26" height="2.2"/><rect x="19" y="10.2" width="22" height="2.2"/><rect x="26" y="9.5" width="9" height="4.5" rx="1" opacity=".7"/><polygon points="11,12.5 14.5,12.5 14,17 10.5,17"/><rect x="45" y="7" width="2" height="3"/></svg>',
 3:'<svg viewBox="0 0 48 20"><polygon points="1,5 6,7 6,12 1,14"/><rect x="4" y="7" width="30" height="5" rx="2"/><polygon points="34,5 38,5 46,9.5 38,14 34,14"/><polygon points="16,12 19.5,12 19,18.5 15.5,18.5"/><rect x="20" y="3" width="6" height="1"/><rect x="22" y="3.5" width="2" height="3.5"/><rect x="26" y="12" width="2.5" height="4"/></svg>',
 4:'<svg viewBox="0 0 48 20"><rect x="3" y="7.5" width="12" height="5" rx="1.5"/><rect x="15" y="5" width="2.5" height="10"/><polygon points="17.5,8 34,7 46,11 38,13 17.5,12"/></svg>',
 5:'<svg viewBox="0 0 48 20"><ellipse cx="22" cy="12" rx="8" ry="8.5"/><path d="M14.5 10h15M14.2 14h15.6M22 4v16" stroke="var(--hud)" stroke-width="1" fill="none"/><rect x="19.500" y="1.500" width="5" height="3.500" rx=".8"/><polygon points="24.5,2 35,3.5 35,5.5 24.5,5"/><circle cx="38" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
 6:'<svg viewBox="0 0 48 20"><rect x="8" y="5" width="24" height="7" rx="1.5"/><rect x="32" y="6.5" width="12" height="4" rx="1"/><rect x="43" y="7.2" width="4" height="2.4"/><polygon points="17,12 24,12 22,19.5 15,19.5"/><polygon points="9,12 14,12 12,18 8,18"/><rect x="2" y="6.5" width="7" height="3"/><rect x="14" y="3" width="14" height="1.6"/></svg>',
 7:'<svg viewBox="0 0 48 20"><g transform="translate(0,-3) scale(.62)"><rect x="8" y="5" width="24" height="7" rx="1.5"/><rect x="32" y="6.5" width="12" height="4" rx="1"/><polygon points="17,12 24,12 22,19.5 15,19.5"/><polygon points="9,12 14,12 12,18 8,18"/></g><g transform="translate(14,6) scale(.62)"><rect x="8" y="5" width="24" height="7" rx="1.5"/><rect x="32" y="6.5" width="12" height="4" rx="1"/><polygon points="17,12 24,12 22,19.5 15,19.5"/><polygon points="9,12 14,12 12,18 8,18"/></g></svg>',
 8:'<svg viewBox="0 0 48 20"><rect x="1" y="8" width="10" height="5" rx="1.2"/><rect x="11" y="8.5" width="16" height="3.6"/><rect x="27" y="9.6" width="19" height="1.4"/><rect x="45" y="8.8" width="2.6" height="3"/><rect x="16" y="4.4" width="12" height="3" rx="1.4"/><rect x="22" y="5" width="3" height="4"/><polygon points="12,12 17,12 16,18 11,18"/><rect x="21" y="12" width="4" height="4"/></svg>',
 9:'<svg viewBox="0 0 48 20"><rect x="13" y="7" width="17" height="5"/><rect x="28" y="8" width="11" height="3"/><rect x="39" y="9" width="8" height="1.5"/><path d="M1 6h8v3H5v3h9v-3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="5" width="13" height="2"/><rect x="22" y="2" width="4" height="3"/><polygon points="19,12 23,12 26,19 21,19"/><polygon points="14,12 17,12 16,18 12,18"/><rect x="11" y="6" width="2" height="6"/></svg>',
 10:'<svg viewBox="0 0 48 20"><path d="M2 9h6v4H4v-2H2z"/><rect x="8" y="6" width="24" height="7" rx="1"/><rect x="32" y="8" width="11" height="3"/><rect x="43" y="8.5" width="4" height="1.5"/><rect x="14" y="4" width="15" height="2"/><rect x="20" y="2" width="5" height="2"/><polygon points="23,13 27,13 29,19 25,19"/><rect x="11" y="13" width="4" height="6"/></svg>',
 11:'<svg viewBox="0 0 48 20"><path d="M6 6h36l4 5-8 3H8L2 12z"/><rect x="10" y="3" width="31" height="3"/><rect x="17" y="1" width="8" height="2"/><path d="M13 11h8l-4 8h-6l-3-4z" fill="none" stroke="currentColor" stroke-width="2"/><rect x="23" y="11" width="12" height="4"/></svg>',
 12:'<svg viewBox="0 0 48 20"><path d="M2 7h7v3H5v3H2z"/><rect x="9" y="6" width="18" height="7"/><rect x="27" y="7" width="14" height="5"/><rect x="41" y="9" width="6" height="2"/><rect x="12" y="4" width="26" height="2"/><rect x="20" y="1" width="5" height="3"/><path d="M19 12h5l3 7h-5z"/><rect x="30" y="12" width="3" height="7"/></svg>',
 13:'<svg viewBox="0 0 48 20"><rect x="1" y="8" width="17" height="4" rx="2"/><rect x="17" y="7" width="18" height="7" rx="1"/><rect x="34" y="8" width="9" height="5" rx="1"/><polygon points="24,13 29,13 30,20 25,20"/><polygon points="33,13 38,13 40,20 35,20"/><rect x="10" y="6" width="26" height="2"/><rect x="21" y="4" width="5" height="2"/></svg>',
 14:'<svg viewBox="0 0 48 20"><rect x="2" y="7" width="9" height="4" rx="1"/><rect x="10" y="6" width="24" height="8" rx="1"/><rect x="34" y="8" width="8" height="4" rx="1"/><path d="M42 8 L47 5 L47 17 L42 13 Z"/><rect x="12" y="4" width="24" height="2"/><polygon points="19,13 24,13 26,20 20,20"/><polygon points="11,12 15,12 13,18 10,18"/><rect x="22" y="2" width="3" height="2"/></svg>',
 15:'<svg viewBox="0 0 48 20"><rect x="1" y="9" width="7" height="4"/><rect x="7" y="7" width="19" height="6"/><rect x="26" y="7" width="13" height="7"/><rect x="39" y="8" width="7" height="3"/><rect x="7" y="5" width="32" height="2"/><rect x="20" y="2" width="6" height="3"/><rect x="21" y="0" width="1" height="3"/><rect x="25" y="0" width="1" height="3"/><polygon points="19,13 23,13 25,20 20,20"/><polygon points="31,13 34,13 34,19 31,19"/><path d="M42 7v9h-4V7" /></svg>',
 16:'<svg viewBox="0 0 48 20"><path d="M1 10h7l3-4h19l5 3h10v5H34l-4-1H10l-2-2H1z"/><rect x="12" y="4" width="20" height="2"/><path d="M17 4l3-3h10l3 3" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="24" y="0" width="5" height="3" rx="1.5"/><polygon points="19,13 24,13 23,20 17,20"/><polygon points="31,13 35,13 38,20 33,20"/><path d="M41 13v4h4v-4"/></svg>',
 17:'<svg viewBox="0 0 48 20"><rect x="1" y="9" width="10" height="3"/><rect x="10" y="7" width="23" height="6" rx="1"/><path d="M33 9h9l5 2v6h-4v-4H33z"/><rect x="12" y="5" width="24" height="2"/><rect x="20" y="3" width="13" height="2"/><rect x="23" y="1" width="9" height="3" rx="2"/><polygon points="19,13 23,13 22,19 18,19"/><polygon points="27,13 30,13 32,18 29,19"/><path d="M42 13v5M38 14v4" stroke="currentColor" fill="none"/></svg>'};
// Weapon-slot HUD elements and their cached keys (so the DOM is only touched when something changed).
var slEls=[],slKey=[];
(function(){var el=document.getElementById("wsb");for(var s=0;s<4;s++){(function(s){var d=document.createElement("div");d.className="sl";d.innerHTML='<b class="k">'+(s+1)+'</b><span class="ic"></span><span class="nm"></span><span class="sa"></span>';d.addEventListener("pointerdown",function(e){e.stopPropagation();e.preventDefault();if(run&&!pl.dead)swSlot(s);});el.appendChild(d);slEls.push(d);})(s);}})();
// slotUI(w): updates the bottom weapon-slot bar.
function slotUI(w){
  var ids=[pl.prim,inventoryEquipped("secondary"),inventoryEquipped("mele"),inventoryEquipped("explosive")],i,id,a,el,txt,em,on,key;
  for(i=0;i<4;i++){id=ids[i];a=amo(id);
    txt=id===4?"\u221e":a.mag+"/"+(a.res===Infinity?"\u221e":a.res);
    em=id===4?false:a.mag+a.res<=0;on=id===pl.w;
    key=id+"|"+on+"|"+em+"|"+txt;
    if(slKey[i]!==key){slKey[i]=key;el=slEls[i];el.className="sl"+(on?" on":"")+(em?" em":"");
      el.children[1].innerHTML=SV[id];el.children[2].textContent=i===0?WP[id].n:["","Handgun","Knife","Grenade"][i];el.children[3].textContent=txt;}}
  if(w.melee){E.mg.textContent="\u221e";E.rs.textContent="";}
}
// ===== PRIMARY WEAPON SELECT / KRISS <-> DUAL / AWP SCOPE =====
// Weapon behavior stays here. UI presentation and cursor lifecycle live in 77-loadout-picker.js.
var WSEL=[],WDESC={1:"Balanced · Mid range",2:"Close range · High burst",3:"Explosive splash",
 6:"Fast fire rate",8:"High damage · Long range",9:"Standard-issue rifle",
 10:"Compact · Rapid fire",11:"High capacity · Fast SMG",12:"Tactical rifle · Optic",13:"Suppressed · Iron sights",14:"UMP45 · Iron sights",15:"HK417 · Red-dot optic",16:"XM8 · Round red-dot sight",17:"XM2010 · Bolt-action sniper"};
function canAds(w){if(w===7)return false;return w<4||w===6||(WP[w]&&WP[w].snp)||w===WEAPON_STARTER_ID||w===13||w===14||!!tacticalOpticConfig(w);}
function fall(b,p){var f=b.fo;if(!f)return 1;var d=Math.max(0,Math.hypot(p.x-b.sx,p.z-b.sz));return Math.pow(f[0],d/f[1]);}
var scopeEl=document.getElementById("scope"),abEl=document.getElementById("ab");
function refreshWeaponSelection(){
 var owned=inventoryOwned("main");
 WSEL=[WEAPON_STARTER_ID].concat(owned.filter(function(id){return id!==WEAPON_STARTER_ID;}));
 loadoutRender();
}
function chooseWeapon(id){
 if(!run||pl.dead||!(mt.cd>0)||mt.over||wsConfirmed||WSEL.indexOf(id)<0||inventoryOwned("main").indexOf(id)<0)return;
 favPrim=id;pl.prim=id;scopeOn=false;
 if(pl.w!==id){pl.ammo[id]={mag:WP[id].mag,res:WP[id].res};swW(id);}
 else{pl.mag=WP[id].mag;pl.res=WP[id].res;}
 loadoutRefreshSelected();
}
function wselUpd(){loadoutUpdate();}
// V key: Kriss <-> Dual Kriss. Each mode keeps its OWN magazine and reserve ammo.
// V: Kriss <-> Dual Kriss. Each mode keeps its own magazine + reserve
function toggleDual(){if(!run||pl.dead||mt.over||(pl.w!==6&&pl.w!==7))return;
  var to=pl.w===6?7:6;pl.prim=to;favPrim=to;scopeOn=false;swW(to);toast(to===7?"DUAL KRISS":"KRISS");}
// altBtn(): the touch "alt" button: toggles the AWP scope, or Kriss <-> Dual for the Kriss.
function altBtn(){if(!run||pl.dead||mt.over)return;if(WP[pl.w].snp){if(mt.cd<=0&&pl.rl<=0&&!(pl.bolt>0))scopeOn=!scopeOn;}else toggleDual();}
abEl.addEventListener("pointerdown",function(e){e.stopPropagation();e.preventDefault();altBtn();});
// abUpd(): shows/updates the touch alt button text (SCOPE/UNSCOPE, DUAL/SINGLE).
function abUpd(){var show=touch&&run&&!pl.dead&&!lob&&!mt.over&&(pl.w===6||pl.w===7||WP[pl.w].snp);abEl.style.display=show?"block":"none";if(show){var t=WP[pl.w].snp?(scopeOn?"UNSCOPE":"SCOPE"):(pl.w===6?"DUAL":"SINGLE");if(abEl.textContent!==t)abEl.textContent=t;}}
