// Authoritative online bridge for the existing single-scope Three.js runtime.
// No browser-local room, unlock, score, objective, bot aim or kill is authoritative.
// The original rendering, UI transitions, map art and viewmodels are preserved.
var onlineApi=typeof PB_ONLINE!=='undefined'?PB_ONLINE:null;
var onlineActive=false,onlineTraining=false,onlineCurrentId=null,onlineMatchId=null;
var onlineWorld=null,onlineGame=null,onlineActors=new Map(),onlineSeq=0,onlineSendAt=0,onlineMeId=null;
var onlineLobbyTimer=0,onlineRoomOpening=false,onlineRoomTimer=0,onlineRouteToken=0;
var onlineTeamNotice=null,onlineInputId=0,onlineVisualLoaded=false;
var onlineReconnectTimer=0,onlineReconnectStarted=0,onlineReconnecting=false;
var onlineAimInitialized=false,onlineTrainingProgressValue=null,onlinePrevAlive=true;
var onlineSelfTarget=null,onlineLastWinner=undefined,onlineMuzzleTime=0;
var onlineScoreboard=new Map();
function onlineWarn(error) {
 var code=typeof error==='string'?error:error&&error.code||'BACKEND_UNAVAILABLE';
 roomSetMessage(code);if(typeof roomLiveLog==='function'&&roomCurrent)roomLiveLog(code);
 return code;
}
function onlineAuth() {
 if(!onlineApi||!onlineApi.state().configured){onlineWarn('BACKEND_URL_NOT_CONFIGURED');return false;}
 if(!onlineApi.state().authenticated){onlineWarn('SIWE_LOGIN_REQUIRED — CONNECT WALLET FIRST');return false;}
 return true;
}
function onlineRoomOf(r) {
 if(!r||typeof r.id!=='string'||!['DM','BM'].includes(r.mode))return null;
 var mode=r.mode==='BM'?1:0,goals=r.goals||{};
 return {id:r.id,code:r.code,name:r.name,mode:mode,mapId:r.mapId,ownerId:r.ownerId,
  status:r.status,members:Array.isArray(r.members)?r.members:[],
  kills:goals.kills??50,minutes:goals.minutes??10,
  rounds:goals.maxRounds??12,roundMinutes:goals.roundMinutes??2};
}
function onlineRoomBody(draft) {
 if(!draft||!String(draft.name||'').trim())throw Error('ROOM_NAME_REQUIRED');
 var mode=draft.mode===1?'BM':'DM',common={name:String(draft.name).trim().slice(0,32),mapId:draft.mapId};
 return mode==='DM'?{...common,mode,goalKills:Number(draft.kills),goalMinutes:Number(draft.minutes)}:
  {...common,mode,maxRounds:Number(draft.rounds),roundMinutes:Number(draft.roundMinutes)};
}
function onlineRoomUpdateBody(draft) {
 var {mode,...payload}=onlineRoomBody(draft);
 return payload;
}
function onlineIsMaster(){return !!roomCurrent&&onlineApi?.state().player?.id===roomCurrent.ownerId;}
function onlineOwnMember(){
 return roomCurrent?.members?.find(m=>m.playerId===onlineApi?.state().player?.id)||null;
}
function onlineAdoptRoom(room) {
 var parsed=onlineRoomOf(room);if(!parsed)throw Error('INVALID_ROOM_RESPONSE');
 roomCurrent=parsed;
 var me=onlineOwnMember();if(me){
  roomSide=me.team===1?1:0;
  roomSeat=parsed.members.filter(m=>m.team===roomSide).findIndex(m=>m.playerId===me.playerId);
 }
 if(!roomList.some(r=>r.id===parsed.id))roomList.unshift(parsed);
 else roomList=roomList.map(r=>r.id===parsed.id?parsed:r);
 return parsed;
}
function onlineRoomRender(){
 var list=document.getElementById('roomEntries');if(!list)return;
 list.replaceChildren();
 document.getElementById('roomEmpty').hidden=roomList.length>0;
 roomText('roomCount',roomList.length+' ONLINE ROOM'+(roomList.length===1?'':'S'));
 roomList.forEach(function(r){
  var row=document.createElement('div');row.className='room-entry';
  function cell(tag,value,cls){var el=document.createElement(tag);el.textContent=String(value);if(cls)el.className=cls;row.appendChild(el);return el}
  cell('span',r.code||'—');cell('strong',r.name);
  var map=document.createElement('div');map.className='rm-map';
  var title=document.createElement('span'),mode=document.createElement('small');
  title.textContent=(roomMapsForMode(r.mode,r.mapId)||{}).name||'UNKNOWN';
  mode.textContent=r.mode===1?'BOMB MISSION':'DEATHMATCH';
  map.appendChild(title);map.appendChild(mode);row.appendChild(map);
  cell('span',r.members.length+' / 10');
  cell('span',r.status||'WAITING','rm-status');
  var button=cell('button','JOIN');button.type='button';
  button.disabled=r.status!=='OPEN';
  button.addEventListener('click',()=>{void onlineSelectRoom(r.id)});
  list.appendChild(row);
 });
}
async function onlineRefreshRooms(){
 if(!onlineAuth())return;
 try {
  var response=await onlineApi.rooms();
  roomList=(response.rooms||[]).map(onlineRoomOf).filter(Boolean);
  if(roomCurrent&&!roomList.some(r=>r.id===roomCurrent.id))roomList.unshift(roomCurrent);
  onlineRoomRender();
 }catch(error){roomList=[];onlineRoomRender();onlineWarn(error)}
}
function onlineRoomTeams(){
 var size=5, me=onlineApi?.state().player?.id;
 for(var side=0;side<2;side++){
  var target=document.getElementById(side===0?'rmlPoliceSlots':'rmlTerrorSlots');
  target.replaceChildren();
  var members=(roomCurrent?.members||[]).filter(m=>m.team===side);
  roomText(side===0?'rmlPoliceCount':'rmlTerrorCount',members.length+' / '+size+' PLAYERS');
  for(var index=0;index<size;index++){
   var member=members[index],mine=member?.playerId===me;
   var row=document.createElement('button');row.type='button';
   row.className='rml-slot'+(mine?' is-you':'');row.disabled=!!member&&!mine;
   row.setAttribute('aria-pressed',String(mine));
   var num=document.createElement('span');num.className='rml-slot-index';num.textContent=String(index+1);
   var name=document.createElement('span');name.className='rml-slot-name';
   name.textContent=member?(mine?'YOU · '+member.username:member.username):'BOT ON START';
   var hint=document.createElement('em');hint.textContent=mine?'YOU':member?'PLAYER':'OPEN';
   row.appendChild(num);row.appendChild(name);row.appendChild(hint);
   if(!member){(function(team){row.addEventListener('click',()=>{void onlineSwitchTeam(team)})})(side)}
   target.appendChild(row);
  }
 }
}
function onlineLiveRoomDecorate(room) {
 roomLiveOpen(room);
 var me=onlineOwnMember();
 roomText('rmlBotSummary',room.members.length+' PLAYER'+(room.members.length===1?'':'S')+
  ' + '+(10-room.members.length)+' BOTS ON START');
 var mine=onlineIsMaster();
 document.getElementById('roomMasterActions').hidden=!mine;
 document.getElementById('roomMasterStatus').hidden=!mine;
 document.getElementById('rmlStart').hidden=!mine;
 document.getElementById('rmlSettings').hidden=!mine;
 if(me){roomSide=me.team===1?1:0;roomSeat=room.members.filter(m=>m.team===roomSide).findIndex(m=>m.playerId===me.playerId)}
 onlineRoomTeams();
}
async function onlineSelectRoom(id) {
 if(!onlineAuth()||onlineRoomOpening)return;
 onlineRoomOpening=true;
 try{
  var room=await onlineApi.getRoom(id);
  if(room.status==='OPEN'&&!room.members?.some(m=>m.playerId===onlineApi.state().player?.id)){
   var counts=[0,1].map(t=>room.members.filter(m=>m.team===t).length);
   room=await onlineApi.joinRoom(id,counts[0]<=counts[1]&&counts[0]<5?0:1);
  }
  var current=onlineAdoptRoom(room);onlineLiveRoomDecorate(current);
  roomLiveLog(current.code+' · CONNECTED TO ROOM SERVER');
  onlineStartRoomPoll();
 }catch(error){onlineWarn(error)}
 finally{onlineRoomOpening=false}
}
async function onlineCreateRoom(){
 if(!onlineAuth())return;
 var draft=roomFormData();
 if(!draft){onlineWarn('ROOM_NAME_REQUIRED');return}
 try{
  var created=await onlineApi.createRoom(onlineRoomBody(draft));
  roomList=[];roomLog=[];onlineAdoptRoom(created);
  roomBrowserCreateClose();onlineLiveRoomDecorate(roomCurrent);
  roomLiveLog('Server created '+roomCurrent.code);
  onlineStartRoomPoll();
 }catch(error){onlineWarn(error)}
}
async function onlineSaveRoom(inModal){
 if(!onlineAuth()||!onlineIsMaster()){onlineWarn('ROOM_MASTER_REQUIRED');return false}
 try{
  var draft=inModal&&roomModalDraft?
    {...roomModalDraft,name:document.getElementById('roomModalName').value.trim().slice(0,32)}:roomFormData();
  if(!draft||draft.mode!==roomCurrent.mode)throw Error('ROOM_MODE_IMMUTABLE');
  var updated=await onlineApi.updateRoom(roomCurrent.id,onlineRoomUpdateBody(draft));
  var room=onlineAdoptRoom(updated);
  if(inModal)roomModalHide(false);
  onlineLiveRoomDecorate(room);roomLiveLog('SERVER SETTINGS SAVED');return true;
 }catch(error){onlineWarn(error);if(inModal)roomText('roomModalError',error.code||error.message||'SAVE FAILED');return false;}
}
async function onlineSwitchTeam(team){
 if(!onlineAuth()||!roomCurrent||team===roomSide)return;
 try{await onlineApi.switchTeam(roomCurrent.id,team);
  var room=await onlineApi.getRoom(roomCurrent.id);
  onlineLiveRoomDecorate(onlineAdoptRoom(room));
  roomLiveLog('You joined '+(team?'Terrorist':'Police')+' team');
 }catch(error){onlineWarn(error)}
}
async function onlineLeaveRoom(){
 if(!onlineAuth()||!roomCurrent)return;
 try{
  if(onlineActive){await onlineApi.abandonRoom(roomCurrent.id);}
  else await onlineApi.leaveRoom(roomCurrent.id);
  onlineResetLive();roomCurrent=null;roomList=[];roomEditState(null);
  roomLobbyOpen();
 }catch(error){onlineWarn(error)}
}
function onlineStartRoomPoll() {
 clearInterval(onlineRoomTimer);
 if(!roomCurrent)return;
 var id=roomCurrent.id;
 onlineRoomTimer=setInterval(async function(){
  if(!roomCurrent||roomCurrent.id!==id||onlineActive)return;
  try{
   var next=await onlineApi.getRoom(id);
   var normalized=onlineAdoptRoom(next);
   if(next.status==='ACTIVE'){
    clearInterval(onlineRoomTimer);
    await onlineAttachMatch(normalized);
   }else if(next.status==='OPEN'&&document.getElementById('lbroomlive').classList.contains('on')){
    onlineLiveRoomDecorate(normalized);
   }
  }catch(error){if(error.status===404){clearInterval(onlineRoomTimer);roomCurrent=null;roomLobbyOpen();}}
 },2300);
}
function onlineResetLive(){
 onlineActive=false;onlineTraining=false;onlineCurrentId=null;onlineMatchId=null;
 onlineWorld=null;onlineGame=null;
 for(const item of onlineActors.values()){if(item.model?.g)S.remove(item.model.g)}
 onlineActors.clear();onlineMeId=null;onlineSeq=0;onlineSendAt=0;onlineVisualLoaded=false;
 onlineAimInitialized=false;onlineTrainingProgressValue=null;onlinePrevAlive=true;
 onlineSelfTarget=null;onlineLastWinner=undefined;onlineMuzzleTime=0;onlineScoreboard.clear();
 onlineApi?.closeLive();clearInterval(onlineRoomTimer);clearTimeout(onlineReconnectTimer);
 onlineReconnecting=false;onlineReconnectStarted=0;
}
async function onlineAttachMatch(room){
 if(!onlineAuth()||onlineActive)return;
 try{
  var current=onlineAdoptRoom(room);
  await onlineApi.openLive('room',current.id,onlineReceiveFrame,onlineSocketStatus);
  onlineCurrentId=current.id;onlineTraining=false;onlineActive=true;onlineVisualLoaded=false;
  onlineBeginTransition(current);
 }catch(error){onlineResetLive();onlineWarn(error)}
}
async function onlineMasterStart(){
 if(!onlineAuth()||!onlineIsMaster()||onlineActive){onlineWarn('ROOM_MASTER_REQUIRED');return}
 document.getElementById('rmlStart').disabled=true;
 try{
  if(!await onlineSaveRoom(false))return;
  var started=await onlineApi.startRoom(roomCurrent.id);
  onlineMatchId=started.matchId;
  await onlineAttachMatch(roomCurrent);
 }catch(error){onlineWarn(error)}
 finally{document.getElementById('rmlStart').disabled=false}
}
function onlineBeginTransition(room){
 var flow=roomStartFlow;
 roomMatchConfig={...room};
 selectedTdmMapId=tdmMapId(room.mapId);selectedBombMapId=bombMapId(room.mapId);
 selM=room.mode;selectedGameMode=room.mode;
 modePreviewSelect(selM);
 if(flow.active)roomStartAbort();
 flow.active=true;flow.phase='countdown';flow.token++;
 flow.team=roomSide;flow.config={...room};
 flow.deadline=performance.now()+ROOM_START_COUNTDOWN*1000;
 document.getElementById('roomPrestartNumber').textContent=String(ROOM_START_COUNTDOWN);
 document.getElementById('roomPrestart').hidden=false;
 var token=flow.token;
 flow.raf=requestAnimationFrame(function(now){roomStartCountdown(now,token)});
}
function onlineUserId(){
 return onlineTraining?onlineMeId:onlineApi?.state().player?.id;
}
function onlineReceiveFrame(frame){
 if(frame.type==='lobby_snapshot'){
  if(roomCurrent&&frame.roomId===roomCurrent.id)void onlineApi.getRoom(roomCurrent.id)
   .then(r=>onlineLiveRoomDecorate(onlineAdoptRoom(r))).catch(onlineWarn);
  return;
 }
 if(frame.type==='match_ready'||frame.type==='training_ready'||
    frame.type==='match_snapshot'||frame.type==='training_snapshot'){
  if(frame.world&&typeof frame.world.serverTick==='number'){
   onlineWorld=frame.world;onlineGame=frame.game;
   if(!onlineMeId){onlineMeId=onlineTraining?
     frame.world.actors.find(a=>!a.bot)?.id:onlineApi?.state().player?.id;}
   if(onlineActive&&run&&!lob)onlineApplyWorld();
  }
  if(frame.progress)onlineTrainingProgress(frame.progress);
  return;
 }
 if(frame.type==='match_event'){
  var event=frame.event;
  if(event?.kind==='MATCH_END')onlineLastWinner=event.winner;
  if(event?.kind==='KILL'&&onlineActive){var actor=onlineActors.get(event.actorId)?.label||'PLAYER';
   var victim=onlineActors.get(event.victimId)?.label||'PLAYER';
   roomLiveLog(actor+' ELIMINATED '+victim);}
  return;
 }
 if(frame.type==='match_completed'){
  var result=frame.game,matchId=frame.matchId,winner=onlineLastWinner,mode=roomCurrent?.mode??selM;
  mt.over=true;onlineGame=result;onlineResetLive();
  matchExitToLobby('list');
  onlineShowMatchReport(result,matchId,winner,mode);
  return;
 }
 if(frame.type==='training_result'){
  onlineTrainingProgress(frame.progress);
  if(frame.progress?.status==='COMPLETED'){void onlineTrainingCompleted();return;}
  if(frame.progress?.status==='TIMEOUT_POLICY_PENDING'){
   onlineResetLive();run=false;lob=true;lb.style.display='flex';document.body.classList.add('lobby');
   lobP('lbs');onlineWarn('TRAINING_TIME_EXPIRED_NOT_ELIGIBLE');
  }
 }
}
function onlineSocketStatus(info){
 if(info.code===1000||!onlineActive||onlineReconnecting)return;
 // Server retains the player for 60 seconds. Never fall back to client hit simulation.
 onlineReconnecting=true;onlineReconnectStarted=Date.now();run=false;
 onlineWarn('RECONNECTING TO MATCH SERVER');
 onlineReconnectTimer=setTimeout(onlineRetry,1000);
}
async function onlineRetry(){
 if(!onlineReconnecting||!onlineActive)return;
 if(Date.now()-onlineReconnectStarted>55000){
  onlineResetLive();matchExitToLobby('list');onlineWarn('RECONNECT_WINDOW_EXPIRED');return;
 }
 try{
  var kind=onlineTraining?'training':'room';
  await onlineApi.openLive(kind,onlineTraining?null:onlineCurrentId,onlineReceiveFrame,onlineSocketStatus);
  onlineReconnecting=false;clearTimeout(onlineReconnectTimer);
  run=true;mt.over=false;onlineApplyWorld();
 }catch(error){
  if(!onlineReconnecting)return;
  onlineReconnectTimer=setTimeout(onlineRetry,2500);
 }
}
function onlineTrainingProgress(progress){
 if(!progress)return;
 onlineTrainingProgressValue=progress;
 var text='TRAINING '+progress.combinedKills+' / '+progress.targetKills;
 var element=document.getElementById('rsp');
 if(element&&onlineTraining)element.textContent=text;
}
function onlineDialog(title,description,action,submit) {
 var existing=document.getElementById('pointblockOnlineDialog');if(existing)existing.remove();
 var overlay=document.createElement('div');overlay.id='pointblockOnlineDialog';overlay.className='point-online-dialog';
 var form=document.createElement('form');form.className='point-online-dialog-panel';
 var h=document.createElement('h2');h.textContent=title;
 var p=document.createElement('p');p.textContent=description;
 var input=document.createElement('input');input.required=true;input.maxLength=12;input.minLength=1;
 input.pattern='[A-Za-z0-9_]+';input.placeholder='USERNAME';input.autocomplete='off';
 var error=document.createElement('div');error.setAttribute('role','status');
 var button=document.createElement('button');button.type='submit';button.textContent=action;
 form.append(h,p,input,error,button);overlay.append(form);document.body.append(overlay);
 form.addEventListener('submit',async e=>{
  e.preventDefault();button.disabled=true;error.textContent='';
  try{await submit(input.value);overlay.remove()}catch(err){error.textContent=err.code||err.message||'REQUEST FAILED'}
  finally{button.disabled=false}
 });
 input.focus();
}
async function onlineTrainingCompleted(){
 if(!onlineTraining)return;
 onlineResetLive();run=false;lob=true;lb.style.display='flex';document.body.classList.add('lobby');
 lobP('lbs');
 try{await onlineApi.refreshProfile()}catch(e){onlineWarn(e)}
 onlineDialog('TRAINING COMPLETE','Enter a unique PointBlock callsign (1–12 letters, numbers or underscore).','REGISTER',async name=>{
  await onlineApi.register(name);
  await onlineApi.refreshProfile();
  await onlineLoadInventory();roomLobbyOpen();
 });
}
async function onlineStartTraining(){
 if(!onlineAuth())return;
 try{
  var started=await onlineApi.startTraining();
  if(started.status==='COMPLETED'){
   onlineDialog('REGISTER CALLSIGN','Training verified. Choose a unique username.','REGISTER',async name=>{
    await onlineApi.register(name);await onlineApi.refreshProfile();
    await onlineLoadInventory();roomLobbyOpen();
   });return;
  }
  onlineTraining=true;onlineActive=true;
  await onlineApi.openLive('training',null,onlineReceiveFrame,onlineSocketStatus);
  onlineMeId=onlineWorld?.actors?.find(a=>!a.bot)?.id||null;
  roomMatchConfig={mode:0,mapId:'block-district',kills:10,minutes:5,rounds:12,roundMinutes:2};
  selM=0;selectedTdmMapId='block-district';modePreviewSelect(0);
  begin(0);onlineApplyWorld();
 }catch(error){onlineResetLive();onlineWarn(error)}
}
async function onlineStartGate(){
 if(!onlineAuth())return;
 try{
  var info=await onlineApi.refreshProfile();
  if(info.registered){await onlineLoadInventory();roomLobbyOpen();return}
  if(info.onboarding?.trainingCompleted){
   onlineDialog('REGISTER CALLSIGN','Training verified. Choose your player name.','REGISTER',async name=>{
    await onlineApi.register(name);await onlineApi.refreshProfile();
    await onlineLoadInventory();roomLobbyOpen();
   });
  }else await onlineStartTraining();
 }catch(error){onlineWarn(error)}
}
// Called after the original begin() constructs local visual actors, never local simulation.
function onlineApplyWorld(){
 var world=onlineWorld,game=onlineGame;
 if(!onlineActive||!world||!game||!run||lob)return;
 if(world.matchId!==onlineMatchId&&onlineMatchId&&!onlineTraining)return;
 if(!onlineVisualLoaded){
  en.forEach(function(b){if(b?.g)S.remove(b.g)});en.length=0;
  ROS=pl.st?[pl.st]:[];onlineActors.clear();onlineScoreboard.clear();onlineVisualLoaded=true;
 }
 var selfId=onlineUserId();
 var self=world.actors.find(a=>a.id===selfId);
 // Spectator snapshots remain recipient-bound; hidden enemies are never created.
 if(self){
  pl.tm=self.team;
  if(!onlineSelfTarget||Math.hypot(self.x-pl.x,self.z-pl.z)>12||!onlinePrevAlive&&self.alive){
   pl.x=self.x;pl.y=self.y;pl.z=self.z;
  }
  onlineSelfTarget={x:self.x,y:self.y,z:self.z};
  pl.dead=!self.alive;
  var privateState=world.privateState;
  pl.hp=privateState?.hp??self.hp??pl.hp;
  pl.vest=privateState?.vest??self.vest??pl.vest;
  if(typeof privateState?.helmet==='boolean')pl.helm=privateState.helmet;
  else if(typeof self.helmet==='boolean')pl.helm=self.helmet;
  if(Number.isInteger(privateState?.ammo?.magazine))pl.mag=privateState.ammo.magazine;
  if(Number.isInteger(privateState?.ammo?.reserve))pl.res=privateState.ammo.reserve;
  if(pl.st&&privateState){pl.st.k=privateState.kills;pl.st.d=privateState.deaths;}
  if(self.weaponId>=0&&self.weaponId<WP.length)pl.w=self.weaponId;
  if(self.alive&&(!onlineAimInitialized||!onlinePrevAlive)){
   pl.face=self.yaw;onlineAimInitialized=true;
  }
  onlinePrevAlive=self.alive;
 }
 if(Array.isArray(game.teamKills)){ts[0]=game.teamKills[0];ts[1]=game.teamKills[1]}
 mt.t=Number.isFinite(game.remaining)?Math.max(0,game.remaining):mt.t;
 mt.cd=0;mt.over=game.status==='COMPLETED';
 var visible=new Set();
 world.actors.forEach(function(actor){
  if(!actor||actor.id===selfId||!Number.isFinite(actor.x)||!Number.isFinite(actor.z))return;
  visible.add(actor.id);
  var current=onlineActors.get(actor.id);
  if(!current){
   var index=[...onlineActors.values()].filter(e=>e.tm===actor.team).length%5;
   var model=newBot(actor.team,index);
   model.id=actor.id;model.bot=!!actor.bot;
   model.name=actor.bot?model.name:roomCurrent?.members?.find(m=>m.playerId===actor.id)?.username||'PLAYER';
   if(!actor.bot)onlineLabelActor(model,model.name);
   model.st=onlineScoreboard.get(actor.id)||{name:model.name,tm:actor.team,k:0,d:0};
   placeBot(model);
   onlineActors.set(actor.id,{model,label:model.name,tm:actor.team});
   current=onlineActors.get(actor.id);
  }
  var bot=current.model;
  bot.x=actor.x;bot.y=actor.y;bot.z=actor.z;
  bot.dead=!actor.alive;
  if(!current.target){bot.g.position.set(actor.x,actor.y,actor.z)}
  current.target={x:actor.x,y:actor.y,z:actor.z,yaw:actor.yaw};bot.weapon=actor.weaponId;bot.primary=actor.weaponId;
  bot.g.rotation.y=actor.yaw;
  bot.g.visible=!!actor.alive;
  if(bot.nm)bot.nm.visible=actor.team===pl.tm&&actor.alive;
 });
 // Server redacts hidden enemies. Drop the old visual AND its last known coordinates
 // from the local actor pool; the browser must not keep a phantom radar target.
 for(const [id,current] of onlineActors){
  if(!visible.has(id)){
   if(current.model?.g)S.remove(current.model.g);
   var index=en.indexOf(current.model);
   if(index>=0)en.splice(index,1);
   onlineActors.delete(id);
  }
 }
 if(Array.isArray(game.scoreboard)){
  var entries=[];
  game.scoreboard.forEach(function(row){
   if(!row||typeof row.id!=='string'||!Number.isSafeInteger(row.kills)||!Number.isSafeInteger(row.deaths))return;
   var entry=row.id===selfId?pl.st:onlineScoreboard.get(row.id);
   if(!entry){
    var human=roomCurrent?.members?.find(function(m){return m.playerId===row.id});
    entry={name:human?.username||'BOT',tm:row.team,k:0,d:0};
   }
   entry.tm=row.team;entry.k=row.kills;entry.d=row.deaths;
   onlineScoreboard.set(row.id,entry);entries.push(entry);
   var model=onlineActors.get(row.id)?.model;
   if(model)model.st=entry;
  });
  ROS=entries;
 }
 if(bombMatch&&world.bomb&&game.bombState){
  bombMatch.state=game.bombState;
  bombMatch.roundWins=Array.isArray(game.rounds)?game.rounds:bombMatch.roundWins;
  if(Array.isArray(game.rounds))bombMatch.round=1+game.rounds[0]+game.rounds[1];
  bombMatch.dropped=world.bomb.visibility==='TERRORISTS_ONLY'&&pl.tm===1?world.bomb.position:null;
  bombMatch.carrier=pl.tm===1&&world.bomb.carrierId===selfId?pl:
   pl.tm===1?onlineActors.get(world.bomb.carrierId)?.model||null:null;
  var action=world.privateState?.bombAction;
  pl.bAction=action&&['plant','defuse'].includes(action.kind)&&
   Number.isFinite(action.progress)&&Number.isFinite(action.required)&&action.required>0?
   {type:action.kind,t:Math.min(action.progress,action.required),site:bombMatch.site}:null;
  if(world.bomb.visibility==='PUBLIC_PLANTED'&&world.bomb.position&&BOMB_SITES.length){
   var nearest=BOMB_SITES.map(function(q,index){return{index:index,d:Math.hypot(q.x-world.bomb.position.x,q.z-world.bomb.position.z)};})
     .sort(function(x,y){return x.d-y.d})[0];
   if(nearest)bombMatch.site=nearest.index;
  }
  if(world.bomb.visibility==='PUBLIC_PLANTED'&&world.bomb.position&&bombMatch.device){
   bombMatch.device.position.set(world.bomb.position.x,0,world.bomb.position.z);
   bombMatch.device.visible=true;
  }else if(bombMatch.device)bombMatch.device.visible=false;
 }
 if(typeof tmUpd==='function')tmUpd();
}
// Real player display names only; the original BOT badge is never shown on a human.
function onlineLabelActor(model,name){
 if(!model?.nm||typeof name!=='string')return;
 var label=name.slice(0,12).toUpperCase(),canvas=document.createElement('canvas');
 canvas.width=256;canvas.height=64;
 var ctx=canvas.getContext('2d');if(!ctx)return;
 ctx.font='700 40px Rajdhani,"Trebuchet MS",sans-serif';
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=7;
 ctx.strokeStyle='rgba(0,0,0,.85)';ctx.strokeText(label,128,34);
 ctx.fillStyle=model.tm===1?'#ff8a65':'#74c0fc';ctx.fillText(label,128,34);
 var old=model.nm.material.map;model.nm.material.map=new T.CanvasTexture(canvas);
 model.nm.material.needsUpdate=true;
 if(old&&typeof old.dispose==='function')old.dispose();
}
function onlineShowMatchReport(game,matchId,winner,mode){
 if(!game)return;
 var old=document.getElementById('pointblockMatchReport');if(old)old.remove();
 var overlay=document.createElement('div');overlay.id='pointblockMatchReport';overlay.className='point-online-dialog';
 var panel=document.createElement('section');panel.className='point-online-dialog-panel';
 var heading=document.createElement('h2');heading.textContent='SERVER-VERIFIED MATCH RESULT';
 var own=roomSide===1?1:0,score=game.teamKills||[0,0];
 if(Array.isArray(game.rounds)&&mode===1)score=game.rounds;
 var summary=document.createElement('p');
 summary.textContent='POLICE '+score[0]+' — '+score[1]+' TERRORISTS';
 var verdict=document.createElement('p');
 verdict.textContent=winner===null?'DRAW':winner===own?'VICTORY':winner===1-own?'DEFEAT':'MATCH COMPLETE';
 var reward=document.createElement('p');reward.textContent='Reward verification pending';
 var button=document.createElement('button');button.type='button';button.textContent='BACK TO LOBBY';
 button.onclick=function(){overlay.remove();roomLobbyOpen()};
 panel.append(heading,summary,verdict,reward,button);overlay.append(panel);document.body.append(overlay);
 if(matchId&&onlineApi?.state().authenticated){
  onlineApi.award(matchId).then(function(value){
   function halfUnits(input){var n=BigInt(input);return (n/2n).toString()+(n%2n?'.5':'');}
   reward.textContent='EXP +'+halfUnits(value.awardedExpHalf)+
    ' · vPBT +'+halfUnits(value.awardedVpbtHalf);
  }).catch(function(error){reward.textContent='Reward pending server verification ('+(error.code||'NOT_AVAILABLE')+')'});
 }
}
function onlineVisualUpdate(dt){
 if(!onlineActive||!run||lob)return;
 tt+=dt;
 var x=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+ST.l.x,
     z=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0)+ST.l.y,
     length=Math.hypot(x,z);
 if(length>1){x/=length;z/=length;}
 var moving=!pl.dead&&length>.1;
 mvAmt+=((moving?1:0)-mvAmt)*Math.min(1,dt*8);
 wtT+=((moving?1:0)-wtT)*Math.min(1,dt*5);
 bobP+=dt*9*(moving?1:0);
 var ads=!pl.dead&&(mouse.right||scopeOn)&&canAds(pl.w);
 adsT+=((ads?1:0)-adsT)*Math.min(1,dt*12);
 sprT+=((keys.ShiftLeft||keys.ShiftRight?1:0)-sprT)*Math.min(1,dt*9);
 pl.face-=ST.r.x*2.4*dt;pl.pitch=Math.max(-1.2,Math.min(1.2,pl.pitch-ST.r.y*1.6*dt));
 var wantsFire=!pl.dead&&(!!keys.KeyF||fireHeld||
   (mouse.down&&document.pointerLockElement===R.domElement));
 if(wantsFire&&pl.mag>0&&performance.now()-onlineMuzzleTime>Math.max(75,(WP[pl.w]?.cd||.14)*1000)){
  // Local VFX only: damage, ammo consumption and shot outcomes remain server-only.
  onlineMuzzleTime=performance.now();
  flashT=.035;kick=Math.min(.13,kick+.018);
 }
 if(!pl.dead&&performance.now()-onlineSendAt>=50&&onlineApi?.live){
  onlineSendAt=performance.now();
  onlineApi.live.send({type:'input',frame:{
   seq:++onlineSeq,moveX:x,moveZ:z,yaw:pl.face,pitch:pl.pitch,
   sprint:!!(keys.ShiftLeft||keys.ShiftRight),ads:!!ads,
   fire:wantsFire,
   reload:!!keys.KeyR,jump:!!(keys.Space||jumpHeld),crouch:!!(keys.ControlLeft||keys.ControlRight),
   interact:!!(keys.KeyE||bombHold),weaponId:pl.w,
  }});
 }
 onlineApplyWorld();
 if(onlineSelfTarget){
  var followRate=Math.min(1,dt*17);
  pl.x+=(onlineSelfTarget.x-pl.x)*followRate;
  pl.y+=(onlineSelfTarget.y-pl.y)*followRate;
  pl.z+=(onlineSelfTarget.z-pl.z)*followRate;
 }
 // Interpolate visual meshes between 10 Hz server snapshots. Never feed client
 // interpolation back into physics, collision, damage or any reward calculation.
 onlineActors.forEach(function(actor){
  if(!actor.model?.g||!actor.target||!actor.model.g.visible)return;
  var p=actor.model.g.position,t=actor.target,alpha=Math.min(1,dt*13);
  p.x+=(t.x-p.x)*alpha;p.y+=(t.y-p.y)*alpha;p.z+=(t.z-p.z)*alpha;
 });
 if(typeof hud==='function')hud();
 if(typeof hdUpd==='function')hdUpd(dt);
 if(onlineTraining&&onlineTrainingProgressValue)onlineTrainingProgress(onlineTrainingProgressValue);
 if(isBombMode()&&bombMatch&&typeof bombHudUpdate==='function')bombHudUpdate();
}
var oldOnlineRoomRender=roomRender,oldOnlineRoomLobbyOpen=roomLobbyOpen;
roomRender=onlineRoomRender;
roomLoad=function(){roomList=[]};
roomPersist=function(){return false};
roomLiveTeams=onlineRoomTeams;
roomLobbyOpen=function(){
 oldOnlineRoomLobbyOpen();
 if(onlineApi?.state().registered)void onlineRefreshRooms();
};
var onlineWasAuthenticated=onlineApi?.state().authenticated===true;
if(onlineApi)onlineApi.setOnChange(function(state){
 homeWalletRender();
 var wasLogout=onlineWasAuthenticated&&!state.authenticated;
 onlineWasAuthenticated=state.authenticated;
 if(wasLogout){onlineResetLive();roomList=[];roomCurrent=null;onlineRoomRender()}
});
function onlineAction(id,fn) {
 var el=document.getElementById(id);if(!el)return;
 el.addEventListener('click',function(e){
  e.preventDefault();e.stopImmediatePropagation();void fn();
 },true);
}
onlineAction('lbst',onlineStartGate);
onlineAction('mdm',onlineStartGate);
onlineAction('tsP',onlineStartGate);
onlineAction('tsT',onlineStartGate);
onlineAction('dgo',()=>{onlineResetLive();matchExitToLobby('list')});
onlineAction('go',onlineStartGate);
onlineAction('escConfirmYes',async()=>{
 if(onlineActive&&!onlineTraining&&roomCurrent){
  try{await onlineApi.abandonRoom(roomCurrent.id)}
  catch(error){onlineWarn(error);return}
 }
 // Training abandonment policy is intentionally not guessed; closing the
 // socket never creates or refunds progression in the browser.
 onlineResetLive();matchExitToLobby('list');
});
onlineAction('roomCreate',onlineCreateRoom);
onlineAction('roomRefresh',onlineRefreshRooms);
onlineAction('roomSave',()=>onlineSaveRoom(false));
onlineAction('roomModalSave',()=>onlineSaveRoom(true));
onlineAction('roomClose',onlineLeaveRoom);
onlineAction('rmlLeave',onlineLeaveRoom);
onlineAction('roomStart',onlineMasterStart);
onlineAction('rmlStart',onlineMasterStart);
onlineAction('roomBack',()=>{if(roomCurrent)onlineLiveRoomDecorate(roomCurrent);else lobP('lbs')});
onlineAction('rmlSettings',()=>{if(onlineIsMaster())roomShowSettings();});
addEventListener('pagehide',()=>{onlineApi?.closeLive();clearInterval(onlineRoomTimer)});
