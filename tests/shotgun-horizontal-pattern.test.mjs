import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8').replace(/\r\n/g,'\n');
const helper=read('src/game/weapon/21-shotgun-spread-pattern.js');
const combat=read('src/game/45-combat.js');
const fireSrc=combat.slice(combat.indexOf('function fire('),combat.indexOf('// boom():'));
const playerBase=125*(.6-.02)/20;
function pattern(n){
 const c=vm.createContext({});vm.runInContext(helper,c);
 return Array.from({length:n},(_,i)=>Array.from(vm.runInContext('shotgunPelletSpread('+i+','+n+')',c)));
}
function volley({kind='shotgun',count=6,spread=.3,ads=0,owner='p',random=.75,pitch=0}={}){
 const bullets=[],w={stats:{kind},pel:count,spr:spread,spd:125,life:1,dmg:20,rangeModifier:null,rangeUnit:null},
 shooter={x:0,z:0,y:0,tm:0},math=Object.create(Math);
 math.random=()=>random;
 const c={Math:math,w,shooter,WP:[w],pl:{w:0,pitch},hold:{position:{x:0,y:-.6,z:-.6}},MZ:[-.9],
  adsT:ads,shotSide:0,A:80,bl:bullets,S:{add(){}},
  tracer:()=>({rotation:{set(){}},position:{set(x,y,z){Object.assign(this,{x,y,z});}}}),
  sweepObs:()=>false,sweepLT:()=>false,obsAt:()=>false,enemyShotFx:()=>{},smoke:()=>{}};
 vm.createContext(c);vm.runInContext(helper+'\n'+fireSrc,c);
 vm.runInContext('fire(shooter,0,w,'+JSON.stringify(owner)+',0)',c);
 return bullets;
}
const yaw=b=>Math.atan2(b.vx,b.vz);
test('six-pellet radial constellation covers vertical and horizontal axes consistently',()=>{
 const p=pattern(6);
 assert.equal(p.length,6);
 assert.ok(p.some(v=>v[0]<-.2)&&p.some(v=>v[0]>.2));
 assert.ok(p.some(v=>v[1]<-.2)&&p.some(v=>v[1]>.2));
 assert.ok(p.some(v=>Math.hypot(...v)<.3));
 assert.ok(p.every(v=>Math.hypot(...v)<=.88));
 assert.equal(new Set(p.map(v=>v.map(x=>x.toFixed(6)).join(','))).size,6);
 for(const n of [1,2,3,4,5,7,8]){
  const q=pattern(n);assert.equal(q.length,n);assert.ok(q.every(v=>v.every(Number.isFinite)));
  assert.ok(q.every(v=>Math.hypot(...v)<=.88));
 }
 assert.deepEqual(pattern(1),[[0,0]]);
 assert.deepEqual(pattern(6),p);
});
test('six shot pellets share muzzle but follow repeatable 2D impact directions',()=>{
 const a=volley({spread:.6}),b=volley({spread:.6,random:.12}),p=pattern(6);
 assert.equal(a.length,6);assert.equal(b.length,6);
 assert.ok(new Set(a.map(x=>yaw(x).toFixed(4))).size>3);
 assert.ok(new Set(a.map(x=>x.vy.toFixed(4))).size>3);
 for(let i=0;i<6;i++){
  assert.ok(Math.abs(yaw(a[i])-p[i][0]*.6)<1e-9);
  assert.ok(Math.abs(a[i].vy-playerBase-125*Math.tan(p[i][1]*.6))<1e-9);
  assert.ok(Math.abs(yaw(a[i])-yaw(b[i]))<1e-9);
  assert.ok(Math.abs(a[i].vy-b[i].vy)<1e-9);
  assert.equal(a[i].dmg,20);assert.equal(a[i].life,1);
 }
});
test('ADS narrows both spread axes; bot uses same grouping relative to its aim',()=>{
 const p=pattern(6),hip=volley({spread:.6}),ads=volley({spread:.6,ads:1}),
 bot=volley({spread:.6,owner:'e'}),up=volley({spread:.6,pitch:.2});
 for(let i=0;i<6;i++){
  assert.ok(Math.abs(yaw(ads[i])-yaw(hip[i])*.35)<1e-9);
  assert.ok(Math.abs(ads[i].vy-playerBase-125*Math.tan(p[i][1]*.6*.35))<1e-9);
  assert.ok(Math.abs(yaw(bot[i])-yaw(hip[i]))<1e-9);
  assert.ok(Math.abs(bot[i].vy-hip[i].vy+playerBase)<1e-9);
  assert.ok(Math.abs(up[i].vy-hip[i].vy-125*Math.tan(.2))<1e-9);
 }
});
test('non-shotgun weapons retain original randomized yaw and pitch',()=>{
 const a=volley({kind:'pistol',count:1,spread:.3,random:.75}),
 b=volley({kind:'pistol',count:1,spread:.3,random:.1}),
 rifle=volley({kind:'rifle',count:1,spread:.13,random:.75,pitch:.2});
 assert.equal(a.length,1);
 assert.ok(Math.abs(yaw(a[0])-.15)<1e-9);
 assert.ok(Math.abs(yaw(b[0])+.24)<1e-9);
 assert.ok(Math.abs(rifle[0].vy-playerBase-125*Math.tan(.2))<1e-9);
});
test('canonical shotgun ammo, damage and manual pump vs Saiga semi-auto unchanged',()=>{
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
test('browser bundle exactly matches ordered sources including pellet helper',()=>{
 const m=JSON.parse(read('tools/source-manifest.json'));
 const file='src/game/weapon/21-shotgun-spread-pattern.js';
 assert.equal(m.parts.filter(p=>p===file).length,1);
 assert.ok(m.parts.indexOf(file)<m.parts.indexOf('src/game/45-combat.js'));
 assert.equal(read('assets/game.js'),'(function(){\n'+m.parts.map(read).join('')+'})();\n');
});
