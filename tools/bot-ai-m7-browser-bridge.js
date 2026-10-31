// M7 CI browser-only injection, concatenated INSIDE the committed game IIFE.
// Never included in assets/game.js or loaded by players. Production functions
// are called unchanged. Neither BOMB_RULES nor projectile/winner logic is patched.
if(botQaEnabled){
  window.__BlockBuddiesM7CI=Object.freeze({
    start:function(mode,team,mapId){
      // Test the actual room whitelist and production map activation.
      var activeMap=mode===1?bombMapId(mapId):"block-district";
      roomMatchConfig={mode:mode,mapId:activeMap,kills:100,minutes:1,rounds:12,roundMinutes:1};
      selM=mode;
      begin(team);
      if(!window.__BlockBuddiesM7CI.substitute())throw Error('Expected canonical 9-BOT roster');
      window.__m7RoundRef=bombMatch;
      var mapChecks=null;
      if(mode===1&&activeMap==="block-town"){
        // Assert no spawn inside solids, no direct team spawn LOS, and A* routes
        // from each spawn faction to both playable bomb sites.
        var sides=[BLOCK_TOWN_DEF.spawns.police,BLOCK_TOWN_DEF.spawns.terrorist];
        sides.forEach(function(group){group.forEach(function(p){
          if(inObs(p[0],p[1],.85))throw Error('BLOCK TOWN spawn intersects a solid: '+p);
        });});
        BOMB_SITES.forEach(function(site){
          if(inObs(site.x,site.z,1))throw Error('BLOCK TOWN bomb site intersects a solid: '+site.id);
        });
        var routes=[];
        sides.forEach(function(group,t){
          group.forEach(function(p){
            BOMB_SITES.forEach(function(site){
              var pts=gPath(p[0],p[1],site.x,site.z);
              if(!pts||pts.length<2)throw Error('BLOCK TOWN inaccessible '+t+' spawn '+p+' -> '+site.id);
              routes.push({team:t,site:site.id,points:pts.length});
            });
          });
        });
        var clearPairs=0;
        sides[0].forEach(function(p){sides[1].forEach(function(q){
          var steps=Math.ceil(Math.hypot(p[0]-q[0],p[1]-q[1])/.5),blocked=false;
          for(var i=1;i<steps;i++){
            var k=i/steps;
            if(inObs(p[0]+(q[0]-p[0])*k,p[1]+(q[1]-p[1])*k,.02)){blocked=true;break;}
          }
          if(!blocked)clearPairs++;
        });});
        if(clearPairs)throw Error('BLOCK TOWN opposing spawn direct sightline count: '+clearPairs);
        mapChecks={routes:routes.length,clearSpawnSightlinePairs:clearPairs,sites:BOMB_SITES.map(function(q){return q.id;})};
      }
      BlockBuddiesQA.reset();
      return {map:mode===1?bombMapInfo(activeMap).name:'BLOCK DISTRICT',mapChecks:mapChecks,bots:en.length,
        teams:[en.filter(e=>e.tm===0).length,en.filter(e=>e.tm===1).length],
        roundSeconds:roomRoundSeconds(),roundLimit:roomRoundLimit()};
    },
    substitute:function(){
      if(en.length!==9)return false;
      var team=pl.tm;
      // The original human remains inactive; a canonical production BOT
      // occupies the missing roster slot in this QA-only 5v5 variant.
      pl.dead=true;pl.rsT=1e8;
      var b=newBot(team,4);
      b.st={name:b.name,tm:team,k:0,d:0};
      ROS.push(b.st);placeBot(b);
      if(isBombMode()&&bombMatch&&bombMatch.carrier===pl){
        var eligible=en.filter(e=>e.tm===1&&!e.dead);
        bombMatch.carrier=eligible[Math.floor(Math.random()*eligible.length)]||null;
        window.__m7CarrierSubstitutions=(window.__m7CarrierSubstitutions||0)+1;
      }
      return true;
    },
    pauseForStepping:function(){
      run=false;
      // Headless accelerated functional QA has already finished the true
      // WebGL performance sample. Disable graphics work only for fast steps;
      // update(), collision, AI and objective simulation are untouched.
      R.render=function(){};
      R.shadowMap.enabled=false;
      R.setPixelRatio(1);
      R.setSize(1,1,false);
      BlockBuddiesQA.reset();
    },
    step:function(steps){
      if(run)throw Error('Refusing accelerated update while real-time rAF simulation is active');
      for(var i=0;i<steps;i++){
        if(mt.over)break;
        update(1/60);
        // Dead BOTs leave en[] naturally; do not mistake casualty count
        // for a new round. Only restore the QA player-slot replacement
        // when canonical bombNextRound creates a NEW bombMatch object.
        if(bombMatch&&bombMatch!==window.__m7RoundRef&&!mt.over){
          window.__m7RoundRef=bombMatch;
          if(!window.__BlockBuddiesM7CI.substitute())
            throw Error('Cannot restore 5v5 QA roster after canonical round reset');
        }
      }
      var r=BlockBuddiesQA.report();
      return {over:mt.over,round:bombMatch&&bombMatch.round,
        completed:r.bombRounds.completed,planted:r.bombRounds.plantedAtFinish};
    },
    restart:function(team){begin(team);run=false;
      if(!window.__BlockBuddiesM7CI.substitute())throw Error('5v5 QA restore failed on new match');
      window.__m7RoundRef=bombMatch;},
    summary:function(){
      return {qa:BlockBuddiesQA.report(),rendering:R.info.render.calls,
        active:run,over:mt.over,bots:en.length,webgl:!!R.getContext(),
        round:bombMatch&&bombMatch.round,
        carrierSubstitutions:window.__m7CarrierSubstitutions||0,
        teams:[en.filter(e=>e.tm===0).length,en.filter(e=>e.tm===1).length]};
    }
  });
}
