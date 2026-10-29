// P90: stable weapon ID 11 (smg). Profile ratings and range modifier are weapon-local.
WEAPON_PROFILES[11]=Object.freeze({name:"P90",damage:24,rpm:92,control:54,speed:88,vRecoil:45,hRecoil:48,mag:50,res:200,range:65,kind:"smg"});
WEAPON_RANGE_MODIFIERS[11]=0.86;
WEAPON_MODEL_BUILDERS[11]=function(g,a){
 {
    // P90: distinctive bullpup thumb-hole stock, broad olive-grey shell,
    // horizontal top magazine and integrated optic. Reference: p90.png.
    var body=bx(.16,.205,.78,0x777b70,0,-.012,-.10);a(body);
    a(
      bx(.17,.08,.31,0x333a3b,0,.119,-.22), // receiver optic housing
      bx(.175,.057,.62,0x535d5a,0,.139,-.19), // top-mounted magazine
      bx(.166,.016,.53,0x1a2123,0,.181,-.23), // rail top
      bx(.20,.076,.25,0x666d65,0,-.002,-.60), // front barrel housing
      cy(.031,.031,.29,0x1c2427,0,.025,-.79),
      cy(.040,.040,.06,0x32383b,0,.025,-.98),
      bx(.165,.235,.39,0x7b7d71,0,-.045,.39), // long rear buttstock
      bx(.19,.265,.075,0x6d7169,0,-.056,.60),
      bx(.14,.039,.28,0x1c2628,0,-.146,.26), // grip undercut bridge
      bx(.080,.19,.08,0x4a4e45,0,-.20,-.10,-.20), // forward handle
      bx(.078,.13,.11,0x51554e,0,-.23,-.29,.15),
      bx(.11,.04,.21,0x454c48,0,.204,-.16), // optic bracket
      bx(.055,.045,.21,0x182224,0,.253,-.16),
      bx(.074,.018,.06,0x8f9996,0,.289,-.22),
      bx(.035,.028,.04,0x111a1d,0,.245,-.34)
    );
    // Cutout is visual rather than actual CSG; dark inset and perimeter
    // reproduces the P90's iconic large thumb-hole grip in low-poly style.
    a(bx(.172,.118,.23,0x131a1d,0,-.184,.25));
    a(bx(.164,.024,.26,0x8b8d80,0,-.120,.24));
    a(bx(.164,.023,.27,0x777b70,0,-.241,.25));
    for(var ps=0;ps<5;ps++)a(bx(.173,.011,.015,0x353d40,0,.173,-.43+ps*.095));
  }
};
