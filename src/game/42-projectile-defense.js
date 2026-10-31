// Unified bullet impact resolution for bot and human targets.
// The armor/headshot rules are identical, independent of who fired.
function projectileHitCharacter(b,target,head){
  if(typeof botQaEnabled!=='undefined'&&botQaEnabled)botQaHit(b);
  var damage=b.dmg*(b.fo?fall(b,b.m.position):1),source=b.by;
  if(head){
    if(target.helm){
      if(target===pl)popPl();else popHelm(target,b.vx,b.vz);
    }else damage=defenseHeadshotDamage(damage);
  }
  curK=source;killW=b.wid>=0?b.wid:1;hsF=!!head;
  if(target===pl)hurt(damage,b.sx,b.sz,head?'head':'bullet-body');
  else dmgE(target,damage,b.vx,b.vz,0,head?'head':'bullet-body');
  hsF=false;
}
