# Point Block FPS

**Project branding:** PointBlock (displayed in-game as **POINT BLOCK**). GitHub repository path remains `Heynode92/blockbudies` until its owner renames it; do not substitute an uncreated repository URL.

Modular game source, now served and built through Vite with pinned Three.js r128 from npm. **Team Deathmatch and Bomb Mission are playable in a local browser against AI bots.** No multiplayer backend has been added.

## BOT intelligence upgrade roadmap (planned; not implemented)

A professional, staged modernization plan for **Police and Terrorist BOTs**—aggressive movement, fair 3D aiming, perception, cover, squad coordination, TDM and Bomb Mission tactics—is documented in [BOT AI Master Plan](docs/BOT_AI_MASTER_PLAN.md). Track real implementation status and test evidence in [BOT AI Implementation Log](docs/BOT_AI_IMPLEMENTATION_LOG.md).

**Documentation only as of 2026-10-30.** This roadmap does not mean the new AI is already live, and the current five-star indicator is not a measured skill benchmark.

## Windows only: Vite launcher (no Docker or WSL)

This project now runs through **Vite 8.3.5 + npm Three.js 0.128.0**. Node.js 22.12+ (or 20.19+) must be installed. The previous `file://index.html` startup is **no longer supported** for the Vite app.

```powershell
cd D:\robinhood\blockbuddies\blockbudies
git pull origin main
.\START-POINTBLOCK.cmd
```

Double-click `START-POINTBLOCK.cmd` after each pull if preferred. It installs npm dependencies on first use and opens the game at `http://127.0.0.1:5173/`. Keep the launcher window open while playing. No manual build, runner setup, Linux, Docker or WSL. For development use `npm run dev`; for release `npm run build`, then host the `dist/` folder on a static server with SPA fallback for deep URLs.

Vite routes are `/` (home), `/loby`, `/loby/room/`, `/inventory`, and `/shop`. Other screens remain untouched. Browser-local rooms are not a multiplayer service; a fresh deep link to `/loby/room/` without an active in-memory room goes to Room List.

The two showcase videos and token icon are bundled locally; the Google Fonts CSS request remains external.

## Menu background music

`src/assets/audio/Pointblock_bgm.mp3` plays automatically when the browser permits unmuted autoplay; otherwise it begins on the first game interaction, without any visible controls. The same looping track continues through Home, Room List, Create Room, Room Master, Inventory, and Shop. It fades out over 1.4 seconds when map loading starts, pauses during combat and Battle Report, and returns on the next lobby visit. Music is handled by `src/audio/menu-bgm.js`, separate from existing battle sound effects.

## Modes

**Team Deathmatch** — original 5v5 gameplay, 1 minute, kill-score victory, 5-second respawns. Kept separate from Bomb Mission.

**Bomb Mission** — 5v5 in a dedicated procedurally generated but deterministic indoor maze map, with interconnected rooms, industrial corridors, two marked bomb sites, and cover. One randomly selected Terrorist (player or bot) carries the bomb. Terrorist: stand inside site A or B and **hold E for 5 seconds** to plant. Police: stand near the planted bomb and **hold E for 7 seconds** to defuse. Movement and shooting are disabled while performing an action; enemies can still damage or kill the actor. Releasing E, leaving the site, or dying cancels the progress. Defusing before the fuse ends awards Police the round; detonation awards Terrorists the round. A dropped bomb can be picked up by another Terrorist. Bots can independently plant, recover and defuse. Each round has no respawns; dead players spectate living teammates (left/right arrows switch view). First to 7 round wins, maximum 12 rounds. Touch devices have an interaction button and a teammate-switch button.

**Battleground** is still locked and unchanged.

## Repository structure

| Path | Responsibility |
|---|---|
| `index.html` | Vite HTML entry and original lobby/HUD markup |
| `src/main.js` | Vite ES module entry: pinned Three.js, asset imports and runtime mounting |
| `vite.config.mjs` | Vite dev server and production build configuration |
| `tools/vite-game-plugin.mjs` | Ordered gameplay/CSS source bridge with full-reload on edits |
| `src/styles/` | Ordered CSS fragments for game, lobby, inventory, Shop and tactical optics |
| `src/game/39-defense.js` | Centralized 100 HP, vest 50, 20% body damage reduction, uniform headshot rules |
| `src/game/weapon/` | One file per weapon, shared CS-style falloff configuration, ballistics and Three.js viewmodels |
| `tools/damage-sim.mjs` | Range, body/vest/head/helmet bullets-to-kill and ideal TTK simulator |
| `src/game/41-bot-weapons.js` | Weapon-profiled AI loadouts, ammo, reload and attack choices |
| `src/game/42-projectile-defense.js` | Shared bullet impact and helmet/vest logic |
| `src/game/11-bomb-map.js` | `BOMB_RULES`, `BOMB_TEXT`, indoor maze and map switching |
| `src/game/86-bomb-mission.js` | Bomb lifecycle, AI objective helpers, action animations, spectator and rounds |
| `src/game/` | Other original game mechanics, weapons, AI, effects and rendering |
| `assets/game.js` | Legacy compatibility/parity artifact (not loaded by Vite); never edit manually |
| `tools/source-manifest.json` | Explicit file ordering for original IIFE's shared scope |
| `tools/build.mjs` | Legacy bundle parity tooling for existing regression tests |
| `tests/` | Source integration and isolated Bomb Mission logic tests |
| `tests/fixtures/source-original.html` | Immutable uploaded baseline |
| `CHANGELOG.md` | Dated log of every update |

## Maintainer verification (CI and maintainers, not players)

```powershell
npm install
npm run test
npm run build
npm run check:dist
```

GitHub Actions runs these checks on pushes and pull requests. `tools/source-manifest.json` remains the **only ordering source of truth**; the Vite plugin builds the game directly from the original feature fragments, preserving shared state, gameplay timing and Three.js r128 rendering behavior. The checked-in `assets/game.js` is a **non-runtime parity artifact** for regression tests. The `npm test` command regenerates this compatibility bundle automatically before running tests; game developers only edit the canonical `src/game/` feature files. The browser never loads the compatibility bundle. Existing code is **not yet independently scoped ES Modules**; converting every shared-state fragment without browser QA would risk regressions. This bridge removes CDN/global Three.js and introduces a modern Vite entry and asset pipeline without changing the game rules.

The runtime uses an ES module compiled by Vite. Vite's full-reload workflow recreates the Three.js canvas after gameplay source edits instead of unsafe hot module replacement of live WebGL singletons.

## Status of validation

Automated source and isolated mode-logic tests are included. Full interactive browser smoke testing remains pending because the test environment blocked browser access to local pages. Please report runtime anomalies with the browser console output to help reproduce them. No production/online readiness is claimed.

## Bomb Mission map and bots (2026-10-28)

Bomb Mission uses a dedicated **160×160** indoor arena (16×16 cells) with four themed industrial sectors, actual walls on the radar, two central bomb sites and 5v5 role-based bots. On death, follow a full teammate model from behind; use Left/Right arrows to change teammate. Bots independently guard sites, escort and plant the bomb, chase threats, retake and defuse. Plant/defuse mechanics and existing English strings remain unchanged. Player runs the committed bundle without a build. See `CHANGELOG.md` for test coverage and limitations.

## Combat balance (2026-10-29)

Player and bots spawn with **100 HP + 50 vest durability + a helmet**. Vest reduces torso bullet damage by **20%** until depleted; headshots, knife and explosives bypass the vest. Helmet protects against the first headshot bonus, then headshots deal 3× base bullet damage to both. The HUD shows `VEST 50` at full durability. AI bots select from the same `WEAPON_PROFILES` as players; bot weapon choices, aim AI and loadouts remain separate. Base damage, ammo, recoil and hard maximum range ratings are unchanged. Damage now decays continuously before armor and headshot calculations using a Counter-Strike-inspired per-weapon exponential range modifier, normalized to POINT BLOCK world units (20 world units per modifier interval rather than 500 Counter-Strike units). Rifle modifiers are around 0.97–0.98, SMGs 0.83–0.86, AWP 0.99, and shotgun 0.70 per pellet. RPG, Knife and Grenade do not use bullet falloff. The player still starts with K2, while other primaries unlock through Shop.

**Weapon maintenance:** All weapons are separated in `src/game/weapon/<NN>-<name>.js`. The frozen `WEAPON_CLASS_LABELS` distinguishes **ASSAULT RIFLE** (AK-47, K2, AK SOPMOD), **SUBMACHINE GUN** (Kriss, Dual Kriss, MP7, P90), **SNIPER RIFLE** (AWP), **SHOTGUN**, **HANDGUN**, **LAUNCHER**, **MELEE** and **THROWABLE**. The shared damage mapping is in `weapon/00-registry.js`; derived runtime stats in `weapon/20-ballistics.js`; animations/dispatcher in `weapon/30-viewmodels.js`. For harder/easier damage over distance edit each weapon's `WEAPON_RANGE_MODIFIERS[id]` value (closer to 1 means **more damage at range**), or the central `DAMAGE_FALLOFF.referenceUnits` (larger means **slower drop**). For HP, armor and headshots see `DEFENSE_RULES` in `src/game/39-defense.js`, unchanged here.

**Balance diagnostics:** Run `node tools/damage-sim.mjs` for all weapons at 5/10/20/40/60 units, including helmet/vest variants. It assumes every shot/pellet hits and omits reload and misses. See `src/game/weapon/README.md` for the full file ownership map and formula. See `CHANGELOG.md` for update history.
