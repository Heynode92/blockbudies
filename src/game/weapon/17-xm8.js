// XM8: stable weapon ID 16, assault rifle. Do not renumber saved weapon IDs 0–15.
// Dedicated grey/black low-poly XM8 silhouette based on the supplied image:
// polymer full-length shell, slotted elevated carry handle, round reflex optic,
// ribbed fore-end, magazine, grip and swept integrated shoulder stock.
WEAPON_PROFILES[16]=Object.freeze({
 name:"XM8",damage:25,rpm:92,control:63,speed:82,
 vRecoil:49,hRecoil:28,mag:30,res:150,range:100,kind:"rifle"
});
// Share the existing rifle damage-falloff and rate-of-fire tuning.
WEAPON_RANGE_MODIFIERS[16]=DAMAGE_FALLOFF.defaultModifiers.rifle;
WEAPON_MODEL_BUILDERS[16]=function(g,a){
 var shell=0x555d64,upper=0x666e74,high=0x858d94,shade=0x394148;
 var dark=0x1d2328,rail=0x30373d,grip=0x282f34,highlight=0x929a9d;
 a(
  bx(.176,.168,.82,shell,0,.010,-.24),       // XM8 extended upper polymer shell
  bx(.174,.096,.61,upper,0,.083,-.29),       // elevated, rounded-looking receiver
  bx(.177,.130,.60,shade,0,-.014,-.67),      // forward shell / ventilation shroud
  bx(.171,.085,.42,shell,0,-.021,-.92),      // broad curved-look fore-end
  bx(.120,.032,.64,rail,0,.153,-.30),        // top bridge underneath carry handle
  cy(.022,.022,.27,dark,0,-.009,-1.29),      // projecting barrel
  cy(.032,.032,.077,shade,0,-.009,-1.46),    // short XM8 muzzle brake
  bx(.112,.075,.29,upper,0,.02,.31),         // rear receiver
  bx(.128,.115,.38,shell,0,-.002,.52),       // integrated rear shoulder housing
  bx(.136,.165,.26,shade,0,-.010,.75),       // folding / telescoping stock
  bx(.153,.200,.042,dark,0,-.01,.90),        // textured rubber buttplate
  bx(.084,.237,.106,grip,0,-.209,.11,-.26), // angled main pistol grip
  bx(.083,.030,.123,dark,0,-.112,-.03),      // trigger guard
  bx(.097,.302,.117,0x323a3f,0,-.244,-.25,-.16), // long dark magazine
  bx(.102,.032,.123,dark,0,-.397,-.30),      // magazine base
  bx(.075,.245,.09,grip,0,-.219,-.74),      // vertical forward grip
  bx(.085,.027,.108,rail,0,-.361,-.74),     // foregrip cap
  bx(.061,.021,.110,highlight,.089,.024,.12), // side marking panel
  bx(.055,.038,.022,dark,.097,-.003,.032)   // fire selector
 );
 // Top carry handle: open center with side rails, raised rear arch and short struts.
 // Do not fill this open void with a solid box.
 a(
  bx(.024,.034,.72,shade,-.088,.222,-.26), // left carry-handle runner
  bx(.024,.034,.72,shade,.088,.222,-.26),  // right carry-handle runner
  bx(.184,.041,.12,high,0,.248,-.57),     // forward arch
  bx(.180,.047,.12,upper,0,.255,.045),    // rear arch
  bx(.025,.145,.065,shade,-.085,.189,-.57),
  bx(.025,.145,.065,shade,.085,.189,-.57),
  bx(.025,.125,.06,shade,-.082,.184,.044),
  bx(.025,.125,.06,shade,.082,.184,.044)
 );
 // Receiver side grooves and vent slots, identical to generic low-poly geometry.
 for(var i=0;i<6;i++){
  var z=-.95+i*.085;
  a(
   bx(.011,.024,.056,dark,-.087,.035,z),
   bx(.011,.024,.056,dark,.087,.035,z)
  );
 }
 for(var j=0;j<5;j++){
  var rib=-.91+j*.085;
  a(bx(.014,.011,.047,highlight,-.083,-.091,rib));
  a(bx(.014,.011,.047,highlight,.083,-.091,rib));
 }
 for(var k=0;k<4;k++)a(bx(.10,.009,.020,shade,0,-.215-k*.047,-.24-k*.012));
 // Compact round 3D optic between carry-handle rails. The optic is hidden
 // by the existing tactical ADS renderer during RMB so geometry cannot obstruct aim.
 var opticParts=[
  bx(.100,.030,.150,rail,0,.287,-.12),          // base
  bx(.076,.071,.070,dark,0,.334,-.12),         // mount neck
  cy(.079,.079,.23,shade,0,.402,-.12),         // cylindrical optic tube
  cy(.087,.087,.032,dark,0,.402,-.232),        // front eyepiece rim
  cy(.087,.087,.031,upper,0,.402,-.004),       // rear eyepiece rim
  bx(.029,.035,.067,shade,.073,.476,-.085),   // adjustment turret
  bx(.067,.031,.071,shade,0,.491,-.113),       // top adjustment housing
  bx(.012,.012,.012,0xff3838,0,.402,-.252)   // red point when hip-firing
 ];
 opticParts.forEach(function(item){a(item);});
 g.userData.opticParts=opticParts;
};
