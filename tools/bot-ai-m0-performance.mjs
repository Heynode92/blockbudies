// M0 developer-only synthetic BOT tick CPU baseline. No browser/WebGL and no gameplay mutations.
// Timing includes the VM dispatch and synthetic world stub overhead; do not report as FPS.
import {runBotM0Baseline} from './bot-ai-m0-baseline.mjs';

function percentile(values, fraction){
  if(!values.length)throw new Error('No BOT tick samples');
  const sorted=values.slice().sort((a,b)=>a-b);
  return sorted[Math.ceil(fraction*sorted.length)-1];
}
const configs=[
  {mode:'tdm',visibility:'open',seed:42},
  {mode:'tdm',visibility:'blocked',seed:42},
  {mode:'bomb',visibility:'open',seed:42}
];
const report=[];
for(const config of configs){
  // JIT / VM warm-up is measured separately from the reported batch.
  for(let n=0;n<3;n++)runBotM0Baseline(config);
  const samples=[];
  let reference=null;
  for(let n=0;n<12;n++){
    const output=runBotM0Baseline({...config,onTick:deltaMs=>{
      if(!Number.isFinite(deltaMs)||deltaMs<0)throw new Error('Invalid performance sample');
      samples.push(deltaMs);
    }});
    const serialized=JSON.stringify(output);
    if(reference===null)reference=serialized;
    else if(reference!==serialized)throw new Error('Seeded BOT trace diverged during CPU benchmark');
  }
  if(samples.length!==720)throw new Error('Incorrect count: 12 repetitions x 60 frames expected');
  report.push({
    scenario:config,botCount:10,samples:samples.length,
    botUpdateCpuMsMedian:percentile(samples,.5),
    botUpdateCpuMsP95:percentile(samples,.95),
    botUpdateCpuMsMax:Math.max(...samples),
    fixtureTraceStable:true
  });
}
console.log(JSON.stringify({
  kind:'POINT_BLOCK_M0_SYNTHETIC_CPU_BENCHMARK',
  runtime:{node:process.version,platform:process.platform,arch:process.arch},
  fixture:'synthetic-flat-10-bot-no-human',
  semantics:'CPU time includes vm.runInContext and synthetic stubs, not browser frame time',
  isBrowserFps:false,isRealHitRate:false,isRealReactionLatency:false,
  results:report
},null,2));
