import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('index.html'),css=read('src/styles/18-room-lobby-redesign.css');
const profile=read('src/game/82-home-showcase.js');
const bridge=read('src/game/98-online-bridge.js');
const part=html.slice(html.indexOf('<section id="lbrooms"'),html.indexOf('<section id="lbroomlive"'));
test('header contains ONLY nickname; rank/EXP exists only under actual 3D lobby operator',()=>{
 const start=html.indexOf('<header id="gameLobbyHeader"');
 const header=html.slice(start,html.indexOf('</header>',start));
 assert.match(header,/id="homeHeaderUsername"/);
 for(const id of ['homeProgressPanel','homeRankName','homeRankExp','homeRankFill'])
  assert.doesNotMatch(header,new RegExp('id="'+id+'"'),'rank and EXP must not be in shared header');
 const preview=part.indexOf('id="roomBrowserPreview"'),stats=part.indexOf('id="homeProgressPanel"');
 assert.ok(preview>=0&&stats>preview);
 assert.match(part,/id="homeRankCallsign"/);
 assert.match(part,/id="homeRankName"/);
 assert.match(part,/id="homeRankExp"/);
 assert.match(part,/aria-label="Current rank EXP"/);
 assert.match(part,/id="roomEntries"/);
});
test('nickname and rank come from separate authenticated backend fields; half-unit EXP remains server-derived',()=>{
 const start=profile.indexOf('function homeProfileRender('),end=profile.indexOf('function homeWalletRender(',start);
 assert.ok(start>=0&&end>start);
 const elements=new Map();
 const get=id=>{
  if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',style:{},attrs:{},setAttribute(k,v){this.attrs[k]=v},querySelector(){return get('rank-meter')}});
  return elements.get(id);
 };
 const ctx={document:{getElementById:get},homeFormatHalf(v){return Number.isInteger(v)?String(v/2):typeof v==='string'?String(Number(v)/2):'—'},Number,String,Math};
 runInNewContext(profile.slice(start,end)+'\nthis.render=homeProfileRender;',ctx);
 ctx.render({authenticated:true,registered:true,player:{username:'FIFO',rank:'Corporal',rankIndex:3,
  currentRankHalfExp:76,nextRankHalfExp:800,currentHalfVpbt:'1712'}});
 assert.equal(get('homeHeaderUsername').textContent,'FIFO');
 assert.equal(get('homeRankCallsign').textContent,'FIFO');
 assert.equal(get('homeRankName').textContent,'Corporal');
 assert.equal(get('homeRankExp').textContent,'38 / 400');
 assert.equal(get('homeRankFill').style.width,'9.5%');
 ctx.render({authenticated:false,registered:false,player:null});
 assert.equal(get('homeIdentityChip').hidden,true);
 assert.equal(get('homeProgressPanel').hidden,true);
});
test('room render still reads actual backend roomList; online browser does not claim local-only rooms',()=>{
 assert.match(bridge,/document\.getElementById\('roomBrowserModeLabel'\)\.textContent='ONLINE MATCHES · 5V5'/);
 assert.match(bridge,/roomList\.forEach\(function\(r\)/);
 assert.match(part,/id="roomBrowserStatusLabel"/);
 for(const id of ['roomCreateOpen','roomRefresh','roomQuickInventory','roomQuickShop','roomQuickSettings'])
  assert.match(part,new RegExp('id="'+id+'"'));
 assert.match(css,/#lbrooms \.room-identity-card/);
 assert.match(css,/#lbrooms \.room-browser-preview/);
 assert.match(css,/#lbrooms \.room-list-panel/);
 assert.doesNotMatch(css,/url\(|data:image|background-image:/i);
});
