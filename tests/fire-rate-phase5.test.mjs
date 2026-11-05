import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const manifest=JSON.parse(read('tools/source-manifest.json'));
const weapons=manifest.parts.filter(p=>p.startsWith('src/game/weapon/')&&!p.endsWith('30-viewmodels.js'))
 .map(read).join('');
function context(){const c={Math,Number,Object};runInNewContext(weapons,c);return c;}
function near(a,b,message){assert.ok(Math.abs(a-b)<1e-8,`${message}: ${a} != ${b}`);}
const expected=[331.2,708,66.6,32,null,null,1022,1222,43.65,736,1022,1018,
 715,1018,1010,722,722,30,68.85];

test('all original 19 RPM scores map to exact real cycles, including 0-RPM sniper and fixed melee/throwable',()=>{
 const c=context();
 assert.equal(c.FIRE_RATE_REVISION,'pointblock-fire-rate-2026-11-05-p5');
 assert.equal(c.WP.length,19);
 for(const [id,p] of c.WEAPON_PROFILES.entries()){
  const rpm=c.weaponEffectiveRpm(p),w=c.WP[id];
  if(expected[id]===null){
   assert.equal(rpm,null,`${p.name}: non-ballistic fixed cycle`);
   near(w.cd,id===4?.55:1.1,`${p.name} existing cooldown`);
  }else{
   near(rpm,expected[id],`${p.name} effective RPM`);
   near(w.cd,60/expected[id],`${p.name} seconds per trigger`);
  }
  assert.equal(w.dmg*w.pel,p.kind==='knife'||p.kind==='grenade'?0:p.damage,
   `${p.name} original weapon profile unchanged`);
 }
 assert.equal(c.WP[2].pel,6);
 assert.equal(c.WP[18].pel,6);
 near(c.WP[2].cd,60/66.6,'six pellet pump: one fire cycle');
 near(c.WP[18].cd,60/68.85,'six pellet Saiga: one fire cycle');
 assert.throws(()=>c.weaponEffectiveRpm({kind:'rifle',rpm:101}),e=>e?.name==='RangeError');
 assert.throws(()=>c.weaponEffectiveRpm({kind:'rifle',rpm:-1}),e=>e?.name==='RangeError');
});

test('cosmetic prediction retains sub-75ms high-rate cycles without making extra shots',()=>{
 const c=context();
 for(const id of [1,7,9,10,11,18]){
  const w=c.WP[id],period=w.cd*1000,first=1000,duration=2400,step=1000/144;
  let last=0,count=0,minGap=Infinity;
  for(let frame=0;frame<=Math.ceil(duration/step);frame++){
   const now=first+frame*step;
   const at=c.weaponCosmeticShotTime(last,now,w.cd);
   if(at===null)continue;
   if(count>0)minGap=Math.min(minGap,at-last);
   last=at;count++;
  }
  const theoretical=1+Math.floor(duration/period);
  assert.ok(Math.abs(count-theoretical)<=1,`${w.n}: predicted count ${count} vs ${theoretical}`);
  assert.ok(minGap+1e-7>=period,`${w.n}: no faster-than-rated cosmetic shot`);
 }
 assert.ok(c.WP[7].cd*1000<75,'dual-rate visual issue is actually testable');
});

test('visual shot schedule does not accumulate backlogged bursts across paused tabs',()=>{
 const c=context(),cd=c.WP[7].cd;
 assert.equal(c.weaponCosmeticShotTime(0,5000,cd),5000);
 assert.equal(c.weaponCosmeticShotTime(5000,5000,cd),null);
 assert.equal(c.weaponCosmeticShotTime(5000,5000+cd*1000*.99,cd),null);
 near(c.weaponCosmeticShotTime(5000,5000+cd*1000,cd),5000+cd*1000,'exact next shot');
 assert.equal(c.weaponCosmeticShotTime(5000,9500,cd),9500,'single event after idle');
 assert.throws(()=>c.weaponCosmeticShotTime(0,0,0),e=>e?.name==='RangeError');
});

test('online visual muzzle uses source-rated period and stays separate from server fire packet',()=>{
 const bridge=read('src/game/98-online-bridge.js');
 assert.match(bridge,/weaponCosmeticShotTime\(onlineMuzzleTime,now,WP\[pl\.w\]\.cd\)/);
 assert.doesNotMatch(bridge,/Math\.max\(75,\(WP\[pl\.w\]/);
 assert.match(bridge,/fire:acceptedFire/,'fire intent is unchanged and still server-resolved');
 assert.match(bridge,/Cosmetic prediction only: server decides shot legitimacy, ammo, hit and damage/);
});
