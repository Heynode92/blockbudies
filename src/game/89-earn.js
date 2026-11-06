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
// The on-screen vPBT balance is fetched through the existing authenticated
// /v1/me endpoint. Half-units are the BE's canonical precision.
var earnBalanceRequestId=0,earnBalanceAccountKey=null;
var earnBalanceHalf=null,earnBalanceLoadState='signed_out';
function earnVerifiedAccountKey(state){
 var connected=PB_WALLET?.connection?.();
 if(!connected||!state?.authenticated||!state.registered||
    typeof state.address!=='string'||typeof state.player?.id!=='string'||
    connected.address.toLowerCase()!==state.address.toLowerCase())return '';
 return state.address.toLowerCase()+':'+state.player.id;
}
function earnFormatBalanceHalf(value){
 if((typeof value!=='string'&&!Number.isSafeInteger(value))||
    !/^\d{1,80}$/.test(String(value)))return null;
 var half=BigInt(value),integer=(half/2n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,',');
 return integer+(half%2n===0n?'.00':'.50')+' vPBT';
}
function earnRenderBalance(){
 var balance=document.getElementById('earnVpbtBalance'),
     status=document.getElementById('earnVpbtStatus');
 if(!balance||!status)return;
 var formatted=earnBalanceLoadState==='ready'?earnFormatBalanceHalf(earnBalanceHalf):null;
 balance.textContent=formatted||'—';
 status.textContent=formatted?'':earnBalanceLoadState==='loading'?'UPDATING':
  earnBalanceLoadState==='failed'?'UNAVAILABLE':'SIGN IN TO VIEW';
 status.hidden=Boolean(formatted);
}
function earnLoadBalance(state,force){
 var accountKey=earnVerifiedAccountKey(state);
 if(!force&&earnBalanceAccountKey===accountKey)return;
 earnBalanceAccountKey=accountKey;earnBalanceHalf=null;
 earnBalanceLoadState=accountKey?'loading':'signed_out';
 var requestId=++earnBalanceRequestId;
 earnRenderBalance();
 if(!accountKey)return;
 // A new wallet/session invalidates the in-flight response. Do not cache
 // amounts across identities or mistake an unauthenticated wallet for a player.
 void PB_ONLINE.request('/v1/me').then(function(player){
  if(requestId!==earnBalanceRequestId||
     earnVerifiedAccountKey(PB_ONLINE.state())!==accountKey||
     !document.getElementById('lbearn')?.classList.contains('on'))return;
  var balance=player?.id===state.player.id?earnFormatBalanceHalf(player.currentHalfVpbt):null;
  earnBalanceHalf=balance===null?null:player.currentHalfVpbt;
  earnBalanceLoadState=balance===null?'failed':'ready';
  earnRenderBalance();
 }).catch(function(){
  if(requestId!==earnBalanceRequestId||
     earnVerifiedAccountKey(PB_ONLINE.state())!==accountKey||
     !document.getElementById('lbearn')?.classList.contains('on'))return;
  earnBalanceHalf=null;earnBalanceLoadState='failed';earnRenderBalance();
 });
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
 // A verified change to the SIWE player is reflected without navigating away.
 // No extra fetch is made on unrelated wallet UI rerenders.
 if(screen.classList.contains('on'))
  earnLoadBalance(typeof PB_ONLINE!=='undefined'?PB_ONLINE.state():null,false);
}
function earnOpen(){
 lobP('lbearn');
 document.getElementById('earnStatus').textContent='';
 // Re-fetch from the BE every time the user opens EARN (e.g. after shopping).
 earnLoadBalance(typeof PB_ONLINE!=='undefined'?PB_ONLINE.state():null,true);
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
