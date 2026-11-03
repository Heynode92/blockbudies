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
