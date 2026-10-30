// Kriss: stable weapon ID 6 (smg). Profile ratings and range modifier are weapon-local.
WEAPON_PROFILES[6]=Object.freeze({name:"Kriss",damage:21,rpm:93,control:59,speed:90,vRecoil:48,hRecoil:48,mag:30,res:210,range:60,kind:"smg"});
WEAPON_RANGE_MODIFIERS[6]=0.83;
WEAPON_MODEL_BUILDERS[6]=function(g,a){
 a(
    bx(.085,.1,.52,0x9c8b5e,0,.03,-.28),                       // upper receiver (FDE tan)
    bx(.08,.07,.34,0x2b2f3d,0,-.04,-.2),                        // lower receiver (dark polymer)
    bx(.09,.1,.2,0x8f7f55,0,.025,-.62),                         // barrel shroud
    bx(.092,.035,.03,0x111111,0,.03,-.56),bx(.092,.035,.03,0x111111,0,.03,-.62),bx(.092,.035,.03,0x111111,0,.03,-.68), // shroud vents
    cy(.017,.017,.14,0x1d2129,0,.03,-.79),cy(.026,.026,.05,0x111111,0,.03,-.87), // barrel + flash hider
    bx(.04,.022,.42,0x111111,0,.087,-.26),                      // top rail
    bx(.088,.03,.1,0x555c68,0,.05,-.12)                         // ejection port / bolt cover
 );
 // Register the complete single-Kriss reflex sight: these parts disappear only
 // while its 2D ADS reticle is active. Dual Kriss uses independent nested models,
 // stays hip-fire only and never activates this overlay.
 var opticParts=[
    bx(.05,.02,.12,0x1d2129,0,.108,-.2),                        // red-dot base
    bx(.008,.05,.012,0x111111,-.026,.13,-.15),bx(.008,.05,.012,0x111111,.026,.13,-.15),bx(.06,.008,.012,0x111111,0,.158,-.15), // sight rear frame
    bx(.008,.05,.012,0x111111,-.026,.13,-.25),bx(.008,.05,.012,0x111111,.026,.13,-.25),bx(.06,.008,.012,0x111111,0,.158,-.25), // sight front frame
    bx(.007,.007,.004,0xff2a2a,0,.13,-.256)                     // red dot
 ];
 opticParts.forEach(function(mesh){a(mesh);});
 g.userData.opticParts=opticParts;
 a(
    bx(.07,.26,.095,0x1d2129,0,-.17,-.12,-.3),                  // grip + magazine (angled back, Vector style)
    bx(.02,.025,.1,0x2b2f3d,0,-.09,-.22),                       // trigger guard
    bx(.05,.06,.035,0x2b2f3d,0,.03,0),bx(.06,.1,.03,0x1d2129,0,.0,.03)); // short folded stock + pad (kept tiny)
};
