# Changelog

## 2026-10-29 — Standard Helmet and tactical equipment Inventory

### New gear
- Added a **HELM** tab and always-equipped **Standard Helmet** as protective gear, separate from weapon profiles. Helmet data lives in `INVENTORY_GEAR`, with automatic default selection and compatibility with existing saved loadouts.
- Helmet uses the actual in-game `mkHelm()` mesh for its 3D thumbnail. Selecting HELM zooms the existing soldier preview to the head, while hiding the weapon and relaxing both arms.
- **Standard Helmet** is default equipment for every soldier, with an explicit message that **custom helmets will arrive in future updates**, plus a separate non-interactive future helmet card.
- Helmet protection in matches remains governed by the existing `defenseSpawn()` / headshot rules; no combat stats or game rules have changed.

### Tactical UI
- Replaced the empty ITEM tab with a full-size tactical supplies card including a supply crate illustration, armory lighting, **COMING SOON**, **NO TACTICAL ITEM YET**, and helpful copy.
- The left character preview now shows an unarmed neutral pose for ITEM rather than a floating invisible rifle.
- Preserved desktop panel alignment and category scrolling, card artwork, existing equipped weapon choices, and match weapon selection.

### Files and language
- Updated modular Inventory JS, dedicated Inventory CSS, committed game bundle, new helmet regression tests, and changelog. All new player-facing text is English. Live browser visual QA remains pending.


## 2026-10-29 — Inventory layout stability and scalable weapon collection

### Fixed layout
- Corrected Inventory grid sizing: the lobby had been applying centered grid-item alignment and `35% + 65%` columns **plus a gap**, causing panels to change vertical position/overflow based on category item count.
- Inventory now has a single stable two-column, full-height shell on desktop. The soldier panel and collection panel remain aligned top-to-bottom in every category, including Secondary/MELE/Explosive with only one weapon.
- The collection panel is a consistent four-row grid (heading, tabs, short hint, scrollable items). The collection region alone scrolls vertically; cards use fixed-height top-aligned rows instead of `grid-auto-rows:minmax(...,1fr)` that stretched one-item categories.
- Kept responsive small-screen stacking; the collection list retains its own bounded scrollbar even on tablet/mobile. Desktop short-height adjustments use fixed-height smaller cards, not content-stretching.
- Inventory remembers scroll position independently per tab and preserves the viewed section when a weapon is selected/equipped. Tab-specific short hints avoid showing primary-weapon instructions under Secondary, MELE, Explosive or Item.

### Compatibility
- **No changes** to saved equipment, weapon profiles, third-person character animation, thumbnail generation, Damage/HP/Armor, Deathmatch, Bomb Mission or AI.
- All new hint strings remain player-facing English. CSS/source changes are mirrored into committed `assets/game.js` and covered by targeted layout regression tests.
- Manual browser visual verification of multiple screen sizes remains pending.


## 2026-10-29 — Bomb Mission uncontested defuse and enemy spectator

### Critical Bomb Mode fixes
- When all Terrorists are eliminated **after planting**, living Police immediately switch to a clear-site retake. The closest eligible officer is assigned to defuse; teammates converge near the actual device instead of continuing distant site-defense or unrelated sweeps.
- The assigned defuser gets a faster clear-site navigation pace, no crowd-avoidance shove from teammates, and can begin or continue a 7-second defuse even if a stale enemy target remains in bot memory. Defuse assignment transfers to an officer who can arrive significantly sooner, but never interrupts a defuse already in progress.
- Preserved earlier solo-officer threat-clearing behavior whenever any Terrorist is still alive. **Team Deathmatch** movement, combat and respawn are unchanged.

### Spectator
- After the player's Terrorist team is wiped while its bomb remains planted, third-person spectator follows the Police retake/defuser instead of staring at an empty location with **NO TEAMMATES ALIVE**.
- Living teammates always take priority over opponents. Left/right camera switching cycles the surviving Police when the friendly team is wiped.
- Spectator UI displays **SPECTATING POLICE**, **LEFT / RIGHT to switch player**, **NEXT POLICE**, and the observed officer's **DEFUSING BOMB** progress when appropriate.
- Updated the centralized Bomb Mode UI text, regression test and compiled `assets/game.js`. No new game assets or backend needed. Browser visual playtest remains unverified.


## 2026-10-29 — Tactical armory UI and player-facing weapon labels

### Visual design
- Reworked Inventory into a **BLOCK BUDDIES tactical armory** over the existing 3D arena backdrop with translucent layered panels, a cool-blue equipment scanner, orange team accents, hazard-strip trim and combat-inspired weapon cards.
- Enlarged colored 3D weapon thumbnails, moved names to a clean card footer, replaced the desktop nested page scrolling with a single controlled weapon-grid scrollbar; mobile layouts remain scrollable.
- Preserved the original draggable 3D soldier, animated two-hand weapon poses, all five Inventory tabs and one-equipped-per-slot rules.

### Player-facing copy
- Removed raw **DMG / SPD / RANGE** diagnostic-style text from weapon-list cards. Weapon ratings remain visible only when selecting a weapon in the left details panel.
- Replaced technical instruction copy with short player-friendly language: **YOUR SOLDIER**, **CHOOSE YOUR GEAR**, **Pick your favorite**, **YOUR BAG IS EMPTY**, **OWNED** and **USE THIS WEAPON**.
- Renamed the player-facing **Pistol** weapon to **Handgun** (same ID, damage 26, 13/52 ammo and all other existing stats). Secondary remains the loadout category; the in-match HUD label is also Handgun.
- Kept **Kriss** as a single inventory item with the existing V-key Dual Kriss gameplay mode, and kept pre-round weapon selection in Deathmatch and Bomb Mode.

### Scope
- Updated Inventory markup/style/module, Handgun name and slot HUD string, committed `assets/game.js`, targeted regression test, weapon-label test fixture and this changelog. No network dependency or new asset files.
- Combat damage, firing/reload behavior, armor, AI, movement, round rules and maps are unchanged. Visual browser playtesting has not been completed.


## 2026-10-29 — Inventory v2: animated grip and real 3D colored thumbnails

### Fixed
- Inventory avatar now uses the game's production two-bone IK (`aimA()`) to position both arms around the held weapon, with weapon-kind-specific ready poses, breathing, sway, and maintained drag-to-rotate preview.
- Gun models now occupy a chest-height combat-ready stance instead of relying on the static bot gun mount. Rifle, shotgun, sniper, RPG, pistol, knife and grenade have distinct handling configurations.
- Removed the redundant Dual Kriss ownership card. **Kriss** is the single inventory item and its **V = Dual Mode** gameplay interaction is preserved; preexisting localStorage equipment value `7` migrates to Kriss (`6`).
- Replaced monochrome white SVG icons in inventory weapon cards with one-time PNG thumbnails rendered from the same colored/material `mkGun()` models. Renderer resources are released after capture.
- If the browser cannot render a thumbnail, the card reports an unavailable preview instead of showing a misleading white silhouette.

### Compatibility and strings
- No change to actual weapon profiles, bot tactics, movement, damage, game rules, or round selection. The original primary selection before each Deathmatch/Bomb round is retained.
- UI copy update: Kriss description now mentions **Press V in a match to switch**. Thumbnail error fallback is **3D PREVIEW UNAVAILABLE**; all text remains English.
- Updated modular source, committed runtime bundle, CSS, and targeted regression tests. Browser visual inspection remains required for final animation polish.


## 2026-10-29 — Inventory lobby with real 3D loadout preview

### Added
- A new **INVENTORY** button on the main menu, opening a character preview (left) and owned weapon list (right).
- Five tabs: **MAIN WEAPON**, **SECONDARY**, **MELE**, **EXPLOSIVE**, **ITEM**. All existing defined weapons show as owned; ITEM is an empty state until items are added.
- Actual existing in-game 3D `terro()` player model and `mkGun()` weapon models in a drag-to-rotate preview; list icons use gameplay `SV` art, not mismatched external images.
- One saved **USE** choice per category in localStorage (`bbfps_inventory_v1`); equipped main weapon becomes the default when a new match starts. Existing 5-second primary selection in Deathmatch and Bomb Mode is unchanged.
- Secondary, melee and explosive HUD and slot switching read the saved loadout instead of hardcoded IDs.
- Inventory module (`src/game/89-inventory.js`), inventory stylesheet (`src/styles/09-inventory.css`), manifest entry and automated contract tests.

### Compatibility and UI copy
- No change to 100 HP, 50 vest, weapon damage, movement, ammo, bot tactics, map, bomb rules or scoring.
- All new user-visible strings are English, including INVENTORY, USE, IN USE, EMPTY and tab names.
- This version has client-side ownership only; shop/unlock/backend inventory is **not** implemented. Browser visual gameplay was not exercised in this session.


Every update must record its date, scope, affected modules, user-visible strings, compatibility, and validation. Keep the original fixture immutable.

## 2026-10-29 — Weapon-rated sprint movement (15% run bonus)

### Movement rules
- Weapon **Speed Rating** now directly defines maximum sprint as a percentage of baseline speed 6.5 world units/second; e.g. Knife 98 = 98%, AK-47 74 = 74% and AWP 69 = 69% when fully sprinting.
- Walking speed equals the weapon sprint speed divided by 1.15, so Shift sprint adds exactly **15%** relative to walking (instead of the old 62% sprint bonus).
- Removed the prior `.75 + .003 * speed` conversion and extra 12% heavy-weapon speed penalty; the `wtT` animation still drives weapon sway/bobbing only.
- Existing ADS slowdown (38%) and sprint restrictions (moving forward, not shooting or ADS) remain unchanged; mouse input, jump, damage, ammunition, bot AI navigation, Deathmatch and Bomb Mission rules are untouched.

### Configuration and validation
- `MOVEMENT_RULES` in new `src/game/43-movement.js` centralizes `baseSpeed`, `sprintBonus` and `adsSlowdown`; the preexisting source manifest loads it after weapon profiles.
- No user-visible UI strings added or changed. Tests include exact Knife/AK-47/AWP sprint ratios, full 9-weapon ratings, 15% sprint/walk consistency, ADS, interpolated input and avoidance of additional hidden heavy penalties.
- Automated tests, `node --check assets/game.js`, and `node tools/build.mjs --check` required before publish. Full browser playtest remains unverified.

## 2026-10-29 — Shared 100 HP + ballistic vest and weapon-profiled bots

### Combat / armor
- Player and every bot spawn with **100 HP**, **50 vest durability** and a helmet. Respawning in Deathmatch and spawning a new Bomb Mission round restores these values.
- The shared `DEFENSE_RULES` reduces bullet damage to the torso by **20%** while the vest has durability; the amount absorbed consumes equal vest durability. If a hit depletes the vest, any remaining damage is applied normally.
- Knife, grenade/RPG explosions and headshots bypass vest damage reduction. First helmet headshot pops the helmet and deals base bullet damage; later headshots use the same **3×** multiplier for player and bot.
- Player HUD now displays the new English string **`VEST 50`**, updated as durability decreases; the existing HP and helmet indicators remain.

### Bot loadouts and ballistics
- All 5v5 AI actors receive a weighted-random primary from the existing `WEAPON_PROFILES` table, a finite-ammo pistol, knife, and grenades. No backend database or third-party weapon source was added.
- Bot bullets now use the same profile damage, pellets, range, cadence and ammunition rules as player weapons; AI-only aim error and loadout selection remain separately configurable in `BOT_WEAPONS`.
- Bots use their real selected weapon model, magazine and reserve counts, profile reload duration, RPG distance safety, close-range knife and optionally throw grenades.
- Projectile impact uses shared helmet/headshot/vest resolution regardless of shooter team. Explosion damage bypasses vest, preserves team-friendly-fire protections, and attributes kills to the correct bot or player.

### Scope and files
- Added `src/game/39-defense.js`, `src/game/41-bot-weapons.js`, `src/game/42-projectile-defense.js`, `src/styles/08-defense.css`, and `tests/defense-bot-weapons.test.mjs`.
- Updated `index.html`, weapon/combat modules, bot AI, spawn/reset routines, game HUD, source manifest, generated `assets/game.js`, and this changelog.
- Original English interface, Deathmatch respawn timer, Bomb Mission plant/defuse timing and spectator behavior retained.

### Validation / limitations
- Local Node.js automated tests: **69/69 passed**, including new armor and bot-loadout tests.
- `node --check assets/game.js` and `node tools/build.mjs --check`: **passed**.
- Full interactive browser and FPS-performance smoke tests are not yet verified. Real-match lethality and tactical bot performance still require playtesting.

## 2026-10-29 — Weapon balance profiles (user-provided Point Blank-style ratings)

### Changed
- Renamed the playable Rifle to **AK-47** in all dynamic weapon labels; retained the weapon ID, model, slot and controls.
- Centralized pistol, AK-47, shotgun, RPG, knife, grenade, Kriss, Dual Kriss and AWP ratings in `WEAPON_PROFILES`, with runtime conversion settings in `WEAPON_TUNING` (`src/game/40-weapons-and-viewmodels.js`).
- Preserved supplied Damage/RPM/Control/Speed/V.Recoil/H.Recoil/Ammo/Range values exactly. The RPG profile (85 damage, 35 RPM rating, 1/6 ammo, 65 range) is an explicitly chosen Block Buddies setting.
- Fire interval derives from RPM *rating* via archetype-specific bounds; RPM ratings are not literal rounds per minute. Control derives spread, Speed derives player movement multiplier, and V/H recoil drive camera/viewmodel effects. These conversions are project-specific, not purported official Point Blank formulas.
- Range now corresponds to bullet velocity times lifetime, so shots cannot vanish before the configured range; no unspecified damage-falloff formula was invented.
- Shotgun damage 168 is the **sum of six pellets**, not 168 per pellet. AWP now deals 81 base body damage, so its select-card text no longer promises a one-shot kill.
- Pistol ammo is now finite (13/52). Grenade is 2/2, reloads its spare stock, and its explosion uses the configured 40 damage. Knife has 60 damage with 1-unit listed reach plus character-collision allowance. Exhausted pistol switches to knife safely.

### Scope and user-facing strings
- `Rifle` -> `AK-47` in generated weapon names in HUD and weapon selection.
- `1-shot sniper · RMB scope` -> `Bolt-action sniper · RMB scope` to avoid misleading damage claims.
- All other original English UI text, models, Bomb Mission rules and AI decisions unchanged. Existing bot-only bullet table `EW` is intentionally unchanged; this update is for playable weapons rather than an unrequested bot lethality redesign.

### Updated files
- `src/game/40-weapons-and-viewmodels.js`, `src/game/65-audio.js`, `src/game/70-kills-and-damage-hud.js`, `src/game/75-weapon-controls.js`, `src/game/95-simulation.js`, generated `assets/game.js`, `tests/weapon-balance.test.mjs`, `CHANGELOG.md`.

### Validation
- 58/58 automated tests passed locally (47 existing baseline regression tests and 11 dedicated weapon-balance tests).
- `node --check assets/game.js` passed.
- Source-manifest concatenation exactly matches the committed runtime bundle.
- Full visual/browser gameplay testing was not completed; values are locally code-tested and require playtesting for final feel.

## 2026-10-28 — Bomb Mission tactical clearing and structural wall clarity

### AI behavior (Bomb Mission only)
- Sole surviving Police bot clears a living Terrorist within the planted bomb's 18-unit danger zone before attempting defuse; resumes defuse only when the nearby threat has been eliminated or moved away.
- Sole surviving Terrorist actively hunts living Police after planting rather than choosing a passive hold role.
- Bomb-carrying bot prioritizes clearing enemies near itself or the bomb site, and will not begin/continue planting while a nearby threat is present.
- Taking actual HP damage while planting cancels progress immediately (human or bot) with a configurable 0.9-second retry delay. The existing 5-second plant and 7-second defuse durations remain unchanged.

### Indoor visual structure
- Map walls now have contrasting structural baseboards, reinforced full-height mullions, equipment rails and sector-colored horizontal bands.
- Selected connected passages now have **real collidable side piers**, overhead lintels with projectile blocking and high-contrast doorway accents, preserving open center navigation.
- Map remains 160x160 with the same bomb-site coordinates, old TDM map, spectator, minimap, weapons and gameplay unchanged.

### Files
- Updated: `src/game/11-bomb-map.js`, `src/game/86-bomb-mission.js`, `src/game/87-bomb-tactics.js`, `src/game/65-audio.js`, `src/game/70-kills-and-damage-hud.js`, `tests/bomb-mission.test.mjs`, `assets/game.js`, `CHANGELOG.md`.
- New: `tests/bomb-tactical-hardening.test.mjs`.

### Configuration and UI strings
- `BOMB_AI` contains solo-threat and plant-clear radii; `BOMB_RULES` includes `plantHitRecoverySeconds`. No new or changed player-facing English UI strings.

### Validation
- `node --check assets/game.js`, `node tools/build.mjs --check`, `node --test tests/*.test.mjs`: 51/51 local static and logic checks passed. Tests include actual hit handlers, 1v1 tactical states, wall physical anchors and full 160x160 room connectivity.
- No end-to-end interactive browser gameplay verification claimed; AI tuning and wall visibility still need user-side playtesting.

## 2026-10-28 — Planted bomb retake AI, spectator HUD and exact minimap beacon

### Fixed
- All surviving Police bots now actively retake the planted bomb site: the designated defuser heads for the device while other officers seek nearby Terrorists or sweep into the active site. The outdated distant-site guard behavior is no longer used after plant. Officers also close distance to visible enemies instead of standing idle at medium combat range.
- The Bomb Mission spectator label is smaller, has less padding and uses compact mobile sizing; its redundant giant center-screen `SPECTATING` overlay is hidden only while spectating. No existing English message was changed.
- The circular minimap now draws a pulsing red bomb beacon at `bombMatch.device.position`, not an approximate site marker. Radar range automatically expands when the planted device would otherwise be outside the minimap, so the beacon stays at its true world coordinates.

### Configuration, scope, validation
- New `BOMB_RADAR` options and `BOMB_AI` retake options keep timing, radii and colors configurable.
- Only `src/game/87-bomb-tactics.js`, `src/game/90-bot-ai.js`, `src/game/96-hud-and-radar.js`, `src/styles/07-bomb-mission.css`, tests, generated `assets/game.js`, and this changelog changed.
- Team Deathmatch, plants (5 s), defuses (7 s), weapon behavior, maps and spectator camera geometry are unchanged.
- Validation: automated Node tests, syntax, and committed-bundle parity; actual browser behavior still requires in-game verification.

## 2026-10-28 — Bomb Mission grounded props and physical collision fix

### Fixed
- Rebuilt hollow/floating Bomb Mission props into grounded, visually supported and physically solid furniture: power racks, lockers, generator cabinets with tanks, desk consoles, TDM-style cargo containers and striped cover barriers.
- Registered the actual furniture bodies in the existing collision volumes (`OB`) so movement, bot navigation, line-of-sight and projectile sweeps all agree.
- Fixed a penetration case in Bomb Mission collision resolution: when the character center lands inside a solid obstacle, it is pushed to the nearest outside face instead of further inside. The original Team Deathmatch branch is unchanged.
- Closed seams between ceiling and walls, mounted ceiling lights/ducts with brackets, added continuous roof backing, and registered a projectile-blocking overhead roof (`LT`).
- Reused Deathmatch's `cBox`, `cBar`, `dk` and `flushDeco` geometry methods for richer detail and fewer decoration draw calls.

### Config and UI strings
- `BOMB_PROPS` controls furniture footprints/clearance, while existing `BOMB_RULES` keeps map/ceiling dimensions. No English UI text or gameplay timer has changed.

### Changed files
- `src/game/11-bomb-map.js`, `src/game/20-sky-and-physics.js`, `tests/bomb-mission.test.mjs`, `assets/game.js`, `CHANGELOG.md`.

### Verification
- 33/33 automated regression tests pass (including A* routes, bomb sites, physics/solid furniture and production bullet/roof sweeps).
- The committed JS bundle is regenerated from its manifest; syntax and bundle-sync checks pass.
- Interactive Three.js browser screenshots could not be verified here because the existing CDN is unreachable in the test environment.
- The 160×160 Bomb Mission map, team AI, plant/defuse durations, spectator and Team Deathmatch gameplay remain unchanged.

## 2026-10-28 — Bomb Mission arena, tactical bots and third-person spectator

### Changed
- Expanded the Bomb Mission indoor arena from an 11×11 grid of 7-unit cells to a **16×16 grid of 10-unit cells (160×160 world units)**, while keeping Team Deathmatch's original ±60 boundary. Generated paths remain connected.
- Added four distinct industrial zones (security, warehouse, reactor, laboratory), sector floor and wall palettes, server racks, workstation monitors, storage shelves, electrical equipment, pipes, low cover, lighting and route markings. Site signs now respect world depth occlusion.
- Repositioned Bomb Site A to (-25, -5) and Site B to (25, 5), leaving over 50 world units of separation and spawn regions at opposite ends of the map.
- Changed spectator from first-person-on-teammate to a third-person chase view **behind the living teammate**, with wall collision checks, follow smoothing, and preserved teammate switching.
- Added bot tactical roles: independent Police site defense, patrol and retake covering, designated AI defuser, Terrorist bomb carrier/escort, flanking hunter, planted-bomb defense and enemy pursuit. Bots revise objectives as the bomb is dropped, planted or defused.
- Repaired bot navigation when A* cannot find a path: Bomb Mode bots no longer walk straight into a wall; repath on target changes, separate from teammates, and slide around narrow corners. Bomb Mode uses a 1.5-unit nav-cell resolution; TDM retains its original speed and 1-unit nav grid.
- The Bomb Mission circular radar now draws the **actual indoor wall plan and low cover**; while spectating, its origin follows the observed teammate.
- A passive Police player no longer monopolizes the defuser role, allowing surviving AI teammates to attempt defusal. Player-initiated defuse still takes priority.

### Configuration and user-visible strings
- Centralized adjustable tactics in `BOMB_AI` and chase-camera settings in `SPECTATOR_CAMERA`; arena dimensions and bomb site data remain in `BOMB_RULES` and `BOMB_SITES`.
- **No existing English UI strings were changed.** `BOMB_TEXT` remains the central source for Bomb Mission messages.
- Plant time remains 5 seconds, defuse time remains 7 seconds, teams remain 5v5, and Team Deathmatch rules remain unchanged.

### Files
- New: `src/game/87-bomb-tactics.js`, `src/game/88-spectator-camera.js`.
- Updated: `src/game/11-bomb-map.js`, `src/game/86-bomb-mission.js`, `src/game/90-bot-ai.js`, `src/game/96-hud-and-radar.js`, `src/game/99-render-loop.js`, `tools/source-manifest.json`, `assets/game.js`, `tests/bomb-mission.test.mjs`, `CHANGELOG.md`, and documentation.

### Verification
- 28/28 local Node automated tests pass, including site-to-site A* routes, 256-room maze connectivity, objective changes, bot defuser delegation, spectator camera geometry, HUD plan markers, mouse camera controls, original TDM weapons and bundle integrity.
- `node --check assets/game.js` and `node tools/build.mjs --check` pass.
- Interactive browser playtesting and balancing were **not confirmed**. Enemy strategy is deterministic, role-based AI—not trained machine-learning intelligence—and may require tuning after live playtesting.

## 2026-10-28 — Global camera reversal protection

### Fixed
- The shared desktop mouse-look path previously applied browser `movementX`/`movementY` unconditionally. A single anomalous pointer-lock movement event could turn the camera sharply, including an apparent 180-degree reversal.
- Mouse look now rejects non-finite or unusually large relative motion events and ignores the first movement after pointer-lock acquisition.
- Fallback mouse drag uses consecutive screen positions instead of untrusted relative movement, and drag state resets on mouse release, browser blur and pointer-lock transitions.
- Input is ignored in lobby, completed matches and while dead. This is a shared control fix for both Team Deathmatch and Bomb Mission.

### Configuration and strings
- `LOOK_CONFIG` in `src/game/79-camera-look.js` centralizes original sensitivity and ADS multipliers plus the anomalous-delta threshold.
- Existing English UI strings unchanged; no new user-visible strings.

### Changed files
- New: `src/game/79-camera-look.js`, `tests/camera-look.test.mjs`.
- Updated: `src/game/80-input.js`, `tools/source-manifest.json`, `assets/game.js`, `CHANGELOG.md`.

### Compatibility and validation
- Weapons, bots, game rules, UI strings, rendering and Bomb Mission logic were not modified.
- 9 targeted mouse-look tests and 13 existing tests passed (22/22 total).
- `node --check assets/game.js` and `node tools/build.mjs --check`: passed.
- No interactive browser end-to-end test was possible in this environment because the original Three.js CDN cannot be reached. The unbounded-delta vulnerability was confirmed by source inspection and regression tests, not by observing the user's exact browser event.


## 2026-10-28 — Bomb Mission 5v5 (local AI)

### Added
- Unlocked Bomb Mode while keeping Team Deathmatch and Battleground status unchanged.
- Created an indoor industrial maze battlefield with deterministic spanning-tree connectivity, extra corridors, crates, 2 labeled bomb sites, and separate collision/pathfinding from TDM.
- Random bomb carrier among the 5 Terrorists; drop and automatic pickup by a living Terrorist when carrier is eliminated.
- Hold `E` for 5 seconds to plant, hold `E` for 7 seconds to defuse. Interrupt on input release, position exit, or death; damage can still be received while acting.
- First-person device keypad animation for planting, wire-cutting tool animation for defusing, crouch pose for interacting AI, progress bar and context prompts.
- Bomber and defender AI objective seeking, AI plant/defuse, round outcome, fuse timer, scoreboard, 12-round/7-win match cap.
- No respawn during Bomb Mission rounds. Dead player observes surviving teammates and can switch views with left/right arrows or the touch button.
- Touch-device plant/defuse button and Bomb Mission-specific HUD.

### UI strings
- Centralized in `BOMB_TEXT` inside `src/game/11-bomb-map.js`. New messages include: `Plant bomb here`, `Defuse the bomb`, `PLANTING BOMB`, `DEFUSING BOMB`, `BOMB PLANTED`, `BOMB DROPPED`, `BOMB DEFUSED`, `SPECTATING`, `POLICE WIN THE ROUND`, `TERRORISTS WIN THE ROUND`.
- All existing Team Deathmatch strings remain in English and unchanged.

### Configuration
- `BOMB_RULES` centralizes team size, 5-second plant, 7-second defuse, 40-second fuse, 2-minute round timer, 5-second prematch freeze, radius limits, indoor maze seed, first to 7 wins and 12 total rounds.

### Files
- New: `src/game/11-bomb-map.js`, `src/game/86-bomb-mission.js`, `src/styles/07-bomb-mission.css`, `tests/bomb-mission.test.mjs`.
- Updated: `index.html`, `src/game/65-audio.js`, `70-kills-and-damage-hud.js`, `80-input.js`, `85-lobby-and-match.js`, `90-bot-ai.js`, `95-simulation.js`, `96-hud-and-radar.js`, `99-render-loop.js`, `tools/source-manifest.json`, `assets/game.js`, `tests/parity.test.mjs`, documentation.

### Compatibility and testing
- No extra runtime dependencies; the ready-to-play `assets/game.js` is committed for git-pull-only users.
- Node syntax checks and build-sync test pass locally.
- Six isolated Bomb Mission logic tests plus four source/regression checks pass locally.
- The automated browser smoke test was blocked by the test environment; actual interactive gameplay has **not** yet been verified end-to-end.
- Still offline, with bots; not real online multiplayer or a server-authoritative engine.

## 2026-10-28 — Initial modular migration

- Extracted the original HTML into `index.html`, 6 CSS files, 17 feature-oriented JavaScript fragments, and committed browser bundle.
- Archived the original game as a test fixture. Added deterministic build tooling and architecture documentation.
- Preserved original Team Deathmatch behavior and user-facing English copy. No network gameplay added.
