// XM2010, stable ID 17. Tan modular bolt-action sniper from supplied reference.
// Uses original AWP bolt/scoping mechanics; no new gameplay or ammo system.
WEAPON_PROFILES[17]=Object.freeze({name:"XM2010",damage:82,rpm:0,control:86,speed:69,vRecoil:64,hRecoil:60,mag:5,res:30,range:200,kind:"sniper"});
WEAPON_RANGE_MODIFIERS[17]=DAMAGE_FALLOFF.defaultModifiers.sniper;
WEAPON_MODEL_BUILDERS[17]=function(g,a){
 var tan=0x8d724c,light=0xa68a60,brown=0x685339,dark=0x1a1e21,steel=0x3b4347,black=0x0e1215;
 a(bx(.15,.14,.72,tan,0,0,-.18),bx(.15,.06,.68,light,0,.09,-.2),
   bx(.17,.11,1.05,brown,0,.005,-.92),bx(.172,.029,1.06,light,0,.088,-.92),
   bx(.172,.028,1.0,dark,0,-.064,-.94),
   cy(.024,.024,.50,steel,0,0,-1.58),cy(.055,.055,.68,dark,0,0,-2.06),
   cy(.062,.062,.04,steel,0,0,-1.75),cy(.060,.060,.035,steel,0,0,-2.405),
   cy(.029,.029,.035,black,0,0,-2.43),
   bx(.105,.05,.15,tan,0,-.07,-.1),bx(.103,.19,.12,steel,0,-.19,-.17,-.08),
   bx(.107,.024,.12,black,0,-.29,-.2),bx(.075,.24,.095,dark,0,-.2,.13,-.25),
   bx(.08,.035,.13,steel,0,-.1,.06),bx(.082,.046,.43,steel,0,-.01,.42),
   bx(.042,.034,.46,brown,-.075,-.125,.66,.1),bx(.042,.034,.46,brown,.075,-.125,.66,.1),
   bx(.135,.09,.20,tan,0,.004,.77),bx(.15,.18,.06,black,0,-.06,.94),
   bx(.14,.13,.11,light,0,-.07,1.01),
   bx(.025,.25,.03,black,-.05,-.24,-1.23,-.1),
   bx(.025,.25,.03,black,.05,-.24,-1.23,.1),
   bx(.12,.028,.085,steel,0,-.365,-1.23),
   bx(.13,.028,.26,steel,0,.145,-.18),
   bx(.025,.095,.06,steel,-.055,.185,-.18),
   bx(.025,.095,.06,steel,.055,.185,-.18),
   cy(.053,.053,.62,black,0,.253,-.24),
   cy(.084,.084,.13,steel,0,.253,-.56),
   cy(.064,.064,.07,steel,0,.253,.08),
   cy(.045,.045,.075,steel,0,.328,-.24),
   cy(.031,.031,.057,steel,.07,.276,-.25)
 );
 for(var i=0;i<10;i++){var z=-1.36+i*.089;
   a(bx(.012,.024,.050,dark,-.087,.016,z),bx(.012,.024,.050,dark,.087,.016,z),
     bx(.012,.011,.039,light,-.085,.090,z),bx(.012,.011,.039,light,.085,.090,z));}
 // Bolt knob is parented to the bolt handle and moves with the original AWP animation.
 var handle=bx(.095,.025,.06,steel,.07,.03,-.08);
 handle.add(cy(.025,.025,.065,black,.06,.008,0));
 g.userData.bolt=handle;a(handle);
};
