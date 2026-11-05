# PointBlock — Combat Phase 7: historical vs current TTK validation

**Date:** 2026-11-06 (Asia/Jakarta)  
**Status:** reproducible *theoretical* combat comparison, not a live 5v5 playtest  
**Data:** [frozen 19-weapon and damage vectors](./combat-phase7-vectors.json)

## Exact source baselines

- Historical **before Phase 1:** FE `1e90ea0a1111e037655166ed199f9eae2706fc90`, BE `369df356bffdc0a4dd1a968a46291f5877b392ee`.
- **After Phase 6:** FE `446307be570c82e99cfd11331bbc7af1fd9e96f4`, BE `9f8bd42b9244aa494b7ecbc8739207146af755ac`.
- All **19 weapon profile source files** remain byte-identical from before Phase 1 through Phase 6. BE's 19-record `WEAPONS` and per-class RPM tuning are byte-identical to the pre-Phase 1 baseline, too. Source revisions were verified against the actual GitHub commits, not recreated from community game statistics.
- There are **16 direct bullet weapons** and **3 other weapons** (RPG, Knife, Grenade). Those three use explosion/melee range, fuses/animation, proximity, and possible reload; conventional all-chest bullet TTK is not meaningful for them. Their identities/rating invariance is still tested.

## Calculation contract

Historical: `HP=100`, initial `VEST=50` (20% body-bullet absorption while positive, consuming equal durability), no differentiated body hitgroups; for any bullet, `rawPellet=(damage/pellets) × rangeModifier^(distance/20)`. Helmet prevents first headshot's ×3 multiplier.

Current: `HP=100`, **non-consumable** chest/arm bullet reduction **30%**, except the **pump Shotgun** 20%; stomach hitgroup ×1.25, legs ×0.75. Rifle falloff is one piecewise-linear curve with a **100% plateau through 30m**; non-rifle falloff remains historical exponential. Helmet and unhelmeted headshot ×3 policy remains. Six shotgun pellets consume **one trigger/cooldown**.

**Interpretation:** All reported distances are horizontal PointBlock world units (5, 30, 60), and a shot means one *trigger cycle*, not each shotgun pellet. Assume a stationary 100-HP opponent; **every shot and all six shotgun pellets hit the CHEST**, there is no spawn shield/LOS obstruction, the first trigger fires at time zero, and only original effective RPM determines the trigger interval. `TTK=(triggersToKill−1)×60/effectiveRPM`. Values exclude pellet misses, recoil, spread, simulated 30-Hz tick quantization, projectile travel, network latency, animations and movement. None of these 45 scenarios needs a reload; a displayed **0.000 s** is a one-trigger idealized kill, *not* an instantaneous real-world kill.

The *historical* vest is depleted **pellet-by-pellet**; current armor is applied each pellet without durability. Every raw hit remains fractional until HP is exhausted (no intermediate rounding).

## Aggregate across 45 comparable bullet/range cases

- **0 cases faster**, **16 unchanged**, **29 slower** than the historical system, under the ideal all-chest-hit model.
- These are *discrete hit-count thresholds*; minor damage changes often leave trigger count unchanged. The table reports full idealized TTK rather than claiming any subjective gameplay feel.

## Complete historical vs current ideal chest TTK

| Distance | Weapon (ID) | Max range | Old triggers | Current triggers | Old TTK (s) | Current TTK (s) | Difference (s) |
|---:|---|---:|---:|---:|---:|---:|---:|
| 5 | Handgun (#0) | 45 | 5 | 6 | 0.725 | 0.906 | +0.181 |
| 5 | AK-47 (#1) | 140 | 4 | 5 | 0.254 | 0.339 | +0.085 |
| 5 | Shotgun (#2) | 70 | 1 | 1 | 0.000 | 0.000 | 0.000 |
| 5 | Kriss (#6) | 60 | 7 | 8 | 0.352 | 0.411 | +0.059 |
| 5 | Dual Kriss (#7) | 60 | 8 | 9 | 0.344 | 0.393 | +0.049 |
| 5 | AWP (#8) | 180 | 2 | 2 | 1.375 | 1.375 | 0.000 |
| 5 | K2 (#9) | 120 | 4 | 4 | 0.245 | 0.245 | 0.000 |
| 5 | MP7 (#10) | 60 | 7 | 8 | 0.352 | 0.411 | +0.059 |
| 5 | P90 (#11) | 65 | 6 | 7 | 0.295 | 0.354 | +0.059 |
| 5 | AK SOPMOD (#12) | 160 | 4 | 5 | 0.252 | 0.336 | +0.084 |
| 5 | MP5K Ext (#13) | 45 | 6 | 7 | 0.295 | 0.354 | +0.059 |
| 5 | UMP45 Ext D (#14) | 50 | 6 | 6 | 0.297 | 0.297 | 0.000 |
| 5 | HK417 (#15) | 160 | 4 | 5 | 0.249 | 0.332 | +0.083 |
| 5 | XM8 (#16) | 100 | 6 | 6 | 0.416 | 0.416 | 0.000 |
| 5 | XM2010 (#17) | 200 | 2 | 2 | 2.000 | 2.000 | 0.000 |
| 5 | Saiga-12 (#18) | 70 | 2 | 2 | 0.871 | 0.871 | 0.000 |
| 30 | Handgun (#0) | 45 | 6 | 7 | 0.906 | 1.087 | +0.181 |
| 30 | AK-47 (#1) | 140 | 4 | 5 | 0.254 | 0.339 | +0.085 |
| 30 | Shotgun (#2) | 70 | 2 | 2 | 0.901 | 0.901 | 0.000 |
| 30 | Kriss (#6) | 60 | 8 | 9 | 0.411 | 0.470 | +0.059 |
| 30 | Dual Kriss (#7) | 60 | 10 | 11 | 0.442 | 0.491 | +0.049 |
| 30 | AWP (#8) | 180 | 2 | 2 | 1.375 | 1.375 | 0.000 |
| 30 | K2 (#9) | 120 | 4 | 4 | 0.245 | 0.245 | 0.000 |
| 30 | MP7 (#10) | 60 | 8 | 9 | 0.411 | 0.470 | +0.059 |
| 30 | P90 (#11) | 65 | 7 | 8 | 0.354 | 0.413 | +0.059 |
| 30 | AK SOPMOD (#12) | 160 | 4 | 5 | 0.252 | 0.336 | +0.084 |
| 30 | MP5K Ext (#13) | 45 | 8 | 9 | 0.413 | 0.472 | +0.059 |
| 30 | UMP45 Ext D (#14) | 50 | 7 | 8 | 0.356 | 0.416 | +0.059 |
| 30 | HK417 (#15) | 160 | 4 | 5 | 0.249 | 0.332 | +0.083 |
| 30 | XM8 (#16) | 100 | 6 | 6 | 0.416 | 0.416 | 0.000 |
| 30 | XM2010 (#17) | 200 | 2 | 2 | 2.000 | 2.000 | 0.000 |
| 30 | Saiga-12 (#18) | 70 | 3 | 3 | 1.743 | 1.743 | 0.000 |
| 60 | AK-47 (#1) | 140 | 5 | 6 | 0.339 | 0.424 | +0.085 |
| 60 | Shotgun (#2) | 70 | 3 | 3 | 1.802 | 1.802 | 0.000 |
| 60 | Kriss (#6) | 60 | 11 | 12 | 0.587 | 0.646 | +0.059 |
| 60 | Dual Kriss (#7) | 60 | 13 | 14 | 0.589 | 0.638 | +0.049 |
| 60 | AWP (#8) | 180 | 2 | 2 | 1.375 | 1.375 | 0.000 |
| 60 | K2 (#9) | 120 | 4 | 5 | 0.245 | 0.326 | +0.082 |
| 60 | MP7 (#10) | 60 | 10 | 12 | 0.528 | 0.646 | +0.117 |
| 60 | P90 (#11) | 65 | 9 | 10 | 0.472 | 0.530 | +0.059 |
| 60 | AK SOPMOD (#12) | 160 | 5 | 6 | 0.336 | 0.420 | +0.084 |
| 60 | HK417 (#15) | 160 | 5 | 6 | 0.332 | 0.416 | +0.083 |
| 60 | XM8 (#16) | 100 | 6 | 7 | 0.416 | 0.499 | +0.083 |
| 60 | XM2010 (#17) | 200 | 2 | 2 | 2.000 | 2.000 | 0.000 |
| 60 | Saiga-12 (#18) | 70 | 4 | 5 | 2.614 | 3.486 | +0.871 |

## Explicit damage parity vectors

For every included rifle, pistol, SMG, dual, sniper and shotgun, `combat-phase7-vectors.json` also records at 5m/30m/60m where in range: **actual fractional raw damage per pellet**, and exact current *chest, stomach, arm, leg, helmeted-head, unhelmeted-head* HP damage per pellet. FE and BE targeted tests consume the **identical fixture bytes**, independently calculate these numbers from their current runtime source, and reject any profile/retention/defense divergence. BOT and human receive identical verified damage for the same hitgroup and helmet state; no client-supplied hitgroup/damage is accepted online.

## Preserved security and presentation requirements

- BE alone resolves accepted collision/headshot/hitgroup, ammo and HP; the authenticated input gate rejects client-declared victim, damage, hitgroup, headshot, bullet origin, RPM and projectile timing.
- FE hitmarker/kills/blood/death animation/kill feed/results are *effects of server-confirmed events*, not a second online damage authority. No visible vest durability meter; permanent defense does not consume a VEST item.
- Projectile collision accuracy, shotgun pellet spread, target motion and a server snapshot/network pacing **cannot be established from static all-hit TTK calculations**. They require an observed multiplayer session. Historical damage comparisons are **not** empirical FPS balance results.

## CI acceptance and release notes

- Phase 7 Windows actions target only the Phase-7 frozen-vector test, its direct Phase-1–6 damage/geometry/input dependencies, FE game bundle parity/build and BE TypeScript typecheck/build. No recurring BOT M0–M7 QA.
- **Implementation-only phase:** no edits to the original 19 weapon profiles, BE authoritative engine, FE projectile physics, RPM, recoil, hitboxes, defense numbers, or UI are intended.
- **Manual acceptance still outstanding:** one or more two-browser multiplayer DM/BM sessions (all 5 maps if release scope requires), 5v5 under realistic packet load, legal hit/miss distribution including crouch/headshot, damage visual/kill feed/rewards, reconnect and frame-time measurements. Production readiness must not be inferred from automated checks alone.
