# POINT BLOCK — M2 3D Aim & Shooting Intelligence Validation

> **Status:** VERIFIED (CORE EXIT GATE: 306/306 AUTOMATED + OWNER-REPORTED 7/7 MANUAL PASS); QUANTITATIVE KPIs OPEN
> **Scope:** M2 only — genuine yaw/pitch aim intent, bounded response, live-target movement lead, weapon-class dispersion; NO M3 locomotion/cover changes
> **Date:** 2026-10-31 WIB
> **CI evidence:** [Windows Actions run #93](https://github.com/Heynode92/blockbudies/actions/runs/41173731387) — **306 tests PASS / zero failed**, canonical standalone bundle parity, JS syntax and synthetic replay + CPU baseline checks green.

## Implemented changes

- **Separate `src/game/40-bot-aim.js` module** owns BOT fire-control configuration. Active `botsUpd()` feeds it **currently visible enemies only**. LOS failure or target loss clears shoot permission and target observations immediately.
- **Real 3D aim:** Horizontal aim solves yaw from the currently visible target, vertical aim solves pitch from BOT muzzle height to target **torso** (not an automatic headshot), with elevation and existing crouch offsets taken into account. Current target samples can supply **at most 180 ms** of predictive lead, bounded by observed target speed (8 game units/second). Hidden enemies cannot generate new target samples or steer aim.
- **Bounded motion:** Target changes start from the BOT model's current facing, not a stale previous yaw; yaw turning is limited to 4.6 rad/s and pitch turning to 2.8 rad/s. Target-specific initial reaction is randomized between **180–460 ms**. These are design parameters, **not measured human reaction-time statistics**.
- **Shooting authorization:** Shooting waits for reaction time and angular tolerance. Aim error is computed separately for pistol, rifle, SMG, dual, shotgun, sniper and rocket archetypes, with distance and burst drift. No forced hits, headshots or raw damage multipliers.
- **Canonical ammunition/ballistics:** `botAttack()` authorizes a lawful aim solution **before subtracting a bullet**. `fire()` consumes transient `aimShotPitch` for BOT shots to assign real `vy`, while preserving the player pitch formula, original bullets, collision, `WP` damage, reload and cooldown.
- **Both teams and modes:** Active BOT AI is shared by Police and Terrorists in Deathmatch and Bomb Mission. M1 sight/hearing/radio rules remain in force.
- **Offline browser:** `tools/source-manifest.json` includes the M2 source module and the committed `assets/game.js` has been rebuilt and parity-verified. No backend, Docker, WSL, runner or local build required.

## Regression and evidence

- [x] First observation cannot fire instantly; reaction gate measured in synthetic tests.
- [x] Pitch moves upward and downward when target elevation changes.
- [x] A sudden 180-degree target change does not instant-snap the BOT body.
- [x] Reacquisition after patrol uses the **current body heading**, not stale aim heading.
- [x] LOS loss clears aim permissions and does not allow invisible-target leading.
- [x] Predictive lead bounded to recent legal visible samples and projectile travel time.
- [x] Weapon-class angular error is finite and capped; no deterministic perfect aim.
- [x] Production `fire()` produces BOT bullets with vertical velocity, preserves original player projectile pitch and bullet damage.
- [x] Aim denial consumes no ammunition; successful shots retain canonical ammo/cooldown.
- [x] All legacy BOT defense/weapon/Bomb objective regressions remain enabled; separate old fixture mocks were updated only where they need an authorized aim solution.
- [x] Canonical offline bundle check + JavaScript syntax + **306/306** full Node tests + CPU baseline success in [Windows CI run #93](https://github.com/Heynode92/blockbudies/actions/runs/41173731387).
- [x] **Owner-reported M2 manual gameplay acceptance, 7/7 PASS (2026-10-31 WIB):** higher/lower targets, finite shooting reaction, moving-target tracking, no wall penetration, both team combat, plant/defuse/round completion, and no freeze/crash/severe perceived lag. Qualitative owner report, not instrumented browser telemetry.
- [ ] **Real match metrics:** actual hit%, reaction time median/p95, headshot ratio, per-weapon/range/elevation samples, stuck/path, FPS/p95, Bomb objective outcomes. These remain unmeasured.

## M2 owner manual acceptance record — 2026-10-31 WIB

The owner explicitly submitted **“M2 playtest PASS bro”** and confirmed **all 7 checks passed**: (1) elevation tracking and shooting, (2) no instant first-shot reaction, (3) reasonably imperfect moving-target pursuit, (4) no through-wall shooting, (5) normal Police/Terrorist combat, (6) Bomb plant/defuse/round resolution and (7) no freeze/crash/perceptible severe performance regression. This is a **self-reported qualitative gameplay smoke test**, not independently observed performance telemetry. Map names, game/browser version, session durations and per-team samples are not provided. The existing quantitative KPI checkboxes stay OPEN.

**Decision:** M2 core exit gate **VERIFIED**, supported by [Windows Actions run #98](https://github.com/Heynode92/blockbudies/actions/runs/41173880185) (306/306 pass) plus owner manual 7/7 PASS. User approved subsequent M3 development. **M3 is a distinct later milestone:** it has now been implemented and passed [Windows CI #112](https://github.com/Heynode92/blockbudies/actions/runs/41174449879) (318/318); manual M3 gameplay acceptance remains pending. See [M3 validation](BOT_AI_M3_VALIDATION.md).

## Synthetic M2 behavior observation (not real-match accuracy)

Windows CI synthetic 10-BOT, seed 42, 60 frames at 50 ms:
- TDM open LOS: **110 fire dispatches; 110 captured nonzero BOT pitch values**; initial dispatch at 0.20 s.
- TDM blocked LOS: **0 fire dispatches and 0 nonzero pitch values**.
- Critical-HP TDM: **33 nonzero-pitch dispatches**, at least 9/10 bots exhibit retreat under reaction-limited contact.
- Bomb open LOS: **93 nonzero-pitch fire dispatches**.

**Limitation:** Fire dispatches are not hits. Synthetic 10-BOT fixture does not execute actual WebGL render frames, full real map collision, actual projectile hit percentages or sampled human engagement decisions. CPU tick timings include Node VM overhead. M1's prior LOS module remains 2D; aim vertical bullets are subject to existing real projectile colliders. A three-dimensional eye-level visibility/cover evaluation is an unmeasured limitation, not a verified enhancement.

## Manual acceptance for owner (M2 only)

After `git pull origin main`, open `index.html` on Windows (no build). Play both modes and look for:
1. BOT can hit **higher/lower targets** with existing physics; body aim, not guaranteed headshots.
2. BOT facing rotates toward newly discovered enemies instead of instantly snapping or shooting through a wall.
3. Fast-moving players can still evade: BOT needs a finite acquisition/reaction interval, aims with class-appropriate misses, and consumes actual bullets.
4. Police and Terrorists remain able to plant/defuse/attack/defend; no freeze/stuck or UI/weapon regressions.

An aggregate owner-reported PASS can close the **M2 core feature gate**, while detailed numerical performance and per-map/faction scenario acceptance remain explicitly open for continued M7-quality validation. **M3 was subsequently implemented as a separate milestone and automated tests passed; its owner gameplay validation is still pending**. See [M3 validation](BOT_AI_M3_VALIDATION.md).
