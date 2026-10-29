// Handgun: stable weapon ID 0 (pistol). Profile ratings and range modifier are weapon-local.
WEAPON_PROFILES[0]=Object.freeze({name:"Handgun",damage:26,rpm:84,control:87,speed:93,vRecoil:61,hRecoil:61,mag:13,res:52,range:45,kind:"pistol"});
WEAPON_RANGE_MODIFIERS[0]=0.91;
WEAPON_MODEL_BUILDERS[0]=function(g,a){
 a(bx(.09,.1,.45,0x9aa1ad,0,0,-.3),bx(.07,.06,.3,0x2b2f3d,0,-.07,-.3),bx(.08,.22,.1,0x2b2f3d,0,-.15,-.12,.25),cy(.028,.028,.12,0x1d2129,0,.01,-.58));
};
