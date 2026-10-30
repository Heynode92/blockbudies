// AI weapons share exactly the same WP profiles, ballistics, ammo and reload as players.
// Only accuracy and loadout selection are AI-specific, not bullet damage.
var BOT_WEAPONS=Object.freeze({
  primaries:[1,1,1,2,2,6,6,6,7,8],
  sidearm:0,knife:4,grenade:5,
  meleeRange:1.7,grenadeMinDistance:9,grenadeMaxDistance:18,grenadeChance:.035,
  grenadeCooldown:12,aimNoise:.055,noisePerUnit:.0045,
  safeRocketDistance:7
});
function botVisualWeapon(e,id){
  if(e.visualWeapon===id)return;
  var group=e.g&&e.g.userData&&e.g.userData.gun;
  if(group){
    var old=e.g.userData.rg;if(old)group.remove(old);
    var model=mkGun(id);model.rotation.y=Math.PI;model.scale.setScalar(1.2);
    model.position.set(.2,1.05,-.16);group.add(model);e.g.userData.rg=model;
    model.traverse(function(m){if(m.material&&e.ms)e.ms.push(m.material);});
  }
  e.visualWeapon=id;
}
function botInitialLoadout(e){
  var pool=BOT_WEAPONS.primaries,primary=pool[(Math.random()*pool.length)|0];
  e.primary=primary;e.weapon=primary;e.visualWeapon=-1;e.ammo={};
  [primary,BOT_WEAPONS.sidearm,BOT_WEAPONS.grenade].forEach(function(id){
    e.ammo[id]={mag:WP[id].mag,res:WP[id].res};
  });
  e.reloadId=null;e.reloadLeft=0;e.grenadeAt=0;
  botVisualWeapon(e,primary);
}
function botUpdateReload(e,dt){
  if(e.reloadId===null||e.reloadId===undefined)return;
  e.reloadLeft=Math.max(0,e.reloadLeft-dt);
  if(e.reloadLeft>0)return;
  var id=e.reloadId,a=e.ammo[id],w=WP[id];
  if(a){var n=Math.min(w.mag-a.mag,a.res);a.mag+=n;a.res-=n;}
  e.reloadId=null;
}
function botStartReload(e,id){
  var a=e.ammo[id],w=WP[id];if(!a||!w||a.mag>=w.mag||a.res<=0||e.reloadId!==null)return false;
  e.reloadId=id;e.reloadLeft=WP[id].rt;return true;
}
function botChooseWeapon(e,d){
  if(d<=BOT_WEAPONS.meleeRange)return BOT_WEAPONS.knife;
  var p=e.primary,primary=e.ammo[p],secondary=e.ammo[BOT_WEAPONS.sidearm];
  if(primary&&primary.mag>0&&e.reloadId!==p&&!(p===3&&d<BOT_WEAPONS.safeRocketDistance))return p;
  if(primary&&primary.res>0&&primary.mag<=0)botStartReload(e,p);
  if(secondary&&secondary.mag>0&&e.reloadId!==BOT_WEAPONS.sidearm)return BOT_WEAPONS.sidearm;
  if(secondary&&secondary.res>0&&secondary.mag<=0)botStartReload(e,BOT_WEAPONS.sidearm);
  return null;
}
function botThrowGrenade(e,face){
  var a=e.ammo[BOT_WEAPONS.grenade];if(!a||!a.mag||e.reloadId!==null)return false;
  a.mag--;e.grenadeAt=tt+BOT_WEAPONS.grenadeCooldown;
  var sp=16;grs.push({m:mkGren(),by:e,x:e.x+Math.sin(face)*.6,z:e.z+Math.cos(face)*.6,
    y:1.3+(e.y||0),vx:Math.sin(face)*sp,vz:Math.cos(face)*sp,vy:5.5,t:1.7});
  if(a.mag===0)botStartReload(e,BOT_WEAPONS.grenade);
  return true;
}
function botAttack(e,target,face,d){
  var id=botChooseWeapon(e,d);
  if(id===null||e.reloadId===id)return false;
  var w=WP[id];
  if(id!==BOT_WEAPONS.knife&&d>w.range)return false;
  if(id===BOT_WEAPONS.knife){
    if(!clearTo(e.x,e.z,target.x,target.z,0))return false;
    curK=e;killW=id;hsF=false;
    if(target===pl)hurt(w.dmg,e.x,e.z,'melee');
    else dmgE(target,w.dmg,Math.sin(face),Math.cos(face),0,'melee');
  }else{
    var ammo=e.ammo[id];if(!ammo||ammo.mag<=0)return false;
    ammo.mag--;
    var inaccuracy=(Math.random()-.5)*2*(BOT_WEAPONS.aimNoise+d*BOT_WEAPONS.noisePerUnit);
    fire(e,face+inaccuracy,w,'e',0);
  }
  e.weapon=id;botVisualWeapon(e,id);e.cd=w.cd;e.rc=1;e.vis=1.6;
  return true;
}
function botNeedsMelee(e){var a=e.ammo||{},p=a[e.primary],s=a[BOT_WEAPONS.sidearm];return (!p||p.mag+p.res===0)&&(!s||s.mag+s.res===0);}
function botCombatTick(e,target,face,d){
  if(!target||target.dead||(e.smartRetreat&&d>8))return;
  if(d>=BOT_WEAPONS.grenadeMinDistance&&d<=BOT_WEAPONS.grenadeMaxDistance&&
     tt>=e.grenadeAt&&e.ammo&&e.ammo[5]&&e.ammo[5].mag>0&&
     Math.random()<BOT_WEAPONS.grenadeChance&&botSmartGrenadeSafe(e,target)&&clearTo(e.x,e.z,target.x,target.z,0)){
    if(botThrowGrenade(e,face))return;
  }
  botAttack(e,target,face,d);
}
