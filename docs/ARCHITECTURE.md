# Architecture: source of truth and build discipline

## Baseline

Source of truth: uploaded `Blok_Buddies_FPS_fixed (7).html`. Its exact contents are archived at `tests/fixtures/source-original.html`. The original HTML, CSS and JavaScript are reconstructed byte-for-byte from the project in the parity tests.

## Runtime

The browser loads the original Three.js r128 URL, the ordered stylesheets, and `assets/game.js`. The bundle is the original single IIFE with unchanged statement order and shared variables. The source files are logical editing boundaries **not independent ES modules**. A deterministic, dependency-free Node tool assembles them. The output is committed so users only need `git pull`.

## Ownership

| Fragment | Responsibility |
|---|---|
| 00-bootstrap | Three.js renderer and scene setup |
| 10-world | Map, buildings, objects and obstacles |
| 20-sky-and-physics | Sky animation and world collisions |
| 30-characters | Character models, helmets and movement animation |
| 40-weapons-and-viewmodels | Weapon stats, meshes, FPS gun/hand animations |
| 45-combat | Projectile firing, reset and explosions |
| 50-items-and-drops | Airdrops, shell casings and dropped items |
| 60-impact-effects | Bullet decals, damage marks and smoke |
| 65-audio | WebAudio effects |
| 70-kills-and-damage-hud | Kill feedback and damage direction |
| 75-weapon-controls | Weapon slots, loadout and sniper scope |
| 80-input | Mouse/keyboard and touchscreen |
| 85-lobby-and-match | Lobby UI and match lifecycle |
| 90-bot-ai | Bot pathfinding and behaviors |
| 95-simulation | Simulation update loop |
| 96-hud-and-radar | Player HUD and minimap |
| 99-render-loop | Animation frame and viewmodel/world render passes |

Stylesheets retain original CSS ordering through numeric prefixes and manifest.

## Multiplayer boundary

Movement, health, scoring and shots are currently simulated in the browser. They must be validated by a server-authoritative game engine before online PvP. This migration adds **no server, database, networking, matchmaking or anti-cheat**.

## Future changes

1. Identify the original source-of-truth behavior and relevant feature files.
2. Keep existing gameplay/UI strings unless explicitly changing them.
3. Update source and run `node tools/build.mjs`.
4. Run syntax, build-sync and regression tests. Intentional game changes require new behavioral tests; keep the original fixture intact.
5. Append a dated entry to `CHANGELOG.md` and commit source and generated bundle together.

Do not add runtime dependencies or move functions around without specific regression coverage.
