// MP7: stable weapon ID 10 (smg). Profile ratings and range modifier are weapon-local.
WEAPON_PROFILES[10]=Object.freeze({name:"MP7",damage:21,rpm:93,control:60,speed:88,vRecoil:45,hRecoil:54,mag:30,res:200,range:60,kind:"smg"});
WEAPON_RANGE_MODIFIERS[10]=0.85;
WEAPON_MODEL_BUILDERS[10]=function(g,a){
 {
    // MP7: compact black receiver, foregrip, curved 30-round magazine,
    // collapsing wire stock and rail optic. Reference: supplied mp7.png.
    a(
      bx(.105,.15,.69,0x222829,0,0,-.24),bx(.110,.075,.62,0x111719,0,.086,-.23),
      bx(.116,.025,.58,0x3b4243,0,.127,-.26), // Picatinny top rail
      bx(.101,.115,.20,0x303739,0,-.012,-.67), // forward barrel shroud
      cy(.023,.023,.24,0x121618,0,.018,-.86),cy(.031,.031,.055,0x444e50,0,.018,-1.015),
      bx(.062,.2,.10,0x1b2023,0,-.21,-.48,.07), // vertical front grip
      bx(.073,.24,.105,0x171b1d,0,-.19,-.08,-.22), // pistol grip
      bx(.075,.22,.087,0x252a2d,0,-.22,-.33,-.16), // detachable magazine
      bx(.08,.035,.06,0x475053,0,-.36,-.40),
      bx(.026,.028,.47,0x181e21,0,.014,.34), // folding stock beam
      bx(.10,.23,.028,0x191f21,0,-.025,.61), // buttpad
      bx(.065,.025,.10,0x495457,0,-.036,-.05), // ejection panel
      bx(.12,.033,.08,0x111517,0,-.07,-.42)  // trigger guard
    );
    // Hide the physical MP7 optic frame during ADS: the tactical overlay supplies the reticle.
    // The receiver and Picatinny rail remain visible; only the five sight pieces disappear.
    var opticParts=[
      bx(.07,.014,.18,0x596062,0,.145,-.24), // optic rail base
      bx(.055,.015,.16,0x101819,0,.203,-.27), // holo upper
      bx(.013,.084,.018,0x0d1517,-.045,.174,-.28),
      bx(.013,.084,.018,0x0d1517,.045,.174,-.28),
      bx(.080,.016,.016,0x0c1418,0,.220,-.28)
    ];
    opticParts.forEach(function(m){a(m);});
    g.userData.opticParts=opticParts;
    for(var mp=0;mp<6;mp++){
      a(bx(.014,.013,.035,0x495054,-.059,.123,-.50+mp*.075));
      a(bx(.014,.013,.035,0x495054,.059,.123,-.50+mp*.075));
    }
    for(var mr=0;mr<4;mr++){
      a(bx(.083,.010,.013,0x626b6e,0,-.18-mr*.045,-.31-mr*.013));
    }
  }
};
