import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const workflows=['bot-ai-m0.yml','bot-ai-m7-browser.yml','vite.yml','online-frontend-build.yml','pointblock-gunplay-windows.yml'];
const flow=name=>read('.github/workflows/'+name);
const events=y=>y.slice(y.indexOf('\non:\n')+1,y.indexOf('\npermissions:',y.indexOf('\non:\n')));

test('accepted historical BOT M0 and M7 workflows are manually dispatched only',()=>{
 for(const name of workflows.slice(0,2)){
  const y=flow(name),block=events(y);
  assert.match(block,/^on:\s*\n(?:\s*#.*\n)*  workflow_dispatch:/m,name);
  assert.doesNotMatch(block,/^  (?:push|pull_request|schedule|workflow_run|workflow_call):/m,
   name+' must never be a routine CI or downstream gate');
 }
 assert.match(flow('bot-ai-m0.yml'),/bot-ai-m0-baseline\.mjs/);
 assert.match(flow('bot-ai-m7-browser.yml'),/bot-ai-m7-browser\.mjs/);
 assert.match(flow('bot-ai-m7-browser.yml'),/matrix\.map/);
});

test('normal Windows pipelines cannot indirectly invoke archived milestone certification',()=>{
 const vite=flow('vite.yml'),online=flow('online-frontend-build.yml'),
  gunplay=flow('pointblock-gunplay-windows.yml');
 assert.match(vite,/npm run test:ci/);
 assert.match(online,/npm run test:integration/);
 for(const script of [vite,online,gunplay]){
  assert.doesNotMatch(script,/\brun: (?:npm test|node --test(?:\s*$|\s*\|?\s*$))/m);
  assert.doesNotMatch(script,/\brun:.*bot-ai-m[0-7]/m);
  assert.match(script,/runs-on: windows-latest/);
 }
 assert.doesNotMatch(gunplay,/tests\/bot-ai-m[0-7]/);
 const curated=read('tools/active-ci-tests.mjs'),
  selected=curated.slice(curated.indexOf('const tests=['),curated.indexOf('].map(name=>'));
 assert.ok(selected.startsWith('const tests=['));
 assert.doesNotMatch(selected,/bot-ai-m[0-7]/);
 assert.match(selected,/authoritative-recoil/);
 assert.match(selected,/gunplay-ballistics/);
 assert.match(selected,/online-tracer-world-speed/);
});

test('manual full regression remains available and normal CI keeps production build',()=>{
 const pkg=JSON.parse(read('package.json'));
 assert.match(pkg.scripts.test,/node --test/);
 assert.match(pkg.scripts['test:full'],/npm test/);
 assert.match(pkg.scripts['test:ci'],/active-ci-tests\.mjs/);
 for(const file of ['vite.yml','online-frontend-build.yml','pointblock-gunplay-windows.yml']){
  const src=flow(file);
  assert.match(src,/npm run build/);
  assert.match(src,/npm run check:dist/);
 }
});
