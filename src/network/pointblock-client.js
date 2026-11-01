// PointBlock online transport. The only trust boundary for accounts, room state,
// ownership and live authoritative gameplay is the matching backend API.
// Do not store wallet private keys, pretend that a connected wallet is SIWE
// authenticated, or accept client-generated hit/kill/reward claims.
const CHAIN_ID = 4663;
const CHAIN_HEX = '0x1237';
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_WS_MESSAGE = 262144;
const AUTH_TIMEOUT_MS = 9000;

export class PointBlockError extends Error {
  constructor(code, status = 0) { super(code); this.name = 'PointBlockError'; this.code = code; this.status = status; }
}
function apiRoot(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = new URL(value);
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password ||
        parsed.search || parsed.hash || (parsed.protocol === 'http:' &&
          !['localhost','127.0.0.1','[::1]'].includes(parsed.hostname))) return null;
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    return parsed;
  } catch { return null; }
}
function timeoutFetch(url, options, ms = 12000) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), ms);
  return fetch(url, { ...options, signal: abort.signal }).finally(() => clearTimeout(timer));
}
function checkedId(value) {
  if (typeof value !== 'string' || !UUID.test(value)) throw new PointBlockError('INVALID_SERVER_RESOURCE_ID');
  return value;
}
function wsPath(root, path) {
  const url = new URL(root);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = url.pathname.replace(/\/+$/,'') + path;
  url.search = '';url.hash = '';
  return url.toString();
}
function walletCandidates() {
  const providers = [];
  if (Array.isArray(globalThis.ethereum?.providers)) providers.push(...globalThis.ethereum.providers);
  else if (globalThis.ethereum) providers.push(globalThis.ethereum);
  return providers.filter(p => p && typeof p.request === 'function');
}
export function createPointBlockClient({ baseUrl } = {}) {
  const root = apiRoot(baseUrl);
  let auth = null, provider = null, channel = null, onChange = () => {};
  let socketEpoch = 0;
  const state = () => ({
    configured: Boolean(root), authenticated: Boolean(auth),
    address: auth?.address ?? null, registered: Boolean(auth?.registered),
    player: auth?.player ?? null, onboarding: auth?.onboarding ?? null,
    live: channel?.kind ?? null, connected: channel?.socket?.readyState === 1,
  });
  const change = () => { try { onChange(state()); } catch (err) { console.error('[PointBlock] UI state subscriber failed', err); } };
  async function request(path, { method = 'GET', body, authRequired = true } = {}) {
    if (!root) throw new PointBlockError('BACKEND_URL_NOT_CONFIGURED');
    if (authRequired && !auth?.token) throw new PointBlockError('SIWE_LOGIN_REQUIRED', 401);
    if (typeof path !== 'string' || !path.startsWith('/v1/')) throw new PointBlockError('UNSAFE_API_PATH');
    const headers = { Accept:'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (authRequired) headers.Authorization = 'Bearer ' + auth.token;
    let res;
    try { res = await timeoutFetch(new URL(root.pathname.replace(/\/+$/,'') + path,root.origin),{
      method, headers, cache:'no-store', credentials:'omit',
      ...(body === undefined ? {} : { body:JSON.stringify(body) }),
    }); }
    catch { throw new PointBlockError('BACKEND_UNREACHABLE'); }
    let data;
    try { data = await res.json(); } catch { throw new PointBlockError('INVALID_BACKEND_RESPONSE',res.status); }
    if (!res.ok) {
      if (res.status === 401 && authRequired) { auth = null; closeLive(); change(); }
      throw new PointBlockError(typeof data?.code === 'string' ? data.code : 'BACKEND_REQUEST_FAILED',res.status);
    }
    return data;
  }
  async function connectWallet() {
    if (!root) throw new PointBlockError('BACKEND_URL_NOT_CONFIGURED');
    if (auth) return state();
    // EIP-1193 only; wallet transaction submission and arbitrary RPC are not exposed.
    provider = walletCandidates()[0] ?? null;
    if (!provider) throw new PointBlockError('WALLET_PROVIDER_NOT_FOUND');
    const accounts = await provider.request({ method:'eth_requestAccounts' });
    const address = Array.isArray(accounts) ? accounts[0] : null;
    if (!ADDRESS.test(address ?? '')) throw new PointBlockError('INVALID_WALLET_ADDRESS');
    const chain = await provider.request({ method:'eth_chainId' });
    if (Number.parseInt(String(chain),16) !== CHAIN_ID) {
      try { await provider.request({ method:'wallet_switchEthereumChain',params:[{chainId:CHAIN_HEX}]}); }
      catch { throw new PointBlockError('ROBINHOOD_MAINNET_REQUIRED'); }
    }
    if (Number.parseInt(String(await provider.request({method:'eth_chainId'})),16)!==CHAIN_ID)
      throw new PointBlockError('WRONG_WALLET_CHAIN');
    const challenge = await request('/v1/auth/challenge',{method:'POST',body:{address},authRequired:false});
    if (!UUID.test(challenge?.challengeId) || typeof challenge?.message !== 'string' ||
      challenge.message.length>4096) throw new PointBlockError('INVALID_SIWE_CHALLENGE');
    const hexMessage = '0x'+Array.from(new TextEncoder().encode(challenge.message),v=>v.toString(16).padStart(2,'0')).join('');
    const signature = await provider.request({method:'personal_sign',params:[hexMessage,address]});
    if (typeof signature!=='string' || !/^0x(?:[a-fA-F0-9]{2})+$/.test(signature))
      throw new PointBlockError('INVALID_WALLET_SIGNATURE');
    const verified = await request('/v1/auth/verify',{
      method:'POST',body:{challengeId:challenge.challengeId,signature},authRequired:false,
    });
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(verified?.token??'')) throw new PointBlockError('INVALID_LOGIN_RESPONSE');
    auth = {token:verified.token,address,registered:verified.registered===true,onboarding:null,player:null};
    const currentProvider = provider;
    // Invalidate a SIWE session if the wallet account or chain changes.
    if (typeof currentProvider.on === 'function') {
      const accountChange=accounts=>{if(!Array.isArray(accounts)||accounts[0]?.toLowerCase()!==address.toLowerCase())void logout();};
      const chainChange=id=>{if(Number.parseInt(String(id),16)!==CHAIN_ID)void logout();};
      currentProvider.on('accountsChanged',accountChange);
      currentProvider.on('chainChanged',chainChange);
    }
    try { await refreshProfile(); } catch { /* A valid SIWE token remains provisional until profile fetch. */ }
    change();
    return state();
  }
  function closeLive() {
    ++socketEpoch;
    const previous=channel;channel=null;
    if(previous){ previous.closed=true; clearInterval(previous.heartbeat);if(previous.socket)previous.socket.close(1000,'Client leave'); }
    change();
  }
  async function logout() {
    const token = auth?.token; closeLive(); auth=null; change();
    if(token && root) {
      try { await timeoutFetch(new URL(root.pathname.replace(/\/+$/,'')+'/v1/auth/logout',root.origin),{
        method:'POST',headers:{Authorization:'Bearer '+token},cache:'no-store',credentials:'omit',
      }); } catch { /* Failed logout cannot restore discarded client credentials. */ }
    }
  }
  async function refreshProfile() {
    if(!auth) throw new PointBlockError('SIWE_LOGIN_REQUIRED');
    const onboarding=await request('/v1/onboarding');
    auth.onboarding=onboarding;
    auth.registered=onboarding.registered===true;
    auth.player=auth.registered?await request('/v1/me'):null;
    change();return state();
  }
  async function openLive(kind, id, onFrame, onStatus = () => {}) {
    if(!auth)throw new PointBlockError('SIWE_LOGIN_REQUIRED');
    if(kind!=='room' && kind!=='training')throw new PointBlockError('INVALID_CHANNEL');
    if(kind==='room')checkedId(id);
    closeLive();
    const epoch=socketEpoch;
    const endpoint = kind==='room'?'/v1/rooms/'+id:'/v1/training';
    const issued = await request(endpoint+'/realtime-ticket',{method:'POST'});
    if(typeof issued?.ticket!=='string'||! /^[A-Za-z0-9_-]{32,128}$/.test(issued.ticket))
      throw new PointBlockError('INVALID_REALTIME_TICKET');
    if(epoch!==socketEpoch)throw new PointBlockError('REALTIME_CANCELLED');
    const socket = new WebSocket(wsPath(root,endpoint+'/live'));
    const current={kind,id,socket,heartbeat:0,closed:false,send(frame) {
      if(socket.readyState!==WebSocket.OPEN)return false;
      socket.send(JSON.stringify(frame));return true;
    }};
    channel=current;
    const result = await new Promise((resolve,reject)=>{
      let settled=false;
      const timer=setTimeout(()=>fail(new PointBlockError('REALTIME_AUTH_TIMEOUT')),AUTH_TIMEOUT_MS);
      const success=()=>{if(settled)return;settled=true;clearTimeout(timer);resolve(current)};
      const fail=err=>{if(settled)return;settled=true;clearTimeout(timer);reject(err)};
      socket.addEventListener('open',()=>current.send({type:'authenticate',ticket:issued.ticket}));
      socket.addEventListener('message',event=>{
        if(typeof event.data!=='string'||event.data.length>MAX_WS_MESSAGE) { socket.close(1009,'Frame too large');return; }
        let data;try{data=JSON.parse(event.data)}catch{socket.close(1003,'Malformed frame');return}
        if(epoch!==socketEpoch||current.closed)return;
        if(!settled&&['match_ready','training_ready','lobby_snapshot'].includes(data?.type))success();
        if(typeof data?.type!=='string')return;
        try{onFrame(data)}catch(err){console.error('[PointBlock] Invalid realtime state',err);}
      });
      socket.addEventListener('close',event=>{
        clearInterval(current.heartbeat);
        if(!settled)fail(new PointBlockError('REALTIME_SOCKET_CLOSED_'+event.code));
        if(channel===current){channel=null;change();onStatus({type:'closed',code:event.code});}
      });
      socket.addEventListener('error',()=>{if(!settled)fail(new PointBlockError('REALTIME_CONNECTION_FAILED'));});
    });
    if(epoch!==socketEpoch){socket.close();throw new PointBlockError('REALTIME_CANCELLED')}
    current.heartbeat=setInterval(()=>current.send({type:'ping'}),10000);
    change();return result;
  }
  const api = {
    state, setOnChange(callback) { onChange=typeof callback==='function'?callback:()=>{};change(); },
    request, connectWallet, logout, refreshProfile, openLive, closeLive,
    get live(){return channel;},
    rooms:()=>request('/v1/rooms'),
    createRoom:body=>request('/v1/rooms',{method:'POST',body}),
    getRoom:id=>request('/v1/rooms/'+checkedId(id)),
    joinRoom:(id,team)=>request('/v1/rooms/'+checkedId(id)+'/join',{method:'POST',body:{team}}),
    switchTeam:(id,team)=>request('/v1/rooms/'+checkedId(id)+'/team',{method:'POST',body:{team}}),
    updateRoom:(id,body)=>request('/v1/rooms/'+checkedId(id),{method:'PATCH',body}),
    leaveRoom:id=>request('/v1/rooms/'+checkedId(id)+'/leave',{method:'POST'}),
    startRoom:id=>request('/v1/rooms/'+checkedId(id)+'/start',{method:'POST'}),
    abandonRoom:id=>request('/v1/rooms/'+checkedId(id)+'/match/leave',{method:'POST'}),
    startTraining:()=>request('/v1/training/start',{method:'POST'}),
    trainingStatus:()=>request('/v1/training/status'),
    register:username=>request('/v1/me/callsign',{method:'POST',body:{username}}),
    loadout:()=>request('/v1/me/loadout'),
    saveLoadout:mainWeaponId=>request('/v1/me/loadout',{method:'PUT',body:{mainWeaponId}}),
    inventory:()=>request('/v1/me/inventory'),
    shop:()=>request('/v1/shop/weapons'),
    buyWeapon:(weaponId,idempotencyKey)=>request('/v1/shop/orders',{
      method:'POST',body:{weaponId,currency:'vPBT',idempotencyKey},
    }),
    progression:()=>request('/v1/me/progression'),
    stats:()=>request('/v1/me/statistics'),
    award:matchId=>request('/v1/me/matches/'+checkedId(matchId)+'/reward'),
  };
  return Object.freeze(api);
}
