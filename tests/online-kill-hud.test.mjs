import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../src/game/98-online-bridge.js',import.meta.url),'utf8');
const begin=source.indexOf('function onlineRestoreKillStars('),end=source.indexOf('// Match settlement is BE-owned.',begin);
assert.ok(begin>=0&&end>begin);
const adapter=source.slice(begin,end);
function harness(){
 const stars=[],notices=[],c={onlineSeenKillIds:new Set(),onlineActive:true,run:true,lob:false,
  score:0,ck:{n:0,hs:0},hsF:false,onlineLastAuthTick:0,pl:{st:{k:0,d:0}},
  onlineUserId(){return 'me';},STAR:'<svg/>',stnEl:{textContent:''},
  document:{createElement(){return {}}}};
 c.starsEl={querySelectorAll(){return stars},insertBefore(el){stars.push(el)}};
 c.starsReset=()=>{stars.length=0;c.stnEl.textContent=''};
 let animations=0;
 c.starKill=()=>{animations++;if(stars.length===8)stars.shift();stars.push({});c.stnEl.textContent='×'+c.score};
 c.killNotify=()=>notices.push({n:c.ck.n,headshot:c.hsF});
 runInNewContext(adapter+'\nthis.sync=onlineSyncKillDisplay;this.kill=onlineApplyVerifiedKill;',c);
 return {c,stars,notices,get animations(){return animations}};
}
test('server-owned KILL event drives same score, original stars and milestone',()=>{
 const h=harness(),{c,stars,notices}=h;
 c.kill({id:'a',tick:10,actorId:'me',streak:1,headshot:false});
 assert.equal(c.score,1);assert.equal(c.pl.st.k,1);assert.equal(stars.length,1);
 assert.equal(h.animations,1);assert.equal(notices[0].n,1);
 c.kill({id:'a',tick:10,actorId:'me',streak:1,headshot:false});
 c.kill({id:'b',tick:11,actorId:'enemy',streak:2});
 assert.equal(h.animations,1);assert.equal(c.score,1);
 c.kill({id:'c',tick:12,actorId:'me',streak:2,headshot:true});
 assert.equal(c.score,2);assert.equal(h.animations,2);
 assert.equal(notices[1].n,2);assert.equal(notices[1].headshot,true);assert.equal(c.hsF,false);
});
test('snapshot rehydrates old stars without animation or invented kill',()=>{
 const h=harness(),{c,stars,notices}=h;
 c.sync(5,false);assert.equal(c.score,5);assert.equal(stars.length,5);
 assert.equal(c.stnEl.textContent,'×5');assert.equal(h.animations,0);
 c.sync(11,false);assert.equal(stars.length,8);assert.equal(c.stnEl.textContent,'×11');
 c.sync(3,false);assert.equal(c.score,3);assert.equal(stars.length,3);
 c.kill({id:'stale',tick:0,actorId:'me',streak:3});
 assert.equal(c.score,3);assert.equal(h.animations,0);assert.equal(notices.length,0);
});
test('bridge binds BE K/D, life streak and death reset',()=>{
 assert.match(source,/onlineSyncKillDisplay\(privateState\.kills,false\)/);
 assert.match(source,/ck\.n=privateState\.streak/);
 assert.match(source,/!self\.alive&&onlinePrevAlive\)\{resetKillStreak\(\)/);
 assert.match(source,/onlineSeenKillIds\.clear\(\)/);
 assert.match(source,/onlineApplyVerifiedKill\(event\)/);
});
