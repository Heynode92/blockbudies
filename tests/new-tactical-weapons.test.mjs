import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8').replace(/\r\n/g,'\n');
const weapon=JSON.parse(read('tools/source-manifest.json')).parts.filter(p=>p.startsWith('src/game/weapon/')&&!p.endsWith('30-viewmodels.js')).map(read).join(''),control=read('src/game/75-weapon-controls.js'),optic=read('src/game/76-tactical-optics.js');
const viewmodels=read('src/game/weapon/30-viewmodels.js');
const shop=read('src/game/89-shop.js'),inventory=read('src/game/89-inventory.js'),sim=read('src/game/95-simulation.js');
const bots=read('src/game/41-bot-weapons.js');
function loadProfiles(){
 const ctx={Math};runInNewContext(weapon,ctx);
 return ctx;
}
test('MP7, P90 and AK SOPMOD exactly match requested ratings and ammo',()=>{
 const {WEAPON_PROFILES:p,WP}=loadProfiles();
 assert.equal(p.length,13);
 const specs=[
  [10,{name:'MP7',kind:'smg',damage:21,rpm:93,control:60,speed:88,vRecoil:45,hRecoil:54,mag:30,res:200,range:60}],
  [11,{name:'P90',kind:'smg',damage:24,rpm:92,control:54,speed:88,vRecoil:45,hRecoil:48,mag:50,res:200,range:65}],
  [12,{name:'AK SOPMOD',kind:'rifle',damage:33,rpm:90,control:50,speed:74,vRecoil:64,hRecoil:60,mag:30,res:150,range:160}]
 ];
 for(const [id,exp] of specs){
   for(const [k,v] of Object.entries(exp))assert.equal(p[id][k],v,exp.name+'.'+k);
   assert.equal(WP[id].dmg,exp.damage);assert.equal(WP[id].mag,exp.mag);assert.equal(WP[id].res,exp.res);
   assert.equal(WP[id].moveMult,exp.speed/100);
   assert.ok(Math.abs(WP[id].spd*WP[id].life-exp.range)<1e-8);
 }
 assert.equal(p[9].name,'K2');
});
test('Dedicated weapon meshes have correct reference-driven silhouettes, textures and mechanisms',()=>{
 for(const [n,path] of [[10,'11-mp7.js'],[11,'12-p90.js'],[12,'13-ak-sopmod.js']])assert.match(read('src/game/weapon/'+path),new RegExp('WEAPON_MODEL_BUILDERS\\['+n+'\\]'));
 const allModels=['11-mp7.js','12-p90.js','13-ak-sopmod.js'].map(p=>read('src/game/weapon/'+p)).join('');
 for(const token of ['MP7: compact black','P90: distinctive bullpup','AK SOPMOD: black carbine','curved magazine','vertical foregrip'])assert.ok(allModels.includes(token));
 assert.match(viewmodels,/guns=WEAPON_PROFILES\.map/);
 const src=read('src/game/50-items-and-drops.js');
 assert.match(src,/kind==="smg"/);assert.match(src,/kind==="rifle"/);
});
test('Shop catalog automatically includes all three new guns without granting ownership on fresh browser',()=>{
 const {WP,WEAPON_STARTER_ID}=loadProfiles();
 const setup=inventory.slice(0,inventory.indexOf('// Pose specifications'));
 const storage={getItem(){return null},setItem(){}};
 const ctx={Math,WP,WEAPON_STARTER_ID,localStorage:storage,favPrim:1,
  refreshWeaponSelection(){},inventoryRender(){}};
 runInNewContext(setup,ctx);ctx.inventoryLoad();
 assert.deepEqual(Array.from(ctx.inventoryOwned('main')),[9]);
 const ids=ctx.inventoryCatalogMain();
 for(const id of [10,11,12]){assert.ok(ids.includes(id));assert.ok(!ctx.inventoryOwned('main').includes(id));}
 assert.match(shop,/inventoryCatalogMain\(\)\.filter/);
 assert.match(shop,/inventoryClaimPrimary\(id\)/);
 assert.match(control,/var owned=inventoryOwned\("main"\)/);
 assert.match(bots,/primaries:\[1,1,1,2,2,6,6,6,7,8,3\]/);
});
test('Tactical aim has three distinct visual profiles and uses RMB hold, AWP scope unchanged',()=>{
 const ctx={document:{getElementById(){return{style:{},querySelector(){return{textContent:''}}}}}};
 runInNewContext(optic.slice(0,optic.indexOf('function tacticalOpticUpdate()')),ctx);
 for(const id of [10,11,12])assert.ok(ctx.tacticalOpticConfig(id));
 assert.equal(ctx.tacticalOpticConfig(8),null);
 assert.notEqual(ctx.tacticalOpticConfig(10).style,ctx.tacticalOpticConfig(11).style);
 assert.notEqual(ctx.tacticalOpticConfig(11).style,ctx.tacticalOpticConfig(12).style);
 assert.match(sim,/pl\.w===8\?scopeOn:mouse\.right/);
 assert.match(read('src/game/96-hud-and-radar.js'),/tacticalOpticUpdate\(\)/);
 assert.match(control,/!!tacticalOpticConfig\(w\)/);
 assert.match(read('src/styles/11-tactical-optics.css'),/\.tactical-aim-sopmod/);
 assert.match(read('index.html'),/id="tacticalAim"/);
 assert.match(viewmodels,/ADF=\[[^\]]+,42,44,36\]/);
});
test('All dependent arrays extend for new IDs without shifting original id indexes',()=>{
 for(const expr of [/MZ=\[[^\]]+,-1\.04,-1\.00,-1\.38\]/,/SFXI=\[[^\]]+,1,1,1\]/]){
   assert.match(expr.source.startsWith('MZ')?read('src/game/45-combat.js'):read('src/game/65-audio.js'),expr);
 }
 const drops=read('src/game/50-items-and-drops.js');
 assert.match(drops,/GSC=\[[^\]]+,1\.2,1\.18,1\.23\],GH=/);
 assert.match(viewmodels,/MODE=\[[^\]]+,0,0,0\],NC=/);
 assert.match(control,/10:'<svg/);assert.match(control,/11:'<svg/);assert.match(control,/12:'<svg/);
});
test('Compiled runtime matches all source modules including tactical optic module',()=>{
 const manifest=JSON.parse(read('tools/source-manifest.json'));
 assert.ok(manifest.parts.includes('src/game/76-tactical-optics.js'));
 assert.ok(manifest.styles.includes('src/styles/11-tactical-optics.css'));
 assert.equal(read('assets/game.js'),'(function(){\n'+manifest.parts.map(read).join('')+'})();\n');
});

test('MP7 micro red dot clears its physical optic while ADS and restores it afterward',()=>{
 const ctx={WEAPON_PROFILES:[],WEAPON_RANGE_MODIFIERS:[],WEAPON_MODEL_BUILDERS:[],
  bx(){return{visible:true}},cy(){return{visible:true}}};
 runInNewContext(read('src/game/weapon/11-mp7.js'),ctx);
 const gun={userData:{}},meshes=[];
 ctx.WEAPON_MODEL_BUILDERS[10](gun,(...parts)=>meshes.push(...parts));
 const opticParts=gun.userData.opticParts;
 assert.equal(opticParts.length,5);
 for(const part of opticParts)assert.ok(meshes.includes(part));
 const aimEl={style:{},querySelector(){throw new Error('Tactical optic label must not be queried');}};
 const env={
  document:{getElementById(){return aimEl},body:{classList:{toggle(){}}}},
  pl:{w:10,dead:false,rl:0,sw:0,bAction:false},
  mt:{over:false,cd:0},lob:false,run:true,adsT:1,
  isBombMode(){return false},
  guns:Array.from({length:13},(_,i)=>i===10?gun:{userData:{}})
 };
 runInNewContext(optic,env);
 env.tacticalOpticUpdate();
 assert.equal(aimEl.style.display,'block');
 assert.ok(opticParts.every(p=>p.visible===false),'all physical MP7 sight pieces should be hidden');
 env.adsT=0;
 env.tacticalOpticUpdate();
 assert.equal(aimEl.style.display,'none');
 assert.ok(opticParts.every(p=>p.visible===true),'physical sight pieces should return after ADS');
 assert.match(viewmodels,/\[0,-\.25,-\.58\],\[0,-\.27,-\.56\]/);
 const opticsCss=read('src/styles/11-tactical-optics.css');
 assert.match(opticsCss,/\.tactical-aim-mp7 \.ta-frame::after\{box-shadow:/);
 assert.match(opticsCss,/\.tactical-aim-mp7 \.ta-cross::before,/);
});

test('ADS sights show only reticles, never text captions for MP7, P90 or AK SOPMOD',()=>{
 const html=read('index.html');
 const styles=read('src/styles/11-tactical-optics.css');
 assert.doesNotMatch(html,/class="ta-label"/);
 assert.doesNotMatch(optic,/\.ta-label|label:"(MICRO RED DOT|INTEGRATED RING SIGHT|CARBINE HOLO SIGHT)"/);
 assert.doesNotMatch(styles,/\.ta-label|--ta-label-offset/);
 for(const id of [10,11,12]){
  const cfg=loadProfiles();
  assert.ok(cfg.WEAPON_PROFILES[id]);
  assert.ok(optic.includes(id+':{style:'),'missing tactical sight for weapon '+id);
 }
 assert.match(html,/id="tacticalAim"/);
 assert.match(html,/class="ta-frame"/);
 assert.match(html,/class="ta-cross"/);
});
