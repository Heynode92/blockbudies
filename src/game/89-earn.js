// PointBlock EARN: 1:1 *visual preview* only. Nothing here initiates swaps,
// contracts, approvals, balance queries, quotes, or backend token mutations.
function earnWalletConnected(){
 // RainbowKit/Wagmi owns wallet connection state; no SIWE is needed merely
 // to view a disabled converter mock-up.
 return PB_WALLET?.state?.().connected===true;
}
// Pure decimal-string formatter: 1:1 is exact, avoids Number precision loss.
function earnPreviewAmount(value){
 var raw=typeof value==='string'?value.trim():'';
 if(!raw)return '≈ —';
 if(raw.charAt(0)==='.')raw='0'+raw;
 if(!/^\d+(?:\.\d{0,8})?$/.test(raw))return '≈ —';
 var halves=raw.split('.'),integer=halves[0].replace(/^0+(?=\d)/,'');
 integer=integer.replace(/\B(?=(\d{3})+(?!\d))/g,',');
 return '≈ '+integer+(halves.length>1&&halves[1]!==''?'.'+halves[1]:'');
}
function earnUpdatePreviews(){
 document.querySelectorAll('#lbearn .earn-card').forEach(function(card){
  var field=card.querySelector('input'),estimate=card.querySelector('.earn-estimate');
  if(!field||!estimate)return;
  estimate.textContent=earnPreviewAmount(field.value);
 });
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
 earnUpdatePreviews();
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
  notice.textContent='WALLET CONNECTION UNAVAILABLE';return;
 }
 notice.textContent='CONNECT YOUR WALLET TO VIEW THE COMING SOON CONVERTER';
}
document.getElementById('learn').addEventListener('click',earnOpen);
document.getElementById('earnBack').addEventListener('click',function(){lobP('lbs');});
document.querySelectorAll('#lbearn .earn-convert-action').forEach(function(button){
 button.addEventListener('click',earnConnectWallet);
});
document.querySelectorAll('#lbearn .earn-card input').forEach(function(input){
 input.addEventListener('input',earnUpdatePreviews);
});
PB_WALLET?.subscribe?.(function(){earnRender();});
