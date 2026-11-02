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
 const counts={patch:0,start:0,attach:0,warnings:[]};
 const button={disabled:false};
 let current={id:roomId,ownerId,status};
 const onlineApi={
  state:()=>({player:{id:playerId}}),
  getRoom:async()=>current,
  startRoom:async()=>{counts.start++;return{matchId:'44444444-4444-4444-8444-444444444444'}},
 };
 const ctx={
  onlineApi,onlineActive:false,roomCurrent:current,
  onlineAuth:()=>true,onlineIsMaster:()=>true,
  document:{getElementById:()=>button},
  onlineAdoptRoom:r=>{ctx.roomCurrent=r;return r},
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
