import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../src/game/82-home-showcase.js',import.meta.url),'utf8');
test('vPBT and rank are separate from future PBT and require actual authenticated player',()=>{
 assert.match(html,/id="homeVpbtBalance"/);
 assert.match(html,/id="homeProgressPanel"/);
 assert.match(html,/id="homePbtAdd"/);
 assert.match(js,/state\?\.authenticated&&state.registered\?state.player:null/);
 assert.match(js,/player\.nextRankHalfExp/);
});
test('wallet gate is a themed accessible SIWE dialog, not a bypass into private inventory',()=>{
 assert.match(html,/id="walletGateOverlay"/);
 assert.match(html,/role="dialog" aria-modal="true"/);
 assert.match(js,/function homeAuthGateOpen\(intent\)/);
 assert.match(js,/await homeWalletSignIn\(\)/);
 assert.match(js,/if\(target==='inventory'\)inventoryOpen\(\)/);
 assert.match(js,/if\(justSignedIn\)\{homeAuthGateOpen\(homeGateIntent\);return;\}/);
 assert.match(js,/homeAuthGateClose\(\);await onlineStartGate\(\);return/);
 assert.match(js,/state\.registered&&!state\.player\?\.id/);
});
test('half-unit formatter preserves server integer accuracy without decimal floating-point',()=>{
 const start=js.indexOf('function homeFormatHalf(');
 const end=js.indexOf('function homeProfileRender(',start);
 assert.ok(start>=0&&end>start);
 const ctx={BigInt,Number,String};
 runInNewContext(js.slice(start,end)+'\nthis.display=homeFormatHalf;',ctx);
 assert.equal(ctx.display('0'),'0');
 assert.equal(ctx.display('1'),'0.5');
 assert.equal(ctx.display('20000001'),'10,000,000.5');
 assert.equal(ctx.display('not-a-balance'),'—');
});
