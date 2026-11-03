import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('index.html'),code=read('src/game/98-online-bridge.js'),
 combat=read('src/game/45-combat.js');
test('EXP and vPBT appear as distinct server-verified tiles in existing offline results',()=>{
 assert.match(html,/id="verifiedExpAmount"/);
 assert.match(html,/id="verifiedVpbtAmount"/);
 assert.match(html,/id="verifiedRewardRetry"/);
 assert.match(code,/onlineApi\.award\(matchId\)/);
 assert.match(code,/homeFormatHalf\(value\?\.awardedExpHalf\)/);
 assert.match(code,/homeFormatHalf\(value\?\.awardedVpbtHalf\)/);
 assert.match(code,/void onlineApi\.refreshProfile\(\)/);
 assert.doesNotMatch(code,/function onlineShowMatchReport\(/);
});
test('tapered original tracer is thinner and uses BE cosmetic projectile speed only',()=>{
 assert.match(combat,/T\.CylinderGeometry\(\.28,1,1,8\)/);
 assert.match(combat,/r=rk\?\.1:\.009/);
 assert.match(code,/frame\.projectileSpeed/);
 assert.match(code,/t:duration/);
 assert.doesNotMatch(code,/function onlineShotTracer\(frame\)[\s\S]{0,900}(?:hurt|damage|dmgE)\(/);
});
