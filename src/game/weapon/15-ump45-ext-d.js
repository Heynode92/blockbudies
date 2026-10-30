// UMP45 Ext D: stable weapon ID 14 (SMG). Keep every pre-existing ID unchanged.
// Low-poly Three.js interpretation of the user-supplied black UMP silhouette:
// elongated receiver, short barrel, angled 33-round magazine, vertical front
// grip, selector detail, slotted handguard, open iron sights, skeletal fold stock.
WEAPON_PROFILES[14]=Object.freeze({
 name:"UMP45 Ext D",damage:25,rpm:90,control:47,speed:87,
 vRecoil:48,hRecoil:48,mag:33,res:260,range:50,kind:"smg"
});
// Reuse the canonical SMG damage falloff and tuning, not a parallel damage system.
WEAPON_RANGE_MODIFIERS[14]=DAMAGE_FALLOFF.defaultModifiers.smg;
WEAPON_MODEL_BUILDERS[14]=function(g,a){
 var receiver=0x20262b,metal=0x30383e,polymer=0x151a1e,edge=0x4a555a,dark=0x0d1114;
 a(
  bx(.142,.172,.71,receiver,0,.01,-.21),       // long UMP upper receiver
  bx(.147,.055,.68,metal,0,.113,-.21),         // top receiver cover
  bx(.150,.023,.61,dark,0,.146,-.24),          // integrated accessory rail
  bx(.145,.127,.27,polymer,0,-.023,-.65),      // front handguard
  cy(.025,.025,.25,dark,0,.005,-.85),          // exposed short barrel
  cy(.039,.039,.060,metal,0,.005,-.995),       // unsuppressed muzzle device
  bx(.065,.018,.14,edge,0,.02,-.43),          // stamped ejection cover
  bx(.071,.035,.11,dark,0,-.112,-.14),         // trigger guard
  bx(.084,.260,.102,polymer,0,-.195,.013,-.24), // pistol grip
  bx(.087,.34,.095,metal,0,-.276,-.34,-.24),  // extended curved magazine
  bx(.089,.029,.104,dark,0,-.438,-.41),        // magazine base
  bx(.072,.220,.093,polymer,0,-.199,-.72),    // angled front vertical grip
  bx(.08,.033,.11,edge,0,-.318,-.73),          // front grip end cap
  bx(.060,.043,.16,metal,0,-.003,.22),         // stock hinge
  bx(.130,.052,.11,polymer,0,-.01,.29),       // fold-joint housing
  bx(.030,.032,.57,metal,-.087,-.050,.60,-.13), // left rear stock rail
  bx(.030,.032,.57,metal,.087,-.050,.60,-.13),  // right rear stock rail
  bx(.032,.030,.44,edge,-.081,-.143,.66,.22),  // angled stock bracing
  bx(.032,.030,.44,edge,.081,-.143,.66,.22),
  bx(.143,.215,.051,polymer,0,-.125,.93),      // open folding buttplate
  bx(.095,.040,.06,metal,0,.072,.27),         // stock catch
  bx(.018,.040,.045,edge,-.103,.028,-.39)      // charging handle
 );
 // Iron sights stay low and open; right-click ADS does not introduce an optic overlay.
 a(
  bx(.012,.028,.025,metal,-.041,.169,.075),
  bx(.012,.028,.025,metal,.041,.169,.075),
  bx(.014,.038,.021,edge,0,.165,-.78)
 );
 // Angled rail cuts, receiver markings and magazine ribs remain actual mesh detail.
 for(var i=0;i<6;i++){
  var z=-.77+i*.068;
  a(bx(.013,.024,.027,edge,-.077,.017,z));
  a(bx(.013,.024,.027,edge,.077,.017,z));
 }
 for(var j=0;j<5;j++)
  a(bx(.090,.009,.013,edge,0,-.20-j*.038,-.32-j*.013));
 a(bx(.019,.014,.075,0x8d352a,.075,-.025,.02)); // muted fire-selector mark
};
