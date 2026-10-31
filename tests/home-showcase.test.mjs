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
 const elements=new Map(),events={},state={home:true};
 class Node{
  constructor(){this.textContent='';this.hidden=false;this.paused=true;this.muted=true;
    this.attrs={};this.listeners={};this.selected=false;
    this.classList={contains:n=>state.home&&n==='on',
       toggle:(n,v)=>{if(n==='active')this.selected=v;}};}
  setAttribute(k,v){this.attrs[k]=String(v);}
  getAttribute(k){return this.attrs[k]??null;}
  addEventListener(k,fn){this.listeners[k]=fn;}
  click(){this.listeners.click?.();}
  pause(){this.paused=true;this.listeners.pause?.();}
  play(){this.paused=false;this.playCount=(this.playCount||0)+1;return Promise.resolve();}
  load(){this.loadCount=(this.loadCount||0)+1;}
 }
 const video=new Node();video.attrs.src='./src/assets/video/deatch_match_demo.mp4';
 const death=new Node(),bomb=new Node();
 death.attrs['data-home-demo']='deathmatch';bomb.attrs['data-home-demo']='bomb';
 const doc={
   hidden:false,
   getElementById(id){if(id==='homeDemoVideo')return video;if(!elements.has(id))elements.set(id,new Node());return elements.get(id);},
   querySelectorAll(q){return q==='[data-home-demo]'?[death,bomb]:[];},
   addEventListener(k,fn){events[k]=fn;}
 };
 const context={document:doc,lob:true,run:false,Math,Object,Promise};
 runInNewContext(source,context,{filename:'82-home-showcase.js'});
 return{context,doc,video,death,bomb,elements,events,state};
}
test('both official local MP4 videos are committed and the hero keeps a native 16:9 playback surface',()=>{
 const cases=[
  ['src/assets/video/deatch_match_demo.mp4','deathmatch'],
  ['src/assets/video/bomb_mission_demo.mp4','bomb']
 ];
 for(const [filename,key] of cases){
   const n=statSync(resolve(root,filename)).size;
   assert.ok(n>1024,'source MP4 exists and is nonempty: '+key);
   assert.ok(n<100*1024*1024,'demo is safely below GitHub hard 100MiB limit: '+key);
   const header=readFileSync(resolve(root,filename)).subarray(4,8).toString('ascii');
   assert.equal(header,'ftyp','native MP4 file header, not a renamed arbitrary blob');
 }
 for(const id of ['lbs','homeDemoVideo','homeDemoPlay','homeDemoAudio',
     'homeDemoStatus','homeDemoEmpty'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(html,/autoplay muted loop playsinline preload="metadata"/);
 assert.match(css,/#lbs \.home-demo-screen\{[^}]*aspect-ratio:16\/9/);
 assert.match(html,/data-home-demo="deathmatch"/);
 assert.match(html,/data-home-demo="bomb"/);
 assert.doesNotMatch(source,/https?:\/\//,'local videos are not redirected to untrusted remote hosts');
});
test('video is muted by default, source is whitelisted and only one clip plays at a time',()=>{
 const f=fixture();
 assert.equal(f.video.muted,true);
 assert.equal(f.video.attrs.src,'./src/assets/video/deatch_match_demo.mp4');
 assert.ok(f.video.playCount>0);
 assert.equal(f.death.selected,true);
 f.bomb.click();
 assert.equal(f.video.attrs.src,'./src/assets/video/bomb_mission_demo.mp4');
 assert.equal(f.bomb.selected,true);assert.equal(f.death.selected,false);
 assert.equal(f.video.loadCount,1);
 assert.equal(f.context.homeDemoKey,'bomb');
 f.context.homeDemoSelect('../custom-malicious.mp4');
 assert.equal(f.video.attrs.src,'./src/assets/video/bomb_mission_demo.mp4');
 assert.equal(f.video.loadCount,1,'no path traversal or user-supplied media URL can be loaded');
});
test('home video pauses outside home menu, in gameplay and hidden tab, then resumes safely',()=>{
 const f=fixture();
 f.state.home=false;f.context.homeShowcaseSync();
 assert.equal(f.video.paused,true,'leave Home Menu');
 f.state.home=true;f.context.homeShowcaseSync();
 assert.equal(f.video.paused,false);
 f.doc.hidden=true;f.events.visibilitychange();
 assert.equal(f.video.paused,true);
 f.doc.hidden=false;f.context.run=true;f.context.homeShowcaseSync();
 assert.equal(f.video.paused,true,'do not play in match');
 f.context.run=false;f.context.homeShowcaseSync();
 assert.equal(f.video.paused,false);
 f.elements.get('homeDemoAudio').click();
 assert.equal(f.video.muted,false);
 f.elements.get('homeDemoAudio').click();
 assert.equal(f.video.muted,true);
 f.elements.get('homeDemoPlay').click();
 assert.equal(f.video.paused,true);
 f.elements.get('homeDemoPlay').click();
 assert.equal(f.video.paused,false);
 f.video.listeners.error();
 assert.equal(f.elements.get('homeDemoEmpty').hidden,false);
 assert.equal(f.video.paused,true,'invalid codec/file displays fallback not noisy looping errors');
});
test('Home Menu resets Block District 3D world and does not change combat code or video-loop architecture',()=>{
 assert.match(lobby,/selectedTdmMapId="block-district";selectGameMap\(false\)/);
 assert.match(lobby,/homeShowcaseSync\(\)/);
 assert.ok(manifest.parts.indexOf('src/game/80-input.js')<
           manifest.parts.indexOf('src/game/82-home-showcase.js'));
 assert.ok(manifest.parts.indexOf('src/game/82-home-showcase.js')<
           manifest.parts.indexOf('src/game/83-room-lobby.js'));
 assert.doesNotMatch(source,/WebGLRenderer|requestAnimationFrame|fetch\(|XMLHttpRequest|innerHTML/,
   'showcase must not create render loops, network requests or HTML injection');
 const built='(function(){\n'+manifest.parts.map(read).join('')+'})();\n';
 assert.equal(read('assets/game.js'),built,'Windows direct-open artifact matches canonical source');
});
