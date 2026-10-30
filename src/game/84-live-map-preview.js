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
 if(!lob||run||document.hidden||selM===2||!document.getElementById("lbm").classList.contains("on"))return;
 if(now-mapPreviewLastFrame<mapPreviewFrameMs)return;
 var src=R.domElement,sw=src.width,sh=src.height,dw=mapPreviewCanvas.width,dh=mapPreviewCanvas.height;
 if(!sw||!sh)return;
 mapPreviewLastFrame=now;
 var ratio=dw/dh,ww=Math.min(sw,sh*ratio),hh=Math.min(sh,sw/ratio);
 mapPreviewCtx.drawImage(src,(sw-ww)/2,(sh-hh)/2,ww,hh,0,0,dw,dh);
}
