# Weapon source organization

Edit weapon data in one place: `src/game/weapon/<NN>-<name>.js`. Each file owns its stable numeric weapon ID, unchanged `WEAPON_PROFILES[id]` ratings, CS-inspired falloff modifier, and low-poly 3D model builder.

## Weapon classes
| Class | Weapons | Source kind |
| --- | --- | --- |
| Assault Rifle | AK-47 (2), K2 (10), AK SOPMOD (13) | `rifle` |
| SMG | Kriss (7), Dual Kriss (8), MP7 (11), P90 (12) | `smg` / `dual` |
| Sniper Rifle | AWP (9) | `sniper` |
| Shotgun | Shotgun (3) | `shotgun` |
| Handgun | Handgun (1) | `pistol` |
| Launcher | RPG (4) | `rocket` |
| Melee | Knife (5) | `knife` |
| Throwable | Grenade (6) | `grenade` |

_Numbers in parentheses are the 1-based filenames, NOT weapon IDs. Actual weapon IDs are 0–12, starting with Handgun at 0. Don't renumber IDs: inventory save data and bots depend on them._

## Shared modules
- `00-registry.js` initializes arrays, the frozen class labels, and `DAMAGE_FALLOFF.referenceUnits` (currently 20 BLOCK BUDDIES world units per modifier interval).
- Each numbered weapon module registers one immutable rating profile, `WEAPON_RANGE_MODIFIERS[id]`, and `WEAPON_MODEL_BUILDERS[id]`.
- `20-ballistics.js` derives runtime weapon damage, cooldown, speed, pellet damage, bullet lifetime and falloff from registered profiles.
- `30-viewmodels.js` owns generic Three.js gun dispatch, player hands and reload/ADS animation, plus shared weapon world state. No per-weapon mesh definitions remain there.
- `src/game/45-combat.js` places falloff on bullets when fired. `src/game/75-weapon-controls.js` evaluates the distance at collision; `src/game/42-projectile-defense.js` applies it BEFORE headshot/vest logic.

## Damage formula (Counter-Strike inspired, not identical unit system)

`damageAtDistance = baseDamage * Math.pow(rangeModifier, distance / DAMAGE_FALLOFF.referenceUnits)`

CS:GO/CS2 uses 500 CS units per modifier interval. BLOCK BUDDIES has a much smaller arena and uses 20 of its own world units. All weapon range ratings remain hard maximum projectile travel distances and are not changed by this patch.

| Class / weapon | Modifier per 20 units |
| --- | ---: |
| AK-47, K2 | 0.98 |
| AK SOPMOD | 0.97 |
| MP7 | 0.85 |
| P90 | 0.86 |
| Kriss, Dual Kriss | 0.83 |
| Shotgun (each pellet) | 0.70 |
| Handgun | 0.91 |
| AWP | 0.99 |
| RPG, Knife, Grenade | N/A (no bullet falloff) |

## Tuning guide

- Make a **single weapon** stronger at distance: increase its `WEAPON_RANGE_MODIFIERS[id]` toward 1; decrease it toward 0 to weaken it.
- To change all engagement lengths, edit `DAMAGE_FALLOFF.referenceUnits` in `00-registry.js`. Larger values yield slower damage decay.
- To change primary base damage, movement or maximum projectile range, adjust the immutable weapon `WEAPON_PROFILES[id]` rating in its own source file. Do not change numeric IDs.
- Body armor and helmets are independently configured in `src/game/39-defense.js` (`bodyReduction`, `vestMax`, `headshotMultiplier`). They remain unchanged in this release.
- For local damage/TTK tables: `node tools/damage-sim.mjs`. It assumes every bullet/pellet lands, and excludes misses, reload and movement.
- After any edit run `node tools/build.mjs && node tools/build.mjs --check && node --check assets/game.js && node --test tests/*.test.mjs`, then commit updated `assets/game.js`. Never edit that generated bundle directly.
