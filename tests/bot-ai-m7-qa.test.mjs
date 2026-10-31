import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const qa=read('src/game/94-bot-qa.js');
function env(enabled=false){
 const c={Math,Date,URLSearchParams,
  location:{search:enabled?'?bbBotQa=1':''},
  window:{},console:{info(){}},tt:1,mode:'tdm',
  isBombMode(){return c.mode==='bomb';},
  botIntelVisible(){return true}};
 vm.createContext(c);vm.runInContext(qa,c);
 return c;
}
test('M7: QA is off by default; no exported API, no frame samples and no network',()=>{
 const c=env();
 assert.equal(c.botQaEnabled,false);
 assert.equal(c.window.BlockBuddiesQA,undefined);
 c.botQaFrame(16.67,8,true);c.botQaCpu(1.1,9);
 c.botQaMove(true,0,4,.05);c.botQaPath(null);
 c.botQaBomb(1,0,'planted');
 assert.equal(c.botQaData.frames.length,0);
 assert.equal(c.botQaData.rounds.length,0);
 assert.equal(c.botQaData.pathAttempts,0);
 assert.doesNotMatch(qa,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage/);
});
test('M7: only exact opt-in enables in-memory QA interface',()=>{
 const c=env(true);
 assert.equal(c.botQaEnabled,true);
 assert.equal(typeof c.window.BlockBuddiesQA.report,'function');
 assert.equal(typeof c.window.BlockBuddiesQA.download,'function');
 assert.equal(c.window.BlockBuddiesQA.download(),false,
   'without browser DOM, no fake download is reported');
});
test('M7: actual frame timestamps keep un-clamped wall intervals and reject pauses',()=>{
 const c=env(true);
 c.botQaFrame(16.67,8,true);c.botQaFrame(33.3,12,true);
 c.botQaFrame(2000,0,true);c.botQaFrame(10,1,false);
 const q=c.botQaReport();
 assert.equal(q.frameTimeMs.count,2);
 assert.equal(q.frameJavaScriptWorkMs.count,2);
 assert.equal(q.frameJavaScriptWorkMs.median,8);
 assert.equal(q.frameTimeMs.median,16.67);
 assert.equal(q.frameTimeMs.p95,16.67);
 assert.equal(q.invalidOrSuspendedFrames,1);
 assert.ok(q.approximateFpsMedian>59&&q.approximateFpsMedian<61);
 assert.equal(q.botUpdateCpuMs.count,0);
});
test('M7: bot CPU timing remains separately sampled and bounded',()=>{
 const c=env(true);
 c.botQaCpu(2,9);c.botQaCpu(4,9);c.botQaCpu(8,9);
 c.botQaCpu(NaN,9);c.botQaCpu(100,0);
 const q=c.botQaReport();
 assert.equal(q.botUpdateCpuMs.count,3);
 assert.equal(q.botUpdateCpuMs.median,4);
 assert.equal(q.botUpdateCpuMs.p95,4);
});
test('M7: fired-projectile/character-hit denominator includes missed projectiles',()=>{
 const c=env(true),target={x:5,z:0},
   shooter={x:0,z:0,aimTarget:target},w={stats:{kind:'shotgun'}};
 c.botQaObserve(shooter,target);
 c.tt=1.25;
 const shots=[{},{},{},{},{},{}];
 shots.forEach(b=>c.botQaShot(shooter,w,'e',b));
 c.botQaHit(shots[0]);c.botQaHit(shots[1]);
 const q=c.botQaReport();
 assert.equal(q.projectileCount,6);
 assert.equal(q.characterProjectileHits,2);
 assert.equal(q.projectileHitPercent,33.33);
 assert.equal(q.byWeaponRange[0].rangeBand,'0-10');
 assert.equal(q.byWeaponRange[0].weaponKind,'shotgun');
 assert.equal(q.byWeaponRange[0].projectiles,6);
 assert.equal(q.byWeaponRange[0].characterHits,2);
 assert.equal(q.firstSightToShotMs.count,1,'one reaction sample for entire shotgun volley');
 assert.equal(q.firstSightToShotMs.median,250);
});
test('M7: losing sight before firing does not create fabricated reaction latency',()=>{
 const c=env(true),bot={},foe={x:12,z:1};
 c.botQaObserve(bot,foe);c.tt=1.35;c.botQaSightLost(bot);
 assert.equal(c.botQaReport().lostUnfiredSightings,1);
 assert.equal(c.botQaReport().firstSightToShotMs.count,0);
});
test('M7: player bullets are excluded from BOT-specific accuracy',()=>{
 const c=env(true);
 c.botQaShot({}, {stats:{kind:'rifle'}},'p',{});
 assert.equal(c.botQaReport().projectileCount,0);
});
test('M7: distance bands separate 0-10, 10-20, 20-30 and 30+',()=>{
 const c=env(true),t={x:0,z:0},b={x:0,z:0,aimTarget:t};
 const w={stats:{kind:'rifle'}};
 for(const dist of [4,14,24,44]){t.x=dist;c.botQaShot(b,w,'e',{});}
 assert.deepEqual(Array.from(c.botQaReport().byWeaponRange,x=>x.rangeBand),
   ['0-10','10-20','20-30','30+']);
});
test('M7: actual stalled movement seconds and failed A-star are distinct',()=>{
 const c=env(true);
 c.botQaMove(true,0,5,.05);c.botQaMove(true,.3,5,.05);
 c.botQaMove(false,0,5,.05);
 c.botQaPath([]);c.botQaPath([[1,1]]);
 const q=c.botQaReport();
 assert.equal(q.movementAttemptSeconds,.1);
 assert.equal(q.lowDisplacementSeconds,.05);
 assert.equal(q.pathAttempts,2);
 assert.equal(q.pathFailures,1);
});
test('M7: actual Bomb completion counting differentiates planted and unplanted',()=>{
 const c=env(true);
 c.botQaBomb(0,1,'planted');c.botQaBomb(1,0,'idle');
 const q=c.botQaReport();
 assert.equal(q.bombRounds.completed,2);
 assert.equal(q.bombRounds.policeWins,1);
 assert.equal(q.bombRounds.terroristWins,1);
 assert.equal(q.bombRounds.plantedAtFinish,1);
 assert.equal(q.bombRounds.siteA,1);
 assert.equal(q.bombRounds.siteB,1);
});
test('M7: bounded rolling samples and explicit reset prevent unbounded session growth',()=>{
 const c=env(true);
 for(let i=0;i<2420;i++){c.botQaFrame(16,2,true);c.botQaCpu(1,9);}
 assert.equal(c.botQaReport().frameTimeMs.count,2400);
 assert.equal(c.botQaReport().botUpdateCpuMs.count,2400);
 c.window.BlockBuddiesQA.reset();
 assert.equal(c.botQaReport().frameTimeMs.count,0);
 assert.equal(c.botQaReport().projectileCount,0);
});
test('M7: real source integration is opt-in, mode-agnostic and canonical-impact based',()=>{
 assert.match(read('src/game/99-render-loop.js'),/botQaFrame\(qaDeltaMs/);
 assert.match(read('src/game/95-simulation.js'),/botQaCpu\(performance\.now\(\)-qaBotStart/);
 assert.match(read('src/game/45-combat.js'),/botQaShot\(o,w,own,bl\[bl\.length-1\]\)/);
 assert.match(read('src/game/42-projectile-defense.js'),/botQaHit\(b\)/);
 assert.match(read('src/game/40-bot-aim.js'),/botQaObserve\(e,target\)/);
 assert.match(read('src/game/90-bot-ai.js'),/botQaMove\(wantedMovement,dm,sp,dt\)/);
 assert.match(read('src/game/86-bomb-mission.js'),/botQaBomb\(winner,b\.site,b\.state\)/);
 const parts=JSON.parse(read('tools/source-manifest.json')).parts;
 assert.ok(parts.indexOf('src/game/90-bot-ai.js')<parts.indexOf('src/game/94-bot-qa.js'));
 assert.ok(parts.indexOf('src/game/94-bot-qa.js')<parts.indexOf('src/game/95-simulation.js'));
 assert.match(read('src/game/41-bot-weapons.js'),/primaries:\[1,1,1,2,2,6,6,6,7,8\]/);
});
