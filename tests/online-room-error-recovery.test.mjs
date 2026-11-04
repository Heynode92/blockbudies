import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../src/game/98-online-bridge.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function isolate(begin,end,exportName){
 const a=source.indexOf(begin),b=source.indexOf(end,a);
 assert.ok(a>=0&&b>a,'missing canonical source: '+begin);
 return source.slice(a,b)+'\nthis.action='+exportName+';';
}
test('failed realtime ticket/WS connection reports original error without writing to missing DOM ID',async()=>{
 assert.doesNotMatch(html,/id="rmlBotSummary"/);
 const button={hidden:true,disabled:true,textContent:''}, dialogs=[],errors=[];
 const ctx={
  roomCurrent:{id:'room1',mode:0,status:'ACTIVE',members:[]},
  onlineActive:false,onlineAttaching:false,onlineAuth:()=>true,
  onlineApi:{openLive:async()=>{throw Object.assign(new Error('ticket expired'),{code:'MATCH_TICKET_EXPIRED'});}},
  onlineIsMaster:()=>false,
  onlineWarn:e=>{errors.push(e);return e.code||e.message},
  onlineResetLive:()=>{},onlineAdoptRoom:()=>{throw Error('double normalization');},
  document:{getElementById:id=>id==='rmlStart'?button:null},
  onlineRoomDialog:(...args)=>dialogs.push(args),
  clearInterval:()=>{},onlineReceiveFrame:()=>{},onlineSocketStatus:()=>{},
 };
 runInNewContext(isolate('async function onlineAttachMatch(room){','async function onlineMasterStart()','onlineAttachMatch'),ctx);
 assert.equal(await ctx.action(ctx.roomCurrent),false);
 assert.equal(ctx.onlineAttaching,false);
 assert.equal(errors.length,1);
 assert.equal(dialogs.length,1);
 assert.equal(dialogs[0][0],'MATCH CONNECTION FAILED');
 assert.match(dialogs[0][1],/MATCH_TICKET_EXPIRED/);
 assert.equal(button.textContent,'REJOIN MATCH');
 assert.equal(button.disabled,false);
});

function leaveContext(status='ACTIVE',reject=false){
 let leave=0,abandon=0,reset=0,recover=0;
 const dialogs=[],errors=[];
 const room={id:'room1',mode:0,status,members:[]};
 const ctx={
  roomCurrent:room,roomList:[room],onlineActive:false,onlineAuth:()=>true,
  onlineApi:{
   getRoom:async()=>room,
   leaveRoom:async()=>{leave++;if(reject)throw {status:409,code:'LEAVE_NOT_ALLOWED'};},
   abandonRoom:async()=>{abandon++;},
  },
  onlineAdoptRoom:r=>{ctx.roomCurrent=r;return r},
  onlineLiveRoomDecorate:r=>{ctx.roomCurrent=r},
  onlineRoomDialog:(...args)=>dialogs.push(args),
  onlineWarn:e=>{errors.push(e);return e.code},
  onlineResetLive:()=>{reset++;},roomEditState:()=>{},roomLobbyOpen:()=>{},
  onlineRecoverMembership:async()=>{recover++;return {...room,status:'ACTIVE'}},
 };
 runInNewContext(isolate('async function onlineLeaveRoom(){','function onlineStartRoomPoll()','onlineLeaveRoom'),ctx);
 return {ctx,dialogs,errors,counts:()=>({leave,abandon,reset,recover})};
}
test('stale local flag may not send OPEN-only /leave into server ACTIVE room',async()=>{
 const f=leaveContext('ACTIVE');
 await f.ctx.action();
 assert.deepEqual(f.counts(),{leave:0,abandon:0,reset:0,recover:0});
 assert.equal(f.ctx.roomCurrent.id,'room1');
 assert.equal(f.dialogs[0][0],'MATCH IN PROGRESS');
});
test('server-confirmed OPEN room can still be left normally',async()=>{
 const f=leaveContext('OPEN');
 await f.ctx.action();
 assert.deepEqual(f.counts(),{leave:1,abandon:0,reset:1,recover:0});
 assert.equal(f.ctx.roomCurrent,null);
});
test('OPEN to ACTIVE race on leave recovers membership after real HTTP 409',async()=>{
 const f=leaveContext('OPEN',true);
 await f.ctx.action();
 assert.deepEqual(f.counts(),{leave:1,abandon:0,reset:0,recover:1});
 assert.equal(f.ctx.roomCurrent.id,'room1');
 assert.equal(f.dialogs[0][0],'MATCH IN PROGRESS');
});
test('READY fetch failures never escape as unhandled promise rejections',async()=>{
 let recovered=0,warning=0;
 const ctx={roomCurrent:{id:'room1'},onlineActive:false,onlineAttaching:false,
  onlineAuth:()=>true,onlineApi:{state:()=>({player:{id:'x'}}),
   getRoom:async()=>{throw {status:409,code:'ROOM_CONFLICT_RETRY'};}},
  onlineAdoptRoom:r=>r,
  onlineWarn:()=>{warning++},onlineRecoverMembership:async()=>{recovered++},
 };
 runInNewContext(isolate('async function onlineToggleReady(){','function onlinePromptKickMember','onlineToggleReady'),ctx);
 await ctx.action();
 assert.equal(warning,1);
 assert.equal(recovered,1);
});

test('ACTIVE room confirmation explains REJOIN without scheduling an OPEN-only leave',()=>{
 const dialogs=[];
 const ctx={
  onlineAuth:()=>true,roomCurrent:{id:'room1',status:'ACTIVE'},
  onlineActive:false,onlineIsMaster:()=>true,
  onlineRoomDialog:(...args)=>dialogs.push(args),
 };
 runInNewContext(isolate('function onlineConfirmLeaveRoom(){','async function onlineLeaveRoom()','onlineConfirmLeaveRoom'),ctx);
 ctx.action();
 assert.equal(dialogs[0][0],'MATCH IN PROGRESS');
 assert.match(dialogs[0][1],/REJOIN MATCH/);
 assert.equal(dialogs[0][4],null);
});

test('new authoritative status notices cannot be closed by an older confirmation callback',()=>{
 assert.match(source,/if\(onlineRoomDialogAccept===action\)onlineRoomDialogClose\(\)/);
 assert.doesNotMatch(source,/try\{await action\(\);onlineRoomDialogClose\(\);\}/);
});
