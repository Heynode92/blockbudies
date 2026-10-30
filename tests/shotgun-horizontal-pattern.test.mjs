import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8').replace(/\r\n/g,'\n');
const helper=read('src/game/weapon/21-shotgun-spread-pattern.js');
const combat=read('src/game/45-combat.js');
const fireSrc=combat.slice(combat.indexOf('function fire('),combat.indexOf('// boom():'));
function pattern(n){
 const c=vm.createContext({});vm.runInContext(helper,c);
 return Array.from({length:n},(_,i)=>vm.runInContext('shotgunHorizontalPelletOffset('+i+','+n+')',c));
}
function volley({kind='shotgun',count=6,spread=.3,ads=0,owner='p',random=.75}={}){
 const bullets=[],w={stats:{kind},pel:count,spr:spread,spd:125,life:1,dmg:20,rangeModifier:null,rangeUnit:null},
 shooter={x:0,z:0,y:0,tm:0},math=Object.create(Math);
 math.random=()=>random;
 const c={Math:math,w,shooter,WP:[w],pl:{w:0,pitch:0},hold:{position:{x:0,y:0,z:-.6}},MZ:[-.9],
  adsT:ads,shotSide:0,A:80,bl:bullets,S:{add(){}},
  tracer:()=>({rotation:{set(){}},position:{set(x,y,z){Object.assign(this,{x,y,z});}}}),
  sweepObs:()=>false,sweepLT:()=>false,obsAt:()=>false,enemyShotFx:()=>{},smoke:()=>{}};
 vm.createContext(c);vm.runInContext(helper+'\n'+fireSrc,c);
 vm.runInContext('fire(shooter,0,w,'+JSON.stringify(owner)+',0)',c);
 return bullets;
}
function yaws(bullets){return bullets.map(b=>Math.atan2(b.vx,b.vz));}
test('six-pellet horizontal grouping repeats with mirrored left/right offsets',()=>{
 const expected=[-5/6,5/6,-3/6,3/6,-1/6,1/6],got=pattern(6);
 for(let i=0;i<6;i++)assert.ok(Math.abs(got[i]-expected[i])<1e-12);
 assert.equal(new Set(got).size,6);
 for(const n of [1,2,3,4,5,7,8]){
  const v=pattern(n);assert.equal(new Set(v).size,n);
  assert.ok(Math.abs(v.reduce((a,b)=>a+b,0))<1e-12);
  assert.ok(v.every(x=>Math.abs(x)<=1));
 }
});
test('real fire() creates six repeatable pellets and retains identical vertical velocity',()=>{
 const a=volley(),b=volley({random:.12}),ang=yaws(a);
 assert.equal(a.length,6);assert.equal(b.length,6);
 for(let i=0;i<6;i++){
  assert.ok(Math.abs(ang[i]-pattern(6)[i]*.3)<1e-9);
  assert.ok(Math.abs(ang[i]-yaws(b)[i])<1e-9);
  assert.equal(a[i].vy,a[0].vy);
  assert.equal(a[i].dmg,20);
  assert.equal(a[i].life,1);
 }
});
test('ADS contracts the original cone; bots share pattern; non-shotguns keep RNG',()=>{
 const hip=yaws(volley({spread:.6})),ads=yaws(volley({spread:.6,ads:1}));
 for(let i=0;i<6;i++)assert.ok(Math.abs(ads[i]-hip[i]*.35)<1e-9);
 const bot=volley({spread:.6,owner:'e'});
 assert.equal(bot.length,6);
 for(let i=0;i<6;i++)assert.ok(Math.abs(yaws(bot)[i]-hip[i])<1e-9);
 const pistol=volley({kind:'pistol',count:1,spread:.3,random:.75});
 assert.equal(pistol.length,1);assert.ok(Math.abs(yaws(pistol)[0]-.15)<1e-9);
});
test('shotgun statistics, ammunition, six pellets and pump/semi-auto stay unchanged',()=>{
 const c=vm.createContext({WEAPON_PROFILES:[],WEAPON_RANGE_MODIFIERS:[],WEAPON_MODEL_BUILDERS:[],
 DAMAGE_FALLOFF:{referenceUnits:20,defaultModifiers:{shotgun:.70}}});
 for(const p of ['src/game/weapon/03-shotgun.js','src/game/weapon/19-saiga12.js','src/game/weapon/20-ballistics.js'])
  vm.runInContext(read(p),c);
 const a=c.WP[2],b=c.WP[18];
 assert.equal(a.pel,6);assert.equal(b.pel,6);
 assert.equal(a.dmg*a.pel,168);assert.equal(b.dmg*b.pel,100);
 assert.equal(a.pump,1);assert.equal(b.pump,undefined);
 assert.ok(b.spr>a.spr);
});
test('browser bundle matches all source modules and helper precedes firing engine',()=>{
 const m=JSON.parse(read('tools/source-manifest.json'));
 const path='src/game/weapon/21-shotgun-spread-pattern.js';
 assert.equal(m.parts.filter(p=>p===path).length,1);
 assert.ok(m.parts.indexOf(path)<m.parts.indexOf('src/game/45-combat.js'));
 assert.equal(read('assets/game.js'),'(function(){\n'+m.parts.map(read).join('')+'})();\n');
});
