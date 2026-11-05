// Unified bullet impact resolution for bot and human targets.
// The armor/headshot rules are identical, independent of who fired.
function projectileHitCharacter(b,target,head,verifiedBodyGroup){
  if(typeof botQaEnabled!=='undefined'&&botQaEnabled)botQaHit(b);
  var damage=b.dmg*(b.fo?fall(b,b.m.position):1),source=b.by;
  if(head){
    if(target.helm){
      if(target===pl)popPl();else popHelm(target,b.vx,b.vz);
    }else damage=defenseHeadshotDamage(damage);
  }
  // The original collision decides head/body. Phase 2 only classifies
  // body contacts inside that existing collider; no new geometry here.
  var group=head?'chest':verifiedBodyGroup||defenseClassifyBodyHitgroup(b.m.position,{
    x:target.x,y:target.y||0,z:target.z,
    yaw:target===pl?target.face:target.g.rotation.y
  });
  curK=source;killW=b.wid>=0?b.wid:1;hsF=!!head;
  if(target===pl)hurt(damage,b.sx,b.sz,head?'head':'bullet-body',b.wid,group);
  else dmgE(target,damage,b.vx,b.vz,0,head?'head':'bullet-body',b.wid,group);
  hsF=false;
}
