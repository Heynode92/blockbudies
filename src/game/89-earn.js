// Public PointBlock EARN mock-up. The 1:1 preview is not a market quote.
// No contract interaction, approval, balance mutation, or trade request.
var earnReversed=false;
var EARN_TOKENS=Object.freeze({
 vpbt:Object.freeze({label:'vPBT',icon:'./src/assets/icon/vPBT-logo.png'}),
 pbt:Object.freeze({label:'PBT',icon:'./src/assets/icon/pb-logo.png'})
});
function earnWalletConnected(){
 return PB_WALLET?.state?.().connected===true;
}
// Decimal strings only: never use floating point for a token amount preview.
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
 var amount=document.getElementById('earnAmount');
 var output=document.getElementById('earnEstimate');
 if(amount&&output)output.textContent=earnPreviewAmount(amount.value);
}
function earnUpdateDirection(){
 var from=earnReversed?EARN_TOKENS.pbt:EARN_TOKENS.vpbt;
 var to=earnReversed?EARN_TOKENS.vpbt:EARN_TOKENS.pbt;
 document.getElementById('earnFromToken').textContent=from.label;
 document.getElementById('earnToToken').textContent=to.label;
 document.getElementById('earnFromIcon').src=from.icon;
 document.getElementById('earnToIcon').src=to.icon;
 document.getElementById('earnAmount').setAttribute('aria-label',from.label+' amount to preview');
 document.getElementById('earnEstimate').setAttribute('aria-label','Estimated '+to.label+' preview at 1:1');
 document.getElementById('earnRate').textContent='1 '+from.label+' = 1 '+to.label;
 document.getElementById('earnFlip').setAttribute('aria-label','Switch conversion to '+to.label+' to '+from.label);
 earnUpdatePreviews();
}
function earnFlipDirection(){
 earnReversed=!earnReversed;
 earnUpdateDirection();
}
function earnRender(){
 var screen=document.getElementById('lbearn');
 if(!screen)return;
 var connected=earnWalletConnected();
 var button=screen.querySelector('.earn-convert-action');
 if(button){
  button.textContent=connected?'COMING SOON':'CONNECT WALLET';
  button.disabled=connected;
  button.setAttribute('aria-label',connected?
    'Token conversion coming soon':'Connect wallet to preview future conversion');
 }
 earnUpdateDirection();
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
document.getElementById('earnFlip').addEventListener('click',earnFlipDirection);
document.getElementById('earnAmount').addEventListener('input',earnUpdatePreviews);
document.querySelector('#lbearn .earn-convert-action').addEventListener('click',earnConnectWallet);
PB_WALLET?.subscribe?.(function(){earnRender();});
