import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8").replace(/\r\n/g,"\n");
const picker=read("src/game/77-loadout-picker.js");
const controls=read("src/game/75-weapon-controls.js");
const input=read("src/game/80-input.js");
const look=read("src/game/79-camera-look.js");
const lobby=read("src/game/85-lobby-and-match.js");
const css=read("src/styles/06-weapon-selection.css");
function node(tag="div"){
 const n={tag,children:[],attrs:{},style:{},className:"",disabled:false};
 const names=new Set();
 n.classList={contains:x=>names.has(x),add(...a){a.forEach(x=>names.add(x));},
  remove(...a){a.forEach(x=>names.delete(x));},toggle(x,val){if(val===undefined)val=!names.has(x);if(val)names.add(x);else names.delete(x);return val;}};
 Object.defineProperty(n,"textContent",{get(){return n._txt||"";},set(x){n._txt=x;if(x==="")n.children=[];}});
 n.appendChild=x=>{n.children.push(x);return x;};
 n.setAttribute=(k,v)=>{n.attrs[k]=v;};
 n.querySelector=selector=>{
  const key=selector.slice(1);
  for(const child of n.children){if(child.className.split(" ").includes(key))return child;
   const found=child.querySelector(selector);if(found)return found;}
  return null;};
 return n;
}
function setup(){
 const ws=node(),body=node(),canvas=node("canvas"),saved=[];
 const d={body,pointerLockElement:canvas,exitCount:0,
  exitPointerLock(){this.pointerLockElement=null;this.exitCount++;},
  getElementById(id){if(id==="wsel")return ws;return node();},
  createElement:node};
 canvas.lockCount=0;canvas.requestPointerLock=()=>{canvas.lockCount++;d.pointerLockElement=canvas;};
 const owned=[9,1],catalog=[9,1,2,6,8,10,11,12,3];
 const weapon=catalog.map(id=>({n:({9:"K2",1:"AK-47",2:"Shotgun",6:"Kriss",8:"AWP",10:"MP7",11:"P90",12:"AK SOPMOD",3:"RPG"})[id],
  stats:{kind:({9:"rifle",1:"rifle",2:"shotgun",6:"smg",8:"sniper",10:"smg",11:"smg",12:"rifle",3:"rocket"})[id]},
  mag:30,res:150}));
 const WP=Array.from({length:13},(_,i)=>weapon[catalog.indexOf(i)]||{n:"Unknown",stats:{kind:"pistol"},mag:13,res:52});
 const ctx={document:d,R:{domElement:canvas},Math,Number,WP,SV:Object.fromEntries(catalog.map(id=>[id,'<svg></svg>'])),
  WEAPON_CLASS_LABELS:{rifle:"RIFLE",smg:"SMG",shotgun:"SHOTGUN",sniper:"SNIPER",rocket:"LAUNCHER"},
  WDESC:{},WEAPON_STARTER_ID:9,WSEL:[9,1],favPrim:9,
  pl:{dead:false,prim:9,w:9,ammo:{9:{mag:30,res:150},1:{mag:30,res:150}}},
  mt:{cd:5,over:false},run:true,lob:false,touch:false,mouse:{down:true,right:true},fireHeld:true,
  inventoryState:{equipped:{main:9}},inventoryCatalogMain:()=>catalog,inventoryOwned:()=>owned.slice(),
  inventorySave(){saved.push(ctx.inventoryState.equipped.main);},isBombMode(){return false;},
  BOMB_RULES:{freezeSeconds:5},lookStopDrag(){},swW(id){ctx.pl.w=id;ctx.pl.mag=30;ctx.pl.res=150;}};
 runInNewContext(picker,ctx);
 const start=controls.indexOf("function refreshWeaponSelection(){");
 const end=controls.indexOf("function wselUpd(){",start);
 assert.ok(start>=0&&end>start);
 runInNewContext(controls.slice(start,end),ctx);
 return {ctx,d,ws,canvas,saved,owned};
}
test("approved five-card carousel and mouse category navigation",()=>{
 const {ctx,ws}=setup();ctx.refreshWeaponSelection();ctx.loadoutPrepareRound();ctx.loadoutUpdate();
 const cards=ws.querySelector(".wp-cards");
 assert.equal(cards.children.length,5);
 assert.deepEqual(cards.children.map(c=>c.querySelector(".wp-name").textContent),["K2","AK-47","Shotgun","Kriss","AWP"]);
 assert.equal(cards.children[1].disabled,false);
 assert.equal(cards.children[2].disabled,true);
 assert.match(css,/#wsel \.wp-cards\{display:grid;grid-template-columns:repeat\(5/);
 assert.match(css,/#wsel \.wp-confirm/);
 assert.ok(ws.querySelector(".wp-tabs"));
});
test("weapon click equips owned primary and CONFIRM closes panel, saves and relocks mouse",()=>{
 const {ctx,ws,canvas,d,saved}=setup();
 ctx.refreshWeaponSelection();ctx.loadoutPrepareRound();ctx.loadoutUpdate();
 assert.equal(d.exitCount,1);
 assert.equal(ctx.wsOn,true);
 const card=ws.querySelector(".wp-cards").children[1];card.onclick();
 assert.equal(ctx.pl.prim,1);
 ws.querySelector(".wp-confirm").onclick();
 assert.equal(ctx.wsConfirmed,true);assert.equal(ctx.wsOn,false);
 assert.equal(ctx.inventoryState.equipped.main,1);assert.deepEqual(saved,[1]);
 assert.equal(canvas.lockCount,1);assert.equal(ctx.mouse.down,false);
});
test("timeout auto deploys and hides cursor without a background pointer-lock request",()=>{
 const {ctx,ws,canvas,d,saved}=setup();
 ctx.refreshWeaponSelection();ctx.loadoutPrepareRound();ctx.loadoutUpdate();
 ctx.mt.cd=0;ctx.loadoutUpdate();
 assert.equal(ctx.wsConfirmed,true);assert.equal(ctx.wsOn,false);
 assert.equal(canvas.lockCount,0);assert.deepEqual(saved,[9]);
 assert.equal(d.body.classList.contains("loadout-cursor-hidden"),true);
});
test("next round resets selection for both game modes and keeps last confirmed primary",()=>{
 const {ctx,ws}=setup();ctx.refreshWeaponSelection();ctx.loadoutPrepareRound();ctx.loadoutUpdate();
 ws.querySelector(".wp-cards").children[1].onclick();ctx.loadoutFinish(false);
 ctx.mt.cd=5;ctx.loadoutPrepareRound();ctx.loadoutUpdate();
 assert.equal(ctx.wsConfirmed,false);assert.equal(ctx.wsOn,true);assert.equal(ctx.pl.prim,1);
 assert.match(lobby,/if\(isBombMode\(\)\)bombStartMatch\(\);loadoutPrepareRound\(\);/);
});
test("closed pointer lock and input cannot steal a loadout click",()=>{
 assert.match(look,/typeof wsOn!=="undefined"&&wsOn/);
 assert.match(input,/typeof wsOn!=="undefined"&&wsOn&&e.code==="Enter"/);
 assert.match(input,/typeof wsOn!=="undefined"&&wsOn\)\{e.preventDefault\(\);return;\}/);
 assert.match(picker,/document.exitPointerLock\(\)/);
 assert.match(picker,/document.body.classList.toggle\("loadout-cursor-hidden"/);
 assert.match(look,/function lookFreeAimEnabled\(\)/);
 assert.match(look,/lookHoverPoint/);
 assert.match(input,/e.target!==R.domElement&&lookFreeAimEnabled\(\)/);
 assert.match(input,/Key\[WASD\]/);
 assert.match(css,/body.loadout-cursor-hidden:not\(\.lobby\):not\(\.over\) \*/);
 const hud=read("src/game/70-kills-and-damage-hud.js");
 assert.doesNotMatch(hud,/run=true;if\(!touch\)\{try\{R\.domElement\.requestPointerLock/);
 assert.match(hud,/Keep cursor free for pre-round loadout selection/);
 assert.match(controls,/WSEL.indexOf\(id\)<0\|\|inventoryOwned\("main"\).indexOf\(id\)<0/);
});
test("source manifest and generated asset preserve all original game features",()=>{
 const m=JSON.parse(read("tools/source-manifest.json"));
 assert.equal(m.parts.indexOf("src/game/77-loadout-picker.js")+1,m.parts.indexOf("src/game/79-camera-look.js"));
 assert.equal(read("assets/game.js"),"(function(){\n"+m.parts.map(read).join("")+"})();\n");
 assert.ok(m.parts.includes("src/game/86-bomb-mission.js"));
});
