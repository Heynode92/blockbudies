import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8').replace(/\r\n/g,'\n');
const source=read('src/game/50-items-and-drops.js');

function dropHarness(){
  const added=[],removed=[];
  function makeGun(){
    return {
      isMesh:true,castShadow:false,visible:true,
      rotation:{x:0,y:0,z:0,order:'XYZ'},
      position:{x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}},
      scale:{setScalar(v){this.scalar=v;}},
      traverse(cb){cb(this);}
    };
  }
  const ctx={
    Math,Array,Object,WP:[{stats:{kind:'pistol'}},{stats:{kind:'rifle'}}],
    pl:{w:1,face:0,x:0,z:0},dg:[],
    S:{add(m){added.push(m);},remove(m){removed.push(m);},attach(){}},
    mkGun:makeGun,gh(){return 0;},resolve(){},spark(){}
  };
  const addSrc=source.slice(source.indexOf('function addDrop('),source.indexOf('// Shell casings.'));
  const gunSrc=source.slice(source.indexOf('var GSC='),source.indexOf('// wrapA():'));
  const physicsSrc=source.slice(source.indexOf('function wrapA('));
  assert.ok(addSrc.startsWith('function addDrop('));
  assert.ok(gunSrc.includes('function dropPlayerGun()'));
  assert.ok(gunSrc.includes('function detachGun('));
  assert.ok(physicsSrc.includes('function updDrops('));
  vm.createContext(ctx);
  vm.runInContext(addSrc+gunSrc+'\n'+physicsSrc,ctx);
  return {ctx,added,removed,makeGun};
}

test('player-death weapon drop has exactly the same temporary lifetime as BOT weapon drops',()=>{
  const {ctx,added,makeGun}=dropHarness();
  vm.runInContext('dropPlayerGun()',ctx);
  assert.equal(ctx.dg.length,1);
  const playerDrop=ctx.dg[0];
  const droppedBotWeapon=makeGun();
  ctx.enemy={g:{userData:{rg:droppedBotWeapon}},x:0,z:0};
  vm.runInContext('detachGun(enemy,1,0,false)',ctx);
  assert.equal(ctx.dg.length,2);
  const botDrop=ctx.dg[1];
  for(const drop of [playerDrop,botDrop]){
    assert.equal(drop.keep,false,'neither weapon drop should be permanent');
    assert.equal(drop.life,7,'both share the existing seven-second drop life');
    assert.equal(drop.t,0);
    assert.equal(drop.land,false,'both use the existing gravity/bounce physics');
  }
  assert.equal(added.length,1,'player gun still spawns visibly, BOT reuses its rig');
  assert.equal(ctx.enemy.g.userData.rg,null,'BOT gun remains detached from its original rig');
});

test('player and BOT dropped weapons land, briefly flash and get removed from the scene',()=>{
  const {ctx,removed,makeGun}=dropHarness();
  vm.runInContext('dropPlayerGun()',ctx);
  const playerGun=ctx.dg[0].m;
  ctx.enemy={g:{userData:{rg:makeGun()}},x:0,z:0};
  vm.runInContext('detachGun(enemy,1,0,false)',ctx);
  const botGun=ctx.dg[1].m;
  for(let i=0;i<20;i++)vm.runInContext('updDrops(.05)',ctx);
  assert.equal(ctx.dg.length,2,'guns remain after landing');
  assert.ok(ctx.dg.every(d=>d.land));
  for(let i=0;i<140;i++)vm.runInContext('updDrops(.05)',ctx);
  assert.equal(ctx.dg.length,0,'no player or BOT weapon remains after its expiry');
  assert.ok(removed.includes(playerGun));
  assert.ok(removed.includes(botGun));
});

test('player gun stays temporary for all equipped weapon types, with existing transforms preserved',()=>{
  const {ctx}=dropHarness();
  ctx.WP=Array.from({length:19},(_,i)=>({stats:{kind:i===18?'shotgun':i===17?'sniper':i===14?'smg':'rifle'}}));
  for(const id of [0,1,2,3,4,5,6,7,8,11,14,17,18]){
    ctx.pl.w=id;
    assert.doesNotThrow(()=>vm.runInContext('dropPlayerGun()',ctx));
    const d=ctx.dg.at(-1);
    assert.equal(d.keep,false,'id '+id+' created a persistent weapon');
    assert.ok(Number.isFinite(d.m.scale.scalar));
    assert.ok(d.m.scale.scalar>0);
    assert.ok(Number.isFinite(d.h));
  }
});

test('expiring dropped guns does not change shell casing lifespan or match reset',()=>{
  assert.match(source,/q\.life=1;q\.cs=1/,'casings keep their original short lifetime');
  assert.match(source,/if\(!d\.keep&&d\.t>d\.life\)/,'shared expiration still respects keep flag');
  assert.match(read('src/game/45-combat.js'),/dg=\[\]/,'match reset still clears all drops');
  assert.match(read('src/game/65-audio.js'),/detachGun\(e,kx,kz,ex\)/,'BOT death path unchanged');
  assert.match(read('src/game/70-kills-and-damage-hud.js'),/dropPlayerGun\(\)/,'player death still creates the visible drop');
});
