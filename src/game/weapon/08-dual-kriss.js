// Dual Kriss: stable weapon ID 7 (dual). Profile ratings and range modifier are weapon-local.
WEAPON_PROFILES[7]=Object.freeze({name:"Dual Kriss",damage:18,rpm:93,control:59,speed:90,vRecoil:48,hRecoil:48,mag:125,res:0,range:60,kind:"dual"});
WEAPON_RANGE_MODIFIERS[7]=0.83;
WEAPON_MODEL_BUILDERS[7]=function(g,a){
 {var kr=mkGun(6),kl=mkGun(6);kl.position.x=-.52;a(kr,kl);}
};
