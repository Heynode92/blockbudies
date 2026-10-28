// mkHelm(): builds a helmet mesh group (can fly off when a headshot pops it, see popHelm()).
function mkHelm(col,ms){var h=new T.Group();
  function b(w,hh,d,c,x,y,z){var m=new T.Mesh(new T.BoxGeometry(w,hh,d),new T.MeshLambertMaterial({color:c}));m.position.set(x,y,z);m.castShadow=true;h.add(m);if(ms)ms.push(m.material);return m;}
  b(.74,.3,.74,col,0,0,0);b(.78,.07,.78,0x1d2024,0,-.14,0);b(.5,.05,.16,0x1d2024,0,-.1,.42);b(.18,.06,.56,0x1d2024,0,.17,0);b(.06,.12,.06,0xffd54a,0,.05,.38);
  h.position.set(0,1.92,0);return h;}
// buddy(): builds the blocky Police character model (arms, legs, head, gun) in the given color.
function buddy(col){
  var g=new T.Group(),ms=[],legs=[],arms=[],body=new T.Group();g.add(body);
  function p(w,h,d,c,x,y,z,par){var m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshLambertMaterial({color:c}));m.position.set(x,y,z);m.castShadow=true;(par||body).add(m);ms.push(m.material);return m;}
  function pv(x,y){var q=new T.Group();q.position.set(x,y,0);body.add(q);return q;}
  p(.8,.8,.5,col,0,.95,0);p(.6,.6,.6,0xffd9a0,0,1.65,0);p(.12,.12,.05,0x222,-.15,1.7,.31);p(.12,.12,.05,0x222,.15,1.7,.31);var hg=p(.22,.22,.8,0x2b2f3d,.55,1,.4);
  [-.2,.2].forEach(function(x){var q=pv(x,.55);p(.3,.55,.35,0x333a4d,0,-.275,0,q);legs.push(q);});
  [-.55,.55].forEach(function(x){var q=pv(x,1.3);p(.3,.7,.3,col,0,-.3,0,q);arms.push(q);});
  var hm=mkHelm(0x1864ab,ms);body.add(hm);S.add(g);return{g:g,body:body,ms:ms,legs:legs,arms:arms,fl:0,hg:hg,hm:hm};
}
// terro(tm): builds a character model for either team (despite the name). tm 0 = Police look, tm 1 = Terrorist look.
// Returns an object with the mesh group `g` plus references used by animation (arms, legs, body, helmet `hm`, gun `rg`).
// Used for bots (newBot) and for the visible player body pm (mkPm).
function terro(tm){var K=tm?{s:0x4b5320,v:0x23272b,hd:0x15161a,sl:0xffd9a0,hb:0xc92a2a,pt:0x5a5a3a,hm:0x3b4a2a}:{s:0x1c4a8a,v:0x142a52,hd:0xffd9a0,sl:0x1d2024,hb:0x1864ab,pt:0x1d2c4a,hm:0x1c3d7a};
  var g=new T.Group(),ms=[],legs=[],arms=[],body=new T.Group();g.add(body);
  function p(w,h,d,c,x,y,z,par){var m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshLambertMaterial({color:c}));m.position.set(x,y,z);m.castShadow=true;(par||body).add(m);ms.push(m.material);return m;}
  function pv(x,y){var q=new T.Group();q.position.set(x,y,0);body.add(q);return q;}
  // body: olive green shirt + black tactical vest
  p(.8,.8,.5,K.s,0,.95,0);p(.86,.62,.56,K.v,0,1,0);
  p(.12,.1,.56,K.v,-.25,1.38,0);p(.12,.1,.56,K.v,.25,1.38,0);
  [-.27,0,.27].forEach(function(x){p(.2,.2,.1,0x3a3f35,x,.8,.3);});
  p(.84,.1,.54,0x111111,0,.58,0);p(.16,.2,.12,0x3a3f35,.5,.5,0);
  // head: black balaclava, eye slit, red headband
  p(.6,.6,.6,K.hd,0,1.65,0);p(.5,.14,.05,K.sl,0,1.7,.31);
  p(.1,.08,.05,0x222222,-.13,1.7,.34);p(.1,.08,.05,0x222222,.13,1.7,.34);
  p(.64,.1,.64,K.hb,0,1.88,0);p(.1,.22,.05,K.hb,.22,1.78,-.33);
  // rifle
  var gun=new T.Group();body.add(gun);g.userData.gun=gun;var rg=mkGun(1);rg.rotation.y=Math.PI;rg.scale.setScalar(1.2);rg.position.set(.2,1.05,-.16);gun.add(rg);g.userData.rg=rg;rg.traverse(function(m){if(m.material)ms.push(m.material);});
  [-.2,.2].forEach(function(x){var q=pv(x,.55);p(.3,.55,.35,K.pt,0,-.275,0,q);p(.32,.18,.4,0x1a1a1a,0,-.46,.03,q);legs.push(q);});
  [-.55,.55].forEach(function(x){var q=pv(x,1.3);p(.3,.4,.3,K.s,0,-.2,0,q);var fa=new T.Group();fa.position.set(0,-.4,0);q.add(fa);p(.28,.44,.28,K.s,0,-.22,0,fa);p(.31,.16,.31,0x1a1a1a,0,-.46,0,fa);q.userData.fa=fa;arms.push(q);});
  var hm=mkHelm(K.hm,ms);body.add(hm);S.add(g);return{g:g,body:body,ms:ms,legs:legs,arms:arms,fl:0,hm:hm,helm:true};
}
// Scratch vectors/quaternions reused by the bot arm IK code (aimA) to avoid allocating every frame.
var QD=new T.Vector3(0,-1,0),qa=new T.Quaternion(),qb=new T.Quaternion(),va=new T.Vector3(),vb=new T.Vector3(),vp=new T.Vector3();
// aimA(): 2-bone arm IK. Bends an arm (upper arm + forearm, lengths L1/L2) so the hand reaches target (tx,ty,tz) from shoulder (px,py).
function aimA(q,px,py,tx,ty,tz,sd){var L1=.4,L2=.46;va.set(tx-px,ty-py,tz);var d=Math.max(.2,Math.min(L1+L2-.01,va.length()));va.normalize();
  var cA=(L1*L1+d*d-L2*L2)/(2*L1*d),sA=Math.sqrt(Math.max(0,1-cA*cA));
  vp.set(sd*.7,-1,-.1);vp.addScaledVector(va,-vp.dot(va)).normalize();
  vb.copy(va).multiplyScalar(cA).addScaledVector(vp,sA);qa.setFromUnitVectors(QD,vb);q.quaternion.copy(qa);q.scale.y=1;
  var ex=px+vb.x*L1,ey=py+vb.y*L1,ez=vb.z*L1;vp.set(tx-ex,ty-ey,tz-ez).normalize();qb.setFromUnitVectors(QD,vp);
  q.userData.fa.quaternion.copy(qa).invert().multiply(qb);}
// aimArms(): positions both arms of bot e so the right hand holds its gun and the left hand supports it (or raises when celebrating).
function aimArms(e){var r=e.rc||0,ce=0,ph=tt*7+e.ph,gx0=Math.sin(tt*1.1+e.ph)*.015,gy0=.05*r+Math.sin(tt*1.7+e.ph)*.012,gx=gx0+ce*(.3+Math.sin(ph*.5)*.05),gy=gy0+ce*(.9+Math.abs(Math.sin(ph))*.1),gz=-.14*r;e.g.userData.gun.position.set(-.15+gx,gy,-.1+gz);aimA(e.arms[1],.55,1.3,.05+gx,.85+gy,.24+gz,1);aimA(e.arms[0],-.55,1.3,(.05+gx0)*(1-ce)-.6*ce,(.98+gy0)*(1-ce)+(2.25+Math.abs(Math.sin(ph+1))*.15)*ce,(.5+gz)*(1-ce)+.05*ce,-1);}
// flash(): hit-flash/knockback wobble of a bot after it takes damage (e.fl timer, e.hv/e.hx wobble).
function flash(e,dt){e.fl=Math.max(0,e.fl-dt);if(e.tm===undefined)return;e.hv=e.hv||0;e.hx=e.hx||0;e.hv+=(-e.hx*170-e.hv*13)*dt;e.hx+=e.hv*dt;var h=Math.max(-.5,Math.min(.9,e.hx));e.body.rotation.x-=h*.75;e.body.rotation.y+=h*(e.hs||1)*.35;e.body.position.y-=Math.abs(h)*.06;e.g.position.x+=(e.hdx||0)*h*.3;e.g.position.z+=(e.hdz||0)*h*.3;}
