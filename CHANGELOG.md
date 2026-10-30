# Changelog

## 2026-10-30 — BOT intelligence M0 foundation: deterministic baseline and Windows CI

- Added development-only `tools/bot-ai-m0-baseline.mjs`, which evaluates existing production BOT movement, A*, weapon dispatch and Bomb tactical goals in a fixed-seed 10-BOT synthetic arena. It changes **no gameplay runtime** and is not included in the browser source manifest.
- Added `tests/bot-ai-m0-baseline.test.mjs` with six targeted regressions: seeded reproducibility, both factions, blocked-LOS no-shot checks, critical-HP retreat, Bomb tactical execution, input bounds and explicit unavailable real-world KPI fields.
- Recorded seed-42 scenario traces and limitations in `docs/BOT_AI_M0_BASELINE.md`. Open TDM dispatched 75 Police and 75 Terrorist fire calls; completely blocked LOS dispatched zero; no real hit-rate, browser FPS or Bomb round success was measured.
- Added `.github/workflows/bot-ai-m0.yml` for Windows GitHub Actions with Node 22, standalone bundle consistency, JavaScript syntax, complete Node test suite and M0 JSON trace. The workflow has **not yet been verified green** from GitHub Actions.
- Synchronized `docs/BOT_AI_IMPLEMENTATION_LOG.md` and `docs/BOT_AI_MASTER_PLAN.md`. **M0 = IN PROGRESS**: isolated V8 source replay checks succeeded, but actual full Node CI results, real-game/browser performance and objective benchmarks are still required. M1–M7 remain NOT STARTED.
- **Zero production JS, AI logic, gameplay rules, weapons, assets, map, HTML, manifests, bundle or UI modifications.** No backend, runtime dependency, Docker, WSL or user-side build introduced.

## 2026-10-30 — Fix BOT AI regression test after footstep integration

- Repaired the isolated active-BOT test fixture in `tests/bot-five-star.test.mjs` by providing the missing `footstepAdvance` dependency and asserting it runs once per frame.
- Reproduced `ReferenceError: footstepAdvance is not defined` in the old test harness and confirmed the production `botsUpd(.016)` frame executes with the corrected mock.
- **Regression-test and changelog maintenance only.** Gameplay, AI behavior, audio, HTML, assets, and the direct-open browser bundle are unchanged. The BOT intelligence roadmap remains a plan, not an implementation.


## 2026-10-30 — BOT intelligence modernization roadmap and implementation tracker (documentation only)

- Published `docs/BOT_AI_MASTER_PLAN.md`: source-verified baseline, both-faction TDM/Bomb scope, aggressive/natural combat goals, fair 3D aim and perception design, locomotion/cover, team strategy, anti-omniscience rules, milestones M0–M7, performance targets, full regression/acceptance gates and next-maintainer instructions.
- Published `docs/BOT_AI_IMPLEMENTATION_LOG.md`: workstream status, audit notes, required measurements, change-journal template and explicit next action. **All M0–M7 milestones remain NOT STARTED.**
- Linked both documents from `README.md` and `src/game/BOT_AI.md` for discoverability.
- **No gameplay, BOT behavior, source JS, assets, configuration, rules, difficulty labels, manifest or browser bundle changes.** AI implementation requires a separate approved update.


## 2026-10-30 — Surface-aware 3D positional footsteps for player and BOTs

- Added `src/game/66-footsteps.js` for live distance-driven footstep timing on actual player/BOT movement (collision-adjusted, grounded, no idle/airborne/wall-push steps); all teams use identical footstep hearing rules.
- Synthesizes cached short textured samples per five grounded surface categories: asphalt road, outdoor concrete, building interior, elevated metal, and indoor tile. Indoor Bomb Mode sectors use the existing map's four location zones.
- Enemy and teammate footsteps are emitted in world coordinates via Web Audio HRTF PannerNode with 24-unit hearing cutoff, camera/listener orientation, distance falloff, optional line-of-sight muffling, and 16-voice concurrency cap.
- Audio is initialized on real user input to respect browser autoplay rules and honors the existing SND toggle. No external sound assets, remote URLs, network code, new game mechanics, or third-party dependencies.
- Updated the source manifest/direct-browser bundle, added 3D spatial-footstep regression coverage and implementation documentation.


## 2026-10-30 — Remove persistent player weapon drops on death

- Fixed player-death gun models staying on the map indefinitely because `dropPlayerGun()` passed `keep=true` to the existing physics drop system.
- Player weapons now use the same `keep=false`, seven-second lifetime and subsequent .6-second disappearance phase as BOT weapon drops, without changing their visuals, trajectory or respawn behavior.
- Grenade stock, shell-casing expiry, BOT drop cleanup and gameplay weapon ownership remain unchanged. Added regression coverage and rebuilt the standalone direct-browser bundle.


## 2026-10-30 — Temporary flowing blood pools on character death

- Added a standalone 3D blood pool module (`46-blood-pools.js`) with an irregular procedural floor shape and three gradually extending runnels. Shared geometry and capped, reusable mesh groups (maximum 24).
- BOT deaths display blood only after the body reaches the ground; it flows, follows corpse position, fades with the existing corpse blink and is removed exactly when the body is cleaned up.
- Player deaths use the same pool effect, which fades before the existing respawn; reset and respawn remove any remaining effects. No blood permanently marks the floor.
- Ground height, animation timing and existing gameplay state are respected; damage, AI, armor, inventory, scoring and weapon mechanics are unchanged. Added lifecycle tests and synchronized the direct-launch bundle.


## 2026-10-30 — 3D character-hit blood, no BOT RPG, fixed grenade stock

- Added short-lived red non-additive 3D blood droplets when Police/Terrorist characters take real damage, including headshot variants. Effects use the existing particle lifecycle, are capped at 96 live droplets, and are cleared on match reset. Damage, protection, armor and headshot calculations are unchanged.
- Removed RPG weapon ID 3 from the actual BOT random-primary selection pool; player RPG, its weapon profile and projectile/explosion system are untouched.
- Removed the every-four-player-kills grenade refill and its unused addGren helper. Grenades now only decrement when used and reset according to existing match/respawn/round equipment rules; weapon crates and dropped gun visuals remain unaffected.
- Preserved existing HUD, team scoring, AI difficulty, 5v5 spawn and gameplay modes. Added regression tests and synchronized standalone assets/game.js.


## 2026-10-30 — Simplify Room Settings popup chrome

- Removed the corner X button and its JavaScript listener; Cancel, Escape and backdrop remain valid dismiss actions.
- Removed the redundant "Only existing playable maps are available for each mode." helper line.
- Shifted the modal's 3D map preview down by 10px to improve spacing below the MAP label and aligned the header without the X.
- Preserved the existing dropdown controls, room state, BOT slots, gameplay, and launch sequence. Updated tests, documentation and standalone bundle.


## 2026-10-30 — Simplify Room Settings modal to per-mode dropdowns

- Removed the +/- steppers and simultaneous two-mode settings layout. ROOM SETTINGS now shows only the two fields relevant to the currently selected mode: TDM Kill Limit + Match Time, or Bomb Max Rounds + Round Time.
- Replaced numeric steppers with native dropdowns matching Create Room. Dropdown options are generated from the existing ROOM_LIMITS whitelist rather than duplicated or invented.
- Reduced popup padding, height and control density, improved responsive spacing, retained the existing WebGL map preview, and explicitly hide the inactive group with [hidden] CSS.
- Retained current-room draft isolation, Save/Cancel semantics, Room Master ownership, BOT team slots, 3–2–1/loading and Inventory preview. Updated regression coverage and standalone bundle.


## 2026-10-30 — Room Master settings popup without leaving Room Lobby

- ROOM SETTINGS in an active local room now opens a responsive, accessible overlay dialog on top of the same Room Lobby instead of routing back to the room browser.
- The popup offers room name, actual playable 3D map preview, TDM/Bomb Mode switch, and bounded +/- controls for kill limit, match duration, max rounds, and round duration; options derive from the existing ROOM_LIMITS and MODE_MAP_PREVIEWS.
- Editing uses an isolated draft. Cancel, X, Escape, and backdrop dismiss unsaved changes and restore the original preview; Save Changes reuses canonical validation/persistence and refreshes Room Information without leaving the room or changing the selected team/equipped weapon.
- Room closure cleans up open dialogs and prevents match launch while editing. Existing Create Room workflow, 3–2–1 countdown, loading fade, BOT spawning and gameplay remain intact.
- Added modal-specific regression coverage and synced standalone assets/game.js for direct Windows browser launch.


## 2026-10-30 — Fix loading handoff, mouse-look and live in-match loadout

- Fixed Room Start clearing the same timer that controlled in-game weapon selection. Record the canonical per-mode pick duration before suppressing the duplicate initial freeze, and reopen selection only **after** the loading overlay has faded.
- During timed in-match selection, gameplay is active: WASD, camera hover-aim, combat and match clock are not frozen. Mouse clicks on weapon cards remain interactive; confirmation requests pointer lock only in the user gesture.
- Selection automatically closes when its normal time expires, preserves owned-weapon validation and numeric 1–5 selection; subsequent Bomb Mode round freezes retain their original behavior.
- Retained the latest verified 3D map-loading capture improvements, added focused regression tests and synchronized browser-ready bundle.


## 2026-10-30 — Reliable 3D loading frame and visible 100%

- Capture real map pixels synchronously from the existing post-WebGL-render preview callback; avoid a blank capture caused by reading the discarded buffer in a separate rAF.
- Wait for a valid rendered map and abort safely when WebGL is not ready.
- Keep 100% visibly complete before fading into gameplay; match simulation and timer remain paused until fade completes.
- Regression tests and direct-open browser bundle updated.


## 2026-10-30 — Team-aware Room Preview and room-first pre-match loading

- Police/Terrorists room slot clicks now change the actual 3D character skin while keeping the equipped Inventory primary; cache both existing team actors and reuse the same renderer and gun meshes.
- START MATCH uses a guarded 3–2–1 countdown in Room Lobby, then a fullscreen captured 3D map transition tracking real setup milestones until 100%, fading out before match simulation begins.
- Suppress the old first-round countdown only for Room Start; later Bomb Mode freezes remain unchanged.
- Fix the TDM GO banner stuck for extended match timers by removing its incorrect time-left condition.
- Clean up pending launch callbacks on room close/pagehide. Added preview, countdown, loading, double-start and cancel regression tests; synchronized browser bundle.


## 2026-10-30 — Room Lobby preview shares real Inventory soldier + IN USE weapon

- Removed the static fake operator SVG from the active Room Lobby, replacing it with the genuine animated, drag-to-turn Three.js Inventory soldier preview.
- Shares one existing renderer, Three.js actor and weapon mesh set across Inventory and Room Lobby; switches the canvas host instead of creating extra WebGL contexts/models.
- Each Room Lobby entry reads the current owned/equipped primary via `inventoryEquipped("main")` and shows the actual `WP[id]` weapon model, name and type, independent of Inventory's temporary catalog selection.
- Retained original gameplay, teams, room ownership and weapon settings. Added scoped responsive preview layout and regression checks for canvas sharing and equipped-weapon sourcing.
- Rebuilt committed standalone `assets/game.js` for Windows direct-open usage.


## 2026-10-30 — Direct Room Master lobby, click-to-switch teams, 3–2–1

- CREATE ROOM and OPEN now enter an active room lobby with live map preview, settings, original tactical art, Police/Terrorist slot columns and a local-only room log.
- Clicking any slot selects the player's side. Preview BOT names/capacity derive from the canonical BN and BOMB_RULES tables; the existing startMatch creates the remaining nine AI players at launch.
- START MATCH bypasses the redundant CHOOSE YOUR TEAM screen; the existing loadout/HUD countdown is 3–2–1 for the first match only. Later Bomb Mode rounds keep their original freeze time.
- LEAVE ROOM removes the Room Master room from browser storage. Returning to main menu and browser pagehide also clean up an owned room.
- Added responsive scoped CSS and regression scenarios; synchronized standalone assets/game.js.


## 2026-10-30 — Room Lobby verification & layout regression

- Added `tests/room-lobby.test.mjs` with 8 unit/integration scenarios for local room creation, master controls, mode-specific match conditions, strict option bounds, safe room-name rendering and startup ordering.
- Fixed the empty-room placeholder remaining displayed after the first room was created; the `hidden` state now wins over flex layout styles.
- Added `src/game/ROOM_LOBBY.md` to document the existing offline/AI-only room implementation and its clean future network-server boundary.

## 2026-10-30 — Start opens local Room Lobby / Room Master

- Replaced the Start button's direct SELECT MODE route with a cinematic two-column **Room Lobby**, following the approved visual: saved room list on the left and Create Room controls on the right. The old mode DOM remains available internally for compatibility but is no longer the normal Start destination.
- Browser-local room creation, opening, editing, saving, and closing are implemented with defensive localStorage access and safe DOM text rendering. The creator becomes **Room Master** and may launch the normal Police/Terrorist team selection. There are **no fake public rooms, pings, joinable online players, or remote network service claims**.
- Only the currently playable maps are listed: Block District for Team Death Match and Lockdown for Bomb Mode; a live 3D map preview reuses the existing renderer. Match teams remain the actual 5v5 composition (1 player + 9 existing AI).
- Room Master sets **TDM team kill goal and match duration**, or **Bomb Mode max rounds and minutes per round**. Rules are validated against centralized `ROOM_LIMITS` and feed the original timers, score termination, bomb round state and HUD. Bomb rounds-to-win derives from the selected round limit. No changes to weapon stats, damage, bot AI or bomb interaction timing.
- Added `src/game/83-room-lobby.js` and scoped Room Lobby styles; bundled `assets/game.js` remains directly runnable from the local Windows `index.html`. No server or build command required to play.

## 2026-10-30 — Shotgun pellet impacts now spread in 2D (CS:GO-inspired)

- Fixed the previous regression where deterministic shotgun impacts formed one horizontal line. Both standard Shotgun and Saiga-12 retain **six pellets**, but they now use fixed two-dimensional radial pellet directions with distinct yaw and elevation.
- The generic golden-angle distribution uses pellet count from the canonical weapon profile without per-weapon ID checks, copied CS:GO coordinates or a new projectile system. Consecutive shots repeat the same learnable grouping around the crosshair.
- Original `w.spr` and ADS tightening still govern both axes. Existing aim pitch and separate bot/player muzzle correction are preserved, as are original damage, range, hit collision, recoil, pump/semi-auto mechanics, ammo and all non-shotgun weapons.
- Rewrote the original shotgun regression tests to verify real projectile velocities and no more flat-line impacts, plus non-shotgun compatibility. Synchronized `assets/game.js` for local `index.html` launch.

## 2026-10-30 — Learnable CS:GO-style horizontal shotgun pattern

- Converted six-pellet shotgun volleys from independent random horizontal spread to a **fixed, symmetric, learnable** set of six horizontal offsets, for both standard Shotgun (ID 2) and Saiga-12 (ID 18).
- Preserved user-specified **horizontal-only** scatter (no vertical randomization). The original `w.spr` spread width still comes from each shotgun's Control rating; ADS retains its existing spread reduction.
- Retained all six pellets, total damage, ammunition, range, pellet ballistics, recoil, firing interval, original Shotgun pump, Saiga-12 semi-auto operation, AI and other weapon classes. All pellet traces still begin at the existing muzzle per volley.
- Added reusable weapon-class-based helper `src/game/weapon/21-shotgun-spread-pattern.js`, regression tests for deterministic groupings and player/bot ADS behavior, and rebuilt `assets/game.js` for direct Windows launch.
- Inspired by Valve's official 2018 shotgun spread-pattern change, adapted to Block Buddies' horizontal-only rule; not an exact Valve 2D pattern.

## 2026-10-30 — HOTFIX: restore lobby after five-star BOT update

- Fixed the startup `TypeError` caused by `src/game/85-lobby-and-match.js` reading `BOT_TACTICS.difficulty` before `src/game/89-bot-tactical-intelligence.js` initialized that config. This previously halted menu script execution and left the introductory overlay visible with unusable menu buttons/background.
- Moved the existing BOT tactical module in `tools/source-manifest.json` to execute **immediately before the lobby module**, preserving its contents and all upgraded AI behavior.
- Regenerated `assets/game.js` in the corrected order for direct local `index.html` launch. Added regression test for initialization, menu ordering, and exact bundle/source consistency.
- No rollback of the earlier stable Saiga-12, XM2010, HK417, XM8, Shop, Inventory, or older gameplay fixes. No damage or weapon stats changed.

## 2026-10-30 — 5-star tactical BOT intelligence: Deathmatch & Bomb Mission

- Both playable modes now display five-star BOT difficulty. Kept match rules, score, player damage, weapon profiles, bomb timers, teams and respawn rules unchanged.
- Introduced `89-bot-tactical-intelligence.js` as a separate tactical layer: reachable LOS-breaking cover, evasive movement at critical HP, short-lived last-seen-target memory, differentiated pursuit, and caching of failed cover searches to protect frame rate.
- Improved ammo use: proactive reload when safe, real reserve consumption and reload timers, sidearm use during primary reload, plus grenade safety around teammates. All gunshots still use the canonical `fire()` system.
- Bomb Mission: an elected dropped-bomb recoverer and separate escorts, planting prioritized except against an immediately visible threat, post-plant guards/interceptors, and the original Police A/B site defense and retake/defuser logic.
- Added dedicated regression tests and `src/game/BOT_AI.md`. Updated `assets/game.js` remains directly playable from local `index.html`.

## 2026-10-30 — Fix Saiga-12 shot freeze and new-weapon death drops

- Fixed a runtime exception on Saiga-12's first shot (including ADS fire). `ejectShell()` had incorrectly used the weapon's ID 18 to index `CSP[18]`, although `CSP` only has three **casing types**. The resulting undefined access stopped the requestAnimationFrame game loop.
- Introduced `weaponCasingType(w)`, derived from the existing `WP[w].stats.kind`, to map all current and future shotguns to casing type 2, rifles/snipers to type 1, and pistols/SMGs to type 0. Preserved AWP bolt timing and the dual-SMG ejection side.
- Fixed `dropPlayerGun()` for weapon IDs not covered by the legacy `GSC` and `GH` arrays: use the earliest existing visual size/rest-height for the same weapon class instead of passing `undefined` into Three.js.
- No changes to Saiga-12 stats, ammo, damage, ADS, pump classification, recoil, sound or ownership. Added runtime regression tests and synchronized `assets/game.js`.

## 2026-10-30 — Saiga-12 and pump-action shotgun animation

- Added Saiga-12, stable weapon ID 18, in `src/game/weapon/19-saiga12.js`, using user-specified ratings (Damage 100, RPM 53, Control 0, Speed 78, V.Recoil 100, H.Recoil 58, ammunition 6 / 30, Range 70).
- The magazine-fed Saiga-12 reuses the original shotgun damage falloff, pellet mechanics and shot SFX, and adds a box-shaped red-dot tactical ADS with an unobstructed center.
- Saiga-12 has **no** manual pump; existing Shotgun (ID 2) gets profile-specific `pump:true`, a fore-end/hand pump stroke, casing ejection during pumping, firing lock during cycling and post-pump automatic empty-magazine reload.
- Preserved all older IDs, gameplay mechanics for unrelated weapons, Shop, Inventory, save format and unlock rules. Synchronized `assets/game.js` and source manifest; expanded legacy table-length tests and added Saiga/pump regression coverage.

## 2026-10-30 — XM8 red-dot ADS view obstruction fix

- Fixed XM8's circular red-dot scope being blocked by the 3D rifle receiver and tall carry handle after aiming.
- Tactical optic configuration now explicitly opts XM8 into hiding its first-person weapon model **only while its existing 2D optic overlay is active**; the model, hands and normal animation reappear immediately on exit, reload, switching weapons or cancellation.
- Preserved the existing physical XM8 low-poly model and its original visible hip-fire appearance. No changes to any other weapon's ADS, aiming direction, recoil, audio, damage or ownership.
- Added regression checks for active/inactive ADS and other tactical weapons. Synchronized `assets/game.js` for direct `index.html` use.

## 2026-10-30 — XM2010 bolt-action sniper (weapon ID 17)

- Added XM2010 tan low-poly model (`src/game/weapon/18-xm2010.js`) with suppressor, scope, bipod, stock, magazine and moving bolt.
- Applied requested ratings: Damage 82, RPM 0, Control 86, Speed 69, V.Recoil 64, H.Recoil 60, magazine 5 / reserve 30 and range 200. Sniper RPM 0 is interpreted through existing tuning as minimum cyclic rate.
- Reused AWP scope, sound, recoil and bolt cycle. Converted sniper-only scope/ADS, input and hand animation from AWP-only ID checks to the canonical `WP[id].snp` state, including a bolt-firing gate.
- Added loadout/HUD entry, synced precompiled browser bundle and source manifest. Existing IDs and ownership logic remain unchanged.

## 2026-10-30 — XM8 Assault Rifle (weapon ID 16)

- Added **XM8** in dedicated `src/game/weapon/17-xm8.js` without renumbering existing weapons or changing saved inventory ownership.
- Exact weapon ratings: Damage 25, RPM 92, Control 63, Speed 82, V.Recoil 49, H.Recoil 28, Magazine 30 / Reserve 150, Range 100. Existing rifle damage falloff and firing rules remain authoritative.
- Created low-poly grey XM8 receiver and modular polymer stock, vented carry handle, barrel, foregrip, magazine and cylindrical red-dot scope from the supplied image.
- Added circular **red** reflex ADS using existing tactical optics; the 3D optic is hidden while aiming to maintain an unobstructed sightline.
- Uses the **existing AK-47 shot preset** without touching other weapon sounds. Added HUD SVG, reload/hand/ADS poses, muzzle position, and loadout picker entry.
- Shop/Inventory category counts and unlock remain derived from canonical weapon registry. Updated source manifest, generated browser bundle, regression tests and weapon docs.

## 2026-10-30 — HK417 Assault Rifle (weapon ID 15)

- Added **HK417** to the shared weapon registry in dedicated `src/game/weapon/16-hk417.js`, preserving all prior weapon IDs and saved ownership.
- Exact ratings: Damage 33, RPM rating 92, Control 50, Speed 74, Vertical Recoil 64, Horizontal Recoil 60, Magazine 30 / Reserve 150, Range 160. Existing rifle ballistics and damage falloff apply.
- Added black low-poly HK417 silhouette with full-length railed handguard, barrel/muzzle brake, front grip, tactical stock, magazine, and physical rectangular red-dot sight based on the reference image.
- Added ADS position, first-person hand/reload anchors, muzzle offset and HUD weapon icon. HK417 uses existing SOPMOD-style squared optic with red-dot color on right-click; optic frame pieces hide during ADS to avoid sight obstruction.
- HK417 uses the **same existing AK-47 fire-sound preset**. Existing Shop, Inventory, loadout, gameplay and unlock rules are preserved; category counts derive from weapon profiles.
- Expanded the existing MP5K/UMP45 tests for 16 weapon IDs; added HK417 regression tests. Updated compiled browser bundle, source manifest and weapon documentation.

## 2026-10-30 — UMP45 Ext D added (SMG)

- Added **UMP45 Ext D** as weapon ID 14 in dedicated `src/game/weapon/15-ump45-ext-d.js`; all existing weapon IDs 0–13 and local inventory ownership remain unchanged.
- Implemented black low-poly UMP silhouette with folded skeleton stock, rail, foregrip, long angled magazine and iron sights from the user reference.
- Registered the requested ratings unchanged: damage 25, RPM rating 90, control 47, speed 87, V.Recoil 48, H.Recoil 48, magazine 33, reserve ammo 260 and range 50; inherits the existing SMG range-falloff behavior.
- Added unscoped right-click ADS, proper first-person hand poses, muzzle placement and HUD icon; uses the **same weapon sound preset as AK-47** (no new SFX).
- Shop/Inventory pick up the new catalog item automatically; loadout picker includes it explicitly after other compact SMGs. No economy, ownership, gameplay or pricing rule changes.
- Synchronized the generated `assets/game.js`, expanded existing MP5K regression coverage for the 15-weapon tables and added UMP45 integration tests.

## 2026-10-30 — MP5K Ext suppressed SMG

- Added **MP5K Ext** as new weapon ID 13 in a dedicated `src/game/weapon/14-mp5k-ext.js` module. Existing weapon IDs and save data remain intact.
- Added its low-poly black receiver, integral suppressor, vertical foregrip, removable magazine and open iron sights based on the supplied image; no external asset needed.
- Applied exactly the requested ratings: Damage 22, RPM 92, Control 46, Speed 86, V.Recoil 49, H.Recoil 60, magazine 30, reserve 210, Range 45. Uses the existing SMG range modifier and ballistics tuning.
- Enabled no-scope right-mouse ADS with dedicated aim alignment and muzzle geometry; added first-person hand positions, HUD silhouette and loadout picker support.
- Added a quieter short low-pass WebAudio suppressed-shot preset for player and bot weapons without changing other guns' presets. Muzzle flash is also visually reduced for suppressed presets, with no ballistic changes.
- Shop, Inventory, unlock and category counts remain driven from canonical weapon data and saved ownership. Removed incorrect Dual Kriss instructions from unrelated SMG descriptions.
- Updated source manifest and compiled `assets/game.js`. Added isolated regression coverage for profile, model, ADS, audio and compiled bundle.

## 2026-10-30 — Shop category toolbar cleanup

- Removed the redundant OWNED X / Y summary from the Shop filter bar, including its DOM generation and obsolete CSS.
- Set ALL to a legible, consistent button width and aligned category filter dimensions; narrower widths wrap whole buttons instead of crushing their labels.
- Kept dynamic per-category weapon counts, existing ownership checks, weapon selection, unlock flow, and gameplay unchanged.
- Updated generated assets/game.js for direct local index.html launch without a build.

## 2026-10-30 — Shop preview arrows removed and selection layout corrected

- Removed previous/next arrows from left-side weapon preview; weapon selection remains on clickable catalog cards.
- Fixed CSS class collision: selected catalog cards now use `shop-weapon-active`, distinct from left detail panel `shop-selected`.
- Rebalanced header, stat panel, filter bar, card dimensions and responsive layouts to better fit the approved two-column Shop reference.
- Preserve catalog scrolling when selecting a weapon and reset it on category changes/open; weapon profiles, ownership and free-unlock behavior unchanged.
- Rebuilt tracked browser bundle to match source changes.

## 2026-10-30 — Interactive weapon Shop selection and detailed stats

- Replaced featured starter banner with a clickable catalog and dynamic selected-weapon preview on the left.
- Preview, category, ownership, ammo and all displayed weapon statistics come from canonical weapon profiles; no price or currency system was invented.
- Added keyboard selection, previous/next preview navigation and responsive two-panel layout, preserving existing free unlock flow and equipment ownership.
- Synced assets/game.js for direct index.html play without local builds.

## 2026-10-30 — Cinematic Shop visual refresh

- Restyled Shop to match approved tactical armory visual: clean cinematic header, large featured standard-issue panel, colorful category filters, four-column desktop weapon cards, and responsive layouts.
- Featured weapon name, ammo, readiness and preview are derived from `WEAPON_STARTER_ID`, `WP`, existing inventory ownership and thumbnails; no duplicate weapon catalog or economy logic was introduced.
- Preserved existing category filter, free-unlock flow, saved ownership, weapon stats, gameplay and navigation; synchronized generated browser bundle.

## 2026-10-30 — Remove Inventory sort and Grid/List controls

- Removed DEFAULT sorting dropdown, SORT BY label, and Grid/List toggle entirely from Inventory at user request.
- Deleted their DOM, CSS, runtime event handlers, sort and list-view state. Weapon cards remain in the existing three-column grid with natural catalog order.
- The six class filters (ALL, ASSAULT, SMG, SNIPER, SHOTGUN, LAUNCHER) remain functional in a single clean filter band.
- Kept the three-column armory, 3D previews, equipment ownership, Shop unlock, and all gameplay intact; updated regression tests and regenerated the game bundle.

## 2026-10-30 — Separate inventory sort and view controls from category filters

- Fixed the cramped Inventory toolbar: category filters are now a dedicated top row and SORT BY / DEFAULT / LIST–GRID controls form a separate, right-aligned bottom row at all screen widths.
- Replaced ambiguous pixel-font glyphs with clear SVG list/grid icons and labels, with accessible state-specific button text.
- Standardized select and toggle dimensions, added a subtle separator, and preserved the filter/button layout on mobile.
- Kept all weapon catalog, Shop ownership, Equip, filters, sort behavior, 3D previews and gameplay unchanged. Updated toolbar regression tests and regenerated the game asset from its inventory source module.

## 2026-10-30 — Inventory toolbar alignment and clean Back header

- Removed the redundant BLOCK BUDDIES wordmark from the Inventory header; retained one visible Back button at the upper right.
- Aligned the six main Inventory category tabs into equal-height, equal-width tracks instead of uneven space-between placement.
- Separated class filter pills from the Default sorting and grid/list controls; all controls have consistent heights, reliable widths, and aligned spacing.
- Added explicit desktop, tablet, and mobile layout rules to prevent overlap, cropped tabs, or cramped tools. Preserved the original soldier/weapon previews, inventory ownership, Shop, weapon statistics, and game logic.
- Added regression checks for header structure, responsive toolbars, functional controls, and bundle parity.

## 2026-10-30 — Tactical Armory Inventory redesign

- Implemented the approved three-column Inventory screen: interactive real-3D soldier preview at left, compact three-column weapon grid and category controls in the center, and selected-item 3D thumbnail plus graphic stats on the right.
- Added Main Weapon class filters, default/name/damage sorting and functional grid/list view switching. Desktop has one bounded weapon-grid scroller; tablet and mobile retain responsive layouts.
- Main Weapon displays the real full catalog (not only unlocked inventory); unowned items are visibly LOCKED and cannot equip. The action opens the existing Shop for an unlock, preserving saved ownership and one equipped weapon per category.
- Reused the original Three.js model thumbnails, character pose/IK, drag-to-rotate soldier, persistent equipment, secondary/melee/explosive/helmet/item panels and shop behavior. Kept weapon stats and gameplay unchanged.
- Added dedicated `src/styles/12-inventory-armory.css`, updated Inventory regression checks, and rebuilt `assets/game.js` from its 46 ordered modules.

## 2026-10-30 — K2 and Shotgun unscoped ADS, RPG launcher aiming

- **K2 (ID 9):** removed its artificial reflex sight mesh; added low-profile iron sight posts. Lowered only its ADS viewmodel so the rifle receiver and rails stay below the aim center. No scope overlay is shown.
- **Shotgun (ID 2):** maintained natural no-scope right-mouse ADS, moving the barrel/receiver below the crosshair so they do not obscure the target. Kept the standard game crosshair.
- **RPG (ID 3):** added a transparent amber launcher rangefinder reticle on hold-right-click (no full-screen sniper scope). Off-center and lowered the RPG launcher while aimed and relaxed only its visual ADS FOV from 50 to 58 for a usable sight picture.
- Existing single Kriss, MP7, P90, AK SOPMOD, AWP and Dual Kriss ADS constraints remain unchanged. No profile damage, ammunition, recoil, fire rate, range, or ballistic changes.
- Added ADS regression tests, maintained source/compiled bundle parity for all 46 game modules.

## 2026-10-30 — Single Kriss tactical ADS fix (Dual remains hip-fire)

- Added a dedicated compact red-dot/reflex sight for **Kriss (weapon ID 6)** when holding right mouse button, with clear centered aiming dot and unobstructed view.
- Separated the existing eight 3D Kriss optic pieces into an `opticParts` group; these hide during single-Kriss ADS and restore when released. The original physical model and Dual Kriss nested models remain intact.
- Adjusted **only** the single Kriss ADS viewmodel alignment; maintained original FOV, weapon ratings, damage, recoil, ammo and movement values.
- Explicitly deny ADS for **Dual Kriss (weapon ID 7)**, including overlay and FOV. MP7, P90, AK SOPMOD and AWP scopes remain unchanged.
- Added regression coverage and regenerated the tracked game bundle from 46 ordered modules.

## 2026-10-30 — ESC Back to Lobby transition ordering

- Finish the lobby state transition before releasing any remaining pointer lock, preventing the pointerlockchange listener from reopening the ESC menu.
- Added a regression scenario for the re-entrant event; FPS controls and weapon loadout remain unchanged.

## 2026-10-30 — Fix ESC menu cursor and FPS resume behavior

- Restored the visible, clickable mouse cursor for GAME MENU (ESC), including Resume Game and Back to Lobby.
- ESC now releases Pointer Lock and clears held mouse/fire input; closing the menu hides the cursor again and attempts to restore FPS mouse control.
- Blocked mouse-look and automatic WASD pointer relocking while ESC is open. Opening the pre-round weapon picker no longer accidentally triggers the ESC overlay when its pointer is unlocked.
- Kept loadout timeout auto-aim, round selection and match rules intact. Added regression tests for ESC, resume, lobby and loadout transitions.

## 2026-10-30 — Fix mouse aim after automatic loadout confirmation

- Fixed the frozen mouse-look when a player lets the loadout timer expire: auto-confirm now transitions straight to active aim without another mouse click.
- While browser Pointer Lock is unavailable, an unlocked mouse-look fallback uses clientX/clientY deltas from the game canvas and HUD; active weapon picker, freeze time, dead players and lobby stay excluded.
- WASD or arrow-key user input attempts to upgrade that fallback to unrestricted Pointer Lock, where permitted by the browser. Clicking CONFIRM keeps its existing direct Pointer Lock request.
- Hide the cursor over the complete gameplay HUD after loadout closes and keep existing sensitivity, sanity checks, and locked mouse-look behavior.
- Added regression coverage for no-click auto aim, safety guards and pointer-lock transitions. No weapon stats or mode rules changed.

## 2026-10-30 — Isolated camera-input compatibility

- Guard the optional loadout flag in keyboard and canvas input handlers, preserving the existing standalone camera-look tests.
- No changes to weapons, gameplay, UI layout or selection behavior.

## 2026-10-30 — Mouse-first weapon loadout for Deathmatch and Bomb Mission

- Replaced the small countdown strip with the approved five-card tactical loadout dock: large clickable weapon icons, category navigation, carousel arrows, countdown and CONFIRM LOADOUT.
- The cursor is released for selection, and the camera/mouse fire controls are suspended while the picker is active. Initial team selection no longer races to lock the cursor; mouse or Enter confirmation saves the selected owned primary and attempts pointer lock from that user gesture.
- Timeout automatically confirms, hides the panel and cursor, and waits for the next canvas click if the browser requires user activation for pointer lock.
- The picker resets for each Bomb Mission round and Deathmatch match, preserving the last confirmed primary via Inventory. Locked Shop weapons remain visible but unavailable for selection.
- Kept weapon damage, recoil, ammo, gameplay, standard slot HUD and legacy number-key shortcuts unchanged. Added isolated UI/input/timeout regression coverage and rebuilt the game bundle from 46 ordered modules.

## 2026-10-30 — Bomb Mode map named LOCKDOWN

- Renamed the Bomb Mode map preview from BOMB MISSION to **LOCKDOWN** in SELECT MODE.
- Preserved the BOMB MODE gameplay mode title, original indoor map, 30 FPS preview, all combat rules and other UI.
- Updated the preview regression test and regenerated the game bundle.

## 2026-10-30 — Cleaner live map preview and 30 FPS cap

- Removed the unnecessary "LIVE 3D" badge from the SELECT MODE map preview; kept the map name and preview itself.
- Raised the preview's 2D frame-copy rate cap from 10 FPS desktop / 6 FPS touch to 30 FPS on both, without creating a second WebGL renderer.
- Added regression checks for the badge removal and 30 FPS throttling. World geometry, renderer, camera, combat, and gameplay rules remain unchanged.
- Updated the generated game bundle in sync with its source module.

## 2026-10-30 — Live 3D Select Mode map briefing

- Implemented the approved streamlined esports SELECT MODE screen, replacing excessive text with a live map view, concise mode facts and PLAY NOW.
- Named the existing Team Deathmatch city map **BLOCK DISTRICT**, without changing collision, map geometry, combat or other gameplay rules.
- Live right-panel footage captures the same Three.js renderer as the rotating lobby camera at a capped refresh rate, without allocating a second WebGL context.
- Bomb Mode shows its real indoor map using an interior orbit. Switching back to Deathmatch restores the urban map; locked Battleground displays a no-preview placeholder.
- Added responsive UI and map-preview regression tests. The committed game bundle includes the new preview module.

## 2026-10-30 — Bomb Mission round kill streak and Terrorist-only dropped-bomb signal

- Reset Double/Triple/Chain Kill streak at the start of every Bomb Mission round, including when the player survives. Team round wins, accumulated kills/deaths and Deathmatch life streaks are unchanged.
- Added a position-accurate dropped-bomb screen waypoint with distance and off-screen direction plus a pulsing minimap beacon, only for Terrorists while the bomb is on the ground.
- Police receive no bomb-drop toast or dropped-location minimap signal. Both teams retain the existing planted-bomb beacon.
- The dropped indicator disappears after pickup, plant, round completion or mode change. Added regression tests and regenerated assets/game.js.

## 2026-10-30 — MP7 rectangular reflex sight

- Replaced the round MP7 tactical ADS frame with a 128×88px rectangular reflex window and 10px rounded corners, matching its blocky low-poly optic.
- Kept the red dot centered and reshaped the surrounding reticle to a small square; the sight frame is still transparent.
- Scoped the change to MP7 CSS only: P90 ring sight, AK SOPMOD holographic sight, optic switching and weapon gameplay are unchanged.
- Added a test for the MP7 rectangular frame and for the unchanged P90/SOPMOD sight shapes.

## 2026-10-30 — Remove ADS optic captions

- Removed the text captions beneath the tactical sights for MP7, P90 and AK SOPMOD while aiming.
- Kept each weapon's distinct reticle, ADS animation, optic geometry visibility and combat behavior unchanged.
- Removed unused caption DOM/CSS/label metadata and added a regression test verifying caption-free tactical overlays.
- Regenerated tracked browser game bundle.

## 2026-10-30 — Bomb and Inventory test harness compatibility

- Load the production defense module in the isolated Bomb Mission tests so the real player/BOT damage handlers can call `defenseDamage`; maintain original planting interruption and HP assertions.
- Fix Inventory CSS rule lookup to skip a selector occurring only inside a combined rule, so the dedicated `.ivright` grid layout is inspected.
- No gameplay source, weapon models, CSS assets or generated browser bundle changed.

## 2026-10-30 — Windows CRLF test and build compatibility

- Normalize CRLF to LF in test source readers before strict bundle parity, legacy fixture checks and source regex assertions; actual source and historical fixture files remain untouched.
- Normalize line endings when generating/checking the browser game bundle on Windows so checkout line endings do not falsely fail `node tools/build.mjs --check`.
- Correct the tactical weapon profile test to read the K2 starter from its scoped profile array instead of an undefined identifier.
- No weapon stats, asset meshes, gameplay rules or browser bundle content changed.

## 2026-10-30 — MP7 Micro Red Dot ADS Fix

- Registered all five MP7 3D optic pieces for hiding during tactical ADS, reusing the existing P90/SOPMOD optic visibility mechanism.
- Lowered the MP7 ADS viewmodel to clear the central red dot and leave the receiver visible below the sight.
- Improved the MP7-specific micro red dot and ring contrast without changing P90, SOPMOD or AWP styling.
- Added regression coverage for MP7 optic hiding/restoring, ADS alignment and CSS sight styling.
- Regenerated the tracked game bundle; weapon balance and gameplay logic remain unchanged.

## 2026-10-30 — P90 Red Dot ADS Fix

- Fixed P90 ADS optic alignment and red dot visibility.
- Added opticParts registration for hiding 3D sight components during ADS.
- Updated P90 red dot color, crosshair and glow.
- Adjusted P90 viewmodel position.
- Simplified Shop unlock button text to UNLOCK FREE.
- Regenerated assets/game.js.

## 2026-10-29 — CS-style distance damage and per-weapon source layout

### Damage: Counter-Strike-inspired exponential falloff
- Activated distance-based bullet damage falloff in **both Deathmatch and Bomb Mission**, for player and BOT shots through the shared projectile pipeline. Formula: `damage = baseDamage × rangeModifier^(distance / 20 world units)`. Based on the CS:GO/CS2 range modifier model, but **20 BLOCK BUDDIES units represent one falloff interval**, not the native Counter-Strike 500 game units.
- Weapon modifiers are configurable in **each weapon's own file**: AK-47 **0.98**, K2 **0.98**, AK SOPMOD **0.97**; Kriss & Dual Kriss **0.83**, MP7 **0.85**, P90 **0.86**; AWP **0.99**; Handgun **0.91**; Shotgun **0.70 per pellet**. Rocket, Knife and Grenade have no bullet falloff.
- Damage decays smoothly and never increases as distance grows. Projectile lifetime and original Range ratings remain **hard maximum ranges**; the previous bug where fo was never populated is resolved.
- Falloff is applied **before** hit-location multiplier, helmet and vest damage absorption. Body armor remains **50 vest durability / 20% torso reduction**, HP **100**, and headshot multiplier **3×**; there is no simultaneous defense rebalance.
- Added `tools/damage-sim.mjs` for hits-to-kill and ideal TTK, with/without vest and helmet, at 5, 10, 20, 40 and 60 world units. Sim assumes all rounds/pellets connect, and excludes missed bullets, reload and movement.

### Refactored weapon maintenance
- Reorganized the old `src/game/40-weapons-and-viewmodels.js` into `src/game/weapon/`: **one module per weapon** (13 files with stable ID, rating, falloff modifier and reference-based 3D mesh builder), plus `00-registry.js`, `20-ballistics.js` and `30-viewmodels.js`. The former filename now holds a migration note and is not bundled.
- Unified UI weapon classes via frozen `WEAPON_CLASS_LABELS`: **ASSAULT RIFLE** (AK-47, K2, AK SOPMOD), **SUBMACHINE GUN** (Kriss, Dual, MP7, P90), **SNIPER RIFLE** (AWP), **SHOTGUN**, **HANDGUN**, **LAUNCHER**, **MELEE**, **THROWABLE**. Shop/Inventory and pre-match selection share these labels.
- `tools/source-manifest.json` now lists the 16 ordered weapon modules; committed `assets/game.js` is regenerated from their source (not hand-authored). Added `src/game/weapon/README.md` with ID mapping and editable balance settings.
- Updated older tests to load modular weapon profiles and added range/helmet/vest/shotgun regression tests in `tests/damage-range.test.mjs`. Existing weapon IDs, **all 13 weapon rating numbers**, ammo, movement, fire rates, recoil, Shop ownership, K2 starter weapon, Kriss dual mode, BOT loadout and Bomb rules remain unchanged.

### Testing
- In-source JavaScript parsing and focused behavior checks cover the new registry, class labels, range modifiers and projectile damage formulas.
- Live browser playtesting and full local Node suite are not claimed here unless independently executed.


## 2026-10-29 — MP7, P90 and AK SOPMOD tactical Shop weapons

### Three new Shop primaries
- Added **MP7** (ID 10): Damage **21**, RPM rating **93**, Control **60**, Speed **88**, Vertical Recoil **45**, Horizontal Recoil **54**, **30/200** ammunition and Range **60**. Classified as SMG.
- Added **P90** (ID 11): Damage **24**, RPM rating **92**, Control **54**, Speed **88**, Vertical Recoil **45**, Horizontal Recoil **48**, **50/200** ammunition and Range **65**. Classified as SMG.
- Added **AK SOPMOD** (ID 12): Damage **33**, RPM rating **90**, Control **50**, Speed **74**, Vertical Recoil **64**, Horizontal Recoil **60**, **30/150** ammunition and Range **160**. Classified as rifle.
- The three weapons are unlockable through the existing **Shop → UNLOCK FREE → Inventory → USE** workflow; a brand-new player still starts with **K2**. Shop pricing/currency remains intentionally unimplemented, so no fabricated purchase prices appear. Browser-local ownership remains persistent.
- Dedicated 3D low-poly meshes are modeled after the **three weapon reference images provided by the user** (`mp7.png`, `p90.png`, `ak-sopmod.png`): MP7 compact black body with optic, collapsible stock and front grip; P90 bullpup body, top magazine and integrated sight; AK SOPMOD black modular rifle with tactical grip, optic, rail and curved magazine.
- The existing Shop and Inventory **render their preview thumbnails from those actual in-game 3D models**, not the user's reference raster image files. The separate user-provided PNG files are not embedded in the repository.
- Original weapon IDs **0–9** and all BOT_WEAPONS assignment arrays stay unchanged; bots continue using exactly their existing weapon set. Updated muzzle, first-person hand poses, reload style, magazine/reserve, bullet and recoil tuning, shell casings, sound, drop-physics and HUD silhouettes for all 13 weapons.

### Right-click tactical sights
- **MP7, P90 and AK SOPMOD** support **hold right mouse button** for a tactical aim view with individual optics:
  - **MP7** micro red-dot with a small red aiming ring (ADS FOV **42**);
  - **P90** green integrated ring optic with a broader housing (ADS FOV **44**);
  - **AK SOPMOD** amber carbine holographic framing with more focused ADS (ADS FOV **36**).
- These sights use an independent non-obscuring overlay and keep the in-game weapon model visible while aiming, instead of copying the AWP full black sniper scope. Existing AWP scope behavior and Kriss V-key Dual Mode remain unchanged.
- Added isolated `src/game/76-tactical-optics.js`, `src/styles/11-tactical-optics.css` and register both in `tools/source-manifest.json`; the committed offline `assets/game.js` includes all updated modules. The new UI copy is English.

### Regression coverage
- Updated weapon count/recoil and K2-specific assertions for thirteen weapon IDs, plus a new regression suite checking exact requested ratings, K2 starter/Shop locking, bot loadout isolation, three distinct optics and module/bundle parity.
- Static/runtime in-process verification of weapon profiles and derived arrays passed; full Node test suite and live 3D browser playtesting are not claimed.


## 2026-10-29 — K2 starter weapon, weapon ownership and playable Shop

### New K2
- **K2** rifle added at stable weapon ID 9 with exact requested stats: **Damage 36, RPM 96, Control 75, Speed 79, V.Recoil 66, H.Recoil 33, Bullets 40/200, Range 120**.
- Added a proper low-poly K2 model derived from the supplied visual reference, including silver receiver, long black barrel, handguard rails, optic, curved magazine and adjustable stock. Added colored 3D Inventory/Shop previews, HUD silhouette, fire/muzzle effects, ADS, recoil, weapon animations and dropped-gun geometry.
- Existing weapon IDs, all BOT_WEAPONS loadout values and weapon damage rules remain unchanged. The K2 uses existing rifle ballistics conversion.

### Player starter and Shop
- **Brand-new browser profile gets only K2 as primary**, along with existing free Handgun, Knife, Grenade, Standard Helmet and vest. Other main weapons must first be unlocked in **SHOP**.
- Replaced the prior placeholder SHOP menu with a real catalog featuring **AK-47, Shotgun, RPG, Kriss and AWP**. All five currently have a working **UNLOCK FREE** action; no currency, price, or fake wallet balance is introduced. Unlocks are local to this browser profile until a future account/economy system is built.
- Owned weapons are saved in `bbfps_inventory_v1` as a separate `unlockedMain` list. Previously equipped weapons from old saves do not automatically count as purchased; previous saves default to K2 unless an actual unlocked list exists.
- Inventory shows only owned primary weapons. Pre-round weapon selection in **Deathmatch and Bomb Mission** now only shows owned primaries, prevents direct selection of locked IDs, and retains the five keyboard shortcuts plus click/tap for any further owned entries.
- **Kriss and Dual Kriss** remain one Shop item and one ownership entry; the existing **V** dual-mode toggle continues working after Kriss is unlocked.
- Weapon profile data and bot selection are not connected to the player's Shop unlocks. Bot weapons and AI behavior are unchanged.

### Architecture and user-facing copy
- Added modular `src/game/89-shop.js` and `src/styles/10-shop.css` plus Inventory/shop integration, catalog tests and manifest updates. Compiled runtime committed to `assets/game.js` for direct `index.html` use without builds, Docker or external services.
- Shop labels: **WEAPON SHOP**, **STANDARD ISSUE**, **MORE FIREPOWER**, **UNLOCK FREE**, **OWNED**. Existing local Inventory copy remains English.
- This first Shop version deliberately **does not charge credits** because no pricing or reward rules have been supplied. Browser-level visual testing remains pending.


## 2026-10-29 — Life-based kill streak and headshot notifications

### Fixes
- Kill streak is now **per life**, not a four-second timed combo. First kill remains normal; second is **DOUBLE KILL**, third **TRIPLE KILL**, and fourth onward **CHAIN KILLER**. Any gap between kills is allowed while the player is alive.
- Every headshot kill shows **HEADSHOT**, regardless of previous headshots, and still increments the life streak. The next non-headshot resumes the correct milestone.
- Player death resets the streak immediately; a new match also starts at zero. Career kills, team score and bot statistics are unchanged.
- In Bomb Mission, **survivors** retain their life streak between rounds even though the world is rebuilt. Players who died begin the next round at zero.
- Existing **MASS KILL** for multi-victim explosions remains unchanged; its kills still contribute to the life streak.

### Technical
- Source of truth: `resetKillStreak()` and `registerPlayerKill()` in the combat event flow. Removed the old `ck.t` expiry and preserved the existing headshot feed.
- Updated `assets/game.js` to match the modular source. No changes to damage, armor, bots, movement, inventory, bomb objectives, or map assets.
- New regression tests exercise long gaps, headshots amid normal kills, death resets, multi-kill explosions, and Bomb Mode round transitions. All UI strings remain English.


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
