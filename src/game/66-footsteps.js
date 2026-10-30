// Surface-aware Web Audio tactical footsteps. No external sound files.
// Steps are driven by actual player / BOT displacement, not a repeating timer.
var FOOTSTEP_RULES=Object.freeze({radius:24,near:2.2,maxVoices:16,walkStride:2.05,sprintStride:1.78}),
 footstepBuffers=null,footstepVoices=0,footstepListenerDirection=new T.Vector3(),
 footstepTypes=["concrete","asphalt","indoor","metal","tile"];
function footstepSurface(x,y,z){
 if(isBombMode()){
  // 11-bomb-map.js sectors: SECURITY, WAREHOUSE, REACTOR, LABORATORY.
  var n=BOMB_RULES.cells,s=BOMB_RULES.cellSize,
   i=Math.max(0,Math.min(n-1,Math.round(x/s+(n-1)/2))),
   j=Math.max(0,Math.min(n-1,Math.round(z/s+(n-1)/2))),
   sector=(i<n/2?0:1)+(j<n/2?0:2);
  return ["tile","metal","concrete","indoor"][sector];
 }
 if(y>1.25)return "metal";
 if(inB(x,z))return "indoor";
 if(Math.abs(x)<4||Math.abs(z)<4)return "asphalt";
 return "concrete";
}
function footstepUnlock(){
 if(!SND)return;
 try{
  if(!AC)AC=new(window.AudioContext||window.webkitAudioContext)();
  if(AC.state==="suspended"){
   var p=AC.resume();if(p&&p.catch)p.catch(function(){});
  }
 }catch(e){} // Browser media activation policy is enforced by the platform.
}
document.addEventListener("pointerdown",footstepUnlock,{passive:true});
document.addEventListener("keydown",footstepUnlock);
function footstepGenerateBuffers(){
 if(!AC||footstepBuffers)return;
 footstepBuffers={};
 var sr=AC.sampleRate,profiles={
  concrete:{body:142,noise:.56,ring:.08,click:.46,decay:.105},
  asphalt:{body:95,noise:.72,ring:.02,click:.2,decay:.125},
  indoor:{body:155,noise:.38,ring:.24,click:.56,decay:.115},
  metal:{body:210,noise:.27,ring:.64,click:.46,decay:.165},
  tile:{body:167,noise:.36,ring:.3,click:.55,decay:.1}
 };
 footstepTypes.forEach(function(type){
  footstepBuffers[type]=[];
  for(var variant=0;variant<3;variant++){
   var p=profiles[type],length=Math.floor(.19*sr),
    buffer=AC.createBuffer(1,length,sr),data=buffer.getChannelData(0),
    seed=(type.length*104729+variant*8191+117)&0x7fffffff,prev=0,prev2=0,phase=variant*.7;
   for(var i=0;i<length;i++){
    var t=i/sr,envelope=Math.min(1,t/.004)*Math.exp(-t/p.decay),
     body=Math.sin(2*Math.PI*(p.body*(1-.23*t))*t+phase),
     ring=Math.sin(2*Math.PI*(type==="metal"?875:type==="indoor"?510:415)*t+phase);
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    var noise=seed/2147483648-1;
    prev+=(noise-prev)*.25;prev2+=(prev-prev2)*.11;
    var crack=(noise-prev)*p.click*Math.exp(-t/.031),
     scuff=(prev2*.75+prev*.25)*p.noise,
     sample=envelope*(body*.48+scuff+crack+ring*p.ring*Math.exp(-t/.12));
    data[i]=Math.max(-.94,Math.min(.94,sample*.65));
   }
   footstepBuffers[type].push(buffer);
  }
 });
}
function footstepSetPosition(node,x,y,z){
 if(node.positionX){node.positionX.value=x;node.positionY.value=y;node.positionZ.value=z;}
 else if(node.setPosition)node.setPosition(x,y,z);
}
function footstepUpdateListener(){
 if(!AC||AC.state!=="running"||!run||lob||mt.over)return;
 C.updateMatrixWorld();C.getWorldDirection(footstepListenerDirection);
 var dir=footstepListenerDirection,l=AC.listener,p=C.position;
 if(l.positionX){l.positionX.value=p.x;l.positionY.value=p.y;l.positionZ.value=p.z;}
 else if(l.setPosition)l.setPosition(p.x,p.y,p.z);
 if(l.forwardX){
  l.forwardX.value=dir.x;l.forwardY.value=dir.y;l.forwardZ.value=dir.z;
  l.upX.value=0;l.upY.value=1;l.upZ.value=0;
 }else if(l.setOrientation)l.setOrientation(dir.x,dir.y,dir.z,0,1,0);
}
function footstepPlay(actor,local,sprint){
 if(!SND||!AC||AC.state!=="running"||footstepVoices>=FOOTSTEP_RULES.maxVoices)return;
 var x=actor.x,y=actor.y||0,z=actor.z,cam=C.position,
     distance=local?0:Math.hypot(cam.x-x,cam.z-z);
 if(distance>FOOTSTEP_RULES.radius)return;
 try{
  footstepGenerateBuffers();
  var surface=footstepSurface(x,y,z),list=footstepBuffers[surface]||footstepBuffers.concrete,
   step=actor.stepIndex||0,src=AC.createBufferSource(),filter=AC.createBiquadFilter(),
   gain=AC.createGain(),panner=null,t=AC.currentTime;
  src.buffer=list[step%list.length];src.playbackRate.value=(sprint?1.07:1)*(.96+Math.random()*.07);
  filter.type="lowpass";
  // LOS muffling preserves awareness without letting walls transmit full volume.
  var blocked=!local&&typeof los==="function"&&!los(cam.x,cam.z,x,z);
  filter.frequency.value=blocked?920:surface==="metal"?4700:surface==="indoor"?3400:3000;
  var volume=(local?.18:.66)*(sprint?1.18:1)*(blocked?.52:1);
  gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(volume,t+.004);
  gain.gain.exponentialRampToValueAtTime(.0001,t+.18);
  src.connect(filter);filter.connect(gain);
  if(!local&&AC.createPanner){
   panner=AC.createPanner();panner.panningModel="HRTF";panner.distanceModel="inverse";
   panner.refDistance=FOOTSTEP_RULES.near;panner.maxDistance=FOOTSTEP_RULES.radius;
   panner.rolloffFactor=1.35;footstepSetPosition(panner,x,y+.18,z);
   gain.connect(panner);panner.connect(AC.destination);
  }else gain.connect(AC.destination);
  footstepVoices++;
  src.onended=function(){
   footstepVoices=Math.max(0,footstepVoices-1);
   src.disconnect();filter.disconnect();gain.disconnect();
   if(panner)panner.disconnect();
  };
  src.start(t);src.stop(t+.195);
 }catch(e){} // Audio failure must never interrupt movement or bot AI.
}
function footstepAdvance(actor,dist,grounded,sprint,local){
 if(!actor||actor.dead||!run||lob||mt.over||mt.cd>0||!grounded||!Number.isFinite(dist)||dist>2.6){
  if(actor)actor.stepTrail=0;
  return;
 }
 if(dist<.0005)return;
 var stride=sprint?FOOTSTEP_RULES.sprintStride:FOOTSTEP_RULES.walkStride;
 actor.stepTrail=(actor.stepTrail||0)+dist;
 if(actor.stepTrail>=stride){
  actor.stepTrail-=stride;
  actor.stepIndex=(actor.stepIndex||0)+1;
  if(typeof botSoundEmit==='function')botSoundEmit(actor,'footstep');
  footstepPlay(actor,local,sprint);
 }
}
