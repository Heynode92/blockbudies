// K2: stable weapon ID 9 (rifle). Profile ratings and range modifier are weapon-local.
WEAPON_PROFILES[9]=Object.freeze({name:"K2",damage:36,rpm:96,control:75,speed:79,vRecoil:66,hRecoil:33,mag:40,res:200,range:120,kind:"rifle"});
WEAPON_RANGE_MODIFIERS[9]=0.98;
WEAPON_MODEL_BUILDERS[9]=function(g,a){
 {
    // K2: unscoped silver rifle with low-profile iron sights, black rail,
    // ventilated handguard, 40-round curved magazine and telescopic stock.
    // Keep the centerline clear when aiming; this rifle has no reflex optic.
    // The provided reference informs this dedicated low-poly mesh.
    a(
      bx(.105,.12,.48,0x969f9e,0,0,-.23),      // receiver
      bx(.109,.046,.43,0x5f6c6e,0,.076,-.23),  // upper rail mount
      bx(.11,.07,.38,0x536265,0,-.005,-.65),   // handguard
      bx(.118,.024,.37,0x242a2e,0,.077,-.66), // top accessory rail
      cy(.022,.022,.40,0x20272b,0,.005,-1.03),// long exposed barrel
      cy(.031,.031,.10,0x101719,0,.005,-1.27),// muzzle
      bx(.08,.045,.19,0x343b40,0,-.015,-1.01),// gas block
      bx(.012,.025,.03,0x303c40,-.038,.102,-.22), // low rear iron sight ear
      bx(.012,.025,.03,0x303c40,.038,.102,-.22),  // low rear iron sight ear
      bx(.012,.037,.024,0x303c40,0,.105,-.91),    // small front iron post
      bx(.07,.08,.12,0x30373b,0,-.17,-.19,.26), // grip
      bx(.082,.20,.10,0x1e2428,0,-.22,-.46,-.22),// curved magazine
      bx(.084,.045,.1,0x424d50,0,-.32,-.50,-.3), // magazine base
      bx(.025,.018,.08,0x1d2428,0,-.09,-.23), // trigger guard
      bx(.05,.05,.33,0x242b2f,0,-.003,.31),   // stock beam
      bx(.09,.125,.28,0x20272b,0,-.02,.48),  // adjustable rear stock
      bx(.11,.17,.035,0x111719,0,-.02,.67),  // rubber butt plate
      bx(.14,.018,.13,0xb2bdb6,0,.066,-.50) // handguard metal strap
    );
    for(var k2v=0;k2v<5;k2v++){
      a(bx(.016,.013,.034,0x171d20,.054,.058,-.82+k2v*.071));
      a(bx(.016,.013,.034,0x171d20,-.054,.058,-.82+k2v*.071));
    }
    for(var k2m=0;k2m<4;k2m++){
      a(bx(.087,.009,.014,0x707d72,0,-.16-k2m*.038,-.46-k2m*.008));
    }
  }
};
