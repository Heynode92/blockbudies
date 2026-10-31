# BLOCK BUDDIES — BOT AI Implementation Log

> **Document ID:** BB-AI-LOG-001  
> **Status:** M0–M4 VERIFIED (CORE; M4 OWNER 7/7 PASS) / M5 IMPLEMENTED + CI VERIFIED, OWNER PLAYTEST PENDING / M6–M7 NOT STARTED  
> **Created:** 2026-10-30  
> **Audited baseline commit:** `23cd2bb71a2535de86ba49ccdfc3d23455be2ff9`  
> **Master specification:** [BOT_AI_MASTER_PLAN.md](BOT_AI_MASTER_PLAN.md)  
> **Tracking rule:** A feature is not complete unless code, tests, measured evidence and committed release notes are recorded.

## 1. Executive status

This log is intended as the **single handoff tracker** for future assistants and maintainers. The 2026-10-30 request authorized **planning and documentation only**. The existing AI, weapon balance, UI, audio, modes, and runtime were **not upgraded** by creating these documents.

**M0 BASELINE FOUNDATION VERIFIED** against the exact exit gate in [Master Plan](BOT_AI_MASTER_PLAN.md): real active BOT functions run in seeded tests, behavior traces are reproducible, baseline dispatch/navigation counts and synthetic per-tick CPU samples are measured, and gameplay source is unchanged. [Windows CI #38](https://github.com/Heynode92/blockbudies/actions/runs/41105582716) **SUCCESS (289/289 Node tests)**; owner reported **8/8 core gameplay smoke checks PASS**. **M1 IMPLEMENTED / AUTOMATED VERIFIED**: legitimate LOS snapshots, 3.6s memory, 2.4s team radio, bounded audio evidence and Bomb knowledge isolation are committed and Windows [CI #67](https://github.com/Heynode92/blockbudies/actions/runs/41108118435) passed 297/297 tests. **M1 owner-reported manual smoke PASS (2026-10-31 WIB); the scoped M1 core exit gate is VERIFIED.** [Full M1 acceptance record](BOT_AI_M1_VALIDATION.md). Individual maps, scenarios and browser telemetry were not provided. Real browser FPS/p95, real hit percentage, true reaction latency, navigation/stuck rate, statistically sampled Bomb outcomes and all map/faction scenarios are **NOT MEASURED / OPEN**; their absence must not be represented as a successful KPI. **M2 IMPLEMENTED / AUTOMATED VERIFIED:** genuine vertical BOT projectile velocity, capped aim turns, 180–460 ms intended reaction window and per-class bullet dispersion; [CI #93](https://github.com/Heynode92/blockbudies/actions/runs/41173731387) **306/306 PASS**. **M2 owner 7/7 manual smoke PASS, core exit gate VERIFIED. M3 owner-reported 7/7 manual playtest PASS, core exit gate VERIFIED** (prior [CI #118](https://github.com/Heynode92/blockbudies/actions/runs/41174607049), 318/318). **M4 squad roles, radio-only flank, timed entry and teammate lane deconfliction IMPLEMENTED + CI VERIFIED** ([Windows #129](https://github.com/Heynode92/blockbudies/actions/runs/41175122544), 332/332 PASS); **M4 owner-reported 7/7 manual playtest PASS, core exit gate VERIFIED.** See [M4 validation](BOT_AI_M4_VALIDATION.md). **M5 Bomb tactical decision layer IMPLEMENTED + CI VERIFIED** ([Windows run #149](https://github.com/Heynode92/blockbudies/actions/runs/41175963944), 346/346 PASS), with owner M5 gameplay PENDING. See [M5 validation](BOT_AI_M5_VALIDATION.md). The next phases must measure the remaining live-match KPIs before claiming superior accuracy or final M7 release.

| ID | Priority | Milestone | Status | Evidence / blocker |
|---|---|---|---|---|
| M0 | P0 | Baseline, deterministic tests and performance harness | VERIFIED (FOUNDATION EXIT GATE) | Seeded behavioral + CPU tick baseline: [M0 Baseline](BOT_AI_M0_BASELINE.md); [Windows CI #38](https://github.com/Heynode92/blockbudies/actions/runs/41105582716) 289/289 PASS; owner smoke 8/8 PASS. Real browser/aim/reaction/navigation KPI fields stay explicitly open for future stages |
| M1 | P0 | Legitimate perception, acoustic events, memory and team intel | VERIFIED (CORE EXIT GATE) | [M1 validation and owner acceptance](BOT_AI_M1_VALIDATION.md), [Windows CI #72](https://github.com/Heynode92/blockbudies/actions/runs/41108545600): 297/297 PASS; owner-reported M1 manual smoke PASS (2026-10-31 WIB). Quantitative live gameplay KPIs remain OPEN |
| M2 | P0 | Real 3D aiming, reaction and per-weapon firing discipline | VERIFIED (CORE EXIT GATE) | [M2 validation](BOT_AI_M2_VALIDATION.md), [CI #98](https://github.com/Heynode92/blockbudies/actions/runs/41173880185) 306/306 PASS, owner-reported **7/7 M2 playtest PASS**; live hit/reaction/FPS metrics still OPEN |
| M3 | P1 | Locomotion, dodge, peek, reposition and offensive cover | VERIFIED (CORE EXIT GATE) | [M3 validation](BOT_AI_M3_VALIDATION.md); owner-reported **7/7 gameplay PASS** for both modes, M3 cover/dodge/collision and Bomb integrity; [Windows CI #118](https://github.com/Heynode92/blockbudies/actions/runs/41174607049) 318/318 PASS; measured real-map stuck/FPS still open |
| M4 | P1 | Squad roles, crossfire, flank and coordination | VERIFIED (CORE EXIT GATE) | [M4 acceptance](BOT_AI_M4_VALIDATION.md), [Windows CI #134](https://github.com/Heynode92/blockbudies/actions/runs/41175339049) 332/332 PASS; owner-reported **7/7 M4 gameplay PASS**; numerical real-map crossfire/congestion/FPS still OPEN |
| M5 | P1 | Police/Terrorist Bomb-specific objectives and retake fidelity | IN PROGRESS (IMPLEMENTED + CI VERIFIED) | [M5 validation](BOT_AI_M5_VALIDATION.md); [Windows CI #149](https://github.com/Heynode92/blockbudies/actions/runs/41175963944) 346/346 PASS. Original Bomb scoring/timers/rules untouched; owner Bomb gameplay and quantitative outcomes OPEN |
| M6 | P1 | TDM aggression, routing and weapon-class adaptations | NOT STARTED | Requires M2–M4 |
| M7 | P0 | Seeded QA, tuning, performance, browser and release validation | NOT STARTED | Requires prior milestones |

**Status values:** NOT STARTED → IN PROGRESS → BLOCKED → VERIFIED → RELEASED. No milestone may skip verification. If work is partial, retain IN PROGRESS and list exact missing gates.

## 2. Baseline audit record (2026-10-30)

**Reviewed live source at baseline**, not simulated live-match outcomes:

- `src/game/90-bot-ai.js` — A* and active `botsUpd()`, simple distance/LOS acquisition and timed strafe choices; `botsUpdOld()` is unused.
- `src/game/41-bot-weapons.js` — canonical weapon selection, magazine/reload/grenade logic and horizontally randomized aim.
- `src/game/45-combat.js` — shared projectile spawning; existing normal BOT shots do not use a full vertical aim solution.
- `src/game/89-bot-tactical-intelligence.js` — LOS memory, low-HP/reload cover, retreat and simple combat movement scaling.
- `src/game/87-bomb-tactics.js` — useful objective roles but several threat decisions can inspect true positions of opponents not currently visible.
- `src/game/86-bomb-mission.js` — existing objective interaction and round rules must remain untouched.
- `src/game/66-footsteps.js` — audio playback only, not an AI hearing system.
- `tests/bot-five-star.test.mjs` — `footstepAdvance()` mock was repaired in `5e7bd587`; M0 fixture reuses the active AI sources. The complete Node suite and bundle checks passed in Windows Actions run #26.

**Measured real-game KPIs:** NONE RECORDED (manual qualitative smoke observations are not quantitative KPI data). **Owner-reported manual smoke:** 8/8 basic TDM/Bomb checks PASS, 2026-10-31 WIB. **Synthetic dispatch/navigation observations:** [M0 Baseline](BOT_AI_M0_BASELINE.md) (not real hits, plant/defuse outcomes or browser FPS). **Full Node regression suite:** VERIFIED SUCCESS on Windows Actions [run #26](https://github.com/Heynode92/blockbudies/actions/runs/41096566590), following repair of test fixture dependencies and historically stale assertions. These are explicit gaps, not implicit passes.

## 3. Immutable ownership and review gates

- Preserve Police and Terrorist parity in physics, perception, aim/error and damage. Different objectives are expected; cheating is prohibited.
- Keep BOT RPG exclusion and kill-grenade reward removal intact.
- Never change weapon damage/falloff, reload/reserves, hitboxes, projectile collision, movement physics, room/mode settings, Bomb rules, respawn/death, UI or assets without separate explicit approval.
- Use the canonical active functions (`botsUpd`, `fire`, `resolve`, `los`, `bombAct`) and existing code ownership. Do not revive unused legacy AI accidentally.
- Keep offline direct-open compatibility for Windows (`index.html` + committed `assets/game.js`). No need for user-side Node, build, server, WSL or Docker.
- Add per-milestone tests and retain original fixture, update `CHANGELOG.md`, verify commit and branch ref.

## 4. Change journal

| Date (UTC) | Milestone | Action | Files / evidence | Result |
|---|---|---|---|---|
| 2026-10-30 | Planning | Static audit of active BOT, weapons, Bomb tactics and tests; master upgrade specification established. | `docs/BOT_AI_MASTER_PLAN.md`, this tracker, documentation links | **PLAN ONLY**; no gameplay code changed |
| 2026-10-30 | M0 | Created seeded real-function 10-BOT synthetic TDM/Bomb runner and six targeted regression checks; validated equivalent V8 replay (same-seed deterministic; blocked LOS emits 0 fire dispatches; both teams progress); wrote baseline and limitations. | `tools/bot-ai-m0-baseline.mjs`, `tests/bot-ai-m0-baseline.test.mjs`, `docs/BOT_AI_M0_BASELINE.md`; baseline commit `5e7bd58` | **IN PROGRESS**; no runtime change; Node full test, real browser playtests and true KPIs pending |
| 2026-10-30 | M0 QA automation | Added Windows GitHub Actions on main/PR/manual dispatch with Node 22 and offline build/test checks. Initial runs #1–#5 failed at bundle sync. | `.github/workflows/bot-ai-m0.yml`, commit `e5c6ba22`; [run #3](https://github.com/Heynode92/blockbudies/actions/runs/41085174072) | **FAILURE INVESTIGATED; diagnostic added** |
| 2026-10-30 | M0 bundle sync | Reproduced exact one-extra-newline mismatch between `65-audio.js` and `66-footsteps.js` in generated `assets/game.js`; corrected only generated separator (one deleted blank line). CI bundle and syntax checks then passed. | `assets/game.js`, `tools/bot-ai-ci-diagnose.mjs`, workflow; commit `6664ee13`; [run #6](https://github.com/Heynode92/blockbudies/actions/runs/41094812497) | **BUNDLE PASS**; game logic unchanged |
| 2026-10-30 | M0 legacy regression recovery | Full Windows suite revealed 41 failures/288 tests, including missing test mocks (`WP`, `los`, `bloodHit`, radar dependency), stale weapon count/array position assertions, outdated ADS syntax and removed BOT RPG expectation. Updated **test fixtures and assertions only** to preserve actual approved game contracts; no gameplay mechanics changed. | `tests/*.test.mjs` regression fixes; [run #6](https://github.com/Heynode92/blockbudies/actions/runs/41094812497) → [run #26](https://github.com/Heynode92/blockbudies/actions/runs/41096566590) | **FULL WINDOWS CI SUCCESS**; automated checks and baseline JSON step green |

| 2026-10-30 UTC / 2026-10-31 WIB | M0 manual smoke test | Repository owner reports 4/4 Deathmatch and 4/4 Bomb Mission basic playtest observations PASS; details below. This is a **user-reported qualitative result**, not independently instrumented telemetry. | Owner report in project conversation; current Windows CI [run #30](https://github.com/Heynode92/blockbudies/actions/runs/41097051520) SUCCESS at pre-report head `4df8c9f` | **MANUAL CORE SMOKE 8/8 PASS; M0 STILL IN PROGRESS** — browser/OS version, maps, rounds, seeds, KPI samples and performance trace not recorded |

| 2026-10-30 UTC / 2026-10-31 WIB | M0 foundation acceptance | Added optional non-mutating `botsUpd` tick timing, developer-only synthetic 10-BOT CPU benchmark (720 samples × 3 scenarios; seeded trace preserved); `node --test` now 289/289 PASS; full Windows CI success. Master Plan M0 exit gate met. Actual live browser FPS, real accuracy, true reaction, navigation and Bomb win-rate measurements remain explicitly open and belong to subsequent milestone evaluation. | `tools/bot-ai-m0-baseline.mjs`, `tools/bot-ai-m0-performance.mjs`, `tests/bot-ai-m0-baseline.test.mjs`, `.github/workflows/bot-ai-m0.yml`; [CI #38](https://github.com/Heynode92/blockbudies/actions/runs/41105582716), performance commit `2dead68` | **M0 FOUNDATION VERIFIED; M1 READY (NOT STARTED); no gameplay changes** |

| 2026-10-30 UTC / 2026-10-31 WIB | M1 perception implementation | Added real sight snapshots with provenance/TTL, team radio, acoustic evidence on real gunfire/grounded footsteps, TDM investigation, Bomb anti-omniscience decision helpers and round-reset cleanup. Preserved canonical bullets/damage/plant/defuse/weapon balance. M1 tests cover occluded movement, radio, hearing, observer-only Bomb chase, event emitter integrations. One-shot Windows bundle builder was removed after creating canonical browser asset. | [M1 validation](BOT_AI_M1_VALIDATION.md); `src/game/88-bot-perception.js`, `src/game/90-bot-ai.js`, `src/game/89-bot-tactical-intelligence.js`, `src/game/87-bomb-tactics.js`, `src/game/66-footsteps.js`, `src/game/45-combat.js`, `assets/game.js`, `tests/bot-ai-m1-perception.test.mjs`; [CI run #67](https://github.com/Heynode92/blockbudies/actions/runs/41108118435) | **IMPLEMENTED / AUTOMATED VERIFIED: 297/297 PASS. Manual browser M1 gameplay and real KPI verification PENDING.** |

| 2026-10-31 WIB | M1 owner acceptance and core exit-gate decision | Owner explicitly reported "M1 playtest pasa bro" after request for post-update manual gameplay validation. Recorded **aggregate owner-reported manual PASS**; specific map/faction/LOS/hearing/Bomb session results and numerical FPS/accuracy/reaction/navigation metrics were not supplied. Independent source regression and bundle checks passed on latest code. | [M1 validation](BOT_AI_M1_VALIDATION.md); owner report in project conversation; [Windows CI #72](https://github.com/Heynode92/blockbudies/actions/runs/41108545600) on code/docs head `79919e9`, **297/297 PASS** | **M1 CORE EXIT GATE VERIFIED; M2 READY / NOT STARTED; quantitative KPIs and detailed scenario matrix remain OPEN.** |

| 2026-10-31 WIB | M2 3D fire-control implementation | Owner asked whether to implement M2+M3 at once; chose **sequentially, M2 first** to isolate aim/physics regression. Implemented `src/game/40-bot-aim.js` (bounded 3D yaw/pitch, first-sighting delay, legal visible target velocity, limited lead, class-specific shot dispersion, no instant snap), wired BOT shooting through existing `fire()` vertical velocity and canonical ammo/CD, preserved player shots, M1 LOS, Bomb objective mechanics. 9 focused M2 tests + all legacy regressions pass; bundle regenerated in Windows CI and temporary builder removed. | [M2 validation](BOT_AI_M2_VALIDATION.md); `src/game/40-bot-aim.js`, `src/game/41-bot-weapons.js`, `src/game/45-combat.js`, `src/game/90-bot-ai.js`, `assets/game.js`, `tools/source-manifest.json`; [Windows CI #93](https://github.com/Heynode92/blockbudies/actions/runs/41173731387) | **M2 IMPLEMENTED + AUTOMATED VERIFIED 306/306 PASS. User gameplay and live aim/FPS telemetry pending. M3 NOT STARTED.** |

| 2026-10-31 WIB | M2 owner acceptance | Owner explicitly confirmed seven of seven M2 gameplay checks PASS: vertical shooting, finite reaction, imperfect target leading, no shots through wall, both teams combat, Bomb objective and round completion, no freeze/crash/perceptible severe lag. | Owner playtest in project conversation; [M2 validation](BOT_AI_M2_VALIDATION.md); [Windows CI #98](https://github.com/Heynode92/blockbudies/actions/runs/41173880185), 306/306 PASS | **M2 CORE EXIT GATE VERIFIED; real quantified FPS/hit/reaction statistics OPEN** |
| 2026-10-31 WIB | M3 movement/cover implementation | Implemented separate `88-bot-movement.js` for damaged-BOT reachable cover, finite hold/peek against M1 last-known snapshots, damage-triggered dodge, bounded velocity smoothing, obstacle probing and axis slide through canonical `resolve()`, stuck monitoring/repath/cooldown, and respawn reset. Removed unsafe TDM direct-wall fallback when A* has no path. Added 12 focused synthetic tests including actual A* obstacle routing and unreachable-goal fail-closed. M0 fixture now records **ever-retreated** BOTs separately from last-frame status; 10/10 low-HP BOTs retreated at least once in seeded fixture. Original Bomb, damage, weapon and M1/M2 tests retained. | [M3 validation](BOT_AI_M3_VALIDATION.md); `src/game/88-bot-movement.js`, `90-bot-ai.js`, `85-lobby-and-match.js`, `assets/game.js`, M3 tests and M0 fixture; [Windows CI #112](https://github.com/Heynode92/blockbudies/actions/runs/41174449879) | **M3 IMPLEMENTED + AUTOMATED VERIFIED, 318/318 PASS; Windows gameplay/actual navigation/FPS evidence PENDING** |

| 2026-10-31 WIB | M3 owner acceptance / gate | Owner explicitly submitted **M3 playtest 7/7 PASS** after playing both modes: natural strafe/dodge; cover then re-engage; no visible obstacle clipping or persistent jitter/stuck; M2 firing while moving intact; plant/defuse/retake work; no severe perceived lag/crash. Aggregate qualitative report; exact maps, duration, measured stuck/FPS data not supplied. | Owner report in project conversation; [M3 acceptance](BOT_AI_M3_VALIDATION.md); [CI #118](https://github.com/Heynode92/blockbudies/actions/runs/41174607049) **318/318 PASS** | **M3 CORE EXIT GATE VERIFIED; quantitative navigation/cover/FPS remains OPEN** |
| 2026-10-31 WIB | M4 team coordination implementation | Added independent `src/game/88-bot-squad.js`: deterministic friendly role allocation (entry/flank-left/flank-right/support), authentic M1 radio TTL/provenance guard, distinct reachable TDM flank candidates with A* reservations and throttling, short bounded entry wait, friendly same-team lane deconfliction in both TDM and Bomb. Preserved M3 collision/cover, M2 aim, M1 anti-omniscience, Bomb objectives, reload, weapons, scoring and all player UI. Updated respawn reset, source manifest and committed direct-open browser bundle. **14 M4 targeted tests** include production M1 sight-generated report and A* around a synthetic wall; entire Windows suite passes. | [M4 validation](BOT_AI_M4_VALIDATION.md); `src/game/88-bot-squad.js`, `90-bot-ai.js`, `85-lobby-and-match.js`, `assets/game.js`, `tools/source-manifest.json`, `tests/bot-ai-m4-squad.test.mjs`; [CI #129](https://github.com/Heynode92/blockbudies/actions/runs/41175122544) | **M4 IMPLEMENTED + AUTOMATED VERIFIED: 332/332 PASS. Manual Windows squad/Bomb smoke and real crossfire/congestion/FPS metrics PENDING. M5 NOT STARTED.** |

| 2026-10-31 WIB | M4 owner acceptance and core gate | Owner explicitly reported **M4 playtest 7/7 PASS** after real gameplay: teamwork, distinct flank routes, no persistent teammate congestion/slow entry, legal enemy knowledge, normal Bomb plant/defuse/retake and no severe perceived FPS/crash regression. Self-reported qualitative checks; exact map, browser, round count and measured FPS/congestion metrics were not supplied. | [M4 validation](BOT_AI_M4_VALIDATION.md); [Windows CI #134](https://github.com/Heynode92/blockbudies/actions/runs/41175339049), 332/332 PASS | **M4 CORE EXIT GATE VERIFIED; numerical live-match KPI fields still OPEN** |
| 2026-10-31 WIB | M5 Bomb objective intelligence | Created decision-only `src/game/86-bomb-intelligence.js` alongside canonical unchanged `86-bomb-mission.js` and `11-bomb-map.js`. Carrier may switch between reachable sites at most once per round on credible M1 visual/radio threat; critical-fuse Police defuse assignment prefers viable nearby officer without interrupting live defuse; low-HP-aware dropped recovery, spaced post-plant defenders and nearby retake supporters. Fail-closed A*, finite caches, per-round/respawn reset. Original 5s plant/7s defuse/40s fuse, scoring, damage, TDM and player/UI unchanged. 14 new targeted M5 tests plus all old Bomb/AI tests; fixtures updated to load M5 dependency rather than disabled. | [M5 validation](BOT_AI_M5_VALIDATION.md), `src/game/86-bomb-intelligence.js`, `src/game/87-bomb-tactics.js`, `src/game/85-lobby-and-match.js`, `tools/source-manifest.json`, `assets/game.js`; [Windows CI #149](https://github.com/Heynode92/blockbudies/actions/runs/41175963944), **346/346 PASS** | **M5 IMPLEMENTED + AUTOMATED VERIFIED, owner Windows Bomb gameplay and measured round outcome/FPS KPIs PENDING. M6 NOT STARTED.** |

Append every future milestone entry, including failed attempts, reverted changes, measured regressions, decisions and outstanding risk. Never rewrite a past released outcome to hide a failure.

## M0 partial checklist (2026-10-30)

- [x] Active BOT, weapon and Bomb tactical module ownership verified; legacy `botsUpdOld` excluded.
- [x] Existing `footstepAdvance` test mock verified repaired at `5e7bd58`.
- [x] Seeded synthetic 5-vs-5 BOT TDM / Bomb fixture added (not the playable human+BOT configuration).
- [x] Repeated controlled V8 source replay; six focused assertions passed in equivalent harness; synthetic observation table saved.
- [x] Added Windows-only GitHub Actions verification workflow (`.github/workflows/bot-ai-m0.yml`): bundle, syntax, full Node suite, synthetic trace.
- [x] GitHub Actions Windows run green, every job step verified: [run #26](https://github.com/Heynode92/blockbudies/actions/runs/41096566590).
- [x] Native Windows `node --test` complete regression suite succeeded, `node tools/build.mjs --check` and `node --check assets/game.js` passed in Actions run #26. The six new M0 tests also passed.
- [x] **Owner-reported basic manual smoke test:** 4/4 Deathmatch + 4/4 Bomb Mission core checks PASS (2026-10-31 WIB); this is qualitative manual evidence only.
- [x] Real production BOT update tick CPU baseline measured in synthetic 10-BOT fixtures (3 × 720 samples), GitHub Actions #38 289/289 PASS; NOT browser FPS.
- [ ] Real Windows browser map scenarios, FPS/p95, valid hits/reaction/stuck metrics and completed Bomb rounds measured.
- [ ] Final M0 acceptance review with same-seed baseline comparison and no gameplay regression.

See [M0 Baseline](BOT_AI_M0_BASELINE.md) for scenario inputs, numbers, command line and explicit unknown metrics.

## M0 owner-reported manual smoke test (2026-10-31 WIB)

**Evidence class:** owner self-report in project conversation; no automated instrumentation, recorded browser telemetry or independent gameplay reproduction. **Result:** 8/8 core smoke checks reported PASS.

| Mode | Owner-reported observation | Status |
|---|---|---|
| Deathmatch | Police and Terrorist BOTs can move and attack | PASS (reported) |
| Deathmatch | No BOT stuck in walls or objects observed | PASS (reported; no automated stuck metric) |
| Deathmatch | Shots and damage function | PASS (reported; no actual hit-rate measurement) |
| Deathmatch | No freeze or significant lag noticed | PASS (reported; no FPS/p95 measurement) |
| Bomb Mission | Terrorist BOT can plant a bomb | PASS (reported) |
| Bomb Mission | Police BOT can defuse the bomb | PASS (reported) |
| Bomb Mission | BOTs can attack and defend the bomb site | PASS (reported) |
| Bomb Mission | Rounds end according to the rules | PASS (reported) |

**Missing metadata:** exact Windows/browser version, map(s) visited, session duration, rounds/matches, player team(s), BOT count per live match, reproducible scenario seed, telemetry/logs. Do **not** infer coverage of both maps or both player factions from this report.

**Still OPEN (not checked):** actual FPS/frametime p95 and AI tick cost; shots fired vs hit percentage; target detection-to-action/reaction time; quantitative stuck/collision/path success; sample-based Bomb objective outcomes; reproducible per-map/per-team runs. No M1 code authorized/executed by logging this manual result.

## M0 acceptance decision and outstanding KPI scope (2026-10-31 WIB)

**Master Plan M0 exit gate:** automated active-source seeded harness runs; repeated deterministic behavior traces and baseline counts are recorded; synthetic update CPU sample baseline is measured; legacy gameplay does not regress. This gate is now **VERIFIED** with [Windows CI #38](https://github.com/Heynode92/blockbudies/actions/runs/41105582716), 289/289 passing Node tests and owner-reported 8/8 core smoke checks.

CPU benchmark: **10 synthetic BOTs; 720 measured frames per fixture on Windows Node v22.23.4.** TDM open LOS median/p95 = **0.4273/0.6937 ms**; TDM blocked LOS = **0.3258/1.5573 ms**; Bomb open LOS = **0.4719/0.7529 ms**. Values include Node VM and mock overhead. See [M0 Baseline](BOT_AI_M0_BASELINE.md) for reproducibility and caveats.

The original tracker combined a **foundational M0 exit gate** with **full live-match KPI evaluation** planned across M1–M7. Those are now tracked distinctly so a valid automated foundation does not block implementation indefinitely or falsely assert accuracy/FPS baselines. **No performance, accuracy, reaction, or automated navigation checkbox is checked** for real gameplay. These remain required before reporting corresponding improvements and final M7 verification.

Next milestone: **M1 perception, hearing, target memory and knowledge provenance**. Do not alter established weapon, damage, score, room, map, or Bomb rules.

## M1 implementation checklist (2026-10-31 WIB)

- [x] Approved owner scope: implement M1 in existing offline browser engine.
- [x] Replace omniscient Bomb nearest-enemy scans with observer-required snapshots.
- [x] Immediate current-target occlusion checks, personal sight history and bounded radio memory.
- [x] Footstep/gunshot cue emitted from canonical gameplay actions, not audio output state.
- [x] Auditory uncertainty, attenuation, event cap/expiry, no identity-based shooting.
- [x] Per-round personal/team memory reset.
- [x] Deterministic evidence/regression tests, integration checks, canonical `assets/game.js` parity, full Windows CI **297/297 PASS**.
- [x] Full dedicated M1 validation document and change journal.
- [x] Owner-reported post-M1 **overall manual gameplay smoke PASS** (2026-10-31 WIB). **Caveat:** user did not provide a per-mode/per-team/per-map result matrix or individual scenario evidence; do not invent detailed successes.
- [ ] Real browser FPS, hit-rate, reaction-time, stuck/path metrics and full multi-map matrix (these are NOT M1 CI pass evidence).

## M1 manual acceptance record (2026-10-31 WIB)

- [x] Previously green full Windows CI and M1 perception regression on committed source: [run #72](https://github.com/Heynode92/blockbudies/actions/runs/41108545600), **297 passed, zero failed**.
- [x] Owner explicitly reports **overall M1 playtest PASS** after pulling and testing gameplay; **self-report only**, not independently instrumented/observed.
- [x] M1 core Master Plan exit gate accepted based on test coverage + owner smoke sign-off.
- [ ] Detailed per-map/per-faction wall occlusion, footsteps, gunfire and Bomb objective playtest evidence, including duration and browser version — not provided.
- [ ] Real live-match browser FPS/p95, actual hit percentage, reaction latency, path/stuck metrics and Bomb objective statistics — not measured.

## M2 implementation checklist (2026-10-31 WIB)

- [x] Source-of-truth audit: active AI, canonical BOT weapon dispatch, user/projectile ballistics, vertical character hitboxes, M1 perception and M2 roadmap.
- [x] Independent `40-bot-aim.js` module: yaw/pitch, finite reaction, bounded turning, short lawful target-velocity lead, per-class angular error.
- [x] Projectile `vy` respects BOT aim; player projectile formula, damage, armor and bullet collision preserved.
- [x] No ammo subtraction or gunfire before aim permission; class-specific spread/cooldown and LOS enforced.
- [x] Reacquired target begins from current facing; no immediate 180° body heading snap.
- [x] Dedicated aim and actual canonical projectile regression tests passed; stable seed scenario captures nonzero BOT vertical pitch and zero shots behind blocked LOS.
- [x] Canonical direct-open bundle built and validated on Windows GitHub Actions; [run #93](https://github.com/Heynode92/blockbudies/actions/runs/41173731387) **306/306 PASS**, zero failed.
- [x] Dedicated [M2 validation report](BOT_AI_M2_VALIDATION.md).
- [x] Owner-reported **7/7 M2 playtest PASS (2026-10-31 WIB):** elevation aim, non-instant reaction, imperfect moving target tracking, no through-wall shooting, both factions combat, Bomb objectives/rounds and no freeze/crash/severe lag. Self-reported qualitative, not independent telemetry.
- [ ] Actual browser accuracy/headshot distributions by weapon/range/elevation, median/p95 first-shot reaction, FPS/frame-time and map/faction matrix.
- [x] **M2 CORE VERIFIED** via CI #98 306/306 and owner 7/7 manual PASS; M3 separately authorized and begun. Quantitative browser metrics still OPEN.

## M3 implementation checklist (2026-10-31 WIB)

- [x] Separate movement logic module, loaded after M1 perception and before tactical AI.
- [x] LOS/memory-aware lateral peek, timed hold, reachable damage-triggered cover and bounded dodge.
- [x] Safe obstacle probing, sliding and velocity smoothing; original collision resolve remains authoritative.
- [x] No direct-wall path fallback when A* fails; no teleport and no forced clipping.
- [x] Replan and cooldown on repeated stalls; per-spawn movement reset.
- [x] Preserve Bomb urgent carrier/retake/defuse priorities and critical HP retreat.
- [x] New 12 M3 focused tests; Windows [CI #112](https://github.com/Heynode92/blockbudies/actions/runs/41174449879) **318/318 PASS** with bundle parity, syntax and synthetic CPU checks.
- [x] **Owner-reported M3 7/7 playtest PASS (2026-10-31 WIB):** both teams strafe/dodge, cover/peek, no observed clipping or persistent jitter/stuck, M2 aiming intact, Bomb objectives work, no perceived freeze/crash/severe lag. Qualitative self-report, not instrumented telemetry.
- [ ] Quantified cover exposure, stuck/oscillation outcomes on real maps/factions, browser FPS/p95; no live-match telemetry yet.

## M4 implementation checklist (2026-10-31 WIB)

- [x] Active game source and M1 sight/radio, M2 aiming, M3 movement, Bomb tactical director audited before M4.
- [x] Standalone squad module registered in manifest and canonical `assets/game.js`.
- [x] Stable living-teammate entry/flank-left/flank-right/support roles for both factions, independent of the human player.
- [x] TDM flank only from authenticated, same-team, unexpired M1 `radio` sightings, never hidden live enemy coordinates; distinct role waypoints.
- [x] Reachable A* checked flank, bounded cooldown and fallback without wall traversal.
- [x] Short entry synchronization that cannot be extended indefinitely by frequent new radio snapshots.
- [x] Friendly-lane separation in both modes; Bomb plant/defuse/retake/escort authority preserved with no squad goal override in Bomb.
- [x] Squad role/goal/timer reset on BOT spawn.
- [x] **14 M4 tests**, including real M1 observation→radio→flank expiration and real A* wall test; [Windows CI #129](https://github.com/Heynode92/blockbudies/actions/runs/41175122544) **332/332 PASS**, bundle/syntax/synthetic CPU baseline green.
- [x] Owner-reported **7/7 M4 manual gameplay PASS (2026-10-31 WIB):** teamwork, distinct flank lanes, no persistent congestion or squad deadlock, active attacks, no observed omniscience, Bomb plant/defuse/retake intact and no perceived freeze/crash/severe lag. Qualitative self-report, not measured live metrics.
- [ ] Quantified squad spacing/crossfire, congestion/role deadlock, map/faction samples, actual browser frame-time/FPS (not measured).
- [x] **M4 CORE VERIFIED** via Windows CI #134 332/332 and owner-reported 7/7 manual gameplay PASS. **M5 separately authorized and implemented; its manual acceptance is still pending.**

## M5 implementation checklist (2026-10-31 WIB)

- [x] M4 owner-reported **7/7 manual playtest PASS** and green Windows CI confirmed; M4 CORE VERIFIED.
- [x] Audit original Bomb rules (`11-bomb-map.js`), authoritative Bomb state/plant/defuse/round results (`86-bomb-mission.js`), tactical stage ownership (`87-bomb-tactics.js`), and M1 LOS/radio plus M3 A*.
- [x] Isolated `86-bomb-intelligence.js`: legal M1 sight/radio site threat, capped once-per-round reachable A/B switch, timed fuse-sensitive defuser prioritization without action-time modification, single dropped-device recoverer and non-stacked post-plant/retake support goals.
- [x] Preserved exact original weapon/damage/player control/movement/Bomb rules and stopped M5 from altering TDM tactical decisions.
- [x] Added 14 source-backed M5 tests spanning A/B selection, 1vX, contested/uncontested defuse, real 7-second defuse, carrier death/recoverer, time-limited LOS/radio and reachable post-plant support.
- [x] Existing full suite still enabled; [Windows CI #149](https://github.com/Heynode92/blockbudies/actions/runs/41175963944) **346/346 PASS**, zero failures, browser bundle parity, syntax and synthetic CPU checks.
- [ ] Owner live Windows Bomb playtest: carrier A/B decisions, dropped-bomb recovery/reassignment, post-plant defense, late-fuse retake, round scores/timing and game stability.
- [ ] Statistical real-match plant success by site, retake/defuse outcomes, genuine win distributions, FPS/p95 and collision/stuck/per-map samples.
- [ ] M5 CORE VERIFIED **only after owner manual acceptance**. M6 separately approved later.

## 5. Mandatory future entry template

Copy this block and fill actual, checkable evidence:

### YYYY-MM-DD — M# — Short title

- **Status:** NOT STARTED / IN PROGRESS / BLOCKED / VERIFIED / RELEASED
- **Scope approved by owner:** [quote/reference to instruction]
- **Baseline head SHA:** [SHA] → **New commit SHA:** [SHA]
- **Modules changed:** [exact paths and functions]
- **Observed current behavior:** [reproduction with seed/map/team]
- **Implemented behavior:** [what actually works, not planned]
- **Safety / fairness checks:** [LOS, no hidden coordinates, collision, ammo, objective invariants]
- **Automated tests:** [command, passed/failed counts, relevant filenames]
- **Manual gameplay validation:** [browser/OS, team/mode/map, steps and observed results; or NOT RUN]
- **Before/after KPIs:** [aim hit%, reaction ms, stuck seconds, Bomb result, frame-time p95 with samples; or NOT MEASURED]
- **Risks / follow-up:** [specific blocker]
- **Decision / next action:** [single next milestone or fix]

## 6. Milestone completion checklist

- [x] M0: foundational seeded real-function BOT replay, synthetic behavior + CPU measurement, test compatibility, Windows CI and core manual smoke verified against the Master Plan M0 exit gate. **Not a claim of real browser FPS, hit%, reaction or navigation KPI completion.**
- [x] M1: core perception/knowledge protection tests PASS, Windows CI #72 PASS (297/297), owner-reported post-update manual playtest PASS. **M1 core exit gate VERIFIED**; exact per-map/LOS/audio scenario results and quantitative FPS/accuracy/reaction/navigation KPIs are not established. See [M1 validation](BOT_AI_M1_VALIDATION.md).
- [x] M2: 3D pitch/yaw, reaction delay, LOS-fair leading and class dispersion VERIFIED for core gate by 306/306 CI and owner-reported manual **7/7 PASS**. Quantitative hit/reaction performance still OPEN. See [M2 validation](BOT_AI_M2_VALIDATION.md).
- [x] M3: core movement/collision milestone VERIFIED by Windows CI #118 318/318 and owner-reported **7/7 M3 gameplay PASS**. True map-wide stuck rate and frame-time KPIs remain OPEN. See [M3 validation](BOT_AI_M3_VALIDATION.md).
- [x] M4: 14 squad coordination tests Windows CI #134 **332/332 PASS**, authenticated radio and owner-reported **7/7 manual PASS**, so M4 core VERIFIED. True measured crossfire/congestion/FPS still OPEN. See [M4 validation](BOT_AI_M4_VALIDATION.md).
- [ ] M5: 14 new Bomb decision tests and legacy actual Bomb Mission rules/tests pass, Windows CI #149 **346/346 PASS**; manual M5 browser objective acceptance and statistically sampled Bomb outcomes remain OPEN. See [M5 validation](BOT_AI_M5_VALIDATION.md).
- [ ] M6: TDM and weapon categories behave competitively, preserving BOT RPG exclusion.
- [ ] M7: all automated tests, browser playtests, performance and bundle checks pass; release recorded.

**M0–M4 CORE VERIFIED (M4 owner 7/7 PASS). M5 IMPLEMENTED / AUTOMATED VERIFIED (346/346) but owner Windows gameplay PENDING; M6–M7 NOT STARTED.** Advanced browser and live-match KPI checkboxes remain OPEN; do not assert them verified without recorded samples. 'Verified foundation' does not mean a production-quality BOT upgrade is released.

## 7. Next assistant: exact first action

**M1 perception is VERIFIED for its core exit gate**: source tests (297/297 on Windows CI #72) plus owner-reported aggregate manual playtest PASS have been recorded in [M1 validation](BOT_AI_M1_VALIDATION.md). Owner has authorized M2 and M3 planning, with sequential implementation recommended and adopted. **M2/M3/M4 were VERIFIED after separate owner 7/7 manual acceptances. M5 is IMPLEMENTED / AUTOMATED VERIFIED (346/346 Windows regression, run #149), but owner M5 gameplay is PENDING.** Do not label M5 core VERIFIED or begin M6 without a separate owner instruction. Inspect actual source and preserve canonical projectile/weapon/objective systems. Keep real-browser FPS, hit%, reaction and navigation metrics OPEN for comparative QA; do not misrepresent user-reported smoke as per-scenario quantified evidence.
