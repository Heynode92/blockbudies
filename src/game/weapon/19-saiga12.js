// Saiga-12, stable ID 18: box-mag semi-auto shotgun with no pump between shots.
WEAPON_PROFILES[18]=Object.freeze({name:"Saiga-12",damage:100,rpm:53,control:0,speed:78,vRecoil:100,hRecoil:58,mag:6,res:30,range:70,kind:"shotgun"});
WEAPON_RANGE_MODIFIERS[18]=DAMAGE_FALLOFF.defaultModifiers.shotgun;
WEAPON_MODEL_BUILDERS[18]=function(g,a){
 var c=0x242a2f,s=0x343d42,r=0x495259,p=0x1b2227,b=0x0d1317;
 a(bx(.154,.172,.69,c,0,.006,-.18),bx(.160,.045,.61,s,0,.103,-.20),
 bx(.149,.119,.67,p,0,-.015,-.72),bx(.165,.028,.69,r,0,.078,-.74),
 bx(.166,.035,.55,s,0,-.080,-.72),cy(.038,.038,.53,b,0,-.008,-1.24),
 cy(.044,.044,.09,s,0,-.008,-1.50),bx(.105,.064,.20,s,0,-.080,-.14),
 bx(.102,.305,.134,0x2b3337,0,-.272,-.24,-.17),bx(.108,.026,.14,b,0,-.428,-.30),
 bx(.077,.245,.113,p,0,-.213,.12,-.30),bx(.077,.035,.15,b,0,-.123,.005),
 bx(.113,.113,.39,p,0,-.040,.46),bx(.157,.165,.40,c,0,-.032,.72),
 bx(.165,.205,.056,b,0,-.045,.96),bx(.028,.018,.10,r,.091,.016,-.02),
 bx(.033,.025,.084,s,-.090,.035,-.14),bx(.115,.028,.37,r,0,.139,-.20));
 for(var i=0;i<7;i++){var z=-.99+i*.087;a(bx(.01,.022,.038,b,-.08,.007,z),
 bx(.01,.022,.038,b,.08,.007,z),bx(.01,.012,.036,r,-.08,-.085,z),
 bx(.01,.012,.036,r,.08,-.085,z));}
 for(var j=0;j<5;j++)a(bx(.105,.008,.012,r,0,-.22-j*.04,-.25-j*.012));
 // Nine physical sight meshes hidden by tactical ADS to keep the aim clear.
 var opticParts=[bx(.09,.028,.17,s,0,.176,-.18),bx(.095,.034,.12,p,0,.228,-.18),
 bx(.016,.10,.027,b,-.067,.266,-.18),bx(.016,.10,.027,b,.067,.266,-.18),
 bx(.144,.025,.033,b,0,.327,-.18),bx(.03,.024,.11,r,0,.215,-.18),
 bx(.013,.018,.027,s,-.062,.331,-.18),bx(.013,.018,.027,s,.062,.331,-.18),
 bx(.01,.01,.009,0xff4242,0,.275,-.20)];
 opticParts.forEach(function(m){a(m);});g.userData.opticParts=opticParts;
};
