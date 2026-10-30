// Live mode-map video reuses the same WebGL canvas as the 3D lobby.
// Capture a center-cropped 2D frame at up to 30 FPS while SELECT MODE is open, on desktop and touch.
var mapPreviewCanvas=document.getElementById("mapPreviewCanvas"),
    mapPreviewCtx=mapPreviewCanvas.getContext("2d",{alpha:false}),
    mapPreviewSceneBomb=false,mapPreviewLastFrame=-1e9,mapPreviewFrameMs=1000/30;
function modePreviewSelect(i){
 if(!lob||run)return;
 var bomb=i===1;
 if(mapPreviewSceneBomb!==bomb){selectGameMap(bomb);mapPreviewSceneBomb=bomb;}
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
 if(inRoom||inLive){var c=document.getElementById(inLive?"rmlMapPreview":"roomMapPreview"),ctx=c.getContext("2d",{alpha:false});
   ctx.drawImage(src,(sw-ww)/2,(sh-hh)/2,ww,hh,0,0,c.width,c.height);
   if(inLive&&!document.getElementById("roomSettingsModal").hidden){
    var modalCanvas=document.getElementById("roomModalMapPreview"),modalCtx=modalCanvas.getContext("2d",{alpha:false});
    modalCtx.drawImage(src,(sw-ww)/2,(sh-hh)/2,ww,hh,0,0,modalCanvas.width,modalCanvas.height);
   }
 }
 // Only read WebGL pixels synchronously after this frame's R.render().
 if(inLive&&roomStartFlow.active&&roomStartFlow.phase==="loading")roomStartCaptureMap();
}
