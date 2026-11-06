# PointBlock — BNB Smart Chain / RainbowKit migration

**Approved target:** BNB Smart Chain Mainnet (BSC), EIP-155 chain ID **56**, hexadecimal **0x38**, gas asset BNB, explorer https://bscscan.com/. The app obtains network metadata from official `viem/chains` `bsc` (FE and BE); do not add another hardcoded list of chain IDs.

## What changed

- BE: `src/identity/chain.ts` exports the canonical BSC definition; `/v1/auth/challenge` includes `chainId` and generates canonical BSC SIWE; BE checks the exact origin, wallet address, nonce, expiry, signed chain ID, one-time replay, authenticated BSC RPC network, and EOA/ERC-1271 signature validity. Sessions and onboarding require BSC chain 56.
- FE: an isolated `src/wallet/rainbowkit-root.jsx` React island uses official RainbowKit 2 + wagmi 2 + viem + TanStack Query in the existing Vite app. Three.js simulation, game data, BOT code, Room/Inventory/Shop/Results and server-authoritative realtime packets remain unchanged. RainbowKit owns wallet connector/account/network UI. The backend SIWE challenge is signed by the wallet selected in wagmi, **never** by an arbitrarily selected injected provider.
- `src/network/pointblock-client.js` binds SIWE to exact browser domain/URI, BSC, and wallet identity, and accepts the verified BE token only after matching the connected wallet. A stored token can be restored only after wagmi has recovered the same BSC account and the BE has revalidated it. Account disconnect or chain switch drops the browser session.
- The branded wallet modal is **not** a custom wallet selector anymore: RainbowKit handles connection; the PointBlock popup is only for already-authenticated training/onboarding or setup failures. The header shows Connect, Switch to BSC, Sign In or verified address as appropriate.
- A wallet connection alone is not authenticated, and a SIWE login is not a token allowance, PBT transfer, or game settlement.

## Required local setup (Windows / PowerShell)

1. After pulling both repos, run `npm install` in **Frontend only** to install the newly added official RainbowKit/React/wagmi dependencies. BE dependencies do not change.
2. In FE's private `.env`, set `VITE_WALLETCONNECT_PROJECT_ID` to **your** public project ID from https://cloud.reown.com/ . No project ID is included in the repository; with an empty ID wallet login is disabled. Set `VITE_POINTBLOCK_API_URL` to your actual trusted BE origin. Optional `VITE_BSC_RPC_URL` is a browser-visible public HTTPS BSC Mainnet endpoint (never put RPC API secrets there).
3. In BE's private `.env`, replace `ROBINHOOD_RPC_URL` with `BSC_RPC_URL`, using a trusted BSC Mainnet JSON-RPC endpoint; official public example is `https://bsc-dataseed.bnbchain.org` (public nodes can rate-limit). Set `SIWE_ORIGIN` to the exact browser origin, e.g. `http://localhost:5173`, and include the same origin in `CORS_ORIGINS`. Use HTTPS origins/RPC in production.
4. Restart BE then FE. No changes to Prisma schema, no database migration and no wallet private keys or PBT contract address are required.

## Legacy accounts / security boundary

Prisma `WalletIdentity` has a unique `(chainId,addressLower)` key. An existing player on the prior chain must **not** have its identity's chain ID bulk-replaced with 56 or its vPBT/EXP/inventory reassigned without a separately approved proof-of-ownership transition. A BSC address can look identical to the prior address yet refer to an independent contract wallet. Old data remains stored, old sessions fail BSC-chain validation. New BSC accounts will need onboarding/training until a separately designed and reviewed migration is available.

## Focused validation checklist

- [ ] BE starts with `SIWE_ORIGIN` + `BSC_RPC_URL`, RPC actually reports `eth_chainId: 0x38`; reject RPC on chain 97 or 4663.
- [ ] RainbowKit opens with a real project ID; MetaMask/other supported connectors show only BSC Mainnet; switching to testnet must not complete SIWE.
- [ ] A real BSC wallet signs a correctly scoped SIWE message; BE verifies it and the same wallet/profile restores after a full page reload.
- [ ] Disconnect and change address/network invalidate the client session; a previous-chain bearer token cannot authorize BSC.
- [ ] New BSC wallet follows training and callsign rules, registered wallet continues into Lobby and Inventory, Shop remains public.
- [ ] Server-authenticated 5v5, BOTs, hit registration, Results, vPBT ledger and normal gameplay remain unchanged; these must be checked manually with multiple browsers before production.
- [ ] PBT token payment remains coming soon until externally supplied contract/treasury and audit.

## Official reference material

- BSC network configuration: https://docs.bnbchain.org/bnb-smart-chain/developers/wallet-configuration/
- BSC public JSON-RPC: https://docs.bnbchain.org/bnb-smart-chain/developers/json_rpc/json-rpc-endpoint/
- RainbowKit React installation and wagmi/viem peers: https://rainbowkit.com/docs/installation
- RainbowKit custom connection UI: https://rainbowkit.com/docs/custom-connect-button

**Automated CI validates code/contracts only, not access to a private WalletConnect project or real wallet signature on mainnet.**
