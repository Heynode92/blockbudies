import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const source=read('src/game/81-rank-insignia.js');
const home=read('src/game/82-home-showcase.js'),html=read('index.html');
const styles=read('src/styles/18-room-lobby-redesign.css');
const report=read('src/game/70-kills-and-damage-hud.js');
const bridge=read('src/game/98-online-bridge.js');
const manifest=JSON.parse(read('tools/source-manifest.json'));
test('All 17 authorised rank indices have distinct mesh specifications',()=>{
 const scoped=source.slice(0,source.indexOf('var rankInsignia3D=null;'));
 assert.ok(scoped.length>0);
 const env={Number,Object};
 runInNewContext(scoped+'\nthis.spec=rankInsigniaSpec;',env);
 const all=Array.from({length:17},(_,i)=>env.spec(i));
 assert.ok(all.every(Boolean));
 assert.deepEqual(all.map(s=>s.tier),[
  0,0,0,0,0,1,1,1,2,2,2,2,3,3,3,3,3]);
 assert.deepEqual(all.map(s=>s.grade),[
  1,2,3,4,5,1,2,3,1,2,3,4,1,2,3,4,5]);
 assert.equal(new Set(all.map(s=>s.tier+'-'+s.grade)).size,17);
 for(const invalid of [-1,17,100,null,'3',NaN,1.5])
  assert.equal(env.spec(invalid),null);
});
test('Real Three.js relief meshes, metallic lighting and drag, not static badge art',()=>{
 for(const p of ['ExtrudeGeometry','MeshStandardMaterial','WebGLRenderer',
  'BoxGeometry','Shape','Path','OrthographicCamera','DirectionalLight'])
  assert.ok(source.includes('T.'+p),p);
 assert.match(source,/powerPreference:'low-power'/);
 assert.match(source,/rankInsigniaDispose\(\)/);
 assert.match(source,/rankInsigniaModel\(index,view\)/);
 assert.doesNotMatch(source,/\.png|\.jpg|fetch\(|localStorage|setInterval\(/);
});
test('Only server rankIndex selects a rank; unauthenticated user loses badge',()=>{
 assert.match(home,/rankInsigniaSet\(player\.rankIndex,player\.rank\)/);
 assert.match(home,/rankInsigniaSet\(null,null\)/);
 assert.match(html,/id="roomRankCanvas"/);
 assert.match(html,/id="roomRankEmblem"/);
 assert.match(styles,/#lbrooms \.room-rank-insignia canvas\[hidden\]/);
 assert.ok(manifest.parts.indexOf('src/game/81-rank-insignia.js')<
  manifest.parts.indexOf('src/game/82-home-showcase.js'));
 for(const id of ['homeRankExp','homeRankName','homeRankCallsign'])
  assert.ok(html.includes('id="'+id+'"'));
 assert.doesNotMatch(source,/currentRankHalfExp|nextRankHalfExp|Master SGT Grade/);
});
test('Canonical legacy bundle includes actual rank model before home profile hook',()=>{
 const bundle=read('assets/game.js');
 const i=bundle.indexOf(source);
 assert.ok(i>0);
 assert.ok(bundle.indexOf(home,i)>i);
});

test('Verified roster rank models reuse the canonical 3D insignia generator',()=>{
 const bridge=read('src/game/98-online-bridge.js');
 const css=read('src/styles/04-lobby.css');
 assert.match(bridge,/rankRosterPreview\(member\.rankIndex\)/);
 assert.match(bridge,/rankIndex:Number\.isSafeInteger\(m\.rankIndex\)/);
 assert.match(source,/function rankRosterPreview\(index\)/);
 assert.match(source,/rankInsigniaModel\(index,view\)/);
 assert.match(css,/#lbroomlive \.rml-rank-3d/);
});
test('vPBT uses its uploaded PNG with the same 1:1 responsive dimensions as PBT',()=>{
 const css=read('src/styles/13-home-header.css');
 const onlineCss=read('src/styles/17-online.css');
 assert.ok(html.includes('src="./src/assets/icon/vPBT-logo.png"'));
 assert.ok(html.includes('src="./src/assets/icon/pb-logo.png"'));
 assert.equal((html.match(/class="home-token-coin/g)||[]).length,2);
 assert.match(css,/#gameLobbyHeader \.home-token-coin/);
 assert.match(css,/width:25px;height:25px;aspect-ratio:1 \/ 1/);
 assert.match(css,/\.home-token-coin \{ width:22px;height:22px/);
 assert.doesNotMatch(html,/homeVpbtStar|homeVpbtStarFallback/);
 assert.doesNotMatch(source,/vpbtStarInit|vpbtStarRenderer/);
 assert.doesNotMatch(onlineCss,/home-vpbt-icon|homeVpbtStarFallback/);
 assert.ok(readFileSync(new URL('../src/assets/icon/vPBT-logo.png',import.meta.url)).length>0);
});
test('Training completion and timeout use server-verified Results before registration',()=>{
 const bridge=read('src/game/98-online-bridge.js');
 assert.match(html,/id="trainingResult"/);
 assert.match(html,/id="trainingResultKills"/);
 assert.match(bridge,/onlineTrainingFinished\(frame\.progress\)/);
 assert.match(bridge,/function onlineDisplayTrainingResult\(progress\)/);
 assert.match(bridge,/function onlineTrainingResultContinue\(\)/);
 assert.match(bridge,/progress\.status==='COMPLETED'/);
 assert.match(bridge,/TIMEOUT_POLICY_PENDING/);
});
test('Daily room create 429 modal uses server-provided resetAt and existing dialog',()=>{
 const bridge=read('src/game/98-online-bridge.js');
 const client=read('src/network/pointblock-client.js');
 assert.match(bridge,/error\?\.code==='ROOM_DAILY_CREATE_LIMIT'/);
 assert.match(bridge,/error\.resetAt/);
 assert.match(bridge,/onlineRoomDialog\('DAILY ROOM LIMIT REACHED'/);
 assert.match(client,/this\.resetAt/);
 assert.match(client,/res\.status,data\)/);
});
