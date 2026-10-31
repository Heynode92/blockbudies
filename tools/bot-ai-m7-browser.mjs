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

const results={schema:'BLOCK_BUDDIES_M7_CI_BROWSER_V1',team:name,target,
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
   await page.waitForFunction(()=>typeof window.__BlockBuddiesM7CI==='object' &&
     typeof window.BlockBuddiesQA==='object',null,{timeout:25000});
 }catch(err){
   const diagnostics=await page.evaluate(()=>({
     ready:document.readyState,three:typeof THREE,qa:typeof BlockBuddiesQA,
     bridge:typeof window.__BlockBuddiesM7CI,scripts:[...document.scripts].map(x=>x.src)
   })).catch(e=>({inspectionError:String(e)}));
   try{await page.screenshot({path:path.join(out,'m7-'+name+'-startup-failure.png')});}catch(_){}
   throw Error('CI browser startup failed: '+JSON.stringify({error:String(err),diagnostics,jsErrors}));
 }
 return {page,context,jsErrors};
}
async function start(page,mode){
 const init=await page.evaluate(({mode,team})=>window.__BlockBuddiesM7CI.start(mode,team),{mode,team});
 if(init.bots!==10||init.teams[0]!==5||init.teams[1]!==5)
   throw Error('Real 5v5 BOT roster was not created: '+JSON.stringify(init));
 return init;
}
try{
 // Actual rAF, GPU/WebGL and BOT CPU in two separate live-mode windows.
 for(const mode of [0,1]){
   const {page,context,jsErrors}=await createPage();
   const init=await start(page,mode);
   await page.waitForTimeout(Number(process.env.M7_REALTIME_MS||12000));
   results.realTime.push({mode:mode?'bomb':'tdm',init,
     ...(await page.evaluate(()=>window.__BlockBuddiesM7CI.summary())),jsErrors});
   await context.close();
 }
 const {page,context,jsErrors}=await createPage();
 const init=await start(page,1);
 await page.evaluate(()=>window.__BlockBuddiesM7CI.pauseForStepping());
 const started=Date.now();
 let ticks=0,matches=1,prev=0,stagnant=0;
 const maxTicks=target*120*60*3;
 while(ticks<maxTicks){
   const progress=await page.evaluate(()=>window.__BlockBuddiesM7CI.step(180));
   ticks+=180;
   if(progress.completed>=target)break;
   if(progress.completed===prev)stagnant++;else stagnant=0;
   prev=progress.completed;
   if(stagnant>700)throw Error('No completed Bomb rounds for 35 simulated minutes');
   if(Date.now()-started>55*60*1000)throw Error('M7 browser simulation exceeded wall-time safety cap');
   if(progress.over){
     await page.evaluate(team=>window.__BlockBuddiesM7CI.restart(team),team);
     matches++;
   }
 }
 const final=await page.evaluate(()=>window.__BlockBuddiesM7CI.summary());
 results.simulation={label:'ACCELERATED_PRODUCTION_BROWSER_SIMULATION_NOT_REALTIME',
   requestedRounds:target,matches,simulationTicks:ticks,dtSeconds:1/60,
   wallSeconds:(Date.now()-started)/1000,init,...final,jsErrors};
 await context.close();
 if(results.realTime.some(s=>s.jsErrors.length||!s.active||!s.webgl||
    s.bots!==10||s.qa.frameTimeMs.count<100||s.qa.botUpdateCpuMs.count<100))
   throw Error('Real-time WebGL or BOT instrumentation smoke failed');
 if(jsErrors.length)throw Error('Accelerated browser emitted JS errors: '+jsErrors.join('; '));
 if(final.qa.bombRounds.completed<target)
   throw Error('Only '+final.qa.bombRounds.completed+'/'+target+' authentic Bomb finishes');
 if(final.qa.pathAttempts===0||final.qa.projectileCount===0)
   throw Error('Missing real A* or BOT projectile activity in production simulation');
 if(final.qa.bombRounds.policeWins+final.qa.bombRounds.terroristWins!==
    final.qa.bombRounds.completed)throw Error('Bomb winner accounting mismatch');
 results.result='AUTOMATED_FUNCTIONAL_PASS_NOT_FINAL_M7_RELEASE';
}catch(err){
 results.errors.push(String(err.stack||err));results.result='FAIL';process.exitCode=1;
}finally{
 fs.writeFileSync(path.join(out,'m7-'+name+'.json'),JSON.stringify(results,null,2)+'\n');
 console.log(JSON.stringify({result:results.result,team:name,
   realtime:results.realTime.map(s=>({mode:s.mode,frames:s.qa.frameTimeMs.count,
     cpu:s.qa.botUpdateCpuMs.count,frameP95:s.qa.frameTimeMs.p95,errors:s.jsErrors})),
   bombRounds:results.simulation?.qa?.bombRounds,errors:results.errors},null,2));
 await browser.close();
}
