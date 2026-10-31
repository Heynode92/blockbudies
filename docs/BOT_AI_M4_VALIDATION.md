# POINT BLOCK — M4 Squad Coordination Validation

> **Status:** VERIFIED (CORE EXIT GATE: 332/332 WINDOWS CI + OWNER-REPORTED 7/7 MANUAL PASS); QUANTITATIVE LIVE KPIs OPEN
> **Date:** 2026-10-31 WIB
> **Scope:** M4 — bounded same-team coordination for Police and Terrorist BOTs, TDM flank roles and entry timing, plus friendly-lane deconfliction in both modes
> **Evidence:** [GitHub Actions Windows run #129](https://github.com/Heynode92/blockbudies/actions/runs/41175122544), **332/332 Node tests PASS, zero failed**; canonical standalone bundle parity, JavaScript syntax, deterministic 10-BOT replay and synthetic CPU benchmark PASS

## Implementation contract

1. **Legitimate team knowledge only.** The new `src/game/88-bot-squad.js` consumes only M1 `botTeamReports[e.tm]` where `source==='radio'`, team ownership and finite timestamp/expiry are valid. No M4 live scan of unseen enemies or cross-team radio access. Flank positions are computed from a frozen **last-observed** coordinate; hidden subsequent actor movement cannot update them. M1 still controls sight and shooting authorization.
2. **Reproducible squad roles.** Alive teammate roster sorted by existing BOT index provides **entry / flank-left / flank-right / support** roles. Both teams can assign roles without an active human teammate. On death the role order rebalances deterministically; spawn resets its stale squad goal/cooldown state.
3. **Non-overlapping flank reservations.** In **TDM**, a currently unseen but legitimately radio-reported contact can trigger flank-left/right or support approach goals. Each goal must be a valid non-solid position with a reachable **existing A*** path; candidate goals near already reserved friendly squad goals are rejected. A* probing is throttled and a previously valid goal is kept briefly rather than being recomputed on every fresh radio report.
4. **Bounded entry synchronization.** The entry role may briefly wait (up to 340 ms) for teammates near a known contact, but it cannot renew the same wait on every radio refresh or deadlock an unattended team. On expired radio, unreachable flank, no teammate or lost contact, BOTs revert to the existing M1/M3 patrol/contact logic.
5. **Friendly lane deconfliction.** During movement in **TDM and Bomb**, the squad module can bias a BOT laterally when a live teammate occupies its forward lane. The resulting vector is capped to normal movement bounds and still goes through M3 collision probes, A* and canonical `resolve()`. It never changes player movement physics, BOT speed caps, damage or shooting.
6. **Bomb objective sovereignty.** In **Bomb Mission**, M4 **does not override** existing plant, carrier escort, dropped-bomb recovery, Bomb defense, retake or defuse goals; elective squad flank goal overrides are intentionally disabled there. The only new Bomb-mode behavior is friendly-lane deconfliction, skipped on urgent `botMoveUrgent()` actions. Existing Bomb-specific role tactics remain owned by `src/game/87-bomb-tactics.js`; deeper synchronized Bomb execution belongs to future M5.
7. **Lifecycle and safety.** `botSquadReset()` executes on BOT spawn/restart. The module uses no teleportation, new actor coordinates from hidden threats, spawn control, new weapons, ammo changes, friendly-fire changes or gameplay-rule edits.

## Changed files

| Path | M4 ownership |
|---|---|
| `src/game/88-bot-squad.js` | Isolated team roles, radio provenance validation, bounded entry wait, flank waypoint/reservation and friendly-lane deconfliction |
| `src/game/90-bot-ai.js` | Calls `botSquadIntent()` after M3 cover intent; calls `botSquadLane()` before existing movement normalization and `resolve()` |
| `src/game/85-lobby-and-match.js` | Calls `botSquadReset(b)` at each BOT placement |
| `tools/source-manifest.json`, `assets/game.js` | Registers module after M3, before tactical/Bomb AI; committed direct-open offline build verified by CI |
| `tools/bot-ai-m0-baseline.mjs`, `tests/bot-five-star.test.mjs` | Executes active M4 dependency in the full synthetic BOT replay and existing integrated AI test |
| `tests/bot-ai-m4-squad.test.mjs` | 14 focused regressions, including real M1 sight→radio and production A* obstacle flank tests |

## Automated verification

- [x] Both factions assign entry/left/right/support roles from living friendly BOTs; zero active-human scenario supported.
- [x] No valid contact -> no squad target; changing an unseen opponent's live coordinates cannot produce a target.
- [x] Expired, fabricated, non-radio, other-team or nonfinite M1 reports fail closed.
- [x] Legitimate reports create distinct left/right/support lanes with no identical waypoint reservation.
- [x] Repeated radio sightings do not trigger frame-by-frame A* churn or constant role thrashing.
- [x] Entry wait expires; frequent radio refresh cannot renew indefinite waiting.
- [x] M3 cover/critical retreat/visible combat has precedence over elective squad flanking.
- [x] Bomb objective intent is preserved; urgent actions bypass lane bias.
- [x] Blocked/unreachable candidate falls back to standard navigation, never teleports or forces a direct wall crossing.
- [x] Friendly lane bias uses only living same-team positions, remains bounded by normal velocity, ignores enemies.
- [x] Respawn reset clears role, goal, reservation and rendezvous timers.
- [x] Live active AI and source manifest order verified; no hidden-opponent position mutation.
- [x] **Actual M1 observation** creates a legal same-team radio report; after losing LOS, moving a hidden opponent does not change the flank waypoint and the report expires.
- [x] **Actual production A*** routes toward a legal flank around a synthetic solid wall, and fail-closes when the route is denied.
- [x] [Windows CI #129](https://github.com/Heynode92/blockbudies/actions/runs/41175122544) **332/332 PASS**, bundle parity, syntax, real-function 10-BOT deterministic replay and synthetic CPU sampling.
- [x] **Owner-reported manual gameplay acceptance, 7/7 PASS (2026-10-31 WIB):** same-team coordination, differentiated flank lanes, no persistent crowding/corridor jams, active attacks without indefinite waiting, no observed omniscient hidden-target tracking, Bomb plant/defuse/retake intact, and no perceived freeze/crash/severe lag. Qualitative owner report only; no instrumented telemetry.
- [ ] **Measured live-match KPIs:** true flank completion rate, crossfire spacing, congestion/deadlock seconds, real browser frame-time p95, actual weapon hit%, both-map/faction match sample matrix.

## M4 owner acceptance (2026-10-31 WIB)

Owner explicitly confirmed all seven M4 checks **PASS** after the game playtest: both factions cooperate; flanks use differentiated lanes; no persistent teammate blocking, corridor congestion or deadlocks; engagement remains active; hidden enemy knowledge does not look unnatural; Terrorist plant/defense and Police retake/defuse work; no observed severe freeze/crash/lag or rule regressions. Evidence classification: **user-reported qualitative manual smoke**, not independently instrumented gameplay. No browser build, map names, player faction matrix, round count, FPS/p95 or squad spacing distribution supplied.

**M4 core milestone VERIFIED; numerical and full-map KPI measurements still OPEN.** No underlying M4 gameplay code changed as part of this sign-off.

## Limits and release decision

This is **not** a verified claim of full tactical multi-agent planning. Entry timing is bounded and deterministic; no global commander, shared omniscience or artificial perfect crossfire was introduced. A valid M1 radio contact is required for TDM flanking. Bomb coordination intentionally does not replace existing objective role scoring or advanced multi-BOT synchronized attacks (M5 scope). Tests use production source in Node VM and a synthetic obstacle, **not a real browser performance trace**. CPU timing includes VM and mock overhead; it is not FPS.

**Decision:** M4 **CORE VERIFIED** via [Windows CI #134](https://github.com/Heynode92/blockbudies/actions/runs/41175339049) **332/332 PASS** and explicit owner-reported **7/7 manual smoke PASS**. Per-map/faction sample metadata, crossfire metrics, congestion time and browser FPS remain **NOT MEASURED**; acceptance does not certify numerical KPIs. The owner subsequently authorized M5 as a distinct Bomb fidelity milestone.

## User review (Windows only)

After `git pull origin main`, open `index.html` as usual (no Node, Docker, WSL, backend or build). In TDM, observe Police/Terrorist teams after one BOT spots an opponent and squadmates temporarily lose direct LOS: different BOTs may investigate from distinct angles, entry delays must be short, and teammates should avoid occupying identical paths. Verify they still shoot legally and do not freeze around obstacles. In Bomb Mission, verify escort/plant/defuse/retake and round outcomes continue unchanged; particularly watch urgent objective interactions and crowded corridors. Report **“M4 playtest PASS”** only if tested, or describe the affected mode/map and problem.
