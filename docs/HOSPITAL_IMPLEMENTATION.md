# BLOCK BUDDIES — HOSPITAL (Indoor Bomb Mission)

**Status:** Implemented in source; functional QA pending latest GitHub Actions run.  
**Map ID:** `hospital`  
**Mode:** Bomb Mission / 5v5  
**Footprint:** 160×160 world units (X/Z -80..80), identical to the existing Bomb Mission scale.

## Blueprint geometry correction — exact grey corridor topology (2026-10-31 WIB)

**The latest user-supplied diagram with arrows is the controlling map design.** The previous first-pass coordinates, 14 arbitrary wing blocks and simplistic four-wall bounding square are **superseded**.

Source tracing is based on the original unannotated **632 × 627 px** blueprint plus the later arrow annotation showing intended directions. Its colored geometry has the following meaning, with no exceptions:

- **Grey = all traversable hospital corridors** (including bends, branches, perimeter indents and route connectors).
- **White = impassable full-height room/wing partition masses**. White is never treated as road.
- **Purple = Police starting area**, upper-left. **Red = Terrorist starting area**, lower-right.
- **A = upper-right surgical objective; B = left-center imaging/ward objective**.
- **Black arrows = routes that must remain passable**. They are not walls, decoration or a direction-only travel restriction.

### Implementation changed

- `HOSPITAL_BLUEPRINT.outlinePx` stores **32 ordered corner coordinates** tracing the actual exterior perimeter of the grey connected shape. Each adjacent pair generates a real solid `wl()/OB` boundary segment, preserving the image's distinctive white outside notches. **No fake playable floor outside the outline.**
- `HOSPITAL_BLUEPRINT.roomsPx` contains the actual **eight isolated white rooms**, represented using **10 rectangles** (three are touching parts of the irregular L-shaped room). The world-space `HOSPITAL_DEF.wings` is derived exclusively from the pixel blueprint using `hospitalPxRoom()`.
- `hospitalPxPoint()` provides one central conversion from the screenshot's 632×627 pixel coordinates into the game's **160×160 X/Z** space; map data is not copied as unrelated gameplay constants. White rooms are floor-to-ceiling collision blockers, sharing the project renderer/material pipeline.
- Original Police/Terrorist spawn regions remain. **Site A (67,-43)** stays upper-right; **Site B (-67,3)** is aligned with the left-middle grey junction. Both plant circles remain clear, and all original Bomb rules/timers remain unchanged.
- Twenty hospital-themed collidable props are configured with **pixel-space placements inside the grey region**, offset from the black-arrow centerlines. The last adjustment moved seven objects to corridor edges after a regression caught a blocked waypoint. They remain real `wl()/OB` cover, with no fake solid rooms or invisible path barriers.
- Hospital interior identity (department colors, framed sealed ward panels, clinical window strips, benches/beds/trolleys, ceiling, lighting and department signs) is kept, but **visual dressing cannot replace or reshape the grey corridors**. Indoor roof remains a real registered overhead barrier.

### Acceptance and evidence

- [Windows M0 regression #latest](https://github.com/Heynode92/blockbudies/actions/runs/41198370309) **386/386 PASS**, `assets/game.js` parity PASS; includes tests that 10 known WHITE screenshot pixels are physically blocked, 20 known GREY/arrow pixels are unobstructed, all 32 exterior edges are physical, A/B have free planting circles, all ten spawns have A* access to both sites, and map swaps retain collision isolation.
- The matching **production Chromium** round checks are tracked separately in [Hospital map browser QA](https://github.com/Heynode92/blockbudies/actions/runs/41198370465). Both team jobs must pass before full functional acceptance; software WebGL remains an imperfect proxy for actual owner-side graphics and FPS.
- The user is correct that a prior green synthetic test did not prove blueprint fidelity. This new regression explicitly tests fidelity to the annotated corridors, not only generic navigability.

## Historical initial blueprint interpretation (superseded)

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

- New map-only `src/game/14-hospital.js` defines `HOSPITAL_DEF`: palettes, 10 room-piece collision rectangles (eight white room islands) approximating the blueprint, 20 themed cover fixtures, spawn slots, medical department colors and interior preview.
- Shared existing Three.js r128 helpers `mk()`, `wl()`, `dk()`, `shade()/lite()` and `flushDeco()`; **no image CDN, external assets, texture downloads or player-side dependencies added**.
- Each large white wing uses a real `wl()` physical collision body and distinct sealed clinical façade: observation windows, departmental color bars, door labels, corner trims, service conduits and continuous wall rails. The large white blocks are never falsely depicted as open doors.
- Medical cover variety comes from **physical** nurse-station counters, triage/reception desks, hospital beds, stretchers, linen storage, medical consoles, an imaging-machine base, benches, utility racks and wheelchairs. Every cover body is registered in canonical `OB` for the player, shots and BOT A*; trim/glass/lights are visual details only.
- Indoor ceiling is visible and also registered as a projectile blocker in canonical `LT` at approximately Y=11.5. Ceiling light panels, floor department guide lines and overhead signs are distinct 3D details. Outdoor sky/cloud meshes are hidden in Hospital and restored on map change.
- Map-owned fog, lighting palette and indoor preview below the roof. No coplanar checkerboard floors; floor guide strips render above the underlying seamless floor plane.
- **32 contour-derived physical perimeter segments** enclose the world. The map keeps the existing scoreboard, round settings, Bomb timing, damage tables, matchmaking and AI tactical policies untouched.

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

## Recorded QA evidence — October 31, 2026

- [Windows Node regression #334](https://github.com/Heynode92/blockbudies/actions/runs/41194683332) validated the final playable source and department-signage bundle `351f779e8bbe36f51351949be5edc4ded414cffe`: **385/385 Node tests PASS**, generated bundle parity **PASS**, JavaScript syntax **PASS**. This includes both Hospital physical and Room Master persistence tests.
- [Windows Chromium #66](https://github.com/Heynode92/blockbudies/actions/runs/41194482293) validated the first playable Hospital gameplay bundle before the subsequent **visual-only department signage** was added: **Hospital Police SUCCESS 10/10 canonical Bomb rounds** (5 Police wins / 5 Terrorist wins, planted-at-finish A 6 / B 0), **Hospital Terrorist SUCCESS 10/10** (0 Police wins / 10 Terrorist wins, planted-at-finish A 10 / B 0). Both jobs recorded **zero JavaScript exceptions** and passed the physical Hospital spawn/room/roof/collider/A* checks. This is functional simulation, not player-hardware FPS or subjective visual confirmation.
- **Remaining visual-only final-browser check:** the latest [Chromium #68](https://github.com/Heynode92/blockbudies/actions/runs/41194683334) corresponds to the package containing the department signage. Its status must be checked independently; do **not** claim #66 ran against the signage change.
- **Map balance observation:** B is physically plantable and all spawn-to-B A* routes pass, but the 20-round sampled outcomes in #66 all occurred at A. These data do not yet demonstrate balanced A/B tactical selection. This is not sufficient reason to edit Bomb tactical code or alter the owner's map layout.

**Conclusion:** Hospital indoor map is implemented and source/bundle/node-verified. First-playable browser functional QA for both factions passed. Final signage build awaits matching browser evidence and the visual aesthetic should be checked on the user's Windows renderer.

