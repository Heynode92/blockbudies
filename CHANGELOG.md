# Changelog

Every update must record its date, scope, affected modules, user-visible strings, compatibility, and validation. Keep the original fixture immutable.

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
