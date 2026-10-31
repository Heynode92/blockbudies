import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(resolve(root,path),'utf8');
const source=read('src/game/87-bomb-tactics.js');
const intelligence=read('src/game/86-bomb-intelligence.js');
const mission=read('src/game/86-bomb-mission.js');
const bot=read('src/game/90-bot-ai.js');
const bomb={position:{x:25,z:5}};
function scenario(){
 const policeA={tm:0,idx:0,dead:false,x:60,z:60,name:'POLICE A'};
 const policeB={tm:0,idx:1,dead:false,x:27,z:5,name:'POLICE B'};
 const terrorist={tm:1,idx:2,dead:true,x:20,z:5,name:'TERRORIST'};
 const player={tm:1,dead:true,x:24,z:5,name:'YOU'};
 const c={Math,Object,Array,A:80,tt:3,en:[policeA,policeB,terrorist],pl:player,
   bombMatch:{done:false,state:'planted',site:1,device:bomb,defuser:null},
   BOMB_RULES:{interactRadius:2.45},
   BOMB_SITES:[{x:-25,z:-5},{x:25,z:5}],
   inObs(){return false;},isBombMode(){return true;}
 };
 runInNewContext(intelligence,c);
 runInNewContext(source,c);
 return {c,policeA,policeB,terrorist,player};
}
test('when all Terrorists die, nearest Police immediately takes defuse duty',()=>{
 const {c,policeA,policeB}=scenario();
 assert.equal(c.bombUncontestedRetake(),true);
 assert.equal(c.bombPickDefuser(),policeB);
 assert.equal(c.bombTacticalStage(policeB),'retake-defuse');
 assert.equal(c.bombTacticalStage(policeA),'retake-support');
 assert.deepEqual([...c.bombTacticalGoal(policeB)],[25,5]);
 assert.ok(Math.hypot(...(function(p){return [p[0]-25,p[1]-5]})(c.bombTacticalGoal(policeA)))<=c.BOMB_AI.clearSiteSupportRadius+.0001);
});
test('defuse assignment switches to closer officer, but never interrupts live defuse',()=>{
 const {c,policeA,policeB}=scenario();
 c.bombMatch.defuser=policeA;
 assert.equal(c.bombPickDefuser(),policeB);
 policeB.bAction={type:'defuse',site:1,t:4};
 policeA.x=25;policeA.z=5;
 assert.equal(c.bombPickDefuser(),policeB);
});
test('Terrorist still alive means solo defender/retake combat behavior is unchanged',()=>{
 const {c,terrorist,policeA,policeB}=scenario();
 terrorist.dead=false;terrorist.x=26;terrorist.z=6;
 assert.equal(c.bombUncontestedRetake(),false);
 assert.equal(c.bombTacticalStage(policeB),'retake-defuse');
 assert.equal(c.bombTacticalStage(policeA),'retake-assault');
});
test('Police nearest to bomb may defuse immediately and stale target cannot interrupt',()=>{
 const {c,policeB}=scenario();
 c.bombActionFor=e=>e===policeB?{type:'defuse',site:1}:null;
 assert.equal(c.bombBotCanAct(policeB),true);
 policeB.tg={x:27,z:5};policeB.lok=true;
 assert.equal(c.bombBotCanAct(policeB),true);
});
test('spectator uses teammate if alive; after team wipe, follows closest Police defuser',()=>{
 const {c,policeB,terrorist}=scenario();
 c.mt={over:false};c.bombSpectatorIndex=0;c.bombSpectatorView='team';
 c.bombResetSpectatorCamera=()=>{};
 const snippet=mission.slice(mission.indexOf('function bombSpectatorTarget(){'),mission.indexOf('function bombSpectatorNext('));
 runInNewContext(snippet,c);
 const mate={tm:1,idx:3,name:'FRIEND',dead:false,x:0,z:0};
 c.en.push(mate);
 assert.equal(c.bombSpectatorTarget(),mate);
 mate.dead=true;
 assert.equal(c.bombSpectatorTarget(),policeB);
 assert.equal(c.bombSpectatorView,'police');
 c.bombSpectatorIndex++;
 const next=c.bombSpectatorTarget();
 assert.notEqual(next,policeB);
 c.bombMatch.state='idle';
 assert.equal(c.bombSpectatorTarget(),null);
});
test('bot pathing prioritizes clear-site rush without changing TDM speed',()=>{
 assert.match(bot,/bombUncontestedRetake\(\)\?BOMB_AI\.clearSiteSpeedMultiplier/);
 assert.match(bot,/isBombMode\(\).*bombPickDefuser\(\)===e/);
 assert.match(bot,/:4\.8,ox=e\.x/);
});
test('spectator status reports Police retake and defuse progress, not empty view',()=>{
 assert.match(mission,/BOMB_TEXT\.spectatingPolice/);
 assert.match(mission,/BOMB_TEXT\.switchPolice/);
 assert.match(mission,/target\.bAction\.type==='defuse'/);
 const texts=read('src/game/11-bomb-map.js');
 assert.match(texts,/spectatingPolice:'SPECTATING POLICE'/);
});
