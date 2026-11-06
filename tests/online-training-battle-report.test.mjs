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
   'trainingResultContinue','trainingResultExit','trainingResultActionError','dv'];
 const elements=Object.fromEntries(ids.map(id=>[id,{
  textContent:'',dataset:{},hidden:id==='trainingResult'||id==='trainingResultActionError',
  disabled:false,classList:classes(),focus(){this.focused=true;},
 }]));
 const events={route:null,form:null,registerCount:0,verified:true,authenticated:true};
 const doc={getElementById(id){assert.ok(elements[id],id);return elements[id];},
   exitPointerLock(){},body:{classList:classes()}};
 const context={
  document:doc,run:true,lob:false,lb:{style:{display:'none'}},
  lobP:id=>{events.route=id;},
  onlineApi:{
   trainingStatus:async()=>({completed:events.verified}),
   state:()=>({authenticated:events.authenticated}),
   register:async()=>{events.registerCount++},
   refreshProfile:async()=>({registered:true}),
  },
  onlineLoadInventory:async()=>{},
  roomLobbyOpen(){},
  onlineDialog:(...args)=>{events.form=args;},
 };
 runInNewContext(source.slice(from,to),context);
 return {elements,events,context};
}

test('training result adopts Battle Report layout instead of scrolling modal',()=>{
 assert.match(html,/class="training-report-left"/);
 assert.match(html,/class="training-report-right"/);
 assert.match(html,/id="trainingResultExit"/);
 assert.match(html,/id="trainingResultContinue"/);
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
 assert.equal(e.trainingResultContinue.disabled,false);
 assert.equal(e.trainingResult.hidden,false);
 h.context.onlineDisplayTrainingResult({status:'COMPLETED'});
 assert.equal(e.trainingResultKills.textContent,'—');
 assert.equal(e.trainingResultTarget.textContent,'—');
 assert.doesNotMatch(html.slice(html.indexOf('<section id="trainingResult"'),
   html.indexOf('</section>',html.indexOf('<section id="trainingResult"'))),
   /EXP EARNED|vPBT EARNED/);
});

test('EXIT GAME returns Home without registering a username',()=>{
 const h=harness();
 h.context.onlineDisplayTrainingResult({status:'COMPLETED',combinedKills:10,targetKills:10});
 h.context.onlineTrainingResultExit();
 assert.equal(h.events.route,'lbs');
 assert.equal(h.events.form,null);
 assert.equal(h.events.registerCount,0);
 assert.equal(h.elements.trainingResult.hidden,true);
});

test('NEXT requires persisted backend completion before username dialog',async()=>{
 const h=harness();
 h.context.onlineDisplayTrainingResult({status:'COMPLETED',combinedKills:10,targetKills:10});
 h.events.verified=false;
 await h.context.onlineTrainingResultContinue();
 assert.equal(h.events.form,null);
 assert.equal(h.elements.trainingResultActionError.hidden,false);
 h.events.verified=true;
 await h.context.onlineTrainingResultContinue();
 assert.equal(h.events.form[0],'CREATE USERNAME');
 assert.equal(h.events.form[2],'REGISTER USERNAME');
 assert.equal(h.events.route,'lbs');
 assert.equal(h.events.registerCount,0,'opening registration never creates an account');
});

test('timeout report locks NEXT but EXIT remains available',async()=>{
 const h=harness();
 h.context.onlineDisplayTrainingResult({
  status:'TIMEOUT_POLICY_PENDING',combinedKills:6,targetKills:10,
 });
 assert.equal(h.elements.trainingResultTitle.textContent,'TRAINING INCOMPLETE');
 assert.equal(h.elements.trainingResultOutcome.textContent,'INCOMPLETE');
 assert.equal(h.elements.trainingResultContinue.disabled,true);
 await h.context.onlineTrainingResultContinue();
 assert.equal(h.events.form,null);
 h.context.onlineTrainingResultExit();
 assert.equal(h.events.route,'lbs');
});
