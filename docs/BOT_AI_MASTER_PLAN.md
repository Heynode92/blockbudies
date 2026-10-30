# BLOCK BUDDIES — BOT Intelligence Modernization Master Plan

> **Document ID:** BB-AI-ROADMAP-001  
> **Status:** M0 FOUNDATION VERIFIED / M1 CORE EXIT GATE VERIFIED (CI + OWNER MANUAL PASS) / M2 READY NOT STARTED / M3–M7 NOT STARTED  
> **Baseline reviewed:** `main` at `23cd2bb71a2535de86ba49ccdfc3d23455be2ff9` (2026-10-30)  
> **Scope:** Police and Terrorist BOTs in Team Deathmatch (TDM) and Bomb Mission  
> **Source of truth:** repository production sources, `docs/ARCHITECTURE.md`, original-game fixture, existing test suite  
> **Progress tracker:** [BOT_AI_IMPLEMENTATION_LOG.md](BOT_AI_IMPLEMENTATION_LOG.md)  
> **M0 baseline evidence:** [BOT_AI_M0_BASELINE.md](BOT_AI_M0_BASELINE.md)  
> **M1 verification and manual checklist:** [BOT_AI_M1_VALIDATION.md](BOT_AI_M1_VALIDATION.md)

## 1. Product outcome

Deliver competitive-feeling, **aggressive, agile, accurate, tactically aware and believably human** AI opponents and teammates. Competence must come from perception, anticipation, positioning, target selection and coordinated decision-making—not omniscient map knowledge, perfect tracking, teleportation, damage buffs or artificial headshot guarantees.

All improvements must apply to **both teams**. Team-specific differences are limited to their existing legitimate Bomb Mission objectives: Police defend/retake/defuse; Terrorists escort/plant/defend/recover. Identical combat rules, perception restrictions, equipment rules, ballistic constraints and accuracy limits apply to both factions.

**Quality criteria:** challenging but readable, responsive but not instantaneous, adaptive but not random jitter, aggressive but not suicidal, accurate but beatable, and tactical without cheating.

This document is a **future gameplay implementation specification**, not evidence that any of the proposed behaviors exist today. M0 is now **verified for its foundational exit gate** using the deterministic synthetic active-BOT fixture, recorded behavior traces, sampled CPU tick timings, Windows CI [run #38](https://github.com/Heynode92/blockbudies/actions/runs/41105582716) (289/289 tests passing), and an owner-reported 8/8 core gameplay smoke test. M1 perception/knowledge improvements are implemented and pass [Windows CI #72](https://github.com/Heynode92/blockbudies/actions/runs/41108545600) (297/297 Node tests). The owner subsequently reported M1 manual gameplay **PASS** on 2026-10-31 WIB; M1's **scoped core exit gate is VERIFIED**. The owner's report was aggregate (individual maps, factions and test cases were not itemized). Real-game browser FPS/p95, true hit-rate, reaction latency, navigation/stuck rate, per-map/faction coverage and Bomb success-rate measurements are **still open**, not asserted done.

## 2. Hard constraints and non-goals

1. **Read existing code before editing.** Confirm current `main` and compare against this 2026-10-30 baseline; update the tracker if sources changed. Never implement from documentation alone.
2. **Preserve gameplay contracts:** original user-approved HP/armor/helmet/headshot damage, weapon profiles (`WP`), magazine/reserve counts, reload time, projectile physics/collision, kill scoring, death, drops, respawns, Bomb Mission plant/defuse/fuse/round rules, room settings, team composition, UI language and other features. Obtain explicit approval before changing any such mechanics.
3. **No silent BOT equipment changes.** RPG was explicitly removed from the BOT loadout pool; it remains available to players. The removed player kill-grenade reward must not be restored. New BOT equipment/loadouts require separate approval.
4. **No omniscience.** Only currently perceived enemies or bounded, decaying reports from valid observations may influence targeting or tactical pursuit. Do not use an opponent's live `x/z/y` after losing sight, including inside Bomb Mission helper functions.
5. **No shortcuts:** no wallbang without valid physics, guaranteed hits, synthetic damage multipliers, infinite ammo, invisible collision bypass, teleporting, instantaneous 180° aim snaps, unnatural reaction precision or forced match outcomes.
6. **Keep the existing browser delivery:** Windows user only pulls `main` and opens `index.html`. No Docker, WSL, development server, local build or local runner may be required for playing.
7. Keep `tools/source-manifest.json` module ordering valid; generate—not manually patch—the committed `assets/game.js`. Preserve the shared original IIFE scope and the immutable `tests/fixtures/source-original.html`.
8. No external API, ML runtime, background worker, telemetry, user tracking, third-party library or network dependency without explicit approval. Deterministic, local, explainable heuristic/utility-based AI is the target.
9. Make **small, independently testable commits**. Update `CHANGELOG.md`, this specification when requirements change, and [the implementation log](BOT_AI_IMPLEMENTATION_LOG.md) with test evidence for each completed milestone.
10. Plan only: this documentation task must not modify runtime JS, CSS, UI, game balance, difficulty labels, or assets.

## 3. Verified current baseline and audit findings

The following observations are based on reading repository code, **not** a comprehensive live-play or benchmark run. Treat each item as a starting diagnosis and reproduce it under tests before implementing a remedy.

| ID | Area | Existing implementation | Deficiency to address |
|---|---|---|---|
| AI-01 | Aim/fire | `botAttack()` adds random horizontal angular error; `fire()` uses the weapon's existing projectile and damage rules. | No dedicated target acquisition / aim convergence, target-velocity prediction or full 3D BOT firing solution; normal BOT bullets use zero vertical velocity except shotgun spread effects. |
| AI-02 | Combat movement | `botsUpd()` moves forward/back/sideways with timed random strafe direction and one-step collision resolution. | Predictable trajectories; no intentional peek/re-peek, entry timing, exposure management or smooth acceleration/turning. |
| AI-03 | Cover | `botSmartCover()` samples LOS-blocked, reachable candidates; `botSmartIntent()` retreats mainly on critical HP or reload. | Cover used too reactively; lacks offensive peek, escape-route assessment, cooldown-safe reposition and visibility-quality scoring. |
| AI-04 | Perception | Target acquisition uses distance + `los()`; TDM retains a short `lastSeen` location. | No explicit sight acquisition/confirmation, audibility-based suspicion, threat confidence, uncertainty, suppression response or shared observation provenance. |
| AI-05 | Bomb knowledge | `bombNearestOpponent()` and `bombNearestThreat()` read actual live opponent positions in `87-bomb-tactics.js`. | Tactical objective selection can be driven by unseen live enemies despite correct LOS gating of actual shooting. Replace with legitimate team-visible or remembered intel. |
| AI-06 | Squad roles | Police defuser/retake and Terrorist carrier/escort/recover/hold/intercept roles exist. | Some role choice and site selection depend on fixed bot index, not real context, teammate readiness or crossfire/lane ownership. |
| AI-07 | Acoustic intelligence | `66-footsteps.js` produces local spatialized sounds for listeners. | Audio playback is **not** BOT sensory perception; BOTs cannot yet investigate meaningful nearby footstep/gunshot events. |
| AI-08 | QA | `tests/bot-five-star.test.mjs` and Bomb tests cover isolated tactical cases. | No complete reproducible combat-replay KPI suite for aim, locomotion, team interactions, AI fairness or frame time. |
| AI-09 | Test compatibility | Active `botsUpd()` now calls `footstepAdvance()`. | The existing isolated `bot-five-star.test.mjs` sandbox does not appear to mock this dependency; **verify and fix test harness first**, without assuming a live runtime bug. |

### Exact code ownership

| Path | Responsibility / future extension point |
|---|---|
| `src/game/90-bot-ai.js` | **Active** `botsUpd()`, `GB`/A* pathfinding, pursuit and movement update. The `botsUpdOld()` block is legacy and **unused**. |
| `src/game/89-bot-tactical-intelligence.js` | Current `BOT_TACTICS`, LOS/memory, cover, retreat/reload decisions. |
| `src/game/41-bot-weapons.js` | BOT loadouts, ammo, reload, weapon choice, attack call to canonical `fire()` and grenade safety. |
| `src/game/87-bomb-tactics.js` | Police/Terrorist Bomb role and goal decisions; inspect functions accessing hidden enemy positions. |
| `src/game/86-bomb-mission.js` | **Authoritative in this offline game** Bomb objective state, carrier/drop, plant/defuse interaction, fuse and round outcome. |
| `src/game/45-combat.js`, `src/game/42-projectile-defense.js` | Shared projectile simulation, shot origin/direction and character hit handling; do not duplicate damage mechanics. |
| `src/game/weapon/20-ballistics.js`, `src/game/weapon/*` | Canonical weapon stats; player and BOT remain bound to the same profiles. |
| `src/game/60-impact-effects.js`, `src/game/20-sky-and-physics.js` | `los()`, physical obstacles/LOS sweeps and collision/ground calculations. |
| `src/game/66-footsteps.js`, `src/game/65-audio.js` | Footstep playback/gun SFX. Future sound **perception events** must be separate from playback, honoring geometry/occlusion and privacy of unseen state. |
| `src/game/85-lobby-and-match.js` | BOT spawn/reset/round integration; reset all new transient AI state. |
| `src/game/95-simulation.js` | Frame update order; stage AI work to avoid frame-time spikes. |
| `src/game/11-bomb-map.js` | Actual Bomb map, objectives and navigation geometry. |
| `tests/`, `tools/source-manifest.json`, `assets/game.js` | Regression, stable module ordering, committed one-file browser runtime. |

## 4. Proposed AI architecture (do not confuse these names with existing functions)

Implement **perception → memory → utility decision → navigation/motion/aim intent → canonical gameplay action → observability**. This is a logical design, not a mandatory giant-file rewrite.

| Layer | Input | Output | Restrictions |
|---|---|---|---|
| Perception | True LOS, range/FOV, map blockers, legitimate sound events, received damage, visible team/objective cues | Observations with origin/time/confidence | May access world positions only for **valid LOS checks** or event creation; cannot leak unseen coordinates to planners |
| Memory / team intel | Observations + team messages | Last-known position, velocity estimate, uncertainty, expiration, confidence | Explicit TTL, age-based uncertainty, no perpetual tracking, no auto-broadcast of unseen enemies |
| Decision / utility | Visible threats, recent intel, health, weapon, objective deadline, teammates' declared roles | `attack`, `hold`, `flank`, `peek`, `suppress`, `retreat`, `reload`, `rotate`, `objective`, `investigate` | Priority/hysteresis prevents thrash; survival vs objective urgency clearly specified |
| Navigation and motor control | Chosen goal, A*, collision, locomotion speed, allowed stances | Reachable waypoints, bounded velocity/turn rate | No teleport, collision clipping, unsupported stance or perpetual stuck loops |
| Aim and firing control | Actual *visible* or legitimately inferred target position, projectile speed, weapon spread/recoil/ammo | Bounded pitch/yaw and fire permission | No magic hits or modifying damage/projectile collision; error and reaction cannot be zero |
| Squad coordination | Confirmed team intel, objective phase, proximity/roles | Non-overlapping roles, lanes, planned action timing | No global live-foe lookup; no single BOT taking every role simultaneously |
| Diagnostics | Deterministic seed, decisions, positions, shots and hits | Local test traces / metrics (non-production by default) | No external telemetry or hidden player-data collection |

**Suggested transient BOT state contract**, subject to implementation review: `brain={mode,role,goal,goalUntil,observations,lastSeen,heardEvents,threatConfidence,aim:{yaw,pitch,targetId,lockTime,spreadAccumulator},movement:{intent,strafeSide,stuckSeconds},cooldowns,debug}`. Use a single owner, bounded containers, explicit per-spawn reset and `tt`-based timestamps. No duplicate mutable authoritativeness for health, ammo, team or the bomb.

**Decision clock:** perception may be updated more frequently than strategic decisions; movement must be updated each frame. Stagger expensive cover/path searches across BOTs and cache negative results. The existing `BOT_TACTICS.thinkInterval` value is not evidence that the active loop honors a dedicated decision scheduler. Confirm the actual call sites before reusing it.

## 5. Behavioral specification

### 5.1 Perception and anti-cheat

- **Vision:** candidate detection must respect actual LOS and realistic field-of-view; optionally include acquisition delay, exposure and distance. Immediate loss of LOS must cancel shooting authorization even if a last-seen waypoint remains.
- **Knowledge:** report `{position, observedAt, source, confidence, uncertaintyRadius}`. Confidence decays; a stale sighting becomes an investigation goal rather than a target lock.
- **Audio:** generate world events **from actual movement, weapon discharge, landing and explosions**, separately from the Web Audio mix. Evaluate distance, walls/doorways and event strength with a bounded radius and uncertainty. Do not infer allegiance from footstep timbre; team identity only if separately observed/known.
- **Team sharing:** observations propagate between teammates with nonzero latency and limited range/communication rules, not a perfect instantaneous shared radar. The original witness, age and LOS source are retained.
- **Objectives:** legitimate public information (bomb state, a dropped bomb visible to the owning team, a visible planted device, round timer) remains usable. Secret live opponent positions do not become valid merely because a BOT is in Bomb Mode.
- **Fairness tests:** an unseen stationary enemy behind a wall cannot be singled out by exact position; a heard footstep can trigger a *region search*, never instant headshots through cover.

### 5.2 3D aiming and weapon skill

- Use **true 3D target points** (torso/head if visible), actor/world elevation, weapon projectile origin and speed. Calculate bounded flight-time lead using observed velocity; safely fall back when velocity confidence is low. Use existing `fire()` and projectile collision as final authority.
- Aim rotates with **bounded yaw and pitch velocity**, target acquisition time and finite reaction latency. Sight loss cancels fresh fire permissions; reacquisition has a nonzero delay. Avoid an instant aim snap at any difficulty.
- Use weapon-class-specific **effective range, burst length, timing, movement inaccuracy, sustained-fire recoil/dispersion and target-size sensitivity**, while keeping canonical damage/RPM/magazines unchanged.
- Shooting should be aggressive when the target is credible and visible, but *not* automatic whenever a target pointer exists. Use burst/pause/reposition/reload tactics.
- Bots can occasionally land headshots via legitimate hit geometry and aiming decisions, never a per-shot "force headshot" shortcut. Enforce helmet/armor rules via existing hit pipeline.
- Avoid shared perfect randomness: independent seeded BOT variation with bounded skill/impairment. Do not secretly increase aim to compensate for errors elsewhere.

### 5.3 Agile and readable combat movement

- Smooth turning, acceleration/deceleration and deliberate changes of direction; preserve existing collision radius and movement speed limits unless separately approved.
- **Combat states:** approach, maintain engagement range, break LOS, shoulder-peek, re-peek, wide-swing, reposition, flank, hold angle, fallback, reload cover and disengage.
- Use a **bounded strafe commitment** and change direction based on threat line, available escape space and collision—not frequent random left/right oscillation.
- **Peeking:** choose a real cover edge; briefly expose a valid shooting lane, fire if LOS and accuracy permit, then return to valid cover. Apply exposure cooldown; never step through walls.
- **Dodge:** respond to plausible observed danger/damage, not privileged knowledge of individual bullet trajectories. Ensure evasive movement still obeys acceleration and collision.
- **Stance/jump:** crouch or jump *only if the engine has compatible character movement, collider, viewmodel and shooting support*. Otherwise mark as blocked feature pending explicit engine approval; do not simulate unsupported crouching by visually sinking the model into terrain.
- **Stuck recovery:** bounded local detours, one retry, then safe replan; instrument stuck rate and prevent infinite A* loops.

### 5.4 Cover and positioning

Score reachable cover for LOS break, actual path cost, flank exposure, teammate occupancy, escape route, objective relevance and line-of-fire opportunity. Distinguish **temporary concealment** from effective protected positions.

Use cover both defensively and offensively. Relocation is permitted at healthy HP; retreat only when risk exceeds utility. Prevent static camping, but respect legitimate Bomb Site defense and end-of-round objectives.

### 5.5 Squad intelligence (both factions)

- Allocate temporary roles based on objective, available weapons, proximity, LOS and teammate status. Possible functions: point, support, flank, anchor, cover, recover, carrier escort, defuser.
- Preserve spatial spacing and avoid stacking into one choke or crossing one another's firing lanes.
- Coordinate entry timing, overlapping angle coverage, pressure from two directions and safe rotations using **legitimately observed** information.
- Teammates may request support, share a sighting, and fall back; never share hidden global enemy coordinates.
- Squad communication must work when the human player occupies either faction. Bots must not depend on player participation to complete an objective.

### 5.6 TDM behavior

Promote active route variation, map control, safe rotations and responsive flanking of visible/remembered contacts. A lone BOT should remain capable of meaningful independent action. Avoid constant spawn rushing, suicidally chasing last-seen positions or camping indefinitely; preserve existing anti-spawn-camp and spawn rules.

### 5.7 Bomb Mission — Police

- **Pre-plant:** distribute between A/B, maintain plausible rotations, avoid abandoning both sites based on unobserved enemy locations.
- **Retake:** assign entry/clear/support/defuse roles; prioritize fuse time, visible threats and reachable routes. Defuser should start promptly when the site is sufficiently safe.
- **Defuse:** preserve *one designated BOT defuser*, interaction radius/time, contest rules and existing no-respawn round behavior. Support BOTs cover approach angles without obstructing teammates.
- **Critical:** do not introduce waiting states that make an uncontested bomb impossible to defuse before expiry.

### 5.8 Bomb Mission — Terrorist

- **Pre-plant:** choose a plausible site/entry route using own intel and teammate readiness; carrier is supported, not blindly followed.
- **Site execution:** entry and support roles clear legitimate threats, avoid camping in one doorway, then plant using the existing valid action.
- **Post-plant:** establish overlapping defensible angles and appropriate intercept/flank roles without directly querying hidden defenders' live positions.
- **Dropped bomb:** assign one recoverer and sensible escort/cover; preserve existing team-only dropped-bomb visibility and pickup rules.
- **Critical:** no infinite rotate/hold loop that fails to plant despite a reachable, uncontested site.

## 6. Milestone sequence — implement in this order

Mark a milestone complete **only after its acceptance gates pass**. Each milestone is one or more reviewable commits, with no unapproved cross-system refactor.

| ID | Priority | Workstream | Deliverable | Dependency |
|---|---|---|---|---|
| M0 | P0 / prerequisite | Baseline & harness | Reproducible tests, deterministic combat scenarios, metrics; fix stale test mocks; record current performance | None |
| M1 | P0 | Perception & knowledge integrity | Vision validation, sound-event evidence, bounded memory and no hidden-coordinate objective cheating | M0 |
| M2 | P0 | 3D aiming & weapon discipline | Pitch/elevation aim, bounded target leading, human reaction, burst/recoil and reasonable accuracy curves | M1 |
| M3 | P1 | Combat locomotion & cover | Smooth strafe, peek, reposition, offensive cover, safe stuck recovery | M1–M2 |
| M4 | P1 | Squad coordination | Roles, shared evidence with latency, lane reservations, multi-angle movement | M1–M3 |
| M5 | P1 | Bomb-specific tactics | Police retake/defuse and Terrorist plant/post-plant upgrade with fair knowledge | M1–M4 |
| M6 | P1 | TDM & weapon-class adaptation | Map control, independent strategy, sniper/shotgun/SMG/rifle-specific engagement envelopes | M2–M4 |
| M7 | P0 / release gate | Balance, soak tests and final QA | Reproducible results, tuned defaults, clean baseline comparison, no gameplay regressions | M0–M6 |

### M0 — Foundations and measurement

**Current tracking (2026-10-31 WIB):** **VERIFIED (FOUNDATION ONLY)** — active-code seeded 10-BOT TDM/Bomb fixture, reproducible behavior trace, 3 × 720 synthetic CPU update samples, 289/289 Node regression tests and Windows [CI #38](https://github.com/Heynode92/blockbudies/actions/runs/41105582716) all PASS; owner-reported basic manual gameplay smoke 8/8 PASS. These establish the original M0 **exit gate**, not a full live-game quality/performance evaluation. Browser FPS/frametime, real hit percentage, reaction latency, automatic stuck/navigation outcomes, per-map/faction sample matrix and Bomb completion rates remain **UNMEASURED**. **M1 READY but NOT STARTED.**

**Work:** capture the existing BOT update behavior from `main` for fixed seeds and the 5v5 Police/Terrorist combinations; verify `node --test` isolation and missing `footstepAdvance` test mock; measure behavior and frame time on the existing runtime. Build a developer-only debug overlay/logging mode *only if needed*, disabled by default.

**Exit gate (VERIFIED for foundational M0):** automated test harness runs the active code, deterministic scenarios yield reproducible outcome traces, pre-change synthetic behavior and CPU measurements are recorded, and legacy UI/gameplay remain unchanged. **Not covered by this sign-off:** browser FPS/p95, real hit-rate/reaction/stuck measurements and Bomb outcome rates. Those remain required for comparative improvement and final M7 readiness; see [M0 Baseline](BOT_AI_M0_BASELINE.md).

### M1 — Perception and legitimate knowledge

**Current tracking (2026-10-31 WIB): VERIFIED (CORE EXIT GATE)**, [Windows CI #72 297/297 PASS](https://github.com/Heynode92/blockbudies/actions/runs/41108545600) and owner-reported post-update **manual playtest PASS**. See [M1 validation](BOT_AI_M1_VALIDATION.md). LOS-based sight snapshots, radio, bounded footstep/gunshot clues, expiry/reset and Bomb knowledge isolation are implemented. **M2 READY / NOT STARTED.** Detailed per-map/faction manual matrix and real browser FPS/hit/reaction/stuck KPIs are still OPEN; no numeric performance assertions.

**Work:** explicit LOS, observation origin/time, acoustic event integration, team sighting reports and last-known uncertainty. Refactor Bomb helper queries to consume this knowledge instead of reading hidden enemies directly.

**Exit gate:** wall/occlusion and unseen-movement tests show no knowledge leakage; BOTs still investigate legitimate heard shots/footsteps and execute objectives with stale/no intel.

### M2 — Fire control

**Work:** independent aim intent module with yaw/pitch solving and limited predictive lead; per-weapon accuracy timing and fire-control tests, using existing projectile and damage systems.

**Exit gate:** hits are physically simulated; hits at different elevations are possible; changing target direction disrupts aim naturally; all shots respect LOS, reload, ammo, armor and weapon cooldown. No deterministic instant headshot.

### M3 — Movement and cover

**Work:** tactical movement planner, edge-based peek and exposure scoring, collision-safe easing and safe replan; balance aggression, pressure and survival.

**Exit gate:** no solid-wall crossings, no infinite loops, less repeated obstacle oscillation, natural reposition and measurable use of cover on both maps.

### M4 — Team play

**Work:** team intel bus with provenance and TTL, non-overlapping roles, flank/entry/cover synchronization with timeout and fallback.

**Exit gate:** both teams coordinate without global telepathy; a team can function with zero active human input; shared goals do not deadlock the squad.

### M5 — Bomb fidelity

**Work:** role scoring for carriers, entries, hold positions, site switching, defuse urgency and late-fuse rescue; objective-aware cover while obeying hearing/vision information.

**Exit gate:** repeated simulations cover A/B attacks, 1vX, contested/uncontested defuse, bomb carrier elimination, dropped bomb, plant interrupts, fuse expiry and all-living/team-wipe outcomes with valid winner.

### M6 — TDM & armament

**Work:** TDM threat prioritization, patrol/rotation lanes and per-class engagement distance; balance toward aggression without spawn camping.

**Exit gate:** comparable fairness/competence for both factions and all active BOT primary classes; **RPG stays excluded from BOT pool** unless separately approved.

### M7 — Release

**Work:** compare seeded baseline vs upgraded bots, tune only AI-side parameters, check browser FPS and human headset playtests; document known limits.

**Exit gate:** test suite, bundle parity, syntax and scenario benchmarks pass; no approved gameplay mechanic regresses; commit includes updated docs/results and user only needs `git pull` + `index.html`.

## 7. Metrics and evaluation protocol

Measure each item **per mode, per team, per weapon class where meaningful**, using same map/seed scenarios for before/after:

| KPI | Definition | Goal / acceptance approach |
|---|---|---|
| Aim precision | Valid hits / shots fired by range band (0–10, 10–20, 20–30, 30+ world units), stationary and moving targets | Improvement over recorded M0 baseline, bounded to avoid overpowered aim; target bands must be calibrated after actual measurements |
| Reaction latency | First valid observation → first legal aiming/fire action, median + p95 | Nonzero, stable and explainably variable; initial **design hypothesis** 180–500 ms, not an established human benchmark or fixed ship criterion |
| Target prediction | Hit consistency against strafing and elevation changes | Better than current yaw-only system without tracking unseen target positions |
| Cover utility | Time with line-of-fire exposure vs valid cover, successful peeks/retreats | Less unprotected exposure in comparable scenarios without excess passivity |
| Movement quality | Stuck seconds, collision corrections, path failures, oscillatory heading switches | No wall clipping; bounded recovery; no endless wiggle |
| Squad behavior | Overlap/crossfire coverage, congestion, coordinated entry completion | Improvement on deterministic scenarios; no friendly obstruction/deadlock |
| Objective quality | Bomb plant/defuse completions, valid round outcomes, timeout breakdown | No regression in valid objectives; nonzero rates in uncontested reachable scenarios |
| Fairness | Hidden-position information leaks, impossible shots, reaction outliers | **Zero** confirmed leaks and impossible shots in test matrix |
| Performance | Median/p95 game frame time and per-BOT decision time at 5v5 | No sustained budget regression compared with M0; provisional guardrail: ≤10% median and ≤15% p95 frame-time overhead; revisit after profiling |
| Stability | Seeded match replay, reload/death/reset cycle, two-map switching | No uncaught exceptions, memory growth, stale decisions or stuck objectives |

**Sampling protocol:** execute fixed-seed scenario matrices and longer randomized runs with a documented count, platform/browser and measurement environment. Start with ≥200 engagements per representative distance band/mode and ≥50 completed Bomb rounds per team configuration **as proposed test coverage, not evidence of current coverage**. Record both successes and failures; never report a "5-star" score as a measured performance KPI. Include human headset/playtesting for qualitative naturalness.

## 8. Required regression matrix

- [ ] TDM: Police BOT / Terrorist BOT; human on either team; initial spawn and subsequent respawns.
- [ ] Bomb: Police/Terrorist BOTs; carrier BOT/player; both sites; planted/not planted; dropped/recovered device.
- [ ] Visibility: no target through walls, doors, ceilings and solid cover; LOS regained; sight lost; target dies.
- [ ] Audibility: heard footsteps/gunshots, muffled walls, no sounds, sound switch disabled, teammates audible without revealing invisible foe identity.
- [ ] Aim: level ground, elevated position, moving target, abrupt direction change, head/helmet, armor, point blank, long range, shotgun pellet pattern, reload/empty magazine.
- [ ] Motion: collision at narrow doors, teammate clustering, stuck path, path reset/map switch, large frame delta, frame pacing.
- [ ] Tactics: low HP, reloading, flank and retreat, safe grenade near teammates, objective deadline, target memory expiry.
- [ ] Bomb edge cases: solitary defuser, last-second uncontested defuse, carrier dies during plant, planted bomb after Terrorist wipe, contested 1v1, no-respawn discipline.
- [ ] Integration: footprints/footstep sounds, weapon selection, death drops, kill feed, score, HUD, match-end; no unintended asset or UI changes.
- [ ] Browser: open `index.html` directly on Windows, with committed `assets/game.js` in sync; no build/server required by the player.

Each checked item must point to a test, replay, or explicitly recorded manual validation in the implementation log. Do **not** check boxes preemptively.

## 9. Developer implementation contract and repository hygiene

### Recommended incremental file layout (proposal; create only when implementing)

- `src/game/ai/perception.js` — LOS/sound observations and validity.
- `src/game/ai/memory.js` — finite, time-bounded bot and squad observations.
- `src/game/ai/aim-controller.js` — orientation and fire gating; no independent damage logic.
- `src/game/ai/combat-movement.js` — strafe/peek/cover motion intent.
- `src/game/ai/squad-director.js` — evidence-based roles / team timing.
- `src/game/ai/diagnostics.js` — test-only metrics; no production remote telemetry.

These paths are **NOT present/implemented** as of the baseline. The maintainer must confirm layout against current `tools/source-manifest.json` and preserve shared-scope initialization ordering. Avoid moving active AI code wholesale; extract verified units gradually. Do not add any of these names to the manifest until source and tests exist.

### Test discipline

- Maintain and extend current `tests/bot-five-star.test.mjs`, `tests/bot-lobby-bootstrap.test.mjs`, `tests/bomb-*.test.mjs`, weapon and damage tests.
- Add narrow behavior tests for every new rule (real production functions, not exclusively mocks), seedable simulations for multi-BOT interaction, and adversarial anti-omniscience tests.
- Fix or explicitly document stale test harness dependencies before measuring a milestone.
- Maintainer validation on Windows PowerShell:

```powershell
node tools/build.mjs
node tools/build.mjs --check
node --check assets/game.js
node --test tests/*.test.mjs
```

These are **maintainer-only** actions. The user must never be told to install Node, build manually, start a runner or use Docker/WSL just to play.

### Definition of done for every AI milestone

1. Source inspected and all touched function names verified on the current branch; user-approved scope unchanged.
2. New behavior has targeted tests and a failure case that would catch a regression.
3. Both teams and both modes tested when affected; sound, movement, accuracy and objective authority verified as appropriate.
4. No unapproved game balance, player controls, UI text, weapon changes, mode rules or dependencies.
5. Canonical `fire()`, `WP`, `defenseDamage()`, `resolve()`, `bombAct()` and Bomb round authority remain intact.
6. All sources and bundled `assets/game.js` match the manifest; syntax and relevant existing tests pass.
7. Source, tests, `CHANGELOG.md`, and [the implementation log](BOT_AI_IMPLEMENTATION_LOG.md) updated in the same commit.
8. Specific acceptance evidence included; do not call a milestone "done" solely because a function or test file exists.
9. Changes pushed to `main` only after validation and verified against the remote ref. User's Windows workflow remains `git pull origin main`, then open `index.html`.

## 10. Open design decisions — do not silently assume answers

| ID | Decision | Default pending measurements / explicit approval |
|---|---|---|
| D-01 | Final BOT aim accuracy by distance, target movement and weapon class | Derive from M0/M2 scenario results; no guessed perfect accuracy |
| D-02 | Reaction-time and aiming turn-rate ranges | Tune for challenging-but-human playtests, per-weapon feel |
| D-03 | Does the engine officially support crouch or jumping BOT colliders? | **Not assumed**; do not implement without verifying engine and approval |
| D-04 | How far can team BOTs share audible/visual reports? | Local bounded latency + TTL, no telepathy |
| D-05 | Does the user want additional exposed difficulty levels? | **No**; retain existing five-star label unless requested |
| D-06 | Are assets, voice callouts or new UI allowed? | **No**; separate user approval required |
| D-07 | New worker/server/multiplayer architecture? | **Out of scope**; current project remains offline client simulation |

## 11. Handoff instructions for the next AI/developer

1. Read this entire master plan, [BOT_AI_IMPLEMENTATION_LOG.md](BOT_AI_IMPLEMENTATION_LOG.md), `src/game/BOT_AI.md` and `docs/ARCHITECTURE.md`.
2. Read the **latest remote `main`**, not just this pinned baseline. Search each real function before editing; do not invent imports or APIs.
3. Inspect the log for `NEXT` and pick **exactly one** unfinished milestone; if M0 is open, start there.
4. Present the exact files, invariants, tests and intended behavior for that milestone. Change only approved scope.
5. Keep tactical input honest and preserve canonical gameplay mechanics. Test in realistic scenarios; record baseline deltas.
6. Commit only after verification; update documentation and implementation log in the same commit. Never claim an upgrade was completed while only the plan was edited.

**Approval boundary:** The original request on 2026-10-30 authorized documentation and logging only. A later explicit owner instruction authorized M0 harness and testing work. M1 gameplay update was explicitly authorized by the owner, implemented, and accepted through green Windows CI and owner-reported manual gameplay PASS. **M1 core feature gate VERIFIED**, not a quantified browser performance sign-off. M2–M7 remain pending separate authorization.
