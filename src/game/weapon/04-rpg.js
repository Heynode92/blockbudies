// RPG: stable weapon ID 3 (rocket). Profile ratings and range modifier are weapon-local.
WEAPON_PROFILES[3]=Object.freeze({name:"RPG",damage:85,rpm:35,control:25,speed:48,vRecoil:100,hRecoil:85,mag:1,res:6,range:65,kind:"rocket"});
WEAPON_RANGE_MODIFIERS[3]=null;
WEAPON_MODEL_BUILDERS[3]=function(g,a){
 a(cy(.1,.1,1.1,0x5c6b3c,0,.03,-.4),cy(.1,.17,.2,0x3b4a2a,0,.03,-1),cy(.09,0,.28,0xe03131,0,.03,-1.2),bx(.07,.16,.08,0x2b2f3d,0,-.12,-.2,.2),bx(.04,.06,.1,0x111111,0,.12,-.3));
};
