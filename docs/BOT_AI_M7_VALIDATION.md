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

## First owner-provided real-browser capture — 2026-10-31 WIB (PROVISIONAL)

**Origin:** Owner submitted `block-buddies-m7-qa (1).json` exported from an explicitly enabled `file://` Firefox tab on Windows, together with a DevTools screenshot demonstrating `BLOCK BUDDIES local M7 QA enabled` and successful `BlockBuddiesQA.reset()` (returns `undefined` by design). **The raw user file is not committed;** the verified aggregate figures below are the only stored evidence. No independent live gameplay was run by CI. Capture mixes both TDM and Bomb within **one reset/sample window**, without duration, exact map, team configuration, GPU, driver or resolution metadata. Interpret as an initial owner-supplied instrument sample, **not a controlled benchmark**.

| Metric | Observed owner JSON | Interpretation / limitation |
|---|---:|---|
| rAF interval (last 2,400 samples) | median **7.0 ms**, p95 **14.0 ms**, max **27.8 ms** | Derived displayed FPS median approx **142.9**; **PROVISIONAL**, mixed modes, no matched M0 baseline |
| Per-frame JavaScript work (2,400 samples) | median **8.7 ms**, p95 **10.8 ms**, max **21.1 ms** | **Measurement consistency flag:** 8.7 ms median work exceeds 7.0 ms median rAF interval; investigate callback timestamps, frame sampling alignment, FPS estimation and browser DevTools effects before accepting performance KPI |
| BOT update CPU (2,400 samples) | median **0.6 ms**, p95 **1.1 ms**, max **2.8 ms** | Actual browser timing for BOT update only, not all rendering/GPU work |
| Sight→first shot in game clock (120 samples) | median **332.3 ms**, p95 **457.0 ms**, max **851.7 ms** | Includes M2 turn/cooldown/fire permission; **not** raw cognitive reaction latency or a before/after improvement |
| Projectile→character impacts, all modes | **154 / 1,075 = 14.33%** | Real projectile/pellet collision ratio, **not** trigger accuracy, actual HP damage, headshot rate or full-weapon benchmark |
| TDM projectile→impact | **126 / 819 = 15.38%** | Mixed class/ranges; incomplete per-faction/session metadata |
| Bomb projectile→impact | **28 / 256 = 10.94%** | Insufficient round diversity |
| M3 movement obstruction proxy | **41.56 / 748.8 sec = 5.55%** | Low displacement during requested movement, aggregated BOT-seconds; **does not demonstrate permanent stuck** |
| A* attempted / failed | **1,006 / 0 failed** | Only BOT navigation path requests counted by instrument; not all path or cover candidate checks |
| Bomb finishes | **2 rounds**, Police **2**, Terrorists **0**, planted-at-finish **0**, no site **2** | Too few rounds and **no plant**; cannot validate M5 outcomes, bomb win percentages, or plant/defuse success |

**Actionable combat finding:** TDM shotgun fired **114 pellets, 6 character impacts (5.26%)**; **72 pellets** were discharged in 30+ unit engagements with only **one** impact (**1.39%**). Bomb shotgun fired **72 pellets, 2 impacts (2.78%)**. This may indicate that BOT weapon-class *movement* in M6 does not consistently position short-range weapons before permitted long-range firing. **No change to shotgun damage/range/AI has been authorized or applied on the basis of this one sample**; compare controlled weapon/range scenarios before tuning. At 0–10 units only 10 projectiles of any kind were counted (8 impacts), too small for a near-range performance claim.

**Session completeness:** first-visual observations **208**, lost-unfired sightings **66**; cannot calculate a valid probability of reaction or engagement completion without reconciling in-progress/overlapping contacts. The 2,400-sample arrays are rolling windows and may cover only the tail of the longer session. Per-mode frame/FPS results cannot be separated from this combined export.

**Browser warnings:** Firefox displayed Tracking Prevention storage-access warnings for externally loaded `cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`. The QA module still initialized and exported data, so this log is not evidence of a fatal Three.js load error; **it does identify an existing external CDN dependency** that merits a separate offline/supply-chain audit before claiming zero-network operation. The separate Firefox DevTools self-XSS warning is a browser security message, not an application exception.

**Acceptance decision:** Owner's first genuine browser data **RECEIVED, PARSED AND RECORDED**, but **M7 quantitative performance and final release gates remain OPEN**. Next capture should use `BlockBuddiesQA.reset()` immediately before **one** mode/map/team run; save and label distinct JSON exports for TDM Police, TDM Terrorist, Bomb Police/Terrorist and repeat maps; record environment and run lengths; include enough engagements and genuine Bomb plants/defuses. Specifically investigate the **7.0ms rAF vs 8.7ms JS timing discrepancy** before relying on derived FPS, and examine shotgun long-range engagement only with confirmed reproducible results. Do not replace M0 historical evidence with this new unpaired capture.

## Second owner browser capture — 2,264 projectiles / 5 Bomb rounds (2026-10-31 WIB, PROVISIONAL)

**Evidence:** owner-uploaded `block-buddies-m7-qa(1).json`, schema `BLOCK_BUDDIES_M7_QA_V1`, `recordedStartUnixMs=1793429787609` (13:56:27 WIB). The raw JSON stays outside the repository. This is a **follow-up export**, not verified to be an independent controlled run. It **again mixes TDM and Bomb in one reset window**. Exact map, chosen player faction, browser session duration, BOT composition, resolution and matched M0 performance baseline are not present.

| Metric | Recalculated from second owner JSON | Interpretation |
|---|---:|---|
| Browser rAF frame interval (rolling 2,400) | median **7.0 ms**, p95 **13.9 ms**, max **55.5 ms** | Derived **142.9 median approximate FPS remains provisional** |
| Per-frame JS work (rolling 2,400) | median **7.6 ms**, p95 **9.0 ms**, max **46.9 ms** | **Timing consistency issue persists:** JS-work median exceeds rAF-interval median; verify timestamp semantics and callback alignment before final FPS certification |
| BOT update CPU (rolling 2,400) | median **0.2 ms**, p95 **0.5 ms**, max **1.6 ms** | Measures `botsUpd()` only, not full engine/GPU work |
| Sight → first dispatched shot | **283** events; median **332.1 ms**, p95 **602.4 ms**, max **1,405.7 ms** | Includes firing permission/turn/cooldown; not raw human reaction; tail needs explanation |
| BOT projectile collisions | **369 / 2,264 = 16.30%** | Per-projectile/pellet character impacts, not trigger-pull/headshot/damage success |
| TDM projectile collisions | **233 / 1,757 = 13.26%** | Mixed teams/weapons/ranges; not per-faction performance |
| Bomb projectile collisions | **136 / 507 = 26.82%** | Only five completed Bomb rounds; not a Bomb success benchmark |
| Movement low displacement | **125.78 / 1,917.32 BOT-seconds = 6.56%** | Obstruction proxy only; does not establish stuck or clipping |
| A* requests | **2,848 attempts / 0 failures** | Recorded active path requests, not full-map traversal proof |
| Bomb rounds at finish | **5 completed: Police 3 / Terrorists 2; planted-at-finish 2; A 1 / B 1 / no-site 3** | Plant-at-finish is not the same as all plant attempts or defuse completions |

**Weapon-range concern persists:** TDM shotgun **84 pellets / 1 character hit** at 30+ world units; Bomb shotgun **42 / 0** in the same band. Total shotgun long-range **126 pellets / 1 hit (0.79%)**. This is insufficient to authorize arbitrary damage or spread changes; movement and fire-permission range should be profiled in controlled conditions. Reported `observations=512`, `lostUnfiredSightings=173`; no-shot contact reconciliation and per-mode/team breakdown remain absent.

**M7 disposition:** **LIVE DATA REVIEWED / PROVISIONAL; FINAL M7 VERIFIED = NO.** CI #199 already passed 373/373 Node tests and 15/15 synthetic scenarios, but this second mixed-mode export does **not** satisfy the agreed real-browser release gates in the Master Plan: per-map/mode/faction runs, representative range-band samples (proposed ≥200 engagements per band/mode), Bomb outcomes (proposed ≥50 completed rounds per team configuration), paired M0-equivalent frame measurements, timing anomaly review, headshot/damage and map/navigation stability. These targets are proposed sampling coverage, not user obligations to repeat immediately. No automatic release sign-off, gameplay rebalancing, or mechanism modification is implied.

## Automated Windows browser QA — CI-only (introduced 2026-10-31 WIB)

**Workflow:** [BOT AI M7 browser functional QA](../.github/workflows/bot-ai-m7-browser.yml); source: [tools/bot-ai-m7-browser.mjs](../tools/bot-ai-m7-browser.mjs). On relevant changes to browser runtime, source, QA tooling or workflow, GitHub Actions runs independent Windows Chromium jobs for Police and Terrorist. A manually dispatchable run can choose 3/10/50 rounds. No player-side installation, WSL, Docker, server, manual 50-round playtest, or build is needed.

Each job installs exact published npm package versions **playwright@1.56.1** and **three@0.128.0** in the CI runner, routing the original Three.js r128 CDN URL to the matching local package **only within the test browser**. This bypasses external CDN availability for tests, but **does not eliminate** the player's existing CDN dependency in index.html. The runner first verifies the committed source-manifest bundle parity, then creates **temporary CI-only copies** of index.html and assets/game.js. The only injected code is tools/bot-ai-m7-browser-bridge.js inserted inside the original browser IIFE so the test can invoke otherwise private game functions; no CI bridge is added to the committed player bundle. The copied HTML routes Three.js r128 to the installed matching local npm dependency and omits the external Google Fonts link. The CI browser opens these temporary copies over file:// and executes 12-second genuine browser rAF / WebGL / BOT CPU smoke windows **separately** for TDM and Bomb.

For longer functional coverage, it starts an actual canonical 5v5 match, replaces the passive human slot with one additional real production BOT **in the test only**, and invokes the original update(1/60) loop repeatedly while the real-time rendering rAF is prevented from double-ticking. The production A*/LOS, weapons, projectiles, Bomb actions, bombFinish, freeze/fuse rules and match win conditions remain authoritative. The runner **does not force wins/plant/defuse, call bombFinish directly, modify BOMB_RULES or shorten the game's elapsed simulation seconds**. It advances simulation time faster than wall-clock time, therefore outputs are explicitly labelled **ACCELERATED_PRODUCTION_BROWSER_SIMULATION_NOT_REALTIME**, not "50 real-time human matches" or a browser FPS benchmark. A QA-only reallocation of the human bomb carrier to a real BOT is documented in output.

The resulting per-team JSON artifacts contain browser error counts, rendered frame-time and BOT CPU sample summaries, 5v5 validation, accelerated sample rounds, winners, planting-at-finish, A* and projectile counts, and explicit PASS/FAIL reasons. **Functional PASS must never automatically change the milestone to FINAL VERIFIED**. Remaining final acceptance includes matched M0-compatible real-time performance comparisons, sufficient per-faction/map/range observations and true plant/defuse event denominators, long-run stability, and investigation of the original frame-timing discrepancy. Human playtest remains previous M0–M6 owner evidence only; this automation cannot certify subjective tactical quality.

### Automated browser CI bootstrap evidence (2026-10-31 WIB)

- **First Windows browser run #1**: test harness timed out trying to access game functions from the global window. This was a **test harness error**: the canonical browser game is intentionally wrapped inside a private IIFE. The source bundle was not changed.
- **Run #2**: diagnostics confirmed `THREE` and `BlockBuddiesQA` initialized, while `begin/update/BOMB_RULES` were deliberately IIFE-private. Replaced direct global access with the temporary CI-generated IIFE bridge, preserving shipped game bundle.
- **Run #3**: a real browser and 5v5 QA roster started. Software-WebGL 12-second smoke returned only 59 TDM and 30 Bomb frames on the Windows CI VM; their p95 intervals (199.9 ms and 400 ms) are **not a Windows laptop FPS performance acceptance**. The test harness then falsely expected `en.length===10` after BOT deaths, which is incorrect because dead BOTs leave the active list. Fixed to detect the actual `bombMatch` object transition for round reset.
- **Later runs**: optimized the accelerated functional portion to skip software rendering only after the independent real-time browser smoke completed, and added progress output per 10 genuine finished Bomb rounds. The latest job outcome must be verified from GitHub Actions before declaring automated QA PASS. A green CI functional result does not waive final M7 performance and representative sample constraints.

## Audit verdict

**M6 core VERIFIED by owner 7/7 manual PASS and prior Windows CI. M7 instrumentation and automated synthetic suite implemented; M7 FINAL QA/RELEASE REMAINS OPEN.** No real browser or match session was executed by GitHub Actions; thus no recorded FPS, real BOT hit-rate improvement, measured true reaction percentile, navigation stuck improvement, measured Bomb-win percentages or proven 10%/15% performance overhead thresholds may be claimed. The original M0 fixed-seed arena changed significantly across M1–M6, so comparing a 2026-10-30 M0 synthetic dispatch count directly with a 2026-10-31 M7 result would **not** prove a causal real-game gain.

M7 is an evaluation milestone. Do not turn on game telemetry for ordinary users, auto-send reports, loosen the old gameplay contract or mark a release PASS simply because tests are green.
