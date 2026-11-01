// Hold TAB to inspect the real 5v5 scoreboard; release to close.
// This overlay is presentation-only. It never modifies combat stats or game time.
var matchScoreboard=document.getElementById("matchScoreboard");
var matchScoreboardHeld=false,matchScoreboardInterval=0;
function matchScoreboardAllowed(){
  return !!run&&!lob&&!mt.over&&!document.hidden&&
    !(roomStartFlow&&roomStartFlow.active)&&
    !document.body.classList.contains("game-menu-open")&&
    document.getElementById("dv").classList.contains("show")===false;
}
function matchScoreboardTeamData(team){
  // ROS contains the authoritative per-player K/D objects, including pl.st.
  var players=ROS.filter(function(s){return s.tm===team;}).slice();
  players.sort(function(a,b){
    return b.k-a.k||a.d-b.d||String(a.name).localeCompare(String(b.name));
  });
  return {
    players:players,
    kills:players.reduce(function(n,s){return n+s.k;},0),
    deaths:players.reduce(function(n,s){return n+s.d;},0)
  };
}
function matchScoreboardCreateCell(tag,className,value){
  var element=document.createElement(tag);
  element.className=className;
  element.textContent=String(value);
  return element;
}
function matchScoreboardRenderTeam(team){
  var data=matchScoreboardTeamData(team),
      prefix=team===0?"Police":"Terrorist",
      rows=document.getElementById("matchScoreboard"+prefix+"Rows");
  var fragment=document.createDocumentFragment();
  data.players.forEach(function(stat,index){
    var row=document.createElement("div"),name=document.createElement("span");
    row.className="match-sb-row"+(stat===pl.st?" is-you":"");
    name.className="match-sb-name";
    name.appendChild(matchScoreboardCreateCell("span","match-sb-name-text",stat.name));
    if(stat===pl.st)name.appendChild(matchScoreboardCreateCell("span","match-sb-you","YOU"));
    row.appendChild(matchScoreboardCreateCell("span","match-sb-rank",index+1));
    row.appendChild(name);
    row.appendChild(matchScoreboardCreateCell("strong","match-sb-kills",stat.k));
    row.appendChild(matchScoreboardCreateCell("strong","match-sb-deaths",stat.d));
    fragment.appendChild(row);
  });
  rows.replaceChildren(fragment);
  document.getElementById("matchScoreboard"+prefix+"Score").textContent=String(ts[team]);
  document.getElementById("matchScoreboard"+prefix+"Kills").textContent=String(data.kills);
  document.getElementById("matchScoreboard"+prefix+"Deaths").textContent=String(data.deaths);
}
function matchScoreboardRender(){
  if(!matchScoreboardHeld)return;
  if(!matchScoreboardAllowed()){matchScoreboardDismiss();return;}
  matchScoreboardRenderTeam(0);
  matchScoreboardRenderTeam(1);
}
function matchScoreboardShow(){
  if(matchScoreboardHeld||!matchScoreboardAllowed())return;
  matchScoreboardHeld=true;
  matchScoreboard.hidden=false;
  matchScoreboard.setAttribute("aria-hidden","false");
  matchScoreboardRender();
  // Keep K/D live while held without rebuilding every animation frame.
  matchScoreboardInterval=setInterval(matchScoreboardRender,180);
}
function matchScoreboardDismiss(){
  matchScoreboardHeld=false;
  if(matchScoreboardInterval){clearInterval(matchScoreboardInterval);matchScoreboardInterval=0;}
  matchScoreboard.hidden=true;
  matchScoreboard.setAttribute("aria-hidden","true");
}
addEventListener("keydown",function(event){
  if(event.code==="Escape"&&matchScoreboardHeld){matchScoreboardDismiss();return;}
  if(event.code!=="Tab")return;
  if(matchScoreboardAllowed()){
    event.preventDefault(); // Tab must not shift focus out of locked FPS controls.
    matchScoreboardShow();
  }else if(matchScoreboardHeld)matchScoreboardDismiss();
});
addEventListener("keyup",function(event){
  if(event.code!=="Tab")return;
  if(matchScoreboardHeld){event.preventDefault();matchScoreboardDismiss();}
});
addEventListener("blur",matchScoreboardDismiss);
document.addEventListener("visibilitychange",function(){if(document.hidden)matchScoreboardDismiss();});
