// ---- INPUT ----
// keys = pressed KeyboardEvent.code map, mouse = {down,right}, ST = touch sticks, fireHeld/jumpHeld = touch buttons.
// input
var fireHeld=false,jumpHeld=false,keys={},mouse={x:innerWidth/2,y:0,down:false,right:false},ST={l:{x:0,y:0,on:false},r:{x:0,y:0,on:false}};
addEventListener("keydown",function(e){if(e.code==="Space")e.preventDefault();keys[e.code]=true;if(mt.over&&e.code==="Enter"&&document.getElementById("dv").classList.contains("show")){again();return;}if(e.code==="KeyR"&&!(isBombMode()&&pl.bAction))reload();if(e.code==="KeyV")toggleDual();if(run&&!pl.dead){var dm=/^(Digit|Numpad)([1-5])$/.exec(e.code);if(dm){if(mt.cd>0&&!mt.over)chooseWeapon(WSEL[+dm[2]-1]);else if(+dm[2]<=4)swSlot(+dm[2]-1);}}});
document.getElementById("rl").addEventListener("pointerdown",function(e){e.stopPropagation();reload();});
(function(){var jb=document.getElementById("jb");jb.addEventListener("pointerdown",function(e){e.stopPropagation();jb.setPointerCapture(e.pointerId);jumpHeld=true;});["pointerup","pointercancel"].forEach(function(t){jb.addEventListener(t,function(){jumpHeld=false;});});var b=document.getElementById("fb");b.addEventListener("pointerdown",function(e){e.stopPropagation();b.setPointerCapture(e.pointerId);fireHeld=true;});["pointerup","pointercancel"].forEach(function(t){b.addEventListener(t,function(){fireHeld=false;});});})();addEventListener("keyup",function(e){keys[e.code]=false;});
R.domElement.addEventListener("pointermove",function(e){if(e.pointerType==="mouse"){mouse.down=!!(e.buttons&1);mouse.right=!!(e.buttons&2);lookMove(e);}});
R.domElement.addEventListener("pointerdown",function(e){if(e.pointerType==="mouse"){lookStartDrag(e);if(e.button===2){mouse.right=true;e.preventDefault();if(run&&!pl.dead&&pl.w===8&&mt.cd<=0&&!mt.over)scopeOn=!scopeOn;}else if(e.button===0)mouse.down=true;if(run&&!pl.dead&&!document.pointerLockElement&&R.domElement.requestPointerLock){try{R.domElement.requestPointerLock();}catch(x){}}}});
addEventListener("pointerup",function(e){if(e.pointerType==="mouse"){mouse.down=!!(e.buttons&1);mouse.right=!!(e.buttons&2);if(!mouse.down)lookStopDrag();}});addEventListener("blur",function(){mouse.right=false;mouse.down=false;keys={};lookStopDrag();});
document.addEventListener("pointerlockchange",lookLockChanged);
R.domElement.addEventListener("contextmenu",function(e){e.preventDefault();});
// stick(): wires up a touch joystick element and stores its x/y in state st.
function stick(el,st){var kn=el.firstChild,id=null;
  function mv(e){var r=el.getBoundingClientRect(),dx=e.clientX-(r.left+60),dy=e.clientY-(r.top+60),l=Math.hypot(dx,dy),m=45;if(l>m){dx*=m/l;dy*=m/l;}
    kn.style.transform="translate("+dx+"px,"+dy+"px)";st.x=dx/m;st.y=dy/m;st.on=true;}
  el.addEventListener("pointerdown",function(e){id=e.pointerId;el.setPointerCapture(id);mv(e);});
  el.addEventListener("pointermove",function(e){if(e.pointerId===id)mv(e);});
  function end(e){if(e.pointerId===id){id=null;st.x=st.y=0;st.on=false;kn.style.transform="";}}
  el.addEventListener("pointerup",end);el.addEventListener("pointercancel",end);}
stick(document.getElementById("stl"),ST.l);stick(document.getElementById("str"),ST.r);
// Raycaster/plane helpers for converting screen touches to world positions.
var ray=new T.Raycaster(),plane=new T.Plane(new T.Vector3(0,1,0),-1),tv=new T.Vector3(),v2=new T.Vector2();
