// Home menu showcase: local gameplay videos, separate from the Three.js map render.
// Only the HOME panel owns playback; inventory, room lobby and matches stay unaffected.
var HOME_DEMOS=Object.freeze({
 deathmatch:Object.freeze({src:GAME_ASSET_URLS.deathmatch,label:"DEATHMATCH",detail:"5V5 · ALL-OUT COMBAT",number:"01"}),
 bomb:Object.freeze({src:GAME_ASSET_URLS.bomb,label:"BOMB MISSION",detail:"TACTICAL · PLANT & DEFUSE",number:"02"})
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
// Wallet identity is the backend SIWE session, never an unsigned provider account.
var homeWalletAccount=null;
function homeFormatHalf(value){
 if((typeof value!=='string'&&!Number.isSafeInteger(value))||
    !/^[0-9]+$/.test(String(value)))return '—';
 var half=BigInt(value),integer=(half/2n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,',');
 return integer+(half%2n?'.5':'');
}
function homeProfileRender(state){
 var player=state?.authenticated&&state.registered?state.player:null;
 var panel=document.getElementById('homeProgressPanel'),balance=document.getElementById('homeVpbtBalance');
 var headerChip=document.getElementById('homeIdentityChip');
 balance.textContent=player?homeFormatHalf(player.currentHalfVpbt):'—';
 panel.hidden=!player;
 headerChip.hidden=!player;
 if(!player){
  rankInsigniaSet(null,null);
  return;
 }
 // Header is nickname only. Server rank and EXP live under the 3D operator
 // in the room browser, never in the shared Home/Room Master header.
 var username=String(player.username||'PLAYER').slice(0,12);
 document.getElementById('homeHeaderUsername').textContent=username;
 document.getElementById('homeRankCallsign').textContent=username;
 document.getElementById('homeRankName').textContent=String(player.rank||'—').slice(0,48);
 // The Three.js insignia is a visual projection of the VERIFIED server rank.
 rankInsigniaSet(player.rankIndex,player.rank);
 var earned=homeFormatHalf(player.currentRankHalfExp),required=player.nextRankHalfExp;
 var capped=required===null&&Number.isSafeInteger(player.rankIndex);
 document.getElementById('homeRankExp').textContent=capped?'MAX RANK':earned+' / '+homeFormatHalf(required);
 var safe=Number.isSafeInteger(player.currentRankHalfExp)&&player.currentRankHalfExp>=0&&
   Number.isSafeInteger(required)&&required>0;
 var progress=safe?Math.min(100,Math.max(0,player.currentRankHalfExp/required*100)):capped?100:0;
 document.getElementById('homeRankFill').style.width=progress+'%';
 var meter=panel.querySelector('.home-progress-track');
 meter.setAttribute('aria-valuenow',String(Math.round(progress)));
 meter.setAttribute('aria-valuetext',capped?'MAX RANK':earned+' of '+homeFormatHalf(required)+' EXP');
}
function homeWalletRender(){
 var state=typeof PB_ONLINE!=="undefined"?PB_ONLINE.state():
  {configured:false,authenticated:false,address:null};
 homeWalletAccount=state.authenticated?state.address:null;
 // RainbowKit/wagmi exclusively owns the header connect + account UI.
 // Server-verified player data stays in the original Three.js HUD.
 homeProfileRender(state);
}
async function homeWalletSignIn(){
 if(typeof PB_ONLINE==='undefined')throw Error('BACKEND_REQUIRED');
 if(PB_ONLINE.state().authenticated)return PB_ONLINE.state();
 if(!PB_WALLET?.configured)throw Error('WALLETCONNECT_PROJECT_ID_REQUIRED');
 if(!PB_WALLET.connection?.()){
  PB_WALLET.openConnect?.();
  throw Error('RAINBOWKIT_WALLET_NOT_CONNECTED');
 }
 var state=await PB_ONLINE.connectWallet();
 homeWalletRender();
 return state;
}
// Shared PointBlock-themed modal. Home START and Inventory require an authenticated
// SIWE account. Shop/Leaderboard remain navigable without this gate.
var homeGateIntent='inventory',homeGateOverlay=document.getElementById('walletGateOverlay');
function homeAuthGateClose(){
 homeGateOverlay.hidden=true;
 document.getElementById('walletGateError').hidden=true;
 document.getElementById('walletGateConnect').disabled=false;
}
function homeAuthGateOpen(intent){
 homeGateIntent=intent==='match'?'match':'inventory';
 var state=typeof PB_ONLINE!=='undefined'?PB_ONLINE.state():null;
 var enrolled=!!state?.authenticated&&!!state.registered&&typeof state.player?.id==='string';
 // Unauthenticated users are directed to RainbowKit's real connector modal,
 // not a home-built injected-wallet selector. SIWE is signed separately.
 if(!state?.authenticated){
  if(PB_WALLET?.connection?.()){
   void homeWalletSignIn().then(function(){homeAuthGateOpen(intent);})
    .catch(function(error){
      document.getElementById('walletGateTitle').textContent='SIGN IN FAILED';
      document.getElementById('walletGateText').textContent=String(
       error?.code||error?.message||'WALLET_SIGN_IN_FAILED').slice(0,96).replace(/_/g,' ');
      document.getElementById('walletGateConnect').textContent='TRY AGAIN';
      homeGateOverlay.hidden=false;
    });
  }else if(!PB_WALLET?.openConnect?.()){
   document.getElementById('walletGateTitle').textContent='WALLET CONNECTION UNAVAILABLE';
   document.getElementById('walletGateText').textContent='Configure your WalletConnect project ID in the frontend environment.';
   document.getElementById('walletGateConnect').disabled=true;
   homeGateOverlay.hidden=false;
  }
  return;
 }
 if(enrolled){
  homeAuthGateClose();
  if(homeGateIntent==='inventory')inventoryOpen();
  else void onlineStartGate();
  return;
 }
 var registered=!!state?.authenticated,profileMissing=registered&&state.registered&&!state.player?.id;
 document.getElementById('walletGateTitle').textContent=profileMissing?'PROFILE SYNC REQUIRED':registered?'TRAINING REQUIRED':'CONNECT YOUR WALLET';
 document.getElementById('walletGateText').textContent=profileMissing?
  'Wallet verified. Refresh your server profile before opening account-owned equipment.':
  registered?'Finish verified training and register your callsign before entering your Inventory.':
  homeGateIntent==='inventory'?
   'Authenticate your wallet to access the weapons owned by your player account.':
   'Sign in with your wallet to access verified matches and your player progression.';
 document.getElementById('walletGateConnect').textContent=profileMissing?'SYNC PLAYER PROFILE':registered?'START TRAINING':'CONNECT & SIGN IN';
 document.getElementById('walletGateError').hidden=true;
 homeGateOverlay.hidden=false;
 document.getElementById('walletGateConnect').focus();
}
document.getElementById('walletGateClose').addEventListener('click',homeAuthGateClose);
document.getElementById('walletGateCancel').addEventListener('click',homeAuthGateClose);
homeGateOverlay.addEventListener('click',function(event){if(event.target===homeGateOverlay)homeAuthGateClose();});
addEventListener('keydown',function(event){
 if(event.key==='Escape'&&!homeGateOverlay.hidden){event.preventDefault();event.stopImmediatePropagation();homeAuthGateClose();}
},true);
document.getElementById('walletGateConnect').addEventListener('click',async function(){
 if(typeof PB_ONLINE==='undefined'){document.getElementById('walletGateError').textContent='BACKEND REQUIRED';document.getElementById('walletGateError').hidden=false;return;}
 var button=this,errorBox=document.getElementById('walletGateError');
 button.disabled=true;errorBox.hidden=true;
 try{
  var state=PB_ONLINE.state(),justSignedIn=!state.authenticated;
  if(justSignedIn)state=await homeWalletSignIn();
  if(state.registered&&!state.player?.id)state=await PB_ONLINE.refreshProfile();
  if(!state.registered){
   if(justSignedIn){homeAuthGateOpen(homeGateIntent);return;}
   // This is the explicit START TRAINING action for an authenticated but
   // not yet registered player; it never bypasses backend verification.
   homeAuthGateClose();await onlineStartGate();return;
  }
  if(typeof state.player?.id!=='string')throw Error('PLAYER_PROFILE_UNAVAILABLE');
  var target=homeGateIntent;homeAuthGateClose();
  if(target==='inventory')inventoryOpen();
  else await onlineStartGate();
 }catch(error){
  errorBox.textContent=String(error?.code||'WALLET_SIGN_IN_FAILED').slice(0,96).replace(/_/g,' ');
  errorBox.hidden=false;
 }finally{button.disabled=false;}
});
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
