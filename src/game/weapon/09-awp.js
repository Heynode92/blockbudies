// AWP: stable weapon ID 8 (sniper). Profile ratings and range modifier are weapon-local.
WEAPON_PROFILES[8]=Object.freeze({name:"AWP",damage:81,rpm:39,control:66,speed:69,vRecoil:60,hRecoil:60,mag:5,res:64,range:180,kind:"sniper"});
WEAPON_RANGE_MODIFIERS[8]=0.99;
WEAPON_MODEL_BUILDERS[8]=function(g,a){
 {var bh=bx(.1,.025,.03,0x888e98,.07,.03,-.08);g.userData.bolt=bh;a(bx(.09,.13,.6,0x3b4a2a,0,0,-.1),cy(.018,.018,1,0x1d2129,0,.025,-.95),cy(.03,.03,.16,0x2b2f3d,0,.025,-1.5),bx(.085,.17,.45,0x3b4a2a,0,-.02,.4),bx(.09,.06,.18,0x2b2f3d,0,.07,.18),cy(.04,.04,.34,0x111111,0,.13,-.2),cy(.05,.05,.07,0x111111,0,.13,-.4),cy(.045,.045,.06,0x111111,0,.13,.0),bx(.03,.05,.04,0x333333,0,.09,-.3),bx(.07,.2,.09,0x2b2f3d,0,-.15,-.05,.2),bx(.06,.14,.1,0x2b2f3d,0,-.12,-.3),bh);}
};
