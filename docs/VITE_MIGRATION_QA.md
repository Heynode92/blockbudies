# PointBlock Vite Migration — QA Acceptance Log

Status: **SOURCE INTEGRATION COMPLETE / BROWSER PARITY PENDING** (2026-11-01)

## Objective and baseline

Migrate the original browser FPS from direct HTML + the committed IIFE runtime to Vite + npm-managed Three.js, preserving all gameplay rules, movement feel, bots, map collision, renderer parameters, UI and in-game behavior. This is not an engine upgrade. Source remains the canonical 69 fragments in `tools/source-manifest.json`; the virtual Vite module keeps their shared lexical ordering until a separately tested ES module architecture migration.

## Automated checks

| Check | Status | Evidence / next action |
| --- | --- | --- |
| Original gameplay manifest order and count | PASS (source inspection) | 69 ordered parts, no omitted fragments |
| 15 CSS fragments included, in original cascade order | PASS (source inspection) | Vite virtual styles module uses manifest order |
| Previous IIFE source parity | PASS (source comparison) | 444,893 characters, matching FNV32 3114146827 for ordered source and legacy bundle |
| Build plugin syntax | PASS (isolated parser test) | Node.js syntax and virtual-module sample output checked |
| `npm test` on Windows CI | PENDING | Workflow defined; no successful run verified in this audit |
| `npm run build` and `npm run check:dist` | PENDING | Requires npm install and Windows CI execution |
| Live canvas / Browser WebGL initialization | PENDING | Not verified by static source checks |

## Required interactive acceptance checklist

Do not mark **FULLY VERIFIED** without a real browser run on Windows using `START-POINTBLOCK.cmd`:

- Home loads with the actual Block District 3D backdrop; the two 1920×1080 showcase videos switch and the PBT image renders. No failed requests in DevTools Network.
- Navigation supports `/`, `/loby`, `/loby/room/`, `/inventory` and `/shop`; Back buttons, browser history, deep links, and refresh match baseline.
- Room Browser shows the same rotatable Police operator, existing weapon and map scene, local room list and settings. New room settings and 3D map previews for Block District / Block Labs / Lockdown / Block Town / Hospital keep their original camera, animation and selection behavior.
- TDM on both maps: 5v5 BOT spawn, controls, shooting, reloads, range falloff, body/head damage, vest durability, win conditions, match clock and end report match baseline.
- Bomb Mission on all three maps: bomb carrier assignment, drop/pickup, plant 5s, defuse 7s, interruptions, squad behavior, round limits and spectator camera match baseline.
- All equipped guns: meshes, first-person viewmodels, sights/ADS, scopes, recoil, animations, inventory ownership, shop unlock state, and audio remain intact.
- ESC opens Game Menu, Back to Lobby opens ARE YOU SURE? (YES/NO), YES returns to Room List and NO cancels; end report returns to the original Room Master room.
- Performance on the same machine/settings: record FPS and frame-time p95, BOT CPU, memory and browser console errors. Compare to the pre-migration baseline. Do not claim FPS improvements purely because of Vite.
- Run M7 BOT QA instrumentation (`?bbBotQa=1`) and validate exported report against the original M7 QA format.

## Maintenance contract

- Edit files under `src/game/`, `src/styles/` and `src/assets/`, not the built compatibility `assets/game.js`.
- Add new feature fragments and styles to `tools/source-manifest.json` in verified dependency/cascade order.
- Run `npm run verify` (regenerates compatibility artifact as part of test, runs Node tests, builds Vite and checks dist).
- Preserve Three.js 0.128.0 until an independent engine upgrade PR has visual, performance and API compatibility evidence.
- Do not add online multiplayer, wallet finance actions, unsupported maps or nonrequested functionality during build migration.
- `npm install` initially generates a local lockfile; commit an audited lockfile after installation to improve dependency reproducibility. Do not hand-author an invalid lockfile.

## Unresolved limitations

The game uses a Vite-generated ES module wrapper but still shares lexical state among its 69 source fragments. This minimizes behavioral risk but is not a completed per-feature ES Module dependency refactor. No real device FPS, combat or 3D render parity was measured in this change. Static tests and bundle parity alone cannot guarantee that users see identical visuals or that the game starts successfully.
