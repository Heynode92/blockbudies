// Real 3D rank insignia (Three.js r128). This is VISUAL ONLY.
// rankIndex and rank label come exclusively from the authenticated BE profile.
// 17 designs: 5 early silver ranks, 3 Staff SGT, 4 Sergeant 1st Class,
// 5 Master SGT. No second rank-name table or client-side EXP policy.
var RANK_INSIGNIA_GROUPS=Object.freeze([5,3,4,5]);
function rankInsigniaSpec(index){
 if(!Number.isSafeInteger(index)||index<0)return null;
 var offset=index;
 for(var tier=0;tier<RANK_INSIGNIA_GROUPS.length;tier++){
  if(offset<RANK_INSIGNIA_GROUPS[tier])return {
   tier:tier,grade:offset+1,chevrons:tier===0?0:tier,index:index
  };
  offset-=RANK_INSIGNIA_GROUPS[tier];
 }
 return null;
}
var rankInsignia3D=null;
function rankInsigniaPolygon(points){
 var s=new T.Shape();s.moveTo(points[0][0],points[0][1]);
 for(var i=1;i<points.length;i++)s.lineTo(points[i][0],points[i][1]);
 s.closePath();return s;
}
function rankInsigniaExtrude(parent,shape,mat,z,depth){
 var m=new T.Mesh(new T.ExtrudeGeometry(shape,{
  depth:depth||.05,steps:1,bevelEnabled:true,bevelSegments:2,
  bevelSize:.014,bevelThickness:.014,curveSegments:5}),mat);
 m.position.z=z;parent.add(m);return m;
}
function rankInsigniaStrip(parent,x,y,w,h,z,mat){
 var m=new T.Mesh(new T.BoxGeometry(w,h,.055),mat);
 m.position.set(x,y,z);parent.add(m);return m;
}
function rankInsigniaChevron(parent,y,mat){
 return rankInsigniaExtrude(parent,rankInsigniaPolygon([
  [-.44,y+.09],[0,y-.17],[.44,y+.09],[.44,y+.20],
  [0,y-.055],[-.44,y+.20]
 ]),mat,.19,.055);
}
function rankInsigniaModel(index,view){
 var spec=rankInsigniaSpec(index);if(!spec)return;
 var M=view.materials,g=new T.Group(),s=new T.Shape(),r=.12;
 s.moveTo(-.51,-.84);s.lineTo(.51,-.84);
 s.quadraticCurveTo(.62,-.84,.62,-.73);s.lineTo(.62,.73);
 s.quadraticCurveTo(.62,.84,.51,.84);s.lineTo(-.51,.84);
 s.quadraticCurveTo(-.62,.84,-.62,.73);s.lineTo(-.62,-.73);
 s.quadraticCurveTo(-.62,-.84,-.51,-.84);s.closePath();
 rankInsigniaExtrude(g,s,M.rim,-.09,.13);
 var inset=new T.Mesh(new T.ShapeGeometry(s,5),
  spec.tier===0?M.slate:M.bronzePlate);
 inset.scale.set(.91,.95,1);inset.position.z=.082;g.add(inset);
 // Raised rim and four metal rivets: light reacts as the model rotates.
 rankInsigniaStrip(g,0,.70,.85,.027,.105,spec.tier?M.copper:M.silver);
 rankInsigniaStrip(g,0,-.69,.85,.027,.105,spec.tier?M.copper:M.silver);
 for(var x of [-.49,.49])for(var y of [-.73,.73]){
  var pin=new T.Mesh(new T.SphereGeometry(.030,8,6),M.silver);
  pin.scale.z=.45;pin.position.set(x,y,.13);g.add(pin);
 }
 if(spec.tier===0){
  if(spec.grade===1){
   // Official server rank index 0: carved metallic skull.
   var skull=new T.Shape();
   skull.moveTo(-.27,-.045);
   skull.bezierCurveTo(-.34,.09,-.31,.27,-.19,.36);
   skull.bezierCurveTo(-.07,.46,.07,.46,.19,.36);
   skull.bezierCurveTo(.31,.27,.34,.09,.27,-.045);
   skull.quadraticCurveTo(.24,-.17,.15,-.19);
   skull.lineTo(.15,-.34);
   skull.quadraticCurveTo(0,-.39,-.15,-.34);
   skull.lineTo(-.15,-.19);
   skull.quadraticCurveTo(-.24,-.17,-.27,-.045);
   skull.closePath();
   for(var eyeX of [-.12,.12]){
    var socket=new T.Path();
    socket.absellipse(eyeX,.11,.072,.085,0,Math.PI*2,true,0);
    skull.holes.push(socket);
   }
   var nose=new T.Path();
   nose.moveTo(0,-.025);nose.lineTo(-.045,-.115);
   nose.lineTo(.045,-.115);nose.closePath();skull.holes.push(nose);
   rankInsigniaExtrude(g,skull,M.silver,.19,.085);
   for(var tooth=-1.5;tooth<=1.5;tooth++)
    rankInsigniaStrip(g,tooth*.073,-.292,.046,.088,.318,M.highlight);
  }else{
   var bars=spec.grade-1;
   for(var i=0;i<bars;i++){
    var by=(bars-1)*.13-i*.26;
    rankInsigniaStrip(g,0,by,.76,.103,.19,M.silver);
    rankInsigniaStrip(g,0,by+.025,.63,.027,.229,M.highlight);
   }
  }
 }else{
  var top=spec.chevrons===3?.44:spec.chevrons===2?.31:.13;
  var metal=spec.tier===3?M.gold:spec.tier===2?M.silver:M.copper;
  for(var j=0;j<spec.chevrons;j++)rankInsigniaChevron(g,top-j*.29,metal);
  // Small raised grade-bars distinguish all 3 / 4 / 5 grades.
  var spacing=.145,span=(spec.grade-1)*spacing;
  for(var k=0;k<spec.grade;k++)
   rankInsigniaStrip(g,k*spacing-span/2,-.51,.095,.135,.19,metal);
  if(spec.tier===3){
   rankInsigniaExtrude(g,rankInsigniaPolygon([
    [0,.77],[.05,.68],[.17,.68],[.08,.60],[.11,.48],
    [0,.55],[-.11,.48],[-.08,.60],[-.17,.68],[-.05,.68]
   ]),M.gold,.20,.032);
  }
 }
 view.group.add(g);view.mesh=g;view.index=index;
}
function rankInsigniaRender(){
 var v=rankInsignia3D;
 if(!v||!v.mesh||v.canvas.hidden||document.hidden)return;
 v.group.rotation.set(.08+v.pitch,-.23+v.yaw,0);
 v.renderer.render(v.scene,v.camera);
}
function rankInsigniaClearMesh(v){
 if(!v.mesh)return;
 v.mesh.traverse(function(o){if(o.geometry)o.geometry.dispose();});
 v.group.remove(v.mesh);v.mesh=null;
}
function rankInsigniaDispose(){
 var v=rankInsignia3D;if(!v)return;
 rankInsigniaClearMesh(v);
 Object.keys(v.materials).forEach(function(key){v.materials[key].dispose();});
 v.renderer.dispose();rankInsignia3D=null;
}
function rankInsigniaInit(canvas){
 try{
  var renderer=new T.WebGLRenderer({
   canvas:canvas,alpha:true,antialias:true,powerPreference:'low-power'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.setSize(128,148,false);
  var scene=new T.Scene();
  var camera=new T.OrthographicCamera(-.91,.91,1.03,-1.03,.1,12);
  camera.position.set(0,0,5);
  scene.add(new T.AmbientLight(0xbdcfe4,.8));
  var key=new T.DirectionalLight(0xffefd8,1.5);
  key.position.set(-2,3,5);scene.add(key);
  var fill=new T.DirectionalLight(0x8bd2ff,.9);
  fill.position.set(3,-2,4);scene.add(fill);
  var m={
   rim:new T.MeshStandardMaterial({color:0x111727,metalness:.86,roughness:.25}),
   slate:new T.MeshStandardMaterial({color:0x252e40,metalness:.55,roughness:.35}),
   bronzePlate:new T.MeshStandardMaterial({color:0x34251f,metalness:.62,roughness:.3}),
   copper:new T.MeshStandardMaterial({color:0xc2906a,metalness:.78,roughness:.28}),
   silver:new T.MeshStandardMaterial({color:0xc8d2e0,metalness:.82,roughness:.22}),
   gold:new T.MeshStandardMaterial({color:0xf4c071,metalness:.82,roughness:.23}),
   highlight:new T.MeshStandardMaterial({color:0xf8f8ff,metalness:.68,roughness:.17})
  };
  var group=new T.Group();scene.add(group);
  var v={renderer:renderer,scene:scene,camera:camera,materials:m,
   group:group,mesh:null,index:null,canvas:canvas,
   yaw:0,pitch:0,drag:false,x:0,y:0,pending:false};
  rankInsignia3D=v;
  // Drag rotates actual 3D geometry, with no permanent render loop.
  canvas.addEventListener('pointerdown',function(e){
   if(rankInsignia3D!==v)return;
   v.drag=true;v.x=e.clientX;v.y=e.clientY;
   if(canvas.setPointerCapture)canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',function(e){
   if(rankInsignia3D!==v||!v.drag)return;
   v.yaw=Math.max(-.55,Math.min(.55,v.yaw+(e.clientX-v.x)*.012));
   v.pitch=Math.max(-.35,Math.min(.35,v.pitch+(e.clientY-v.y)*.01));
   v.x=e.clientX;v.y=e.clientY;
   if(v.pending)return;
   v.pending=true;requestAnimationFrame(function(){
    v.pending=false;if(rankInsignia3D===v)rankInsigniaRender();
   });
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(function(type){
   canvas.addEventListener(type,function(){v.drag=false;});
  });
  return v;
 }catch(e){
  console.warn('[PointBlock] 3D insignia GPU unavailable',e);
  return null;
 }
}
// One shared WebGL model/canvas moves between Lobby and online Results.
function rankInsigniaResultAttach(){
 var canvas=document.getElementById('roomRankCanvas');
 var mount=document.getElementById('resultsRankMount');
 if(canvas&&mount){
  if(canvas.parentElement!==mount)mount.appendChild(canvas);
  rankInsigniaRender();
 }
}
function rankInsigniaResultDetach(){
 var canvas=document.getElementById('roomRankCanvas');
 var host=document.getElementById('roomRankEmblem');
 if(canvas&&host&&canvas.parentElement!==host){
  host.appendChild(canvas);
  rankInsigniaRender();
 }
}
function rankInsigniaSet(index,serverRank){
 var canvas=document.getElementById('roomRankCanvas');
 if(!canvas)return;
 if(!rankInsigniaSpec(index)){
  rankInsigniaResultDetach();
  rankInsigniaDispose();canvas.hidden=true;
  canvas.removeAttribute('aria-label');return;
 }
 var view=rankInsignia3D||rankInsigniaInit(canvas);
 if(!view){canvas.hidden=true;return;}
 if(view.index!==index){
  rankInsigniaClearMesh(view);rankInsigniaModel(index,view);
  view.yaw=0;view.pitch=0;
 }
 canvas.hidden=false;
 canvas.setAttribute('aria-label','3D rank insignia: '+String(serverRank||'').slice(0,48));
 rankInsigniaRender();
}

// Source-authorized Three.js rank thumbnails, created from the SAME 3D models.
// Images are rendered locally from extruded meshes, not downloaded/static rank art.
var rankRosterPreviewCache=new Map();
function rankRosterPreview(index){
 if(!rankInsigniaSpec(index))return null;
 if(rankRosterPreviewCache.has(index))return rankRosterPreviewCache.get(index);
 var source=rankInsignia3D;
 if(!source){
  // TAB can be opened before the account badge has ever been mounted.
  // Initialize the SAME canonical rank model, never use static/fake art.
  var badgeCanvas=document.getElementById('roomRankCanvas');
  if(badgeCanvas)source=rankInsigniaInit(badgeCanvas);
 }
 if(!source)return null;
 var canvas=document.createElement('canvas');canvas.width=54;canvas.height=64;
 var renderer=null,view=null;
 try{
  renderer=new T.WebGLRenderer({canvas:canvas,alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
  renderer.setPixelRatio(1);renderer.setSize(54,64,false);
  var scene=new T.Scene(),camera=new T.OrthographicCamera(-.91,.91,1.03,-1.03,.1,12);
  camera.position.set(0,0,5);scene.add(new T.AmbientLight(0xbdcfe4,.8));
  var key=new T.DirectionalLight(0xffefd8,1.5);key.position.set(-2,3,5);scene.add(key);
  var fill=new T.DirectionalLight(0x8bd2ff,.9);fill.position.set(3,-2,4);scene.add(fill);
  var group=new T.Group();scene.add(group);
  view={materials:source.materials,group:group,mesh:null,index:null};
  rankInsigniaModel(index,view);group.rotation.set(.08,-.23,0);
  renderer.render(scene,camera);
  var preview=canvas.toDataURL('image/png');rankRosterPreviewCache.set(index,preview);
  return preview;
 }catch(error){console.warn('[PointBlock] Rank model preview unavailable',error);return null}
 finally{if(view)rankInsigniaClearMesh(view);if(renderer)renderer.dispose()}
}
// Metallic extruded 3D star for the virtual PBT balance. Drawn once.
var vpbtStarRenderer=null;
function vpbtStarInit(){
 var canvas=document.getElementById('homeVpbtStar');
 if(!canvas||vpbtStarRenderer)return;
 var renderer=null;
 try{
  renderer=new T.WebGLRenderer({canvas:canvas,alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.setSize(48,48,false);
  var scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.set(0,0,4);
  var shape=new T.Shape();
  for(var i=0;i<10;i++){
   var angle=-Math.PI/2+i*Math.PI/5,r=i%2===0?.72:.33,x=Math.cos(angle)*r,y=Math.sin(angle)*r;
   if(!i)shape.moveTo(x,y);else shape.lineTo(x,y);
  }shape.closePath();
  var geometry=new T.ExtrudeGeometry(shape,{depth:.19,steps:1,bevelEnabled:true,bevelSegments:3,bevelSize:.04,bevelThickness:.04});
  var material=new T.MeshStandardMaterial({color:0x68e9bf,metalness:.86,roughness:.18});
  var mesh=new T.Mesh(geometry,material);mesh.rotation.set(-.17,-.34,.12);mesh.position.z=-.1;scene.add(mesh);
  scene.add(new T.AmbientLight(0xb8fff0,.9));
  var key=new T.DirectionalLight(0xffffff,1.7);key.position.set(-2,3,5);scene.add(key);
  renderer.render(scene,camera);vpbtStarRenderer={renderer:renderer,geometry:geometry,material:material};
 }catch(error){
  if(renderer)renderer.dispose();
  canvas.hidden=true;var fallback=document.getElementById('homeVpbtStarFallback');
  if(fallback)fallback.hidden=false;
 }
}
vpbtStarInit();
