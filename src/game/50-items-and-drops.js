// Parachute system for airdrop crates: mkChute builds one, updChutes animates the fall, dropChute detaches it on landing.
var chutes=[],CHC=[0xf08c00,0x1c7ed6,0x7048e8,0xe03131];
function mkChute(ci){var g=new T.Group(),c1=new T.MeshLambertMaterial({color:CHC[ci]||0xf08c00}),c2=new T.MeshLambertMaterial({color:0xf8f9fa}),rp=new T.MeshLambertMaterial({color:0x343a40});
  [[3.6,.3,0],[3.0,.3,.3],[2.2,.3,.6],[1.2,.3,.9]].forEach(function(l){var w=l[0],sw=w/3;[[-1,c1],[0,c2],[1,c1]].forEach(function(q){var m=new T.Mesh(new T.BoxGeometry(sw,l[1],w),q[1]);m.position.set(q[0]*sw,l[2],0);m.castShadow=true;g.add(m);});});
  [[-1.6,-1.6,-.3,-.3],[1.6,-1.6,.3,-.3],[-1.6,1.6,-.3,.3],[1.6,1.6,.3,.3]].forEach(function(q){var a=new T.Vector3(q[0],-.15,q[1]),b=new T.Vector3(q[2],-2.5,q[3]),len=a.distanceTo(b),m=new T.Mesh(new T.BoxGeometry(.05,.05,len),rp);m.position.copy(a).add(b).multiplyScalar(.5);m.lookAt(b);g.add(m);});
  return g;}
function dropChute(c){var pc=c.pc;if(!pc)return;c.pc=null;c.m.remove(pc);pc.position.set(c.x,c.y+3.05,c.z);pc.rotation.set(0,c.m.rotation.y,0);S.add(pc);
  chutes.push({m:pc,t:0,y0:c.y+3.05,sx:pc.scale.x,sy:pc.scale.y,wx:(Math.random()-.5)*3,wz:(Math.random()-.5)*3,tw:(Math.random()-.5)*1.2});spark(c.x,.5,c.z,0xdee2e6,10,2.2,.1);}
function updChutes(dt){for(var ki=chutes.length-1;ki>=0;ki--){var h=chutes[ki],m=h.m,u,e,f;h.t+=dt;u=Math.min(1,h.t/1.8);e=u*u*(3-2*u);
  m.scale.set(h.sx*(1+.5*e),h.sy*(1-.82*e),h.sx*(1+.5*e));m.position.y=h.y0+(.25-h.y0)*e*e;m.position.x+=h.wx*dt*(1-u);m.position.z+=h.wz*dt*(1-u);m.rotation.z=h.tw*e;
  if(h.t>2.6){f=(h.t-2.6)/.8;if(!h.fd){h.fd=1;m.traverse(function(o){if(o.material)o.material.transparent=true;});}m.traverse(function(o){if(o.material)o.material.opacity=Math.max(0,1-f);});if(f>=1){S.remove(m);chutes.splice(ki,1);}}}}
// mkCrate(): spawns an airdrop crate (cr list) at (x,z) falling from height y with a parachute. ci = contents (0..2 weapon, 3 medkit).
function mkCrate(x,z,y,ci){
  var g=ci===3?mkMed():mkPick(ci);g.position.set(x,y,z);S.add(g);var c={m:g,x:x,z:z,y:y,vy:0,ci:ci,land:y<=.45+gh(x,z,0)+.001,age:0};
  if(!c.land){c.pc=mkChute(ci);c.pc.position.y=3.05;c.pc.scale.setScalar(.2);g.add(c.pc);}cr.push(c);
}
// dg = physics "drops": dropped guns and ejected shell casings (items with sp/life/cs fields). Updated by updDrops().
var dg=[];
// addDrop(): gives mesh m a velocity and puts it in the dg list so it falls, bounces and settles. h = rest height, keep = never expire, tz = lying rotation.
function addDrop(m,vx,vy,vz,h,keep,tz){m.rotation.order="YXZ";m.traverse(function(o){if(o.isMesh)o.castShadow=true;});
  dg.push({m:m,vx:vx,vy:vy,vz:vz,sp:(Math.random()<.5?-1:1)*(4+Math.random()*3),h:h,tz:tz,keep:keep,t:0,land:false,bn:0,life:7});}

// Shell casings. CSP = ejection port position per casing type (hold-local). Casing types: 0 pistol/SMG brass, 1 rifle brass, 2 shotgun hull.
// --- ejected shell casings (right side of weapon; shape matches the weapon) ---
var CSM={br:new T.MeshLambertMaterial({color:0xd9a93a}),bl:new T.MeshLambertMaterial({color:0xf0cf70}),rd:new T.MeshLambertMaterial({color:0xd6362b})},CSG={},CSR=[.024,.026,.037],
CSP=[[.05,.02,-.25],[.06,.03,-.35],[.06,.03,-.1]];
// csGeo(): cached cylinder geometry for casing parts.
function csGeo(a,b,l){var k=a+"_"+b+"_"+l;return CSG[k]||(CSG[k]=new T.CylinderGeometry(a,b,l,8));}
// mkCasing(w): builds a casing mesh. w = casing type 0/1/2 (NOT always the weapon id; Kriss uses 0, AWP uses 1).
function mkCasing(w){var g=new T.Group();function c(a,b,l,m,y){var q=new T.Mesh(csGeo(a,b,l),m);q.position.y=y;g.add(q);}
  if(w===0){c(.024,.024,.012,CSM.bl,-.034);c(.02,.02,.06,CSM.br,0);}                                   // pistol: short straight-wall 9mm brass
  else if(w===1){c(.026,.026,.012,CSM.bl,-.061);c(.024,.022,.08,CSM.br,-.012);c(.012,.022,.03,CSM.br,.043);} // rifle: long bottleneck brass
  else{c(.037,.037,.045,CSM.bl,-.05);c(.034,.034,.11,CSM.rd,.03);}                                      // shotgun: red plastic hull + brass base
  g.scale.setScalar(.5);return g;}
// ejectShell(w, side): throws a spent casing from the gun port. Supports weapons 0-2, Kriss (6), Dual Kriss (7) and AWP (8).
//  side = +1 throws to the player's RIGHT, -1 to the LEFT. Single guns always use +1. Dual Kriss uses -1 for the left gun (shotSide = 1).
//  The AWP casing is thrown from the bolt (called mid bolt-cycle from animHands(), not from the shot itself).
function ejectShell(w,side){var sm=(w===6||w===7);if(w>2&&!sm&&w!==8&&w!==WEAPON_STARTER_ID)return;side=side||1;var cw=sm?0:(w===8?1:w===WEAPON_STARTER_ID?1:w);
  var v=new T.Vector3(CSP[cw][0],CSP[cw][1],CSP[cw][2]);if(sm){v.x=side<0?-.52-CSP[0][0]:CSP[0][0];}if(w===8)v.set(.09,.06,-.08);hold.localToWorld(v);
  var k=Math.tan(35*Math.PI/180)/Math.tan(C.fov*Math.PI/360);v.x*=k;v.y*=k;C.localToWorld(v);
  var d=new T.Vector3((2.5+Math.random()*.4)*side,1.1+Math.random()*.25,.02+Math.random()*.06).applyQuaternion(C.quaternion);
  var m=mkCasing(cw);m.position.copy(v);m.rotation.set(0,0,Math.random()*6);S.add(m);
  addDrop(m,d.x,d.y,d.z,CSR[cw]*.5,false,Math.PI/2);
  var q=dg[dg.length-1];q.sp=8+Math.random()*3;q.life=1;q.cs=1;
  m.traverse(function(o){o.castShadow=false;});
  var n=0;for(var i=dg.length-1;i>=0;i--)if(dg[i].cs&&++n>20){S.remove(dg[i].m);dg.splice(i,1);}}
// GSC = size of a dropped gun model per weapon id, GH = rest height of a dropped gun per weapon id.
var GSC=[1.5,1.2,1.2,1,2,2,1.2,1,1.2,1.2],GH=[.07,.09,.09,.17,.03,.1,.09,.09,.09,.09];
// dropPlayerGun(): when the player dies, throws the current weapon model onto the ground.
function dropPlayerGun(){var w=pl.w,g=mkGun(w),f=pl.face,s=Math.sin(f),c=Math.cos(f);
  g.scale.setScalar(GSC[w]);g.rotation.order="YXZ";g.rotation.y=f+Math.PI;
  g.position.set(pl.x+.55*c+.4*s,1.05,pl.z-.55*s+.4*c);S.add(g);
  addDrop(g,s*1.8+c*.9,2.4,c*1.8-s*.9,GH[w],true,(w===4||w===5)?0:(w===3?.6:Math.PI/2));}
// detachGun(): when a bot dies, its gun flies off. kx/kz = knock direction, ex = exaggerated (explosion) throw.
function detachGun(e,kx,kz,ex){var rg=e.g.userData.rg;if(!rg)return;e.g.userData.rg=null;
  var gm=Math.hypot(kx||0,kz||0)||1,k=ex?5:1.6;rg.rotation.order="YXZ";S.attach(rg);
  addDrop(rg,(kx||0)/gm*k+(Math.random()-.5)*1.2,ex?5:2.2,(kz||0)/gm*k+(Math.random()-.5)*1.2,.09,false,Math.PI/2);}
// wrapA(): wraps an angle to the range [-PI, PI].
function wrapA(a){return((a+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;}
// updDrops(dt): physics step for dg (falling, bouncing, sliding, fading casings and guns).
function updDrops(dt){
  for(var i=dg.length-1;i>=0;i--){var d=dg[i],m=d.m;d.t+=dt;
    if(!d.land){
      d.vy-=16*dt;m.position.x+=d.vx*dt;m.position.z+=d.vz*dt;m.position.y+=d.vy*dt;resolve(m.position,.25);
      m.rotation.z+=d.sp*dt;m.rotation.x+=d.sp*.35*dt;
      var gy=gh(m.position.x,m.position.z,m.position.y)+d.h;
      if(m.position.y<=gy&&d.vy<0){m.position.y=gy;
        if(d.bn<1&&-d.vy>3){d.vy=-d.vy*.3;d.bn++;d.vx*=.5;d.vz*=.5;d.sp*=.5;if(!d.cs)spark(m.position.x,gy,m.position.z,0xcfcfcf,4,1.6,.08);}
        else{d.land=true;d.vx=d.vz=d.vy=0;if(d.tz===undefined)d.tz=Math.PI/2;if(d.tz!==0&&d.tz!==.6)d.tz=(Math.sin(m.rotation.z)>=0?1:-1)*d.tz;else if(d.tz===.6)d.tz=(Math.sin(m.rotation.z)>=0?1:-1)*.6;}}
    }else{
      var k=Math.min(1,dt*12);m.rotation.x+=wrapA(0-m.rotation.x)*k;m.rotation.z+=wrapA(d.tz-m.rotation.z)*k;
      if(!d.keep&&d.t>d.life){var b=d.t-d.life;m.visible=Math.floor(b*14)%2===0;if(b>.6){S.remove(m);dg.splice(i,1);}}
    }
  }
}
