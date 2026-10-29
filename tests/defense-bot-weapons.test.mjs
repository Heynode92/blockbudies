import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = p => readFileSync(resolve(root,p),'utf8');
function setup() {
  const table=src('src/game/40-weapons-and-viewmodels.js');
  const profiles=table.slice(table.indexOf('var WEAPON_PROFILES='),table.indexOf('// EW:'));
  const ctx={Math,Number,tt:0,grs:[],fireCalls:[],impactCalls:[],pl:{tm:0},
    mkGren(){return {tag:'grenade'};},
    clearTo(){return true;},
    fire(...args){this.fireCalls.push(args);},
    hurt(...args){this.impactCalls.push(['human',...args]);},
    dmgE(...args){this.impactCalls.push(['bot',...args]);},
    popPl(){ctx.pl.helm=false;},popHelm(e){e.helm=false;},
    fall(){return 1;}
  };
  runInNewContext(src('src/game/39-defense.js')+profiles+'\n'+src('src/game/41-bot-weapons.js')+'\n'+src('src/game/42-projectile-defense.js'),ctx);
  ctx.botVisualWeapon=(e,id)=>{e.visualWeapon=id;};
  ctx.fire=(...args)=>ctx.fireCalls.push(args);
  ctx.hurt=(...args)=>ctx.impactCalls.push(['human',...args]);
  ctx.dmgE=(...args)=>ctx.impactCalls.push(['bot',...args]);
  return ctx;
}
test('every spawn gets 100 HP, 50 vest and a helmet for both teams',()=>{
  const ctx=setup(),a={},b={};ctx.defenseSpawn(a);ctx.defenseSpawn(b);
  for(const actor of [a,b])assert.deepEqual([actor.hp,actor.vest,actor.helm],[100,50,true]);
});
test('body vest absorbs exactly 20 percent while durability remains',()=>{
  const ctx=setup(),a={vest:50};
  assert.ok(Math.abs(ctx.defenseDamage(a,33,'bullet-body')-26.4)<1e-9);
  assert.ok(Math.abs(a.vest-43.4)<1e-9);
});
test('vest depletion does not discard or over-reduce damage',()=>{
  const ctx=setup(),a={vest:2};assert.equal(ctx.defenseDamage(a,50,'bullet-body'),48);
  assert.equal(a.vest,0);assert.equal(ctx.defenseDamage(a,33,'bullet-body'),33);
});
test('head, knife and explosive damage ignore the vest',()=>{
  const ctx=setup(),a={vest:50};
  for(const kind of ['head','melee','explosive'])assert.equal(ctx.defenseDamage(a,40,kind),40);
  assert.equal(a.vest,50);assert.equal(ctx.defenseHeadshotDamage(33),99);
});
test('impact resolves human and AI with the same headshot and vest classification',()=>{
  const ctx=setup(),shot={dmg:33,fo:null,vx:1,vz:0,sx:0,sz:0,wid:1,by:{tm:1},m:{position:{x:1,z:1}}};
  const bot={helm:true,vest:50},pl={helm:true,vest:50};ctx.pl=pl;
  ctx.projectileHitCharacter(shot,bot,true);ctx.projectileHitCharacter(shot,pl,true);
  assert.equal(bot.helm,false);assert.equal(pl.helm,false);
  assert.equal(ctx.impactCalls[0][2],33);assert.equal(ctx.impactCalls[1][1],33);
  ctx.projectileHitCharacter(shot,bot,true);ctx.projectileHitCharacter(shot,pl,true);
  assert.equal(ctx.impactCalls[2][2],99);assert.equal(ctx.impactCalls[3][1],99);
  assert.equal(ctx.impactCalls[2].at(-1),'head');assert.equal(ctx.impactCalls[3].at(-1),'head');
});
test('bot loadout is drawn from shared WP with finite ammo and a sidearm',()=>{
  const ctx=setup();ctx.Math=Object.create(Math);ctx.Math.random=()=>.2;
  const e={g:null,ms:[]};ctx.botInitialLoadout(e);
  assert.ok(ctx.BOT_WEAPONS.primaries.includes(e.primary));
  assert.equal(e.ammo[e.primary].mag,ctx.WP[e.primary].mag);
  assert.equal(e.ammo[0].res,52);assert.equal(e.ammo[5].mag,2);
  assert.equal(e.ammo[e.primary].res,ctx.WP[e.primary].res);
});
test('bot uses its weapon profile damage, cooldown, range, and consumes ammunition',()=>{
  const ctx=setup(),e={primary:1,weapon:1,ammo:{1:{mag:30,res:90},0:{mag:13,res:52}},reloadId:null,cd:0,ms:[],g:null},target={x:6,z:6};
  assert.equal(ctx.botAttack(e,target,0,10),true);
  assert.equal(ctx.fireCalls.length,1);assert.equal(ctx.fireCalls[0][2],ctx.WP[1]);
  assert.equal(ctx.fireCalls[0][3],'e');assert.equal(e.ammo[1].mag,29);
  assert.equal(e.cd,ctx.WP[1].cd);assert.equal(e.weapon,1);
  assert.equal(ctx.botAttack(e,target,0,200),false);
});
test('bot reloads with WP reload duration and finite reserves',()=>{
  const ctx=setup(),e={primary:1,ammo:{1:{mag:0,res:42},0:{mag:13,res:52}},reloadId:null,ms:[],g:null};
  ctx.botChooseWeapon(e,20);assert.equal(e.reloadId,1);
  ctx.botUpdateReload(e,ctx.WP[1].rt);
  assert.equal(e.ammo[1].mag,30);assert.equal(e.ammo[1].res,12);
  assert.equal(e.reloadId,null);
});
test('bot can use melee at point blank and grenade with shared WP damage',()=>{
  const ctx=setup(),e={tm:1,x:0,z:0,y:0,primary:6,weapon:6,ammo:{6:{mag:30,res:210},0:{mag:13,res:52},5:{mag:2,res:2}},reloadId:null,ms:[],g:null,cd:0};
  const enemy={tm:0,dead:false,x:1,z:0};
  assert.equal(ctx.botAttack(e,enemy,Math.PI/2,1),true);
  assert.equal(ctx.impactCalls[0][2],ctx.WP[4].dmg);
  assert.equal(ctx.impactCalls[0].at(-1),'melee');
  assert.equal(ctx.botThrowGrenade(e,0),true);assert.equal(e.ammo[5].mag,1);
  assert.equal(ctx.grs[0].by,e);
});
test('bot melee chase activated only when primary and pistol stocks are depleted',()=>{
  const ctx=setup(),e={primary:1,ammo:{1:{mag:0,res:0},0:{mag:0,res:0}}};
  assert.equal(ctx.botNeedsMelee(e),true);e.ammo[0].res=1;assert.equal(ctx.botNeedsMelee(e),false);
});
test('player HUD shows armor without changing the existing HP indicator',()=>{
  const html=src('index.html');assert.match(html,/id="hpt"/);assert.match(html,/id="vestHud"/);
  const hud=src('src/game/96-hud-and-radar.js');assert.match(hud,/Math.ceil\(pl.vest\)/);
});
