// AK-47: stable weapon ID 1 (rifle). Profile ratings and range modifier are weapon-local.
WEAPON_PROFILES[1]=Object.freeze({name:"AK-47",damage:33,rpm:88,control:44,speed:74,vRecoil:69,hRecoil:62,mag:30,res:90,range:140,kind:"rifle"});
WEAPON_RANGE_MODIFIERS[1]=0.98;
WEAPON_MODEL_BUILDERS[1]=function(g,a){
 a(bx(.1,.12,.7,0x3b4252,0,0,-.35),cy(.025,.025,.5,0x1d2129,0,.02,-.9),bx(.12,.1,.3,0x6b4f3a,0,-.01,-.65),bx(.07,.22,.1,0x1d2129,0,-.17,-.4,.2),bx(.08,.14,.3,0x6b4f3a,0,-.02,.05),bx(.04,.05,.1,0x111111,0,.09,-.4),bx(.07,.16,.08,0x2b2f3d,0,-.13,-.15,.2));
};
