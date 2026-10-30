import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8').replace(/\r\n/g,'\n');
const k2=read('src/game/weapon/10-k2.js');
const shotgun=read('src/game/weapon/03-shotgun.js');
const rocket=read('src/game/weapon/04-rpg.js');
const viewmodel=read('src/game/weapon/30-viewmodels.js');
const optics=read('src/game/76-tactical-optics.js');
const controls=read('src/game/75-weapon-controls.js');
const css=read('src/styles/11-tactical-optics.css');
const sim=read('src/game/95-simulation.js');
function createProfiles(){
 const ctx={WEAPON_PROFILES:[],WEAPON_RANGE_MODIFIERS:[],WEAPON_MODEL_BUILDERS:[],
  bx(...params){return{type:'box',params,visible:true}},
  cy(...params){return{type:'cylinder',params,visible:true}}};
 runInNewContext(k2+'\n'+shotgun+'\n'+rocket,ctx);
 function make(id){
  const meshes=[],g={userData:{}};
  ctx.WEAPON_MODEL_BUILDERS[id](g,(...parts)=>meshes.push(...parts));
  return{g,meshes};
 }
 return{ctx,make};
}
function getAdsArrays(){
 const match=viewmodel.match(/ADF=(\[[^\]]+\]),AP=(\[\[[^\n]+?\]\]),bobP=/);
 assert.ok(match,'ADS field of view and viewmodel arrays must be present');
 const state={};runInNewContext('var ADF='+match[1]+';var AP='+match[2]+';',state);
 return{fov:state.ADF,pos:state.AP};
}
function createSightRuntime(){
 const overlay={style:{display:'none'},className:''};
 const bodyFlags={};
 const env={
  document:{getElementById(){return overlay},body:{classList:{toggle(key,val){bodyFlags[key]=val;}}}},
  pl:{w:9,dead:false,rl:0,sw:0,bAction:false},
  mt:{over:false,cd:0},lob:false,run:true,adsT:1,WEAPON_STARTER_ID:9,
  WP:Array.from({length:19},(_,i)=>({snp:i===8})),
  isBombMode(){return false},
  guns:Array.from({length:13},()=>({userData:{}}))
 };
 runInNewContext(optics,env);
 const adsCode=controls.slice(controls.indexOf('function canAds(w)'),controls.indexOf('function fall(b,p)'));
 runInNewContext(adsCode,env);
 return{env,overlay,bodyFlags};
}
test('K2 and Shotgun still aim with RMB, but neither has a 2D scope or obstructing K2 reflex lens',()=>{
 const {env,overlay,bodyFlags}=createSightRuntime();
 for(const id of [9,2]){
  assert.equal(env.canAds(id),true);
  assert.equal(env.tacticalOpticConfig(id),null);
  env.pl.w=id;env.tacticalOpticUpdate();
  assert.equal(overlay.style.display,'none');
  assert.equal(bodyFlags['tactical-ads'],false,'standard crosshair remains visible');
 }
 const {make}=createProfiles(),rifle=make(9).meshes,shot=make(2).meshes;
 assert.ok(rifle.length>=18);
 assert.ok(shot.length===5);
 assert.ok(!rifle.some(p=>p.type==='box'&&p.params[0]===.055&&p.params[1]===.045&&p.params[2]===.075),
   'K2 artificial reflex sight removed');
 assert.match(k2,/low rear iron sight ear/);
 assert.doesNotMatch(k2,/\/\/ reflex sight|\/\/ sight mount/);
});
test('K2 and Shotgun ADS bodies stay beneath center screen and preserve original clear view',()=>{
 const {fov,pos}=getAdsArrays(),{make}=createProfiles();
 for(const id of [9,2]){
  assert.equal(pos[id][0],0);
  const parts=make(id).meshes;
  const highest=Math.max(...parts.map(p=>p.params[5]+(p.type==='cylinder'?p.params[0]:p.params[1]/2)));
  assert.ok(pos[id][1]+highest<-.08,'weapon '+id+' top surface must remain below aim center');
 }
 assert.equal(pos[9][1],-.215);
 assert.equal(pos[2][1],-.22);
 assert.equal(fov[9],44);
 assert.equal(fov[2],58);
});
test('RPG RMB uses a transparent amber launcher rangefinder without a heavy centered barrel',()=>{
 const {env,overlay,bodyFlags}=createSightRuntime(),{pos,fov}=getAdsArrays();
 env.pl.w=3;env.tacticalOpticUpdate();
 assert.equal(env.canAds(3),true);
 assert.equal(env.tacticalOpticConfig(3).style,'rpg');
 assert.equal(overlay.style.display,'block');
 assert.equal(overlay.className,'tactical-aim tactical-aim-rpg');
 assert.equal(bodyFlags['tactical-ads'],true);
 assert.ok(pos[3][0]>.17,'rocket tube stays to the right of center');
 assert.ok(pos[3][1]<-.20,'rocket launcher is lowered to preserve target');
 assert.equal(fov[3],58);
 assert.match(css,/\.tactical-aim-rpg \.ta-frame\{width:176px;height:126px;border:none/);
 assert.match(css,/\.tactical-aim-rpg \.ta-cross\{width:55px;height:55px;border:1px dashed/);
 assert.match(css,/\.tactical-aim-rpg \.ta-frame::before\{inset:0;border:0/);
 env.adsT=0;env.tacticalOpticUpdate();
 assert.equal(overlay.style.display,'none');
 assert.equal(bodyFlags['tactical-ads'],false);
});
test('No unintended ADS for Dual Kriss and original scopes remain unchanged',()=>{
 const {env,overlay}=createSightRuntime();
 assert.equal(env.canAds(7),false);
 assert.equal(env.tacticalOpticConfig(7),null);
 env.pl.w=7;env.tacticalOpticUpdate();assert.equal(overlay.style.display,'none');
 assert.equal(env.tacticalOpticConfig(6).style,'kriss');
 assert.equal(env.tacticalOpticConfig(10).style,'mp7');
 assert.equal(env.tacticalOpticConfig(11).style,'p90');
 assert.equal(env.tacticalOpticConfig(12).style,'sopmod');
 assert.equal(env.tacticalOpticConfig(8),null,'AWP retains its separate scope');
 assert.match(sim,/WP\[pl\.w\]\.snp\?scopeOn:mouse\.right/);
});
test('K2 Shotgun RPG weapon profiles, projectiles and damage remain untouched',()=>{
 const {ctx}=createProfiles();
 const expect={
  9:{damage:36,rpm:96,mag:40,res:200,range:120,kind:'rifle',modifier:.98},
  2:{damage:168,rpm:48,mag:6,res:30,range:70,kind:'shotgun',modifier:.7},
  3:{damage:85,rpm:35,mag:1,res:6,range:65,kind:'rocket',modifier:null}
 };
 for(const [key,values] of Object.entries(expect)){
  const id=+key;
  for(const [name,val] of Object.entries(values)){
   const actual=name==='modifier'?ctx.WEAPON_RANGE_MODIFIERS[id]:ctx.WEAPON_PROFILES[id][name];
   assert.equal(actual,val,'weapon '+id+' '+name);
  }
 }
});
test('browser bundle matches the expanded ordered source after ADS changes',()=>{
 const manifest=JSON.parse(read('tools/source-manifest.json'));
 assert.ok(manifest.parts.length>=46);
 assert.equal(read('assets/game.js'),'(function(){\n'+manifest.parts.map(read).join('')+'})();\n');
 assert.ok(manifest.styles.includes('src/styles/11-tactical-optics.css'));
});
