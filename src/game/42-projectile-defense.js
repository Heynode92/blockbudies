// Unified bullet impact resolution for bot and human targets.
// The armor/headshot rules are identical, independent of who fired.
function projectileHitCharacter(b,target,head,verifiedBodyGroup){
  if(typeof botQaEnabled!=='undefined'&&botQaEnabled)botQaHit(b);
  // Phase-3 actual swept contact is the source of truth; do not permit a
  // stale height-only bool to transform a verified torso hit into a headshot.
  if(verifiedBodyGroup!==undefined){
    if(!['head','chest','stomach','arm','leg'].includes(verifiedBodyGroup))
      throw new RangeError('Invalid verified offline impact hitgroup');
    head=verifiedBodyGroup==='head';
  }
  var damage=b.dmg*(b.fo?fall(b,b.m.position):1),source=b.by;
  if(head){
    if(target.helm){
      if(target===pl)popPl();else popHelm(target,b.vx,b.vz);
    }else damage=defenseHeadshotDamage(damage);
  }
  // Phase 3 collider already selects a true body group. The old Phase 2
  // approximate classifier is fallback ONLY for legacy callers/tests.
  var group=head?'chest':verifiedBodyGroup||defenseClassifyBodyHitgroup(b.m.position,{
    x:target.x,y:target.y||0,z:target.z,
    yaw:target===pl?target.face:target.g.rotation.y
  });
  curK=source;killW=b.wid>=0?b.wid:1;hsF=!!head;
  if(target===pl)hurt(damage,b.sx,b.sz,head?'head':'bullet-body',b.wid,group);
  else dmgE(target,damage,b.vx,b.vz,0,head?'head':'bullet-body',b.wid,group);
  hsF=false;
}
