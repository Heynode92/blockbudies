// HK417: stable weapon ID 15, assault rifle. Keep IDs 0–14 and their saves unchanged.
// Dedicated black low-poly model based on the supplied HK417 rifle silhouette:
// long quad-rail handguard, extended barrel, vertical foregrip, straight magazine,
// adjustable stock, and a box-shaped reflex sight with red-dot illumination.
WEAPON_PROFILES[15]=Object.freeze({
 name:"HK417",damage:33,rpm:92,control:50,speed:74,
 vRecoil:64,hRecoil:60,mag:30,res:150,range:160,kind:"rifle"
});
// Existing assault-rifle distance falloff. No parallel ballistics system.
WEAPON_RANGE_MODIFIERS[15]=DAMAGE_FALLOFF.defaultModifiers.rifle;
WEAPON_MODEL_BUILDERS[15]=function(g,a){
 var dark=0x101519,body=0x212a30,metal=0x394249,rail=0x4d575b,grip=0x181d21;
 a(
  bx(.128,.160,.63,body,0,.00,-.20),         // black receiver
  bx(.129,.058,.57,metal,0,.104,-.24),        // upper receiver
  bx(.145,.117,.83,body,0,.016,-.84),        // HK417 full-length handguard
  bx(.151,.031,.82,dark,0,.111,-.84),        // long Picatinny top rail
  bx(.158,.040,.77,metal,0,-.038,-.86),      // lower rail
  cy(.026,.026,.40,dark,0,-.006,-1.39),      // exposed barrel
  cy(.036,.036,.077,metal,0,-.006,-1.61),    // standard muzzle brake (not suppressed)
  bx(.070,.025,.15,rail,0,.015,-1.18),       // gas block
  bx(.100,.067,.16,metal,0,-.015,-.13),      // magazine well
  bx(.093,.315,.115,0x1b3029,0,-.242,-.28,-.08), // dark olive magazine
  bx(.095,.025,.121,dark,0,-.396,-.30),       // magazine floorplate
  bx(.080,.255,.112,grip,0,-.204,.095,-.25),  // rear pistol grip
  bx(.077,.042,.112,dark,0,-.108,-.03),       // trigger guard
  bx(.066,.270,.102,grip,0,-.226,-.84),      // vertical tactical front grip
  bx(.078,.028,.116,metal,0,-.369,-.84),     // foregrip grip-end
  bx(.050,.043,.36,metal,0,.000,.40),         // buffer tube
  bx(.121,.125,.37,grip,0,-.033,.57),        // telescopic polymer stock
  bx(.135,.196,.044,dark,0,-.038,.78),       // rubber stock buttplate
  bx(.045,.045,.085,rail,.083,.055,-.11),    // charging handle
  bx(.050,.016,.065,rail,.082,-.030,-.21)    // safety selector
 );
 // Receivers are mirrored geometry: top-and-side modular rail cuts.
 for(var i=0;i<11;i++){
  var z=-1.18+i*.065;
  a(
   bx(.016,.014,.028,rail,-.073,.127,z),
   bx(.016,.014,.028,rail,.073,.127,z),
   bx(.010,.022,.027,metal,-.080,.055,z),
   bx(.010,.022,.027,metal,.080,.055,z)
  );
 }
 for(var m=0;m<5;m++)a(bx(.096,.009,.013,metal,0,-.17-m*.049,-.25));
 // Actual low-poly box sight is displayed when hip-firing. The existing
 // tactical ADS overlay replaces it when aiming, so no geometry occludes the dot.
 var opticParts=[
  bx(.084,.023,.21,rail,0,.157,-.20),        // sight mounting base
  bx(.081,.035,.145,metal,0,.220,-.20),      // lower optic housing
  bx(.016,.092,.020,dark,-.059,.255,-.20),   // left window side
  bx(.016,.092,.020,dark,.059,.255,-.20),    // right window side
  bx(.136,.018,.025,dark,0,.301,-.20),      // rectangular roof
  bx(.017,.033,.020,rail,-.055,.321,-.20),  // left hood
  bx(.017,.033,.020,rail,.055,.321,-.20),   // right hood
  bx(.009,.009,.009,0xe73234,0,.259,-.215) // red dot for 3D display
 ];
 opticParts.forEach(function(part){a(part);});
 g.userData.opticParts=opticParts;
};
