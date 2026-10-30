# BLOCK BUDDIES — M0 Synthetic BOT Baseline (2026-10-30)

> **Milestone:** M0 — Baseline & Harness  
> **Status:** PARTIAL / VALIDATED SYNTHETIC REPLAY; NOT A RELEASE GATE  
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
- The isolated replay was evaluated against GitHub source with equivalent V8 function execution; six new test assertions passed in that evaluation. The real Node test command / full repository suite / playable browser were **not run** in that evaluation environment. This remains a verification gap.

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

## M0 verification checklist

- [x] Confirm active BOT owner and current source functions (not `botsUpdOld`).
- [x] Verify pre-existing `footstepAdvance` mock correction is present in `tests/bot-five-star.test.mjs`.
- [x] Add **seeded synthetic 10-BOT** TDM and Bomb replay + targeted regression checks.
- [x] Log precise synthetic observations and known limitations.
- [ ] Execute actual `node --test tests/*.test.mjs` and bundle checks in a complete repository checkout; store command output and environment.
- [ ] Run real playable map scenarios with the human on Police and Terrorist in both modes and both maps; collect reliable samples.
- [ ] Instrument **real** fire/hit rate, sight-to-action latency, path failure, collision/stuck time and Bomb completion, with scenario seeds and sample counts.
- [ ] Measure actual browser frame time/p95 and BOT decision cost at playable 5v5, then compare after every upgrade.
- [ ] Verify browser `index.html` launch and gameplay manually on Windows.

M0 stays **IN PROGRESS** until all required acceptance gates are evidenced. M1–M7 remain **NOT STARTED**. No source gameplay, assets, damage, AI difficulty, rules, map geometry, manifest or standalone browser bundle was modified by this M0 harness.

## Reproducibility and future updates

Record actual commands, OS/browser, sample size, seed/map/mode, raw trace or summary, commit SHA, passes/failures and open blockers in [BOT AI Implementation Log](BOT_AI_IMPLEMENTATION_LOG.md). When the real gameplay system evolves, compare the **same fixed fixture** and update this document transparently: do not silently change expected values or call synthetic shot counts a hit-rate benchmark.
