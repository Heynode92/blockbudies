// AK SOPMOD: stable weapon ID 12 (rifle). Profile ratings and range modifier are weapon-local.
WEAPON_PROFILES[12]=Object.freeze({name:"AK SOPMOD",damage:33,rpm:90,control:50,speed:74,vRecoil:64,hRecoil:60,mag:30,res:150,range:160,kind:"rifle"});
WEAPON_RANGE_MODIFIERS[12]=0.97;
WEAPON_MODEL_BUILDERS[12]=function(g,a){
 {
    // AK SOPMOD: black carbine body, curved magazine, tactical forward
    // rail + vertical grip, red-dot optic and folding stock. ak-sopmod.png.
    a(
      bx(.12,.146,.60,0x161b1f,0,0,-.25), // core receiver
      bx(.116,.055,.44,0x2e353a,0,.084,-.30), // upper receiver
      bx(.138,.1,.49,0x1d2427,0,.015,-.69), // long modular handguard
      bx(.145,.026,.59,0x343c41,0,.104,-.62), // full-length top rail
      cy(.023,.023,.43,0x22292d,0,.013,-1.13),
      cy(.032,.032,.085,0x515b5f,0,.013,-1.36), // muzzle device
      bx(.080,.28,.095,0x141a1d,0,-.185,-.13,-.25), // grip
      bx(.090,.28,.105,0x23282b,0,-.219,-.41,-.28), // curved magazine
      bx(.095,.040,.09,0x4b5558,0,-.350,-.49,-.25),
      bx(.064,.22,.10,0x181d1f,0,-.202,-.78), // vertical foregrip
      bx(.040,.018,.25,0x555d63,0,.024,.27), // stock tube
      bx(.115,.112,.27,0x1e2529,0,-.032,.46), // adjustable stock
      bx(.130,.17,.031,0x151a1d,0,-.034,.65), // buttstock
      bx(.055,.065,.13,0x31383a,0,-.018,-.38), // receiver controls
      bx(.070,.023,.13,0x5d6260,0,-.02,-.16) // ejection cover
    );
    // Optic frame (base, roof, posts, top bar). Hidden while the 2D tactical sight overlay is active, otherwise the
    // dark frame sits in the line of sight and covers the dot (see src/game/76-tactical-optics.js).
    var opticParts=[
      bx(.08,.027,.21,0x59666a,0,.149,-.26),
      bx(.065,.02,.125,0x161c20,0,.210,-.26), // optic roof
      bx(.014,.09,.015,0x151b1e,-.043,.183,-.27),
      bx(.014,.09,.015,0x151b1e,.043,.183,-.27),
      bx(.080,.014,.015,0x303d42,0,.232,-.27)
    ];
    opticParts.forEach(function(m){a(m);});
    g.userData.opticParts=opticParts;
    for(var sr=0;sr<8;sr++){
      a(bx(.018,.019,.026,0x596468,-.076,.096,-.88+sr*.070));
      a(bx(.018,.019,.026,0x596468,.076,.096,-.88+sr*.070));
    }
    for(var sm=0;sm<5;sm++)a(bx(.093,.009,.016,0x7e8580,0,-.18-sm*.045,-.37-sm*.018));
  }
};
