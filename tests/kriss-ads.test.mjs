import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8').replace(/\r\n/g,'\n');
const kriss=read('src/game/weapon/07-kriss.js');
const dual=read('src/game/weapon/08-dual-kriss.js');
const optic=read('src/game/76-tactical-optics.js');
const controls=read('src/game/75-weapon-controls.js');
const viewmodels=read('src/game/weapon/30-viewmodels.js');
const css=read('src/styles/11-tactical-optics.css');
function models(){
 const ctx={
  WEAPON_PROFILES:[],WEAPON_RANGE_MODIFIERS:[],WEAPON_MODEL_BUILDERS:[],
  bx(...shape){return{kind:'box',shape,visible:true}},
  cy(...shape){return{kind:'cylinder',shape,visible:true}}
 };
 runInNewContext(kriss+'\n'+dual,ctx);
 ctx.mkGun=function(id){
  const g={userData:{},position:{x:0},meshes:[]};
  ctx.WEAPON_MODEL_BUILDERS[id](g,(...a)=>g.meshes.push(...a));
  return g;
 };
 return ctx;
}
test('single Kriss preserves original damage, ammo and range falloff',()=>{
 const ctx=models();
 const p=ctx.WEAPON_PROFILES[6],d=ctx.WEAPON_PROFILES[7];
 for(const [key,value]of Object.entries({damage:21,rpm:93,mag:30,res:210,range:60,kind:'smg'}))
  assert.equal(p[key],value,'single Kriss '+key);
 for(const [key,value]of Object.entries({damage:18,mag:125,res:0,range:60,kind:'dual'}))
  assert.equal(d[key],value,'Dual Kriss '+key);
 assert.equal(ctx.WEAPON_RANGE_MODIFIERS[6],.83);
 assert.equal(ctx.WEAPON_RANGE_MODIFIERS[7],.83);
});
test('single Kriss sight pieces are registered without removing weapon geometry',()=>{
 const ctx=models(),g=ctx.mkGun(6);
 assert.equal(g.meshes.length,22);
 assert.equal(g.userData.opticParts.length,8);
 assert.ok(g.userData.opticParts.every(part=>g.meshes.includes(part)&&part.visible));
 const dualGun=ctx.mkGun(7);
 assert.equal(dualGun.meshes.length,2,'Dual still consists of two single weapon groups');
 assert.equal(dualGun.meshes[1].position.x,-.52);
 assert.ok(dualGun.meshes.every(g=>g.userData.opticParts.length===8));
});
test('Kriss has a unique tactical reflex sight; Dual Kriss can never ADS',()=>{
 const dom={style:{},className:''};
 const ctx={document:{getElementById(){return dom},body:{classList:{toggle(){}}}}};
 runInNewContext(optic.slice(0,optic.indexOf('function tacticalOpticUpdate()')),ctx);
 const onlyAds=controls.slice(controls.indexOf('function canAds('),controls.indexOf('function fall('));
 runInNewContext(onlyAds,ctx);
 assert.equal(ctx.tacticalOpticConfig(6).style,'kriss');
 assert.equal(ctx.tacticalOpticConfig(7),null);
 assert.equal(ctx.canAds(6),true);
 assert.equal(ctx.canAds(7),false);
 for(const id of [10,11,12])assert.ok(ctx.tacticalOpticConfig(id));
 assert.match(read('src/game/95-simulation.js'),/WP\[pl\.w\]\.snp\?scopeOn:mouse\.right/);
});
test('Kriss ADS hides the original physical optic and restores it on release or Dual toggle',()=>{
 const ctx=models(),gun=ctx.mkGun(6),dualGun=ctx.mkGun(7);
 const overlay={style:{},className:''},classStates={};
 const env={
  document:{getElementById(){return overlay},body:{classList:{toggle(key,v){classStates[key]=v;}}}},
  pl:{w:6,dead:false,rl:0,sw:0,bAction:false},
  mt:{over:false,cd:0},lob:false,run:true,adsT:1,
  isBombMode(){return false},
  guns:Array.from({length:13},(_,i)=>i===6?gun:i===7?dualGun:{userData:{}})
 };
 runInNewContext(optic,env);
 env.tacticalOpticUpdate();
 assert.equal(overlay.className,'tactical-aim tactical-aim-kriss');
 assert.equal(overlay.style.display,'block');
 assert.equal(classStates['tactical-ads'],true);
 assert.ok(gun.userData.opticParts.every(p=>p.visible===false));
 env.pl.w=7;env.adsT=1;env.tacticalOpticUpdate();
 assert.equal(overlay.style.display,'none');
 assert.ok(gun.userData.opticParts.every(p=>p.visible===true));
 assert.ok(dualGun.meshes.every(g=>g.userData.opticParts.every(p=>p.visible)));
 env.pl.w=6;env.adsT=1;env.tacticalOpticUpdate();
 env.adsT=0;env.tacticalOpticUpdate();
 assert.equal(overlay.style.display,'none');
 assert.ok(gun.userData.opticParts.every(p=>p.visible===true));
});
test('Kriss sight style and alignment remain independent of Dual and other tactical optics',()=>{
 assert.match(css,/\.tactical-aim-kriss \.ta-frame\{width:98px;height:72px;border-radius:9px/);
 assert.match(css,/\.tactical-aim-kriss \.ta-frame::after\{box-shadow:/);
 assert.doesNotMatch(css,/\.ta-label|--ta-label-offset/);
 assert.match(viewmodels,/\[0,-0\.21,-0\.55\],\[0,-0\.13,-0\.5\],\[0,-0\.14,-0\.5\]/);
 assert.match(viewmodels,/ADF=\[[^\]]+,50,70,14,44/);
 for(const name of ['mp7','p90','sopmod'])assert.match(css,new RegExp('tactical-aim-'+name));
 assert.match(read('index.html'),/id="tacticalAim"/);
});
test('committed runtime includes the Kriss-only ADS implementation',()=>{
 const man=JSON.parse(read('tools/source-manifest.json'));
 assert.ok(man.parts.includes('src/game/weapon/07-kriss.js'));
 assert.ok(man.styles.includes('src/styles/11-tactical-optics.css'));
 assert.equal(read('assets/game.js'),'(function(){\n'+man.parts.map(read).join('')+'})();\n');
});
