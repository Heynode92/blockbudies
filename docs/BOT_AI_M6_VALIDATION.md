# POINT BLOCK — M6 TDM Aggression & Weapon-Class Intelligence Validation

> **Status:** VERIFIED (CORE EXIT GATE: 361/361 WINDOWS CI + OWNER-REPORTED 7/7 MANUAL PASS); QUANTITATIVE TDM/FPS KPIs OPEN
> **Date:** 2026-10-31 WIB
> **Scope:** TDM target prioritization, fair spawn-aware map rotation, canonical weapon-class movement bands; Bomb and weapon rules unchanged
> **CI evidence:** [Windows GitHub Actions run #167](https://github.com/Heynode92/blockbudies/actions/runs/41176771936) — **361/361 Node tests PASS**, zero failed, committed direct-open bundle parity, JavaScript syntax, deterministic 10-BOT seed replay and synthetic CPU-time checks green.

## Source audit and immutable gameplay contracts

- Original TDM behavior in `src/game/90-bot-ai.js` chose nearest M1-visible target, drove all weapons with essentially identical forward/back distance thresholds and selected no-contact patrol via random wandering. **M6 changes only these TDM decisions.**
- Real weapon kind comes from the existing `WP[e.weapon].stats.kind`, with rifle/shotgun/SMG/dual/sniper/pistol categories from the production registry, not duplicated damage/range/fire-rate profiles. The pool `BOT_WEAPONS.primaries:[1,1,1,2,2,6,6,6,7,8]` is **unchanged**. **RPG weapon ID 3 is excluded** and remains unavailable to BOT loadout selection.
- Original `spawnPt(tm)` already creates random, enemy-separated TDM spawn points with canonical invulnerability. M6 **does not modify spawn locations, respawn delay or protection timers**, and avoids proactively sending patrols into an enemy spawn band.
- M1 actual LOS/recent evidence, M2 aiming/reaction and original `fire()` bullets, M3 A* routing/physical collision and M4 squad flank intelligence remain authoritative. M5 Bomb Mission state, score, site decisions, timers and tactics are unmodified.

## Delivered implementation

| File | Responsibility |
|---|---|
| `src/game/88-bot-tdm.js` | New isolated M6 TDM strategy: visible-threat scoring, hysteresis, spawn protection priority, per-weapon engagement distance, central bounded map-control patrols |
| `src/game/90-bot-ai.js` | TDM branches call M6 target selection and combat-range intent and replace random no-contact wandering with M6 map-control waypoints; Bomb still calls the original `botIntelAcquire()` |
| `src/game/85-lobby-and-match.js` | Resets M6 TDM route state whenever a BOT spawns |
| `tools/source-manifest.json`, `assets/game.js` | Registers M6 after M1/M3/M4, before shared tactical AI; direct-open browser bundle synchronized |
| `tools/bot-ai-m0-baseline.mjs`, `tests/bot-five-star.test.mjs` | Real active AI M6 dependency loaded in deterministic 10-BOT regression fixtures |
| `tests/bot-ai-m6-tdm-intelligence.test.mjs` | 15 dedicated M6 tests including actual production A* path routing |

### Tactical behavior

- **Threat scoring:** compares *only* live M1-visible enemies (including human players), with nearest distance, current-target hysteresis, a bounded visible low-HP preference and the equipped weapon's useful distance. An opponent with active spawn protection is not selected as a new target. Hidden enemy movement and sound-only hints never create a shootable actor. No preferential human-player targeting.
- **Weapon-driven movement:** handgun/pistol, shotgun, SMG, dual, assault rifle and sniper receive distinct **movement-distance bands** while keeping their real `WP` damage, bullet spread, ammo, magazine/reload and M2 aim behavior unchanged. A sniper repositions away from very close targets; a shotgun closes to practical range. M3 dodge, collision checks, low-HP retreat, melee and M4 teamwork remain in control when relevant.
- **Map-control routing:** once M1 memory/hearing/radio contacts expire, BOTs can patrol a small set of deterministic role-distributed anchors in the middle of the map. Each candidate requires canonical collision-free geometry and reachable A* routing. Bounded to at most **3 A* checks per 3.8-second planning window**; inaccessible goals fail closed, clear stale pursuit waypoints and do not force an unsafe straight-line wall charge.
- **Spawn safety:** canonical TDM spawns are around `z = +38/-38` with `+/-10` random variation. New map-control anchors stay within a central `|z| <= 24` region, outside those spawn bands. Proactive patrol therefore does not assign enemy-spawn camping routes. This **does not claim absolute anti-camping** in all real matches, since legitimate visible combat can still occur anywhere players move.

## Automated verification

- [x] TDM acquisition requires M1 LOS, refuses stale/hidden enemies and does not create a target from hearing.
- [x] Visible enemy players and BOTs are scored by the same rules, with stable target hysteresis and no player bias.
- [x] Newly protected spawn actors do not receive preferred target selection.
- [x] Six normal weapon kinds map to independent useful-distance movement bands; no weapon stats altered.
- [x] Sniper close-range retreat, shotgun approach and SMG mid-range movement; unchanged dodge/strafe axes.
- [x] Critical HP retreat, M3 cover and canonical melee choice are not overwritten.
- [x] Bomb Mission bypasses M6 acquisition, patrol and engagement intent (original M1/M5 logic stays active).
- [x] Both factions receive reachable centrally distributed TDM waypoints that do not enter enemy spawn bands.
- [x] No-route A* retry is rate-limited and fail-closed; expired M1 pursuit coordinates are discarded if safe patrol fails.
- [x] Active production A* routes around a synthetic solid building to an M6 waypoint.
- [x] Original `BOT_WEAPONS.primaries` preserved; RPG ID 3 absent; no M6 damage, recoil or position mutation.
- [x] Windows [Actions run #167](https://github.com/Heynode92/blockbudies/actions/runs/41176771936): **361/361 complete tests PASS**, committed bundle parity and syntax green, deterministic active BOT scenario replay and synthetic CPU checks completed.
- [x] **Owner-reported M6 manual gameplay 7/7 PASS (2026-10-31 WIB):** both teams aggressive, shotgun/SMG approach vs rifle/sniper positioning, legal LOS with no observed hidden-target tracking, natural patrol after lost contact, no persistent spawn camping or spawn-shield violations observed, Bomb plant/defuse/retake/round integrity unchanged, no visible permanent stuck/clipping/freeze/crash/heavy lag. User self-report, not raw measured FPS or map logs.
- [ ] Real match per-weapon hit%, effective engagement range distributions, actual spawn camping frequency, player and BOT kill/death balance, navigation and FPS/frame-time p95, multi-map/team soak statistics. **Not measured by CI.**

## Limitations and sign-off

M6 improves heuristics; it is **not** a machine-learning agent, and this update does not establish human competitive equivalence, quantitative accuracy improvements or absolute no-spawn-camping guarantees. Node VM synthetic 10-BOT replay and CPU benchmarks are not actual Chrome/Firefox/WebGL frame times, match hit percentages, headshots, win rates or real-map navigation success statistics.

**M6 core feature exit gate VERIFIED** from 361/361 full Windows CI plus explicit owner-reported 7/7 manual gameplay PASS. M7 performance/release QA is separately authorized and **IN PROGRESS**, with actual browser metrics not yet collected. M0–M5 core milestones were previously accepted; no hit-rate or FPS value is inferred from the owner report.

## M6 owner manual acceptance — 2026-10-31 WIB

The repository owner explicitly reported **“M6 playtest PASS bro”** and **all 7 checks passed**: Police and Terrorist aggression, differentiated weapon-class positioning, no visible hidden-opponent coordinate leakage, map-control rotation after LOS lost, no repeated spawn camping or firing on spawn-shielded enemies, normal Bomb interactions/round completion, and no permanent stuck, wall clipping, freeze, crash or heavy perceived lag. **Self-reported qualitative results only**, not independent browser instrumentation; exact session lengths, FPS, hit percentages, weapon-band sample counts and full two-map test matrix were not supplied.

**Decision:** M6 **CORE VERIFIED** based on owner acceptance and [CI #172](https://github.com/Heynode92/blockbudies/actions/runs/41176995240) (361/361 PASS). **M7 diagnostics and release QA are separately authorized; real quantitative KPI gates remain OPEN**.

## Owner Windows test procedure

After `git pull origin main` open `index.html`. In **Deathmatch**, watch Police and Terrorist BOTs with rifle, SMG, shotgun and sniper as available by random loadout; BOTs should push or create distance according to the weapon, rotate through central map regions after losing contact, and avoid blindly hunting in the opposing spawn zone. Verify bots don't shoot during another actor's spawn shield, aren't perfectly tracking enemies behind geometry and still engage naturally after contact. Briefly verify **Bomb Mission** plant/defuse/round behavior is unchanged. Report a genuine **“M6 playtest PASS”** or a specific map/faction/weapon issue; do not report a quantitative KPI PASS without sampled measurements.
