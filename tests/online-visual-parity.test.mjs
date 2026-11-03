import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const online=read('src/game/98-online-bridge.js');
const offline=read('src/game/85-lobby-and-match.js');
test('online star rehydration calls original offline star renderer without celebration',()=>{
 assert.match(offline,/function starKill\(silent\)/);
 assert.match(online,/starKill\(true\)/);
 assert.doesNotMatch(online,/star\.innerHTML=STAR/);
});
test('canonical offline toast, impact, and kill feed lifecycles also run online',()=>{
 assert.match(online,/if\(toastT>0&&\(toastT-=dt\)<=0\)/);
 assert.match(online,/effect\.m\.material\.opacity=Math\.max\(0,\.7-effect\.t\*\.7\)/);
 assert.match(online,/kFeed\(killer,Number\.isInteger\(event\.weaponId\)/);
});
