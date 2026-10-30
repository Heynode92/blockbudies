import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8').replace(/\r\n/g,'\n');
const source=read('src/game/90-bot-ai.js');
const esc=source.slice(source.indexOf('var escEl=document.getElementById("esc")'));
const styles=read('src/styles/06-weapon-selection.css');
function setup(opts={}){
 const cls=new Set(['loadout-cursor-hidden']);
 const body={classList:{add(x){cls.add(x);},remove(x){cls.delete(x);},contains(x){return cls.has(x);}}};
 let locked=true,exits=0,requests=0,t=1000,inLobby=0,stopped=0;
 const handlers={};
 const overlay={style:{display:'none'}};
 const buttons={escR:{blur(){}},escB:{blur(){}},dmn:{onclick(){inLobby++;ctx.run=false;ctx.lob=true;}}};
 const canvas={requestPointerLock(){requests++;document.pointerLockElement=canvas;}};
 const document={body,pointerLockElement:opts.locked===false?null:canvas,
  getElementById(id){if(id==='esc')return overlay;return buttons[id];},
  addEventListener(name,fn){(handlers[name]??=[]).push(fn);},
  exitPointerLock(){exits++;this.pointerLockElement=null;
   for(const fn of handlers.pointerlockchange||[])fn();}};
 const ctx={document,R:{domElement:canvas},run:true,lob:false,touch:false,mt:{over:false,cd:0},
  wsOn:!!opts.loadout,keys:{KeyW:true},mouse:{down:true,right:true},fireHeld:true,
  performance:{now(){return t;}},lookStopDrag(){stopped++;},setTimeout(){},
  addEventListener(name,fn){(handlers[name]??=[]).push(fn);}};
 runInNewContext(esc,ctx);
 return {ctx,overlay,body,buttons,document,classes:cls,
  press(code='Escape'){for(const fn of handlers.keydown||[])fn({code});},
  advance(ms){t+=ms;},release(){document.exitPointerLock();},
  results(){return{exits,requests,inLobby,stopped}}};
}
test('ESC shows a clickable cursor, releases lock and freezes stale firing state',()=>{
 const h=setup();h.press();
 assert.equal(h.overlay.style.display,'flex');
 assert.equal(h.classes.has('game-menu-open'),true);
 assert.equal(h.document.pointerLockElement,null);
 assert.equal(h.results().exits,1);
 assert.equal(h.ctx.mouse.down,false);assert.equal(h.ctx.mouse.right,false);
 assert.equal(h.ctx.fireHeld,false);assert.equal(h.ctx.keys.KeyW,undefined);
 assert.match(styles,/:not\(\.game-menu-open\) \*\{cursor:none!important\}/);
 assert.match(styles,/body\.game-menu-open #esc button\{cursor:pointer!important\}/);
});
test('RESUME hides pause menu, restores hidden-cursor state and requests FPS lock',()=>{
 const h=setup();h.press();h.buttons.escR.onclick();
 assert.equal(h.overlay.style.display,'none');assert.equal(h.classes.has('game-menu-open'),false);
 assert.equal(h.classes.has('loadout-cursor-hidden'),true);
 assert.equal(h.results().requests,1);
});
test('BACK TO LOBBY restores menu cursor without re-locking the mouse',()=>{
 const h=setup();h.press();h.buttons.escB.onclick();
 assert.equal(h.overlay.style.display,'none');assert.equal(h.classes.has('game-menu-open'),false);
 assert.equal(h.results().inLobby,1);assert.equal(h.results().requests,0);
});
test('loadout releases pointer lock without accidentally opening ESC',()=>{
 const h=setup({loadout:true});h.release();
 assert.equal(h.overlay.style.display,'none');
 assert.equal(h.classes.has('game-menu-open'),false);
 h.press();assert.equal(h.overlay.style.display,'flex');
 h.advance(400);h.press();assert.equal(h.overlay.style.display,'none');
 assert.equal(h.results().requests,0,'do not lock mouse while loadout remains open');
});
test('manual ESC and pointerlockchange cannot produce duplicate open transitions',()=>{
 const h=setup({locked:false});h.press();h.release();
 assert.equal(h.overlay.style.display,'flex');
 assert.equal(h.results().exits,1);
 h.advance(400);h.press();
 assert.equal(h.overlay.style.display,'none');
 assert.equal(h.results().requests,1);
});
