import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const src=(name)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const inventory=src('src/game/89-inventory.js');
const controls=src('src/game/75-weapon-controls.js');
const bridge=src('src/game/98-online-bridge.js');
function extract(text,begin,end){
 const from=text.indexOf(begin),to=text.indexOf(end,from);
 assert.ok(from>=0&&to>from,'missing source '+begin);
 return text.slice(from,to);
}
test('unverified inventory collection remains empty, but fixed match slots have valid canonical IDs',()=>{
 const code=extract(inventory,'function inventoryOwned(cat){','function inventoryLoad(){');
 const state={WP:[],INVENTORY_TABS:[
  {key:'main',kinds:['rifle']},{key:'secondary',kinds:['pistol']},
  {key:'mele',kinds:['knife']},{key:'explosive',kinds:['grenade']}],
  INVENTORY_GEAR:{},inventoryServerLoaded:false,
  inventoryState:{equipped:{main:9,secondary:0,mele:4,explosive:5}},
  inventoryCatalogMain(){return[9]},inventoryServerOwned:new Set()};
 state.WP[0]={stats:{kind:'pistol'}};state.WP[4]={stats:{kind:'knife'}};
 state.WP[5]={stats:{kind:'grenade'}};state.WP[9]={stats:{kind:'rifle'}};
 runInNewContext(code+'\nthis.owned=inventoryOwned;this.equipped=inventoryEquipped;',state);
 assert.deepEqual(Array.from(state.owned('main')),[],'private collection stays invisible');
 assert.deepEqual(Array.from(state.owned('secondary')),[]);
 assert.equal(state.equipped('main'),null,'no unverified primary entitlement');
 assert.equal(state.equipped('secondary'),0);
 assert.equal(state.equipped('mele'),4);
 assert.equal(state.equipped('explosive'),5);
});
test('missing fixed slot can never crash original in-game HUD or weapon shortcut',()=>{
 const ctx={pl:{w:9,prim:9,slot:0,mag:40,res:200,ammo:{9:{mag:40,res:200}}},WP:[],
  inventoryEquipped(){return null;},slEls:[],slKey:[],E:{mg:{},rs:{}},SV:{},
  amo(id){return id===ctx.pl.w?ctx.pl:ctx.pl.ammo[id];},
  swW(){throw Error('invalid switch')},reload(){},toast(){}};
 ctx.WP[9]={n:'K2',stats:{kind:'rifle'}};
 for(let i=0;i<4;i++)ctx.slEls.push({className:'',children:[{}, {textContent:'',innerHTML:''},{textContent:''},{textContent:''}]});
 const sw=extract(controls,'function swSlot(s){','// doStab()');
 const ui=extract(controls,'function slotUI(w){','// ===== PRIMARY WEAPON SELECT');
 runInNewContext(sw+'\n'+ui+'\nthis.slot=swSlot;this.paint=slotUI;',ctx);
 assert.doesNotThrow(()=>ctx.paint({melee:false}));
 assert.equal(ctx.slEls[1].children[3].textContent,'—');
 assert.doesNotThrow(()=>ctx.slot(1),'no null-ammo dereference');
 assert.equal(ctx.pl.w,9);
});
test('completed match has bounded finalizer independent of render animation and initial loadout rehydrates',()=>{
 assert.match(bridge,/onlineResultFallbackTimer=setTimeout\(function\(\)/);
 assert.match(bridge,/onlineFinalizeCompletedMatch\(completed\)/);
 assert.match(bridge,/clearTimeout\(onlineResultFallbackTimer\)/);
 assert.match(bridge,/await onlineLoadInventory\(\)\.catch\(onlineWarn\)/);
 assert.match(bridge,/function onlineResetLive\(\)/);
});

test('verified match completion opens results after bounded corpse wait even if RAF stopped',()=>{
 const start=bridge.indexOf(" if(frame.type==='match_completed'){");
 const end=bridge.indexOf(" if(frame.type==='training_result')",start);
 assert.ok(start>=0&&end>start);
 const calls=[],timers=[],ctx={
  onlineActive:true,dead:[{t:0}],onlinePendingMatchCompleted:null,
  onlineResultFallbackTimer:null,
  clearTimeout(){},
  setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},
  onlineFinalizeCompletedMatch(frame){calls.push(frame.matchId);}
 };
 runInNewContext('function receipt(frame){'+bridge.slice(start,end)+'}\nthis.receipt=receipt;',ctx);
 ctx.receipt({type:'match_completed',matchId:'trusted-match'});
 assert.equal(calls.length,0,'preserve existing ragdoll animation first');
 assert.equal(ctx.onlinePendingMatchCompleted.matchId,'trusted-match');
 assert.equal(timers.length,1);
 assert.equal(timers[0].ms,2200);
 timers[0].fn();
 assert.deepEqual(calls,['trusted-match'],'show verified result without waiting forever');
 assert.equal(ctx.onlinePendingMatchCompleted,null);
 ctx.receipt({type:'match_completed',matchId:'new-match'});
 assert.equal(timers.length,2);
 ctx.dead.length=0;timers[1].fn();
 assert.deepEqual(calls,['trusted-match','new-match']);
});
