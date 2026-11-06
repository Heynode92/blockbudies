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
  matching `SIWE_ORIGIN` and a trusted Robinhood Chain Mainnet RPC (`ROBINHOOD_RPC_URL`) for SIWE verification.
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

## Authoritative movement smoothing (2026-11-02)

- **Local prediction:** the first-person camera applies WASD, weapon walk/sprint/ADS
  movement, jump/gravity and the existing map collider on every render frame.
  The browser sends input intent only, never a claimed position, damage or score.
- **Reconciliation:** each recipient-only BE snapshot includes
  `privateState.lastAcceptedInputSeq`, `lastProcessedInputSeq`,
  `grounded` and `velocityY`. The FE bounds its local prediction history,
  removes acknowledged frames and replays remaining intent on the trusted
  server coordinates. Small corrections blend visually; teleports, death
  and respawn use immediate authoritative placement.
- **Remote interpolation:** already-visible BOT and player positions are
  interpolated from up to eight trusted snapshots at an adaptive 115–220 ms
  visual delay. No extrapolation beyond the newest snapshot, and no retained
  hidden-enemy coordinates after visibility redaction.
- **Backend pacing:** game engine fixed-step movement is 30 Hz; the latest
  input is supplied at up to 20 Hz and private snapshots broadcast after
  every three *new* authoritative ticks, around 10 Hz. There is no gameplay
  processing based on untrusted client render FPS.

### Windows/local performance diagnosis

Run backend and Vite normally, then load
`http://localhost:5173/?pbNetQa=1` and complete SIWE again.
A small **opt-in** panel displays measured frame-time p95 (ms),
snapshot-interarrival p95 (ms), last snapshot age, server tick,
latest processed input acknowledgement, local prediction history length,
and latest positional correction. This does not send telemetry externally.

- At 60 FPS, frame-time p95 should usually be below ~16.7 ms; at 120 FPS
  below ~8.3 ms. These are targets, **not measured performance claims**.
- Snapshot interarrival should generally be near 100 ms locally, but browser
  throttling, event-loop stalls and server load can delay it.
- If frame p95 is high, profile Three.js GPU/render work. If frame p95 is low
  but snapshot p95 or correction is high, inspect BE's existing
  `Authoritative game runtime metrics` timing logs and WebSocket frames.
- A single green CI build is not a live Windows 5v5/network-load benchmark.
  Full map collision parity, real latency compensation, M7 browser QA and
  server load testing are separate release gates.

## Implementation status / limitations

This integration is under active development, not production-certified.
The backend source has not undergone complete real-DB, five-map, all-weapon,
network-latency, BOT M7, or economically safe load tests. Legacy offline assumptions were migrated for the Windows Vite regression suite,
which now verifies the online-aware contract. The separate online Windows
build and M0 regressions also run; the old M7 browser harness remains
incompatible with the Vite entry and is not a verified online 5v5 playtest.
Do not represent passing builds as production gameplay certification.

No PBT onchain checkout is enabled; contract/address/prices/finality have not
been approved. Do not silently invent them. Do not publish this client or
the BE to multiple live instances until server room fencing and deployment
safety have been established.

## BE-verified kill HUD parity (2026-11-03)

The online TAB scoreboard, top-left Kills counter, and star icons all track
server-confirmed personal K/D. Only authenticated personal KILL events animate
the original offline starKill() and killNotify() graphics. The recipient-private
`streak` value preserves current-life Double/Triple/Chain semantics and resets
on death/respawn/new round. Snapshot rehydration restores counts without
replaying old kill celebrations. Training also receives personal KILL events.
