import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const bridge=readFileSync(new URL('../src/game/98-online-bridge.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/17-online.css',import.meta.url),'utf8');
const foundation=readFileSync(new URL('../src/styles/01-foundation.css',import.meta.url),'utf8');

test('results play exactly 2 sec silent battlefield, 2 sec banner, then the original report',()=>{
 const begin=bridge.indexOf('var ONLINE_MATCH_END_TIMING=');
 const end=bridge.indexOf('var onlineRewardMatchId=',begin);
 assert.ok(begin>0&&end>begin);
 let pending=null,resultCount=0,nextId=0;
 const timers=new Map();
 const display={hidden:true,classList:{
  classes:new Set(),
  toggle(name,enabled){if(enabled)this.classes.add(name);else this.classes.delete(name)},
  remove(...names){for(const name of names)this.classes.delete(name)},
 }};
 const label={textContent:''};
 const ctx={
  onlineActive:true,onlineTraining:false,onlineMatchId:'match-1',
  onlinePendingMatchCompleted:null,onlineResultFallbackTimer:null,
  onlineFinalizeCompletedMatch:()=>{resultCount++},
  document:{getElementById:id=>id==='matchWinnerBanner'?display:id==='matchWinnerText'?label:null},
  isBombMode:()=>true,Object,
  setTimeout:(callback,delay)=>{const id=++nextId;timers.set(id,{callback,delay});return id},
  clearTimeout:id=>{timers.delete(id)},
 };
 runInNewContext(bridge.slice(begin,end)+
  '\nthis.queue=onlineQueueCompletedMatch;this.hide=onlineHideMatchWinnerBanner;',ctx);
 const frame={matchId:'match-1',winner:1,game:{status:'COMPLETED',rounds:[1,3]}};
 ctx.queue(frame);ctx.queue(frame);
 assert.equal(timers.size,1,'duplicate server completion must not duplicate results');
 assert.equal([...timers.values()][0].delay,2000);
 assert.equal(display.hidden,true);
 const first=[...timers.entries()][0];timers.delete(first[0]);first[1].callback();
 assert.equal(display.hidden,false);
 assert.equal(label.textContent,'TERORIS WIN');
 assert.equal(resultCount,0);
 const second=[...timers.entries()][0];
 assert.equal(second[1].delay,2000);
 timers.delete(second[0]);second[1].callback();
 assert.equal(resultCount,1);
 ctx.hide();
 assert.equal(display.hidden,true);
 assert.match(bridge,/onlineQueueCompletedMatch\(frame\)/);
 assert.match(bridge,/onlineHideMatchWinnerBanner\(\)/);
});

test('winner display reuses centralized game display font token, no inline font',()=>{
 assert.match(html,/id="matchWinnerBanner"/);
 assert.match(html,/id="matchWinnerText"/);
 assert.match(css,/font-family:var\(--pb-display-font\)/);
 assert.match(foundation,/--pb-display-font:/);
 assert.doesNotMatch(bridge,/style\.fontFamily\s*=/);
});

test('remote actor animation follows the OFFLINE traveled-distance gait and rejects jump spikes',()=>{
 const offline=readFileSync(new URL('../src/game/90-bot-ai.js',import.meta.url),'utf8');
 assert.match(offline,/e\.wp=\(e\.wp\|\|0\)\+dm\*2\.4/);
 assert.match(bridge,/bot\.wp=\(bot\.wp\|\|0\)\+moved\*2\.4/);
 assert.match(bridge,/allowedStep=MOVEMENT_RULES\.baseSpeed\*weaponRating/);
 assert.match(bridge,/Math\.min\(travelled,allowedStep\)/);
 assert.match(bridge,/bot\.walkPace=/);
 assert.doesNotMatch(bridge,/Math\.min\(\.5,Math\.hypot\(sample\.x-oldX/);
});
