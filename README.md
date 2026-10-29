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
| `src/styles/` | Eight ordered CSS fragments |
| `src/game/39-defense.js` | Centralized 100 HP, vest 50, 20% body damage reduction, uniform headshot rules |
| `src/game/41-bot-weapons.js` | Weapon-profiled AI loadouts, ammo, reload and attack choices |
| `src/game/42-projectile-defense.js` | Shared bullet impact and helmet/vest logic |
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

## Bomb Mission map and bots (2026-10-28)

Bomb Mission uses a dedicated **160×160** indoor arena (16×16 cells) with four themed industrial sectors, actual walls on the radar, two central bomb sites and 5v5 role-based bots. On death, follow a full teammate model from behind; use Left/Right arrows to change teammate. Bots independently guard sites, escort and plant the bomb, chase threats, retake and defuse. Plant/defuse mechanics and existing English strings remain unchanged. Player runs the committed bundle without a build. See `CHANGELOG.md` for test coverage and limitations.

## Combat balance (2026-10-29)

Player and bots spawn with **100 HP + 50 vest durability + a helmet**. Vest reduces torso bullet damage by **20%** until depleted; headshots, knife and explosives bypass the vest. Helmet protects against the first headshot bonus, then headshots deal 3× base bullet damage to both. The HUD shows `VEST 50` at full durability. AI bots now select from the same `WEAPON_PROFILES` as the player with appropriate damage, fire interval, ammo, reload, and ranges; the bot aim behavior is deliberately AI-specific. All weapon data is in local JavaScript (there is no separate backend weapon database). See `CHANGELOG.md` for the update log.
