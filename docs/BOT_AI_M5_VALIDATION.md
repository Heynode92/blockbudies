# POINT BLOCK — M5 Bomb Mission Tactical Intelligence Validation

> **Status:** VERIFIED (CORE EXIT GATE: WINDOWS CI + OWNER-REPORTED 7/7 PLAYTEST PASS); QUANTITATIVE BOMB/FPS KPIs OPEN
> **Date:** 2026-10-31 WIB
> **Approved scope:** Bomb Mission-specific tactical decisions for Police and Terrorist BOTs; preserve authoritative Bomb physics, timers, result accounting and all non-Bomb gameplay
> **CI evidence:** [Windows GitHub Actions run #149](https://github.com/Heynode92/blockbudies/actions/runs/41175963944) — **346/346 Node tests PASS**, zero failures, standalone bundle parity, JavaScript syntax, deterministic 10-BOT replay and synthetic CPU-sampling workflow green

## Original source of truth and restrictions

- `src/game/86-bomb-mission.js` defines round state, carrier and dropped device state, plant/defuse actions and progress, explosion/timeout/elimination and round victory; **unchanged**.
- `src/game/11-bomb-map.js` defines Bomb sites, layout and authoritative rules; **unchanged**. Default values: plant **5 seconds**, defuse **7 seconds**, fuse **40 seconds**. Room-configured round limits and round durations remain authoritative.
- `src/game/87-bomb-tactics.js` owns the existing BOT tactical stages and objective selection. M5 integrates new bounded decisions without changing `bombAct()`, `bombPlant()`, `bombDefuse()`, `bombFinish()`, `bombNextRound()` or scoring.
- `src/game/88-bot-perception.js` is the only trusted source of sight/radio information about opponents. M5 has no global scan of unseen enemies and cannot infer exact enemy identities from footsteps.

## Delivered implementation

| Component | Behavior |
|---|---|
| `src/game/86-bomb-intelligence.js` | New decision-only M5 module, initialized after original Bomb mission state code |
| Dynamic site evaluation | A BOT bomb carrier can change its initial site **at most once per round** if a still-valid M1 sight/radio position places an opponent near the chosen site, an alternative site is safer and reachable by the existing A*. Cannot switch during an active plant or on sound-only/unverified clues |
| Critical fuse response | When the original fuse is at or below **original defuse seconds + 2.5 seconds**, a closer living Police BOT can be selected for a defuse attempt; an officer already defusing keeps the task. Solo Police no longer waits to clear an opponent clue indefinitely if the fuse is about to expire |
| Dropped-device recovery | One living Terrorist BOT is assigned recovery using public dropped device coordinates, distance and a small low-HP penalty; task reassigns when a recoverer dies |
| Post-plant defense | Multiple Terrorists guarding/intercepting a planted device use separated, short-lived reachable positions, with orientation biased only by valid sight/radio contact, never live hidden actor positions |
| Retake support | Backup Police can take separated reachable positions close to the actual device, avoiding duplicate support reservations; the designated defuser's original interaction still takes precedence |
| Safe fallback | If there is no authentic contact, no teammate, no valid route, or the tactical candidate expires, the original Bomb tactical goal remains in control; no forced teleport, new projectile rules or extra action authority |
| Lifecycle | Cached site/role/goal data resets on BOT respawn and when the original round number changes, with bounded A* checks and short goal lifetimes |

**Important:** The M5 module does not change player actions or default Deathmatch tactics, UI, maps, weapon statistics, headshots, speed, armor, ammo, scoreboard, round winner, match duration, Bomb placement mechanics, or objective radii.

## Regression checklist

- [x] M4 owner-reported **7/7 manual gameplay PASS** recorded in [M4 validation](BOT_AI_M4_VALIDATION.md); **M4 core exit gate VERIFIED**.
- [x] M5 only changes the Bomb decision layer; original `86-bomb-mission.js` and `11-bomb-map.js` are byte-for-byte unchanged in the implementation diff.
- [x] **14 targeted M5 tests:** justified carrier site switch, hidden-position/sound-only anti-omniscience, unreachable alternative and active plant guard, round state reset, critical fuse defuser selection without duration change, ordinary defuser retention, original seven-second defuse completion, contested solo Police urgency, single recoverer reallocation, separated post-plant anchors, stale enemy location protection, unreachable cover fallback, retake support/active defuse protection, source ownership and manifest ordering.
- [x] Existing Bomb Mission tests cover both sites, actual 5-second plant / 7-second defuse, dropped device pickup, planted fuse timeout/detonation, team elimination, score and winner, 160x160 map A* access, spectator switching and late retakes.
- [x] All legacy M0–M4 tests remain active. Fixture module order updated to include M5; no regression test disabled or removed to force success.
- [x] Direct-open `assets/game.js` rebuilt and matched to `tools/source-manifest.json` on Windows.
- [x] [Windows CI #149](https://github.com/Heynode92/blockbudies/actions/runs/41175963944) **346/346 PASS**, 0 failures, verified syntax, deterministic BOT replay and synthetic CPU samples.
- [x] **Owner-reported 7/7 Windows M5 gameplay PASS (2026-10-31 WIB):** planting on A/B; justified alternative site without oscillation; dropped bomb recovery; separated post-plant defense; Police retake/critical-fuse defuse; original plant/defuse/fuse/scoring/round outcome preserved; no permanent stuck, wall clipping, freeze, crash or perceptible severe lag. Self-reported qualitative, not independently instrumented.
- [ ] **Quantified live Bomb outcomes:** per-site plant success, carrier survival, retake/defuse completion distributions, late-fuse decision statistics, collision/stuck duration, human-perceived strategy and browser FPS/p95. None measured by Node tests.

## M5 owner acceptance — 2026-10-31 WIB

The owner explicitly submitted **“M5 playtest PASS bro”** with **7/7 checks passed**, confirming carrier reaches A/B and plants, can select a justified alternative without repeated switching, retrieves a dropped device, uses separated post-plant defenders, Police retakes and defuses when fuse is low, original planted/defuse/fuse/scoring/round winner remain intact, and no visible clipping/permanent stuck/freeze/crash/heavy lag occurred. This is owner-reported qualitative gameplay evidence only: there is no raw per-map match log, recorded FPS, hit%, success percentage or browser frame-time trace.

**Decision:** M5 **VERIFIED for its core feature milestone**; real numerical/browser KPI collection remains **OPEN** for M7. This acceptance does not imply M6 source had already been implemented.

## Playtest scenarios for M5

In Windows, run `git pull origin main` and open `index.html` (no Node/backend/local build).

1. **Terrorist carrier on A/B:** observe site approach, defend/clear on genuine contact, and valid planting. BOT must not switch site endlessly or react to concealed moving opponents as if they were visible.
2. **Dropped bomb:** eliminate carrier and verify one living Terrorist retrieves dropped device and another can take over if the first is eliminated.
3. **Post-plant defense:** multiple Terrorist BOTs occupy distinct nearby defense angles, attack only legal targets and do not forget bomb site.
4. **Police retake:** Police converge on the actually planted device; a support BOT does not obstruct the defuser, including when fuse is low or Terrorists have been eliminated.
5. **Round integrity:** plant 5s, defuse 7s and normal fuse/scoring/round result unchanged; no freeze, wall clipping or severe frame-time regression.

The owner subsequently reported **all seven M5 scenarios PASS**. The M5 core exit gate is **VERIFIED** from that qualitative owner acceptance plus [Windows run #154](https://github.com/Heynode92/blockbudies/actions/runs/41176157308) (346/346 PASS on final M5 code/docs). The owner separately authorized M6 work. Actual per-site outcomes, measured FPS, genuine hit percentage, objective success rates, and map/session metadata remain unmeasured.
