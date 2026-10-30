// Room Lobby: browser-local room master flow; no network rooms or invented pings.
// Uses existing mode maps, 5v5 bots, and canonical combat/plant/defuse systems.
var ROOM_STORAGE_KEY="bbfps_local_rooms_v1";
var ROOM_LIMITS=Object.freeze({kills:[20,30,50,75,100],minutes:[1,3,5,10,15],rounds:[3,5,7,9,12],roundMinutes:[1,2,3,4]});
var roomList=[],roomCurrent=null,roomMatchConfig=null,roomDraftMode=0;

/* Team slots preview the real 5v5 roster. AI is created by startMatch, never here. */
var ROOM_START_COUNTDOWN=3,roomSide=0,roomSeat=0,roomLog=[];
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
     roomSide=team;roomSeat=seat;roomLiveTeams();
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
 var map=roomMapsForMode(room.mode);
 roomText("rmlBotSummary","1 PLAYER + "+(BOMB_RULES.teamSize*2-1)+" BOTS ON START");
 roomText("rmlRoomName",room.name);roomText("rmlMapName",map?map.name:"UNAVAILABLE");roomText("rmlMapCaption",map?map.caption:"");
 roomText("rmlGameMode",room.mode===1?"BOMB MODE":"TEAM DEATH MATCH");
 roomText("rmlGoalLabel",room.mode===1?"MAX ROUNDS":"KILL LIMIT");
 roomText("rmlGoal",room.mode===1?room.rounds+" ROUNDS":room.kills+" KILLS");
 roomText("rmlTimeLabel",room.mode===1?"ROUND TIME":"MATCH TIME");
 roomText("rmlTime",(room.mode===1?room.roundMinutes:room.minutes)+" MINUTES");
 roomLiveTeams();lobP("lbroomlive");
 // Inventory owns the soldier, real mkGun models, equipped weapon and 3D renderer.
 inventoryRoomPreviewOpen();
}
function roomShowSettings(){if(!roomCurrent)return;roomEditState(roomCurrent);lobP("lbrooms");}
function roomLeaveLive(){roomCloseLocal();lobP("lbrooms");}

function roomAllowed(value,list,fallback){var n=Number(value);return list.indexOf(n)>=0?n:fallback;}
function roomNormalize(obj){
 if(!obj||typeof obj!=="object"||typeof obj.id!=="string"||!/^[0-9]{8,20}$/.test(obj.id))return null;
 if(obj.mode!==0&&obj.mode!==1)return null;
 var name=String(obj.name||"").trim().slice(0,32);
 if(!name)return null;
 return{id:obj.id,name:name,mode:obj.mode,kills:roomAllowed(obj.kills,ROOM_LIMITS.kills,50),
 minutes:roomAllowed(obj.minutes,ROOM_LIMITS.minutes,10),
 rounds:roomAllowed(obj.rounds,ROOM_LIMITS.rounds,12),
 roundMinutes:roomAllowed(obj.roundMinutes,ROOM_LIMITS.roundMinutes,2)};
}
function roomLoad(){
 var data=[];try{data=JSON.parse(localStorage.getItem(ROOM_STORAGE_KEY)||"[]");}catch(err){}
 roomList=Array.isArray(data)?data.slice(0,40).map(roomNormalize).filter(Boolean):[];
}
function roomPersist(){try{localStorage.setItem(ROOM_STORAGE_KEY,JSON.stringify(roomList));return true;}catch(err){return false;}}
function roomMapsForMode(mode){
 // The existing map data and map selection engine are authoritative.
 var m=MODE_MAP_PREVIEWS[mode];
 return m?{name:m.name,caption:m.caption}:null;
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
 var map=roomMapsForMode(roomDraftMode),mapSelect=document.getElementById("roomMap");
 mapSelect.replaceChildren();
 if(map){var option=document.createElement("option");option.value=String(roomDraftMode);option.textContent=map.name;mapSelect.appendChild(option);}
 roomText("roomMapName",map?map.name:"UNAVAILABLE");
 roomText("roomMapCaption",map?map.caption:"");
 selM=roomDraftMode;
 modePreviewSelect(roomDraftMode);
}
function roomFormData(){
 var name=document.getElementById("roomName").value.trim().slice(0,32);
 if(!name)return null;
 return{name:name,mode:roomDraftMode,
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
  var mapTitle=document.createElement("span");mapTitle.textContent=(roomMapsForMode(r.mode)||{}).name||"UNKNOWN";
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
  roomModeSelect(room.mode);
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
function roomSaveLocal(){
 if(!roomCurrent)return null;
 var draft=roomFormData();if(!draft){roomSetMessage("Room name cannot be empty.");return null;}
 var next=roomNormalize(Object.assign({id:roomCurrent.id},draft));
 if(!next)return null;
 var i=roomList.findIndex(function(r){return r.id===roomCurrent.id;});
 if(i<0){roomSetMessage("Room no longer exists.");roomEditState(null);return null;}
 roomList[i]=next;roomCurrent=next;roomPersist();roomRender();
 roomSetMessage("Room settings saved.");return next;
}
function roomCloseLocal(){
 if(!roomCurrent)return;
 roomList=roomList.filter(function(r){return r.id!==roomCurrent.id;});roomPersist();roomRender();
 roomEditState(null);roomMatchConfig=null;roomLog=[];roomSetMessage("Local room closed.");
}
function roomLaunch(){
 var room=roomSaveLocal();if(!room)return;
 // This is not network multiplayer: 5v5 engine retains the existing nine AI soldiers.
 roomMatchConfig=Object.assign({},room);selM=room.mode;
 // begin uses the existing map selection, 5v5 BOT spawn and loadout pipeline.
 begin(roomSide);mt.cd=ROOM_START_COUNTDOWN;
}
function roomMatchSeconds(){return roomMatchConfig&&roomMatchConfig.mode===0?roomMatchConfig.minutes*60:60;}
function roomKillLimit(){return roomMatchConfig&&roomMatchConfig.mode===0?roomMatchConfig.kills:0;}
function roomReachedKillLimit(){var n=roomKillLimit();return !!(n>0&&(ts[0]>=n||ts[1]>=n));}
function roomRoundLimit(){return roomMatchConfig&&roomMatchConfig.mode===1?roomMatchConfig.rounds:BOMB_RULES.rounds;}
function roomRoundSeconds(){return roomMatchConfig&&roomMatchConfig.mode===1?roomMatchConfig.roundMinutes*60:BOMB_RULES.roundSeconds;}
function roomRoundsToWin(){return roomMatchConfig&&roomMatchConfig.mode===1?Math.floor(roomRoundLimit()/2)+1:BOMB_RULES.wins;}
function roomLobbyOpen(){
 roomLoad();roomRender();
 if(roomCurrent){var found=roomList.find(function(r){return r.id===roomCurrent.id;});if(found){roomLiveOpen(found);return;}roomEditState(null);}
 else roomEditState(null);
 roomSetMessage("");
 lobP("lbrooms");
}
document.getElementById("roomBack").addEventListener("click",function(){if(roomCurrent)roomLiveOpen(roomCurrent);else lobP("lbs");});
document.getElementById("roomRefresh").addEventListener("click",function(){roomLoad();roomRender();roomSetMessage("Local room list refreshed.");});
document.getElementById("roomTdm").addEventListener("click",function(){roomModeSelect(0);});
document.getElementById("roomBomb").addEventListener("click",function(){roomModeSelect(1);});
document.getElementById("roomCreate").addEventListener("click",roomCreateLocal);
document.getElementById("roomSave").addEventListener("click",function(){var saved=roomSaveLocal();if(saved){roomLiveLog("Room settings updated.");roomLiveOpen(saved);}});
document.getElementById("roomClose").addEventListener("click",roomCloseLocal);
document.getElementById("roomStart").addEventListener("click",roomLaunch);

document.getElementById("rmlSettings").addEventListener("click",roomShowSettings);
document.getElementById("rmlLeave").addEventListener("click",roomLeaveLive);
document.getElementById("rmlStart").addEventListener("click",roomLaunch);
addEventListener("pagehide",function(){if(roomCurrent)roomCloseLocal();});
