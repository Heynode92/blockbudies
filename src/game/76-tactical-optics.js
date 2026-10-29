// Tactical optics: compact sight overlays for MP7/P90/AK SOPMOD.
// Different from AWP scope: no opaque full-screen sniper mask and RMB is held.
var TACTICAL_OPTICS={
 10:{style:"mp7",name:"MP7",label:"MICRO RED DOT"},
 11:{style:"p90",name:"P90",label:"INTEGRATED RING SIGHT"},
 12:{style:"sopmod",name:"AK SOPMOD",label:"CARBINE HOLO SIGHT"}
};
function tacticalOpticConfig(w){return TACTICAL_OPTICS[w]||null;}
var tacticalAimEl=document.getElementById("tacticalAim");
function tacticalOpticUpdate(){
 var spec=pl&&!pl.dead&&!lob&&!mt.over&&mt.cd<=0&&run?tacticalOpticConfig(pl.w):null;
 var active=!!spec&&adsT>.05&&pl.rl<=0&&pl.sw<=0&&!(isBombMode()&&pl.bAction);
 tacticalAimEl.style.display=active?"block":"none";
 tacticalAimEl.style.opacity=active?String(Math.min(1,adsT*1.6)): "0";
 if(active){
   tacticalAimEl.className="tactical-aim tactical-aim-"+spec.style;
   tacticalAimEl.querySelector(".ta-label").textContent=spec.label;
 }
 document.body.classList.toggle("tactical-ads",active&&adsT>.65);
}
