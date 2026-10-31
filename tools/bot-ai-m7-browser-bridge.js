// M7 CI browser-only injection, concatenated INSIDE the committed game IIFE.
// Never included in assets/game.js or loaded by players. Production functions
// are called unchanged. Neither BOMB_RULES nor projectile/winner logic is patched.
if(botQaEnabled){
  window.__BlockBuddiesM7CI=Object.freeze({
    start:function(mode,team,mapId){
      // Test the actual room whitelist and production map activation.
      var activeMap=mode===1?bombMapId(mapId):tdmMapId(mapId);
      roomMatchConfig={mode:mode,mapId:activeMap,kills:100,minutes:activeMap==="block-labs"?2:1,rounds:12,roundMinutes:1};
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
              if(!pts||!pts.length)throw Error('BLOCK TOWN inaccessible '+t+' spawn '+p+' -> '+site.id);
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
        var cfg=BLOCK_TOWN_DEF.perimeter,half=BLOCK_TOWN_DEF.halfSize,
            offset=half+cfg.thickness/2+.02,span=half*2+cfg.thickness*2,
            shells=[[0,-offset,span,cfg.thickness],[0,offset,span,cfg.thickness],
              [-offset,0,cfg.thickness,span],[offset,0,cfg.thickness,span]];
        shells.forEach(function(w){
          if(!OB.some(function(o){return Math.abs(o.x-w[0])<.001&&Math.abs(o.z-w[1])<.001&&
               Math.abs(o.hw-w[2]/2)<.001&&Math.abs(o.hd-w[3]/2)<.001&&o.h===cfg.height;}))
            throw Error('BLOCK TOWN missing physical boundary: '+w);
        });
        sides.forEach(function(group,t){group.forEach(function(p){
          var yaw=bombMapSpawnYaw(t,p[0],p[1]),
              target=t?BLOCK_TOWN_DEF.spawnLook.terrorist:BLOCK_TOWN_DEF.spawnLook.police,
              dx=target[0]-p[0],dz=target[1]-p[1];
          if((Math.sin(yaw)*dx+Math.cos(yaw)*dz)/Math.hypot(dx,dz)<.99)
            throw Error('BLOCK TOWN spawn faces outward: '+t+' '+p);
        });});
        if(Math.abs(pl.face-bombMapSpawnYaw(team,pl.x,pl.z))>.001)
          throw Error('BLOCK TOWN player initial camera yaw does not match map interior');
        if(BOMB_SITES[0].x!==55||BOMB_SITES[0].z!==-58||
           BOMB_SITES[1].x!==-16||BOMB_SITES[1].z!==8)
          throw Error('BLOCK TOWN failed to activate newest blueprint site anchors');
        if(!sides[0].every(function(p){return p[0]<-65&&p[1]<-25;})||
           !sides[1].every(function(p){return p[0]>40&&p[1]>65;}))
          throw Error('BLOCK TOWN Police WEST or Terrorist SOUTH-EAST spawn differs from blueprint');
        mapChecks={routes:routes.length,clearSpawnSightlinePairs:clearPairs,
          perimeterWalls:shells.length,playerSpawnFacing:pl.face,sites:BOMB_SITES.map(function(q){return q.id;})};
      }
      if(mode===0&&activeMap==="block-labs"){
        var d=BLOCK_LABS_DEF;
        if(A!==60||!BLOCK_LABS_WORLD||d.blocks.length!==6||d.reactors.length!==6)
          throw Error('BLOCK LABS wrong map scale or required 6+6 block layout');
        var solids=0,labRoutes=0;
        d.blocks.forEach(function(b){
          if(!OB.some(function(o){return o.x===b[0]&&o.z===b[1]&&o.hw===b[2]/2&&o.hd===b[3]/2;}))
            throw Error('BLOCK LABS lab wall has no projectile/player collider '+b);
          solids++;
        });
        d.reactors.forEach(function(q){
          if(!OB.some(function(o){return o.x===q[0]&&o.z===q[1]&&o.hw===q[2]&&o.hd===q[2];}))
            throw Error('BLOCK LABS reactor has no collider '+q);
        });
        if(!LT.some(function(o){return o.hw===60&&o.hd===60&&o.y0>10;}))
          throw Error('BLOCK LABS missing solid overhead indoor ceiling');
        [d.spawns.police,d.spawns.terrorist].forEach(function(group,side){
          group.forEach(function(pt){
            if(inObs(pt[0],pt[1],.85))
              throw Error('BLOCK LABS spawn intersects lab walls '+pt);
            var look=side?d.spawnLook.terrorist:d.spawnLook.police,
                yaw=labsSpawnYaw(side,pt[0],pt[1]),dx=look[0]-pt[0],dz=look[1]-pt[1];
            if((Math.sin(yaw)*dx+Math.cos(yaw)*dz)/Math.hypot(dx,dz)<.99)
              throw Error('BLOCK LABS spawn not facing inside');
            [-45,0,45].forEach(function(x){
              var pts=gPath(pt[0],pt[1],x,0);
              if(!pts||!pts.length)throw Error('BLOCK LABS missing tactical lane path '+pt+' -> '+x);
              labRoutes++;
            });
          });
        });
        if(Math.abs(pl.face-labsSpawnYaw(team,pl.x,pl.z))>.001)
          throw Error('BLOCK LABS player yaw does not match team inward view');
        mapChecks={solidLabBlocks:solids,realReactors:d.reactors.length,
          tacticalRoutes:labRoutes,perimeterCount:4,roof:true,playerYaw:pl.face};
      }
      BlockBuddiesQA.reset();
      return {map:mode===1?bombMapInfo(activeMap).name:tdmMapInfo(activeMap).name,mapChecks:mapChecks,bots:en.length,
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
        active:run,over:mt.over,bots:en.length,scores:ts.slice(),webgl:!!R.getContext(),
        round:bombMatch&&bombMatch.round,
        carrierSubstitutions:window.__m7CarrierSubstitutions||0,
        teams:[en.filter(e=>e.tm===0).length,en.filter(e=>e.tm===1).length]};
    }
  });
}
