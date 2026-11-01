// Client-side navigation for the existing single-index PointBlock game.
// HTTP(S) uses pathname routes; file:// uses hash routes because pathname cannot
// be changed to /loby without navigating away from the local HTML document.
// No API router or server rewrite is assumed by this module.
var APP_PANEL_ROUTES=Object.freeze({
 lbs:"/",lbrooms:"/loby",lbroomlive:"/loby/room/",lbiv:"/inventory",lbshop:"/shop"
});
var appRouteBooting=false,appRouteHashWritten=null;
function appRouteRoot(){
 if(location.protocol==="file:")return "";
 var p=location.pathname||"/";
 if(p.endsWith("/index.html"))return p.slice(0,-11);
 var tails=["/loby/room/","/loby/room","/loby","/inventory","/shop"];
 for(var i=0;i<tails.length;i++)if(p.endsWith(tails[i]))return p.slice(0,-tails[i].length);
 return p.endsWith("/")?p.slice(0,-1):"";
}
function appRouteRead(){
 var path=location.protocol==="file:"?(location.hash.slice(1)||"/"):
  (location.pathname.slice(appRouteRoot().length)||"/");
 if(path==="/loby")return "lbrooms";
 if(path==="/loby/room/"||path==="/loby/room")return "lbroomlive";
 if(path==="/inventory")return "lbiv";
 if(path==="/shop")return "lbshop";
 return "lbs";
}
function appRouteUpdate(panel,replace){
 if(appRouteBooting||!APP_PANEL_ROUTES[panel])return;
 var path=APP_PANEL_ROUTES[panel];
 if(location.protocol==="file:"){
  var hash=path==="/"?"":"#"+path;
  if(location.hash===hash)return;
  appRouteHashWritten=hash;
  if(replace&&history.replaceState){
   try{history.replaceState(null,"",location.pathname+location.search+hash);return;}catch(err){}
  }
  location.hash=hash;
 }else if(/^https?:$/.test(location.protocol)&&history.pushState){
  var target=appRouteRoot()+path+location.search;
  if(location.pathname+location.search===target)return;
  try{history[replace?"replaceState":"pushState"]({pointblock:true},"",target);}catch(err){}
 }
}
function appRouteRestore(){
 // Never let browser history silently abort a running match or its result report.
 if(!lob){
  appRouteUpdate("lbroomlive",true);
  return;
 }
 var panel=appRouteRead();
 appRouteBooting=true;
 try{
  if(panel==="lbrooms"){
   if(roomCurrent)roomCloseLocal();
   roomQuickFromBrowser=false;
   roomLobbyOpen();
  }else if(panel==="lbroomlive"){
   // A fresh document load has no selected in-memory room: fall back to Room List.
   if(roomCurrent)roomLobbyOpen();
   else{roomQuickFromBrowser=false;roomLobbyOpen();}
  }else if(panel==="lbiv"){
   roomQuickFromBrowser=false;inventoryOpen();
  }else if(panel==="lbshop"){
   roomQuickFromBrowser=false;shopOpen();
  }else{
   roomQuickFromBrowser=false;lobP("lbs");
  }
 }finally{appRouteBooting=false;}
 var active=document.querySelector("#lb>.lbp.on");
 if(active)appRouteUpdate(active.id,true);
}
addEventListener("popstate",appRouteRestore);
if(location.protocol==="file:")addEventListener("hashchange",function(){
 if(appRouteHashWritten===location.hash){appRouteHashWritten=null;return;}
 appRouteHashWritten=null;appRouteRestore();
});
// Defer the first route restoration until every ordered game module has initialized.
setTimeout(appRouteRestore,0);
