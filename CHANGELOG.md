# Changelog

Every update must record its date, scope, affected modules, user-visible strings, compatibility, and validation. Keep the original fixture immutable.

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
