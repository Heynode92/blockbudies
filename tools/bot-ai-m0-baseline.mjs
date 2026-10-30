// M0 development-only, deterministic BOT baseline; never loaded by the browser bundle.
// This harness runs the ACTUAL current AI, weapon and Bomb tactical functions with
// an explicit synthetic world. It does NOT simulate real projectile hits or FPS.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';

const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8').replace(/\r\n/g,'\n');
const modules=[
  'src/game/41-bot-weapons.js',
  'src/game/88-bot-perception.js',
  'src/game/89-bot-tactical-intelligence.js',
  'src/game/87-bomb-tactics.js'
];
const activePath='src/game/90-bot-ai.js';
const active=read(activePath);
const legacyMarker='// botsUpdOld(dt)';
if(!active.includes(legacyMarker))throw new Error('BOT legacy boundary changed: review M0 harness');

function seededRandom(seed){
  let state=seed>>>0;
  return ()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
}
function actor(team,idx,critical){
  const x=(idx-2)*1.5,z=team===0?-8:8;
  return {
    tm:team,idx,x,z,wx:x,wz:z,y:0,dead:false,hp:critical?25:100,
    inv:0,vis:0,tq:0,cd:0,primary:1,weapon:1,visualWeapon:1,
    ammo:{1:{mag:30,res:90},0:{mag:12,res:30},5:{mag:0,res:0}},
    reloadId:null,grenadeAt:Infinity,
    g:{rotation:{y:0},position:{set(){}},userData:{}},
    legs:[{rotation:{x:0}},{rotation:{x:0}}],
    arms:[{rotation:{x:0,z:0}},{rotation:{x:0,z:0}}],
    body:{position:{y:0},rotation:{x:0,y:0,z:0}}
  };
}
const round=n=>Number(n.toFixed(4));

/**
 * Purely synthetic 10-BOT fixtures; no human actor, actual map or WebGL.
 * Do not interpret fire() dispatch as a real hit or a successful bomb action.
 */
export function runBotM0Baseline({
  seed=42,mode='tdm',visibility='open',critical=false,frames=60,dt=.05,onTick=null
}={}){
  if(!Number.isSafeInteger(seed)||!Number.isInteger(frames)||frames<1||frames>300||
     !Number.isFinite(dt)||dt<=0||dt>.1||
     !['tdm','bomb'].includes(mode)||!['open','blocked'].includes(visibility)||
     (onTick!==null&&typeof onTick!=='function'))
    throw new RangeError('Invalid bounded baseline scenario');
  const seededMath=Object.create(Math);
  seededMath.random=seededRandom(seed);
  const shots=[],metrics={footstepCalls:0,losChecks:0,clampCorrections:0,meleeCalls:0};
  const c={
    Math:seededMath,A:14,tt:0,mt:{cd:0,over:false},rq:[],
    en:Array.from({length:10},(_,i)=>actor(i<5?0:1,i%5,critical)),
    pl:{dead:true,tm:0,x:0,z:0},
    WP:Array.from({length:19},(_,i)=>({
      mag:30,res:90,rt:1.2,cd:.17,range:40,spd:120,dmg:20,
      stats:{kind:i===0?'pistol':'rifle'}
    })),
    BOMB_SITES:[{x:-3,z:4},{x:3,z:4}],BOMB_RULES:{interactRadius:2},
    bombMatch:null,grs:[],
    isBombMode:()=>mode==='bomb',
    inObs:()=>false,
    los(){metrics.losChecks++;return visibility==='open';},
    resolve(e){
      const oldX=e.x,oldZ=e.z;
      e.x=Math.max(-13,Math.min(13,e.x));
      e.z=Math.max(-13,Math.min(13,e.z));
      if(e.x!==oldX||e.z!==oldZ)metrics.clampCorrections++;
    },
    gh:()=>0,flash:()=>{},aimArms:()=>{},
    footstepAdvance(){metrics.footstepCalls++;},
    fire(e,yaw,weapon,side,pitch){
      shots.push({t:round(c.tt),team:e.tm,bot:e.idx,
        yaw:round(yaw),pitch:round(pitch),weapon:weapon.stats.kind,side});
    },
    clearTo:()=>true,
    hurt(){metrics.meleeCalls++;},
    dmgE(){metrics.meleeCalls++;},
    mkGren:()=>({}),
    mkGun:()=>({rotation:{},scale:{setScalar(){}},position:{set(){}},traverse(){}}),
    bombArea:()=>-1,bombActionFor:()=>null,bombBotGoal:()=>null
  };
  if(mode==='bomb')c.bombMatch={
    state:'idle',done:false,round:1,dropped:null,carrier:c.en[5],defuser:null
  };
  vm.createContext(c);
  for(const path of modules)vm.runInContext(read(path),c,{filename:path,timeout:5000});
  vm.runInContext(active.split(legacyMarker)[0],c,{filename:activePath,timeout:5000});
  if(mode==='bomb')vm.runInContext('bombBotGoal=bombTacticalGoal',c);
  const initial=c.en.map(e=>[e.x,e.z]);
  for(let frame=0;frame<frames;frame++){
    c.tt=frame*dt;
    if(onTick){
      const start=performance.now();
      vm.runInContext('botsUpd('+dt+')',c,{timeout:5000});
      onTick(performance.now()-start);
    }else{
      vm.runInContext('botsUpd('+dt+')',c,{timeout:5000});
    }
  }
  const teamShots=[0,1].map(team=>shots.filter(s=>s.team===team).length);
  const teamDistance=[0,1].map(team=>round(c.en.reduce((sum,e,i)=>
    sum+(e.tm===team?Math.hypot(e.x-initial[i][0],e.z-initial[i][1]):0),0)));
  return {
    fixture:'synthetic-10-bot-no-human',
    seed,mode,visibility,critical,frames,dt,simulatedSeconds:round(frames*dt),
    shotsDispatched:shots.length,shotsByTeam:teamShots,
    firstShotSeconds:shots.length?shots[0].t:null,
    nonzeroPitchShots:shots.filter(s=>s.pitch!==0).length,
    distanceByTeam:teamDistance,
    finalPositions:c.en.map(e=>[round(e.x),round(e.z)]),
    retreatBots:c.en.filter(e=>e.smartRetreat).length,
    ...metrics,
    // No real hit%, reaction latency, Bomb objective completion, browser FPS or
    // native collision KPIs can be inferred from this isolated fixture.
    unavailableMetrics:['realHitRate','realReactionLatency','bombRoundWinRate','browserFps']
  };
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  const scenarios=[
    {seed:42,mode:'tdm'},
    {seed:42,mode:'tdm',visibility:'blocked'},
    {seed:42,mode:'tdm',critical:true},
    {seed:42,mode:'bomb'}
  ];
  console.log(JSON.stringify({kind:'BLOCK_BUDDIES_M0_SYNTHETIC_BASELINE',
    results:scenarios.map(runBotM0Baseline)},null,2));
}
