# BLOCK BUDDIES — BOT AI Implementation Log

> **Document ID:** BB-AI-LOG-001  
> **Status:** M0/M1 VERIFIED (CORE) / M2 IMPLEMENTED + CI VERIFIED; MANUAL WINDOWS PLAYTEST PENDING / M3–M7 NOT STARTED  
> **Created:** 2026-10-30  
> **Audited baseline commit:** `23cd2bb71a2535de86ba49ccdfc3d23455be2ff9`  
> **Master specification:** [BOT_AI_MASTER_PLAN.md](BOT_AI_MASTER_PLAN.md)  
> **Tracking rule:** A feature is not complete unless code, tests, measured evidence and committed release notes are recorded.

## 1. Executive status

This log is intended as the **single handoff tracker** for future assistants and maintainers. The 2026-10-30 request authorized **planning and documentation only**. The existing AI, weapon balance, UI, audio, modes, and runtime were **not upgraded** by creating these documents.

**M0 BASELINE FOUNDATION VERIFIED** against the exact exit gate in [Master Plan](BOT_AI_MASTER_PLAN.md): real active BOT functions run in seeded tests, behavior traces are reproducible, baseline dispatch/navigation counts and synthetic per-tick CPU samples are measured, and gameplay source is unchanged. [Windows CI #38](https://github.com/Heynode92/blockbudies/actions/runs/41105582716) **SUCCESS (289/289 Node tests)**; owner reported **8/8 core gameplay smoke checks PASS**. **M1 IMPLEMENTED / AUTOMATED VERIFIED**: legitimate LOS snapshots, 3.6s memory, 2.4s team radio, bounded audio evidence and Bomb knowledge isolation are committed and Windows [CI #67](https://github.com/Heynode92/blockbudies/actions/runs/41108118435) passed 297/297 tests. **M1 owner-reported manual smoke PASS (2026-10-31 WIB); the scoped M1 core exit gate is VERIFIED.** [Full M1 acceptance record](BOT_AI_M1_VALIDATION.md). Individual maps, scenarios and browser telemetry were not provided. Real browser FPS/p95, real hit percentage, true reaction latency, navigation/stuck rate, statistically sampled Bomb outcomes and all map/faction scenarios are **NOT MEASURED / OPEN**; their absence must not be represented as a successful KPI. **M2 IMPLEMENTED / AUTOMATED VERIFIED:** genuine vertical BOT projectile velocity, capped aim turns, 180–460 ms intended reaction window and per-class bullet dispersion; [CI #93](https://github.com/Heynode92/blockbudies/actions/runs/41173731387) **306/306 PASS**. **M2 manual playtest PENDING, M3 NOT STARTED**. The next phases must measure the remaining live-match KPIs before claiming superior accuracy or final M7 release.

| ID | Priority | Milestone | Status | Evidence / blocker |
|---|---|---|---|---|
| M0 | P0 | Baseline, deterministic tests and performance harness | VERIFIED (FOUNDATION EXIT GATE) | Seeded behavioral + CPU tick baseline: [M0 Baseline](BOT_AI_M0_BASELINE.md); [Windows CI #38](https://github.com/Heynode92/blockbudies/actions/runs/41105582716) 289/289 PASS; owner smoke 8/8 PASS. Real browser/aim/reaction/navigation KPI fields stay explicitly open for future stages |
| M1 | P0 | Legitimate perception, acoustic events, memory and team intel | VERIFIED (CORE EXIT GATE) | [M1 validation and owner acceptance](BOT_AI_M1_VALIDATION.md), [Windows CI #72](https://github.com/Heynode92/blockbudies/actions/runs/41108545600): 297/297 PASS; owner-reported M1 manual smoke PASS (2026-10-31 WIB). Quantitative live gameplay KPIs remain OPEN |
| M2 | P0 | Real 3D aiming, reaction and per-weapon firing discipline | IN PROGRESS (IMPLEMENTED + CI VERIFIED) | [M2 validation](BOT_AI_M2_VALIDATION.md), [Windows CI #93](https://github.com/Heynode92/blockbudies/actions/runs/41173731387): 306/306 PASS; M2 owner playtest and measured real-match hit/reaction/FPS KPIs pending |
| M3 | P1 | Locomotion, dodge, peek, reposition and offensive cover | NOT STARTED | Requires M1–M2 |
| M4 | P1 | Squad roles, crossfire, flank and coordination | NOT STARTED | Requires M1–M3 |
| M5 | P1 | Police/Terrorist Bomb-specific objectives and retake fidelity | NOT STARTED | Requires M1–M4 |
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
- [ ] Owner Windows playable TDM/Bomb M2 review: actual elevated/lowered targets, moving target, turn/reaction/weapon feel, Bomb objectives.
- [ ] Actual browser accuracy/headshot distributions by weapon/range/elevation, median/p95 first-shot reaction, FPS/frame-time and map/faction matrix.
- [ ] M2 VERIFIED after manual acceptance; **M3 MUST NOT START before this gate**.

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
- [ ] M2: 3D pitch/yaw, reaction delay, LOS-fair leading and class dispersion **IMPLEMENTED and 306/306 regression PASS**; manual gameplay M2 acceptance and quantitative hit/reaction measures still OPEN. See [M2 validation](BOT_AI_M2_VALIDATION.md).
- [ ] M3: cover/movement and collision tests pass, no endless jitter or wall clipping.
- [ ] M4: coordinated squad behavior demonstrated without global position leakage.
- [ ] M5: both Bomb teams complete valid objectives and edge cases within existing rules.
- [ ] M6: TDM and weapon categories behave competitively, preserving BOT RPG exclusion.
- [ ] M7: all automated tests, browser playtests, performance and bundle checks pass; release recorded.

**M0 FOUNDATION VERIFIED, M1 CORE VERIFIED. M2 IMPLEMENTED / AUTOMATED VERIFIED (306/306) with manual Windows playtest PENDING; M3–M7 NOT STARTED.** Advanced browser and live-match KPI checkboxes remain OPEN; do not assert them verified without recorded samples. 'Verified foundation' does not mean a production-quality BOT upgrade is released.

## 7. Next assistant: exact first action

**M1 perception is VERIFIED for its core exit gate**: source tests (297/297 on Windows CI #72) plus owner-reported aggregate manual playtest PASS have been recorded in [M1 validation](BOT_AI_M1_VALIDATION.md). Owner has authorized M2 and M3 planning, with sequential implementation recommended and adopted. **M2 has been implemented and CI-tested; M3 remains NOT STARTED** until M2 manual acceptance and separate validation. Inspect actual source and preserve canonical projectile/weapon/objective systems. Keep real-browser FPS, hit%, reaction and navigation metrics OPEN for comparative QA; do not misrepresent user-reported smoke as per-scenario quantified evidence.
