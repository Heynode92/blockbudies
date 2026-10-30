import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8').replace(/\r\n/g,'\n');
const module=read('src/game/83-room-lobby.js');

class FakeElement{
 constructor(){
  this.value='';this.textContent='';this.hidden=false;this.style={};this.children=[];this.attributes={};this.events={};this.width=1280;this.height=720;this.disabled=false;
  this.classes=new Set();
  this.classList={add:name=>this.classes.add(name),remove:name=>this.classes.delete(name),
   toggle:(name,yes)=>{if(yes)this.classes.add(name);else this.classes.delete(name);}};
 }
 getContext(){return {drawImage(){}};}
 focus(){this.focused=true;}
 querySelectorAll(){return [];}
 addEventListener(type,fn){this.events[type]=fn;}
 setAttribute(name,value){this.attributes[name]=value;}
 replaceChildren(...items){this.children=items;}
 appendChild(el){this.children.push(el);}
 click(){if(this.events.click)this.events.click();}
}
function setup(){
 const nodes=new Map(),data=new Map(),view={page:'',previews:[],previewSides:[],frames:0,documentHandlers:{}};
 let now=0,nextId=0;const frames=new Map(),timers=new Map();
 function advance(ms){
  const end=now+ms;
  while(now<end){
   now=Math.min(end,now+100);
   const callbacks=Array.from(frames.values());frames.clear();
   callbacks.forEach(cb=>cb(now));
   // Simulate the 3D frame rendered before the preview reads WebGL pixels.
   if(vm.runInContext('roomStartFlow.phase',context)==='loading')vm.runInContext('roomStartCaptureMap()',context);
   for(const [id,t] of Array.from(timers.entries())){
    if(t.when<=now){timers.delete(id);t.callback();}
   }
  }
 }

 const doc={getElementById:id=>{
  if(!nodes.has(id))nodes.set(id,new FakeElement());
  return nodes.get(id);
 },createElement:()=>new FakeElement(),addEventListener:(type,fn)=>{view.documentHandlers[type]=fn;},activeElement:null};
 for(const [key,value] of Object.entries({roomName:'My Room',roomKills:'50',roomMinutes:'10',roomRounds:'12',roomRoundMinutes:'2'}))
  doc.getElementById(key).value=value;
 const context={document:doc,localStorage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)},
  MODE_MAP_PREVIEWS:[{name:'BLOCK DISTRICT',caption:'Urban Combat Zone'},
   {name:'LOCKDOWN',caption:'Indoor Tactical Arena'}],
  modePreviewSelect:mode=>view.previews.push(mode),lobP:page=>{view.page=page;},
  selM:0,BOMB_RULES:{teamSize:5,rounds:12,roundSeconds:120,wins:7,freezeSeconds:7},ts:[0,0],mt:{cd:5},
  BN:[['Jack','Mike','Ryan','Alex','Owen'],['Viper','Razor','Hawk','Shadow','Ghost']],
  begin:tm=>{view.begunTeam=tm;context.mt.cd=view.previews.at(-1)===1?context.BOMB_RULES.freezeSeconds:5;context.run=true;},
  loadoutBeginLiveWindow:seconds=>{view.liveLoadoutSeconds=seconds;},inventoryRoomPreviewOpen:side=>{view.previewOpens=(view.previewOpens||0)+1;view.previewSides.push(side);},
  performance:{now:()=>now},
  requestAnimationFrame:fn=>{const id=++nextId;frames.set(id,fn);return id;},
  cancelAnimationFrame:id=>frames.delete(id),
  setTimeout:(callback,delay)=>{const id=++nextId;timers.set(id,{when:now+delay,callback});return id;},
  clearTimeout:id=>timers.delete(id),
  R:{domElement:{width:1280,height:720}},
  lb:{style:{}},run:false,lob:true,documentBodyUnused:null,
  addEventListener:()=>{}};
 vm.createContext(context);vm.runInContext(module,context,{filename:'83-room-lobby.js'});
 return {context,doc,data,view,advance};
}
function call(c,expression){return vm.runInContext(expression,c);}

test('START routes to a real Room Lobby while retaining existing game screens',()=>{
 const html=read('index.html'),lobby=read('src/game/85-lobby-and-match.js');
 assert.match(html,/id="lbrooms" class="lbp"/);
 assert.match(html,/id="roomEntries"/);
 assert.match(html,/id="roomMapPreview"/);
 assert.match(html,/id="lbroomlive" class="lbp"/);
 assert.match(lobby,/roomLobbyOpen\(\)/);
 assert.match(lobby,/\["lbs","lbm","lbrooms","lbroomlive","lbiv","lbshop"\]/);
 assert.doesNotMatch(lobby,/lbst"\)\.onclick=function\(\)\{this\.blur\(\);lobP\("lbm"\)/);
 const {context,doc,view}=setup();
 call(context,'roomLobbyOpen()');
 assert.equal(view.page,'lbrooms');
 assert.equal(doc.getElementById('roomEmpty').hidden,false);
 assert.equal(doc.getElementById('roomEntries').children.length,0);
 assert.equal(doc.getElementById('roomMapName').textContent,'BLOCK DISTRICT');
});

test('creating room grants Room Master, creates a safe local listing and persists settings',()=>{
 const {context,doc,data,view}=setup();
 call(context,'roomLobbyOpen()');
 doc.getElementById('roomName').value='<img src=x onerror=alert(1)> Test';
 call(context,'roomCreateLocal()');
 assert.equal(call(context,'roomList.length'),1);
 assert.equal(view.page,'lbroomlive');
 assert.equal(doc.getElementById('roomMasterStatus').hidden,false);
 assert.equal(doc.getElementById('roomCreate').hidden,true);
 assert.equal(doc.getElementById('roomEntries').children.length,1);
 assert.equal(doc.getElementById('roomEmpty').hidden,true);
 const row=doc.getElementById('roomEntries').children[0];
 assert.equal(row.children[1].textContent,'<img src=x onerror=alert(1)> Tes');
 assert.equal(row.children[1].children.length,0,'untrusted room name stays text-only');
 assert.equal(JSON.parse(data.get('bbfps_local_rooms_v1')).length,1);
 assert.equal(row.children[4].textContent,'WAITING');
});

test('TDM kill limit and match timer affect game rules only when Room Master starts',()=>{
 const {context,doc,view,advance}=setup();call(context,'roomLobbyOpen()');
 doc.getElementById('roomKills').value='75';doc.getElementById('roomMinutes').value='3';
 call(context,'roomCreateLocal()');
 assert.equal(call(context,'roomMatchSeconds()'),60,'legacy duration remains default until launch');
 call(context,'roomLaunch()');
 assert.equal(view.begunTeam,undefined,'pre-match remains in Room Lobby');
 assert.equal(doc.getElementById('roomPrestartNumber').textContent,'3');
 advance(5300);
 assert.equal(call(context,'roomKillLimit()'),75);
 assert.equal(call(context,'roomMatchSeconds()'),180);
 assert.equal(view.begunTeam,0);assert.equal(call(context,'mt.cd'),0);
 assert.equal(view.liveLoadoutSeconds,5,'TDM weapon selection begins after loading, with no second freeze');
 assert.equal(doc.getElementById('roomStartPercent').textContent,'100%');
 assert.equal(call(context,'run'),true);
 assert.equal(doc.getElementById('rmlPoliceSlots').children.length,5);
 assert.equal(doc.getElementById('rmlTerrorSlots').children.length,5);
 call(context,'ts[0]=74;ts[1]=31');
 assert.equal(call(context,'roomReachedKillLimit()'),false);
 call(context,'ts[0]=75');
 assert.equal(call(context,'roomReachedKillLimit()'),true);
});

test('Bomb Mode uses existing map, correct max rounds, timer and wins majority',()=>{
 const {context,doc,view,advance}=setup();call(context,'roomLobbyOpen()');
 call(context,'roomCreateLocal()');call(context,'roomModeSelect(1)');
 doc.getElementById('roomRounds').value='5';doc.getElementById('roomRoundMinutes').value='3';
 call(context,'roomLaunch()');advance(5300);
 assert.equal(call(context,'roomRoundLimit()'),5);
 assert.equal(call(context,'roomRoundSeconds()'),180);
 assert.equal(call(context,'roomRoundsToWin()'),3);
 assert.equal(view.liveLoadoutSeconds,7,'Bomb Mode uses its original pre-round selection duration');
 assert.equal(call(context,'mt.cd'),0,'first Bomb round has no duplicate countdown');
 assert.equal(call(context,'selM'),1);
 assert.equal(doc.getElementById('roomMapName').textContent,'LOCKDOWN');
 assert.ok(view.previews.includes(1));
 assert.equal(doc.getElementById('roomTdmSettings').hidden,true);
 assert.equal(doc.getElementById('roomBombSettings').hidden,false);
});

test('room editing, reopening and closing operate locally without fake remote joins',()=>{
 const {context,doc}=setup();call(context,'roomLobbyOpen()');call(context,'roomCreateLocal()');
 doc.getElementById('roomName').value='New Name';
 call(context,'roomSaveLocal()');
 assert.equal(call(context,'roomCurrent.name'),'New Name');
 const roomId=call(context,'roomCurrent.id');
 call(context,'roomOpenSaved('+JSON.stringify(roomId)+')');
 assert.equal(doc.getElementById('roomName').value,'New Name');
 call(context,'roomCloseLocal()');
 assert.equal(call(context,'roomList.length'),0);
 assert.equal(doc.getElementById('roomEmpty').hidden,false);
 assert.equal(doc.getElementById('roomCreate').hidden,false);
 const src=read('src/game/83-room-lobby.js');
 assert.doesNotMatch(src,/fetch\(|WebSocket\(|XMLHttpRequest\(/);
});

test('malformed stored rooms are ignored and option whitelists resist invalid values',()=>{
 const {context,doc,data}=setup();
 data.set('bbfps_local_rooms_v1',JSON.stringify([
  {id:'123456789',name:'Valid Room',mode:0,kills:99999,minutes:-3,rounds:21,roundMinutes:200},
  {id:'not-valid',name:'Invalid',mode:7}
 ]));
 call(context,'roomLobbyOpen()');
 assert.equal(call(context,'roomList.length'),1);
 assert.equal(call(context,'roomList[0].kills'),50);
 assert.equal(call(context,'roomList[0].minutes'),10);
 assert.equal(call(context,'roomList[0].rounds'),12);
 assert.equal(call(context,'roomList[0].roundMinutes'),2);
 doc.getElementById('roomName').value='    ';
 call(context,'roomCreateLocal()');
 assert.equal(call(context,'roomList.length'),1);
});

test('existing 5v5 engine stays authoritative, no fabricated maps or public players',()=>{
 const html=read('index.html');
 assert.match(html,/LOCAL · VS AI/);
 assert.match(html,/NO ONLINE SERVER CONNECTED/);
 assert.match(html,/1 PLAYER \+ 9 BOTS/);
 const src=read('src/game/83-room-lobby.js');
 assert.match(src,/MODE_MAP_PREVIEWS\[mode\]/,'map labels depend on canonical existing previews');
 assert.match(src,/roomNormalize/);
 assert.match(src,/roomRoundsToWin/);
 assert.match(read('src/game/85-lobby-and-match.js'),/mt=\{t:roomMatchSeconds\(\),cd:5,over:false\}/);
 assert.match(read('src/game/86-bomb-mission.js'),/mt\.t=roomRoundSeconds\(\)/);
 assert.match(read('src/game/95-simulation.js'),/roomReachedKillLimit\(\)/);
 assert.match(read('src/styles/04-lobby.css'),/\.room-empty\[hidden\]\{display:none\}/);
 assert.match(read('src/game/83-room-lobby.js'),/roomStartCountdown\(now,token\)/);
 assert.match(read('src/game/83-room-lobby.js'),/mt.cd=0;run=false/);
 assert.doesNotMatch(read('src/game/85-lobby-and-match.js'),/mt.t>59.2\?"GO!"/);
});

test('direct-launch browser bundle exactly mirrors ordered sources without startup regression',()=>{
 const m=JSON.parse(read('tools/source-manifest.json'));
 const mod='src/game/83-room-lobby.js';
 assert.equal(m.parts.filter(p=>p===mod).length,1);
 assert.equal(m.parts.indexOf(mod)+1,m.parts.indexOf('src/game/84-live-map-preview.js'));
 assert.ok(m.parts.indexOf(mod)<m.parts.indexOf('src/game/85-lobby-and-match.js'));
 assert.ok(m.parts.indexOf('src/game/89-bot-tactical-intelligence.js')<m.parts.indexOf('src/game/85-lobby-and-match.js'));
 assert.equal(read('assets/game.js'),'(function(){\n'+m.parts.map(read).join('')+'})();\n');
 new vm.Script(read('assets/game.js'));
});

test('team slot click drives selected team and pre-match Room-only countdown',()=>{
 const {context,doc,view,advance}=setup();call(context,'roomLobbyOpen()');call(context,'roomCreateLocal()');
 const police=doc.getElementById('rmlPoliceSlots'),terror=doc.getElementById('rmlTerrorSlots');
 assert.equal(police.children.length,5);assert.equal(terror.children.length,5);
 assert.match(police.children[0].children[1].textContent,/YOU/);
 terror.children[3].click();
 assert.equal(call(context,'roomSide'),1);assert.equal(call(context,'roomSeat'),3);
 assert.match(terror.children[3].children[1].textContent,/YOU/);
 assert.match(police.children[0].children[1].textContent,/BOT/);
 assert.equal(view.previewSides.at(-1),1,'3D preview must switch to the Terrorist skin');
 call(context,'roomLaunch()');assert.equal(view.begunTeam,undefined);
 advance(1100);assert.equal(doc.getElementById('roomPrestartNumber').textContent,'2');
 advance(1000);assert.equal(doc.getElementById('roomPrestartNumber').textContent,'1');
 advance(2400);assert.equal(view.begunTeam,1);assert.equal(call(context,'mt.cd'),0);
});
test('Room Master leaving closes the local room and removes it from browser storage',()=>{
 const {context,doc,data,view}=setup();call(context,'roomLobbyOpen()');call(context,'roomCreateLocal()');
 assert.equal(JSON.parse(data.get('bbfps_local_rooms_v1')).length,1);
 doc.getElementById('rmlLeave').click();
 assert.equal(call(context,'roomCurrent'),null);assert.equal(JSON.parse(data.get('bbfps_local_rooms_v1')).length,0);
 assert.equal(view.page,'lbrooms');
});
test('Room Settings stays in the active lobby; saving commits via popup only',()=>{
 const {context,doc,view,data}=setup();call(context,'roomLobbyOpen()');call(context,'roomCreateLocal()');
 const id=call(context,'roomCurrent.id'),count=view.previewOpens;
 doc.getElementById('rmlSettings').click();
 assert.equal(view.page,'lbroomlive','must NOT navigate to the room browser');
 assert.equal(doc.getElementById('roomSettingsModal').hidden,false);
 assert.equal(call(context,'roomCurrent.id'),id);
 doc.getElementById('roomModalName').value='Updated';
 const killSelect=doc.getElementById('roomModalKills');
 assert.deepEqual(killSelect.children.map(item=>item.value),['20','30','50','75','100']);
 killSelect.value='75';killSelect.events.change.call(killSelect);
 assert.equal(call(context,'roomCurrent.kills'),50,'changes are unsaved before Save');
 doc.getElementById('roomModalSave').click();
 assert.equal(view.page,'lbroomlive');
 assert.equal(doc.getElementById('roomSettingsModal').hidden,true);
 assert.equal(doc.getElementById('rmlRoomName').textContent,'Updated');
 assert.equal(doc.getElementById('rmlGoal').textContent,'75 KILLS');
 assert.equal(JSON.parse(data.get('bbfps_local_rooms_v1'))[0].kills,75);
 assert.equal(view.previewOpens,count+1,'refreshes same 3D soldier without duplicate previews');
});

test('live team counts and human-vs-BOT total derive from shared gameplay capacity',()=>{
 const {context,doc}=setup();call(context,'roomLobbyOpen()');call(context,'roomCreateLocal()');
 assert.equal(doc.getElementById('rmlBotSummary').textContent,'1 PLAYER + 9 BOTS ON START');
 assert.equal(doc.getElementById('rmlPoliceSlots').children.length,call(context,'BOMB_RULES.teamSize'));
 assert.match(read('src/game/85-lobby-and-match.js'),/i<BOMB_RULES\.teamSize-\(t===tm\?1:0\)/);
});

test('Create Room and popup Save refresh the shared 3D soldier preview',()=>{
 const {context,doc,view}=setup();call(context,'roomLobbyOpen()');call(context,'roomCreateLocal()');
 assert.equal(view.previewOpens,1);
 doc.getElementById('rmlSettings').click();
 doc.getElementById('roomModalName').value='My Test Room';
 doc.getElementById('roomModalSave').click();
 assert.equal(view.previewOpens,2);
 assert.equal(doc.getElementById('rmlRoomName').textContent,'My Test Room');
});

test('double-click START cannot spawn two matches and abort closes countdown',()=>{
 const {context,doc,view,advance}=setup();call(context,'roomLobbyOpen()');call(context,'roomCreateLocal()');
 call(context,'roomLaunch()');call(context,'roomLaunch()');
 advance(1500);call(context,'roomCloseLocal()');advance(5000);
 assert.equal(view.begunTeam,undefined);
 assert.equal(doc.getElementById('roomPrestart').hidden,true);
 assert.equal(doc.getElementById('roomTransition').hidden,true);
 assert.equal(call(context,'roomStartFlow.active'),false);
});
test('loading reaches 100 only after match initialization and fades before simulation begins',()=>{
 const {context,doc,view,advance}=setup();call(context,'roomLobbyOpen()');call(context,'roomCreateLocal()');
 call(context,'roomLaunch()');
 advance(3000);assert.equal(view.begunTeam,undefined);
 advance(300);assert.equal(view.begunTeam,undefined);
 assert.equal(doc.getElementById('roomTransition').hidden,false);
 advance(400);assert.equal(view.begunTeam,0);
 assert.equal(call(context,'run'),false,'paused behind the loading screen');
 advance(300);assert.equal(doc.getElementById('roomStartPercent').textContent,'100%');
 assert.equal(call(context,'roomStartFlow.phase'),'ready','100% must stay visible before fade');
 assert.equal(call(context,'run'),false,'gameplay stays frozen through 100%');
 advance(1200);assert.equal(call(context,'run'),true);
 assert.equal(doc.getElementById('roomTransition').hidden,true);
 assert.equal(view.liveLoadoutSeconds,5,'weapon picker only opens after the fade');
 assert.equal(call(context,'mt.cd'),0,'WASD and match simulation must not be frozen');
});

test('map loading reads 3D pixels in the post-render preview hook',()=>{
 const preview=read('src/game/84-live-map-preview.js'),room=read('src/game/83-room-lobby.js');
 assert.match(preview,/if\(inLive&&roomStartFlow\.active&&roomStartFlow\.phase==="loading"\)roomStartCaptureMap\(\)/);
 assert.doesNotMatch(room,/var captured=roomStartCaptureMap\(\)/);
 assert.match(room,/if\(!flow\.mapReady\|\|elapsed<500\)/);
});

test('Room popup CANCEL discards draft changes without closing room or changing sides',()=>{
 const {context,doc,view,data}=setup();call(context,'roomLobbyOpen()');call(context,'roomCreateLocal()');
 const original=JSON.parse(data.get('bbfps_local_rooms_v1'))[0],side=call(context,'roomSide');
 doc.getElementById('rmlSettings').click();
 doc.getElementById('roomModalBomb').click();
 assert.equal(doc.getElementById('roomModalMapName').textContent,'LOCKDOWN');
 assert.equal(view.page,'lbroomlive');
 assert.equal(call(context,'roomCurrent.mode'),0,'draft does not change roomCurrent');
 assert.equal(JSON.parse(data.get('bbfps_local_rooms_v1'))[0].mode,0,'draft not persisted');
 assert.equal(doc.getElementById('roomModalTdmGroup').hidden,true,'TDM settings entirely disappear in Bomb Mode');
 assert.equal(doc.getElementById('roomModalBombGroup').hidden,false);
 const rounds=doc.getElementById('roomModalRounds');
 rounds.value='5';rounds.events.change.call(rounds);
 doc.getElementById('roomModalCancel').click();
 assert.equal(doc.getElementById('roomSettingsModal').hidden,true);
 assert.equal(call(context,'roomCurrent.mode'),original.mode);
 assert.equal(call(context,'selM'),0,'3D preview restored after cancel');
 assert.equal(call(context,'roomSide'),side,'team selection stays intact');
 assert.equal(JSON.parse(data.get('bbfps_local_rooms_v1'))[0].rounds,original.rounds);
 assert.equal(view.page,'lbroomlive','room remains open');
});
test('Room popup Escape, backdrop and missing name are handled safely',()=>{
 const {context,doc,view}=setup();call(context,'roomLobbyOpen()');call(context,'roomCreateLocal()');
 const modal=doc.getElementById('roomSettingsModal');
 doc.getElementById('rmlSettings').click();
 view.documentHandlers.keydown({key:'Escape',preventDefault(){}});
 assert.equal(modal.hidden,true,'Escape closes dialog');
 doc.getElementById('rmlSettings').click();
 modal.events.click.call(modal,{target:modal});
 assert.equal(modal.hidden,true,'backdrop closes dialog');
 doc.getElementById('rmlSettings').click();
 doc.getElementById('roomModalName').value='   ';
 doc.getElementById('roomModalSave').click();
 assert.equal(modal.hidden,false,'invalid name keeps dialog open');
 assert.equal(call(context,'roomCurrent.name'),'My Room','invalid name cannot corrupt room');
 assert.match(doc.getElementById('roomModalError').textContent,/room name/i);
 doc.getElementById('roomModalCancel').click();
 assert.equal(view.page,'lbroomlive');
});
test('Room popup saves only canonical settings for Bomb Mode and updates actual lobby',()=>{
 const {context,doc,view,data}=setup();call(context,'roomLobbyOpen()');call(context,'roomCreateLocal()');
 const roomId=call(context,'roomCurrent.id');
 doc.getElementById('rmlSettings').click();doc.getElementById('roomModalBomb').click();
 // Dropdowns inherit the exact canonical values from the Create Room form.
 assert.deepEqual(doc.getElementById('roomModalRounds').children.map(v=>v.value),['3','5','7','9','12']);
 const rounds=doc.getElementById('roomModalRounds');
 rounds.value='9';rounds.events.change.call(rounds);
 const time=doc.getElementById('roomModalRoundMinutes');
 time.value='3';time.events.change.call(time);
 doc.getElementById('roomModalSave').click();
 assert.equal(call(context,'roomCurrent.id'),roomId);
 assert.equal(call(context,'roomCurrent.mode'),1);
 assert.equal(call(context,'roomCurrent.rounds'),9);
 assert.equal(call(context,'roomCurrent.roundMinutes'),3);
 assert.equal(doc.getElementById('rmlGameMode').textContent,'BOMB MODE');
 assert.equal(doc.getElementById('rmlTime').textContent,'3 MINUTES');
 assert.equal(view.page,'lbroomlive');
 assert.equal(JSON.parse(data.get('bbfps_local_rooms_v1'))[0].mode,1);
 call(context,'roomLaunch()');
 assert.equal(view.begunTeam,undefined,'still uses the room-only countdown before gameplay');
});
test('Room popup is closed when Room Master leaves and never blocks subsequent navigation',()=>{
 const {context,doc,view,data}=setup();call(context,'roomLobbyOpen()');call(context,'roomCreateLocal()');
 doc.getElementById('rmlSettings').click();
 call(context,'roomLaunch()');
 assert.equal(call(context,'roomStartFlow.active'),false,'start is disabled while settings dialog is open');
 call(context,'roomCloseLocal()');
 assert.equal(doc.getElementById('roomSettingsModal').hidden,true);
 assert.equal(call(context,'roomCurrent'),null);
 assert.equal(JSON.parse(data.get('bbfps_local_rooms_v1')).length,0);
});
test('popup follows real map and source layout, not a new map or hardcoded timer',()=>{
 const html=read('index.html'),src=read('src/game/83-room-lobby.js'),preview=read('src/game/84-live-map-preview.js');
 assert.match(html,/id="roomSettingsModal"/);
 assert.match(html,/aria-modal="true"/);
 assert.match(html,/id="roomModalMapPreview"/);
 assert.doesNotMatch(html,/id="roomModalClose"|room-modal-help|Only existing playable maps are available for each mode\./);
 assert.doesNotMatch(read('src/styles/04-lobby.css'),/\.room-modal-x\{|\.room-modal-help\{/);
 assert.match(read('src/styles/04-lobby.css'),/\.room-modal-map\{[^}]*margin-top:10px/);
 assert.doesNotMatch(src,/getElementById\("roomModalClose"\)/);
 assert.match(preview,/modalCtx.drawImage\(src/);
 assert.match(src,/ROOM_LIMITS\[key\]/);
 assert.match(src,/function roomShowSettings\(\)/);
 assert.match(src,/roomModalPopulateOptions\(\)/);
 assert.match(src,/roomModalSelect\(key,this\.value\)/);
 assert.match(html,/id="roomModalMinutes"[^>]*><\/select>/);
 assert.doesNotMatch(html,/roomModalKillsPlus|roomModalRoundsMinus|roomModalRoundMinutesPlus/);
 assert.match(read('src/styles/04-lobby.css'),/#lbroomlive \.room-modal-group\[hidden\]\{display:none!important\}/);
 assert.doesNotMatch(src,/function roomShowSettings\(\)\{if\(!roomCurrent\)return;roomEditState\(roomCurrent\);lobP\("lbrooms"\);\}/);
});

test('Popup shows only selected mode settings and uses native dropdowns',()=>{
 const {context,doc,view}=setup();call(context,'roomLobbyOpen()');call(context,'roomCreateLocal()');
 doc.getElementById('rmlSettings').click();
 const tdm=doc.getElementById('roomModalTdmGroup'),bomb=doc.getElementById('roomModalBombGroup');
 assert.equal(tdm.hidden,false);
 assert.equal(bomb.hidden,true);
 assert.equal(view.page,'lbroomlive');
 assert.deepEqual(doc.getElementById('roomModalMinutes').children.map(v=>v.value),['1','3','5','10','15']);
 assert.deepEqual(doc.getElementById('roomModalRoundMinutes').children.map(v=>v.value),['1','2','3','4']);
 assert.equal(doc.getElementById('roomModalKills').value,'50');
 assert.equal(doc.getElementById('roomModalMinutes').value,'10');
 doc.getElementById('roomModalBomb').click();
 assert.equal(tdm.hidden,true);
 assert.equal(bomb.hidden,false);
 assert.equal(doc.getElementById('roomModalRounds').value,'12');
 doc.getElementById('roomModalTdm').click();
 assert.equal(tdm.hidden,false);
 assert.equal(bomb.hidden,true);
 assert.equal(doc.getElementById('roomModalMinutes').value,'10','mode toggle must preserve draft values');
});
test('Popup dropdown cannot bypass ROOM_LIMITS or persist an invalid forged option',()=>{
 const {context,doc,data,view}=setup();call(context,'roomLobbyOpen()');call(context,'roomCreateLocal()');
 doc.getElementById('rmlSettings').click();
 const dropdown=doc.getElementById('roomModalKills');
 dropdown.value='999999';dropdown.events.change.call(dropdown);
 assert.equal(doc.getElementById('roomModalKills').value,'50','fallback to prior allowed value');
 assert.equal(call(context,'roomModalDraft.kills'),50);
 dropdown.value='30';dropdown.events.change.call(dropdown);
 assert.equal(call(context,'roomCurrent.kills'),50,'unsaved changes must stay in the modal');
 doc.getElementById('roomModalSave').click();
 assert.equal(call(context,'roomCurrent.kills'),30);
 assert.equal(JSON.parse(data.get('bbfps_local_rooms_v1'))[0].kills,30);
 assert.equal(view.page,'lbroomlive');
});
