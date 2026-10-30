// Shotgun: stable weapon ID 2 (shotgun). Profile ratings and range modifier are weapon-local.
WEAPON_PROFILES[2]=Object.freeze({name:"Shotgun",damage:168,rpm:48,control:58,speed:79,vRecoil:100,hRecoil:78,mag:6,res:30,range:70,kind:"shotgun",pump:true});
WEAPON_RANGE_MODIFIERS[2]=0.7;
WEAPON_MODEL_BUILDERS[2]=function(g,a){
 var slide=bx(.1,.08,.22,0x8a5a2b,0,-.04,-.6);g.userData.pumpSlide=slide;
 a(cy(.035,.035,.9,0x4a4f5a,0,.03,-.55),cy(.03,.03,.7,0x333b48,0,-.03,-.5),slide,bx(.1,.12,.35,0x3b4252,0,0,-.1),bx(.08,.14,.4,0x8a5a2b,0,-.03,.2));
};
