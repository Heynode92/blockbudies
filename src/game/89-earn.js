// EARN is a public visual placeholder. No prices, swap quotes, approvals,
// contract interactions or off-chain balance mutations are permitted here.
var earnPendingSignIn=false;
function earnRender(){
 var screen=document.getElementById('lbearn');
 if(!screen)return;
 var authenticated=typeof PB_ONLINE!=='undefined'&&PB_ONLINE.state().authenticated===true;
 screen.querySelectorAll('.earn-convert-action').forEach(function(button){
  button.textContent=authenticated?'COMING SOON':earnPendingSignIn?'SIGNING IN…':'CONNECT WALLET';
  button.disabled=authenticated||earnPendingSignIn;
  button.setAttribute('aria-label',authenticated?'Token conversion coming soon':'Connect wallet to access future conversion');
 });
}
function earnOpen(){
 lobP('lbearn');
 earnPendingSignIn=false;
 document.getElementById('earnStatus').textContent='';
 earnRender();
}
async function earnConnectWallet(){
 if(earnPendingSignIn)return;
 if(typeof PB_ONLINE==='undefined'||!PB_WALLET?.configured){
  document.getElementById('earnStatus').textContent='WALLET CONNECTION UNAVAILABLE';
  return;
 }
 if(PB_ONLINE.state().authenticated){earnRender();return;}
 var status=document.getElementById('earnStatus');
 status.textContent='';
 if(!PB_WALLET.connection?.()){
  if(PB_WALLET.openConnect?.()){
   status.textContent='CONNECT YOUR WALLET, THEN SELECT CONNECT WALLET TO SIGN IN';
  }else status.textContent='WALLET CONNECTION UNAVAILABLE';
  return;
 }
 earnPendingSignIn=true;earnRender();
 try{
  await homeWalletSignIn(); // Existing RainbowKit / SIWE flow. No token approvals.
  status.textContent='CONVERTER FEATURE IS UNDER DEVELOPMENT';
 }catch(error){
  status.textContent=String(error?.code||error?.message||'WALLET_SIGN_IN_FAILED')
   .replace(/_/g,' ').slice(0,100);
 }finally{
  earnPendingSignIn=false;earnRender();
 }
}
document.getElementById('learn').addEventListener('click',earnOpen);
document.getElementById('earnBack').addEventListener('click',function(){lobP('lbs');});
document.querySelectorAll('#lbearn .earn-convert-action').forEach(function(button){
 button.addEventListener('click',function(){void earnConnectWallet();});
});
