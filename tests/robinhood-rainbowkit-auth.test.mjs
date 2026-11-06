import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSiweMessage } from 'viem/siwe';
import { createPointBlockClient } from '../src/network/pointblock-client.js';
import { GAME_WALLET_CHAIN, GAME_WALLET_CHAIN_ID } from '../src/wallet/robinhood-network.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const address='0x0000000000000000000000000000000000000001';
const key='A'.repeat(43);
const id='00000000-0000-4000-8000-000000000001';
const makeSiwe=(chainId=GAME_WALLET_CHAIN_ID)=>createSiweMessage({
  address,chainId,domain:'localhost:5173',uri:'http://localhost:5173',
  nonce:'abcdef1234567890',version:'1',issuedAt:new Date(),
  expirationTime:new Date(Date.now()+300000),
});
function setup({chainId=GAME_WALLET_CHAIN_ID,serverChainId=GAME_WALLET_CHAIN_ID}={}){
 const old={fetch:globalThis.fetch,location:globalThis.location,
  sessionStorage:globalThis.sessionStorage};
 const data=new Map(),calls=[],signed=[],published=[],updates=[];
 globalThis.location={origin:'http://localhost:5173',host:'localhost:5173'};
 globalThis.sessionStorage={
  getItem:k=>data.get(k)??null,
  setItem:(k,v)=>data.set(k,v),
  removeItem:k=>data.delete(k),
 };
 globalThis.fetch=async (url,opts)=>{
  const pathname=new URL(url).pathname;
  calls.push({pathname,method:opts.method,body:opts.body});
  let body;
  switch(pathname){
   case '/v1/auth/challenge':
    body={challengeId:id,chainId:serverChainId,message:makeSiwe(serverChainId)};
    break;
   case '/v1/auth/verify':body={token:key,registered:false};break;
   case '/v1/onboarding':body={chainId:GAME_WALLET_CHAIN_ID,registered:false};break;
   case '/v1/auth/logout':body={status:'signed_out'};break;
   default:throw Error('UNEXPECTED_API_'+pathname);
  }
  return {ok:true,status:200,json:async()=>body};
 };
 let current={ready:true,connected:true,address,chainId};
 const wallet={
  configured:true,
  connection:()=>current.connected&&current.chainId===GAME_WALLET_CHAIN_ID?
    {address:current.address,chainId:current.chainId}:null,
  waitReady:async()=>true,
  signMessage:async value=>{signed.push(value);return '0x'+'12'.repeat(65);},
  subscribe:fn=>{published.push(fn);fn(current);return()=>{};},
  updateSession:s=>updates.push(s),
 };
 const client=createPointBlockClient({baseUrl:'http://127.0.0.1:3001',wallet});
 const cleanup=()=>{globalThis.fetch=old.fetch;globalThis.location=old.location;
  globalThis.sessionStorage=old.sessionStorage;};
 return {client,wallet,calls,signed,data,updates,publish(next){current=next;published.forEach(fn=>fn(next));},cleanup};
}
test('RainbowKit only configures Robinhood Chain Mainnet with no injected-provider bypass',()=>{
 assert.equal(GAME_WALLET_CHAIN_ID,4663);
 assert.equal(GAME_WALLET_CHAIN.name,'Robinhood Chain');
 assert.equal(GAME_WALLET_CHAIN.nativeCurrency.symbol,'ETH');
 assert.equal(GAME_WALLET_CHAIN.rpcUrls.default.http[0],'https://rpc.mainnet.chain.robinhood.com');
 const client=read('src/network/pointblock-client.js');
 const widget=read('src/wallet/rainbowkit-root.jsx'),main=read('src/main.js');
 assert.doesNotMatch(client,/walletCandidates|globalThis\.ethereum|wallet_switchEthereumChain|bsc-network/i);
 assert.match(widget,/getDefaultConfig\(/);
 assert.match(widget,/chains:\[GAME_WALLET_CHAIN\]/);
 assert.match(widget,/RainbowKitProvider/);
 assert.match(widget,/ConnectButton\.Custom/);
 assert.match(widget,/getWalletClient\(/);
 assert.match(main,/wallet\.mount\(/);
 assert.match(main,/mountPointBlock\(THREE,/);
 assert.match(read('index.html'),/id="rainbowkitWalletRoot"/);
 assert.doesNotMatch(widget,/BSC|BNB Smart Chain/);
});

test('Robinhood SIWE signature uses canonical text and rejects wrong chains',async()=>{
 const mock=setup();
 try{
  const result=await mock.client.connectWallet();
  assert.equal(result.authenticated,true);
  assert.equal(result.registered,false);
  assert.equal(mock.signed.length,1);
  assert.equal(mock.signed[0].address,address);
  assert.equal(mock.signed[0].message.split('\n').some(x=>x==='Chain ID: 4663'),true);
  assert.deepEqual(mock.calls.map(x=>x.pathname),[
   '/v1/auth/challenge','/v1/auth/verify','/v1/onboarding']);
  assert.ok(Array.from(mock.data.keys()).some(k=>k.includes(':4663:')));
 }finally{mock.cleanup();}
 const wrong=setup({chainId:56});
 try{
  await assert.rejects(wrong.client.connectWallet(),e=>e?.code==='RAINBOWKIT_WALLET_NOT_CONNECTED');
  assert.equal(wrong.signed.length,0);
 }finally{wrong.cleanup();}
 const server=setup({serverChainId:56});
 try{
  await assert.rejects(server.client.connectWallet(),e=>e?.code==='INVALID_ROBINHOOD_SIWE_CHALLENGE');
  assert.equal(server.signed.length,0);
 }finally{server.cleanup();}
});
test('account switch/disconnect invalidates authenticated client and revokes server session',async()=>{
 const mock=setup();
 try{
  await mock.client.connectWallet();
  assert.equal(mock.client.state().authenticated,true);
  mock.publish({ready:true,connected:false,address:null,chainId:null});
  assert.equal(mock.client.state().authenticated,false);
  await Promise.resolve();
  assert.ok(mock.calls.some(x=>x.pathname==='/v1/auth/logout'));
  assert.equal(mock.data.size,0);
 }finally{mock.cleanup();}
});
test('same-tab restore rejects disconnected wallet even when bearer was previously saved',async()=>{
 const mock=setup();
 try{
  await mock.client.connectWallet();
  assert.equal(mock.data.size,1);
  const newWallet={...mock.wallet,connection:()=>null,subscribe:fn=>{fn({ready:true,connected:false,address:null,chainId:null});return()=>{};}};
  const resumed=createPointBlockClient({baseUrl:'http://127.0.0.1:3001',wallet:newWallet});
  const state=await resumed.restoreSession();
  assert.equal(state.authenticated,false);
  assert.equal(mock.data.size,0);
 }finally{mock.cleanup();}
});
