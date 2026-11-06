// Client-side navigation for the existing single-index PointBlock game.
// HTTP(S) uses pathname routes; file:// uses hash routes because pathname cannot
// be changed to /loby without navigating away from the local HTML document.
// No API router or server rewrite is assumed by this module.
var APP_PANEL_ROUTES=Object.freeze({
 lbs:"/",lbrooms:"/loby",lbroomlive:"/loby/room/",lbiv:"/inventory",lbshop:"/shop",lbearn:"/earn",lbboard:"/leaderboard"
});
var appRouteBooting=false,appRouteHashWritten=null,appRouteBootReady=false;
function appRouteRoot(){
 if(location.protocol==="file:")return "";
 var p=location.pathname||"/";
 if(p.endsWith("/index.html"))return p.slice(0,-11);
 var tails=["/loby/room/","/loby/room","/loby","/inventory","/shop","/earn","/leaderboard"];
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
 if(path==="/earn")return "lbearn";
 if(path==="/leaderboard")return "lbboard";
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
 // Wait for verified SIWE session/room recovery before rendering protected URLs.
 if(!appRouteBootReady)return;
 // Never let browser history silently abort a running match or its result report.
 if(!lob){
  appRouteUpdate("lbroomlive",true);
  return;
 }
 var panel=appRouteRead();
 var state=typeof onlineApi!=='undefined'&&onlineApi?.state?.();
 if(panel!=='lbs'&&panel!=='lbshop'&&panel!=='lbearn'&&panel!=='lbboard'&&(!state?.authenticated||!state.registered)){
  // Home, Shop, Earn and Leaderboard are public. Match/lobby and Inventory require verified SIWE
  // and a registered player. A directly opened private URL is never a bypass.
  var requested=panel;
  appRouteUpdate('lbs',true);panel='lbs';
  if(requested==='lbiv'&&typeof homeAuthGateOpen==='function')
   setTimeout(function(){homeAuthGateOpen('inventory');},0);
 }
 appRouteBooting=true;
 try{
  if(panel==="lbrooms"||panel==="lbroomlive"){
   roomQuickFromBrowser=false;
   // A DB-owned room wins over any stale route; only explicit leave may
   // discard the player's membership. A fresh tab recovers it at boot.
   roomLobbyOpen();
  }else if(panel==="lbiv"){
   roomQuickFromBrowser=false;inventoryOpen();
  }else if(panel==="lbshop"){
   roomQuickFromBrowser=false;shopOpen();
  }else if(panel==="lbearn"){
   roomQuickFromBrowser=false;earnOpen();
  }else if(panel==="lbboard"){
   roomQuickFromBrowser=false;leaderboardOpen();
  }else{
   roomQuickFromBrowser=false;lobP("lbs");
  }
 }finally{
  appRouteBooting=false;
  document.documentElement.classList.remove("pb-route-restoring");
 }
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
