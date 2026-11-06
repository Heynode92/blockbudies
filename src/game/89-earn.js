// Public EARN placeholder. No rate calculation, contracts, approvals or
// backend token mutations are enabled while conversion is coming soon.
function earnWalletConnected(){
 // Wagmi/RainbowKit owns connection state. SIWE is not required to VIEW
 // a disabled placeholder; no conversion can be submitted here.
 return PB_WALLET?.state?.().connected===true;
}
function earnRender(){
 var screen=document.getElementById('lbearn');
 if(!screen)return;
 var connected=earnWalletConnected();
 screen.querySelectorAll('.earn-convert-action').forEach(function(button){
  button.textContent=connected?'COMING SOON':'CONNECT WALLET';
  button.disabled=connected;
  button.setAttribute('aria-label',connected?
   'Token conversion coming soon':'Connect wallet to preview future conversion');
 });
}
function earnOpen(){
 lobP('lbearn');
 document.getElementById('earnStatus').textContent='';
 earnRender();
}
function earnConnectWallet(){
 var notice=document.getElementById('earnStatus');
 if(earnWalletConnected()){earnRender();return;}
 if(!PB_WALLET?.configured||!PB_WALLET.openConnect?.()){
  notice.textContent='WALLET CONNECTION UNAVAILABLE';
  return;
 }
 notice.textContent='CONNECT YOUR WALLET TO VIEW THE COMING SOON CONVERTER';
}
document.getElementById('learn').addEventListener('click',earnOpen);
document.getElementById('earnBack').addEventListener('click',function(){lobP('lbs');});
document.querySelectorAll('#lbearn .earn-convert-action').forEach(function(button){
 button.addEventListener('click',earnConnectWallet);
});
// Re-render when the provider connects, disconnects or changes account/chain,
// even before a PointBlock SIWE session exists.
PB_WALLET?.subscribe?.(function(){earnRender();});
