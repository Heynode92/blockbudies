import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const manifest=JSON.parse(read('tools/source-manifest.json'));
const profiles=manifest.parts.filter(p=>p.startsWith('src/game/weapon/')&&!p.endsWith('30-viewmodels.js')).map(read).join('\n');
function setup(){
 const c={Math,Number};
 runInNewContext(read('src/game/39-defense.js')+'\n'+profiles,c);
 return c;
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`expected ${a} ~= ${b}`);
test('central phase-2 body zone rules reflect model heights and player-facing right axis',()=>{
 const c=setup(),p={x:10,y:2,z:15,yaw:0};
 const q=(x,y,z)=>({x:p.x+x,y:p.y+y,z:p.z+z});
 assert.equal(c.HITGROUP_RULES.revision,'pointblock-hitgroup-2026-11-05-p2');
 assert.equal(c.defenseClassifyBodyHitgroup(q(0,1.2,0),p),'chest');
 assert.equal(c.defenseClassifyBodyHitgroup(q(0,.85,0),p),'stomach');
 assert.equal(c.defenseClassifyBodyHitgroup(q(.65,1.1,0),p),'arm');
 assert.equal(c.defenseClassifyBodyHitgroup(q(-.65,.85,0),p),'arm');
 assert.equal(c.defenseClassifyBodyHitgroup(q(0,.35,0),p),'leg');
 assert.equal(c.defenseClassifyBodyHitgroup(q(0,1.37,0),p),'chest');
 assert.equal(c.defenseClassifyBodyHitgroup(q(0,.58,0),p),'stomach');
 assert.equal(c.defenseClassifyBodyHitgroup(q(0,1,0),p),'chest');
 assert.equal(c.defenseClassifyBodyHitgroup(q(0,1.1,.64),{...p,yaw:Math.PI/2}),'arm');
 assert.throws(()=>c.defenseClassifyBodyHitgroup(q(NaN,.8,0),p),RangeError);
 assert.throws(()=>c.defenseHitgroupMultiplier('unknown'),RangeError);
});
test('body damage order is distance adjusted raw then zone then passive defense',()=>{
 const c=setup();
 for(const [group,dmg] of [['chest',28],['stomach',35],['arm',28],['leg',21]]){
  near(c.defenseDamage({},40,'bullet-body',9,group),dmg);
 }
 near(c.defenseDamage({},40,'bullet-body',2,'chest'),32);
 near(c.defenseDamage({},40,'bullet-body',2,'stomach'),40);
 near(c.defenseDamage({},40,'bullet-body',2,'leg'),24);
 near(c.defenseDamage({},40,'bullet-body',18,'stomach'),35);
 const raw=36*Math.pow(c.WP[9].rangeModifier,60/c.WP[9].rangeUnit);
 near(c.defenseDamage({},raw,'bullet-body',9,'stomach'),raw*1.25*.7);
});
test('headshot, helmet, melee and explosive rules remain unchanged',()=>{
 const c=setup(),a={};c.defenseSpawn(a);
 assert.equal(a.hp,100);assert.equal(a.helm,true);assert.equal(Object.hasOwn(a,'vest'),false);
 for(const kind of ['head','melee','explosion']){
  assert.equal(c.defenseDamage(a,40,kind,9,'stomach'),40);
 }
 assert.equal(c.defenseHeadshotDamage(33),99);
 assert.equal(c.DEFENSE_RULES.bodyReduction,.30);
 assert.equal(c.DEFENSE_RULES.pumpShotgunBodyReduction,.20);
 assert.equal(c.WP.length,19);
});
test('projectileHitCharacter forwards actual contact group and weapon ID without trusting input',()=>{
 const c=setup(),calls=[];
 c.pl={x:0,y:0,z:0,face:0,helm:true};
 c.popPl=()=>{c.pl.helm=false;};c.popHelm=e=>{e.helm=false;};
 c.fall=()=>1;
 c.hurt=(d,sx,sz,kind,wid,group)=>calls.push({target:'player',kind,wid,group,dmg:c.defenseDamage({},d,kind,wid,group)});
 c.dmgE=(actor,d,kx,kz,ex,kind,wid,group)=>calls.push({target:'bot',kind,wid,group,dmg:c.defenseDamage({},d,kind,wid,group)});
 runInNewContext(read('src/game/42-projectile-defense.js'),c);
 const shot={dmg:40,fo:null,vx:1,vz:0,sx:0,sz:0,wid:9,by:{tm:1},m:{position:{x:0,y:.85,z:0}}};
 const bot={x:0,y:0,z:0,g:{rotation:{y:0}},helm:true};
 c.projectileHitCharacter(shot,bot,false);
 c.projectileHitCharacter(shot,c.pl,false);
 assert.equal(calls[0].group,'stomach');
 assert.equal(calls[1].group,'stomach');
 assert.equal(calls[0].dmg,35);
 assert.deepEqual(calls[0].dmg,calls[1].dmg);
 shot.m.position.y=.32;
 c.projectileHitCharacter(shot,bot,false);
 assert.equal(calls.at(-1).group,'leg');
 assert.equal(calls.at(-1).dmg,21);
 shot.m.position.y=1.2;shot.m.position.x=.61;
 c.projectileHitCharacter(shot,bot,false);
 assert.equal(calls.at(-1).group,'arm');
 assert.equal(calls.at(-1).dmg,28);
});
