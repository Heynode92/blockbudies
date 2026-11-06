import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('index.html');
const css=read('src/styles/17-online.css');
const src=read('src/game/98-online-bridge.js');
const start=src.indexOf('function onlineTrainingProgress(progress){');
const end=src.indexOf('\nfunction onlineDialog(',start);
assert.ok(start>=0&&end>start,'training progress function remains extractable');

test('training gets its own compact HUD; respawn countdown remains independent',()=>{
 assert.equal((html.match(/id="trainingProgressHud"/g)||[]).length,1);
 assert.equal((html.match(/id="trainingProgressCount"/g)||[]).length,1);
 assert.match(html,/id="trainingProgressHud"[^>]*hidden>/);
 assert.match(css,/#trainingProgressHud\[hidden\]/);
 assert.match(css,/\.lobby #trainingProgressHud/);
 assert.match(css,/\.over #trainingProgressHud/);

 const hud={hidden:true},counter={textContent:'0 / 10'};
 const respawn={textContent:'RESPAWN IN 5'};
 const elements={trainingProgressHud:hud,trainingProgressCount:counter,rsp:respawn};
 const context={
  document:{getElementById:id=>elements[id]??null},
  onlineActive:true,onlineTraining:true,onlineTrainingProgressValue:null,
 };
 runInNewContext(src.slice(start,end)+'\nthis.render=onlineTrainingProgress;',context);
 const progress=(kills,status='ACTIVE')=>({
  combinedKills:kills,targetKills:10,status,attemptId:'server-owned-attempt',
 });
 context.render(progress(0));
 assert.equal(hud.hidden,false);
 assert.equal(counter.textContent,'0 / 10');
 assert.equal(respawn.textContent,'RESPAWN IN 5');

 context.render(progress(7));
 assert.equal(counter.textContent,'7 / 10');
 assert.equal(respawn.textContent,'RESPAWN IN 5');

 context.render(progress(10,'COMPLETED'));
 assert.equal(hud.hidden,true);
 context.render(progress(7,'ACTIVE'));
 assert.equal(hud.hidden,false);
 context.onlineTraining=false;
 context.render(progress(8));
 assert.equal(hud.hidden,true,'must not show progress in regular matches');

 context.onlineTraining=true;
 context.render({status:'ACTIVE',combinedKills:'8',targetKills:10});
 assert.equal(hud.hidden,true,'must not display malformed progress');
 assert.equal(respawn.textContent,'RESPAWN IN 5');
});
test('training state cleans up on exit and never reinjects center text per render frame',()=>{
 const reset=src.slice(src.indexOf('function onlineResetLive(){'),
   src.indexOf('async function onlineAttachMatch(',src.indexOf('function onlineResetLive(){')));
 assert.match(reset,/trainingHud\.hidden=true/);
 assert.doesNotMatch(src.slice(start,end),/getElementById\('rsp'\)/);
 assert.doesNotMatch(src,/if\(onlineTraining&&onlineTrainingProgressValue\)onlineTrainingProgress/);
});
