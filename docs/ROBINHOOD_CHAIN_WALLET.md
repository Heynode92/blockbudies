# PointBlock — Robinhood Chain Mainnet wallet

Network information (official): https://docs.robinhood.com/chain/connecting/

| Property | Value |
| --- | --- |
| Chain | Robinhood Chain Mainnet |
| EIP-155 ID | `4663` (`0x1237`) |
| Native gas | ETH |
| Public RPC | `https://rpc.mainnet.chain.robinhood.com` |
| Explorer | `https://robinhoodchain.blockscout.com` |

PointBlock accepts **only Robinhood Mainnet**, not BNB Smart Chain (56) and not Robinhood testnet (46630). The official public RPC has rate limits; use your own trusted HTTPS endpoint for production traffic. Never put private RPC credentials in browser-exposed `VITE_*` variables.

## Local Windows configuration

**Frontend .env** (keep the existing WalletConnect project ID and API URL):

```dotenv
VITE_POINTBLOCK_API_URL=http://127.0.0.1:3001
VITE_WALLETCONNECT_PROJECT_ID=YOUR_EXISTING_PUBLIC_PROJECT_ID
VITE_ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com
```

The browser RPC variable is optional; without it the viem chain definition uses the official public endpoint.

**Backend .env** (preserve existing private DATABASE_URL, PORT, CORS_ORIGINS and other unrelated values):

```dotenv
SIWE_ORIGIN=http://localhost:5173
ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com
```

Remove old `BSC_RPC_URL` and `VITE_BSC_RPC_URL` entries. `SIWE_ORIGIN` must match the exact page origin (if opening `http://127.0.0.1:5173`, use that origin instead). Backend auth is disabled until BOTH `SIWE_ORIGIN` and `ROBINHOOD_RPC_URL` are set. After a pull, restart BE and FE so the new environment is loaded.

## Security and data integrity

- RainbowKit offers Robinhood Mainnet only. SIWE challenge, wallet signature, server verification, EIP-1271 RPC and session authorization must all resolve to chain 4663.
- RPC chain is checked by the server; an incorrect RPC responds with `INVALID_RPC_CHAIN` rather than accepting a signature on another network.
- PostgreSQL `wallet_identity` has a composite unique key `(chainId, addressLower)`. **Do not change all historical chain IDs in SQL.** Robinhood accounts retain their original 4663 records and vPBT/progression. BSC 56 accounts are separate identities and are not merged without an audited ownership migration.
- Original tracked migration `20261101000000_p1_wallet_identity` already restricts to Robinhood ID 4663. There is **no new migration** required for the source change. **Never reset or drop the database** just for this network configuration.
- If a previous local untracked migration `20261106230000_allow_bsc_wallet_identity` failed (e.g. BOM/SQL P3018), inspect `npm run db:status` and resolve the *failed local migration* before future deploys. Only if it is confirmed FAILED, mark it rolled back using `npx prisma migrate resolve --rolled-back 20261106230000_allow_bsc_wallet_identity`, and then remove that local-only directory. If it was already applied, do not mark it rolled back; existing `4663` rows still work.
- Wallet connection and SIWE are free signatures; EARN/PBT conversion remains unavailable. No token contract or payment approvals are introduced.

## Quick focused checks

1. Browser switches network to **Robinhood Chain**, then opens sign-in.
2. `POST /v1/auth/challenge` returns `chainId: 4663` and an SIWE message containing `Chain ID: 4663`.
3. After signing, `POST /v1/auth/verify` succeeds for a legitimate Robinhood wallet.
4. Previous Robinhood operator, rank, inventory and vPBT are unchanged.
5. Wrong chain (56 or 46630) cannot sign in. Neither a stale BSC bearer token nor a mismatched address restores a Robinhood session.
