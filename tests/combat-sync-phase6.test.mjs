import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const extract=(source,start)=>{const a=source.indexOf('function '+start+'(');assert.ok(a>=0,start);
 const b=source.indexOf('\nfunction ',a+10);return source.slice(a,b<0?source.length:b);};
function combat(){
 const c={Math,Number,Object,WEAPON_PROFILES:[
  {kind:'rifle'},{kind:'shotgun',pump:true},{kind:'shotgun',pump:false}]};
 runInNewContext(read('src/game/39-defense.js'),c);return c;
}
test('FE/BE combat revision, anatomical head, body reduction and non-consumable vest stay compatible',()=>{
 const c=combat();
 assert.equal(c.COMBAT_SYNC_REVISION,'pointblock-combat-sync-2026-11-05-p6');
 assert.equal(c.DEFENSE_RULES.bodyReduction,.30);
 assert.equal(c.DEFENSE_RULES.pumpShotgunBodyReduction,.20);
 assert.equal(c.HITGROUP_RULES.revision,'pointblock-hitgroup-2026-11-05-p2');
 assert.equal(c.CHARACTER_HITBOX_RULES.revision,'pointblock-hitbox-2026-11-05-p3');
 for(const [g,scale] of [['chest',1],['stomach',1.25],['arm',1],['leg',.75]])
  assert.ok(Math.abs(c.defenseDamage({},40,'bullet-body',0,g)-40*scale*.7)<1e-9);
 assert.ok(Math.abs(c.defenseDamage({},40,'bullet-body',1,'chest')-32)<1e-9);
 assert.equal(c.defenseHeadshotDamage(40),120);
 const pose={x:0,y:0,z:8,yaw:0,crouch:false,gaitPhase:0,gaitPace:0};
 const h=c.sweptCharacterHit({x:0,y:1.65,z:0},{x:0,y:1.65,z:15},pose);
 assert.equal(h?.hitgroup,'head');
 assert.equal(c.sweptCharacterHit({x:.4,y:1.65,z:0},{x:.4,y:1.65,z:15},pose),null);
 assert.doesNotMatch(read('index.html'),/id=["'](?:vest|vestBar|vestDurability)["']/i);
 assert.match(read('index.html'),/id="hmt"/);
});
test('explosions use the same distance attenuation for BOT, human and BE without bullet-body defense',()=>{
 const c=combat(),rules=c.EXPLOSION_DAMAGE_RULES;
 assert.equal(rules.radius,4.2);assert.equal(rules.edgeReduction,.8);
 for(const [d,expected]of [[0,40],[1.05,32],[2.1,24],[3.15,16],[4.2,0]]) {
  assert.equal(c.defenseExplosionDamage(40,d),expected,`distance ${d}`);
  assert.equal(c.defenseDamage({},expected,'explosive',0,'leg'),expected);
 }
 const boom=read('src/game/45-combat.js');
 assert.match(boom,/dmgE\(e,defenseExplosionDamage\(dmg,dd\)/);
 assert.match(boom,/hurt\(defenseExplosionDamage\(dmg,pd\)/);
 assert.match(boom,/dmgE\(attacker,defenseExplosionDamage\(dmg,selfDistance\)/);
 for(const n of [-1,NaN,Infinity])
  assert.throws(()=>c.defenseExplosionDamage(40,n),e=>e?.name==='RangeError');
});
test('only local-server-confirmed hits render an own-player marker; invalid group is not a headshot',()=>{
 const source=read('src/game/98-online-bridge.js');
 const calls=[],effects=[],c={
  onlineActive:true,onlineCombatQa:{confirmedHits:0,lastEvent:''},
  onlineUserId:()=> 'self',onlineHitConfirm:head=>calls.push(head),
  onlineReactToImpact:(id,head,own)=>effects.push({id,head,own})
 };
 runInNewContext(extract(source,'onlineReceiveFrame'),c);
 c.onlineReceiveFrame({type:'combat_hit',actorId:'someone-else',victimId:'enemy',headshot:true});
 assert.equal(calls.length,0,'a teammate headshot may not become my hitmarker');
 c.onlineReceiveFrame({type:'combat_hit',actorId:'self',victimId:'enemy',headshot:true,hitgroup:'chest'});
 c.onlineReceiveFrame({type:'combat_hit',actorId:'self',victimId:'enemy',headshot:true,hitgroup:'head'});
 assert.equal(calls.length,2);
 assert.deepEqual(calls,[false,true]);
 assert.equal(c.onlineCombatQa.confirmedHits,2);
 assert.equal(effects.length,2);
 assert.match(source,/combatRevision===COMBAT_SYNC_REVISION/);
 assert.match(source,/ballisticRevision===GUNPLAY_REVISION/);
});
test('same-tick verified headshot kill still renders once after snapshot has advanced',()=>{
 const bridge=read('src/game/98-online-bridge.js'),calls=[];
 const c={
  onlineSeenKillIds:new Set(),onlineActive:true,run:true,lob:false,
  onlineUserId:()=> 'self',pl:{st:{k:3}},score:3,
  onlineLastAuthTick:100,onlinePendingKillTick:-1,onlinePendingKillTotal:null,
  onlineSyncKillDisplay:()=>{},ck:{n:0,hs:0},hsF:false,
  killNotify:()=>calls.push(c.hsF),Number
 };
 runInNewContext(extract(bridge,'onlineApplyVerifiedKill'),c);
 const event={id:'verified-123',tick:100,actorId:'self',victimId:'enemy',kills:3,streak:3,headshot:true};
 c.onlineApplyVerifiedKill(event);c.onlineApplyVerifiedKill(event);
 assert.deepEqual(calls,[true],'same tick event must preserve HEADSHOT and avoid duplication');
 c.onlineApplyVerifiedKill({...event,id:'old-kill',kills:2});
 assert.equal(calls.length,1,'older total cannot display fake headshot');
});
test('kill feed keeps weapon/headshot icons without interpolating public player names as HTML',()=>{
 const hud=read('src/game/70-kills-and-damage-hud.js'),names=[];
 function element(tag){
  return {tag,children:[],style:{},className:'',innerHTML:'',
   appendChild(node){this.children.push(node);return node;},
   set textContent(value){names.push(String(value));this._text=String(value);},
   get textContent(){return this._text??'';},
   get firstElementChild(){return {tag:'headshot-icon'};},
   get offsetWidth(){return 1;},
   classList:{add(){}}
  };
 }
 const KF=element('kill-feed'),pl={name:'self',tm:0};
 const c={document:{createElement:element},KF,KFL:[],SV:['trusted-local-icon'],HSI:'<span class="hsi"></span>',pl};
 runInNewContext(extract(hud,'kFeed'),c);
 const evil='<img src=x onerror=alert(1)>';
 c.kFeed({name:evil,tm:1},0,true,pl);
 assert.ok(names.includes(evil),'public text is displayed literally, not executed');
 assert.equal(KF.children.length,1);
 assert.equal(KF.children[0].children.length,4,'killer, weapon, headshot marker, victim');
});
