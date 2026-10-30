// MP5K Ext: new stable weapon ID 13 (SMG). Never renumber existing weapon IDs.
// The long integral suppressor, black steel receiver, vertical foregrip and
// compact magazine follow the player-supplied silhouette, built with native Three.js primitives.
WEAPON_PROFILES[13]=Object.freeze({name:"MP5K Ext",damage:22,rpm:92,control:46,speed:86,vRecoil:49,hRecoil:60,mag:30,res:210,range:45,kind:"smg"});
// Inherit the existing SMG distance modifier; do not invent another falloff rule.
WEAPON_RANGE_MODIFIERS[13]=DAMAGE_FALLOFF.defaultModifiers.smg;
WEAPON_MODEL_BUILDERS[13]=function(g,a){
  var steel=0x171c21,body=0x242b31,edge=0x394249,dark=0x0c1014;
  a(
    bx(.127,.152,.62,steel,0,.006,-.17),      // stamped steel receiver
    bx(.132,.065,.59,body,0,.088,-.18),       // top receiver cover
    bx(.128,.024,.42,edge,0,.128,-.21),       // shallow top rail
    bx(.135,.118,.32,0x1b2228,0,-.01,-.61),  // front trunnion and shroud
    cy(.028,.028,.20,dark,0,.005,-.84),       // hidden barrel to suppressor
    cy(.064,.064,.66,0x151a1f,0,.005,-1.20), // long integral black suppressor
    cy(.068,.068,.035,edge,0,.005,-.91),      // suppressor rear collar
    cy(.069,.069,.029,0x343b42,0,.005,-1.49),// recessed muzzle cap
    cy(.039,.039,.031,dark,0,.005,-1.51),     // muzzle bore
    bx(.101,.035,.27,0x2d373e,0,-.024,-.62), // foregrip shroud
    bx(.067,.255,.095,dark,0,-.216,-.57),    // vertical front grip
    bx(.080,.22,.105,dark,0,-.179,.015,-.20), // rear pistol grip
    bx(.084,.278,.092,0x252b30,0,-.237,-.27,-.17), // magazine
    bx(.089,.029,.100,edge,0,-.376,-.33),     // magazine floorplate
    bx(.069,.022,.15,dark,0,-.102,-.12),     // trigger guard
    bx(.056,.045,.13,edge,.065,.01,-.12),    // selector housing
    bx(.125,.115,.11,0x1c2228,0,-.016,.20), // rear receiver end cap
    bx(.019,.050,.06,edge,-.095,.09,-.42)    // charging handle
  );
  // Minimal open iron sights: no optic frame and no scope overlay.
  a(
    bx(.016,.026,.028,edge,-.039,.150,.055),
    bx(.016,.026,.028,edge,.039,.150,.055),
    bx(.014,.033,.026,edge,0,.158,-.70)
  );
  // Suppressor markings and magazine seams are physical low-poly details.
  for(var k=0;k<4;k++){
    a(bx(.010,.009,.028,0x40464b,-.060,.014,-1.35+k*.105));
    a(bx(.010,.009,.028,0x40464b,.060,.014,-1.35+k*.105));
  }
  for(var m=0;m<4;m++)a(bx(.087,.007,.012,edge,0,-.198-m*.036,-.26-m*.007));
};
