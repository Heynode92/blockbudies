# BLOCK BUDDIES — HOSPITAL (Indoor Bomb Mission)

**Status:** Implemented in source; functional QA pending latest GitHub Actions run.  
**Map ID:** `hospital`  
**Mode:** Bomb Mission / 5v5  
**Footprint:** 160×160 world units (X/Z -80..80), identical to the existing Bomb Mission scale.

## Blueprint and visual source of truth

This map follows the owner-provided hospital blueprint. **Purple at north-west = Police Spawn, red at south-east = Terrorist Spawn, A = north-east surgical wing, B = west-middle imaging/ward wing; gray = traversable corridors, white = solid wing/room masses**. The original drawing has no explicit interactive doors, so the main white room shapes are treated as sealed hospital wings with visually labelled door panels; it does not advertise enterable patient rooms that have no gameplay path.

| Location | Anchor (X,Z) | Facility identity |
|---|---:|---|
| Police Spawn | around (-70,-70) | Emergency Staff Entrance |
| Terrorist Spawn | around (67,70) | Service and Loading Entrance |
| Bomb Site A | (67,-43) | Surgical / Operating Wing |
| Bomb Site B | (-67,10) | Patient Ward / Imaging Wing |
| Mid | around (0,8) | Central Nurse Station |

Spawns use **five fixed collision-free candidates per team**, picked through existing `SPH` history. The first-person and BOT facing convention is the original yaw `atan2(targetX-x,targetZ-z)`, with inward-facing per-team clinical waypoints.

## Architecture and material reuse

- New map-only `src/game/14-hospital.js` defines `HOSPITAL_DEF`: palettes, 14 solid large wings approximating the blueprint, 20 themed cover fixtures, spawn slots, medical department colors and interior preview.
- Shared existing Three.js r128 helpers `mk()`, `wl()`, `dk()`, `shade()/lite()` and `flushDeco()`; **no image CDN, external assets, texture downloads or player-side dependencies added**.
- Each large white wing uses a real `wl()` physical collision body and distinct sealed clinical façade: observation windows, departmental color bars, door labels, corner trims, service conduits and continuous wall rails. The large white blocks are never falsely depicted as open doors.
- Medical cover variety comes from **physical** nurse-station counters, triage/reception desks, hospital beds, stretchers, linen storage, medical consoles, an imaging-machine base, benches, utility racks and wheelchairs. Every cover body is registered in canonical `OB` for the player, shots and BOT A*; trim/glass/lights are visual details only.
- Indoor ceiling is visible and also registered as a projectile blocker in canonical `LT` at approximately Y=11.5. Ceiling light panels, floor department guide lines and overhead signs are distinct 3D details. Outdoor sky/cloud meshes are hidden in Hospital and restored on map change.
- Map-owned fog, lighting palette and indoor preview below the roof. No coplanar checkerboard floors; floor guide strips render above the underlying seamless floor plane.
- **Four perimeter walls** enclose the world. The map keeps the existing scoreboard, round settings, Bomb timing, damage tables, matchmaking and AI tactical policies untouched.

## Runtime integration

- `src/game/12-block-town.js`: extends `BOMB_MAP_REGISTRY` and `bombMapOptions()` with `hospital`, plus map-specific yaw routing.
- `src/game/11-bomb-map.js`: routes `selectGameMap(true)` into `makeHospital()` or cached Hospital geometry. Map changes isolate and restore visible meshes, `OB/BR/LT` collision snapshots, A/B sites and pathfinding `GB`. Existing Lockdown/Block Town/Block District/Block Labs are preserved.
- `src/game/83-room-lobby.js` already discovers Bomb map options from the registry. **Create Room → Bomb Mission → Hospital** and Room Master Settings save a whitelisted map ID; old rooms still default to Lockdown.
- `src/game/99-render-loop.js` already uses `bombMapInfo(selectedBombMapId).preview`; Hospital's map metadata provides a below-ceiling camera.
- Source manifest and committed `assets/game.js` are kept in canonical module order. Normal Windows usage remains **git pull and open index.html**.

## Functional acceptance criteria

1. Windows Node regression and source-manifest bundle parity PASS.
2. Exactly two canonical site coordinates and both unobstructed plant radii; zero props inside them.
3. All 10 configured spawns are physically free; all 25 opposing spawn pairs have blocked direct LOS.
4. Authentic production Bomb A* returns paths from **every spawn to both A and B** (20 routes).
5. Hospital possesses real physical perimeter walls, 14 solid wing blockers, 20 true cover collision bodies and an overhead `LT` ceiling.
6. Switching among Hospital, Lockdown, Block Town and both Deathmatch maps never leaks scene objects, collider snapshots, spawns or sky/roof settings.
7. In actual Chromium QA, both Police and Terrorist configurations complete canonical Bomb rounds, using 5v5 BOT production logic, with no browser exception.
8. Non-monotone hospital presentation still needs screenshot verification in the owner's actual browser; software-rendered CI FPS is **not certified hardware performance**.

**Important:** functional automated testing cannot prove competitive balance or subjective visual quality. Do not mark final VERIFIED before checking actual Windows CI. Keep Bomb rules and other maps unchanged.
