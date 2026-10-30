# BLOCK BUDDIES — M0 Synthetic BOT Baseline (2026-10-30)

> **Milestone:** M0 — Baseline & Harness  
> **Status:** PARTIAL / WINDOWS NODE CI + OWNER-REPORTED CORE GAMEPLAY SMOKE VERIFIED; QUANTITATIVE BASELINE PENDING  
> **Source starting point:** `5e7bd5871ee828ca9690a25d1d994e4c5f130c2d`  
> **Harness:** [`tools/bot-ai-m0-baseline.mjs`](../tools/bot-ai-m0-baseline.mjs)  
> **Regression tests:** [`tests/bot-ai-m0-baseline.test.mjs`](../tests/bot-ai-m0-baseline.test.mjs)

## Scope and evidence

The M0 fixture executes **real production** `botAttack`/`botCombatTick`, `BOT_TACTICS`, `bombTacticalGoal`, and active `botsUpd`/A* logic inside an isolated JS context. World/visual/audio/damage dependencies are **test doubles**, not playable browser integration. The fixture is deterministic: a local LCG replaces random values for this test context only; global gameplay `Math.random` is unchanged.

- Each case has 10 synthetic BOTs, five Police and five Terrorists, **no human player**.
- The world is a bounded **flat synthetic arena** (`A=14`), with no 3D cover/objects; `los()` is either allowed everywhere or denied everywhere. The real path-finding functions run on the synthetic grid.
- Each case runs **60 frames at 0.05 seconds**, i.e. **3 seconds of simulated time**, with fixed seed `42`, rifle ID `1`, mocked projectile resolution, no grenades.
- `shotsDispatched` counts calls to the canonical `fire` entry point. It **does not** count physical hits, kills, hit percentage, recoil, bullet accuracy or damage.
- `footstepCalls` counts calls to a stub, **not** audible footsteps. `clampCorrections` count synthetic arena bounds clamping, **not** actual 3D collisions.
- Bomb fixture exercises tactical goal selection but **does not** simulate plant/defuse, real round outcomes or timers.
- The initial isolated replay was evaluated against GitHub source with equivalent V8 execution. Subsequently, [Windows GitHub Actions run #26](https://github.com/Heynode92/blockbudies/actions/runs/41096566590) verified `node --test`, bundle parity, JS syntax and JSON trace execution successfully. **Playable browser matches, real hit/reaction/Bomb outcome metrics and FPS were not measured.**

## Reproducible fixture trace (seed 42)

| Synthetic scenario | Fire dispatches (Police / Terrorists) | First fire (s) | Nonzero BOT pitch shots | Total distance (Police / Terrorists) | Retreating BOTs | LOS checks |
|---|---:|---:|---:|---:|---:|---:|
| TDM: open visibility | 75 / 75 | 0.00 | 0 | 36.4433 / 35.3837 | 0 | 1,729 |
| TDM: all LOS blocked | 0 / 0 | N/A | 0 | 61.1024 / 64.5661 | 0 | 480 |
| TDM: open, HP 25 on all BOTs | 21 / 27 | 0.75 | 0 | 9.7976 / 28.2653 | 10 | 2,750 |
| Bomb: idle/plant, open visibility | 75 / 60 | 0.00 | 0 | 34.9134 / 26.7997 | 0 | 1,550 |

Each scenario invokes `footstepAdvance` 600 times (10 BOTs × 60 frames). The seeded trace was reproduced twice with the same outputs. Open/blocked LOS tests confirm no `fire` dispatch when visibility is unavailable in this synthetic case; **this does not prove global anti-omniscience in Bomb tactical decisions** (known M1 risk).

**Interpreting these numbers:** First-frame firing and zero vertical firing pitch are current-source symptoms in this fixture, **not** a measured human reaction speed or a real-game accuracy score. No difficulty or weapon balance tuning is authorized by these observations alone.

## Exact developer commands

Maintainer-side, after checkout on Windows PowerShell (NOT required for the player):

```powershell
node tools/bot-ai-m0-baseline.mjs
node --test tests/bot-ai-m0-baseline.test.mjs
node --test tests/*.test.mjs
node tools/build.mjs --check
node --check assets/game.js
```

The CLI prints JSON. The regression tests verify fixed-seed replay equality, blocked LOS, critical-HP retreat, both Bomb factions, seed variation and strict separation of fire dispatch from unknown real hit metrics.

## Native Windows CI recovery (2026-10-30)

- Early [run #3](https://github.com/Heynode92/blockbudies/actions/runs/41085174072) failed `node tools/build.mjs --check` because the generated bundle contained one extraneous newline between production modules `65-audio.js` and `66-footsteps.js`. Removing that separator made bundle check and syntax check pass in [run #6](https://github.com/Heynode92/blockbudies/actions/runs/41094812497).
- Once the full Node suite executed, it exposed 41/288 failing pre-existing regression tests, mostly from outdated isolated test mocks or old assumptions (e.g. 13/17 weapons versus 19 today, BOT RPG inclusion after its approved removal, ADS selectors and viewmodel indexing). The tests were aligned with **current verified source contracts**, without restoring removed gameplay features or modifying production AI.
- [Run #26](https://github.com/Heynode92/blockbudies/actions/runs/41096566590) completed successfully on Windows with bundle verification, JavaScript syntax, full Node tests and M0 synthetic baseline output. This CI result validates test infrastructure; it is **not** evidence that real match accuracy, latency, navigation or FPS targets have passed.

## Owner-reported core gameplay smoke test (2026-10-31 WIB)

The owner reported **8 of 8 qualitative smoke checks PASS** after pulling and playing the game. This is separate from the seeded synthetic fixture and is **not** a measured BOT AI benchmark.

| Game mode | Core manual check | Result |
|---|---|---|
| Deathmatch | Police and Terrorist BOTs move and engage | PASS (owner report) |
| Deathmatch | No observable wall/object sticking | PASS (owner report) |
| Deathmatch | Shooting and damage function | PASS (owner report) |
| Deathmatch | No noticeable freeze or severe lag | PASS (owner report) |
| Bomb Mission | Terrorist BOT plants bomb | PASS (owner report) |
| Bomb Mission | Police BOT defuses bomb | PASS (owner report) |
| Bomb Mission | BOTs attack and defend site | PASS (owner report) |
| Bomb Mission | Round resolves according to rules | PASS (owner report) |

**Do not extrapolate:** subjective absence of lag does not measure FPS or p95; visually moving through a map does not measure navigation or stuck rate; functioning damage does not measure hit percentage; working plant/defuse is not a statistically sampled completion rate. Specific maps, teams played by the human, number of rounds, browser/OS version and raw telemetry were not supplied.

The underlying Windows regression suite remains **CI SUCCESS**, verified on [run #30](https://github.com/Heynode92/blockbudies/actions/runs/41097051520), commit `4df8c9f` prior to documentation-only logging. Remaining M0 benchmark and acceptance gates below are not complete.

## M0 verification checklist

- [x] Confirm active BOT owner and current source functions (not `botsUpdOld`).
- [x] Verify pre-existing `footstepAdvance` mock correction is present in `tests/bot-five-star.test.mjs`.
- [x] Add **seeded synthetic 10-BOT** TDM and Bomb replay + targeted regression checks.
- [x] Log precise synthetic observations and known limitations.
- [x] Windows GitHub Actions `node --test` complete regression suite, `node tools/build.mjs --check`, `node --check assets/game.js` and synthetic baseline CLI all verified green: [run #26](https://github.com/Heynode92/blockbudies/actions/runs/41096566590), Node 22 / `windows-latest`.
- [x] Owner-reported **basic live gameplay smoke**: 4/4 Deathmatch and 4/4 Bomb Mission PASS (qualitative only; see above).
- [ ] Run real playable map scenarios with the human on Police and Terrorist in both modes and both maps; collect reliable samples.
- [ ] Instrument **real** fire/hit rate, sight-to-action latency, path failure, collision/stuck time and Bomb completion, with scenario seeds and sample counts.
- [ ] Measure actual browser frame time/p95 and BOT decision cost at playable 5v5, then compare after every upgrade.
- [ ] Verify browser `index.html` launch and gameplay manually on Windows.

M0 stays **IN PROGRESS** until all required acceptance gates are evidenced. M1–M7 remain **NOT STARTED**. No gameplay logic, damage, difficulty, rules, map geometry or source manifest was modified by the M0 test harness. The committed standalone browser bundle `assets/game.js` later received **one newline-only synchronization correction** (commit `6664ee13`) to satisfy the canonical build; no executable gameplay statement changed.

## Reproducibility and future updates

Record actual commands, OS/browser, sample size, seed/map/mode, raw trace or summary, commit SHA, passes/failures and open blockers in [BOT AI Implementation Log](BOT_AI_IMPLEMENTATION_LOG.md). When the real gameplay system evolves, compare the **same fixed fixture** and update this document transparently: do not silently change expected values or call synthetic shot counts a hit-rate benchmark.
