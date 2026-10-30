// Transient, animated blood pools on the ground under fallen characters.
// Uses shared procedural geometry, capped and recycled mesh groups: no permanent decals.
var BLOOD_POOL_RULES=Object.freeze({max:24,playerLifetime:4.6,playerFadeStart:3.3,corpseFadeStart:1.5,corpseFadeTime:.6}),
 bloodPoolLive=[],bloodPoolFree=[];
function bloodPoolShape(points){
 var shape=new T.Shape();
 for(var i=0;i<points.length;i++){
  var a=i*Math.PI*2/points.length,x=Math.cos(a)*points[i],y=Math.sin(a)*points[i];
  if(!i)shape.moveTo(x,y);else shape.lineTo(x,y);
 }
 shape.closePath();return new T.ShapeGeometry(shape);
}
var bloodPoolMainGeometry=bloodPoolShape([.91,.82,1.05,.93,.79,1.08,.9,1.02,.84,.98,.87,1.06,.83,.94,1.11,.89,.99,.8]),
 bloodPoolFlowShape=new T.Shape();
bloodPoolFlowShape.moveTo(.34,-.12);bloodPoolFlowShape.lineTo(.56,-.09);
bloodPoolFlowShape.lineTo(.76,-.14);bloodPoolFlowShape.lineTo(.94,-.11);
bloodPoolFlowShape.lineTo(1.12,-.19);bloodPoolFlowShape.lineTo(1.36,-.16);
bloodPoolFlowShape.lineTo(1.49,-.12);bloodPoolFlowShape.lineTo(1.53,-.07);
bloodPoolFlowShape.lineTo(1.33,-.05);bloodPoolFlowShape.lineTo(1.18,-.08);
bloodPoolFlowShape.lineTo(.95,-.035);bloodPoolFlowShape.lineTo(.76,.005);
bloodPoolFlowShape.lineTo(.5,-.01);bloodPoolFlowShape.closePath();
var bloodPoolFlowGeometry=new T.ShapeGeometry(bloodPoolFlowShape);
function bloodPoolMake(){
 var baseMat=new T.MeshBasicMaterial({color:0x75121c,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}),
  flowMat=new T.MeshBasicMaterial({color:0x9a1c26,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}),
  group=new T.Group(),base=new T.Mesh(bloodPoolMainGeometry,baseMat),flows=[];
 base.renderOrder=2;group.add(base);
 for(var i=0;i<3;i++){
  var m=new T.Mesh(bloodPoolFlowGeometry,flowMat);
  m.rotation.z=i*Math.PI*2/3+(i===1?.34:-.19);
  m.renderOrder=3;group.add(m);flows.push(m);
 }
 group.rotation.x=-Math.PI/2;group.visible=false;
 return{g:group,base:base,flows:flows,baseMat:baseMat,flowMat:flowMat,age:0,corpse:null};
}
function bloodPoolSpawn(x,y,z,corpse){
 if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z)||bloodPoolLive.length>=BLOOD_POOL_RULES.max)return null;
 var p=bloodPoolFree.pop()||bloodPoolMake();
 p.age=0;p.corpse=corpse||null;p.x=x;p.y=y;p.z=z;
 p.g.position.set(x,(corpse?y:gh(x,z,y))+.035,z);
 p.g.rotation.z=Math.random()*Math.PI*2;
 p.g.visible=false;p.baseMat.opacity=0;p.flowMat.opacity=0;
 bloodPoolLive.push(p);S.add(p.g);return p;
}
function bloodPoolRemove(p){
 if(!p)return;
 var i=bloodPoolLive.indexOf(p);if(i<0)return;
 bloodPoolLive.splice(i,1);S.remove(p.g);p.g.visible=false;
 p.corpse=null;p.baseMat.opacity=0;p.flowMat.opacity=0;
 bloodPoolFree.push(p);
}
function bloodPoolClear(){
 while(bloodPoolLive.length)bloodPoolRemove(bloodPoolLive[bloodPoolLive.length-1]);
}
function bloodPoolUpdate(dt){
 for(var i=bloodPoolLive.length-1;i>=0;i--){
  var p=bloodPoolLive[i],c=p.corpse,fade=1;
  if(c){
   p.g.position.set(c.x,(c.by===undefined?p.y:c.by)+.035,c.z);
   if(!c.land){p.g.visible=false;continue;}
   fade=Math.max(0,Math.min(1,1-Math.max(0,(c.w||0)-BLOOD_POOL_RULES.corpseFadeStart)/BLOOD_POOL_RULES.corpseFadeTime));
  }else{
   fade=Math.max(0,Math.min(1,(BLOOD_POOL_RULES.playerLifetime-p.age)/(BLOOD_POOL_RULES.playerLifetime-BLOOD_POOL_RULES.playerFadeStart)));
  }
  p.age+=dt;
  if(!c&&p.age>=BLOOD_POOL_RULES.playerLifetime){bloodPoolRemove(p);continue;}
  var grow=Math.min(1,p.age/1.4),smooth=grow*grow*(3-2*grow),emerge=Math.min(1,p.age/.3),a=fade*emerge;
  p.g.visible=a>.005;
  p.base.scale.set(.12+1.0*smooth,.09+.78*smooth,1);
  for(var j=0;j<p.flows.length;j++){
   var extra=Math.max(0,Math.min(1,(p.age-.2-j*.16)/1.15)),g=extra*extra*(3-2*extra);
   p.flows[j].scale.set(.05+(j===0?1.08:.78)*g,.18+.75*g,1);
  }
  p.baseMat.opacity=.74*a;p.flowMat.opacity=.64*a;
 }
}
