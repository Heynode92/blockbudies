# BLOCK BUDDIES — M7 Final BOT AI Quality Assurance & Performance

> **Status:** IN PROGRESS — instrumentation and Windows synthetic CI VERIFIED; LIVE BROWSER/MATCH QUANTITATIVE GATES OPEN; NOT RELEASED
> **Date:** 2026-10-31 WIB
> **Owner acceptance entering M7:** M6 **7/7 manual TDM/Bomb checks PASS**, owner-reported, combined with [Windows CI #172](https://github.com/Heynode92/blockbudies/actions/runs/41176995240) **361/361 PASS**. M0–M6 core gates VERIFIED; **M7 release is a separate decision**.
> **Automated verification:** [Windows CI #187](https://github.com/Heynode92/blockbudies/actions/runs/41177646441) **373/373 Node tests PASS** plus **15/15 seeded synthetic fairness scenarios PASS**, source-manifest standalone bundle parity, syntax, M0 seeded replay and CPU benchmark.
> **Privacy:** No automatic upload, APIs, remote telemetry, storage writes or user-identifying data.

## What was delivered

1. **Passive, opt-in runtime instrumentation** in `src/game/94-bot-qa.js` (source order: after live BOT AI, before simulation). Defaults to **OFF**; standard `index.html` behavior and UI remain unchanged.
2. True browser `requestAnimationFrame` **wall-time frame interval** sampling (uncapped; not the game engine's capped 50ms simulation `dt`); separate **JavaScript per-frame work** timing, and **BOT `botsUpd()` CPU** update duration.
3. Real **BOT-fired projectiles and resolved projectile-character impacts**, grouped by game mode, canonical weapon kind and encounter-distance bands **0–10 / 10–20 / 20–30 / 30+** world units. Shotgun pellets are separately counted in numerator/denominator; trigger pulls are **not** treated as equal to pellets or hits. These are projectile-character collisions, **not guaranteed actual HP damage**.
4. **First visible acquisition → first dispatched BOT shot** measured with simulation clock `tt`; records distribution of only successful firing engagements and separately counts sightings lost without a shot. These are in-game latencies **not instrumented human auditory reactions or real wall-clock aim acquisition**.
5. **Navigation obstruction proxy:** actual gameplay attempted-movement seconds, low-displacement seconds (no real per-map path success inference), total A* attempts and failed routes, without intercepting/changing pathfinding.
6. **Bomb outcomes** captured at the actual authoritative `bombFinish()` invocation: completed rounds, winners, planted at finish and A/B or no-site completions. There is no synthetic result conversion or objective-duration change.
7. **Bounded memory and export:** rolling last 2,400 frame samples and 2,400 BOT CPU samples, last 500 reaction samples, last 150 Bomb completed rounds; cumulative counters for session. Export as local JSON on explicit console command. No user ID, enemy coordinates, chat, network API, `localStorage` or background agent.
8. **15-scenario deterministic Windows CLI matrix** `tools/bot-ai-m7-scenarios.mjs`: 3 fixed seeds × [TDM, Bomb] × [open, blocked LOS] = 12, plus 3 low-HP TDM scenarios; two full replays per condition must be byte-for-byte equal. Blocked LOS has zero dispatched shots; open LOS has firing from both BOT teams with genuine vertical pitch; invalid coordinates fail. This matrix reuses production AI functions in the original **synthetic Node VM** arena. It does **not** simulate WebGL, real projectile impacts, maps, actual Bomb outcomes or player reactions.

## Browser-only collection procedure (Windows, no build/server)

**Normal play remains unchanged:** open `index.html` directly. Instrumentation is OFF.

For a local diagnostic match, open the same file from File Explorer and append `?bbBotQa=1` to the full URL shown in the browser address bar. Example:

```text
file:///C:/Games/blockbudies/index.html?bbBotQa=1
```

The example is not a required file path. Use the actual path to your own `index.html`.

1. Open Developer Tools (**F12**) and select **Console**. Ensure the informational message `BLOCK BUDDIES local M7 QA enabled` appears. Avoid running scripts from strangers.
2. Play **one mode/map/team configuration per run** so frame and BOT CPU timing are not mixed between scenarios. At the start of a run, execute `BlockBuddiesQA.reset()` in Console.
3. At the end, execute `BlockBuddiesQA.report()` to inspect metrics, then `BlockBuddiesQA.download()` to save **block-buddies-m7-qa.json** to your machine. Rename it with the mode, map, team, duration and date so repeat exports are not overwritten.
4. Repeat for TDM Police, TDM Terrorist and Bomb Police/Terrorist, and the available maps, keeping match configuration consistent. For a release-level claim, gather enough encounters/rounds to satisfy the Master Plan sampling protocol, including failures—not just a clean short smoke test.
5. Submit the actual JSON files for comparison and release decision. No remote transmission happens unless **you** explicitly share files.

**Console API:** `BlockBuddiesQA.report()`, `BlockBuddiesQA.download()`, and `BlockBuddiesQA.reset()` (only defined in explicitly instrumented local tab).

### Data semantics and limits

| JSON field | Actual observation | What it does NOT establish |
|---|---|---|
| `frameTimeMs.median/p95` | Last 2400 qualifying real browser rAF intervals | GPU timings, FPS on other hardware, baseline-overhead delta |
| `frameJavaScriptWorkMs` | JavaScript work for one frame, including simulation/render-call overhead | GPU execution/driver time |
| `botUpdateCpuMs` | Actual `botsUpd()` elapsed CPU per update | Real frame time for whole game |
| `firstSightToShotMs` | M2 sight event to BOT projectile fire in game time, only where shot fired | Human-like reaction percentile across no-shot sightings, wall-clock input reaction |
| `byWeaponRange` | Per-mode and weapon/range **fired projectiles / character collisions** | Trigger accuracy, headshot %, armor damage, hit% of one individual BOT |
| `movementAttemptSeconds` / `lowDisplacementSeconds` | Actual movement intent vs low displacement threshold | Certified absence of all stuck/jitter or successful map traversal |
| `pathAttempts` / `pathFailures` | Real A* results from active BOT `botPath()` | Navigation of every cover candidate or all possible map edges |
| `bombRounds` | Real `bombFinish()` winners/site/planted-at-finish count | Plant/defuse success rates without event-specific denominators or sufficient sample count |

To compute FPS, the export offers `approximateFpsMedian` from the **median frame interval**, not an average FPS, and deliberately rejects invalid/suspended intervals ≥500ms. Recording 30–120 seconds per run samples the steady state; the 2,400 rolling frame-sample window does not capture an entire long match distribution. The `schema` field identifies the report shape and cannot be interpreted as a release certification.

## Automated regression matrix

- [x] Existing M0–M6 source and complete Windows regression suite retained.
- [x] M7 dedicated 12 opt-in QA tests: default-off privacy; no network/storage; bounded arrays and reset; actual rAF/sample domain; per-frame JS vs BOT CPU separation; projectile/pellet hit denominator; first sight-to-shot; LOS-loss non-shot case; mode/weapon/range bands; movement+path counting; Bomb round scoring; integration hook/source loading; existing BOT RPG exclusion.
- [x] Windows CI multi-seed deterministic **15/15 synthetic scenarios**; open/blocked LOS on both teams and modes, low-HP retreat and stable replay. Distinguish synthetic evidence from real-browser measurements.
- [x] Canonical direct-open bundle/syntax, no backend, Docker, WSL or player-side build.
- [x] No modifications to `BOT_WEAPONS.primaries`, WP damage/recoil, player aim, Bomb plant/defuse/fuse/score rules, spawn rules, UI, game mode descriptions or map geometry.
- [ ] Actual browser frame time and BOT CPU p95 sampled with hardware/browser, per-mode/map/team run metadata and comparison to M0-equivalent measurements.
- [ ] Actual per-class/range projectile hit distributions, headshot and reaction-outlier assessment with proposed Master Plan engagement samples (including misses and no-shot contacts).
- [ ] Real full-map navigation time/stuck/collision results, squad congestion, genuine Bomb plant/defuse and TDM win-rate outcomes.
- [ ] Long-run Windows browser stability, two-map switching, FPS regressions at 5v5, human headset qualitative review and performance acceptance thresholds.
- [ ] **M7 FINAL RELEASE VERIFIED**. **NOT checked until above gates have evidence.**

## Audit verdict

**M6 core VERIFIED by owner 7/7 manual PASS and prior Windows CI. M7 instrumentation and automated synthetic suite implemented; M7 FINAL QA/RELEASE REMAINS OPEN.** No real browser or match session was executed by GitHub Actions; thus no recorded FPS, real BOT hit-rate improvement, measured true reaction percentile, navigation stuck improvement, measured Bomb-win percentages or proven 10%/15% performance overhead thresholds may be claimed. The original M0 fixed-seed arena changed significantly across M1–M6, so comparing a 2026-10-30 M0 synthetic dispatch count directly with a 2026-10-31 M7 result would **not** prove a causal real-game gain.

M7 is an evaluation milestone. Do not turn on game telemetry for ordinary users, auto-send reports, loosen the old gameplay contract or mark a release PASS simply because tests are green.
