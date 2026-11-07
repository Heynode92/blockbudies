import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('index.html');
const css=read('src/styles/22-operator-registration.css');
const src=read('src/game/98-online-bridge.js');

test('approved full-screen operator HUD uses native form, real rank preview, and responsive layout',()=>{
 assert.match(html,/<template id="pointOperatorRegistrationTemplate">/);
 for(const id of ['operatorRegistrationInput','operatorRegistrationValidation']){
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
 }
 assert.match(html,/data-operator-callsign-preview/);
 assert.match(html,/class="operator-registration-submit" type="submit" disabled/);
 assert.match(css,/width:min\(1300px,96vw\)/);
 assert.match(css,/grid-template-columns:minmax\(0,\.95fr\) minmax\(0,1\.05fr\)/);
 assert.match(css,/operator-hero\.webp/);
 assert.match(css,/@media\(max-width:850px\)/);
 assert.match(src,/rankRosterPreview\(0\)/);
 assert.match(src,/template\.content\.cloneNode\(true\)/);
 assert.doesNotMatch(src,/preview\.innerHTML\s*=/);
 assert.match(src,/preview\.textContent=value\|\|'YOUR_NAME'/);
});

function makeInputHarness(){
 const elements={};
 for(const key of ['form','input','preview','hint','count','entry','button',
                   'error','rankImage','fallback']){
  elements[key]={textContent:'',dataset:{},hidden:false,disabled:false,
   listeners:{},attrs:{},value:'',
   setAttribute(name,v){this.attrs[name]=v;},
   addEventListener(name,fn){this.listeners[name]=fn;},
   focus(){},
  };
 }
 const selectors={
  form:'form',input:'#operatorRegistrationInput',
  preview:'[data-operator-callsign-preview]',
  hint:'#operatorRegistrationValidation',
  count:'[data-operator-character-count]',
  entry:'.operator-registration-entry',
  button:'.operator-registration-submit',
  error:'[data-operator-server-error]',
  rankImage:'.operator-registration-rank-image',
  fallback:'.operator-registration-rank-fallback',
 };
 const reversed=Object.fromEntries(Object.entries(selectors).map(([k,v])=>[v,k]));
 let overlay;
 const doc={
  getElementById(id){
   if(id==='pointblockOnlineDialog')return overlay?.isConnected?overlay:null;
   if(id==='pointOperatorRegistrationTemplate')
    return {content:{cloneNode:()=>({})}};
   return null;
  },
  createElement(tag){
   assert.equal(tag,'div');
   overlay={id:'',className:'',isConnected:false,
    appendChild(){},
    querySelector(selector){return elements[reversed[selector]];},
    remove(){this.isConnected=false;},
   };
   return overlay;
  },
  body:{appendChild(node){node.isConnected=true;}},
 };
 const slice=src.slice(src.indexOf('function onlineDialog('),
  src.indexOf('// The Training Result is',src.indexOf('function onlineDialog(')));
 assert.ok(slice.includes("if(kind==='onboarding')"));
 const context={document:doc,rankRosterPreview:()=> 'data:image/png;base64,test',
   console:{warn(){}}
 };
 runInNewContext(slice+';this.open=onlineDialog;',context);
 return {context,elements,getOverlay:()=>overlay};
}
test('live preview, invalid characters and backend-only submission preserve original callsign',async()=>{
 const h=makeInputHarness(),e=h.elements;
 let calls=[];
 h.context.open('CREATE USERNAME','', 'REGISTER USERNAME',
  async username=>{calls.push(username)},'onboarding');
 assert.equal(h.getOverlay().isConnected,true);
 assert.equal(e.button.disabled,true);
 assert.equal(e.preview.textContent,'YOUR NAME');
 assert.equal(e.rankImage.hidden,false);
 assert.equal(e.fallback.hidden,true);
 e.input.value='bad name';e.input.listeners.input();
 assert.equal(e.button.disabled,true);
 assert.equal(e.entry.dataset.inputState,'invalid');
 e.input.value='Maestro_01';e.input.listeners.input();
 assert.equal(e.button.disabled,false);
 assert.equal(e.preview.textContent,'Maestro_01');
 assert.equal(e.hint.textContent,'NAME FORMAT OK');
 await e.form.listeners.submit({preventDefault(){}});
 assert.deepEqual(calls,['Maestro_01']);
 assert.equal(h.getOverlay().isConnected,false);
});
test('server failure keeps form and displays code as text, without an HTML injection sink',async()=>{
 const h=makeInputHarness(),e=h.elements;
 h.context.open('CREATE USERNAME','','REGISTER USERNAME',
  async()=>{throw {code:'CALLSIGN_TAKEN_OR_REGISTERED'};},'onboarding');
 e.input.value='Abc_123';e.input.listeners.input();
 await e.form.listeners.submit({preventDefault(){}});
 assert.equal(h.getOverlay().isConnected,true);
 assert.equal(e.error.textContent,'That username is taken. Try another.');
 assert.equal(e.error.hidden,false);
 assert.equal(e.button.disabled,false);
});
test('username entry is still gated by persisted server training completion',()=>{
 const point=src.indexOf('async function onlineOpenUsernameRegistration()');
 assert.ok(point>=0);
 const segment=src.slice(point,src.indexOf('async function onlineTrainingResultExit()',point));
 assert.match(segment,/await onlineApi\.trainingStatus\(\)/);
 assert.match(segment,/status\?\.completed!==true/);
 assert.match(segment,/onlineApi\?\.state\(\)\.authenticated/);
 assert.match(segment,/onlineDialog\('CREATE USERNAME'/);
});

test('registration copy has no backend or developer-facing statements',()=>{
 const template=html.slice(html.indexOf('<template id="pointOperatorRegistrationTemplate">'),
  html.indexOf('</template>',html.indexOf('<template id="pointOperatorRegistrationTemplate">'))+11);
 assert.doesNotMatch(template,/SERVER VERIFIED|UNIQUE PLAYER IDENTITY|USERNAME AVAILABILITY|OPERATOR REGISTRATION/);
 assert.match(template,/YOUR NAME WILL APPEAR IN MATCHES AND LEADERBOARDS/);
 assert.match(template,/TRAINING COMPLETE/);
 const renderer=src.slice(src.indexOf('function onlineDialog('),
  src.indexOf('// The Training Result is',src.indexOf('function onlineDialog(')));
 assert.doesNotMatch(renderer,/VALID FORMAT ·|USERNAME AVAILABILITY CHECKED/);
 assert.match(renderer,/NAME FORMAT OK/);
});
test('12-character callsign is permitted and never truncated in operator preview',()=>{
 const h=makeInputHarness(),e=h.elements;
 h.context.open('CREATE USERNAME','','REGISTER USERNAME',async()=>{},'onboarding');
 const max='WWWWWWWWWWWW';
 e.input.value=max;e.input.listeners.input();
 assert.equal(e.preview.textContent,max);
 assert.equal(e.button.disabled,false);
 assert.equal(e.count.textContent,'12 / 12');
 assert.match(css,/overflow-wrap:anywhere/);
 assert.match(css,/text-overflow:clip/);
 assert.match(css,/white-space:normal/);
 e.input.value='ABCDEFGHIJKLM';e.input.listeners.input();
 assert.equal(e.button.disabled,true,'more than 12 cannot submit');
});
test('compact height and border-safe panels do not rely on clipped text or 690px fixed modal',()=>{
 assert.match(css,/height:auto;/);
 assert.match(css,/grid-template-rows:auto auto auto/);
 assert.match(css,/max-height:none/);
 assert.match(css,/\.operator-registration-preview,\s*\n\.point-online-registration \.operator-registration-entry\{\s*\n min-height:238px/);
 assert.match(css,/clip-path:none/);
 assert.match(css,/mask-image:radial-gradient/);
 assert.match(css,/@media\(max-height:700px\)/);
 assert.match(css,/@media\(max-width:850px\)/);
});
