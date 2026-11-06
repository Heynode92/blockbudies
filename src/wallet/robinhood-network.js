import { defineChain } from 'viem';

// Robinhood Chain Mainnet — https://docs.robinhood.com/chain/connecting/
// Public RPC is rate-limited; use a trusted dedicated HTTPS endpoint in production.
// No testnet or alternate chain is accepted for PointBlock account identity.
export const GAME_WALLET_CHAIN = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.mainnet.chain.robinhood.com'] },
  },
  blockExplorers: {
    default: { name: 'Robinhood Chain Blockscout', url: 'https://robinhoodchain.blockscout.com' },
  },
});
export const GAME_WALLET_CHAIN_ID = GAME_WALLET_CHAIN.id;
