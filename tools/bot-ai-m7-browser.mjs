// BLOCK BUDDIES M7 — Windows CI browser QA. Not part of assets/game.js.
// Runs production browser code. Fast-forward steps are labelled SIMULATED, never FPS.
// Requires pinned Playwright and Three r128 in the CI-only node_modules directory.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root=path.resolve(import.meta.dirname,'..');
const out=path.join(root,'artifacts','m7-browser');
fs.mkdirSync(out,{recursive:true});
const team=process.env.M7_TEAM==='terrorist'?1:0;
const name=team?'terrorist':'police';
const target=Number(process.env.M7_BOMB_ROUNDS||50);
if(!Number.isInteger(target)||target<1||target>150)throw Error('M7_BOMB_ROUNDS must be an integer 1..150');
const three=path.join(root,'node_modules','three','build','three.min.js');
if(!fs.existsSync(three))throw Error('Three.js r128 package is not installed');
const url=pathToFileURL(path.join(root,'index.html')).href;
const results={schema:'BLOCK_BUDDIES_M7_CI_BROWSER_V1',team:name,target,platform:process.platform,
  source:'Production assets/game.js via file://; Three.js 0.128.0 resolved locally in CI',
  conditions:['QA-only passive human is replaced by an actual canonical BOT for 5v5',
    'Fast simulation uses production update(1/60) and authentic bombFinish(), not human-clock rAF',
    'Fast-mode outcomes do not certify real-time FPS, a matched M0 baseline, or human play quality'],
  realTime:[],simulation:null,errors:[],result:'INCOMPLETE'};
const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
  '--disable-gpu-sandbox'
]});
async function pageFor(mode){
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
 const page=await context.newPage();
 const jsErrors=[];
 page.on('pageerror',err=>jsErrors.push(String(err.message||err)));
 page.on('crash',()=>jsErrors.push('BROWSER_PAGE_CRASH'));
 // Resolve the exact Three.js r128 dependency locally without changing the player-facing HTML.
 await page.route('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
   route=>route.fulfill({path:three,contentType:'application/javascript'}));
 await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//,route=>route.abort());
 await page.goto(url+'?bbBotQa=1',{waitUntil:'load',timeout:90000});
 await page.waitForFunction(()=>typeof BlockBuddiesQA==='object'&&
   typeof begin==='function'&&typeof update==='function'&&typeof BOMB_RULES==='object',
   {timeout:30000});
 const init=await page.evaluate(({mode,team})=>{
   roomMatchConfig={mode,kills:100,minutes:1,rounds:12,roundMinutes:1};
   selM=mode;
   begin(team); // canonical start: true map, collisions, weapons and all production AI modules
   // QA-only roster substitution: 9 production bots + 1 new production bot,
   // instead of 9 bots plus an unmanned, vulnerable human.
   function substitute(){
     if(en.filter(e=>!e.dead||e.dead).length!==9)return false;
     pl.dead=true;
     pl.rsT=1e8;
     var b=newBot(team,4);
     b.st={name:b.name,tm:team,k:0,d:0};
     ROS.push(b.st);placeBot(b);
     if(mode===1&&bombMatch&&bombMatch.carrier===pl){
       var eligible=en.filter(e=>e.tm===1&&!e.dead);
       bombMatch.carrier=eligible[Math.floor(Math.random()*eligible.length)]||null;
       window.__m7CarrierSubstitutions=(window.__m7CarrierSubstitutions||0)+1;
     }
     return true;
   }
   window.__m7Substitute=substitute;
   if(!substitute())throw Error('Expected canonical nine BOT roster before 5v5 substitution');
   BlockBuddiesQA.reset();
   return {map:isBombMode()?'LOCKDOWN':'BLOCK DISTRICT',bots:en.length,
     teams:[en.filter(e=>e.tm===0).length,en.filter(e=>e.tm===1).length],
     roundSeconds:roomRoundSeconds(),roundLimit:roomRoundLimit()};
 },{mode,team});
 if(init.bots!==10||init.teams[0]!==5||init.teams[1]!==5)
   throw Error('5v5 canonical bot substitution failed: '+JSON.stringify(init));
 return {page,context,jsErrors,init};
}
try{
 // Browser-rendered rAF sample on CI hardware. This is genuine wall-time rendering,
 // unlike the accelerated gameplay test below.
 for(const mode of [0,1]){
   const {page,context,jsErrors,init}=await pageFor(mode);
   await page.waitForTimeout(Number(process.env.M7_REALTIME_MS||12000));
   const sample=await page.evaluate(()=>({
     qa:BlockBuddiesQA.report(),rendering:R.info.render.calls,
     active:run,over:mt.over,bots:en.length,webgl:!!R.getContext()
   }));
   results.realTime.push({mode:mode?'bomb':'tdm',init,...sample,jsErrors});
   await context.close();
 }
 // QA-only accelerated stepping: keep the real rAF loop *rendering* but set run=false
 // to avoid double simulation. Each update(1/60) advances the real game's own
 // timers, projectiles, BOT logic, pathfinding, plant/defuse and round transitions.
 // No direct bombFinish calls, forced kills, fake plants, or altered BOMB_RULES.
 const {page,context,jsErrors,init}=await pageFor(1);
 await page.evaluate(()=>{run=false;BlockBuddiesQA.reset();});
 let ticks=0,matchCount=1,lastRound=1,stalledChunks=0;
 const start=Date.now();
 const maxTicks=target*120*60*3; // safety budget: 3x maximum 120s Bomb rounds
 let prevCompleted=0;
 while(ticks<maxTicks){
   const progress=await page.evaluate(({steps,team})=>{
     for(let i=0;i<steps;i++){
       if(mt.over)break;
       update(1/60);
       // bombNextRound uses canonical reset/startMatch; restore the QA-only
       // replacement AFTER the new round, before the next combat tick.
       if(en.length===9&&!mt.over&&!bombMatch.done){
         if(!window.__m7Substitute())throw Error('Could not restore 5v5 QA BOT roster');
       }
       if(en.length!==10&&!mt.over)throw Error('Unexpected QA roster size '+en.length);
     }
     return {over:mt.over,round:bombMatch?.round,completed:BlockBuddiesQA.report().bombRounds.completed,
       planted:BlockBuddiesQA.report().bombRounds.plantedAtFinish,qa:BlockBuddiesQA.report(),
       teams:[en.filter(e=>e.tm===0).length,en.filter(e=>e.tm===1).length]};
   },{steps:180,team});
   ticks+=180;
   if(progress.completed>=target)break;
   if(progress.completed===prevCompleted)stalledChunks++;else stalledChunks=0;
   prevCompleted=progress.completed;
   if(stalledChunks>700)throw Error('Bomb simulation made no completed-round progress for 35 simulated minutes');
   if(Date.now()-start>55*60*1000)throw Error('Browser simulation reached CI wall-time safety limit');
   if(progress.over){
     // Authentic match end after 7 wins/12 rounds. Restart via canonical begin,
     // retain the cumulative QA counters across matches in the same tab.
     await page.evaluate(({team})=>{
       begin(team);
       run=false;
       if(!window.__m7Substitute())throw Error('5v5 QA substitution failed on new match');
     },{team});
     matchCount++;
   }
 }
 const final=await page.evaluate(()=>({
   qa:BlockBuddiesQA.report(),matchOver:mt.over,round:bombMatch?.round,
   carrierSubstitutions:window.__m7CarrierSubstitutions||0,
   teams:[en.filter(e=>e.tm===0).length,en.filter(e=>e.tm===1).length]
 }));
 results.simulation={label:'ACCELERATED_PRODUCTION_BROWSER_SIMULATION_NOT_REALTIME',
   requestedRounds:target,matches:matchCount,simulationTicks:ticks,
   dtSeconds:1/60,realWallSeconds:(Date.now()-start)/1000,init,...final,jsErrors};
 await context.close();
 // A green test means this automated functional gate works, not M7 final release.
 if(results.realTime.some(s=>s.jsErrors.length||!s.active||!s.webgl||
    s.bots!==10||s.qa.frameTimeMs.count<100||s.qa.botUpdateCpuMs.count<100))
   throw Error('Real-time WebGL/QA smoke failed, see artifacts');
 if(jsErrors.length)throw Error('Accelerated browser emitted uncaught JS errors');
 if(final.qa.bombRounds.completed<target)
   throw Error('Only '+final.qa.bombRounds.completed+'/'+target+' genuine Bomb round finishes observed');
 if(final.qa.pathAttempts===0)throw Error('No real BOT A* activity recorded');
 if(final.qa.projectileCount===0)throw Error('No BOT-fired projectiles recorded');
 if(final.qa.bombRounds.policeWins+final.qa.bombRounds.terroristWins!==
    final.qa.bombRounds.completed)throw Error('Bomb winner accounting mismatch');
 results.result='AUTOMATED_FUNCTIONAL_PASS_NOT_FINAL_M7_RELEASE';
}catch(err){results.errors.push(String(err.stack||err));results.result='FAIL';process.exitCode=1;
}finally{
 fs.writeFileSync(path.join(out,'m7-'+name+'.json'),JSON.stringify(results,null,2)+'\n');
 console.log(JSON.stringify({result:results.result,team:name,
   realtime:results.realTime.map(s=>({mode:s.mode,frames:s.qa.frameTimeMs.count,cpu:s.qa.botUpdateCpuMs.count,
    p95:s.qa.frameTimeMs.p95,errors:s.jsErrors})),
   bombRounds:results.simulation?.qa?.bombRounds,
   errors:results.errors},null,2));
 await browser.close();
}
