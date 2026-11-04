import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const manifest=JSON.parse(read('tools/source-manifest.json'));
const all=manifest.parts.filter(p=>p.startsWith('src/game/weapon/')&&!p.endsWith('30-viewmodels.js')).map(read).join('\n');
const still={ads:0,speed:0,crouch:false,grounded:true},fixed=()=>.5;
function ctx(){const c=vm.createContext({Math});vm.runInContext(all,c);return c;}
test('nineteen original weapon ratings drive the canonical ballistic revision',()=>{
 const c=ctx();assert.equal(c.GUNPLAY_REVISION,'pointblock-gunplay-2026-11-04-v1');
 assert.equal(c.WP.length,19);
 for(let i=0;i<19;i++){
  const w=c.WP[i],state=c.freshGunplayState();
  if(w.melee||w.gr){assert.throws(()=>c.gunplayShot(i,state,0,still,fixed));continue}
  for(let n=0;n<Math.min(24,w.mag);n++){
   const shot=c.gunplayShot(i,state,n*w.cd,still,fixed);
   assert.ok(Number.isFinite(shot.yaw)&&Number.isFinite(shot.pitch));
  }
 }
});
test('stationary K2 75/66/33 and AK-47 44/69/62 produce nonconvergent 25-shot spray',()=>{
 const c=ctx();
 for(const id of [9,1])for(const ads of [0,1]){
  const w=c.WP[id],state=c.freshGunplayState(),angles=[];
  for(let n=0;n<25;n++)angles.push(c.gunplayShot(id,state,n*w.cd,{...still,ads},fixed));
  assert.ok(angles[24].pitch-angles[0].pitch>.038,'sustained shots must climb even while aiming');
  assert.ok(state.bloom>0);
 }
});
test('Control, H.Recoil and ADS make real independent angular differences',()=>{
 const c=ctx(),ak=c.freshGunplayState(),k2=c.freshGunplayState();
 for(let n=0;n<12;n++){
  c.gunplayShot(1,ak,n*c.WP[1].cd,still,fixed);
  c.gunplayShot(9,k2,n*c.WP[9].cd,still,fixed);
 }
 assert.ok(ak.bloom>k2.bloom);
 assert.ok(Math.abs(ak.yaw)>Math.abs(k2.yaw));
 const stop=c.gunplayShot(9,k2,12*c.WP[9].cd+1.5,still,fixed);
 assert.ok(stop.pitch<.005,'recoil recovers after firing stops');
 function inaccuracy(cond){
  const state=c.freshGunplayState();
  for(let n=0;n<8;n++)c.gunplayShot(9,state,n*c.WP[9].cd,cond,fixed);
  return c.gunplayShot(9,state,8*c.WP[9].cd,cond,fixed).inaccuracy;
 }
 assert.ok(inaccuracy({...still,speed:5})>inaccuracy(still));
 assert.ok(inaccuracy({...still,grounded:false})>inaccuracy(still));
 assert.ok(inaccuracy({...still,crouch:true})<inaccuracy(still));
 assert.ok(inaccuracy({...still,ads:1})<inaccuracy(still));
});
test('pointblock bullet visuals use certified trajectory, never camera-only muzzle direction',()=>{
 const live=read('src/game/98-online-bridge.js');
 assert.match(live,/ballisticRevision===GUNPLAY_REVISION/);
 assert.match(live,/mesh\.position\.set\(frame\.x,frame\.y,frame\.z\)/);
 const serverData=['weaponId','pelletIndex','ballisticRevision'];
 for(const key of serverData)assert.match(live,new RegExp(key==='ballisticRevision'?'frame\\.ballisticRevision':key));
});
