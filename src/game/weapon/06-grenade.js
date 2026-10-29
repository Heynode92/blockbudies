// Grenade: stable weapon ID 5 (grenade). Profile ratings and range modifier are weapon-local.
WEAPON_PROFILES[5]=Object.freeze({name:"Grenade",damage:40,rpm:null,control:null,speed:98,vRecoil:null,hRecoil:null,mag:2,res:2,range:null,kind:"grenade"});
WEAPON_RANGE_MODIFIERS[5]=null;
WEAPON_MODEL_BUILDERS[5]=function(g,a){
 a(bx(.15,.15,.15,0x4a5a2a,0,0,-.3),bx(.16,.03,.16,0x3a4620,0,.03,-.3),bx(.06,.05,.06,0x888e98,0,.1,-.3),bx(.04,.03,.14,0xaab0b9,0,.13,-.27),bx(.1,.02,.02,0xd4a017,.06,.1,-.36));
};
