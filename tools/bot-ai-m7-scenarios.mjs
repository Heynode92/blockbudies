// M7 reproducible synthetic fairness and stability matrix.
// Executes production AI in a fixed-seed synthetic arena, NOT a real match.
// No claims about real hit percentages, FPS, Bomb wins or browser navigation.
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {runBotM0Baseline} from './bot-ai-m0-baseline.mjs';

export function runBotM7Matrix(){
 const seeds=[7,42,99],results=[];
 for(const seed of seeds){
  for(const mode of ['tdm','bomb']){
   for(const visibility of ['open','blocked']){
    const r=runBotM0Baseline({seed,mode,visibility,frames:60,dt:.05});
    if(r.visibility==='blocked'&&r.shotsDispatched!==0)
     throw new Error('FAIRNESS: fired at a fully occluded live opponent, seed='+seed+' mode='+mode);
    if(r.visibility==='open'&&
       (r.shotsByTeam[0]<=0||r.shotsByTeam[1]<=0||r.nonzeroPitchShots<=0))
     throw new Error('ENGAGEMENT: both factions should fire 3D shots on open LOS, seed='+seed+' mode='+mode);
    if(r.finalPositions.some(p=>p.some(v=>!Number.isFinite(v)||Math.abs(v)>13)))
     throw new Error('NAVIGATION: synthetic positions are invalid, seed='+seed+' mode='+mode);
    const replay=runBotM0Baseline({seed,mode,visibility,frames:60,dt:.05});
    if(JSON.stringify(r)!==JSON.stringify(replay))
     throw new Error('REPLAY: deterministic mismatch, seed='+seed+' mode='+mode);
    results.push({seed,mode,visibility,shotsDispatched:r.shotsDispatched,
     shotsByTeam:r.shotsByTeam,nonzeroPitchShots:r.nonzeroPitchShots,
     firstShotSeconds:r.firstShotSeconds,retreatEverBots:r.retreatEverBots,
     clampCorrections:r.clampCorrections,losChecks:r.losChecks});
   }
  }
 }
 for(const seed of seeds){
  const r=runBotM0Baseline({seed,mode:'tdm',visibility:'open',critical:true,frames:60,dt:.05});
  if(r.retreatEverBots<8)
   throw new Error('RETREAT: 8/10 critical actors should retreat in seeded fixture, seed='+seed);
  results.push({seed,mode:'tdm',visibility:'open',critical:true,
   shotsDispatched:r.shotsDispatched,retreatEverBots:r.retreatEverBots});
 }
 return {kind:'BLOCK_BUDDIES_M7_SYNTHETIC_FAIRNESS_MATRIX',environment:'node-vm',
  fixture:'10-bot synthetic no human, no projectile collisions, no browser rendering',
  seeds,scenarioCount:results.length,
  passed:results.length,
  limitations:['no real FPS','no actual projectile hits','no completed Bomb rounds',
   'no actual production map collision','no measured real reaction times'],
  results};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 console.log(JSON.stringify(runBotM7Matrix(),null,2));
}
