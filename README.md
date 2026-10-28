# Blok Buddies FPS

Modular source code for the original Three.js r128 browser FPS. **Team Deathmatch and Bomb Mission are playable in a local browser against AI bots.** No multiplayer backend has been added.

## Windows: run with Git pull only

```powershell
git clone https://github.com/Heynode92/blockbudies.git
cd blockbudies
Start-Process .\index.html
```

Next time, use `git pull` and open `index.html` again. You **do not need a runner, Docker, WSL, Node, npm, or manual builds** to play; `assets/game.js` is already committed. The browser still loads the original Three.js r128 CDN and Google font; internet may be needed on first load.

## Modes

**Team Deathmatch** — original 5v5 gameplay, 1 minute, kill-score victory, 5-second respawns. Kept separate from Bomb Mission.

**Bomb Mission** — 5v5 in a dedicated procedurally generated but deterministic indoor maze map, with interconnected rooms, industrial corridors, two marked bomb sites, and cover. One randomly selected Terrorist (player or bot) carries the bomb. Terrorist: stand inside site A or B and **hold E for 5 seconds** to plant. Police: stand near the planted bomb and **hold E for 7 seconds** to defuse. Movement and shooting are disabled while performing an action; enemies can still damage or kill the actor. Releasing E, leaving the site, or dying cancels the progress. Defusing before the fuse ends awards Police the round; detonation awards Terrorists the round. A dropped bomb can be picked up by another Terrorist. Bots can independently plant, recover and defuse. Each round has no respawns; dead players spectate living teammates (left/right arrows switch view). First to 7 round wins, maximum 12 rounds. Touch devices have an interaction button and a teammate-switch button.

**Battleground** is still locked and unchanged.

## Repository structure

| Path | Responsibility |
|---|---|
| `index.html` | Original lobby/HUD markup, plus Bomb Mission interaction HUD |
| `src/styles/` | Seven ordered CSS fragments |
| `src/game/11-bomb-map.js` | `BOMB_RULES`, `BOMB_TEXT`, indoor maze and map switching |
| `src/game/86-bomb-mission.js` | Bomb lifecycle, AI objective helpers, action animations, spectator and rounds |
| `src/game/` | Other original game mechanics, weapons, AI, effects and rendering |
| `assets/game.js` | **Committed** built browser script; never edit manually |
| `tools/source-manifest.json` | Explicit file ordering for original IIFE's shared scope |
| `tools/build.mjs` | Dependency-free maintainer tool for regenerating browser bundle |
| `tests/` | Source integration and isolated Bomb Mission logic tests |
| `tests/fixtures/source-original.html` | Immutable uploaded baseline |
| `CHANGELOG.md` | Dated log of every update |

## Maintainer-only checks (players do not run these)

```powershell
node tools/build.mjs
node tools/build.mjs --check
node --check assets/game.js
node --test tests/*.test.mjs
```

The original engine was built in a single shared IIFE. Feature fragments are intentionally concatenated in a stable order, preserving function scope and avoiding an unverified ESM rewrite. All timings and map generation constants for Bomb Mission are centralized in `BOMB_RULES`; its interface strings are grouped in `BOMB_TEXT`. No third-party dependencies have been added.

## Status of validation

Automated source and isolated mode-logic tests are included. Full interactive browser smoke testing remains pending because the test environment blocked browser access to local pages. Please report runtime anomalies with the browser console output to help reproduce them. No production/online readiness is claimed.
