# Blok Buddies architecture and development rules

## Source of truth

`tests/fixtures/source-original.html` retains the original browser game. Existing Team Deathmatch logic, weapons, GUI strings and visual effects must not change without explicit approval. `index.html` retains the lobby and original Three.js/Google Fonts external dependencies.

All JavaScript feature fragments are assembled in the explicit order in `tools/source-manifest.json` to produce a single original-style IIFE bundle at `assets/game.js`. This maintains the shared lexical state while logically separating responsibilities. The committed bundle is generated, never hand-edited. Browser-only users just pull and open the file.

## Modes

Team Deathmatch uses the original map (`BOMB_CITY` mesh and collision snapshots). Bomb Mission's indoor map generator stores its own `BOMB_WORLD`, `BOMB_OB`, `BOMB_BR` and `BOMB_LT` and restores the originals when returning to TDM. The AI pathfinding grid `GB` is invalidated whenever the active map changes. Game mode is set by `selectedGameMode`; the `isBombMode()` guard isolates objective-specific behavior.

`src/game/11-bomb-map.js` provides immutable `BOMB_RULES` and `BOMB_TEXT` configuration plus map generation and site markers. `src/game/86-bomb-mission.js` owns the bomb lifecycle, interaction progress, dropped device state, AI objective goals, spectator targeting, round rules and Bomb HUD. Combat uses the original projectile system; `killE()` and `die()` trigger `bombDrop()` and suppress TDM respawn/kill-scoring when Bomb Mission is active. `update()` calls `bombUpdate()` to resolve the round and the render loop follows living teammates after player death.

## Anti-regression

For every update, regenerate `assets/game.js`, then run syntax, bundle-sync and logic regression tests. Preserve the original fixture. Record changes in `CHANGELOG.md`, including affected modules, UI strings and validation. Never silently add networking, accounts, tracking or third-party dependencies.

## Security / online readiness

This remains an **offline client-simulated game**. Client-supplied position, health, damage, bomb state and round results are untrusted for real PvP. Before multiplayer, movement, collision, shots, bomb actions, round results and spectator visibility must be handled by a server-authoritative engine; these file boundaries are only a foundation, not anti-cheat.
