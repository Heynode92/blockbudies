import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const bridge=read('src/game/98-online-bridge.js');
const client=read('src/network/pointblock-client.js');
const html=read('index.html'),css=read('src/styles/17-online.css');
function piece(start,end){
 const a=bridge.indexOf(start),b=bridge.indexOf(end,a);
 assert.ok(a>=0&&b>a,'bridge section missing '+start);
 return bridge.slice(a,b);
}
test('Ready belongs exclusively to non-master humans and READY appears right of name',()=>{
 const teams=piece('function onlineRoomTeams(){','function onlineLiveRoomDecorate(room)');
 assert.match(teams,/member\.ready\?'READY':'NOT READY'/);
 assert.match(teams,/member\.playerId===roomCurrent\.ownerId\?'ROOM MASTER'/);
 assert.match(teams,/member&&master&&!mine&&roomOpen/);
 assert.match(teams,/document\.createElement\(member\?'div':'button'\)/);
 assert.match(bridge,/startControl\.textContent=room\.status==='ACTIVE'\?'REJOIN MATCH'/);
 assert.match(bridge,/me\?\.ready\?'CANCEL':'READY'/);
 assert.match(bridge,/onlineAction\('rmlStart',onlineToggleReady\)/);
});
test('Master Start displays themed waiting popup, BE remains final Ready authority',()=>{
 assert.match(bridge,/onlineUnreadyMembers\(authoritative\)\.length/);
 assert.match(bridge,/ROOM_PLAYERS_NOT_READY/);
 assert.match(bridge,/onlineShowWaitingPlayers\(authoritative\)/);
 assert.match(client,/setRoomReady:/);
 assert.match(html,/id="roomMultiplayerDialog"/);
 assert.match(html,/aria-modal="true"/);
 assert.match(css,/#lbroomlive \.rml-slot\.is-ready/);
});
test('Kick is master-only in UI and requires server-authorized endpoint',()=>{
 assert.match(bridge,/onlineIsMaster\(\)\|\|roomCurrent\?\.status!=='OPEN'/);
 assert.match(bridge,/onlineApi\.kickRoomMember\(roomCurrent\.id,id\)/);
 assert.match(bridge,/onlineApi\.roomKickStatus\(roomId\)/);
 assert.match(bridge,/YOU ALREADY KICKED BY /);
 assert.match(bridge,/await onlineHandleMissingMembership\(id\)/);
 assert.match(client,/kickRoomMember:/);
 assert.match(client,/roomKickStatus:/);
});
test('online result only EXIT GAME, returns to same room without new match',()=>{
 const finalizer=piece('function onlineFinalizeCompletedMatch(frame)','function onlineReceiveFrame(frame)');
 assert.match(finalizer,/document\.getElementById\('dgo'\)\.textContent='EXIT GAME'/);
 assert.match(finalizer,/document\.getElementById\('dmn'\)\.hidden=true/);
 const exit=piece("onlineAction('dgo',async()=>{","onlineAction('dmn',()=>{");
 assert.match(exit,/matchExitToLobby\('room'\)/);
 assert.match(exit,/onlineRecoverMembership\(\)/);
 assert.doesNotMatch(exit,/onlineMasterStart\(\)|leaveRoom\(|abandonRoom\(|startRoom\(/);
});

test('Leave confirmation and cancel state remain server-owned and styled',()=>{
 assert.match(bridge,/function onlineConfirmLeaveRoom\(\)/);
 assert.match(bridge,/'YES','NO',onlineLeaveRoom/);
 assert.match(bridge,/onlineAction\('rmlLeave',onlineConfirmLeaveRoom\)/);
 assert.match(bridge,/room-cancel-action/);
 assert.doesNotMatch(html,/PREPARE YOUR TEAM · LOCAL MATCH|LOCAL · VS AI/);
 assert.match(css,/#lbroomlive \.rml-slot \.rml-kick-player/);
});
