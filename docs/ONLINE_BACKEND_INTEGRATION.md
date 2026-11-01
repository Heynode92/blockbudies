# PointBlock Frontend ↔ Backend Integration

This Vite frontend consumes the independently deployed `Heynode92/pointblock-backend` API.
Authoritative policy: BE `Plan.md` 1.0.11 and `Agent.md` 1.1.5, FE source at `src/game/*.js`.
The server is the sole source of Room Master permissions, identity, weapon entitlements,
gameplay state, kills, BOT logic, Bomb objectives, and reward/ledger entries.

## Configuration

- Windows/Vite development: `npm run dev`; browser transport defaults to
  `http://127.0.0.1:3001`, BE's default local port.
- Deployed production: set `VITE_POINTBLOCK_API_URL=https://<your-approved-backend-host>`
  at build time. This **public** origin is not a secret. Unconfigured production
  clients refuse to authenticate or play.
- Backend must authorize the exact Vite origin via `CORS_ORIGINS`, and configure
  matching `SIWE_ORIGIN` and official Robinhood Chain Mainnet RPC for SIWE verification.
  Robinhood Chain Mainnet chainId 4663 only; never send or store wallet private keys.
- A successful wallet connection is not an account. The user must sign the
  backend SIWE challenge; the resulting bearer token is **memory-only**, never
  `localStorage` or URL. Refresh requires another wallet signature.

## Transport contract

- SIWE: `POST /v1/auth/challenge` → wallet `personal_sign` → `POST /v1/auth/verify`.
- Profile: `/v1/onboarding`, `/v1/me`, `/v1/training/start`, `/v1/me/callsign`.
- Rooms: `GET/POST /v1/rooms`, room `GET/PATCH`, `/join`, `/leave`,
  `/team`, `/start` and `/match/leave`.
- Training: issue `POST /v1/training/realtime-ticket`, open
  `WS /v1/training/live`, authenticate as first WebSocket frame.
- Match: issue `POST /v1/rooms/:id/realtime-ticket`, open
  `WS /v1/rooms/:id/live`, authenticate as first WebSocket frame.
- Input WebSocket frames contain `seq,moveX,moveZ,yaw,pitch,sprint,ads,fire,
  reload,weaponId`, optional `interact,jump,crouch`. No client-submitted
  damage, hit, kill, result, balance, plant success, or reward fields.
- `match_ready`, `match_snapshot`, `training_ready`, `training_snapshot`,
  `match_event`, and `match_completed` carry **server-derived** state. Enemy
  visibility is filtered server-side. A dropped unplanted bomb is never
  displayed to Police. Recipient-private state updates the local HUD.
- Shop: `GET /v1/shop/weapons`, `POST /v1/shop/orders` with a UUID
  idempotency key and `currency: "vPBT"`. Inventory and equipped main
  weapon come exclusively from `/v1/me/inventory` and
  `GET/PUT /v1/me/loadout`.

## Renderer architecture

`src/network/pointblock-client.js` is the isolated REST/WS/security boundary.
`src/game/98-online-bridge.js` translates authorized snapshots into the
existing Three.js actor models and preserves the 3-D lobby/weapon UI.
`src/game/99-render-loop.js` bypasses legacy `95-simulation.js` and
hidden-tab local simulation during online matches. The local modules remain
as source material for rendering and gameplay parity work, not for
authoritative PvP or economic results.

## Implementation status / limitations

This integration is under active development, not production-certified.
The backend source has not undergone complete real-DB, five-map, all-weapon,
network-latency, BOT M7, or economically safe load tests. Local legacy
tests were written against a free offline shop and browser-created rooms:
they need deliberate contract migration rather than false green assertions.
Existing CI remains visible, and a separate build-only Windows workflow
validates whether the new online frontend compiles.

No PBT onchain checkout is enabled; contract/address/prices/finality have not
been approved. Do not silently invent them. Do not publish this client or
the BE to multiple live instances until server room fencing and deployment
safety have been established.
