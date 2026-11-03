# PointBlock Offline-to-Online Gameplay Parity Contract

## Non-negotiable source-of-truth separation

The original offline Three.js game is the **only source of presentation and
interaction behavior**. The headless backend is the **only source of online
match facts and permissions**. Multiplayer changes must connect these two
existing layers; never duplicate an offline feature in an unrelated online
renderer or move trusted logic into the browser.

| Concern | Canonical offline source | Online authoritative source | Adapter |
| --- | --- | --- | --- |
| Kill counter, stars, streak banners, MASS KILL | `70-kills-and-damage-hud.js`, `85-lobby-and-match.js`, `65-audio.js` | `headless-match.ts` KILL/EXPLOSION_RESULT and private snapshots | `98-online-bridge.js` |
| Battle Report, Victory/Defeat, rank, K/D, roster | `endMatch()` in `70-kills-and-damage-hud.js` | Final `match_completed.game` plus settlement record | `onlineAdoptFinalScore()` then unchanged `endMatch()` presentation |
| Real hit/blood/corpses and dropped weapon | `65-audio.js`, `46-blood-pools.js`, `60-impact-effects.js` | Verified HIT/KILL and private visibility | `onlineReactToImpact()`, `onlineConfirmedDeath()`, `onlineTickEffects()` |
| Kill feed, transient toast and effect expiry | `kFeed()`, `95-simulation.js` | Verified combat events | Offline visual functions/lifecycles reused online |
| 5v5 stats and Bomb objective | Offline original scoreboard/Bomb HUD | `PublicMatchState`, recipient snapshots | Presentation-only mapping |
| Death/spawn/round kill streak reset | Offline `resetKillStreak()` | Authoritative per-life `privateState.streak` | Snapshot reconciliation |
| Play Again / Back To Room | Original results controls and Enter shortcut | Authenticated Room Master and persisted membership | Original buttons mapped to BE room start/return |
| Rewards | Original Battle Report layout | `matchSettlement` / rewards API only | Text inside original results panel |

## Required behavior

1. An online KILL can never come from a local raycast or a `score++`. It
   requires a BE-verified event with cumulative `kills`. Older snapshots may
   not roll the display back ahead of that authoritative event.
2. Original `starKill()` is the only star renderer. Rejoin restores existing
   stars silently. Original `killNotify()` owns headshot and Double/Triple/
   Chain/MASS KILL. A MASS KILL is a server-confirmed lethal group from a
   **single** explosion, not a client-side multi-kill guess.
3. The original `endMatch()` is the only results renderer. Feed it validated
   final game state before calling it. Never return to lobby immediately on
   `match_completed`; let the original buttons control that transition.
4. No results may be invented from a stalled timer, last known score or loss
   of WebSocket. The BE emits final authoritative state or an explicit failure;
   the FE can query the room to recover, but cannot claim Victory if final
   state was not certified.
5. Server reward settlement is independent of the 3-D results lifecycle.
   Never treat a pending settlement as credited, retry presentation only, and
   use idempotent server accounting.
6. When offline visual helpers are changed, verify both offline and online
   entry points with focused tests; regenerate `assets/game.js` only through
   canonical module concatenation, never by hand.
7. Preserve existing weapon balance, BOT AI, maps, LOS/visibility and anti-cheat
   decisions. Cosmetic synchronization cannot change any of these rules.

## Validation limits

Automated Windows Node tests, Vite build and TypeScript tests validate the
contract but are not a completed multiplayer browser playtest. For any release,
verify a real 5v5 match reaching its actual kill/time/round objective, end
screen, both result buttons, player K/D, server reward status, per-life medals,
and rejoin/reconnect on the same map.
