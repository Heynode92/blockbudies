import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source=readFileSync(new URL('../src/game/98-online-bridge.js',import.meta.url),'utf8');
const begin=source.indexOf('async function onlineMasterStart(){');
const end=source.indexOf('\nfunction onlineBeginTransition(',begin);
assert.ok(begin>=0&&end>begin,'the actual Room Master START handler is present');
const runSource=source.slice(begin,end)+'\nthis.start=onlineMasterStart;';
const playerId='11111111-1111-4111-8111-111111111111';
const roomId='33333333-3333-4333-8333-333333333333';
function fixture(status='ACTIVE',ownerId=playerId){
 const counts={patch:0,start:0,attach:0,decorations:0,warnings:[]};
 const button={disabled:false};
 let current={id:roomId,ownerId,status,members:[{playerId,username:'RoomMaster',ready:true}]};
 const onlineApi={
  state:()=>({player:{id:playerId}}),
  getRoom:async()=>current,
  startRoom:async()=>{counts.start++;return{matchId:'44444444-4444-4444-8444-444444444444',status:'ACTIVE'}},
 };
 const ctx={
  onlineApi,onlineActive:false,onlineAttaching:false,roomCurrent:current,
  onlineAuth:()=>true,onlineIsMaster:()=>true,
  onlineUnreadyMembers:room=>room.members.filter(m=>m.playerId!==room.ownerId&&!m.ready),
  onlineShowWaitingPlayers:room=>counts.warnings.push('WAITING_FOR_READY:'+room.members.length),
  document:{getElementById:()=>button},
  onlineAdoptRoom:r=>{ctx.roomCurrent=r;return r},
  onlineLiveRoomDecorate:r=>{counts.decorations++;ctx.roomCurrent=r},
  onlineAttachMatch:async()=>{counts.attach++},
  onlineSaveRoom:async()=>{counts.patch++;return true},
  onlineWarn:value=>counts.warnings.push(value),
 };
 runInNewContext(runSource,ctx);
 return {ctx,counts,button,setRoom:r=>{current=r}};
}
test('existing ACTIVE creator can rejoin without PATCH or duplicate START',async()=>{
 const f=fixture();
 await f.ctx.start();
 assert.equal(f.counts.attach,1);
 assert.equal(f.counts.decorations,1);
 assert.equal(f.counts.patch,0);
 assert.equal(f.counts.start,0);
 assert.equal(f.button.disabled,false);
});
test('backend owner mismatch never grants master privilege',async()=>{
 const f=fixture('OPEN','22222222-2222-4222-8222-222222222222');
 await f.ctx.start();
 assert.deepEqual(f.counts.warnings,['ROOM_MASTER_REQUIRED']);
 assert.equal(f.counts.patch,0);
 assert.equal(f.counts.start,0);
 assert.equal(f.counts.attach,0);
});
test('OPEN creator saves settings, starts once, and attaches to authoritative match',async()=>{
 const f=fixture('OPEN');
 await f.ctx.start();
 assert.equal(f.counts.patch,1);
 assert.equal(f.counts.start,1);
 assert.equal(f.counts.attach,1);
 assert.equal(f.button.disabled,false);
});
test('concurrent start conflict recovers the same active room without duplicate start',async()=>{
 const f=fixture('OPEN');
 f.ctx.onlineApi.startRoom=async()=>{f.counts.start++;f.setRoom({id:roomId,ownerId:playerId,status:'ACTIVE'});throw{code:'ROOM_ALREADY_ACTIVE'}};
 await f.ctx.start();
 assert.equal(f.counts.patch,1);
 assert.equal(f.counts.start,1);
 assert.equal(f.counts.attach,1);
 assert.deepEqual(f.counts.warnings,[]);
});

test('server ACTIVE room is rendered before attempting realtime attachment',async()=>{
 const f=fixture('ACTIVE');
 f.ctx.onlineAttachMatch=async()=>{f.counts.attach++;return false;};
 await f.ctx.start();
 assert.equal(f.ctx.roomCurrent.status,'ACTIVE');
 assert.equal(f.counts.decorations,1);
 assert.equal(f.counts.attach,1);
 assert.equal(f.counts.start,0);
});
const functionStart=source.indexOf('function onlineStartRoomPoll()');
const functionEnd=source.indexOf('\nfunction onlineResetLive()',functionStart);
const attachStart=source.indexOf('async function onlineAttachMatch(');
const attachEnd=source.indexOf('\nasync function onlineMasterStart()',attachStart);
assert.ok(functionStart>=0&&functionEnd>functionStart&&attachStart>=0&&attachEnd>attachStart);
const wsSource=source.slice(functionStart,functionEnd)+'\n'+source.slice(attachStart,attachEnd)+
 '\nthis.poll=onlineStartRoomPoll;this.attach=onlineAttachMatch;';
test('polling ACTIVE status refreshes REJOIN UI and attempts server WS, not another START',async()=>{
 let timer,shown=0,attached=0;
 const room={id:roomId,ownerId:playerId,status:'ACTIVE',members:[{playerId,username:'RoomMaster',ready:true}]};
 const ctx={
  roomCurrent:{...room,status:'OPEN'},onlineActive:false,onlineAttaching:false,onlineRoomTimer:0,
  setInterval:fn=>{timer=fn;return 1},clearInterval:()=>{},
  onlineApi:{state:()=>({player:{id:playerId}}),getRoom:async()=>room,openLive:async()=>{attached++;}},
  document:{getElementById:()=>({classList:{contains:()=>true},textContent:''})},
  onlineAuth:()=>true,onlineIsMaster:()=>true,
  onlineAdoptRoom:r=>{ctx.roomCurrent=r;return r},
  onlineLiveRoomDecorate:()=>{shown++},onlineReceiveFrame:()=>{},onlineSocketStatus:()=>{},
  onlineBeginTransition:()=>{},onlineWarn:()=>{},onlineResetLive:()=>{},
 };
 runInNewContext(wsSource,ctx);
 ctx.poll();await timer();
 assert.equal(shown,1);
 assert.equal(attached,1);
 assert.equal(ctx.onlineActive,true);
});
test('parallel ACTIVE rejoin attempts cannot consume two single-use WS tickets',async()=>{
 let connections=0,release;
 const room={id:roomId,ownerId:playerId,status:'ACTIVE',mode:0,members:[]};
 const ctx={
  roomCurrent:room,onlineActive:false,onlineAttaching:false,onlineRoomTimer:0,
  onlineApi:{openLive:async()=>{connections++;await new Promise(resolve=>{release=resolve})}},
  document:{getElementById:()=>({textContent:''})},
  onlineAuth:()=>true,onlineIsMaster:()=>true,
  // Never reinterpret an already normalized numeric-mode room as raw API input.
  onlineAdoptRoom:()=>{throw Error('double normalization of ACTIVE room')},
  onlineReceiveFrame:()=>{},onlineSocketStatus:()=>{},
  onlineBeginTransition:()=>{},onlineWarn:()=>{},onlineResetLive:()=>{},
  clearInterval:()=>{},
 };
 runInNewContext(wsSource,ctx);
 const first=ctx.attach(room),second=ctx.attach(room);
 assert.equal(await second,false);
 assert.equal(connections,1);
 release();assert.equal(await first,true);
 assert.equal(ctx.onlineAttaching,false);
});

test('a parsed backend ACTIVE Room Master room reaches realtime without invalid re-normalization',async()=>{
 let wsCount=0,transitions=0;
 const room={id:roomId,ownerId:playerId,status:'ACTIVE',mode:0,members:[]};
 const ctx={
  roomCurrent:room,onlineActive:false,onlineAttaching:false,onlineRoomTimer:0,
  onlineApi:{openLive:async()=>{wsCount++}},
  document:{getElementById:()=>({textContent:''})},
  onlineAuth:()=>true,onlineIsMaster:()=>true,
  onlineAdoptRoom:()=>{throw Error('INVALID_ROOM_RESPONSE')},
  onlineReceiveFrame:()=>{},onlineSocketStatus:()=>{},
  onlineBeginTransition:()=>{transitions++},onlineWarn:()=>{},onlineResetLive:()=>{},
  clearInterval:()=>{},
 };
 runInNewContext(wsSource,ctx);
 assert.equal(await ctx.attach(room),true);
 assert.equal(wsCount,1);
 assert.equal(transitions,1);
 assert.equal(ctx.onlineActive,true);
});

test('Room Master START cannot pass through with another unready human',async()=>{
 const f=fixture('OPEN');
 f.setRoom({id:roomId,ownerId:playerId,status:'OPEN',members:[
  {playerId,username:'RoomMaster',ready:true},
  {playerId:anotherPlayerId,username:'Guest',ready:false}
 ]});
 await f.ctx.start();
 assert.equal(f.counts.start,0);
 assert.equal(f.counts.patch,0);
 assert.equal(f.counts.attach,0);
 assert.deepEqual(f.counts.warnings,['WAITING_FOR_READY:2']);
});
test('Room Master START succeeds once when all human guests are Ready',async()=>{
 const f=fixture('OPEN');
 f.setRoom({id:roomId,ownerId:playerId,status:'OPEN',members:[
  {playerId,username:'RoomMaster',ready:true},
  {playerId:anotherPlayerId,username:'Guest',ready:true}
 ]});
 await f.ctx.start();
 assert.equal(f.counts.patch,1);
 assert.equal(f.counts.start,1);
 assert.equal(f.counts.attach,1);
});
