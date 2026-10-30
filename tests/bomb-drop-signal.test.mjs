import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8').replace(/\r\n/g,'\n');
const mission=read('src/game/86-bomb-mission.js');
const radar=read('src/game/96-hud-and-radar.js');
const helper=mission.slice(mission.indexOf("var bombDropMarker="),mission.indexOf("function bombCandidates()"));
const radarHelpers=radar.slice(radar.indexOf("var BOMB_RADAR="),radar.indexOf("// cfont():"));
function setup(team=1){
 const p={x:25,z:-10},marker={style:{setProperty(){}},classList:{toggle(){}},querySelector(){return{set textContent(v){marker.range=v;}}}};
 const c={Math,Object,Number,T:{Vector3:class{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
    clone(){return new this.constructor(this.x,this.y,this.z);}sub(o){this.x-=o.x;this.y-=o.y;this.z-=o.z;return this;}
    dot(o){return this.x*o.x+this.y*o.y+this.z*o.z;}
    project(){this.x/=80;this.y/=80;return this;}}},
   document:{getElementById(){return marker;}},C:{position:{x:0,y:2,z:0},getWorldDirection(){return{x:0,y:0,z:1}}},
   innerWidth:1280,innerHeight:720,run:true,mt:{over:false},
   pl:{tm:team,x:-25,z:10},bombMatch:{state:'idle',dropped:p,done:false},isBombMode(){return true}};
 runInNewContext(helper+'\n'+radarHelpers,c);
 return {c,marker,p};
}
test('fallen carrier signals exact dropped bomb position to Terrorists',()=>{
 const {c,marker,p}=setup(1);
 assert.equal(c.bombDroppedSignalVisible(),true);
 assert.ok(c.bombRadarRange(c.pl)>50);
 c.bombDropMarkerUpdate();assert.equal(marker.style.display,'flex');
 assert.ok(marker.style.left.endsWith('px')&&marker.style.top.endsWith('px'));
 const arcs=[],dots=[];
 const X={save(){},restore(){},beginPath(){},stroke(){},fill(){},closePath(){},
   arc(x,z){arcs.push([x,z]);},moveTo(x,z){dots.push([x,z]);},lineTo(){}};
 c.bombDroppedRadarBeacon(X,2,1.2);
 assert.deepEqual(arcs,[[p.x,p.z]]);
 assert.deepEqual(dots,[[p.x,p.z-2.5]]);
});
test('Police never get dropped bomb location, map zoom or screen signal',()=>{
 const {c,marker}=setup(0);
 assert.equal(c.bombDroppedSignalVisible(),false);
 assert.equal(c.bombRadarRange(c.pl),50);
 c.bombDropMarkerUpdate();assert.equal(marker.style.display,'none');
 const arcs=[];c.bombDroppedRadarBeacon({arc(){arcs.push(1);}},2,1);
 assert.equal(arcs.length,0);
});
test('bomb signal disappears after pickup, planting, finish or mode change',()=>{
 const {c,marker,p}=setup(1);
 for(const change of [
  ()=>{c.bombMatch.dropped=null;},
  ()=>{c.bombMatch.dropped=p;c.bombMatch.state='planted';},
  ()=>{c.bombMatch.state='idle';c.bombMatch.done=true;},
  ()=>{c.bombMatch.done=false;c.isBombMode=()=>false;}
 ]){change();assert.equal(c.bombDroppedSignalVisible(),false);c.bombDropMarkerUpdate();assert.equal(marker.style.display,'none');}
});
test('Police retain planted bomb beacon without access to dropped-bomb dot',()=>{
 assert.match(radar,/bombRadarBeacon\(X,k,now\);bombDroppedRadarBeacon\(X,k,now\)/);
 assert.doesNotMatch(radar,/if\(bombMatch&&bombMatch\.dropped\)\{X\.fillStyle/);
 const {c}=setup(0);c.bombMatch.state='planted';c.bombMatch.device={position:{x:7,z:3}};
 const arcs=[],X={save(){},restore(){},beginPath(){},stroke(){},fill(){},arc(x,z){arcs.push([x,z]);}};
 c.bombRadarBeacon(X,2,1);
 assert.ok(arcs.length===3&&arcs.every(q=>q[0]===7&&q[1]===3));
});
