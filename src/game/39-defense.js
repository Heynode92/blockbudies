// Permanent passive firearm body defense. Online authority: BE defense.ts.
// All combat percentages are centralized here and mirrored by the BE contract.
var COMBAT_SYNC_REVISION='pointblock-combat-sync-2026-11-05-p6';
var DEFENSE_RULES=Object.freeze({
 revision:'pointblock-defense-2026-11-05-p1',
 maxHp:100,bodyReduction:.30,pumpShotgunBodyReduction:.20,headshotMultiplier:3
});
// Explosion damage is range-scaled for BOTs, players and the server alike.
// No passive bullet-body VEST modifier applies to this damage kind.
var EXPLOSION_DAMAGE_RULES=Object.freeze({radius:4.2,edgeReduction:.8});
function defenseExplosionDamage(raw,distance){
 if(!Number.isFinite(raw)||raw<0||!Number.isFinite(distance)||distance<0)
  throw new RangeError('Invalid explosion damage/distance');
 return distance>=EXPLOSION_DAMAGE_RULES.radius?0:
  Math.ceil(raw*(1-distance/EXPLOSION_DAMAGE_RULES.radius*EXPLOSION_DAMAGE_RULES.edgeReduction));
}
// Body-zone geometry mirrors the BE hitgroup.ts and the existing blocky model.
// This classifies a contact within the OLD cylinder, not a new limb collider.
var HITGROUP_RULES=Object.freeze({
 revision:'pointblock-hitgroup-2026-11-05-p2',
 multipliers:Object.freeze({chest:1,stomach:1.25,arm:1,leg:.75}),
 zones:Object.freeze({legsTop:.58,stomachTop:1.0,armBottom:.58,armSide:.40})
});
function defenseClassifyBodyHitgroup(point,pose){
 if(![point.x,point.y,point.z,pose.x,pose.y,pose.z,pose.yaw].every(Number.isFinite))
  throw new RangeError('Non-finite body impact pose');
 var h=point.y-pose.y,zone=HITGROUP_RULES.zones;
 if(h<zone.legsTop)return 'leg';
 var dx=point.x-pose.x,dz=point.z-pose.z;
 var right=dx*Math.cos(pose.yaw)-dz*Math.sin(pose.yaw);
 if(h>=zone.armBottom&&Math.abs(right)>=zone.armSide)return 'arm';
 return h<zone.stomachTop?'stomach':'chest';
}
function defenseHitgroupMultiplier(group){
 if(!Object.prototype.hasOwnProperty.call(HITGROUP_RULES.multipliers,group))
  throw new RangeError('Invalid body hitgroup');
 return HITGROUP_RULES.multipliers[group];
}
function defenseSpawn(actor){actor.hp=DEFENSE_RULES.maxHp;actor.helm=true;}
function defenseBodyReductionForWeapon(weaponId){
 // No BOT/player branch. Use the canonical registered weapon class and pump flag.
 var profile=Number.isSafeInteger(weaponId)?WEAPON_PROFILES[weaponId]:null;
 return profile&&profile.kind==='shotgun'&&profile.pump===true?
  DEFENSE_RULES.pumpShotgunBodyReduction:DEFENSE_RULES.bodyReduction;
}
function defenseDamage(actor,raw,kind,weaponId,hitgroup){
 var damage=Math.max(0,Number.isFinite(raw)?raw:0);
 // Distance is already applied by projectileHitCharacter(). No rounding
 // between hitgroup and permanent defense, including each shotgun pellet.
 return kind==='bullet-body'?
  damage*defenseHitgroupMultiplier(hitgroup||'chest')*(1-defenseBodyReductionForWeapon(weaponId)):damage;
}
// Helmet absorbs the first headshot bonus; unhelmeted headshots retain 3x.
function defenseHeadshotDamage(base){return base*DEFENSE_RULES.headshotMultiplier;}

// Server-authoritative, pose-aware character hit volumes (Phase 3).
// Derived from the authored Third-Person meshes in FE src/game/30-characters.js:
// head .6 cube at y=1.65; chest/vest ~.86x.8x.56; shoulders +/- .55
// with two-bone .4/.46 arms; paired legs pivot at +/- .2,y=.55.
// Recoil/weapon geometry is NOT a collision volume. FE mirror is
// CHARACTER_HITBOX_RULES + sweptCharacterHit in src/game/39-defense.js.
// No client-supplied hit result, pose, or collider can reach this function.

var CHARACTER_HITBOX_RULES = Object.freeze({
  revision:'pointblock-hitbox-2026-11-05-p3',
  // The head target is deliberately INSIDE the visible .6x.6x.6 head mesh.
  // Helmet cosmetics are not a headshot volume.
  head:Object.freeze({centerY:1.65,halfX:.25,halfY:.26,halfZ:.25}),
  chest:Object.freeze({centerY:1.15,halfX:.43,halfY:.20,halfZ:.28}),
  stomach:Object.freeze({centerY:.75,halfX:.43,halfY:.20,halfZ:.28}),
  crouchDrop:.4, // matches authoritative crouched 3P muzzle offset
  bobMax:.07,walkPhasePerUnit:2.4,legSwing:.8,paceAtSpeed:2.2,
  shoulderX:.55,shoulderY:1.3,upperArmLength:.4,forearmLength:.46,
  upperArmRadius:.155,forearmRadius:.145,
  legX:.2,legPivotY:.55,legLength:.49,legRadius:.175,
  // Grip points are measured from 30-characters.js aimArms(), both arms.
  rightHand:Object.freeze({x:.05,y:.85,z:.24}),
  leftHand:Object.freeze({x:.05,y:.98,z:.5}),
});

function chhbDot(a,b){return a.x*b.x+a.y*b.y+a.z*b.z;}
function chhbSub(a,b){return ({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});}
function chhbPlus(a,b){return ({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});}
function chhbMul(a,f){return ({x:a.x*f,y:a.y*f,z:a.z*f});}
function chhbNorm(a){const l=Math.hypot(a.x,a.y,a.z);return l<1e-12?{x:0,y:-1,z:0}:chhbMul(a,1/l);}
function chhbBox(a,b,c,hx,hy,hz) {
  const d=chhbSub(b,a);
  let lo=0,hi=1;
  for(const axis of ['x','y','z']) {
    const v=a[axis]-c[axis],speed=d[axis],half=axis==='x'?hx:axis==='y'?hy:hz;
    if(Math.abs(speed)<1e-12){if(v < -half || v > half)return null;continue}
    const p=(-half-v)/speed,q=(half-v)/speed;
    lo=Math.max(lo,Math.min(p,q));hi=Math.min(hi,Math.max(p,q));
    if(lo>hi)return null;
  }
  return lo<=1&&hi>=0?Math.max(0,lo):null;
}
function chhbSphere(a,d,c,r) {
  const v=chhbSub(a,c),A=chhbDot(d,d),B=chhbDot(v,d),C=chhbDot(v,v)-r*r;
  if(C<=0)return 0;
  if(A<1e-12)return null;
  const disc=B*B-A*C;
  if(disc<0)return null;
  const t=(-B-Math.sqrt(disc))/A;
  return t>=0&&t<=1?t:null;
}
function chhbCapsule(a,b,start,end,r) {
  const d=chhbSub(b,a),ba=chhbSub(end,start),oa=chhbSub(a,start),len2=chhbDot(ba,ba);
  if(len2<1e-12)return chhbSphere(a,d,start,r);
  const baba=len2,bard=chhbDot(ba,d),baoa=chhbDot(ba,oa);
  const A=baba*chhbDot(d,d)-bard*bard;
  const B=baba*chhbDot(oa,d)-baoa*bard;
  const C=baba*chhbDot(oa,oa)-baoa*baoa-r*r*baba;
  let found=null;
  if(C<=0 && baoa>=0 && baoa<=baba)found=0;
  if(A>1e-12) {
    const discriminant=B*B-A*C;
    if(discriminant>=0) {
      const root=Math.sqrt(discriminant);
      for(const t of [(-B-root)/A,(-B+root)/A]) {
        const axial=baoa+t*bard;
        if(t>=0&&t<=1&&axial>=0&&axial<=baba&&(found===null||t<found))found=t;
      }
    }
  }
  for(const cap of [start,end]) {
    const t=chhbSphere(a,d,cap,r);
    if(t!==null&&(found===null||t<found))found=t;
  }
  return found;
}
function chhbArmElbow(shoulder,hand,side) {
  // Same two-bone IK geometry as FE aimA() (no client skeletal transforms).
  const r=CHARACTER_HITBOX_RULES,L1=r.upperArmLength,L2=r.forearmLength;
  const diff=chhbSub(hand,shoulder),len=Math.hypot(diff.x,diff.y,diff.z);
  const distance=Math.max(.2,Math.min(L1+L2-.01,len));
  const direction=chhbNorm(diff);
  const ca=(L1*L1+distance*distance-L2*L2)/(2*L1*distance);
  const sa=Math.sqrt(Math.max(0,1-ca*ca));
  const plane={x:side*.7,y:-1,z:-.1};
  const bend=chhbNorm(chhbSub(plane,chhbMul(direction,chhbDot(plane,direction))));
  return chhbPlus(shoulder,chhbMul(chhbPlus(chhbMul(direction,ca),chhbMul(bend,sa)),L1));
}
// Earliest contact across actual limb/torso/head volumes; wall occlusion is
// still resolved by headless-match.ts BEFORE accepting this intersection.
function sweptCharacterHit(from,to,actor) {
  const yaw=actor.yaw??0,phase=actor.gaitPhase??0,pace=Math.max(0,Math.min(1,actor.gaitPace??0));
  if(![from.x,from.y,from.z,to.x,to.y,to.z,actor.x,actor.y,actor.z,yaw,phase,pace].every(Number.isFinite))
    throw new RangeError('Invalid trusted character hitbox pose');
  const cos=Math.cos(yaw),sin=Math.sin(yaw),bodyDrop=actor.crouch?CHARACTER_HITBOX_RULES.crouchDrop:0;
  const worldLocal=(p)=>{const dx=p.x-actor.x,dz=p.z-actor.z;return{
    x:dx*cos-dz*sin,y:p.y-actor.y,z:dx*sin+dz*cos}};
  const a=worldLocal(from),b=worldLocal(to),rule=CHARACTER_HITBOX_RULES;
  const bob=Math.abs(Math.sin(phase))*rule.bobMax*pace;
  let first=null,group='chest';
  const register=(t,g)=>{
    if(t!==null&&(first===null||t<first-1e-10)){first=t;group=g}
  };
  // Separate head box: shots above the shoulders but outside this narrow
  // visible-head volume MISS; old 'all y>=1.38 is headshot' is gone.
  register(chhbBox(a,b,{x:0,y:rule.head.centerY-bodyDrop+bob,z:0},
    rule.head.halfX,rule.head.halfY,rule.head.halfZ),'head');
  for(const g of ['chest','stomach']) {
    const zone=rule[g];
    register(chhbBox(a,b,{x:0,y:zone.centerY-bodyDrop+bob,z:0},
      zone.halfX,zone.halfY,zone.halfZ),g);
  }
  for(const side of [-1,1]) {
    const shoulder={x:side*rule.shoulderX,y:rule.shoulderY-bodyDrop+bob,z:0};
    const goal=side===1?rule.rightHand:rule.leftHand;
    const hand={x:goal.x,y:goal.y-bodyDrop+bob,z:goal.z};
    const elbow=chhbArmElbow(shoulder,hand,side);
    register(chhbCapsule(a,b,shoulder,elbow,rule.upperArmRadius),'arm');
    register(chhbCapsule(a,b,elbow,hand,rule.forearmRadius),'arm');
    const swing=Math.sin(phase)*rule.legSwing*pace*(side===-1?1:-1);
    const hip={x:side*rule.legX,y:rule.legPivotY+bob,z:0};
    const foot={x:hip.x,y:hip.y-rule.legLength*Math.cos(swing),z:-rule.legLength*Math.sin(swing)};
    register(chhbCapsule(a,b,hip,foot,rule.legRadius),'leg');
  }
  if(first===null)return null;
  const delta=chhbSub(to,from);
  return {fraction:first,headshot:group==='head',hitgroup:group,point:chhbPlus(from,chhbMul(delta,first))};
}
