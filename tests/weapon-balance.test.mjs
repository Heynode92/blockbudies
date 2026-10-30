import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read=name=>readFileSync(resolve(root,name),'utf8');
const weaponTable=JSON.parse(read('tools/source-manifest.json')).parts.filter(p=>p.startsWith('src/game/weapon/')&&!p.endsWith('30-viewmodels.js')).map(read).join('');
function load(){const sandbox={Math};runInNewContext(weaponTable+'\nthis.profiles=WEAPON_PROFILES;this.weapons=WP;this.tuning=WEAPON_TUNING;',sandbox);return sandbox;}
const expected=[
 ['Handgun',26,84,87,93,61,61,13,52,45],
 ['AK-47',33,88,44,74,69,62,30,90,140],
 ['Shotgun',168,48,58,79,100,78,6,30,70],
 ['RPG',85,35,25,48,100,85,1,6,65],
 ['Knife',60,null,100,98,null,null,1,Infinity,1],
 ['Grenade',40,null,null,98,null,null,2,2,null],
 ['Kriss',21,93,59,90,48,48,30,210,60],
 ['Dual Kriss',18,93,59,90,48,48,125,0,60],
 ['AWP',81,39,66,69,60,60,5,64,180],
 ['K2',36,96,75,79,66,33,40,200,120],
 ['MP7',21,93,60,88,45,54,30,200,60],
 ['P90',24,92,54,88,45,48,50,200,65],
 ['AK SOPMOD',33,90,50,74,64,60,30,150,160]
];

test('original thirteen weapon profiles keep exact approved stats within expanded catalog',()=>{
 const {profiles}=load();assert.ok(profiles.length>=expected.length);
 for(let i=0;i<expected.length;i++){
  const p=profiles[i];let fields=['name','damage','rpm','control','speed','vRecoil','hRecoil','mag','res','range'];
  fields.forEach((f,j)=>assert.equal(p[f],expected[i][j],`${p.name}.${f}`));
 }
});
test('shotgun 168 is total damage for 6 pellets (28 each), not 1008',()=>{
 const w=load().weapons[2];assert.equal(w.pel,6);assert.equal(w.dmg,28);assert.equal(w.pel*w.dmg,168);
});
test('all ranged gun damage and ammo are real runtime values',()=>{
 const {weapons}=load();for(const i of [0,1,3,6,7,8,9,10,11,12]){
  assert.equal(weapons[i].dmg,expected[i][1]);assert.equal(weapons[i].mag,expected[i][7]);assert.equal(weapons[i].res,expected[i][8]);
 }
 assert.equal(weapons[4].dmg,60);assert.equal(weapons[5].dmg,40);
});
test('maximum projectile travel corresponds to requested range without early expiry',()=>{
 const {weapons}=load();for(const i of [0,1,2,3,6,7,8,9,10,11,12]){
  assert.ok(Math.abs(weapons[i].spd*weapons[i].life-expected[i][9])<1e-9,`${weapons[i].n} range`);
 }
});
test('RPM scores derive plausible class-based cooldowns and are not interpreted as raw RPM',()=>{
 const {weapons}=load();assert.ok(weapons[1].cd<.1&&weapons[1].cd>.06);
 assert.ok(weapons[6].cd<.1&&weapons[6].cd>.04);
 assert.ok(weapons[2].cd>.6);
 assert.ok(weapons[8].cd>1.1);
 for(const w of weapons)assert.ok(Number.isFinite(w.cd)&&w.cd>0,w.n);
});
test('control ratings affect angular spread; speed affects player movement multiplier',()=>{
 const {weapons}=load();assert.ok(weapons[0].spr<weapons[1].spr);
 assert.ok(weapons[4].moveMult>weapons[8].moveMult);
 assert.ok(weapons[6].moveMult>weapons[1].moveMult);
 assert.ok(weapons[7].spr>0);
});
test('recoil is calculated from vertical and horizontal ratings rather than old per-id arrays',()=>{
 const {weapons}=load(),s=read('src/game/65-audio.js');
 const snippet=s.slice(s.indexOf('var CKV='),s.indexOf('// camShot('));
 const ctx={WP:weapons,Math};runInNewContext(snippet+'\nthis.recoil={CKV,CKY,CKR,CKS};',ctx);
 assert.equal(ctx.recoil.CKV.length,weapons.length);
 assert.equal(ctx.recoil.CKV[4],0);assert.equal(ctx.recoil.CKV[5],0);
 assert.ok(ctx.recoil.CKV[2]>ctx.recoil.CKV[1]);
 assert.ok(ctx.recoil.CKY[1]>0);
});
test('knife reach and explosive grenade damage reference weapon table, not old constants',()=>{
 const s=read('src/game/75-weapon-controls.js');
 assert.match(s,/d<WP\[4\]\.range\+\.8/);
 assert.match(s,/boom\(g\.x,g\.z,WP\[5\]\.dmg,"GRENADE"\)/);
});
test('grenade use consumes 2/2 stock; after two throws triggers reserve reload',()=>{
 const s=read('src/game/75-weapon-controls.js');
 const fn=s.slice(s.indexOf('function throwG(){'),s.indexOf('// updG('));
 let reloads=0;
 const ctx={Math,pl:{mag:2,res:2,face:0,pitch:0,x:0,z:0,y:0},grs:[],mkGren(){return {};},reload(){reloads++;}};
 runInNewContext(fn,ctx);ctx.throwG();assert.equal(ctx.pl.mag,1);assert.equal(reloads,0);
 ctx.throwG();assert.equal(ctx.pl.mag,0);assert.equal(reloads,1);assert.equal(ctx.grs.length,2);
});
test('pistol ammo is finite and empty fallback uses knife instead of infinite pistol loop',()=>{
 const {weapons}=load();assert.equal(weapons[0].res,52);assert.ok(Number.isFinite(weapons[0].res));
 const s=read('src/game/95-simulation.js');assert.match(s,/var pistol=amo\(0\),next=pistol.mag\+pistol.res>0\?1:2/);
});
test('generated gameplay bundle contains the same updated feature modules and parses',()=>{
 const bundle=read('assets/game.js');
 for(const p of ['src/game/weapon/20-ballistics.js','src/game/weapon/30-viewmodels.js','src/game/65-audio.js','src/game/70-kills-and-damage-hud.js','src/game/75-weapon-controls.js','src/game/95-simulation.js']){
  assert.ok(bundle.includes(read(p)),`${p} is contained in bundle`);
 }
 assert.ok(bundle.includes('AK-47'));
});
