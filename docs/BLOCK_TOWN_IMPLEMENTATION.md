# BLOCK BUDDIES — BLOCK TOWN (Bomb Mission Outdoor Map)

**Implementation date:** 2026-10-31 WIB
**Map identifier:** \`block-town\`
**Existing map preserved:** \`lockdown\` (unchanged indoor maze)
**Source of truth:** the owner-provided top-down outdoor Town blueprint and subsequent explicit instruction **Police Spawn di A**.
**Scope:** new Bomb map only; do not change Team Deathmatch, weapon balance, Bomb timers, scoring or M0–M6 BOT policy.

## BLOCK TOWN V3 — latest authoritative owner's blueprint (2026-10-31 WIB)

**THIS V3 IS THE CURRENT MAP SOURCE OF TRUTH. The V1/V2 location descriptions retained below are historical and superseded.** The user-supplied second top-down blueprint replaces the first layout, while retaining the same existing **160 × 160** Bomb Mission playable bounds, original Three.js material helpers, and all standard Bomb rules.

| Anchor | New X/Z coordinates | Blueprint color/location |
|---|---|---|
| **Police spawn** | **(-72,-55) to (-72,-31)** (5 discrete slots) | **Purple**, upper-left/west street |
| **Terrorist spawn** | **(45,70), (50,74), (45,75), (61,70), (59,75)** | **Red**, lower-right/south-east |
| **A Site** | **(55,-58)** | Upper-right/north-east commercial courtyard |
| **B Site** | **(-16,8)** | Central-lower service junction |

**Layout:** white solids are actual impassable 3D town buildings and walls, NOT open buildings: 15 asymmetric block masses including the west-north L-shaped compound (constructed from two adjoining solids), irregular blocks at mid and south, narrow offset lanes, and cross-streets. Gray in blueprint remains walkable road; the outer scene retains the four collision-registered perimeter walls and skyline. Landmark palettes and rooflines use the existing source-owned `BLOCK_TOWN_DEF.palette` and builder's six facade variants, rather than an ad hoc white-box visual pass.

**Anti-long-range face-to-face:** site-specific hard cover islands are registered via `wl()/OB`, including **15 street covers**, **6 segmented brick/metal walls**, a **physically solid A-area delivery van**, and a **physically solid B-side service kiosk**. Additional tree trunks and one small fountain/pedestal are also registered solids. Both landmark shapes are in `BLOCK_TOWN_DEF.landmarks`; the runtime does not create fake visual-only ground obstacles. This gives players cover for peeking, rotating and clearing corners and provides actual LOS/nav collision for BOT AI. Paving rectangles are configured to be disjoint and drawn at separate vertical elevations from the base floor and paint to avoid z-fighting; four perimeter walls remain in place.

**Spawn viewing direction:** `BLOCK_TOWN_DEF.spawnLook` now provides inward tactical waypoint coordinates (Police towards west-north exit, Terrorist towards the northbound approach). The global `bombMapSpawnYaw()` remains canonical and returns exactly the previous facing for all other maps. There is no direct Police/Terrorist spawn-to-spawn visible path in the V3 geometric LOS model. The BOT A* route model must reach both Bomb Sites from all ten spawn slots.

**Historical correspondence:** Purple and red correspond to Police and Terrorist respectively, consistent with the player's earlier team-color assignments. White map shapes represent large solid buildings, *not* individual rooms with doorways. Street props and facades are deliberately secondary to the owner-drawn road/block shapes. The old Police-by-Site-A design and old A/B world coordinates are no longer active.

**Release gates:** `tests/bomb-mission.test.mjs` asserts the new site/spawn anchors, site radius clearance, every spawn pair occlusion, every spawn-to-site A* route, solid physical cover including the van/kiosk, zero overlapping paving regions, four perimeter walls, cached map isolation, and unchanged Lockdown and TDM. The CI browser bridge also checks updated map site coordinates, spawn regions, four boundary collision bodies, and actual BOT behavior. **No automatic functional or performance success may be claimed until the latest Windows CI actually completes**. Automated checks do not establish subjective visual appearance or complete competitive balance; no user manual playtest is required for the CI functional checks.

---

## Historical V1 design and scale (superseded by V3)

The map uses the exact **160×160 world-unit** Bomb arena footprint (\`BOMB_RULES.cellSize * BOMB_RULES.cells = 10 * 16\`; \`A=80\`, X/Z horizontal and Y vertical). It is a **single-level outdoor town** with varied asymmetrical residential/shop building blocks, paved market courtyard A, delivery courtyard B, central town junction, bent A lane, offset B lane and multiple connectors. It is **not** the previous symmetrical box-grid mockup and is **not** claimed to reproduce all photographic architectural details of the reference image.

| Anchor | Source-owned x,z | Gameplay |
|---|---|---|
| **Police Spawn (A-side)** | positions near **(-61,-54)** to **(-70,-63)** | A-side defending courtyard, **not** across the map from Site A |
| **Terrorist Spawn (south-west)** | positions near **(-38,64)** to **(-47,75)** | attack via offset west lane, mid and east approach |
| Site A | **(-44,-39)** | market courtyard; existing 5-second plant action |
| Site B | **(49,-37)** | delivery courtyard; existing 7-second defuse action |

Spawn points are predeclared, individually validated against physical colliders and occupied in a non-repeating local round selection. All 25 opposing spawn-pair segments are intentionally obstructed by registered solids; the team's start areas are not face-to-face with direct shots.

## Architecture and visuals

- \`src/game/12-block-town.js\`: map registry, strict ID whitelist, map-local material palette, all structures, collision-level cover/barriers, spawns, site definitions, preview camera and outdoor Three.js generator. Data-driven config avoids scattering map magic coordinates and palette values across gameplay, lobby and HUD modules.
- **Reuse canonical engine primitives:** \`mk()\`, \`wl()\`, \`dk()\`, \`flushDeco()\`, \`shade()\`, \`lite()\`, \`cBox()\`, \`cBar()\`. Visual-only details use original batched decoration system; hard blocking architecture uses \`wl()/OB\`, so bullets, player collision and BOT A* agree. Buildings are closed outdoor silhouettes, not falsely enterable.
- \`src/game/11-bomb-map.js\`: retain Lockdown \`makeBombMap()\` and previous indoor data unmodified. \`selectGameMap()\` chooses the active cached geometry/collision snapshots for **Town**, **Lockdown** or **TDM**, resets \`GB\`, and restores correct active bomb site coordinates and fog/sky; other maps stay hidden.
- \`src/game/83-room-lobby.js\`: Room Master Create and Settings choose a strictly whitelisted \`mapId\` persisted in existing browser-local room records. Old room records lacking \`mapId\` default to Lockdown. Unknown map IDs fall back safely. TDM remains single-map Block District.
- \`src/game/84-live-map-preview.js\`, \`99-render-loop.js\`: select the real 3D preview and outdoor map camera when a room changes. \`index.html\` and \`src/styles/04-lobby.css\` provide correctly styled Create Room and Room Master map selectors.
- \`src/game/70-kills-and-damage-hud.js\`: use the chosen room map during canonical \`begin()\` before \`startMatch()\`; default direct-launch Bomb remains Lockdown.
- \`tools/source-manifest.json\` and regenerated \`assets/game.js\` remain the only direct-open build pipeline; **no local npm, WSL, Docker, backend or runner installation for players**.

## Visual correction v2 — surface flicker and urban detail (2026-10-31 WIB)

Owner gameplay captures revealed repetitive near-identical rectangular facades, excessive tiled/grid lines across streets and shimmering overlapping surfaces. The original V1 source actually had **two overlapping coplanar A-side pavement rectangles** and the original TDM grid was a Three.js `GridHelper` (`LineSegments`), which may not satisfy the `isMesh`/nonstandard `isGridHelper` checks used by the Bomb map visibility filter.

**Code fixes (no weapon/timer/BOT AI changes):**
- `src/game/11-bomb-map.js` explicitly hides the original `GridHelper` by `type==="GridHelper"` while any Bomb map is active and restores it on TDM return.
- `src/game/12-block-town.js` now keeps disjoint paving rectangles in `BLOCK_TOWN_DEF.paving` and assigns separate ground heights to foundation, paving, road markings and Bomb ring. No old A-side overlap or town-wide graph-paper grid. Paving is visual-only and never inserts invisible path blockers.
- Distinct real-building **solid collider footprints are unchanged**, while the shared batching/material helpers provide six visual archetypes: storefront/shutters, pitched-roof residence, industrial warehouse, parapet office, cafe/shopfront and rowhouse. Includes varied trims, rooflines, window depth separation, awnings, shutters, shop plaques, downpipes and realistic town-oriented palettes.
- Existing collision cover positions **and heights** are unchanged (2.4-unit crate-height obstacles and 1.3-unit low barricades). They now render as stacked delivery crates, urban planters, tall equipment cabinets or stone traffic barricades with **one grounded `wl()` collider each**. Duplicate trim geometry is forbidden to avoid local surface shimmer. Tree trunks, solid walls, site centers, all ten spawn points and Town/Lockdown map-switch semantics are preserved.
- New Node regression explicitly checks all paving rectangles for X/Z overlap at one depth plane, hides/restores legacy TDM GridHelper during map transitions, checks presence of batched architectural detail, matching original cover widths/depths/heights and solid collision cover.

**Evidence:** [Windows regression #256](https://github.com/Heynode92/blockbudies/actions/runs/41187629635) **376/376 Node tests PASS**, standalone build parity and syntax PASS. The map-aware Chromium round QA run [#25](https://github.com/Heynode92/blockbudies/actions/runs/41187608474) was still running when this change was recorded. Green synthetic/browser functional tests do not substitute for owner-side visual verification of the previous flicker on actual hardware.

## Safety and validation gates

**Existing Windows regression:** [CI #247](https://github.com/Heynode92/blockbudies/actions/runs/41186755439) **375/375 Node tests PASS**, generated bundle parity PASS, syntax PASS. The original suite was updated to load the canonical new map module in VM test fixtures instead of weakening Lockdown assertions. Added two new map-specific tests: outdoor 160×160 scale, Police-A spawn placement, valid A/B sites, all five spawn slots per faction, every Police/Terrorist spawn sightline blocked, canonical A* route availability and multi-map collider/snapshot isolation; plus Room Master map switching, persistence, Cancel/Save and invalid map ID fallback.

**Windows browser QA:** \`.github/workflows/bot-ai-m7-browser.yml\` now runs a map-aware matrix: Lockdown **50 Bomb finishes/team** (retained existing release-level automation) and Block Town **10 Bomb finishes/team** for new map integration, with 12-second live software-WebGL startup smoke per mode/faction. Browser QA uses temporary CI-only copies and does not inject test APIs into the player's shipped bundle. Results are accelerated **functional** evidence only; software WebGL does not certify real-time FPS on owner hardware.

**Acceptance rules before marking Block Town browser-verified:** both Town Chromium jobs must pass; no runtime exception; all 10+10 canonical Bomb rounds must complete; zero invalid spawn / direct-spawn LOS / path-to-sites errors; Lockdown jobs must continue to pass, and \`assets/game.js\` must remain byte-for-byte parity with manifest. All other M7 Final Release performance and quantitative acceptance requirements remain separately open.

**Browser evidence on [M7 map matrix #21](https://github.com/Heynode92/blockbudies/actions/runs/41186755403):** Both **Block Town** Windows Chromium jobs individually completed **SUCCESS**, each with **10/10 authoritative Bomb round finishes** and **0 reported browser JavaScript errors**. Police-player-slot scenario: Police 6 / Terrorist 4 wins, planted-at-finish 4 (Site A 2, B 2). Terrorist-player-slot scenario: Police 8 / Terrorist 2 wins, planted-at-finish 3 (Site A 0, B 3). Both passed the pre-match live-map validation of ten spawn coordinates, all 25 opposing-team start sightlines, A/B plant-center clearance and A* paths between every team spawn and both sites. This is **accelerated functional coverage**, not proof of map balance; it includes a small sample where Police won more rounds. The two separate 50-round Lockdown jobs in the same run were still in progress at the time of this document checkpoint.

**Status:** IMPLEMENTED; **NODE REGRESSION VERIFIED (375/375 PASS)**; **BLOCK TOWN BROWSER FUNCTIONAL SMOKE VERIFIED (10/10 per team)**. Full combined matrix #21 status needs the separate Lockdown jobs to conclude. CI software WebGL performance remains **NOT_CERTIFIED** due unpaired, insufficient frame sampling; no competitive map balance, full performance release, or M7 FINAL approval is claimed.

## Spawn boundary and camera-direction correction (2026-10-31 WIB)

An owner-provided live gameplay capture showed the **Police A-side spawn initially staring across a bare road into the open sky**, with no visible outer world wall. This was a source bug, not a gameplay preference: `src/game/00-bootstrap.js` creates four original Deathmatch perimeter `mk()` meshes at `A+0.5`, but `selectGameMap(true)` deliberately hides the original Deathmatch `BOMB_CITY` scene. Block Town V2 did not create replacement walls. Separately, `startMatch()` and `placeBot()` always used the old team-facing convention (Police `Math.PI`, Terrorist `0`), so a Police A-side spawn at negative Z was looking directly **outward** toward the southern boundary.

**Corrective implementation (map-specific and data-driven):**
- In `src/game/12-block-town.js`, `BLOCK_TOWN_DEF.perimeter` declares wall height, thickness, palette and skyline spacing. `makeBlockTown()` now creates **four visible, grounded `wl()` perimeter walls** at the 160×160 Bomb arena edges, reusing the engine's normal material and `OB` bullet/player/BOT collision registration. Wall inner faces sit just outside the playable ±80 bounds, leaving BOT routes, A and B sites and the five player spawn slots per team unchanged. The walls are cached in `BLOCK_TOWN_WORLD` and hidden during Lockdown/TDM just like the rest of Town.
- The physical shell is backed by spaced, varying-height **town-building silhouettes beyond the outside face**, using the same Block Town palette and `mk()/dk()` visuals. These provide skyline depth behind the solid walls without creating fake interior collision.
- `BLOCK_TOWN_DEF.spawnLook` owns the tactical target choice: Police looks toward **Site A** from the A-side courtyard, Terrorists look inward toward a mid approach. `bombMapSpawnYaw(team,x,z)` derives yaw with `Math.atan2(Δx,Δz)`, matching the source-of-truth engine forward vector `(sin(face),cos(face))`. `startMatch()`, `placeBot()` and `respawnPl()` call this helper, which **returns the exact existing yaw** for Lockdown and Deathmatch.
- Added Node regression assertions checking **four physically registered visible perimeter walls**, skyline beyond the arena, correct visibility and collision restoration across Town/Lockdown/TDM, non-colliding spawns and **inward yaw for all 10 spawn candidates**. The Windows Chromium QA bridge also rejects missing Town perimeter bodies or outward camera-facing yaw before accepting a Bomb functional run.
- **Gameplay invariant:** no changes to `BOMB_RULES`, timing, damage, weapons, objectives, scoring, A/B positions, building/cover footprints, or authoritative BOT targeting/pathfinding algorithms. Only Block Town shell collision and spawn presentation are added.

**Evidence:** [Windows regression #268](https://github.com/Heynode92/blockbudies/actions/runs/41188395034) passed on the rebuilt runtime before the additional orientation/perimeter-specific tests were committed. The dedicated latest map-boundary acceptance must use the subsequent Windows run and its actual results; previous regression green status is not enough to certify the full new tests. SwiftShader CI does not guarantee identical laptop FPS or visual appeal; player screenshot verification remains the final visual check.

**Post-fix live-browser acceptance:** [Windows Chromium map QA #33](https://github.com/Heynode92/blockbudies/actions/runs/41188457444), using the patched runtime `7800dde697e1c638791afc6cef8b727a1f48cccb`, completed **SUCCESS in BOTH Block Town jobs**, with **10/10 authentic finished Bomb rounds per faction** and **zero reported JS errors**. Police-slot run: Police 7 / Terrorist 3, planted-at-finish 4 (Site A 4, Site B 0). Terrorist-slot run: Police 5 / Terrorist 5, planted-at-finish 4. The pre-match QA assertions verified the four new collision-registered boundaries and all spawn view directions in the real browser. **Separate Lockdown 50-round jobs were still in progress during this checkpoint; the overall workflow status must not be called green until those also conclude.** Node regression [#270](https://github.com/Heynode92/blockbudies/actions/runs/41188457572) **378/378 PASS**, direct-open bundle parity verified; docs-only follow-up [#272](https://github.com/Heynode92/blockbudies/actions/runs/41188594697) also **SUCCESS**. This is automated functionality, **not** evidence that all actual viewport angles or GPU performance are visually optimal on user hardware.

## Maintainer constraints

Do not modify \`BOMB_RULES\`, \`BOMB_AI\`, canonical weapon tables or M0–M6 tactical logic to force map success. If BOTs cannot reach a route, fix actual physical paths and registered obstacles. Do not add fake collisionless doorways or invisible solid furniture. Do not make changes to Lockdown geometry/spawns during Town work. Keep all map identifiers whitelisted, room names DOM-safe, and map-specific data in the map module. Every change to gameplay-related sources requires an updated \`assets/game.js\` via the existing build parity contract.
