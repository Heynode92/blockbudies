import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8').replace(/\r\n/g,'\n');
const combat=read('src/game/45-combat.js'),audio=read('src/game/65-audio.js'),
  hud=read('src/game/70-kills-and-damage-hud.js'),
  sim=read('src/game/95-simulation.js'),bots=read('src/game/41-bot-weapons.js'),
  controls=read('src/game/75-weapon-controls.js');

function sourceSection(source,begin,end){
 const a=source.indexOf(begin),b=source.indexOf(end,a+begin.length);
 assert.ok(a>=0&&b>a,'missing source section: '+begin);
 return source.slice(a,b);
}

test('BOT primary selection cannot roll RPG, while weapon ID 3 remains for players',()=>{
 const match=bots.match(/primaries:\[([^\]]*)\]/);
 assert.ok(match);
 const primary=match[1].split(',').map(Number);
 assert.ok(primary.length>0);
 assert.ok(primary.every(id=>Number.isInteger(id)&&id>0&&id!==3));
 assert.ok(primary.includes(1),'existing assault rifle retained');
 assert.ok(primary.includes(8),'existing sniper retained');
 const script=read('src/game/weapon/04-rpg.js');
 assert.match(script,/WEAPON_PROFILES\[3\]/,'RPG profile remains intact for players');
 assert.match(read('src/game/41-bot-weapons.js'),/var pool=BOT_WEAPONS\.primaries/);
});

test('player kills never refill grenades; fixed starting ammo and normal throws remain',()=>{
 assert.doesNotMatch(audio,/score%4===0\)addGren/);
 assert.doesNotMatch(audio,/addGren\s*\(/);
 assert.doesNotMatch(controls,/function addGren\(/);
 assert.match(controls,/function throwG\(\)\{pl\.mag--/,'grenades are consumed when thrown');
 assert.match(read('src/game/45-combat.js'),/WP\.forEach\(function\(w,i\)\{o\[i\]=\{mag:w\.mag,res:w\.res\}/);
 assert.match(read('src/game/85-lobby-and-match.js'),/pl\.ammo=\{\};WP\.forEach\(function\(w,i\)\{pl\.ammo\[i\]=\{mag:w\.mag,res:w\.res\}/);
 assert.match(read('src/game/weapon/06-grenade.js'),/mag:2,res:2/,'canonical spawn quantity is unchanged');
});

test('3D blood droplets are finite, directional, capped, and removed by shared particle update',()=>{
 const fx=sourceSection(combat,'var BLOOD_FX=','// reset():');
 const step=sourceSection(sim,'for(i=sk.length-1;i>=0;i--)','for(i=mzf.length-1;i>=0;i--)');
 let adds=0,removes=0,materials=0;
 class MeshBasicMaterial{constructor(){materials++;}}
 class Mesh{
  constructor(geometry,material){this.geometry=geometry;this.material=material;
   this.position={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}};
   this.scale={setScalar(n){this.value=n;}};}
 }
 const context={T:{MeshBasicMaterial,Mesh},spG:{},S:{add(){adds++;},remove(){removes++;}},
  sk:[],Number,Math,Object};
 vm.createContext(context);
 vm.runInContext(fx+'\nfunction bloodStep(dt){var i;'+step+'}',context);
 context.bloodHit(1,1.6,2,5,0,true);
 assert.equal(context.sk.length,14,'headshots get a distinctive short burst');
 assert.ok(context.sk.every(q=>q.blood&&q.m.material===context.bloodM));
 assert.ok(context.sk.every(q=>q.l>0&&q.l<.6));
 assert.ok(context.sk.some(q=>q.vx>0),'direction follows bullet movement');
 for(let k=0;k<20;k++)context.bloodHit(0,1,0,1,1,false);
 assert.equal(context.bloodActive,96,'scene particle cap enforced');
 assert.equal(adds,96);
 assert.equal(materials,1,'shared material avoids per-hit GPU allocations');
 context.bloodStep(1);
 assert.equal(context.sk.length,0);
 assert.equal(context.bloodActive,0);
 assert.equal(removes,96);
 context.bloodHit(Number.NaN,1,0,0,0,false);
 assert.equal(context.bloodActive,0,'invalid coordinates cannot create particles');
 assert.match(combat,/bloodActive=0;pl=\{/,'match reset clears blood counter');
});

test('bot and human blood FX trigger only when damage is accepted, not during spawn shields',()=>{
 const botDamage=sourceSection(audio,'function dmgE(e,d,kx,kz,ex,kind){','// hlms =');
 const playerDamage=sourceSection(hud,'function hurt(d,sx,sz,kind){','// die():');
 const calls=[];
 const botContext={Math,defenseDamage:(e,d)=>d,isBombMode:()=>false,
   bombInterruptPlant(){},bloodHit(...args){calls.push(['bot',...args]);},
   killE(){},pl:{}};
 vm.createContext(botContext);vm.runInContext(botDamage,botContext);
 const enemy={inv:2,dead:false,vest:50,hp:100,x:4,y:0,z:5};
 botContext.dmgE(enemy,20,1,0,0,'bullet-body');
 assert.equal(calls.length,0);
 assert.equal(enemy.hp,100);
 enemy.inv=0;botContext.dmgE(enemy,20,1,0,0,'head');
 assert.equal(enemy.hp,80);
 assert.equal(calls.length,1);
 assert.equal(calls[0][6],true,'head flag is passed to particle generator');
 const player={inv:2,dead:false,hp:100,vest:50,x:1,z:2,y:0,face:0};
 const ctx={pl:player,Math,defenseDamage:(e,d)=>d,isBombMode:()=>false,
  bombInterruptPlant(){},bloodHit(...args){calls.push(['player',...args]);},
  hdHit(){},die(){},pm:{fl:0},cs:{s:0,kv:0,yv:0,rv:0},
  document:{getElementById:()=>({style:{opacity:0}})}};
 vm.createContext(ctx);vm.runInContext(playerDamage,ctx);
 ctx.hurt(10,5,2,'bullet-body');
 assert.equal(player.hp,100);assert.equal(calls.length,1);
 player.inv=0;ctx.hurt(10,5,2,'bullet-body');
 assert.equal(player.hp,90);
 assert.equal(calls.length,2);
 assert.equal(calls[1][0],'player');
});

test('all gameplay damage paths still use original hit logic',()=>{
 assert.match(read('src/game/42-projectile-defense.js'),/if\(target===pl\)hurt\(damage/);
 assert.match(read('src/game/42-projectile-defense.js'),/else dmgE\(target,damage/);
 assert.match(read('src/game/45-combat.js'),/dmgE\(e,dmg/);
 assert.match(read('src/game/45-combat.js'),/hurt\(Math\.ceil\(dmg/);
 assert.match(read('src/game/65-audio.js'),/if\(e\.hp<=0\)killE\(e/);
 const manifest=JSON.parse(read('tools/source-manifest.json'));
 const parts=manifest.parts;
 assert.ok(parts.indexOf('src/game/45-combat.js')<parts.indexOf('src/game/65-audio.js'));
 assert.ok(parts.indexOf('src/game/65-audio.js')<parts.indexOf('src/game/95-simulation.js'));
});
