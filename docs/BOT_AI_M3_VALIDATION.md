# BLOCK BUDDIES — M3 Movement & Tactical Cover Validation

> **Status:** M3 VERIFIED (CORE EXIT GATE: WINDOWS CI + OWNER-REPORTED 7/7 PLAYTEST); REAL-MAP QUANTITATIVE KPIs OPEN
> **Date:** 2026-10-31 WIB
> **Scope:** M3 only — reactive cover, peek based on legitimate enemy memory, bounded dodge, obstacle-safe steering and safe stuck recovery for Police and Terrorist BOTs
> **Evidence:** [Windows GitHub Actions run #112](https://github.com/Heynode92/blockbudies/actions/runs/41174449879): **318/318 Node tests PASS, zero failures**, committed direct-open bundle parity, JavaScript syntax, deterministic 10-BOT replay, synthetic CPU sampling

## Implementation and ownership

| File | Owned change |
|---|---|
| `src/game/88-bot-movement.js` | Standalone M3 state machine, reachable reactive cover, finite hold/peek, damage-triggered dodge, velocity easing, solid-obstacle probes and bounded stuck recovery |
| `src/game/90-bot-ai.js` | Active BOT loop integration; cover goals win over default combat strafing; no direct fallback when A* fails; collision-free axis slides always pass through canonical `resolve()` |
| `src/game/85-lobby-and-match.js` | Reset M3 intent/cooldowns when BOT respawns or match restarts |
| `tools/source-manifest.json`, `assets/game.js` | Load M3 after M1 evidence module and before tactical AI; rebuilt, parity-verified offline browser bundle |
| `tools/bot-ai-m0-baseline.mjs`, `tests/bot-ai-m0-baseline.test.mjs` | Run actual M3 module in deterministic fixture; add whole-encounter retreat tracking rather than misreading one last frame |
| `tests/bot-five-star.test.mjs`, `tests/bot-ai-m3-movement.test.mjs` | Isolated active runtime and 12 focused M3 regression cases, including real A* around a synthetic obstacle |

## Behavior boundaries

- **Under-fire cover:** Damage evidence (`e.fl`) triggers a *rate-limited* defensive reposition only at reduced HP; a cover candidate must avoid solid geometry and have a valid A* path. Existing critical-HP retreat logic takes priority. BOTs do **not** automatically retreat or play passively every time they see an opponent.
- **Peek, hold, reposition:** After reaching cover, a finite hold window can transition to a short lateral peek selected against **M1 timestamped last-known opponent coordinates**, not hidden moving actors. Edge candidates are geometry/LOS checked, scored for nearby allies, and A* checked at most twice per attempt.
- **Dodge:** Brief strafe reaction occurs only after a damage event while the opponent is currently visible, with bounded time/cooldown, without granting instant aim, extra movement speed caps or invulnerability.
- **Collision safety:** `botMoveSteer()` smooths velocity, probes the next movement using existing solid geometry, attempts a clear axis slide, and returns zero if both directions are blocked. There is no direct position correction, teleport or forced wall crossing. `resolve()` remains authoritative for actual actor movement.
- **Stuck recovery:** A bounded timer records attempted movement without displacement, schedules A* repath and short perpendicular movement when geometrically valid, and abandons stale peek/cover intent after repeated stalls. No unbounded per-frame cover searches, forced bypasses or infinite recovery recursion.
- **Bomb priority:** Plant/defuse/urgent Police retake and critical HP override elective offensive cover. Bomb timer, carrier, round winner, weapon, damage and objective rules are unchanged.
- **Lifecycle:** Per-BOT movement state is reset on spawn; no global permanent target pointer is introduced. Both factions use the same M3 logic, while existing Bomb objective priorities remain role-specific.

## Automated verification

- [x] 12 focused M3 tests: cover selection, cover→hold→peek transition, expiring evidence, Bomb priority/critical HP, rate-limited damage dodge, solid-axis slide, impossible slide fail-closed, bounded stuck/repath, state reset, source integration, actual A* obstacle routing and unreachable A* goal.
- [x] M1 sight authorization: no hidden coordinates used as new peek targets, no hearing-only enemy shoot permission.
- [x] M2 finite reaction/yaw/pitch and canonical weapon damage/ammo/reload unchanged in suite.
- [x] No fallback to direct TDM wall charge when A* reports no route.
- [x] Existing 10-BOT synthetic critical-HP encounter observed **10/10 BOTs retreat at least once**, while last-frame instantaneous retreat may correctly be zero after they reach safety. This is **not** evidence of actual path success, cover win-rate or real-match survival.
- [x] Windows Node 22 Actions [run #112](https://github.com/Heynode92/blockbudies/actions/runs/41174449879): **318 tests, 318 pass, 0 fail**, canonical standalone bundle check, syntax and synthetic CPU benchmark green.
- [x] **Owner-reported 7/7 M3 gameplay smoke PASS, 2026-10-31 WIB:** natural strafe/dodge, cover/peek, no observed wall/object penetration, no persistent jitter/stuck, aiming remains normal during movement, Bomb plant/defuse/retake functional, and no freeze/crash/perceptible severe lag. Qualitative self-report, not independent telemetry.
- [ ] Real map/team navigation and cover benchmarks: measured duration stuck, successful peeks, obstacle corrections, exposure time, real browser frame-time median/p95, and both-map/faction gameplay samples. **No claim these have passed.**

## Owner acceptance and milestone decision — 2026-10-31 WIB

The owner explicitly confirmed **7/7 M3 checks PASS** after Windows gameplay, including both factions, damage-triggered dodge, cover/peek, geometry safety, absence of persistent jitter/stuck, M2 firing continuity, Bomb objective behavior, and no perceived severe performance regressions. This is **owner-reported manual acceptance**, not instrumented game data. Source check: [Windows CI #118](https://github.com/Heynode92/blockbudies/actions/runs/41174607049), 318/318 tests PASS, bundle and syntax green.

**Decision: M3 VERIFIED for its core feature exit gate.** Real-map measured stuck time, cover exposure, navigation completion and browser FPS/p95 remain OPEN. This sign-off does not certify those numerical KPIs. **M4 subsequently authorized** by the owner.

## Review limitations

The A* obstacle tests use a synthetic rectangular wall, not both full shipped maps. LOS still relies on the engine's existing two-dimensional visibility helper; no volumetric eye-level visibility is claimed. This milestone does **not** add crouching, jumping or physics/character capsule changes, because those require separate compatibility work; no fake visual crouching was introduced. The measured 10-BOT CPU benchmarks run in a Node VM with mocked world state and are **not browser FPS**. Full measured exposure/stuck rates await instrumentation and actual map/gameplay samples (M7). No M4 squad roles, new weapons or user UI edits are included.

## Owner Windows playtest protocol

After `git pull origin main`, open `index.html` directly. No runner, Node, WSL, Docker or backend needed.

1. **Deathmatch:** let Police and Terrorist BOTs fight near walls; look for cover-seeking when wounded, brief evasive strafes when shot, then peeking/investigating rather than spinning endlessly.
2. **Obstacles and corners:** watch whether any BOT jitters repeatedly, gets permanently stuck or walks through a wall; observe both close and long paths.
3. **Bomb Mission:** verify carrier plants, Police can defuse/retake and guards still engage; new movement must not abandon an urgent objective.
4. **Regression:** verify BOTs still fire with M2 elevation/finite reaction, damage and reload remain intact and game stays responsive.

The owner subsequently submitted **“M3 playtest PASS bro”**, explicitly marking all seven checks PASS. This satisfies the agreed qualitative manual acceptance alongside green Windows CI. Map names, durations, browser version and raw movement/frame-time telemetry were not provided; measurable quality gates remain OPEN. M4 may proceed as a separate authorized implementation.
