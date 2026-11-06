import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ConnectButton, RainbowKitProvider, darkTheme, getDefaultConfig } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, http, useAccount } from 'wagmi';
import { getAccount, getWalletClient } from 'wagmi/actions';
import { GAME_WALLET_CHAIN, GAME_WALLET_CHAIN_ID } from './robinhood-network.js';

const queryClient = new QueryClient({defaultOptions:{queries:{retry:1,refetchOnWindowFocus:false}}});
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const invalid=(code)=>Object.assign(new Error(code),{code});

// A React-only wallet island. Three.js, gameplay and navigation are NOT React
// and the wallet address alone is NEVER a PointBlock authenticated session.
export function createPointBlockRainbowWallet({projectId,rpcUrl}={}){
 const id=typeof projectId==='string'?projectId.trim():'';
 const rpc=typeof rpcUrl==='string'?rpcUrl.trim():'';
 if(rpc){
  const url=new URL(rpc);
  if(url.protocol!=='https:'&&!(import.meta.env.DEV&&url.protocol==='http:'&&
    ['localhost','127.0.0.1'].includes(url.hostname)))throw invalid('INVALID_ROBINHOOD_RPC_URL');
  if(url.username||url.password||url.hash||url.search)throw invalid('INVALID_ROBINHOOD_RPC_URL');
 }
 // Never generate, guess or commit a WalletConnect Cloud project ID.
 const config=id?getDefaultConfig({
  appName:'PointBlock',
  projectId:id,
  chains:[GAME_WALLET_CHAIN],
  transports:{[GAME_WALLET_CHAIN_ID]:rpc?http(rpc):http()},
  ssr:false
 }):null;
 const listeners=new Set();
 let snapshot={ready:false,connected:false,address:null,chainId:null};
 let session={authenticated:false,address:null};
 let modals=null,redraw=()=>{};
 const publish=next=>{
  const changed=Object.keys(snapshot).some(key=>snapshot[key]!==next[key]);
  snapshot=next;
  if(changed)for(const fn of listeners)fn({...snapshot});
 };
 const api={
  chain:GAME_WALLET_CHAIN,
  configured:Boolean(config),
  state:()=>({...snapshot}),
  subscribe(fn){listeners.add(fn);fn({...snapshot});return()=>listeners.delete(fn);},
  connection(){
   if(!config)return null;
   const a=getAccount(config);
   if(!a.isConnected||!a.address||a.chainId!==GAME_WALLET_CHAIN_ID)return null;
   return {address:a.address,chainId:a.chainId};
  },
  waitReady(timeoutMs=7000){
   if(!config)return Promise.resolve(false);
   if(snapshot.ready)return Promise.resolve(true);
   return new Promise(resolve=>{
    let finished=false;
    const unsubscribe=api.subscribe(next=>{
     if(next.ready&&!finished){finished=true;clearTimeout(timer);unsubscribe();resolve(true);}
    });
    const timer=setTimeout(()=>{
     if(!finished){finished=true;unsubscribe();resolve(false);}
    },timeoutMs);
   });
  },
  openConnect(){if(!modals?.openConnectModal)return false;modals.openConnectModal();return true;},
  openNetwork(){if(!modals?.openChainModal)return false;modals.openChainModal();return true;},
  async signMessage({address,message}){
   const connected=api.connection();
   if(!connected||!same(connected.address,address))throw invalid('WALLET_CHANGED');
   if(typeof message!=='string'||message.length>4096)throw invalid('INVALID_SIWE_MESSAGE');
   const client=await getWalletClient(config,{chainId:GAME_WALLET_CHAIN_ID});
   if(!client?.account||!same(client.account.address,address)||
      client.chain?.id!==GAME_WALLET_CHAIN_ID)throw invalid('WALLET_CHANGED');
   return client.signMessage({account:client.account,message});
  },
  updateSession(value){session={authenticated:value?.authenticated===true,address:value?.address??null};redraw();},
  mount(element,onSignIn){
   if(!element)throw new Error('RAINBOWKIT_ROOT_MISSING');
   const root=createRoot(element);
   if(!config){
    root.render(<span className="pb-rainbow-unconfigured" role="status">
     WALLETCONNECT PROJECT ID REQUIRED
    </span>);
    return;
   }
   function WalletButton({modal}){
    const a=useAccount(),[busy,setBusy]=useState(false),[err,setErr]=useState('');
    const [,setVersion]=useState(0);
    useEffect(()=>{redraw=()=>setVersion(n=>n+1);return()=>{redraw=()=>{};};},[]);
    useEffect(()=>{
     modals={openConnectModal:modal.openConnectModal,openChainModal:modal.openChainModal};
     return()=>{modals=null;};
    },[modal.openConnectModal,modal.openChainModal]);
    useEffect(()=>{
     publish({ready:a.status!=='connecting'&&a.status!=='reconnecting',
      connected:a.isConnected,address:a.address??null,chainId:a.chainId??null});
    },[a.status,a.isConnected,a.address,a.chainId]);
    const authenticated=a.isConnected&&session.authenticated&&same(session.address,a.address);
    const wrongChain=a.isConnected&&a.chainId!==GAME_WALLET_CHAIN_ID;
    const label=!a.isConnected?'CONNECT WALLET':wrongChain?'SWITCH TO ROBINHOOD CHAIN':
      authenticated?a.address.slice(0,6)+'…'+a.address.slice(-4):
      busy?'SIGNING IN…':'SIGN IN';
    async function activate(){
     setErr('');
     if(!a.isConnected){modal.openConnectModal?.();return;}
     if(wrongChain){modal.openChainModal?.();return;}
     if(authenticated){modal.openAccountModal?.();return;}
     if(busy)return;
     setBusy(true);
     try{await onSignIn();}catch(e){setErr(String(e?.code||e?.message||'SIGN_IN_FAILED').slice(0,90));}
     finally{setBusy(false);}
    }
    return <div className="pb-rainbow-wallet">
      <button id="homeWalletConnect" type="button" className={authenticated?'connected':''}
        disabled={busy||!snapshot.ready} onClick={activate}
        aria-label={authenticated?'Authenticated Robinhood Chain wallet':'RainbowKit Robinhood Chain wallet connect and SIWE sign in'}>
        <span id="homeWalletLabel">{label}</span>
      </button>
      {err?<span className="pb-rainbow-error" role="status">{err.replaceAll('_',' ')}</span>:null}
    </div>;
   }
   root.render(<WagmiProvider config={config}><QueryClientProvider client={queryClient}>
     <RainbowKitProvider theme={darkTheme({accentColor:'#f59d45',accentColorForeground:'#111827'})}
       modalSize="compact" showRecentTransactions={false}>
       <ConnectButton.Custom>
         {modal=><WalletButton modal={modal}/>}
       </ConnectButton.Custom>
     </RainbowKitProvider>
   </QueryClientProvider></WagmiProvider>);
  },
 };
 return Object.freeze(api);
}
