import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createPointBlockClient} from '../src/network/pointblock-client.js';
import {GAME_WALLET_CHAIN_ID} from '../src/wallet/bsc-network.js';

const address='0x'+'a'.repeat(40),token='s'.repeat(43);
const baseUrl='http://127.0.0.1:3001';
const storageKey='pointblock:siwe-session:'+GAME_WALLET_CHAIN_ID+':'+new URL(baseUrl).origin+new URL(baseUrl).pathname;
const storedSession=()=>JSON.stringify({token,address,chainId:GAME_WALLET_CHAIN_ID});
const wallet=(connectedAddress=address,connectedChain=GAME_WALLET_CHAIN_ID)=>({
 configured:true,waitReady:async()=>true,
 connection:()=>connectedAddress?{address:connectedAddress,chainId:connectedChain}:null,
 subscribe:fn=>{fn({ready:true,connected:Boolean(connectedAddress),address:connectedAddress,chainId:connectedChain});return()=>{};},
 updateSession(){}
});
function storage(){
 const m=new Map();
 return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),
  removeItem:k=>m.delete(k)};
}
async function withMocks(t,handler){
 const previousFetch=globalThis.fetch,previousStorage=globalThis.sessionStorage;
 globalThis.sessionStorage=storage();
 globalThis.fetch=handler;
 t.after(()=>{globalThis.fetch=previousFetch;globalThis.sessionStorage=previousStorage});
}
test('SIWE restore revalidates server membership and preserves authenticated account after reload',async t=>{
 let count=0;
 await withMocks(t,async input=>{
  count++;const path=new URL(input).pathname;
  if(path==='/v1/onboarding')return new Response(JSON.stringify({registered:true}),{status:200});
  if(path==='/v1/me')return new Response(JSON.stringify({id:'player-id'}),{status:200});
  return new Response(JSON.stringify({code:'NOT_FOUND'}),{status:404});
 });
 sessionStorage.setItem(storageKey,storedSession());
 const client=createPointBlockClient({baseUrl,wallet:wallet()});
 assert.equal(client.state().authenticated,false);
 const restored=await client.restoreSession();
 assert.equal(restored.authenticated,true);
 assert.equal(restored.registered,true);
 assert.equal(restored.player.id,'player-id');
 assert.equal(count,2);
 await client.restoreSession();
 assert.equal(count,2,'validated session should not issue needless reauthorization calls');
});
test('expired or revoked SIWE clears tab storage and blocks protected routes',async t=>{
 await withMocks(t,async()=>new Response(JSON.stringify({code:'SESSION_EXPIRED'}),{status:401}));
 sessionStorage.setItem(storageKey,storedSession());
 const client=createPointBlockClient({baseUrl,wallet:wallet()});
 const restored=await client.restoreSession();
 assert.equal(restored.authenticated,false);
 assert.equal(sessionStorage.getItem(storageKey),null);
});
test('stored session for a different wallet or BSC testnet never becomes authenticated',async t=>{
 await withMocks(t,async()=>{throw Error('Wrong-wallet bearer cannot reach backend');});
 sessionStorage.setItem(storageKey,storedSession());
 const wrongAddress=createPointBlockClient({baseUrl,wallet:wallet('0x'+'b'.repeat(40))});
 assert.equal((await wrongAddress.restoreSession()).authenticated,false);
 assert.equal(sessionStorage.getItem(storageKey),null);
 sessionStorage.setItem(storageKey,storedSession());
 const wrongChain=createPointBlockClient({baseUrl,wallet:wallet(address,97)});
 assert.equal((await wrongChain.restoreSession()).authenticated,false);
 assert.equal(sessionStorage.getItem(storageKey),null);
});

test('malformed SIWE token cannot bypass server checks by restoring UI state',async t=>{
 let calls=0;
 await withMocks(t,async()=>{calls++;throw Error('Must not call backend')});
 sessionStorage.setItem(storageKey,JSON.stringify({token:'invalid',address}));
 const client=createPointBlockClient({baseUrl,wallet:wallet()});
 assert.equal((await client.restoreSession()).authenticated,false);
 assert.equal(calls,0);
});
test('frontend routes and room restoration are scoped to registered server accounts',async()=>{
 const {readFileSync}=await import('node:fs');
 const nav=readFileSync(new URL('../src/game/85-navigation-routes.js',import.meta.url),'utf8');
 const bridge=readFileSync(new URL('../src/game/98-online-bridge.js',import.meta.url),'utf8');
 assert.match(nav,/!state\.registered/);
 assert.match(nav,/!appRouteBootReady/);
 assert.match(bridge,/await onlineApi\.currentRoom\(\)/);
 assert.match(bridge,/await onlineApi\.restoreSession\(\)/);
 assert.match(bridge,/matchExitToLobby\('room'\)/);
 assert.match(bridge,/endMatch\(\);/);
});
