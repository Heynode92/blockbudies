// Room Lobby: browser-local room master flow; no network rooms or invented pings.
// Uses existing mode maps, 5v5 bots, and canonical combat/plant/defuse systems.
var ROOM_STORAGE_KEY="bbfps_local_rooms_v1";
var ROOM_LIMITS=Object.freeze({kills:[20,30,50,75,100],minutes:[1,3,5,10,15],rounds:[3,5,7,9,12],roundMinutes:[1,2,3,4]});
var roomList=[],roomCurrent=null,roomMatchConfig=null,roomDraftMode=0,roomDraftMapId="block-district";

/* Team slots preview the real 5v5 roster. AI is created by startMatch, never here. */
var ROOM_START_COUNTDOWN=3,roomSide=0,roomSeat=0,roomLog=[];
var roomStartFlow={active:false,phase:"idle",token:0,raf:0,timer:0,deadline:0,config:null,team:0,mapReady:false,loadoutSeconds:0};
function roomLiveLog(message){
 roomLog.push(String(message));if(roomLog.length>12)roomLog.shift();
 var root=document.getElementById("rmlLogLines");root.replaceChildren();
 roomLog.forEach(function(entry){var row=document.createElement("div");row.className="rml-log-line";row.textContent=entry;root.appendChild(row);});
 root.scrollTop=root.scrollHeight;
}
function roomLiveTeams(){
 var size=BOMB_RULES.teamSize;
 for(var side=0;side<2;side++){
  var target=document.getElementById(side===0?"rmlPoliceSlots":"rmlTerrorSlots");target.replaceChildren();
  roomText(side===0?"rmlPoliceCount":"rmlTerrorCount",size+" / "+size+" ON START");
  for(var slot=0;slot<size;slot++){
   (function(team,seat){
    var own=team===roomSide&&seat===roomSeat,idx=team===roomSide?(seat<roomSeat?seat:seat-1):seat;
    var bot=BN[team]&&BN[team][idx],row=document.createElement("button");row.type="button";
    row.className="rml-slot"+(own?" is-you":"");row.setAttribute("aria-pressed",String(own));
    var num=document.createElement("span");num.className="rml-slot-index";num.textContent=String(seat+1);
    var name=document.createElement("span");name.className="rml-slot-name";name.textContent=own?"YOU · ROOM MASTER":bot?"BOT "+bot:"BOT ON START";
    var hint=document.createElement("em");hint.textContent=own?"SELECTED":"ON START";
    row.appendChild(num);row.appendChild(name);row.appendChild(hint);
    row.addEventListener("click",function(){
     if(!roomCurrent||roomSide===team&&roomSeat===seat)return;
     roomSide=team;roomSeat=seat;roomLiveTeams();inventoryRoomPreviewOpen(roomSide);
     roomLiveLog("You moved to "+(team===0?"Police":"Terrorists")+" slot "+(seat+1)+".");
    });
    target.appendChild(row);
   })(side,slot);
  }
 }
}
function roomLiveOpen(room){
 if(!room)return;
 roomEditState(room);
 var map=roomMapsForMode(room.mode,room.mapId);
 roomText("rmlBotSummary","1 PLAYER + "+(BOMB_RULES.teamSize*2-1)+" BOTS ON START");
 roomText("rmlRoomName",room.name);roomText("rmlMapName",map?map.name:"UNAVAILABLE");roomText("rmlMapCaption",map?map.caption:"");
 roomText("rmlGameMode",room.mode===1?"BOMB MODE":"TEAM DEATH MATCH");
 roomText("rmlGoalLabel",room.mode===1?"MAX ROUNDS":"KILL LIMIT");
 roomText("rmlGoal",room.mode===1?room.rounds+" ROUNDS":room.kills+" KILLS");
 roomText("rmlTimeLabel",room.mode===1?"ROUND TIME":"MATCH TIME");
 roomText("rmlTime",(room.mode===1?room.roundMinutes:room.minutes)+" MINUTES");
 roomLiveTeams();lobP("lbroomlive");
 // Inventory owns the soldier, real mkGun models, equipped weapon and 3D renderer.
 inventoryRoomPreviewOpen(roomSide);
}

// In-room settings have their own unsaved draft; the room browser stays untouched.
var roomModalDraft=null,roomModalReturnFocus=null;
function roomModalActive(){return !document.getElementById("roomSettingsModal").hidden;}
// Populate from the same authoritative limits as Create Room; no duplicated values.
function roomModalPopulateOptions(){
 [["kills"," KILLS"],["minutes"," MINUTES"],["rounds"," ROUNDS"],["roundMinutes"," MINUTES"]].forEach(function(entry){
  var key=entry[0],select=document.getElementById("roomModal"+key.charAt(0).toUpperCase()+key.slice(1));
  select.replaceChildren();
  ROOM_LIMITS[key].forEach(function(value){
   var option=document.createElement("option");option.value=String(value);
   option.textContent=value+entry[1];select.appendChild(option);
  });
 });
}
function roomModalPaint(){
 if(!roomModalDraft)return;
 var mode=roomModalDraft.mode;
 ["roomModalTdm","roomModalBomb"].forEach(function(id,index){
  var button=document.getElementById(id),active=index===mode;
  button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));
 });
 document.getElementById("roomModalTdmGroup").hidden=mode!==0;
 document.getElementById("roomModalBombGroup").hidden=mode!==1;
 ["kills","minutes","rounds","roundMinutes"].forEach(function(key){
  document.getElementById("roomModal"+key.charAt(0).toUpperCase()+key.slice(1)).value=String(roomModalDraft[key]);
 });
 var map=roomMapsForMode(mode,roomModalDraft.mapId);
 var select=document.getElementById("roomModalMap");
 roomFillMapSelect(select,mode,roomModalDraft.mapId);
 roomText("roomModalMapName",map?map.name:"UNAVAILABLE");
 roomText("roomModalMapCaption",map?map.caption:"");
}
function roomModalChooseMode(mode){
 if(!roomModalDraft)return;
 roomModalDraft.mode=mode===1?1:0;
 roomModalDraft.mapId=mode===1?bombMapId(roomModalDraft.mapId):tdmMapId(roomModalDraft.mapId);
 roomModalPaint();
 // Only the 3D preview changes until SAVE; roomCurrent remains unchanged.
 selM=roomModalDraft.mode;selectedBombMapId=bombMapId(roomModalDraft.mapId);selectedTdmMapId=tdmMapId(roomModalDraft.mapId);modePreviewSelect(selM);
}
function roomModalChooseMap(value){
 if(!roomModalDraft)return;
 roomModalDraft.mapId=roomModalDraft.mode===1?bombMapId(value):tdmMapId(value);
 roomModalPaint();
 selM=roomModalDraft.mode;selectedBombMapId=bombMapId(roomModalDraft.mapId);modePreviewSelect(selM);
}
function roomModalSelect(key,value){
 if(!roomModalDraft||ROOM_LIMITS[key]===undefined)return;
 // A forged DOM value cannot bypass the same whitelist used by roomNormalize.
 roomModalDraft[key]=roomAllowed(value,ROOM_LIMITS[key],roomModalDraft[key]);
 roomModalPaint();
}
function roomModalHide(restorePreview){
 if(!roomModalActive())return;
 document.getElementById("roomSettingsModal").hidden=true;
 roomModalDraft=null;
 roomText("roomModalError","");
 if(restorePreview&&roomCurrent){
  selM=roomCurrent.mode;selectedBombMapId=bombMapId(roomCurrent.mapId);selectedTdmMapId=tdmMapId(roomCurrent.mapId);modePreviewSelect(selM);
 }
 var focus=roomModalReturnFocus;roomModalReturnFocus=null;
 if(focus&&typeof focus.focus==="function")focus.focus();
}
function roomShowSettings(){
 if(!roomCurrent||roomStartFlow.active||roomModalActive())return;
 roomModalReturnFocus=document.activeElement||document.getElementById("rmlSettings");
 roomModalDraft=Object.assign({},roomCurrent);
 roomModalPopulateOptions();
 document.getElementById("roomModalName").value=roomCurrent.name;
 roomText("roomModalError","");
 roomModalPaint();
 document.getElementById("roomSettingsModal").hidden=false;
 // The lobby map frame fills the thumbnail immediately; next render updates the live map.
 var source=document.getElementById("rmlMapPreview"),dest=document.getElementById("roomModalMapPreview");
 try{dest.getContext("2d",{alpha:false}).drawImage(source,0,0,dest.width,dest.height);}catch(err){}
 if(typeof document.getElementById("roomModalName").focus==="function")document.getElementById("roomModalName").focus();
}
function roomModalSave(){
 if(!roomCurrent||!roomModalDraft)return;
 var draft=Object.assign({},roomModalDraft,{name:document.getElementById("roomModalName").value.trim().slice(0,32)});
 if(!draft.name){roomText("roomModalError","Enter a room name before saving.");return;}
 var saved=roomSaveDraft(draft);
 if(!saved){roomText("roomModalError","Could not save these room settings.");return;}
 roomModalHide(false);roomLiveLog("Room settings updated.");roomLiveOpen(saved);
}

function roomLeaveLive(){roomCloseLocal();lobP("lbrooms");}

function roomAllowed(value,list,fallback){var n=Number(value);return list.indexOf(n)>=0?n:fallback;}
function roomNormalize(obj){
 if(!obj||typeof obj!=="object"||typeof obj.id!=="string"||!/^[0-9]{8,20}$/.test(obj.id))return null;
 if(obj.mode!==0&&obj.mode!==1)return null;
 var name=String(obj.name||"").trim().slice(0,32);
 if(!name)return null;
 return{id:obj.id,name:name,mode:obj.mode,
 mapId:obj.mode===1?bombMapId(obj.mapId):tdmMapId(obj.mapId),
 kills:roomAllowed(obj.kills,ROOM_LIMITS.kills,50),
 minutes:roomAllowed(obj.minutes,ROOM_LIMITS.minutes,10),
 rounds:roomAllowed(obj.rounds,ROOM_LIMITS.rounds,12),
 roundMinutes:roomAllowed(obj.roundMinutes,ROOM_LIMITS.roundMinutes,2)};
}
function roomLoad(){
 var data=[];try{data=JSON.parse(localStorage.getItem(ROOM_STORAGE_KEY)||"[]");}catch(err){}
 roomList=Array.isArray(data)?data.slice(0,40).map(roomNormalize).filter(Boolean):[];
}
function roomPersist(){try{localStorage.setItem(ROOM_STORAGE_KEY,JSON.stringify(roomList));return true;}catch(err){return false;}}
function roomMapsForMode(mode,mapId){
 var m=mode===1?bombMapInfo(mapId):mode===0?tdmMapInfo(mapId):MODE_MAP_PREVIEWS[mode];
 return m?{name:m.name,caption:m.caption}:null;
}
function roomFillMapSelect(select,mode,mapId){
 select.replaceChildren();
 var options=mode===1?bombMapOptions(mode):tdmMapOptions();
 options.forEach(function(m){
  var option=document.createElement("option");option.value=m.id;option.textContent=m.name;
  select.appendChild(option);
 });
 select.value=mode===1?bombMapId(mapId):tdmMapId(mapId);
 select.disabled=options.length<2;
}
function roomText(id,value){document.getElementById(id).textContent=String(value);}
function roomModeSelect(mode){
 roomDraftMode=mode===1?1:0;
 ["roomTdm","roomBomb"].forEach(function(id,i){
  var active=i===roomDraftMode,btn=document.getElementById(id);
  btn.classList.toggle("active",active);btn.setAttribute("aria-pressed",String(active));
 });
 document.getElementById("roomTdmSettings").hidden=roomDraftMode!==0;
 document.getElementById("roomBombSettings").hidden=roomDraftMode!==1;
 roomDraftMapId=roomDraftMode===1?bombMapId(roomDraftMapId):tdmMapId(roomDraftMapId);
 var map=roomMapsForMode(roomDraftMode,roomDraftMapId),mapSelect=document.getElementById("roomMap");
 roomFillMapSelect(mapSelect,roomDraftMode,roomDraftMapId);
 roomText("roomMapName",map?map.name:"UNAVAILABLE");
 roomText("roomMapCaption",map?map.caption:"");
 selM=roomDraftMode;selectedBombMapId=bombMapId(roomDraftMapId);selectedTdmMapId=tdmMapId(roomDraftMapId);
 modePreviewSelect(roomDraftMode);
}
function roomChooseMap(value){
 roomDraftMapId=roomDraftMode===1?bombMapId(value):tdmMapId(value);
 roomModeSelect(roomDraftMode);
}
function roomFormData(){
 var name=document.getElementById("roomName").value.trim().slice(0,32);
 if(!name)return null;
 return{name:name,mode:roomDraftMode,mapId:roomDraftMode===1?bombMapId(document.getElementById("roomMap").value):tdmMapId(document.getElementById("roomMap").value),
  kills:roomAllowed(document.getElementById("roomKills").value,ROOM_LIMITS.kills,50),
  minutes:roomAllowed(document.getElementById("roomMinutes").value,ROOM_LIMITS.minutes,10),
  rounds:roomAllowed(document.getElementById("roomRounds").value,ROOM_LIMITS.rounds,12),
  roundMinutes:roomAllowed(document.getElementById("roomRoundMinutes").value,ROOM_LIMITS.roundMinutes,2)};
}
function roomRender(){
 var list=document.getElementById("roomEntries");list.replaceChildren();
 document.getElementById("roomEmpty").hidden=roomList.length>0;
 roomText("roomCount",roomList.length+" LOCAL ROOM"+(roomList.length===1?"":"S"));
 roomList.forEach(function(r){
  var row=document.createElement("div");row.className="room-entry";
  function cell(tag,text,className){var el=document.createElement(tag);el.textContent=text;if(className)el.className=className;row.appendChild(el);return el;}
  cell("span","#"+r.id.slice(-4));
  cell("strong",r.name);
  var map=document.createElement("div");map.className="rm-map";
  var mapTitle=document.createElement("span");mapTitle.textContent=(roomMapsForMode(r.mode,r.mapId)||{}).name||"UNKNOWN";
  var mode=document.createElement("small");mode.textContent=r.mode===1?"BOMB MODE":"TDM";
  map.appendChild(mapTitle);map.appendChild(mode);row.appendChild(map);
  cell("span","1 / 10");cell("span","WAITING","rm-status");
  var open=document.createElement("button");open.type="button";open.textContent="OPEN";open.addEventListener("click",function(){roomOpenSaved(r.id);});row.appendChild(open);
  list.appendChild(row);
 });
}
function roomSetMessage(message){roomText("roomMessage",message||"");}
function roomEditState(room){
 roomCurrent=room||null;
 var owned=!!room;
 document.getElementById("roomCreate").hidden=owned;
 document.getElementById("roomMasterActions").hidden=!owned;
 document.getElementById("roomMasterStatus").hidden=!owned;
 roomText("roomPanelTitle",owned?"ROOM SETTINGS":"CREATE ROOM");
 roomText("roomPanelSub",owned?"YOU ARE ROOM MASTER":"BECOME ROOM MASTER");
 if(owned){
  document.getElementById("roomName").value=room.name;
  document.getElementById("roomKills").value=String(room.kills);
  document.getElementById("roomMinutes").value=String(room.minutes);
  document.getElementById("roomRounds").value=String(room.rounds);
  document.getElementById("roomRoundMinutes").value=String(room.roundMinutes);
  roomDraftMapId=room.mapId;roomModeSelect(room.mode);
 }else roomModeSelect(roomDraftMode);
}
function roomOpenSaved(id){
 var match=roomList.find(function(r){return r.id===id;});
 if(!match){roomSetMessage("Room not found in this browser.");return;}
 roomSide=0;roomSeat=0;roomLog=[];roomLiveLog("Room opened. You are Room Master.");roomLiveOpen(match);roomSetMessage("Room ready.");
}
function roomCreateLocal(){
 var draft=roomFormData();if(!draft){roomSetMessage("Enter a room name before creating.");return;}
 if(roomList.length>=40){roomSetMessage("Maximum 40 saved local rooms. Close one first.");return;}
 var id=String(Date.now())+String(Math.floor(Math.random()*90000)+10000);
 var room=roomNormalize(Object.assign({id:id},draft));
 if(!room){roomSetMessage("Invalid room settings.");return;}
 roomList.unshift(room);roomPersist();roomRender();roomSide=0;roomSeat=0;roomLog=[];
 roomLiveLog("Room created. You are Room Master.");roomLiveOpen(room);
 roomSetMessage("Room created locally. You are the Room Master.");
}
function roomSaveDraft(draft){
 if(!roomCurrent||!draft||!String(draft.name||"").trim()){roomSetMessage("Room name cannot be empty.");return null;}
 var next=roomNormalize(Object.assign({},draft,{id:roomCurrent.id}));
 if(!next)return null;
 var i=roomList.findIndex(function(r){return r.id===roomCurrent.id;});
 if(i<0){roomSetMessage("Room no longer exists.");roomEditState(null);return null;}
 roomList[i]=next;roomCurrent=next;roomPersist();roomRender();
 roomSetMessage("Room settings saved.");return next;
}
function roomSaveLocal(){return roomSaveDraft(roomFormData());}
function roomCloseLocal(){
 roomModalHide(false);
 roomStartAbort();
 if(!roomCurrent)return;
 roomList=roomList.filter(function(r){return r.id!==roomCurrent.id;});roomPersist();roomRender();
 roomEditState(null);roomMatchConfig=null;roomLog=[];roomSetMessage("Local room closed.");
}

function roomStartMark(percent,label){
 document.getElementById("roomStartPercent").textContent=percent+"%";
 document.getElementById("roomStartBar").style.width=percent+"%";
 document.getElementById("roomStartPhase").textContent=label;
}
function roomStartAbort(){
 var flow=roomStartFlow;flow.token++;
 if(flow.raf)cancelAnimationFrame(flow.raf);
 if(flow.timer)clearTimeout(flow.timer);
 flow.raf=flow.timer=0;flow.active=false;flow.phase="idle";flow.config=null;flow.mapReady=false;flow.loadoutSeconds=0;
 document.getElementById("roomPrestart").hidden=true;
 var overlay=document.getElementById("roomTransition");
 overlay.classList.remove("on","leaving");overlay.hidden=true;
}
// Copy a *real* frame of the current 3D WebGL map, no fabricated loading image.
function roomStartCaptureMap(){
 var source=R.domElement,dest=document.getElementById("roomStartMap"),ctx=dest.getContext("2d",{alpha:false});
 if(!source.width||!source.height||!ctx)return false;
 var sw=source.width,sh=source.height,ratio=dest.width/dest.height,
     cw=Math.min(sw,sh*ratio),ch=Math.min(sh,sw/ratio);
 ctx.drawImage(source,(sw-cw)/2,(sh-ch)/2,cw,ch,0,0,dest.width,dest.height);
 roomStartFlow.mapReady=true;
 return true;
}
function roomStartCountdown(now,token){
 var flow=roomStartFlow;if(!flow.active||token!==flow.token||flow.phase!=="countdown")return;
 var seconds=Math.max(0,Math.ceil((flow.deadline-now)/1000));
 if(!seconds){roomStartLoading(token);return;}
 document.getElementById("roomPrestartNumber").textContent=String(seconds);
 flow.raf=requestAnimationFrame(function(next){roomStartCountdown(next,token);});
}
function roomStartLoading(token){
 var flow=roomStartFlow;if(!flow.active||token!==flow.token)return;
 flow.phase="loading";flow.raf=0;flow.mapReady=false;
 var overlay=document.getElementById("roomTransition");
 overlay.hidden=false;overlay.classList.remove("leaving");
 roomStartMark(0,"CAPTURING 3D MAP");
 flow.raf=requestAnimationFrame(function(){
  if(!flow.active||token!==flow.token)return;
  overlay.classList.add("on");
  roomStartLoadingCover(token,performance.now());
 });
}
function roomStartLoadingCover(token,openedAt){
 var flow=roomStartFlow;if(!flow.active||token!==flow.token||flow.phase!=="loading")return;
 if(flow.mapReady&&document.getElementById("roomStartPercent").textContent==="0%")roomStartMark(25,"3D MAP READY");
 var elapsed=performance.now()-openedAt;
 if(!flow.mapReady&&elapsed>5500){roomStartAbort();roomLiveLog("3D map is not ready. Try again.");return;}
 if(!flow.mapReady||elapsed<500){
  flow.raf=requestAnimationFrame(function(){roomStartLoadingCover(token,openedAt);});
  return;
 }
 flow.raf=0;roomStartPrepareGame(token);
}
function roomStartPrepareGame(token){
 var flow=roomStartFlow;if(!flow.active||token!==flow.token||flow.phase!=="loading")return;
 var room=flow.config;
 if(!roomCurrent||roomCurrent.id!==room.id){roomStartAbort();return;}
 flow.phase="preparing";roomStartMark(50,"PREPARING MATCH");
 try{
  // Existing engine builds actual map, 5v5 BOTs and equipped weapon behind an opaque cover.
  roomMatchConfig=Object.assign({},room);selM=room.mode;begin(flow.team);
  flow.loadoutSeconds=mt.cd; // Preserve the original per-mode weapon selection duration.
  mt.cd=0;run=false;document.getElementById("rsp").textContent="";
  roomStartMark(85,"INITIALIZING GAMEPLAY");
 }catch(err){
  run=false;lob=true;lb.style.display="flex";document.body.classList.add("lobby");
  lobP("lbroomlive");roomStartAbort();roomSetMessage("Match could not start. Please retry.");
  if(typeof console!=="undefined")console.error("Room launch failed",err);
  return;
 }
 // Let the render loop draw gameplay frames but never simulate the match until fade finishes.
 flow.raf=requestAnimationFrame(function(){
  if(!flow.active||token!==flow.token)return;
  flow.raf=requestAnimationFrame(function(){
   if(!flow.active||token!==flow.token)return;
   flow.raf=0;roomStartMark(100,"READY TO DEPLOY");roomStartReveal(token);
  });
 });
}
function roomStartReveal(token){
 var flow=roomStartFlow;if(!flow.active||token!==flow.token||flow.phase!=="preparing")return;
 // Let the 100% progress bar actually finish rendering before fading out.
 flow.phase="ready";
 flow.timer=setTimeout(function(){
  if(!flow.active||token!==flow.token||flow.phase!=="ready")return;
  flow.phase="fading";var overlay=document.getElementById("roomTransition");overlay.classList.add("leaving");
  flow.timer=setTimeout(function(){
   if(!flow.active||token!==flow.token||flow.phase!=="fading")return;
   overlay.classList.remove("on","leaving");overlay.hidden=true;
   document.getElementById("roomPrestart").hidden=true;
   var selectionSeconds=flow.loadoutSeconds;
   flow.active=false;flow.phase="idle";flow.timer=0;flow.config=null;flow.loadoutSeconds=0;
   mt.cd=0;document.getElementById("rsp").textContent="";
   run=true;loadoutBeginLiveWindow(selectionSeconds);
  },550);
 },600);
}
function roomLaunch(){
 if(roomStartFlow.active||roomModalActive())return;
 var room=roomSaveLocal();if(!room)return;
 var flow=roomStartFlow;flow.active=true;flow.phase="countdown";flow.token++;
 flow.team=roomSide;flow.config=Object.assign({},room);
 flow.deadline=performance.now()+ROOM_START_COUNTDOWN*1000;
 document.getElementById("roomPrestartNumber").textContent=String(ROOM_START_COUNTDOWN);
 document.getElementById("roomPrestart").hidden=false;
 var token=flow.token;
 flow.raf=requestAnimationFrame(function(now){roomStartCountdown(now,token);});
}

function roomMatchSeconds(){return roomMatchConfig&&roomMatchConfig.mode===0?roomMatchConfig.minutes*60:60;}
function roomKillLimit(){return roomMatchConfig&&roomMatchConfig.mode===0?roomMatchConfig.kills:0;}
function roomReachedKillLimit(){var n=roomKillLimit();return !!(n>0&&(ts[0]>=n||ts[1]>=n));}
function roomRoundLimit(){return roomMatchConfig&&roomMatchConfig.mode===1?roomMatchConfig.rounds:BOMB_RULES.rounds;}
function roomRoundSeconds(){return roomMatchConfig&&roomMatchConfig.mode===1?roomMatchConfig.roundMinutes*60:BOMB_RULES.roundSeconds;}
function roomRoundsToWin(){return roomMatchConfig&&roomMatchConfig.mode===1?Math.floor(roomRoundLimit()/2)+1:BOMB_RULES.wins;}
function roomLobbyOpen(){
 roomModalHide(false);
 var browserOverlay=document.getElementById("roomCreateOverlay");
 if(browserOverlay)browserOverlay.hidden=true;
 roomLoad();roomRender();
 if(roomCurrent){var found=roomList.find(function(r){return r.id===roomCurrent.id;});if(found){roomLiveOpen(found);return;}roomEditState(null);}
 else {
  // Block District remains the real animated lobby background, not a stock image.
  // Mode/map changes inside the Create popup still use the existing authoritative previews.
  roomDraftMode=0;roomDraftMapId="block-district";roomEditState(null);
 }
 roomSetMessage("");
 var notice=document.getElementById("roomQuickNotice");
 if(notice)notice.hidden=true;
 lobP("lbrooms");
 if(typeof inventoryBrowserPreviewOpen==="function")inventoryBrowserPreviewOpen();
}
// The browser's full Create Room form is presented in a modal without cloning inputs,
// validation, map options, mode switches or the original Room Master launch flow.
function roomBrowserCreateClose(){
 var overlay=document.getElementById("roomCreateOverlay");if(!overlay||overlay.hidden)return;
 overlay.hidden=true;
 selM=0;selectedTdmMapId="block-district";modePreviewSelect(0);
 var trigger=document.getElementById("roomCreateOpen");
 if(trigger&&typeof trigger.focus==="function")trigger.focus();
}
document.getElementById("roomCreateOpen").addEventListener("click",function(){
 if(roomCurrent)return;
 var overlay=document.getElementById("roomCreateOverlay");
 overlay.hidden=false;
 roomModeSelect(roomDraftMode);
 var name=document.getElementById("roomName");if(name&&typeof name.focus==="function")name.focus();
});
document.getElementById("roomCreateCancel").addEventListener("click",roomBrowserCreateClose);
document.addEventListener("keydown",function(event){
 var overlay=document.getElementById("roomCreateOverlay");
 if(event.key==="Escape"&&overlay&&!overlay.hidden&&document.getElementById("lbrooms").classList.contains("on")){
  if(typeof event.preventDefault==="function")event.preventDefault();
  roomBrowserCreateClose();
 }
});
// Room Browser shortcuts reuse the canonical Inventory and Shop pages.
// A shortcut visit returns to Room Browser, while the original Main Menu Back stays unchanged.
var roomQuickFromBrowser=false,roomQuickNoticeTimer=null;
function roomQuickOpen(action){
 if(!lob||run||!document.getElementById("lbrooms").classList.contains("on"))return;
 if(action!=="inventory"&&action!=="shop")return;
 roomQuickFromBrowser=true;
 if(action==="inventory")inventoryOpen();else shopOpen();
}
function roomQuickBack(){
 if(roomQuickFromBrowser){
  roomQuickFromBrowser=false;
  roomLobbyOpen();
 }else lobP("lbs");
}
document.getElementById("roomQuickInventory").addEventListener("click",function(){roomQuickOpen("inventory");});
document.getElementById("roomQuickShop").addEventListener("click",function(){roomQuickOpen("shop");});
document.getElementById("roomQuickSettings").addEventListener("click",function(){
 if(!lob||run||!document.getElementById("lbrooms").classList.contains("on"))return;
 // Settings is not implemented in the Main Menu either. Avoid a false settings screen.
 var notice=document.getElementById("roomQuickNotice");
 notice.hidden=false;
 clearTimeout(roomQuickNoticeTimer);
 roomQuickNoticeTimer=setTimeout(function(){notice.hidden=true;},3200);
});
document.getElementById("roomBack").addEventListener("click",function(){if(roomCurrent)roomLiveOpen(roomCurrent);else lobP("lbs");});
document.getElementById("roomRefresh").addEventListener("click",function(){roomLoad();roomRender();roomSetMessage("Local room list refreshed.");});
document.getElementById("roomTdm").addEventListener("click",function(){roomModeSelect(0);});
document.getElementById("roomBomb").addEventListener("click",function(){roomModeSelect(1);});
document.getElementById("roomMap").addEventListener("change",function(){roomChooseMap(this.value);});
document.getElementById("roomModalMap").addEventListener("change",function(){roomModalChooseMap(this.value);});
document.getElementById("roomCreate").addEventListener("click",roomCreateLocal);
document.getElementById("roomSave").addEventListener("click",function(){var saved=roomSaveLocal();if(saved){roomLiveLog("Room settings updated.");roomLiveOpen(saved);}});
document.getElementById("roomClose").addEventListener("click",roomCloseLocal);
document.getElementById("roomStart").addEventListener("click",roomLaunch);

document.getElementById("rmlSettings").addEventListener("click",roomShowSettings);
document.getElementById("roomModalCancel").addEventListener("click",function(){roomModalHide(true);});
document.getElementById("roomModalSave").addEventListener("click",roomModalSave);
document.getElementById("roomModalTdm").addEventListener("click",function(){roomModalChooseMode(0);});
document.getElementById("roomModalBomb").addEventListener("click",function(){roomModalChooseMode(1);});
["kills","minutes","rounds","roundMinutes"].forEach(function(key){
 var id="roomModal"+key.charAt(0).toUpperCase()+key.slice(1);
 document.getElementById(id).addEventListener("change",function(){roomModalSelect(key,this.value);});
});
document.getElementById("roomSettingsModal").addEventListener("click",function(e){
 if(e.target===this)roomModalHide(true);
});
document.addEventListener("keydown",function(e){
 if(!roomModalActive())return;
 if(e.key==="Escape"){e.preventDefault();roomModalHide(true);return;}
 if(e.key!=="Tab")return;
 var elements=Array.prototype.filter.call(
  document.getElementById("roomSettingsModal").querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled)"),
  function(el){return !el.closest("[hidden]");}
 );
 if(!elements.length)return;
 var first=elements[0],last=elements[elements.length-1];
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
 else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
});
document.getElementById("rmlLeave").addEventListener("click",roomLeaveLive);
document.getElementById("rmlStart").addEventListener("click",roomLaunch);
addEventListener("pagehide",function(){roomStartAbort();if(roomCurrent)roomCloseLocal();});
