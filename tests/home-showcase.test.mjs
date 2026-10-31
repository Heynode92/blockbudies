import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8').replace(/\r\n/g,'\n');
const html=read('index.html'),css=read('src/styles/04-lobby.css'),
      source=read('src/game/82-home-showcase.js'),
      lobby=read('src/game/85-lobby-and-match.js'),
      manifest=JSON.parse(read('tools/source-manifest.json'));

function fixture(){
 const elements=new Map(),events={},timeouts=new Map(),intervals=new Map();
 const state={home:true};
 let nextTimer=1;
 class Node {
  constructor(){
   this.textContent='';this.hidden=false;this.paused=true;this.muted=true;
   this.attrs={};this.style={};this.listeners={};this.offsetWidth=640;
   const classes=new Set();
   this.classList={
    add:n=>classes.add(n),remove:n=>classes.delete(n),
    contains:n=>classes.has(n),
    toggle:(n,v)=>{const yes=v===undefined?!classes.has(n):v;if(yes)classes.add(n);else classes.delete(n);return yes;}
   };
  }
  set src(value){this.attrs.src=value;}
  get src(){return this.attrs.src;}
  setAttribute(k,v){this.attrs[k]=String(v);}
  getAttribute(k){return this.attrs[k]??null;}
  removeAttribute(k){delete this.attrs[k];}
  addEventListener(k,fn){this.listeners[k]=fn;}
  pause(){this.paused=true;}
  play(){this.paused=false;this.playCount=(this.playCount||0)+1;return Promise.resolve();}
  load(){this.loadCount=(this.loadCount||0)+1;}
 }
 const primary=new Node(),secondary=new Node(),screen=new Node();
 primary.attrs.src='./src/assets/video/deatch_match_demo.mp4';
 const doc={
  hidden:false,
  getElementById(id){
   if(!elements.has(id))elements.set(id,new Node());
   if(id==='lbs')return {classList:{contains:n=>n==='on'&&state.home}};
   if(id==='homeDemoVideo')return primary;
   if(id==='homeDemoNextVideo')return secondary;
   return elements.get(id);
  },
  querySelector:q=>q==='#lbs .home-demo-screen'?screen:null,
  addEventListener:(k,fn)=>{events[k]=fn;}
 };
 const context={
  document:doc,window:{},lob:true,run:false,Math,Object,Promise,
  setInterval:(fn,delay)=>{const id=nextTimer++;intervals.set(id,{fn,delay});return id;},
  clearInterval:id=>intervals.delete(id),
  setTimeout:(fn,delay)=>{const id=nextTimer++;timeouts.set(id,{fn,delay});return id;},
  clearTimeout:id=>timeouts.delete(id)
 };
 runInNewContext(source,context,{filename:'82-home-showcase.js'});
 return {context,doc,primary,secondary,elements,events,state,intervals,timeouts,
  completeFade(){for(const [id,value] of [...timeouts]){
   if(value.delay===780){timeouts.delete(id);value.fn();}
  }}
 };
}

test('both official local MP4s exist; passive showcase keeps true 16:9 and no visitor controls',()=>{
 for(const file of ['deatch_match_demo.mp4','bomb_mission_demo.mp4']){
  const filename=resolve(root,'src/assets/video',file),size=statSync(filename).size;
  assert.ok(size>1024&&size<100*1024*1024);
  assert.equal(readFileSync(filename).subarray(4,8).toString('ascii'),'ftyp');
 }
 for(const id of ['lbs','homeDemoVideo','homeDemoNextVideo','homeDemoStatus','homeDemoProgress','homeDemoEmpty'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/autoplay muted loop playsinline preload="metadata"/);
 assert.match(css,/#lbs \.home-demo-screen\{[^}]*aspect-ratio:16\/9/);
 assert.doesNotMatch(html,/id="homeDemoPlay"|id="homeDemoAudio"|data-home-demo=/);
 assert.match(source,/setInterval\(homeDemoRotate,10000\)/);
 assert.doesNotMatch(source,/https?:\/\//,'video sources must remain local');
});

test('showcase starts muted, and automatically crossfades between only the two whitelisted MP4s',async()=>{
 const f=fixture(),{context,primary,secondary}=f;
 assert.equal(primary.muted,true);
 assert.equal(secondary.muted,true);
 assert.ok(primary.playCount>0);
 assert.equal(context.homeDemoKey,'deathmatch');
 assert.equal([...f.intervals.values()].some(x=>x.delay===10000),true);
 context.homeDemoRotate();
 await Promise.resolve();await Promise.resolve();
 assert.equal(secondary.attrs.src,'./src/assets/video/bomb_mission_demo.mp4');
 assert.equal(context.homeDemoKey,'bomb');
 assert.equal(secondary.classList.contains('is-current'),true);
 f.completeFade();
 assert.equal(primary.paused,true);
 assert.equal(context.homeDemoTransitioning,false);
 context.homeDemoRotate();
 await Promise.resolve();await Promise.resolve();
 assert.equal(primary.attrs.src,'./src/assets/video/deatch_match_demo.mp4');
 assert.equal(context.homeDemoKey,'deathmatch');
 f.completeFade();
 assert.ok(Object.isFrozen(context.HOME_DEMOS));
});

test('video pauses outside home, in a hidden tab and during gameplay; no network calls',()=>{
 const f=fixture();
 f.state.home=false;f.context.homeShowcaseSync();
 assert.equal(f.primary.paused,true);
 assert.equal(f.secondary.paused,true);
 assert.equal(f.intervals.size,0);
 f.state.home=true;f.context.homeShowcaseSync();
 assert.equal(f.primary.paused,false);
 f.doc.hidden=true;f.events.visibilitychange();
 assert.equal(f.primary.paused,true);
 assert.equal(f.intervals.size,0);
 f.doc.hidden=false;f.context.run=true;f.context.homeShowcaseSync();
 assert.equal(f.primary.paused,true);
 f.context.run=false;f.context.homeShowcaseSync();
 assert.equal(f.primary.paused,false);
 f.primary.listeners.error();
 assert.equal(f.elements.get('homeDemoEmpty').hidden,false);
 assert.equal(f.elements.get('homeDemoStatus').textContent,'PREVIEW UNAVAILABLE');
 assert.doesNotMatch(source,/fetch\(|XMLHttpRequest|WebSocket/);
});

test('Block District home view and direct-open bundle parity are preserved',()=>{
 assert.match(lobby,/selectedTdmMapId="block-district";selectGameMap\(false\)/);
 assert.match(lobby,/homeShowcaseSync\(\)/);
 assert.ok(manifest.parts.indexOf('src/game/82-home-showcase.js')<
  manifest.parts.indexOf('src/game/83-room-lobby.js'));
 assert.doesNotMatch(source,/WebGLRenderer|requestAnimationFrame|innerHTML/);
 const built='(function(){\n'+manifest.parts.map(read).join('')+'})();\n';
 assert.equal(read('assets/game.js'),built);
});
