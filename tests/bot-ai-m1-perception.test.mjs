import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
const perception=read('src/game/88-bot-perception.js');
const bomb=read('src/game/87-bomb-tactics.js');
function scene(){
 const police={tm:0,idx:0,dead:false,x:0,z:0,hp:100};
 const ally={tm:0,idx:1,dead:false,x:-3,z:0,hp:100};
 const terrorist={tm:1,idx:0,dead:false,x:5,z:0,hp:100};
 const world={tt:0,A:80,Math,run:true,lob:false,mt:{over:false,cd:0},
  en:[police,ally,terrorist],pl:{dead:true,tm:1,x:75,z:75},
  blocked:false,los(){return !world.blocked;},inObs(){return false;},
  isBombMode(){return true;},
  BOMB_RULES:{interactRadius:2},BOMB_SITES:[{x:-30,z:0},{x:30,z:0}],
  bombMatch:{state:'planted',done:false,site:1,round:1,
   device:{position:{x:30,z:0}},defuser:null,carrier:null,dropped:null}
 };
 vm.createContext(world);
 vm.runInContext(perception,world,{filename:'88-bot-perception.js'});
 vm.runInContext(bomb,world,{filename:'87-bomb-tactics.js'});
 return{world,police,ally,terrorist};
}
test('M1: occluded opponent movement cannot inform sight or tactical goals',()=>{
 const {world,police,terrorist}=scene();
 world.blocked=true;
 assert.equal(world.botIntelAcquire(police),null);
 assert.equal(world.bombNearestOpponent(police),null);
 assert.equal(world.bombNearestThreat(0,0,0,45,police),null);
 const first=world.bombTacticalGoal(police);
 terrorist.x=60;terrorist.z=52;
 const next=world.bombTacticalGoal(police);
 assert.deepEqual(next,first);
 assert.equal(world.botIntelKnown(police),null);
});
test('M1: observed coordinates freeze when sight is lost and expire',()=>{
 const {world,police,terrorist}=scene();
 assert.equal(world.botIntelAcquire(police),terrorist);
 const first=world.botIntelKnown(police);
 assert.equal(first.source,'sight');
 assert.equal(first.x,5);
 assert.ok(Number.isFinite(first.seenAt));
 world.blocked=true;terrorist.x=37;terrorist.z=33;
 assert.equal(world.botIntelAcquire(police),null);
 assert.equal(world.botIntelKnown(police).x,5);
 assert.equal(world.bombNearestOpponent(police).x,5);
 world.tt=4;
 assert.equal(world.botIntelKnown(police),null);
 assert.equal(world.bombNearestOpponent(police),null);
});
test('M1: team radio shares only authentic recent observations, not live object',()=>{
 const {world,police,ally,terrorist}=scene();
 assert.equal(world.botIntelKnown(ally),null);
 world.botIntelAcquire(police);
 assert.equal(world.botIntelKnown(ally).source,'radio');
 assert.equal(world.botIntelKnown(ally).x,5);
 world.blocked=true;terrorist.x=38;
 assert.equal(world.botIntelKnown(ally).x,5);
 assert.equal(world.botTeamReports[1],null);
 world.tt=2.5;
 assert.equal(world.botIntelKnown(ally),null);
 assert.equal(world.botIntelKnown(police).x,5);
 world.tt=4;
 assert.equal(world.botIntelKnown(police),null);
});
test('M1: real-action sound events give short-lived approximate locations without identities',()=>{
 const {world,police,terrorist}=scene();
 world.blocked=true;
 world.botSoundEmit(terrorist,'footstep');
 assert.equal(world.botSoundEvents.length,1);
 assert.equal(world.botSoundEvents[0].actor,undefined);
 assert.equal(world.botSoundEvents[0].idx,undefined);
 assert.equal(world.botIntelAcquire(police),null);
 const clue=world.botIntelHearing(police);
 assert.equal(clue.source,'sound');
 assert.equal(clue.kind,'footstep');
 assert.notEqual(clue.x,terrorist.x,'auditory localization must be quantized');
 assert.equal(world.botIntelKnown(police).source,'sound');
 assert.equal(world.botIntelAcquire(police),null,'hearing never produces a shootable actor');
 world.tt=2;
 assert.equal(world.botIntelKnown(police),null);
});
test('M1: LOS blocks distant muffled audio; audio queue and reset bounded',()=>{
 const {world,police,terrorist}=scene();
 world.blocked=true;terrorist.x=13;
 world.botSoundEmit(terrorist,'footstep');
 assert.equal(world.botIntelHearing(police),null,'occluded footstep beyond wall-attenuated range');
 world.botSoundEmit(terrorist,'gunshot');
 assert.equal(world.botIntelHearing(police).kind,'gunshot');
 for(let i=0;i<100;i++)world.botSoundEmit(terrorist,'gunshot');
 assert.equal(world.botSoundEvents.length,28);
 world.botIntelReset();
 assert.equal(world.botIntelKnown(police),null);
 assert.equal(world.botSoundEvents.length,0);
 assert.equal(world.botTeamReports[0],null);
});
test('M1: bomb plant/retake threat helpers accept sight evidence only',()=>{
 const {world,police,terrorist}=scene();
 world.blocked=true;
 assert.equal(world.bombNearestThreat(0,terrorist.x,terrorist.z,20),null,
  'call without observer must fail closed');
 assert.equal(world.bombSoloPoliceThreat(police),null);
 world.botIntelAcquire(police);assert.equal(world.bombNearestOpponent(police),null);
 world.blocked=false;world.botIntelAcquire(police);
 assert.equal(world.bombNearestOpponent(police).source,'sight');
 world.blocked=true;terrorist.x=40;terrorist.z=31;
 assert.equal(world.bombNearestOpponent(police).x,5);
});
