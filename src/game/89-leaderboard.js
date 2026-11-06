// Public PointBlock Top 10. The server alone determines rank, EXP and order.
// Character models are the *same* inventory/room Three.js operator renderer.
var leaderboardEntries=[],leaderboardSelectedId=null,leaderboardRequestEpoch=0;
function leaderboardHalfExp(value){
 if((typeof value!=='string'&&!Number.isSafeInteger(value))||
    !/^\d{1,80}$/.test(String(value)))return '—';
 var half=BigInt(value),integer=(half/2n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,',');
 return integer+(half%2n===0n?'':'.5');
}
function leaderboardCount(value){
 if(typeof value!=='string'||!/^\d{1,80}$/.test(value))return '—';
 return BigInt(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g,',');
}
function leaderboardValidEntry(entry,index){
 return entry&&typeof entry==='object'&&
  entry.position===index+1&&
  typeof entry.playerId==='string'&&
  /^[a-f0-9-]{36}$/i.test(entry.playerId)&&
  typeof entry.username==='string'&&/^[A-Za-z0-9_]{1,12}$/.test(entry.username)&&
  typeof entry.rank==='string'&&entry.rank.length>0&&entry.rank.length<=60&&
  Number.isSafeInteger(entry.rankIndex)&&!!rankInsigniaSpec(entry.rankIndex)&&
  Number.isSafeInteger(entry.currentRankHalfExp)&&entry.currentRankHalfExp>=0&&
  (entry.nextRankHalfExp===null||
   Number.isSafeInteger(entry.nextRankHalfExp)&&entry.nextRankHalfExp>0)&&
  typeof entry.lifetimeHalfExp==='string'&&/^\d{1,80}$/.test(entry.lifetimeHalfExp)&&
  ['kills','deaths','headshotKills'].every(function(key){
    return typeof entry[key]==='string'&&/^\d{1,80}$/.test(entry[key]);
  })&&
  Number.isSafeInteger(entry.mainWeaponId)&&entry.mainWeaponId>=0&&
  entry.mainWeaponId<WP.length;
}
function leaderboardBadge(index){
 try{return rankRosterPreview(index);}catch(error){return null;}
}
function leaderboardNode(tag,cls,value){
 var el=document.createElement(tag);
 if(cls)el.className=cls;
 if(value!==undefined)el.textContent=value;
 return el;
}
function leaderboardShowSelection(entry){
 if(!entry)return;
 leaderboardSelectedId=entry.playerId;
 var weapon=WP[entry.mainWeaponId];
 document.getElementById('leaderboardSelectedPosition').textContent='#'+entry.position+' GLOBAL';
 document.getElementById('leaderboardSelectedWeapon').textContent=weapon?.n||'K2';
 document.getElementById('leaderboardSelectedName').textContent=entry.username;
 document.getElementById('leaderboardSelectedRank').textContent=entry.rank;
 var badge=document.getElementById('leaderboardSelectedBadge');
 var image=leaderboardBadge(entry.rankIndex);
 badge.hidden=!image;
 if(image)badge.src=image;else badge.removeAttribute('src');
 var next=entry.nextRankHalfExp,exp=entry.currentRankHalfExp;
 document.getElementById('leaderboardSelectedExp').textContent=
   next===null?'MAX RANK':leaderboardHalfExp(exp)+' / '+leaderboardHalfExp(next);
 var percent=next===null?100:Math.min(100,Math.max(0,exp/next*100));
 document.getElementById('leaderboardExpFill').style.width=percent+'%';
 document.querySelector('#lbboard .leaderboard-exp-track')
   .setAttribute('aria-valuenow',String(Math.round(percent)));
 // Verified mainWeaponId is supplied by the backend for each ranked player.
 // The standard shared Police soldier is a visual operator preview, not
 // an assertion about an individual player's faction or cosmetic appearance.
 inventoryLeaderboardPreviewOpen(entry.mainWeaponId);
 document.querySelectorAll('#lbboard .leaderboard-row').forEach(function(button){
  var chosen=button.dataset.playerId===entry.playerId;
  button.classList.toggle('is-selected',chosen);
  button.setAttribute('aria-pressed',String(chosen));
 });
}
function leaderboardRenderRows(){
 var host=document.getElementById('leaderboardRows');
 host.replaceChildren();
 if(!leaderboardEntries.length){
  host.appendChild(leaderboardNode('p','leaderboard-state','NO RANKED PLAYERS YET'));
  return;
 }
 leaderboardEntries.forEach(function(entry){
  var button=leaderboardNode('button','leaderboard-row');
  button.type='button';button.dataset.playerId=entry.playerId;
  if(entry.position<=3)button.classList.add('is-top');
  button.setAttribute('aria-label',
    '#'+entry.position+' '+entry.username+', '+entry.rank+
    ', '+leaderboardCount(entry.kills)+' kills, '+
    leaderboardCount(entry.deaths)+' deaths, '+
    leaderboardCount(entry.headshotKills)+' headshots');
  button.appendChild(leaderboardNode('span','leaderboard-place',
    String(entry.position).padStart(2,'0')));
  button.appendChild(leaderboardNode('span','leaderboard-username',entry.username));
  var rank=leaderboardNode('span','leaderboard-ranked');
  var image=leaderboardBadge(entry.rankIndex);
  if(image){var img=document.createElement('img');img.alt='';img.src=image;rank.appendChild(img);}
  rank.appendChild(leaderboardNode('span','',entry.rank));
  button.appendChild(rank);
  button.appendChild(leaderboardNode('span','leaderboard-combat-stat',
    leaderboardCount(entry.kills)));
  button.appendChild(leaderboardNode('span','leaderboard-combat-stat',
    leaderboardCount(entry.deaths)));
  button.appendChild(leaderboardNode('span','leaderboard-combat-stat',
    leaderboardCount(entry.headshotKills)));
  button.addEventListener('click',function(){leaderboardShowSelection(entry);});
  host.appendChild(button);
 });
 var selected=leaderboardEntries.find(function(e){return e.playerId===leaderboardSelectedId;})||
              leaderboardEntries[0];
 leaderboardShowSelection(selected);
}
async function leaderboardRefresh(){
 var epoch=++leaderboardRequestEpoch,
     refresh=document.getElementById('leaderboardRefresh'),
     host=document.getElementById('leaderboardRows');
 refresh.disabled=true;
 if(!leaderboardEntries.length){
  host.replaceChildren(leaderboardNode('p','leaderboard-state','LOADING TOP 10…'));
 }
 try{
  if(typeof PB_ONLINE==='undefined')throw Error('BACKEND_REQUIRED');
  var response=await PB_ONLINE.leaderboard();
  if(epoch!==leaderboardRequestEpoch||
     !document.getElementById('lbboard').classList.contains('on'))return;
  var rows=response?.leaderboard;
  if(!Array.isArray(rows)||rows.length>10||
     !rows.every(leaderboardValidEntry)||
     new Set(rows.map(function(e){return e.playerId;})).size!==rows.length)
   throw Error('INVALID_LEADERBOARD_RESPONSE');
  leaderboardEntries=rows;
  leaderboardRenderRows();
 }catch(error){
  if(epoch!==leaderboardRequestEpoch||
     !document.getElementById('lbboard').classList.contains('on'))return;
  if(!leaderboardEntries.length){
   host.replaceChildren(leaderboardNode('p','leaderboard-state','LEADERBOARD UNAVAILABLE'));
  }
  console.warn('[PointBlock] Leaderboard request failed',error?.code||error?.message||'REQUEST_FAILED');
 }finally{
  if(epoch===leaderboardRequestEpoch)refresh.disabled=false;
 }
}
function leaderboardOpen(){
 lobP('lbboard');
 // This is the EXACT animated, turnable Lobby/Inventory soldier canvas.
 inventoryLeaderboardPreviewOpen(9);
 void leaderboardRefresh();
}
document.getElementById('homeLeaderboard').addEventListener('click',leaderboardOpen);
document.getElementById('leaderboardBack').addEventListener('click',function(){lobP('lbs');});
document.getElementById('leaderboardRefresh').addEventListener('click',function(){void leaderboardRefresh();});
