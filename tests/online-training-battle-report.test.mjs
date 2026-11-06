import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('src/game/98-online-bridge.js');
const html=read('index.html');
const styles=read('src/styles/17-online.css');
const from=source.indexOf('var onlineTrainingResultStatus=null');
const to=source.indexOf('async function onlineTrainingFinished(',from);
assert.ok(from>=0&&to>from,'training report implementation is found');

function harness(){
 const classes=()=>({
  items:new Set(),
  add(...args){args.forEach(x=>this.items.add(x));},
  remove(...args){args.forEach(x=>this.items.delete(x));},
  contains(x){return this.items.has(x);},
 });
 const ids=['trainingResult','trainingResultHeadline','trainingResultDescription',
   'trainingResultTitle','trainingResultKills','trainingResultTarget',
   'trainingResultOutcome','trainingResultBadge','trainingResultStatus',
   'trainingResultExit','trainingResultActionError','dv'];
 const elements=Object.fromEntries(ids.map(id=>[id,{
  textContent:'',dataset:{},hidden:id==='trainingResult'||id==='trainingResultActionError',
  disabled:false,classList:classes(),focus(){this.focused=true;},
 }]));
 const events={route:null,form:null,order:[],registerCount:0,verified:true,authenticated:true};
 const doc={getElementById(id){assert.ok(elements[id],id);return elements[id];},
   exitPointerLock(){},body:{classList:classes()}};
 const context={
  document:doc,run:true,lob:false,lb:{style:{display:'none'}},
  lobP:id=>{events.route=id;events.order.push('home');},
  onlineApi:{
   trainingStatus:async()=>({completed:events.verified}),
   state:()=>({authenticated:events.authenticated}),
   register:async()=>{events.registerCount++},
   refreshProfile:async()=>({registered:true}),
  },
  onlineLoadInventory:async()=>{},
  roomLobbyOpen(){},
  onlineDialog:(...args)=>{events.form=args;events.order.push('username');},
 };
 runInNewContext(source.slice(from,to),context);
 return {elements,events,context};
}

test('training result adopts Battle Report layout instead of scrolling modal',()=>{
 assert.match(html,/class="training-report-left"/);
 assert.match(html,/class="training-report-right"/);
 assert.match(html,/id="trainingResultExit"/);
 assert.doesNotMatch(html,/id="trainingResultContinue"/);
 assert.match(html,/id="trainingResultTitle"/);
 assert.match(styles,/#dv\.training-result-active #dc\{display:none!important\}/);
 assert.match(styles,/grid-template-columns:minmax\(0,1\.08fr\) minmax\(0,1fr\)/);
 assert.match(styles,/max-height:calc\(100dvh - 24px\)/);
 assert.doesNotMatch(styles,/\.point-training-result\{[^}]*overflow-y:auto/);
});

test('settled training counts and qualification are server supplied; no mock XP or vPBT',()=>{
 const h=harness(),e=h.elements;
 h.context.onlineDisplayTrainingResult({status:'COMPLETED',combinedKills:10,targetKills:10});
 assert.equal(e.trainingResultHeadline.textContent,'PASSED');
 assert.equal(e.trainingResultTitle.textContent,'TRAINING COMPLETE');
 assert.equal(e.trainingResultKills.textContent,'10');
 assert.equal(e.trainingResultTarget.textContent,'10');
 assert.equal(e.trainingResultOutcome.textContent,'PASSED');
 assert.equal(e.trainingResultExit.disabled,false);
 assert.equal(e.trainingResult.hidden,false);
 assert.equal(h.context.lb.style.display,'none','Home is hidden while report is shown');
 assert.equal(h.context.document.body.classList.contains('lobby'),false);
 h.context.onlineDisplayTrainingResult({status:'COMPLETED'});
 assert.equal(e.trainingResultKills.textContent,'—');
 assert.equal(e.trainingResultTarget.textContent,'—');
 assert.doesNotMatch(html.slice(html.indexOf('<section id="trainingResult"'),
   html.indexOf('</section>',html.indexOf('<section id="trainingResult"'))),
   /EXP EARNED|vPBT EARNED/);
});

test('EXIT GAME after PASSED verifies BE and opens username before hiding report',async()=>{
 const h=harness();
 h.context.onlineDisplayTrainingResult({status:'COMPLETED',combinedKills:10,targetKills:10});
 await h.context.onlineTrainingResultExit();
 assert.equal(h.events.form[0],'CREATE USERNAME');
 assert.equal(h.events.form[2],'REGISTER USERNAME');
 assert.equal(h.events.form[4],'onboarding');
 assert.match(styles,/\.point-online-dialog\.point-online-registration\{/);
 assert.deepEqual(h.events.order,['username','home'],
   'registration must open before the battle report is dismissed');
 assert.equal(h.elements.trainingResult.hidden,true);
 assert.equal(h.elements.dv.classList.contains('show'),false);
 assert.equal(h.elements.dv.classList.contains('training-result-active'),false);
 assert.equal(h.context.lb.style.display,'flex');
 assert.equal(h.events.registerCount,0,'EXIT does not create an account by itself');
});

test('EXIT cannot open username if backend completion is missing or sign-in expired',async()=>{
 const h=harness();
 h.context.onlineDisplayTrainingResult({status:'COMPLETED',combinedKills:10,targetKills:10});
 h.events.verified=false;
 await h.context.onlineTrainingResultExit();
 assert.equal(h.events.form,null);
 assert.equal(h.events.route,null);
 assert.equal(h.elements.trainingResult.hidden,false);
 assert.equal(h.elements.trainingResultActionError.hidden,false);
 assert.equal(h.elements.trainingResultExit.disabled,false);
 h.events.verified=true;
 h.events.authenticated=false;
 await h.context.onlineTrainingResultExit();
 assert.equal(h.events.form,null);
 assert.equal(h.events.route,null);
});

test('EXIT from incomplete training returns Home without registration',async()=>{
 const h=harness();
 h.context.onlineDisplayTrainingResult({
  status:'TIMEOUT_POLICY_PENDING',combinedKills:6,targetKills:10,
 });
 assert.equal(h.elements.trainingResultTitle.textContent,'TRAINING INCOMPLETE');
 assert.equal(h.elements.trainingResultOutcome.textContent,'INCOMPLETE');
 await h.context.onlineTrainingResultExit();
 assert.equal(h.events.form,null);
 assert.equal(h.events.route,'lbs');
 assert.equal(h.elements.trainingResult.hidden,true);
});

test('saved training completion reopens username directly without a second report',async()=>{
 const h=harness();
 await h.context.onlineOpenUsernameRegistration();
 assert.equal(h.events.form[0],'CREATE USERNAME');
 assert.equal(h.events.form[4],'onboarding');
 assert.equal(h.events.route,'lbs');
 assert.equal(h.elements.trainingResult.hidden,true);
 assert.equal(h.elements.dv.classList.contains('show'),false);
 assert.equal(h.events.registerCount,0);
});

test('Home START recovery bypasses old report and Home clears any orphan',()=>{
 const gate=source.slice(source.indexOf('async function onlineStartGate(){'),
  source.indexOf('// Called after the original begin()',source.indexOf('async function onlineStartGate(){')));
 assert.match(gate,/info\.onboarding\?\.trainingCompleted/);
 assert.match(gate,/await onlineOpenUsernameRegistration\(\)/);
 assert.doesNotMatch(gate,/onlineDisplayTrainingResult\(/);
 assert.match(read('src/game/85-lobby-and-match.js'),/onlineTrainingResultDismissVisual\(\)/);
});
