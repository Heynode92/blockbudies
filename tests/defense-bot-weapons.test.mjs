import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = p => readFileSync(resolve(root,p),'utf8');
function setup() {
  const profiles=JSON.parse(src('tools/source-manifest.json')).parts.filter(p=>p.startsWith('src/game/weapon/')&&!p.endsWith('30-viewmodels.js')).map(src).join('');
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
  // Weapon-contract test isolates ammo/range/cooldown; M2 aim legality has dedicated tests.
  ctx.botAimShot=()=>({yaw:0,pitch:0});
  ctx.botVisualWeapon=(e,id)=>{e.visualWeapon=id;};
  ctx.fire=(...args)=>ctx.fireCalls.push(args);
  ctx.hurt=(...args)=>ctx.impactCalls.push(['human',...args]);
  ctx.dmgE=(...args)=>ctx.impactCalls.push(['bot',...args]);
  return ctx;
}
test('every actor spawns with 100 HP, helmet and no consumable armor',()=>{
  const c=setup(),human={},bot={};c.defenseSpawn(human);c.defenseSpawn(bot);
  for(const actor of [human,bot]){
    assert.deepEqual([actor.hp,actor.helm],[100,true]);
    assert.equal(Object.hasOwn(actor,'vest'),false);
  }
});
test('every ordinary body bullet gets permanent 30 percent mitigation',()=>{
  const c=setup(),human={},bot={};
  for(const actor of [human,bot])for(let i=0;i<4;i++){
    assert.equal(c.defenseDamage(actor,40,'bullet-body',9),28);
    assert.equal(Object.hasOwn(actor,'vest'),false);
  }
  assert.equal(c.DEFENSE_RULES.bodyReduction,.30);
});
test('pump Shotgun alone penetrates passive defense with five close-range pellets',()=>{
  const c=setup(),pump=c.WEAPON_PROFILES.find(w=>w.kind==='shotgun'&&w.pump===true);
  assert.ok(pump);assert.equal(pump.damage,168);
  const pumpId=c.WEAPON_PROFILES.indexOf(pump),raw=pump.damage/c.WP[pumpId].pel;
  assert.equal(c.WP[pumpId].pel,6);
  assert.equal(c.DEFENSE_RULES.pumpShotgunBodyReduction,.20);
  assert.ok(Math.abs(c.defenseDamage({},raw,'bullet-body',pumpId)-raw*.8)<1e-9);
  for(const range of [0,5]){
    let hp=100;
    for(let p=0;p<5;p++)hp-=c.defenseDamage({},raw*Math.pow(.7,range/20),'bullet-body',pumpId);
    assert.ok(hp<=0,'five valid torso pellets must eliminate 100 HP at '+range);
  }
  const saigaId=c.WEAPON_PROFILES.findIndex(w=>w.kind==='shotgun'&&!w.pump);
  assert.ok(saigaId>=0);
  assert.ok(Math.abs(c.defenseDamage({},40,'bullet-body',saigaId)-28)<1e-9);
});
test('head, knife, RPG splash and explosive damage bypass passive bullet defense',()=>{
  const c=setup(),actor={};
  for(const kind of ['head','melee','explosion'])assert.equal(c.defenseDamage(actor,40,kind,2),40);
  assert.equal(c.defenseHeadshotDamage(33),99);
});
test('impact preserves identical human/BOT headshot classification and weapon context',()=>{
  const c=setup(),shot={dmg:33,fo:null,vx:1,vz:0,sx:0,sz:0,wid:1,by:{tm:1},m:{position:{x:1,z:1}}};
  const bot={helm:true},pl={helm:true};c.pl=pl;
  c.projectileHitCharacter(shot,bot,true);c.projectileHitCharacter(shot,pl,true);
  assert.equal(bot.helm,false);assert.equal(pl.helm,false);
  assert.equal(c.impactCalls[0][2],33);assert.equal(c.impactCalls[1][1],33);
  c.projectileHitCharacter(shot,bot,true);c.projectileHitCharacter(shot,pl,true);
  assert.equal(c.impactCalls[2][2],99);assert.equal(c.impactCalls[3][1],99);
  assert.equal(c.impactCalls[2].at(-3),'head');assert.equal(c.impactCalls[3].at(-3),'head');
  assert.equal(c.impactCalls[2].at(-2),1);assert.equal(c.impactCalls[3].at(-2),1);
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
test('player HUD retains HP and helmet but hides retired VEST durability',()=>{
  const html=src('index.html');assert.match(html,/id="hpt"/);assert.match(html,/id="hmt"/);
  assert.doesNotMatch(html,/id="vestHud"/);
  const hud=src('src/game/96-hud-and-radar.js');assert.match(hud,/Math.ceil\(hp\)/);
  assert.doesNotMatch(hud,/pl\.vest|vestHud/);
  const bridge=src('src/game/98-online-bridge.js');assert.doesNotMatch(bridge,/pl\.vest/);
});
