# BLOCK BUDDIES — BOT AI Implementation Log

> **Document ID:** BB-AI-LOG-001  
> **Status:** PLANNED / ZERO AI FEATURE UPGRADES IMPLEMENTED UNDER THIS ROADMAP  
> **Created:** 2026-10-30  
> **Audited baseline commit:** `23cd2bb71a2535de86ba49ccdfc3d23455be2ff9`  
> **Master specification:** [BOT_AI_MASTER_PLAN.md](BOT_AI_MASTER_PLAN.md)  
> **Tracking rule:** A feature is not complete unless code, tests, measured evidence and committed release notes are recorded.

## 1. Executive status

This log is intended as the **single handoff tracker** for future assistants and maintainers. The 2026-10-30 request authorized **planning and documentation only**. The existing AI, weapon balance, UI, audio, modes, and runtime were **not upgraded** by creating these documents.

**NEXT MILESTONE: M0 — Baseline & harness.** Read the master plan in full, verify the current branch and test infrastructure, establish reproducible scenarios, then propose the first implementation to the repository owner.

| ID | Priority | Milestone | Status | Evidence / blocker |
|---|---|---|---|---|
| M0 | P0 | Baseline, deterministic tests and performance harness | NOT STARTED | Investigate outdated `footstepAdvance` mock in `tests/bot-five-star.test.mjs`; measure baseline before tuning |
| M1 | P0 | Legitimate perception, acoustic events, memory and team intel | NOT STARTED | Requires M0 |
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
- `tests/bot-five-star.test.mjs` — mock dependency may be stale following `footstepAdvance()` integration; confirm by executing tests on current `main`.

**Measured gameplay KPIs:** NONE RECORDED. **Full regression suite:** NOT EXECUTED FOR THIS DOCUMENTATION CHANGE. These are explicit gaps, not implicit passes.

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

Append every future milestone entry, including failed attempts, reverted changes, measured regressions, decisions and outstanding risk. Never rewrite a past released outcome to hide a failure.

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

- [ ] M0: reproducible scenario baseline and test mock compatibility established.
- [ ] M1: AI never acts on forbidden hidden enemy live coordinates; sound and memory tests pass.
- [ ] M2: actual 3D ballistic aim and bounded reactions verified with meaningful accuracy measurements.
- [ ] M3: cover/movement and collision tests pass, no endless jitter or wall clipping.
- [ ] M4: coordinated squad behavior demonstrated without global position leakage.
- [ ] M5: both Bomb teams complete valid objectives and edge cases within existing rules.
- [ ] M6: TDM and weapon categories behave competitively, preserving BOT RPG exclusion.
- [ ] M7: all automated tests, browser playtests, performance and bundle checks pass; release recorded.

No box above is checked on 2026-10-30. A new chat/assistant must **not** infer roadmap completion from this file's existence.

## 7. Next assistant: exact first action

**Read `docs/BOT_AI_MASTER_PLAN.md`, then inspect current GitHub `main`, fix/verify the M0 test-harness baseline, and report current measurable BOT behavior before changing combat AI.** Do not silently implement M1–M7 or claim they are done. Obtain the owner's request for the implementation milestone and document the commit plus evidence here.
