// ---- SOUND & MUZZLE FLASH ----
// GS = synthesized gun sound presets {f frequency, v volume, d decay, t type}. SFXI maps weapon id -> preset index (AWP uses preset 4).
// No audio files: sounds are generated with WebAudio. SND = master sound switch.
// --- sound & muzzle flash ---
var GS=[{f:1800,v:.22,d:.09,t:180},{f:1400,v:.2,d:.1,t:140},{f:900,v:.45,d:.22,t:100},{f:500,v:.5,d:.4,t:70},{f:700,v:.8,d:.6,t:55},{f:720,v:.15,d:.073,t:92,suppressed:true}],SFXI=[0,1,2,3,3,3,1,1,4,1,1,1,1,5,1,1,1,4,2];
// gunSfx(): plays a synthesized gun/explosion sound from preset k at volume vol (does nothing if sound is off or too quiet).
function gunSfx(k,vol){if(!SND||vol<=.02)return;try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();if(AC.state==="suspended")AC.resume();
  if(!nbuf){nbuf=AC.createBuffer(1,Math.floor(AC.sampleRate*.25),AC.sampleRate);var dd=nbuf.getChannelData(0);for(var i=0;i<dd.length;i++)dd[i]=Math.random()*2-1;}
  var t=AC.currentTime,sr=AC.createBufferSource(),fl=AC.createBiquadFilter(),g=AC.createGain(),o=AC.createOscillator(),g2=AC.createGain(),v=vol*k.v;
  sr.buffer=nbuf;fl.type=k.suppressed?"lowpass":"bandpass";fl.frequency.value=k.f*(.9+Math.random()*.2);fl.Q.value=k.suppressed?.48:.7;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+k.d);sr.connect(fl);fl.connect(g);g.connect(AC.destination);sr.start(t);sr.stop(t+k.d+.02);
  o.type=k.suppressed?"triangle":"sine";o.frequency.setValueAtTime(k.t,t);o.frequency.exponentialRampToValueAtTime(40,t+k.d);g2.gain.setValueAtTime(v*(k.suppressed?.5:.9),t);g2.gain.exponentialRampToValueAtTime(.0001,t+k.d);o.connect(g2);g2.connect(AC.destination);o.start(t);o.stop(t+k.d+.02);}catch(e){}}
// enemyShotFx(): muzzle flash and sound for a bot shot (volume depends on distance to the player).
function enemyShotFx(o,x,y,z){var m=new T.Mesh(spG,mzfM);m.position.set(x,y,z);m.scale.setScalar(.14+Math.random()*.1);S.add(m);mzf.push({m:m,t:.05});
  if(sndN<3){sndN++;gunSfx(GS[SFXI[o.weapon]||1],.45*Math.max(0,1-Math.hypot(pl.x-o.x,pl.z-o.z)/20));}}
// gImpact(): bullet impact on the ground at point p (small decal + dust).
function gImpact(p){if(Math.abs(p.x)>A||Math.abs(p.z)>A)return;gDecal(TXH[(Math.random()*3)|0],p.x,p.z,.38*rr(.85,1.15));spark(p.x,.08,p.z,0xd9d0bb,3,1.6,.1);}
// Camera recoil per weapon id: CKV = pitch kick, CKS = shake strength, CKY = random yaw kick, CKR = random roll kick (camShot() applies them, reduced while aiming).
var CKV=WP.map(function(w){return w.stats.vRecoil===null?0:.12+.015*w.stats.vRecoil*w.recoilScale;}),
    CKY=WP.map(function(w){return w.stats.hRecoil===null?0:.005*w.stats.hRecoil*(1-w.stats.control/200)*Math.max(.45,w.recoilScale);}),
    CKR=CKY.map(function(y){return y*1.5;}),
    CKS=WP.map(function(w){return w.stats.vRecoil===null?0:Math.min(1.2,.25+.009*w.stats.vRecoil);});
// camShot(w): adds camera recoil for weapon w. Knife and grenade have none.
function camShot(w){if(w===4||w===5)return;var a=1-.45*adsT;cs.kv+=CKV[w]*a;if(cs.k>.12)cs.kv*=.3;cs.yv+=(Math.random()-.5)*CKY[w]*a;cs.rv+=(Math.random()-.5)*CKR[w]*a;cs.s=Math.max(cs.s,CKS[w]);}
// spr(): spring-damper step used for camera recoil recovery (value o[a], velocity o[b]).
function spr(o,a,b,dt){o[b]+=(-o[a]*150-o[b]*15)*dt;o[a]+=o[b]*dt;if(o[a]>.16)o[a]=.16;else if(o[a]<-.16)o[a]=-.16;}
// snz(): cheap smooth pseudo-noise in about [-1,1] for camera shake (t = time, k = channel seed).
function snz(t,k){return Math.sin(t*(31+k*7.3)+k*1.7)*.6+Math.sin(t*(53+k*3.1)+k*4.3)*.4;}
// ck = kill tracker {n kills this life, hs headshot kills this life}; death, not time, resets it. Other globals: dead = ragdoll list, shakeT = screen shake time, AC = AudioContext, grs = grenades.
var ck={n:0,hs:0},hsF=false,dead=[],inBoom=false,boomN=0,shakeT=0,AC=null,boomLab="RPG",grs=[];
function resetKillStreak(){ck.n=0;ck.hs=0;}
function registerPlayerKill(headshot){ck.n++;if(headshot)ck.hs++;}
// dmgE(): applies damage d to bot e (knock direction kx,kz). Handles invulnerability, hit flash and calls killE() at 0 HP.
function dmgE(e,d,kx,kz,ex,kind){if(e.inv>0||e.dead)return;if(isBombMode())bombInterruptPlant(e);d=defenseDamage(e,d,kind||"bullet-body");if(d>0)bloodHit(e.x,(e.y||0)+(kind==="head"?1.7:1.12),e.z,kx,kz,kind==="head");e.hp-=d;e.fl=.14;e.hs=Math.random()<.5?-1:1;e.hv=(e.hv||0)+Math.min(9,3+d*.5);var hm=Math.hypot(kx||0,kz||0);if(hm>.01){e.hdx=kx/hm;e.hdz=kz/hm;}if(e.hp<=0)killE(e,kx||0,kz||0,ex);}
// hlms = flying helmets (popped by headshots). popHelm()/popPl() pop a bot/player helmet; updH() animates them.
var hlms=[];
function popHelm(e,vx,vz){var h=e.hm;if(!h||!e.helm)return;e.helm=false;h.updateMatrixWorld(true);
  var wp=new T.Vector3(),q=new T.Quaternion();h.getWorldPosition(wp);h.getWorldQuaternion(q);
  e.body.remove(h);S.add(h);h.position.copy(wp);h.quaternion.copy(q);
  var m=Math.hypot(vx||0,vz||0)||1;
  hlms.push({m:h,vx:(vx||0)/m*3.2+(Math.random()-.5)*2,vy:5.5+Math.random()*2,vz:(vz||0)/m*3.2+(Math.random()-.5)*2,sx:(Math.random()-.5)*18,sz:(Math.random()-.5)*18,t:0,rest:false});
  spark(wp.x,wp.y,wp.z,0xffd54a,12,4.5,.09);spark(wp.x,wp.y,wp.z,0xcfd4da,6,3,.07);e.fl=.12;
  if(AC){tn(2600,1500,.1,"triangle",.1);tn(1700,800,.14,"square",.05,.03);}}
function updH(dt){for(var i=hlms.length-1;i>=0;i--){var h=hlms[i],m=h.m;h.t+=dt;
  if(!h.rest){h.vy-=16*dt;m.position.x=Math.max(-A,Math.min(A,m.position.x+h.vx*dt));m.position.z=Math.max(-A,Math.min(A,m.position.z+h.vz*dt));m.position.y+=h.vy*dt;m.rotation.x+=h.sx*dt;m.rotation.z+=h.sz*dt;
    if(m.position.y<=.16){m.position.y=.16;if(Math.abs(h.vy)>2.2){h.vy*=-.38;h.vx*=.6;h.vz*=.6;h.sx*=.5;h.sz*=.5;if(AC)tn(1200,700,.05,"triangle",.04);}else{h.rest=true;m.rotation.x=0;m.rotation.z=0;}}}
  else if(h.t>6){var u=(h.t-6)/.6;if(!h.fd){h.fd=1;m.traverse(function(o){if(o.material){o.material.transparent=true;}});}
    m.traverse(function(o){if(o.material)o.material.opacity=Math.max(0,1-u);});if(u>=1){S.remove(m);hlms.splice(i,1);}}}}
// setHm(): shows/hides the helmet icon in the HUD (pop = play the pop animation).
function setHm(pop){var e=document.getElementById("hmt");if(!e)return;e.className=pl.helm?"":"off";if(pop){e.classList.add("pop");setTimeout(function(){e.classList.remove("pop");},700);}}
function popPl(){pl.helm=false;if(pm.hm)pm.hm.visible=false;var f=document.getElementById("hmfly");f.classList.remove("go");void f.offsetWidth;f.classList.add("go");setHm(true);toast("HELMET POPPED!");shakeT=Math.max(shakeT,.25);if(AC){tn(2600,1500,.1,"triangle",.12);tn(1700,800,.14,"square",.06,.03);}}
// killE(): kills bot e: scoring, kill feed, ragdoll, gun drop, respawn timer. Credit goes to curK (the last damage dealer).
function killE(e,kx,kz,ex){
  var K=curK,pk=K===pl;kFeed(K,killW,hsF,e);if(e.mk)e.mk.visible=false;if(e.nm)e.nm.visible=false;
  en.splice(en.indexOf(e),1);e.dead=true;e.st.d++;if(!isBombMode())rq.push({b:e,t:5});bombDrop(e);if(K){K.st.k++;if(!isBombMode())ts[K.tm]++;}
  if(pk){score++;if(DM_RULES.crates)mkCrate(e.x,e.z,.45+gh(e.x,e.z,0),rci());starKill();}
  detachGun(e,kx,kz,ex);e.ms.forEach(function(m){m.emissive.setHex(0);});e.arms.forEach(function(q){q.rotation.set(0,0,0);q.scale.y=1;q.userData.fa.quaternion.set(0,0,0,1);});e.g.userData.gun.position.set(0,0,0);e.body.rotation.x=0;e.body.rotation.y=0;
  var m=Math.hypot(kx,kz);if(m<.01){kx=-Math.sin(e.g.rotation.y);kz=-Math.cos(e.g.rotation.y);m=1;}kx/=m;kz/=m;
  e.g.rotation.y=Math.atan2(-kx,-kz);
  dead.push({g:e.g,body:e.body,legs:e.legs,arms:e.arms,x:e.x,z:e.z,y:e.y||0,by:e.y||0,vx:kx*(ex?7:2.6),vz:kz*(ex?7:2.6),vy:ex?8:0,t:0,T:ex?.73:.55,flip:ex?1:0,w:0,land:false});
  spark(e.x,1.2,e.z,0xff6b6b,8,4,.1);
  if(pk){registerPlayerKill(hsF);
  if(inBoom)boomN++;else killNotify(false);}
}
// updDead(dt): animates ragdolls/corpses and respawns bots after their timer.
function updDead(dt){
  updH(dt);
  updG(dt);updDrops(dt);updCh(dt);
  for(var di=dead.length-1;di>=0;di--){var d=dead[di];d.t+=dt;
    var p=Math.min(1,d.t/d.T),s=p*p*(3-2*p),ang=-(Math.PI/2+d.flip*Math.PI*2)*s;
    if(!d.land){
      d.by=gh(d.x,d.z,0);d.y=d.by+(d.flip?Math.max(0,d.vy*d.t-11*d.t*d.t):0);
      var sl=d.flip?1:1-p;d.x+=d.vx*dt*sl;d.z+=d.vz*dt*sl;resolve(d,.4);
      if(p>=1){d.land=true;d.y=d.by;spark(d.x,.15,d.z,0xcfcfcf,d.flip?10:5,2.2,.12);}
    }else{
      var u=d.t-d.T;ang+=Math.exp(-u*7)*Math.abs(Math.sin(u*20))*.25;d.w+=dt;
      if(d.w>1.5){d.b=(d.b||0)+dt;d.g.visible=Math.floor(d.b*14)%2===0;
        if(d.b>.6){spark(d.x,.4,d.z,0xb0b4ba,10,2.5,.18);S.remove(d.g);dead.splice(di,1);continue;}}
    }
    d.g.position.set(d.x,d.y,d.z);
    d.body.rotation.set(ang,0,0);d.body.position.y=.3*Math.abs(Math.sin(ang));
    d.arms[0].rotation.z=-1.1*s;d.arms[1].rotation.z=1.1*s;
    d.legs[0].rotation.z=-.3*s;d.legs[1].rotation.z=.3*s;
  }
}
