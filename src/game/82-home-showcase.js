// Home menu showcase: local gameplay videos, separate from the Three.js map render.
// Only the HOME panel owns playback; inventory, room lobby and matches stay unaffected.
var HOME_DEMOS=Object.freeze({
 deathmatch:Object.freeze({src:"./src/assets/video/deatch_match_demo.mp4",label:"DEATHMATCH",detail:"5V5 · ALL-OUT COMBAT",number:"01"}),
 bomb:Object.freeze({src:"./src/assets/video/bomb_mission_demo.mp4",label:"BOMB MISSION",detail:"TACTICAL · PLANT & DEFUSE",number:"02"})
});
var homeDemoKey="deathmatch",homeDemoHasError=false;
var homeDemoVideo=document.getElementById("homeDemoVideo"),
 homeDemoNextVideo=document.getElementById("homeDemoNextVideo"),
 homeDemoScreen=document.querySelector("#lbs .home-demo-screen"),
 homeDemoStatus=document.getElementById("homeDemoStatus"),
 homeDemoLabel=document.getElementById("homeDemoLabel"),
 homeDemoDetail=document.getElementById("homeDemoDetail"),
 homeDemoCounter=document.getElementById("homeDemoCounter"),
 homeDemoProgress=document.getElementById("homeDemoProgress"),
 homeDemoEmpty=document.getElementById("homeDemoEmpty");
var homeDemoInterval=null,homeDemoFadeTimer=null,homeDemoTransitioning=false;
function homeDemoVisible(){
 return !document.hidden&&!run&&!!lob&&document.getElementById("lbs").classList.contains("on");
}
function homeDemoSetStatus(message){homeDemoStatus.textContent=message;}
function homeDemoAttemptPlay(video){
 if(!homeDemoVisible()||homeDemoHasError)return;
 var target=video||homeDemoVideo;target.muted=true;
 var attempt=target.play();
 if(attempt&&typeof attempt.catch==="function")attempt.catch(function(){
   if(homeDemoVisible()&&!homeDemoHasError)homeDemoSetStatus("GAMEPLAY PREVIEW");
 });
}
function homeDemoUpdateLabel(value){
 var demo=HOME_DEMOS[value];homeDemoKey=value;
 homeDemoLabel.textContent=demo.label;homeDemoDetail.textContent=demo.detail;
 homeDemoCounter.textContent=demo.number+" / 02";
 homeDemoEmpty.hidden=true;homeDemoSetStatus("GAMEPLAY FOOTAGE");
}
function homeDemoResetProgress(){
 if(!homeDemoProgress)return;
 homeDemoProgress.style.animation="none";
 void homeDemoProgress.offsetWidth;
 homeDemoProgress.style.animation="";
}
function homeDemoRotate(){
 if(!homeDemoVisible()||homeDemoTransitioning)return;
 homeDemoTransitioning=true;
 var nextKey=homeDemoKey==="deathmatch"?"bomb":"deathmatch";
 var outgoing=homeDemoVideo,incoming=homeDemoNextVideo;
 incoming.classList.remove("is-current");incoming.muted=true;
 incoming.src=HOME_DEMOS[nextKey].src;incoming.load();
 function finish(){
   if(!homeDemoTransitioning)return;
   incoming.classList.add("is-current");
   homeDemoUpdateLabel(nextKey);
   homeDemoResetProgress();
   clearTimeout(homeDemoFadeTimer);
   homeDemoFadeTimer=setTimeout(function(){
     outgoing.pause();outgoing.classList.remove("is-current");outgoing.removeAttribute("src");outgoing.load();
     homeDemoVideo=incoming;homeDemoNextVideo=outgoing;homeDemoTransitioning=false;
   },780);
 }
 var play=incoming.play();
 if(play&&typeof play.then==="function"){
   play.then(function(){if(homeDemoVisible())finish();else homeDemoTransitioning=false;})
   .catch(function(){homeDemoTransitioning=false;homeDemoSetStatus("GAMEPLAY PREVIEW");});
 }else finish();
}
function homeShowcaseSync(){
 if(!homeDemoVideo)return;
 if(homeDemoVisible()){
   homeDemoAttemptPlay();
   if(homeDemoInterval===null){
     homeDemoResetProgress();
     homeDemoInterval=setInterval(homeDemoRotate,10000);
   }
 }else{
   homeDemoVideo.pause();homeDemoNextVideo.pause();
   if(homeDemoInterval!==null){clearInterval(homeDemoInterval);homeDemoInterval=null;}
   clearTimeout(homeDemoFadeTimer);
   homeDemoVideo.classList.add("is-current");
   homeDemoNextVideo.classList.remove("is-current");
   homeDemoTransitioning=false;
 }
}
[homeDemoVideo,homeDemoNextVideo].forEach(function(video){
 video.muted=true;
 video.addEventListener("error",function(){
   if(video!==homeDemoVideo)return;
   homeDemoHasError=true;
   homeDemoEmpty.hidden=false;homeDemoSetStatus("PREVIEW UNAVAILABLE");
 });
});
document.addEventListener("visibilitychange",homeShowcaseSync);
homeDemoUpdateLabel("deathmatch");
homeShowcaseSync();
// Wallet connection is optional UI preparation; it does not authenticate gameplay.
var homeWalletButton=document.getElementById("homeWalletConnect");
var homeWalletAccount=null;
var homeWalletLabel=document.getElementById("homeWalletLabel");
function homeWalletRender(){
 homeWalletLabel.textContent=homeWalletAccount?
  homeWalletAccount.slice(0,6)+"…"+homeWalletAccount.slice(-4):"CONNECT WALLET";
 homeWalletButton.classList.toggle("connected",!!homeWalletAccount);
 homeWalletButton.setAttribute("aria-label",homeWalletAccount?"Connected wallet "+homeWalletAccount:"Connect wallet");
}
homeWalletButton.addEventListener("click",function(){
 var provider=window.ethereum;
 if(!provider||typeof provider.request!=="function"){
   homeWalletLabel.textContent="WALLET NOT FOUND";
   return;
 }
 homeWalletButton.disabled=true;homeWalletLabel.textContent="CONNECTING…";
 provider.request({method:"eth_requestAccounts"}).then(function(accounts){
   homeWalletAccount=Array.isArray(accounts)&&typeof accounts[0]==="string"&&/^0x[a-fA-F0-9]{40}$/.test(accounts[0])?accounts[0]:null;
   homeWalletRender();
 }).catch(function(){
   homeWalletRender();
 }).finally(function(){homeWalletButton.disabled=false;});
});
if(window.ethereum&&typeof window.ethereum.on==="function"){
 window.ethereum.on("accountsChanged",function(accounts){
   homeWalletAccount=Array.isArray(accounts)&&typeof accounts[0]==="string"&&/^0x[a-fA-F0-9]{40}$/.test(accounts[0])?accounts[0]:null;
   homeWalletRender();
 });
}
homeWalletRender();
// PBT is a visual placeholder until the token system has an audited contract and trusted balance source.
var homePbtAdd=document.getElementById("homePbtAdd");
var homePbtNotice=document.getElementById("homePbtNotice");
var homePbtNoticeTimer=null;
if(homePbtAdd&&homePbtNotice){
 homePbtAdd.addEventListener("click",function(){
  homePbtNotice.hidden=false;
  clearTimeout(homePbtNoticeTimer);
  homePbtNoticeTimer=setTimeout(function(){homePbtNotice.hidden=true;},3500);
 });
}
