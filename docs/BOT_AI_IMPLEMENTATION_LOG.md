# BLOCK BUDDIES — BOT AI Implementation Log

> **Document ID:** BB-AI-LOG-001  
> **Status:** M0 VERIFIED (FOUNDATION EXIT GATE); M1 READY/NOT STARTED; EXTENDED LIVE-GAME KPIs STILL OPEN; ZERO AI GAMEPLAY UPGRADES RELEASED  
> **Created:** 2026-10-30  
> **Audited baseline commit:** `23cd2bb71a2535de86ba49ccdfc3d23455be2ff9`  
> **Master specification:** [BOT_AI_MASTER_PLAN.md](BOT_AI_MASTER_PLAN.md)  
> **Tracking rule:** A feature is not complete unless code, tests, measured evidence and committed release notes are recorded.

## 1. Executive status

This log is intended as the **single handoff tracker** for future assistants and maintainers. The 2026-10-30 request authorized **planning and documentation only**. The existing AI, weapon balance, UI, audio, modes, and runtime were **not upgraded** by creating these documents.

**M0 BASELINE FOUNDATION VERIFIED** against the exact exit gate in [Master Plan](BOT_AI_MASTER_PLAN.md): real active BOT functions run in seeded tests, behavior traces are reproducible, baseline dispatch/navigation counts and synthetic per-tick CPU samples are measured, and gameplay source is unchanged. [Windows CI #38](https://github.com/Heynode92/blockbudies/actions/runs/41105582716) **SUCCESS (289/289 Node tests)**; owner reported **8/8 core gameplay smoke checks PASS**. **M1 READY (NOT STARTED).** Real browser FPS/p95, real hit percentage, true reaction latency, navigation/stuck rate, statistically sampled Bomb outcomes and all map/faction scenarios are **NOT MEASURED / OPEN**; their absence must not be represented as a successful KPI. The next phases must measure those metrics before claiming improvements and final M7 release.

| ID | Priority | Milestone | Status | Evidence / blocker |
|---|---|---|---|---|
| M0 | P0 | Baseline, deterministic tests and performance harness | VERIFIED (FOUNDATION EXIT GATE) | Seeded behavioral + CPU tick baseline: [M0 Baseline](BOT_AI_M0_BASELINE.md); [Windows CI #38](https://github.com/Heynode92/blockbudies/actions/runs/41105582716) 289/289 PASS; owner smoke 8/8 PASS. Real browser/aim/reaction/navigation KPI fields stay explicitly open for future stages |
| M1 | P0 | Legitimate perception, acoustic events, memory and team intel | READY / NOT STARTED | M0 foundation exit gate verified; needs distinct implementation and tests |
| M2 | P0 | Real 3D aiming, reaction and per-weapon firing discipline | NOT STARTED | Requires M1 |
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
- [ ] M1: AI never acts on forbidden hidden enemy live coordinates; sound and memory tests pass.
- [ ] M2: actual 3D ballistic aim and bounded reactions verified with meaningful accuracy measurements.
- [ ] M3: cover/movement and collision tests pass, no endless jitter or wall clipping.
- [ ] M4: coordinated squad behavior demonstrated without global position leakage.
- [ ] M5: both Bomb teams complete valid objectives and edge cases within existing rules.
- [ ] M6: TDM and weapon categories behave competitively, preserving BOT RPG exclusion.
- [ ] M7: all automated tests, browser playtests, performance and bundle checks pass; release recorded.

**Only M0 FOUNDATION is VERIFIED against its stated exit gate.** M1–M7 are not implemented. Advanced browser and live-match KPI checkboxes remain OPEN; no assistant may claim those metrics are verified without raw samples. 'Verified foundation' does not mean a production-quality BOT upgrade is released.

## 7. Next assistant: exact first action

**M0 foundation is verified against its Master Plan exit gate.** Read the Master Plan + measured [M0 Baseline](BOT_AI_M0_BASELINE.md), check the latest main and [Windows CI #38](https://github.com/Heynode92/blockbudies/actions/runs/41105582716), then implement **M1 perception + legitimate knowledge** only when requested, keeping live browser FPS/real hit-rate/reaction/navigation measurements as clearly OPEN follow-ups. Do not silently change gameplay balance, damage, map, UI or Bomb rules; document tests/commit for each milestone.
