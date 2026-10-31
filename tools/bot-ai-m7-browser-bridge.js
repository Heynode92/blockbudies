// M7 CI browser-only injection, concatenated INSIDE the committed game IIFE.
// Never included in assets/game.js or loaded by players. Production functions
// are called unchanged. Neither BOMB_RULES nor projectile/winner logic is patched.
if(botQaEnabled){
  window.__BlockBuddiesM7CI=Object.freeze({
    start:function(mode,team){
      roomMatchConfig={mode:mode,kills:100,minutes:1,rounds:12,roundMinutes:1};
      selM=mode;
      begin(team);
      if(!window.__BlockBuddiesM7CI.substitute())throw Error('Expected canonical 9-BOT roster');
      window.__m7RoundRef=bombMatch;
      BlockBuddiesQA.reset();
      return {map:isBombMode()?'LOCKDOWN':'BLOCK DISTRICT',bots:en.length,
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
    pauseForStepping:function(){run=false;BlockBuddiesQA.reset();},
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
