import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../src/game/98-online-bridge.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/18-room-lobby-redesign.css',import.meta.url),'utf8');
const start=source.indexOf('function onlineRoomDisplayId(');
const end=source.indexOf('async function onlineRefreshRooms()',start);
assert.ok(start>=0&&end>start,'canonical room render and ID adapter exist');
const sourcePart=source.slice(start,end);
function fakeElement(tag='div'){
 return {tag,children:[],className:'',textContent:'',hidden:false,attributes:{},handlers:{},
  appendChild(child){this.children.push(child);return child;},
  replaceChildren(){this.children.length=0;},
  setAttribute(name,value){this.attributes[name]=String(value);},
  addEventListener(name,handler){this.handlers[name]=handler;}};
}
test('BE room public code renders ONLY the numeric sequence without editing join ID',()=>{
 const list=fakeElement(),empty=fakeElement(),labels={roomEntries:list,roomEmpty:empty,
  roomBrowserModeLabel:fakeElement(),roomEmptyTitle:fakeElement(),roomEmptyCopy:fakeElement()};
 const joined=[],counts=[];
 const actualId='2184a213-787e-4c72-b90f-237eb9b80ff0';
 const code='PBT-00026-DM';
 const room={id:actualId,code,name:'My Room',mode:0,mapId:'block-district',
  members:[{playerId:'owner'}],status:'OPEN'};
 const ctx={document:{getElementById(id){return labels[id];},createElement:fakeElement},
  roomList:[room],roomText:(id,value)=>counts.push([id,value]),
  roomMapsForMode:()=>({name:'BLOCK DISTRICT'}),
  onlineSelectRoom:id=>joined.push(id)};
 runInNewContext(sourcePart+'\nthis.format=onlineRoomDisplayId;this.render=onlineRoomRender;',ctx);
 assert.equal(ctx.format('PBT-00026-DM'),'00026');
 assert.equal(ctx.format('PBT-00027-BM'),'00027');
 assert.equal(ctx.format('PBT-102030-DM'),'102030');
 assert.equal(ctx.format('PBT-bad-DM'),'—');
 assert.equal(ctx.format(null),'—');
 ctx.render();
 assert.equal(list.children.length,1);
 const row=list.children[0];
 assert.equal(row.children.length,6,'one cell per shared header column');
 assert.equal(row.children[0].textContent,'00026');
 assert.equal(row.children[0].className,'room-id');
 assert.equal(row.children[0].attributes['aria-label'],'Room ID 00026');
 assert.equal(row.children[1].textContent,'My Room');
 assert.equal(row.children[3].textContent,'1 / 10');
 assert.equal(row.children[4].textContent,'OPEN');
 assert.equal(row.children[5].textContent,'JOIN');
 row.children[5].handlers.click();
 assert.equal(joined[0],actualId,'join MUST still use official UUID');
 assert.equal(room.code,code,'full authenticated room code is preserved in state');
 assert.deepEqual(counts,[['roomCount','1 ONLINE ROOM']]);
});
test('six-column CSS template applies equally to header and every row',()=>{
 assert.match(css,/#lbrooms \.room-cols,\s*#lbrooms \.room-entry\s*\{/);
 assert.match(css,/grid-template-columns:minmax\(66px,\.75fr\)/);
 assert.match(css,/#lbrooms \.room-entry \.room-id\{/);
 assert.match(css,/font-variant-numeric:tabular-nums/);
 assert.match(css,/#lbrooms \.room-entry \.room-name\{/);
 assert.match(css,/text-overflow:ellipsis/);
 assert.match(css,/#lbrooms \.room-entry \.room-join\{/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.doesNotMatch(sourcePart,/cell\('span',r\.code\|\|'—'\)/);
});
