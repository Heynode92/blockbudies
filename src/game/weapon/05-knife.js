// Knife: stable weapon ID 4 (knife). Profile ratings and range modifier are weapon-local.
WEAPON_PROFILES[4]=Object.freeze({name:"Knife",damage:60,rpm:null,control:100,speed:98,vRecoil:null,hRecoil:null,mag:1,res:Infinity,range:1,kind:"knife"});
WEAPON_RANGE_MODIFIERS[4]=null;
WEAPON_MODEL_BUILDERS[4]=function(g,a){
 {var ks=new T.Shape();ks.moveTo(0,-.045);ks.lineTo(.3,-.045);ks.lineTo(.44,-.02);ks.lineTo(.34,.035);ks.lineTo(.2,.047);ks.lineTo(0,.047);ks.closePath();
    var kg=new T.ExtrudeGeometry(ks,{depth:.016,bevelEnabled:false});kg.translate(0,0,-.008);kg.rotateX(-Math.PI/2);kg.rotateY(Math.PI/2);
    var kb=new T.Mesh(kg,new T.MeshLambertMaterial({color:0xdfe6ee}));kb.position.set(0,0,-.22);kb.castShadow=true;
    var pv2=new T.Group();pv2.add(kb,bx(.016,.006,.26,0x8f9aa8,0,.011,-.36),bx(.15,.03,.035,0x7a828f,0,0,-.215),bx(.05,.06,.2,0x2b2f3d,0,0,-.1),bx(.056,.064,.02,0x555c68,0,0,-.06),bx(.056,.064,.02,0x555c68,0,0,-.11),bx(.056,.064,.02,0x555c68,0,0,-.16),bx(.065,.07,.035,0x7a828f,0,0,.01));
    pv2.rotation.set(.55,0,.3);g.add(pv2);}
};
