# Changelog

Maintain this file for **every update**. Each entry should state what changed, what stayed compatible and how the change was tested.

## 2026-10-28 — Initial modular migration

### Changed
- Split original HTML into `index.html`, six ordered CSS source files and 17 feature-oriented JavaScript source files.
- Created a committed ready-to-play bundle at `assets/game.js` and a deterministic dependency-free build script.
- Added an immutable original fixture, source equivalence tests and architecture documentation.

### Preserved
- English UI copy, HUD, lobby, match rules, timer, damage, bots, weapons, sounds and animations.
- Byte-for-byte JavaScript and CSS source after concatenation.
- Original Three.js r128/Google Fonts links.
- Offline/local gameplay; online multiplayer was not added.

### Validation
- `node --check assets/game.js`: PASS locally.
- `node tools/build.mjs --check`: PASS locally.
- `node --test tests/parity.test.mjs`: PASS, 4 tests locally.
- Browser gameplay smoke test not verified yet; static source parity is verified.

### Unchanged baseline limitations
- Shop, Leaderboard, Settings, Bomb Mode and Battleground are unfinished/locked in the source.
- CDN dependencies may require internet on first load.
- No authoritative server or networked multiplayer.
