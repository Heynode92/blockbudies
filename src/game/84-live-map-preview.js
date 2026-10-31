// Live mode-map video reuses the same WebGL canvas as the 3D lobby.
// Capture a center-cropped 2D frame at up to 30 FPS while SELECT MODE is open, on desktop and touch.
var mapPreviewCanvas=document.getElementById("mapPreviewCanvas"),
    mapPreviewCtx=mapPreviewCanvas.getContext("2d",{alpha:false}),
    mapPreviewSceneBomb=false,mapPreviewMapId="lockdown",mapPreviewTdmId="block-district",mapPreviewLastFrame=-1e9,mapPreviewFrameMs=1000/30;
function modePreviewSelect(i){
 if(!lob||run)return;
 var bomb=i===1;
 if(mapPreviewSceneBomb!==bomb||bomb&&mapPreviewMapId!==selectedBombMapId||!bomb&&mapPreviewTdmId!==selectedTdmMapId){selectGameMap(bomb);mapPreviewSceneBomb=bomb;mapPreviewMapId=selectedBombMapId;mapPreviewTdmId=selectedTdmMapId;}
 mapPreviewLastFrame=-1e9;
 mapPreviewCtx.clearRect(0,0,mapPreviewCanvas.width,mapPreviewCanvas.height);
}
function modePreviewDraw(now){
 if(!lob||run||document.hidden||selM===2)return;
 var inMode=document.getElementById("lbm").classList.contains("on"),
     inRoom=document.getElementById("lbrooms").classList.contains("on"),
     inLive=document.getElementById("lbroomlive").classList.contains("on");
 if(!inMode&&!inRoom&&!inLive)return;
 if(now-mapPreviewLastFrame<mapPreviewFrameMs)return;
 var src=R.domElement,sw=src.width,sh=src.height,dw=mapPreviewCanvas.width,dh=mapPreviewCanvas.height;
 if(!sw||!sh)return;
 mapPreviewLastFrame=now;
 var ratio=dw/dh,ww=Math.min(sw,sh*ratio),hh=Math.min(sh,sw/ratio);
 if(inMode)mapPreviewCtx.drawImage(src,(sw-ww)/2,(sh-hh)/2,ww,hh,0,0,dw,dh);
 // The Create Room overlay uses the SAME animated WebGL map rendered above.
 // Avoid 2D readback when it is hidden; the background 3D map still animates.
 if(inRoom&&!document.getElementById("roomCreateOverlay").hidden){
  var createCanvas=document.getElementById("roomMapPreview"),
      createCtx=createCanvas.getContext("2d",{alpha:false});
  createCtx.drawImage(src,(sw-ww)/2,(sh-hh)/2,ww,hh,0,0,createCanvas.width,createCanvas.height);
  roomMapCardFrame(createCanvas);
  // Warm one inactive map thumbnail per preview frame using the SAME Three.js
  // renderer; selected live map pixels and the normal canvas are restored.
  if(typeof roomMapCapturePendingPreview==="function"&&
     typeof R.clear==="function"&&typeof R.render==="function"){
   roomMapCapturePendingPreview();
  }
 }
 if(inLive){
  var c=document.getElementById("rmlMapPreview"),ctx=c.getContext("2d",{alpha:false});
  ctx.drawImage(src,(sw-ww)/2,(sh-hh)/2,ww,hh,0,0,c.width,c.height);
  if(!document.getElementById("roomSettingsModal").hidden){
   var modalCanvas=document.getElementById("roomModalMapPreview"),
       modalCtx=modalCanvas.getContext("2d",{alpha:false});
   modalCtx.drawImage(src,(sw-ww)/2,(sh-hh)/2,ww,hh,0,0,modalCanvas.width,modalCanvas.height);
  }
 }
 // Only read WebGL pixels synchronously after this frame's R.render().
 if(inLive&&roomStartFlow.active&&roomStartFlow.phase==="loading")roomStartCaptureMap();
}
