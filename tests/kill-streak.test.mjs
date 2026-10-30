import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),".."),read=p=>readFileSync(resolve(root,p),"utf8").replace(/\r\n/g,'\n');
const audio=read("src/game/65-audio.js"),hud=read("src/game/70-kills-and-damage-hud.js"),combat=read("src/game/45-combat.js"),bomb=read("src/game/86-bomb-mission.js");
function extract(code,start,end){
 const a=code.indexOf(start),b=code.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,"source region: "+start);return code.slice(a,b);
}
const tracker=extract(audio,"var ck={n:0,hs:0}","// dmgE():");
const killE=extract(audio,"function killE(e,kx,kz,ex){","// updDead(dt):");
const notification=extract(hud,"function killNotify(mass){","// ---- KILL FEED");
function game(){
 const banners=[],player={name:"You",tm:0,dead:false,st:{k:0}};
 const ctx={pl:player,en:[],curK:player,hsF:false,inBoom:false,boomN:0,killW:1,
   dead:[],rq:[],ts:[0,0],score:0,DM_RULES:{crates:false},
   kFeed(){},bombDrop(){},detachGun(){},spark(){},starKill(){},bloodPoolSpawn(){return null;},
   mkCrate(){},gh(){return 0;},rci(){return 0;},isBombMode(){return false;},
   showKill(...args){banners.push(args);}
 };
 runInNewContext(tracker+"\n"+notification+"\n"+killE,ctx);
 function kill(head=false){
   const bot={name:"Enemy",tm:1,dead:false,st:{d:0},x:0,z:0,y:0,ms:[],arms:[],
    g:{rotation:{y:0},userData:{gun:{position:{set(){}}}}},
    body:{rotation:{x:0,y:0}}};
   ctx.en.push(bot);ctx.hsF=head;ctx.killE(bot,0,0,false);ctx.hsF=false;
 }
 return {ctx,banners,player,kill};
}
test("Long gaps never reset Double, Triple and Chain milestones",()=>{
 const g=game();g.kill();assert.equal(g.ctx.ck.n,1);assert.equal(g.banners.length,0);
 g.kill();assert.equal(g.banners.at(-1)[0],"DOUBLE KILL");
 g.kill();assert.equal(g.banners.at(-1)[0],"TRIPLE KILL");
 for(let n=4;n<=8;n++){g.kill();assert.equal(g.ctx.ck.n,n);assert.equal(g.banners.at(-1)[0],"CHAIN KILLER");}
 assert.doesNotMatch(audio,/ck\.t|ck\.t=4/);
});
test("Headshot banner overrides only that kill and preserves life streak",()=>{
 const g=game();g.kill();g.kill();g.kill(true);
 assert.equal(g.ctx.ck.n,3);assert.equal(g.banners.at(-1)[0],"HEADSHOT");
 g.kill();assert.equal(g.ctx.ck.n,4);assert.equal(g.banners.at(-1)[0],"CHAIN KILLER");
 g.kill(true);assert.equal(g.banners.at(-1)[0],"HEADSHOT");
 g.kill();assert.equal(g.ctx.ck.n,6);assert.equal(g.banners.at(-1)[0],"CHAIN KILLER");
});
test("On death streak resets, without resetting scoreboard/career kills",()=>{
 const g=game();g.kill();g.kill();g.kill();assert.equal(g.player.st.k,3);
 g.ctx.resetKillStreak();assert.equal(g.ctx.ck.n,0);assert.equal(g.player.st.k,3);
 const before=g.banners.length;g.kill();
 assert.equal(g.ctx.ck.n,1);assert.equal(g.banners.length,before);
 assert.match(hud,/function die\(\)\{pl\.dead=true;resetKillStreak\(\)/);
 assert.match(combat,/chutes=\[\];resetKillStreak\(\);shakeT=0/);
});
test("Explosive multi-kill still shows MASS KILL and increments overall streak",()=>{
 const g=game();g.kill();g.ctx.inBoom=true;
 g.kill();g.kill();g.kill();
 assert.equal(g.ctx.ck.n,4);assert.equal(g.ctx.boomN,3);
 g.ctx.inBoom=false;g.ctx.killNotify(true);
 assert.equal(g.banners.at(-1)[0],"MASS KILL");
 g.kill();assert.equal(g.ctx.ck.n,5);
 assert.equal(g.banners.at(-1)[0],"CHAIN KILLER");
});
function round(dead){
 const ctx={pl:{tm:1,dead},ck:{n:dead?0:4,hs:dead?0:1},bombMatch:{keepRound:false},ts:[1,2],
  ROS:[{tm:1,name:"You",k:5,d:dead?1:0}],bombCleanup(){},
  reset(){ctx.ck.n=0;ctx.ck.hs=0;ctx.ROS=[];},
  startMatch(){ctx.ROS=[{tm:1,name:"You",k:0,d:0}];},
  resetKillStreak(){ctx.ck.n=0;ctx.ck.hs=0;}};
 runInNewContext(extract(bomb,"function bombNextRound(){","// The tactical director"),ctx);
 ctx.bombNextRound();return ctx;
}
test("Bomb Mission surviving player starts every round with a fresh multi-kill streak",()=>{
 const c=round(false);assert.equal(c.ck.n,0);assert.equal(c.ck.hs,0);
 assert.equal(c.ROS[0].k,5);assert.equal(c.bombMatch.keepRound,true);
});
test("Bomb Mission death resets streak for the next round",()=>{
 const c=round(true);assert.equal(c.ck.n,0);assert.equal(c.ck.hs,0);
});
test("Bundled runtime matches all ordered source modules exactly",()=>{
 const m=JSON.parse(read("tools/source-manifest.json"));
 assert.equal(read("assets/game.js"),"(function(){\n"+m.parts.map(read).join("")+"})();\n");
});
