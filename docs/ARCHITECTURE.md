# PointBlock frontend architecture — server-authoritative migration

## Source of truth and ownership

The existing Three.js source fragments in `src/game/*.js`, the ordered
`tools/source-manifest.json`, original game art, UI and audio remain the
renderer and gameplay-parity references. The current backend repository
`Heynode92/pointblock-backend` governs gameplay decisions according to its
`Plan.md` v1.0.11 and `Agent.md` v1.1.5.

**Only the backend certifies:** authenticated player, room membership/master,
loadout ownership, player/BOT positions and collision, projectile/hit/HP/armor,
death/kill/streak, Bomb objective states, match winner, EXP, rank and vPBT.
The frontend may handle rendering, cosmetic fire effects, HUD projection,
input collection, interpolation and *visual-only* local prediction. No
client-computed kill, damage, unlock, purchase, plant or match result becomes
an authoritative server event.

## Current source layout

- `src/main.js` injects the online client into the original Vite runtime.
- `src/network/pointblock-client.js` owns wallet SIWE + per-request bearer
  authentication, server error parsing and one-use WebSocket ticket exchange.
  No private keys or session bearers are written to browser storage.
- `src/game/98-online-bridge.js` maps online room/player events into the
  existing lobby/Three.js visuals, registers via server-verified training,
  rejects all local unlocks and projects recipient-scoped snapshots.
- `src/game/99-render-loop.js` owns the single WebGL renderer. Online mode
  bypasses `95-simulation.js` and the background worker's local physics.
- `src/game/89-inventory.js` and `89-shop.js` fetch verified server
  entitlements, priced vPBT orders and fixed loadouts. PBT onchain checkout
  is disabled until the contract policy is officially approved.

The original BOT/physics/Bomb gameplay modules remain in the ordered bundle
as **visual/parity references**, not as online game authorities. Removing them
indiscriminately would break animations, map previews, models or CSS. Future
module pruning must identify dependencies and preserve source-backed visuals.

## Real-time anti-cheat and visibility

Only authenticated session- and room-bound actors may submit strict
`input` intents with a monotonically increasing `seq`. The backend
authoritatively advances combat. At each live snapshot, the bridge replaces
client positions/HP/ammo/scoreboard with server state and drops invisible
enemy actor meshes from the local pool. Bomb carrier identity and the
dropped device remain hidden from the Police. The server alone awards
EXP/vPBT when a completed match is verified. Disconnecting does not
grant any bypass of the server's 60-second AFK grace.

## Builds, compatibility and open gates

Run the Vite Windows launcher; never edit generated `assets/game.js`.
`PointBlock Online Frontend Build` checks `npm run build` and
`npm run check:dist`. The original offline-era regression tests still
expect local rooms and `UNLOCK FREE` shopping; their failure does **not**
certify the new implementation and should not be hidden or falsely
recorded as passing. Rewrite those cases to authoritative contract tests
only when the FE/BE runtime implementation is complete.

Authoritative gameplay parity, full M0–M7 BOT tactics, server tick/prediction
and reconnect jitter, real multi-human simulation, live database migration,
production security, persistent economic reconciliation and distributed
room fencing require further work and acceptance checks.

See [ONLINE_BACKEND_INTEGRATION.md](ONLINE_BACKEND_INTEGRATION.md) for
all API routes and environment configuration.
