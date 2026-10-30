# BLOCK BUDDIES — M1 Perception & Awareness validation

> **Milestone:** M1 — Perception, hearing, finite memory and legitimate team intel
> **Status:** M1 VERIFIED (CORE EXIT GATE: AUTOMATED CI + OWNER-REPORTED MANUAL SMOKE); ADVANCED QUANTITATIVE KPIs OPEN
> **Date:** 2026-10-31 WIB
> **Baseline:** M0 foundation verified, [M0 report](BOT_AI_M0_BASELINE.md)
> **Automated evidence:** [Windows GitHub Actions run #67](https://github.com/Heynode92/blockbudies/actions/runs/41108118435), **297/297 tests PASS**, bundle parity, JavaScript syntax, synthetic BOT replay and CPU sample job PASS

## Intent and implemented behavior

- **Observed enemies only:** The active `botsUpd()` uses `botIntelAcquire()` with the existing LOS geometry and 45-unit sight limit. Current enemy actor pointers are immediately discarded when occluded or dead, including between slower decision ticks. Shooting remains guarded by live visibility and canonical weapon/damage mechanics.
- **Provenance and expiry:** `botIntelObserve()` creates a position/time/sighting source snapshot rather than retaining an enemy actor pointer. Personal sight memory lasts 3.6 seconds; team radio is an independently bounded snapshot lasting 2.4 seconds.
- **Team radio:** A genuine observed position can be shared between same-team BOTs, timestamped and throttled. No hidden actor positions are forwarded; neither Police nor Terrorists receive the opposite team's radio reports.
- **Audio cues:** Actual grounded footstep strides and actual gunfire dispatches emit bounded sound events, even when the local game sound volume is muted. Enemy sound offers approximate quantized coordinates, **not identity or permission to shoot**. Hearing has separate ranges for footsteps (17 units) and gunshots (37), reduced to 60% when the existing 2D LOS is blocked. Sound is short-lived (1.35 seconds), queue bounded to 28 records.
- **Tactical use:** In TDM, BOTs investigate sight memory, then radio/intelligible acoustic cues before returning to patrol. In Bomb Mission, threat and pursuit helper functions select only authorized observation snapshots. Bomb site positions, visible planted device/dropped device, and team-elimination scoreboard are pre-existing public objectives, not hidden enemy tracking.
- **Reset:** Match/round reset clears all queued acoustic events, team radio and each BOT's personal observation references.

## Exact code ownership

| Path | M1 scope |
|---|---|
| `src/game/88-bot-perception.js` | New, isolated sight/audio/memory/radio module |
| `src/game/90-bot-ai.js` | Legitimate target acquisition, immediate stale-target rejection, sound investigation |
| `src/game/89-bot-tactical-intelligence.js` | Use authorized observed-memory snapshots |
| `src/game/87-bomb-tactics.js` | Remove perfect-knowledge enemy coordinate scans from Bomb tactical goal logic |
| `src/game/66-footsteps.js` | Emit cue from actual footsteps independently of Web Audio playback |
| `src/game/45-combat.js` | Emit gunshot cue and clear intel during reset; preserve ballistics and damage |
| `tools/source-manifest.json`, `assets/game.js` | Include M1 module in original direct-open standalone browser game |
| `tests/bot-ai-m1-perception.test.mjs` | Occlusion, stale target, radio isolation, hearing and runtime acoustic hooks |

## Verification and checklist

- [x] Active browser AI calls sight/perception rather than raw hidden-enemy scans.
- [x] Stale target pointers are rejected when LOS disappears.
- [x] Last-known coordinates are snapshots, not live enemy actor references; TTL tested.
- [x] Shared radio reports require actual teammate sightings; team isolation and expiry tested.
- [x] Footsteps and gunfire generate sound evidence from canonical actions; attenuation, bounded queue, reset and quantization tested.
- [x] Audio cue alone does not grant a shootable enemy target.
- [x] Bomb tactical helper functions require observer context; hidden enemy movement cannot alter search goals in occluded test scenarios.
- [x] Pre-existing Bomb plant/defuse/retake tests remain passing; tests updated to require legitimate observed threats and fading memory.
- [x] Complete Windows Node regression, standalone bundle parity, JS syntax, deterministic baseline and timing CI passed: [run #67](https://github.com/Heynode92/blockbudies/actions/runs/41108118435), **297 pass / 0 fail**.
- [x] Owner-reported M1 post-update manual gameplay smoke **PASS** (2026-10-31 WIB, user statement: "M1 playtest pasa bro"). **Scope caveat:** exact map/faction/session duration, per-scenario LOS/audio and Bomb actions were not individually described; treat as aggregate user acceptance, not measured evidence for each scenario.
- [ ] Real browser FPS/p95, genuine hit%, measured reaction time, complete per-map 3D cover/ceiling occlusion, navigation/stuck and Bomb win-rate telemetry. These were not reported by M1 CI and must not be checked.

## Owner acceptance and M1 exit-gate decision (2026-10-31 WIB)

**Manual evidence:** the repository owner replied **“M1 playtest pasa bro”** after being instructed to pull latest `main` and play both TDM and Bomb Mission to review LOS loss, sound investigation, plant/defuse and freeze/regressions. This is an **owner-reported aggregate PASS**, not independently observed telemetry. No per-map/per-faction sample counts, browser/OS version, screenshots, or individual scenario results were provided; those details remain undocumented.

**Automated evidence:** [Windows CI run #72](https://github.com/Heynode92/blockbudies/actions/runs/41108545600), committed head `79919e97803e21a09877e3ad3efc61062acef51e`, completed **SUCCESS, 297/297 passing tests**, with bundle parity, JavaScript syntax, deterministic behavior, synthetic CPU and M1 perception safety tests passing.

**Decision:** **M1 VERIFIED for its scoped core feature/exit gate** (code delivered, regression protection and owner-reported playable acceptance). **M2 READY / NOT STARTED**. This is not a claim of real browser FPS, actual hit rate, measured reaction latency, quantitative stuck/navigation rate or statistical Bomb success. Such advanced KPIs are still [ ] unchecked and remain future evidence gates, especially before M7 release. No M2 code or game balance change was authorized in this acceptance record.

## Test scope and limitations

M1 has dedicated isolated evidence tests and the full existing integration suite. A synthetic Windows Node run is **not** an actual browser play session. The perception geometry still uses the canonical existing 2D `los()`; this update does **not** add volumetric eye-level/ceiling sight testing, 3D aim elevation, probabilistic recognition latency or automatic human-like reaction time. Those require separate verification/enhancements and must not be represented as done. The three CPU timing fixtures use synthetic no-human 10-BOT maps and Node VM overhead, not WebGL frame time.

All changed behavior is AI inference/decision and observational event generation. **Unchanged:** weapon damage/recoil/ammo/loadout (including BOT RPG exclusion), actual movement physics, projectile collision and hitboxes, Bomb timers/plant/defuse/scoring, map geometry, UI text, offline startup, and room settings. No backend, Docker, WSL or user build required.

## Manual reviewer checklist (owner-reported aggregate PASS; detailed matrix remains open)

Play after `git pull origin main` and launch `index.html`. In TDM test both teams and a wall between BOT and enemy: BOTs should fight when they see an opponent, stop tracking after hiding, investigate briefly and then resume patrol. Gunshots and footsteps should encourage investigation but must not create impossible through-wall shots. In Bomb Mission test plant/defuse, retake and post-plant defense without knowledge of an unseen moving enemy. Confirm no freezes or new visual/weapon/UI regressions. The owner subsequently reported overall **M1 playtest PASS**. That is sufficient as the agreed manual acceptance for the M1 core milestone, combined with the green automated suite. Individual checks were not separately reported and must not be credited as independently measured per-scenario successes.
