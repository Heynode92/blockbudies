// Home menu showcase: local gameplay videos, separate from the Three.js map render.
// Only the HOME panel owns playback; inventory, room lobby and matches stay unaffected.
var HOME_DEMOS=Object.freeze({
 deathmatch:Object.freeze({src:"./src/assets/video/deatch_match_demo.mp4",label:"DEATHMATCH",detail:"5V5 · ALL-OUT COMBAT",number:"01"}),
 bomb:Object.freeze({src:"./src/assets/video/bomb_mission_demo.mp4",label:"BOMB MISSION",detail:"TACTICAL · PLANT & DEFUSE",number:"02"})
});
var homeDemoKey="deathmatch",homeDemoHasError=false;
var homeDemoVideo=document.getElementById("homeDemoVideo"),
    homeDemoStatus=document.getElementById("homeDemoStatus"),
    homeDemoLabel=document.getElementById("homeDemoLabel"),
    homeDemoDetail=document.getElementById("homeDemoDetail"),
    homeDemoCounter=document.getElementById("homeDemoCounter"),
    homeDemoAudio=document.getElementById("homeDemoAudio"),
    homeDemoPlay=document.getElementById("homeDemoPlay"),
    homeDemoEmpty=document.getElementById("homeDemoEmpty");
function homeDemoVisible(){
 return !document.hidden&&!run&&!!lob&&
   document.getElementById("lbs").classList.contains("on");
}
function homeDemoSetStatus(message){homeDemoStatus.textContent=message;}
function homeDemoAudioState(){
 homeDemoAudio.textContent=homeDemoVideo.muted?"SOUND OFF":"SOUND ON";
 homeDemoAudio.setAttribute("aria-pressed",String(!homeDemoVideo.muted));
}
function homeDemoPlayState(){
 homeDemoPlay.textContent=homeDemoVideo.paused?"▶ PLAY":"Ⅱ PAUSE";
 homeDemoPlay.setAttribute("aria-label",homeDemoVideo.paused?"Play gameplay preview":"Pause gameplay preview");
}
function homeDemoAttemptPlay(){
 if(!homeDemoVisible()||homeDemoHasError)return;
 // Autoplay on local file:// requires muted playback in modern browsers.
 var attempt=homeDemoVideo.play();
 if(attempt&&typeof attempt.catch==="function")attempt.catch(function(){
   if(homeDemoVisible()&&!homeDemoHasError)homeDemoSetStatus("PRESS PLAY FOR PREVIEW");
   homeDemoPlayState();
 });
 homeDemoPlayState();
}
function homeDemoSelect(value){
 if(!Object.prototype.hasOwnProperty.call(HOME_DEMOS,value))return;
 var demo=HOME_DEMOS[value],changed=homeDemoKey!==value||
   homeDemoVideo.getAttribute("src")!==demo.src;
 homeDemoKey=value;homeDemoHasError=false;
 homeDemoLabel.textContent=demo.label;homeDemoDetail.textContent=demo.detail;
 homeDemoCounter.textContent=demo.number+" / 02";
 homeDemoEmpty.hidden=true;
 document.querySelectorAll("[data-home-demo]").forEach(function(button){
   var active=button.getAttribute("data-home-demo")===value;
   button.classList.toggle("active",active);
   button.setAttribute("aria-pressed",String(active));
 });
 if(changed){
   homeDemoVideo.pause();
   homeDemoVideo.setAttribute("src",demo.src);homeDemoVideo.load();
 }
 homeDemoSetStatus("GAMEPLAY FOOTAGE");
 homeDemoAttemptPlay();
}
function homeShowcaseSync(){
 if(!homeDemoVideo)return;
 if(homeDemoVisible())homeDemoAttemptPlay();
 else homeDemoVideo.pause();
 homeDemoPlayState();
}
document.querySelectorAll("[data-home-demo]").forEach(function(button){
 button.addEventListener("click",function(){homeDemoSelect(button.getAttribute("data-home-demo"));});
});
homeDemoAudio.addEventListener("click",function(){
 homeDemoVideo.muted=!homeDemoVideo.muted;
 homeDemoAudioState();
 if(!homeDemoVideo.paused&&homeDemoVisible())homeDemoSetStatus("GAMEPLAY FOOTAGE");
});
homeDemoPlay.addEventListener("click",function(){
 if(!homeDemoVisible())return;
 if(homeDemoVideo.paused)homeDemoAttemptPlay();
 else homeDemoVideo.pause();
 homeDemoPlayState();
});
homeDemoVideo.addEventListener("playing",function(){
 homeDemoSetStatus("GAMEPLAY FOOTAGE");homeDemoPlayState();
});
homeDemoVideo.addEventListener("pause",homeDemoPlayState);
homeDemoVideo.addEventListener("error",function(){
 homeDemoHasError=true;homeDemoVideo.pause();
 homeDemoEmpty.hidden=false;homeDemoSetStatus("PREVIEW UNAVAILABLE");
 homeDemoPlayState();
});
document.addEventListener("visibilitychange",homeShowcaseSync);
homeDemoVideo.muted=true;
homeDemoAudioState();
homeDemoSelect("deathmatch");
