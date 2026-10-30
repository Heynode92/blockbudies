# Weapon source organization

Edit weapon data in one place: `src/game/weapon/<NN>-<name>.js`. Each file owns its stable numeric weapon ID, unchanged `WEAPON_PROFILES[id]` ratings, CS-inspired falloff modifier, and low-poly 3D model builder.

## Weapon classes
| Class | Weapons | Source kind |
| --- | --- | --- |
| Assault Rifle | AK-47 (2), K2 (10), AK SOPMOD (13), HK417 (16), XM8 (17) | `rifle` |
| SMG | Kriss (7), Dual Kriss (8), MP7 (11), P90 (12), MP5K Ext (14), UMP45 Ext D (15) | `smg` / `dual` |
| Sniper Rifle | AWP (9), XM2010 (18) | `sniper` |
| Shotgun | Shotgun (3), Saiga-12 (19) | `shotgun` |
| Handgun | Handgun (1) | `pistol` |
| Launcher | RPG (4) | `rocket` |
| Melee | Knife (5) | `knife` |
| Throwable | Grenade (6) | `grenade` |

_Numbers in parentheses are the 1-based filenames, NOT weapon IDs. Actual weapon IDs are 0–18, starting with Handgun at 0. Don't renumber IDs: inventory save data and bots depend on them._

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
| HK417 (inherited rifle modifier) | 0.98 |
| XM8 (inherited rifle modifier) | 0.98 |
| MP7 | 0.85 |
| P90 | 0.86 |
| Kriss, Dual Kriss | 0.83 |
| MP5K Ext (inherits standard SMG modifier) | 0.85 |
| UMP45 Ext D (inherits standard SMG modifier) | 0.85 |
| Shotgun (each pellet) | 0.70 |
| Handgun | 0.91 |
| AWP, XM2010 | 0.99 |
| RPG, Knife, Grenade | N/A (no bullet falloff) |

## Tuning guide

- Make a **single weapon** stronger at distance: increase its `WEAPON_RANGE_MODIFIERS[id]` toward 1; decrease it toward 0 to weaken it.
- To change all engagement lengths, edit `DAMAGE_FALLOFF.referenceUnits` in `00-registry.js`. Larger values yield slower damage decay.
- To change primary base damage, movement or maximum projectile range, adjust the immutable weapon `WEAPON_PROFILES[id]` rating in its own source file. Do not change numeric IDs.
- Body armor and helmets are independently configured in `src/game/39-defense.js` (`bodyReduction`, `vestMax`, `headshotMultiplier`). They remain unchanged in this release.
- For local damage/TTK tables: `node tools/damage-sim.mjs`. It assumes every bullet/pellet lands, and excludes misses, reload and movement.
- After any edit run `node tools/build.mjs && node tools/build.mjs --check && node --check assets/game.js && node --test tests/*.test.mjs`, then commit updated `assets/game.js`. Never edit that generated bundle directly.

## MP5K Ext (weapon ID 13)

- Source: `src/game/weapon/14-mp5k-ext.js`. A low-poly model drawn from the supplied suppressed MP5K silhouette; no external texture or audio downloads.
- Stats: damage 22, RPM rating 92, control 46, speed 86, vertical recoil 49, horizontal recoil 60, magazine 30, reserve 210, range 45. The displayed RPM rating is transformed into in-game cyclic rate by existing SMG tuning.
- RMB: normal unscoped iron-sight aiming, no optic overlay. Audio: distinct soft, low-pass synthesized suppressed shot using the existing WebAudio engine.
- Existing IDs 0–12 remain unchanged. MP5K Ext appears in Shop, Inventory, loadout picker and HUD through the canonical profile/owned state. No automatic unlock, credits or economy changes.

## UMP45 Ext D (weapon ID 14)

- Source: `src/game/weapon/15-ump45-ext-d.js`. Dedicated black low-poly mesh based on the supplied UMP45 Ext D image, including skeletal folding stock, angled magazine, top rail, foregrip and open iron sights. No external images or third-party code.
- Ratings: damage 25, RPM 90, control 47, speed 87, vertical recoil 48, horizontal recoil 48, magazine 33, reserve 260 and range 50. The in-game fire interval uses existing SMG tuning; displayed RPM is a rating, not literal rounds per minute.
- ADS: right-click unscoped iron sights, no tactical overlay or optic model. Sound: **exact same existing preset index as AK-47** (preset 1), no new synthesized audio.
- Catalog, Shop ownership, Inventory, loadout selection and HUD derive from the shared weapon registry. Existing IDs 0–13 and saved ownership remain intact.

## HK417 (weapon ID 15)

- Source: `src/game/weapon/16-hk417.js`. Procedural black HK417-style assault rifle based on the supplied reference: long railed handguard, unsuppressed muzzle, vertical grip, adjustable stock, dark magazine, and box-shaped red-dot optic.
- User-specified ratings: Damage 33, RPM rating 92, Control 50, Speed 74, Vertical Recoil 64, Horizontal Recoil 60, Magazine 30, Reserve 150, Range 160. The rating is converted using the existing rifle RPM tuning, not interpreted as literal RPM.
- Right-click ADS: shared tactical optic renderer and boxed AK SOPMOD sight geometry, with an HK417-specific **red** dot. Sight housing pieces hide during ADS to prevent center obstruction.
- Shot SFX: precisely the existing AK-47 preset index 1. No audio changes to existing weapons. Ownership and Shop listings derive from the same weapon registry; unlock flow remains free until an economy is specified.
- Stable IDs 0–14 are not modified. Compile with `node tools/build.mjs` on the repository toolchain only; the tracked prebuilt `assets/game.js` is included for ordinary Windows pull-and-play.

## XM8 (weapon ID 16)

- Source: `src/game/weapon/17-xm8.js`, a dedicated grey XM8 low-poly mesh based on the supplied image: continuous polymer body, ventilated upper carry handle, round optic, vertical foregrip and integral stock.
- Exact profile ratings: Damage 25, RPM 92, Control 63, Speed 82, Vertical Recoil 49, Horizontal Recoil 28, Magazine 30, Reserve 150, Range 100. RPM is a rating interpreted by existing assault-rifle tuning; no separate ballistics logic.
- RMB: compact circular red-dot reflex ADS using the existing tactical optics framework. The physical optic mesh hides during ADS to prevent blocking the view.
- Fire audio: **same existing AK-47 preset** (`SFXI[16] === SFXI[1]`); no new SFX.
- Shop, Inventory, loadout picker and HUD use the canonical weapon registry/ownership. Previous weapon IDs 0–15 and their saved ownership remain unchanged.

## XM2010 (weapon ID 17)

- Source: `src/game/weapon/18-xm2010.js`. Dedicated low-poly tan chassis with long suppressor, black optic, bipod, magazine, adjustable stock and animated bolt, following the user-supplied image.
- Exact ratings: Damage 82, RPM rating **0**, Control 86, Speed 69, Vertical Recoil 64, Horizontal Recoil 60, Magazine 5, Reserve 30, Range 200. Existing sniper tuning maps rating 0 to its minimum cyclic rate, not to disabled shooting.
- Uses the same AWP sniper scope, ADS sensitivity, WebAudio firing preset, bolt cocking animation and shell ejection. Shared sniper behavior now checks `WP[id].snp` rather than relying only on the original AWP ID.
- A shot is blocked while the bolt cycles; automatic magazine reload remains deferred until after cocking is complete. The Shop, Inventory, loadout and saved-ownership rules are unchanged, preserving IDs 0–16.

## Saiga-12 (weapon ID 18) and standard Shotgun pump-action

- Added `src/game/weapon/19-saiga12.js` with a dedicated black low-poly receiver, polymer stock, magazine, vented foregrip, and nine physical red-dot optic pieces.
- Saiga-12 ratings: Damage 100, RPM 53, Control 0, Speed 78, V.Recoil 100, H.Recoil 58, magazine 6, reserve 30, Range 70. It uses the canonical shotgun pellets/falloff and the original shotgun sound (`SFXI[18] === SFXI[2]`).
- Saiga-12 is semi-auto and magazine-fed (reload MODE 0), without any between-shot pump. Box-shaped red-dot ADS uses the existing tactical optic overlay and clears the 3D viewmodel during aiming.
- The **original Shotgun (ID 2)** is the only `pump:true` profile. Its pump duration derives from the already-calculated cooldown. After a shot the wooden fore-end moves rearward and forward, the support hand follows, the ejected shell appears during the pull, and shooting is gated until the action completes. Automatic reload after empty magazine occurs after the pump.
- Existing shotgun statistics, ammo capacity and reload mode stay unchanged. All IDs 0–17 and saved ownership remain untouched; Shop, Inventory and category counts are registry-driven.


## Saiga-12 fire-freeze regression guard

- `src/game/50-items-and-drops.js`: weapon IDs differ from physical casing type IDs (0 pistol/SMG, 1 rifle/sniper, 2 shotgun). All shotguns—including Saiga-12 ID 18—use the existing shotgun shell mesh/port; shell ejection remains triggered by the established simulation logic. Invalid casing table indices must never stop the render loop.
- Dropped-gun scale/rest-height falls back to the first legacy weapon of the same class for newer IDs. Existing ID 0–12 sizes and positions remain unchanged.
