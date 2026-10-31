// M7 Windows automated browser functional QA. CI-only, never bundled for players.
// Two evidence domains: true wall-time WebGL/rAF smoke and accelerated production
// browser update() simulation. They are NOT interchangeable benchmarks.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root=path.resolve(import.meta.dirname,'..');
const out=path.join(root,'artifacts','m7-browser');
fs.mkdirSync(out,{recursive:true});
const team=process.env.M7_TEAM==='terrorist'?1:0;
const name=team?'terrorist':'police';
const mapId=process.env.M7_MAP==='hospital'?'hospital':process.env.M7_MAP==='block-labs'?'block-labs':process.env.M7_MAP==='block-town'?'block-town':'lockdown';
const target=Number(process.env.M7_BOMB_ROUNDS||50);
if(!Number.isInteger(target)||target<1||target>150)
  throw Error('M7_BOMB_ROUNDS must be an integer 1..150');
const three=path.join(root,'node_modules','three','build','three.min.js');
if(!fs.existsSync(three))throw Error('Missing exact npm three@0.128.0 in CI runner');

// CI-generated copies are never committed and never substitute the player's
// production index.html/assets/game.js. The exact production IIFE is kept
// intact except for a privileged test bridge inserted before its closing brace.
const source=fs.readFileSync(path.join(root,'assets','game.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'tools','bot-ai-m7-browser-bridge.js'),'utf8');
const last=source.lastIndexOf('\n})();');
if(last<0||source.slice(last).trim()!== '})();')
  throw Error('Unexpected canonical bundle closure: refusing unsafe test injection');
const ciBundle=path.join(root,'assets','game.m7-ci.generated.js');
fs.writeFileSync(ciBundle,source.slice(0,last)+'\n'+bridge+'\n'+source.slice(last));
const htmlSource=fs.readFileSync(path.join(root,'index.html'),'utf8');
const originalThree='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
if(!htmlSource.includes(originalThree)||!htmlSource.includes('./assets/game.js'))
  throw Error('Source-of-truth HTML script URLs changed unexpectedly');
const ciHtml=path.join(root,'index.m7-ci.generated.html');
const html=htmlSource
  .replace(originalThree,'./node_modules/three/build/three.min.js')
  .replace('./assets/game.js','./assets/game.m7-ci.generated.js')
  .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/[^"]+">/g,'');
fs.writeFileSync(ciHtml,html);
const url=pathToFileURL(ciHtml).href;

const results={schema:'POINT_BLOCK_M7_CI_BROWSER_V1',team:name,mapId,target,
  source:'Original production IIFE with CI-only injected bridge; local matching Three.js 0.128.0',
  limitations:['The CI test bridge is NOT part of assets/game.js or normal player runtime',
    'Passive human seat is replaced with a canonical production BOT for 5v5 in QA only',
    'Fixed 1/60-second production update stepping is accelerated functional evidence, NOT wall-time FPS',
    'CI environment does not substitute for a matched historical M0 browser performance baseline',
    'A green functional test does not automatically certify the full M7 release gates'],
  realTime:[],simulation:null,errors:[],result:'INCOMPLETE'};
const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-gpu-sandbox'
]});
async function createPage(){
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
 const page=await context.newPage();
 const jsErrors=[];
 page.on('pageerror',err=>jsErrors.push(String(err.message||err)));
 page.on('crash',()=>jsErrors.push('BROWSER_PAGE_CRASH'));
 page.on('console',msg=>{if(msg.type()==='error')jsErrors.push('CONSOLE: '+msg.text());});
 await page.goto(url+'?bbBotQa=1',{waitUntil:'load',timeout:90000});
 try{
   await page.waitForFunction(()=>typeof window.__PointBlockM7CI==='object' &&
     typeof window.PointBlockQA==='object',null,{timeout:25000});
 }catch(err){
   const diagnostics=await page.evaluate(()=>({
     ready:document.readyState,three:typeof THREE,qa:typeof PointBlockQA,
     bridge:typeof window.__PointBlockM7CI,scripts:[...document.scripts].map(x=>x.src)
   })).catch(e=>({inspectionError:String(e)}));
   try{await page.screenshot({path:path.join(out,'m7-'+name+'-startup-failure.png')});}catch(_){}
   throw Error('CI browser startup failed: '+JSON.stringify({error:String(err),diagnostics,jsErrors}));
 }
 return {page,context,jsErrors};
}
async function start(page,mode){
 const init=await page.evaluate(({mode,team,mapId})=>window.__PointBlockM7CI.start(mode,team,mapId),{mode,team,mapId});
 if(init.bots!==10||init.teams[0]!==5||init.teams[1]!==5)
   throw Error('Real 5v5 BOT roster was not created: '+JSON.stringify(init));
 return init;
}
try{
 // Actual rAF, GPU/WebGL and BOT CPU in two separate live-mode windows.
 for(const mode of (mapId==='block-labs'?[0]:[0,1])){
   const {page,context,jsErrors}=await createPage();
   const init=await start(page,mode);
   await page.waitForTimeout(Number(process.env.M7_REALTIME_MS||12000));
   results.realTime.push({mode:mode?'bomb':'tdm',init,
     ...(await page.evaluate(()=>window.__PointBlockM7CI.summary())),jsErrors});
   await context.close();
 }
 if(mapId==='block-labs'){
   // ACTUAL Deathmatch engine, 5v5 BOT-only, fixed timestep in real Chromium.
   // No Bomb match is run or mislabelled as Lab Deathmatch.
   const {page,context,jsErrors}=await createPage();
   const init=await start(page,0);
   await page.evaluate(()=>window.__PointBlockM7CI.pauseForStepping());
   const beginAt=Date.now();let ticks=0,done=false;
   for(;ticks<2*60*60+180;ticks+=180){
     const state=await page.evaluate(()=>window.__PointBlockM7CI.step(180));
     if(state.over){done=true;break;}
     if(Date.now()-beginAt>25*60*1000)throw Error('Block Labs TDM browser smoke exceeded CI safety limit');
   }
   const final=await page.evaluate(()=>window.__PointBlockM7CI.summary());
   results.simulation={label:'ACCELERATED_PRODUCTION_BROWSER_TDM_NOT_REALTIME',
     gameplay:'TEAM_DEATHMATCH',simulatedTicks:ticks+180,dtSeconds:1/60,
     wallSeconds:(Date.now()-beginAt)/1000,init,...final,jsErrors};
   await context.close();
   if(!done||!final.over)throw Error('Block Labs canonical Deathmatch did not complete');
   if(final.scores[0]+final.scores[1]<1)throw Error('Block Labs deathmatch produced no BOT kills');
 }else{
 const {page,context,jsErrors}=await createPage();
 const init=await start(page,1);
 await page.evaluate(()=>window.__PointBlockM7CI.pauseForStepping());
 const started=Date.now();
 let ticks=0,matches=1,prev=0,stagnant=0,reported=0;
 const maxTicks=target*120*60*3;
 while(ticks<maxTicks){
   const progress=await page.evaluate(()=>window.__PointBlockM7CI.step(180));
   ticks+=180;
   if(progress.completed>=reported+10){
     reported=progress.completed;
     console.log('M7 '+name+' '+mapId+' automated production Bomb finishes: '+reported+'/'+target);
   }
   if(progress.completed>=target)break;
   if(progress.completed===prev)stagnant++;else stagnant=0;
   prev=progress.completed;
   if(stagnant>700)throw Error('No completed Bomb rounds for 35 simulated minutes');
   if(Date.now()-started>55*60*1000)throw Error('M7 browser simulation exceeded wall-time safety cap');
   if(progress.over){
     await page.evaluate(team=>window.__PointBlockM7CI.restart(team),team);
     matches++;
   }
 }
 const bombFinal=await page.evaluate(()=>window.__PointBlockM7CI.summary());
 results.simulation={label:'ACCELERATED_PRODUCTION_BROWSER_SIMULATION_NOT_REALTIME',
   requestedRounds:target,matches,simulationTicks:ticks,dtSeconds:1/60,
   wallSeconds:(Date.now()-started)/1000,init,...bombFinal,jsErrors};
 await context.close();
 }
 const final=results.simulation;
 // Windows hosted CI uses a SwiftShader software renderer. A CPU-contended
 // 12-second wall-time window can produce just 5-6 qualifying rAF samples.
 // One observed valid frame/update is enough to establish runtime smoke,
 // but NEVER enough to certify performance. Keep that separate and explicit.
 results.performanceAssessment={
   status:'NOT_CERTIFIED_CI_SOFTWARE_WEBGL_UNPAIRED',
   comparableToM0:false,
   modeSamples:results.realTime.map(s=>({
     mode:s.mode,
     frameSamples:s.qa.frameTimeMs.count,
     botCpuSamples:s.qa.botUpdateCpuMs.count,
     quality:s.qa.frameTimeMs.count<100||s.qa.botUpdateCpuMs.count<100
       ?'INSUFFICIENT_FOR_PERFORMANCE_BENCHMARK':'CI_ONLY_NOT_M0_PAIRED'
   }))
 };
 if(results.realTime.some(s=>s.jsErrors.length||!s.active||!s.webgl||
    s.init.bots!==10||s.qa.frameTimeMs.count<1||s.qa.botUpdateCpuMs.count<1))
   throw Error('Real-time WebGL runtime or BOT instrumentation smoke failed');
 if(final.jsErrors.length)throw Error('Accelerated browser emitted JS errors: '+final.jsErrors.join('; '));
 if(mapId!=='block-labs'){
   if(final.qa.bombRounds.completed<target)
     throw Error('Only '+final.qa.bombRounds.completed+'/'+target+' authentic Bomb finishes');
   if(final.qa.bombRounds.policeWins+final.qa.bombRounds.terroristWins!==
      final.qa.bombRounds.completed)throw Error('Bomb winner accounting mismatch');
 }
 if(final.qa.pathAttempts===0||final.qa.projectileCount===0)
   throw Error('Missing real A* or BOT projectile activity in production simulation');
 results.result='AUTOMATED_FUNCTIONAL_PASS_NOT_FINAL_M7_RELEASE';
}catch(err){
 results.errors.push(String(err.stack||err));results.result='FAIL';process.exitCode=1;
}finally{
 fs.writeFileSync(path.join(out,'m7-'+mapId+'-'+name+'.json'),JSON.stringify(results,null,2)+'\n');
 console.log(JSON.stringify({result:results.result,team:name,mapId,
   realtime:results.realTime.map(s=>({mode:s.mode,frames:s.qa.frameTimeMs.count,
     cpu:s.qa.botUpdateCpuMs.count,frameP95:s.qa.frameTimeMs.p95,errors:s.jsErrors})),
   scores:results.simulation?.scores,bombRounds:results.simulation?.qa?.bombRounds,
   performanceAssessment:results.performanceAssessment,errors:results.errors},null,2));
 await browser.close();
}
