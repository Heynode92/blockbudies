import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/game/81-match-scoreboard.js', import.meta.url),'utf8');

function fakeElement(tag='div'){
  return {
    tag, className:'', textContent:'', hidden:true, attributes:{}, children:[],
    appendChild(child){this.children.push(child);return child;},
    replaceChildren(...children){this.children=children.flatMap(child=>child.tag==='fragment'?child.children:[child]);},
    setAttribute(name,value){this.attributes[name]=value;},
    classList:{contains(){return false;}}
  };
}
function setup(){
  const local={name:'You',tm:0,k:4,d:2};
  const rival={name:'Viper',tm:1,k:8,d:6};
  const teammate={name:'Mike',tm:0,k:9,d:5};
  const other={name:'Ghost',tm:1,k:1,d:3};
  const stats=[local,rival,teammate,other];
  const elements=new Map(),handlers={};
  for(const id of [
    'matchScoreboard','matchScoreboardPoliceRows','matchScoreboardTerroristRows',
    'matchScoreboardPoliceScore','matchScoreboardTerroristScore',
    'matchScoreboardPoliceKills','matchScoreboardPoliceDeaths',
    'matchScoreboardTerroristKills','matchScoreboardTerroristDeaths','dv'
  ])elements.set(id,fakeElement());
  const document={
    hidden:false,body:{classList:{contains(){return false;}}},
    getElementById(id){if(!elements.has(id))throw Error('Missing '+id);return elements.get(id);},
    createElement:fakeElement,createDocumentFragment(){return fakeElement('fragment');},
    addEventListener(name,fn){handlers['document:'+name]=fn;}
  };
  let intervalId=0,intervalFn=null,cleared=0;
  const context={document,ROS:stats,pl:{st:local},ts:[3,7],
    run:true,lob:false,mt:{over:false},roomStartFlow:{active:false},
    addEventListener(name,fn){handlers[name]=fn;},
    setInterval(fn){intervalFn=fn;return ++intervalId;},
    clearInterval(){cleared++;intervalFn=null;}
  };
  runInNewContext(source,context);
  return {context,document,stats,local,rival,teammate,other,elements,handlers,
    interval(){if(intervalFn)intervalFn();},get cleared(){return cleared;}};
}
function key(h,code='Tab',name='keydown'){
  const event={code,prevented:false,preventDefault(){this.prevented=true;}};
  h.handlers[name](event);
  return event;
}
test('TAB held shows real K/D by team, ordered by kills, and marks local player',()=>{
  const h=setup();
  assert.equal(key(h).prevented,true);
  const root=h.elements.get('matchScoreboard');
  assert.equal(root.hidden,false);
  assert.equal(root.attributes['aria-hidden'],'false');
  const police=h.elements.get('matchScoreboardPoliceRows').children;
  const terror=h.elements.get('matchScoreboardTerroristRows').children;
  assert.equal(police.length,2);
  assert.equal(terror.length,2);
  assert.equal(police[0].children[1].children[0].textContent,'Mike');
  assert.equal(police[1].children[1].children[0].textContent,'You');
  assert.ok(police[1].className.includes('is-you'));
  assert.equal(terror[0].children[1].children[0].textContent,'Viper');
  assert.equal(h.elements.get('matchScoreboardPoliceScore').textContent,'3');
  assert.equal(h.elements.get('matchScoreboardTerroristScore').textContent,'7');
  assert.equal(h.elements.get('matchScoreboardPoliceKills').textContent,'13');
  assert.equal(h.elements.get('matchScoreboardPoliceDeaths').textContent,'7');
  assert.equal(h.elements.get('matchScoreboardTerroristKills').textContent,'9');
  assert.equal(h.elements.get('matchScoreboardTerroristDeaths').textContent,'9');
  assert.deepEqual(h.stats.map(p=>p.name),['You','Viper','Mike','Ghost']); // no mutation
});
test('Holding refreshes live scores without changing source statistics',()=>{
  const h=setup();key(h);
  h.local.k=12;h.rival.d=10;h.context.ts[0]=8;
  h.interval();
  assert.equal(h.elements.get('matchScoreboardPoliceRows').children[0].children[1].children[0].textContent,'You');
  assert.equal(h.elements.get('matchScoreboardPoliceKills').textContent,'21');
  assert.equal(h.elements.get('matchScoreboardTerroristDeaths').textContent,'13');
  assert.equal(h.elements.get('matchScoreboardPoliceScore').textContent,'8');
});
test('Releasing TAB immediately hides and clears timer',()=>{
  const h=setup();key(h);
  assert.equal(key(h,'Tab','keyup').prevented,true);
  assert.equal(h.elements.get('matchScoreboard').hidden,true);
  assert.equal(h.elements.get('matchScoreboard').attributes['aria-hidden'],'true');
  assert.equal(h.cleared,1);
});
test('ESC, blur, tab hiding, and match end dismiss without blocking controls',()=>{
  const h=setup();
  key(h);key(h,'Escape');assert.equal(h.elements.get('matchScoreboard').hidden,true);
  key(h);h.handlers.blur();assert.equal(h.elements.get('matchScoreboard').hidden,true);
  key(h);h.document.hidden=true;h.handlers['document:visibilitychange']();
  assert.equal(h.elements.get('matchScoreboard').hidden,true);
  h.document.hidden=false;h.context.run=false;
  assert.equal(key(h).prevented,false);
  assert.equal(h.elements.get('matchScoreboard').hidden,true);
});
test('Outside a match TAB does not interfere with ordinary browser focus navigation',()=>{
  const h=setup();h.context.lob=true;
  assert.equal(key(h).prevented,false);
  assert.equal(h.elements.get('matchScoreboard').hidden,true);
  h.context.lob=false;h.context.roomStartFlow.active=true;
  assert.equal(key(h).prevented,false);
  h.context.roomStartFlow.active=false;h.context.mt.over=true;
  assert.equal(key(h).prevented,false);
});


test('authenticated TAB scoreboard mounts official 3D rank before each player name',()=>{
 const scoreboard=read('src/game/81-match-scoreboard.js');
 const model=read('src/game/81-rank-insignia.js');
 const css=read('src/styles/16-match-scoreboard.css');
 assert.match(scoreboard,/rankBadge\.className="match-sb-rank-badge"/);
 assert.match(scoreboard,/rankRosterPreview\(rankIndex\)/);
 assert.match(scoreboard,/name\.appendChild\(rankBadge\)/);
 assert.match(scoreboard,/stat\.bot\?0:stat\.rankIndex/);
 assert.match(model,/if\(!source\)source=rankInsigniaInit\(badgeCanvas\)/);
 assert.match(css,/#matchScoreboard \.match-sb-rank-badge/);
});
