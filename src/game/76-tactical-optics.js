// ADS visuals: unscoped K2/Shotgun use a clear crosshair; RPG gets a non-magnified launcher reticle.
 // Single Kriss/MP7/P90/AK SOPMOD retain their own reflex sights; Dual Kriss is hip-fire only.
// Different from AWP scope: no opaque full-screen sniper mask and RMB is held.
var TACTICAL_OPTICS={
 3:{style:"rpg",name:"RPG"},
 6:{style:"kriss",name:"Kriss"},
 10:{style:"mp7",name:"MP7"},
 11:{style:"p90",name:"P90"},
 12:{style:"sopmod",name:"AK SOPMOD"},
 15:{style:"hk417",name:"HK417"},
 16:{style:"xm8",name:"XM8",hideViewmodelOnAds:true},
 18:{style:"saiga12",name:"Saiga-12",hideViewmodelOnAds:true}
};
function tacticalOpticConfig(w){return TACTICAL_OPTICS[w]||null;}
// XM8 uses a centered 2D circular reflex sight. Its tall 3D receiver/carry handle
// otherwise obstruct the sight picture; only opt-in weapon configs hide the viewmodel.
function tacticalOpticHidesViewmodel(w,active){var spec=tacticalOpticConfig(w);return !!(active&&spec&&spec.hideViewmodelOnAds);}
var tacticalAimEl=document.getElementById("tacticalAim");
function tacticalOpticUpdate(){
 var spec=pl&&!pl.dead&&!lob&&!mt.over&&mt.cd<=0&&run?tacticalOpticConfig(pl.w):null;
 var active=!!spec&&adsT>.05&&pl.rl<=0&&pl.sw<=0&&!(isBombMode()&&pl.bAction);
 tacticalAimEl.style.display=active?"block":"none";
 tacticalAimEl.style.opacity=active?String(Math.min(1,adsT*1.6)): "0";
 if(active){
   tacticalAimEl.className="tactical-aim tactical-aim-"+spec.style;
 }
 document.body.classList.toggle("tactical-ads",active&&adsT>.65);
 // The 2D overlay draws the sight, so hide the 3D optic frame while aiming (it would block the view and double the optic).
 guns.forEach(function(g,i){var parts=g.userData.opticParts;if(!parts)return;var hide=active&&pl.w===i&&adsT>.35;parts.forEach(function(m){m.visible=!hide;});});
 return active;
}
