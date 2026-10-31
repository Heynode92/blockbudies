# POINT BLOCK — BLOCK LABS

## Scope and source of truth

**Map:** `block-labs`, **mode:** Team Deathmatch only, **size:** 120 × 120 world units (X/Z -60 to +60). This is implemented from the owner's color-coded overhead blueprint: purple north Police Spawn, red south Terrorist Spawn, six large white impassable laboratory structures, gray connecting road/corridor network, orange/brown perimeter and indented walls, four large green corner devices and two smaller central green devices. Indoor high-tech research-facility styling is an implementation interpretation, not a change in the owner's core geometry.

This **adds** a Deathmatch map without replacing original Block District or changing Lockdown/Block Town Bomb Mission, 5v5 roster, respawn shield, weapon tables, HP, aiming, kills, score limit, player inventory or BOT AI policy.

## Source ownership

- `src/game/13-block-labs.js` — **single map source of truth:** exact map ID whitelist and metadata, reference geometry, 6 collidable white lab blocks, 6 green collidable reactors, perimeter and return walls, 10 spawn slots, indoor ceiling and lab architecture. Shared `mk()/wl()/dk()/flushDeco()` Three.js r128 rendering; no external textures, dependencies, or invisible colliders.
- `src/game/11-bomb-map.js` — existing `selectGameMap()` router now also swaps/cache-restores **original Block District / Block Labs** geometry, collider arrays `OB/BR/LT`, sky dome, fog and camera scene; both Bomb maps remain isolated, with `GB=null` pathfinding invalidation.
- `src/game/12-block-town.js` — original `bombMapSpawnYaw()` adds only a TDM branch for Block Labs. For Block District, Lockdown and Block Town the existing yaw policy is preserved.
- `src/game/85-lobby-and-match.js` — canonical `spawnPt()` delegates only **Block Labs TDM** to `labsSpawnPt()`. Existing spawn, death, respawn, Team Deathmatch scoring and game rules remain intact.
- `src/game/83-room-lobby.js` — maps selectable in Create Room and Room Master Settings: TDM **Block District / Block Labs**, Bomb **Lockdown / Block Town**. Whitelisted `mapId`, safe fallback to Block District for unknown or legacy TDM rooms. Room naming remains `textContent`-safe.
- `src/game/84-live-map-preview.js` and `99-render-loop.js` — real indoor lab scene preview from a **below-ceiling** camera. Other maps retain their original overview.
- `src/game/70-kills-and-damage-hud.js` — `begin()` applies room map ID before game start, so the actual canonical 5v5 match loads the chosen scene.
- `tools/source-manifest.json` — ordered module list; `assets/game.js` is regenerated for the user's **file:// index.html** direct-open workflow; no WSL/Docker/npm build on player machines.

## Geometry and player-facing design

| Component | Design |
|---|---|
| Arena | 120 × 120 units with four physical boundary walls |
| Police | North (negative Z) spawn, 5 distinct safe slots; initial yaw faces inner lab lanes |
| Terrorist | South (positive Z) spawn, 5 distinct safe slots; initial yaw faces inner lab lanes |
| White obstacles | Three rows × two columns of tall, physical, inaccessible lab structures |
| Routes | Two wide exterior lanes, a central narrow lane, two horizontal cross-connectors |
| Green objects | Four larger corner research reactors, two small central junction reactors |
| Ceiling | Solid overhead bullet blocker, visual ceiling and lighting, no outdoor sky |
| Art direction | Clean steel-gray floors, white lab panels, blue glass, neon-green research energy, warning yellow rail/striping and Team Spawn colors |
| Geometry model | **All walls, reactor housings and lab rooms have real `OB` collision.** Facade windows, lighting, lettering and pipes are batched visual decoration rather than false passageways |

All physical layout values are located in `BLOCK_LABS_DEF`. No alteration to Bomb Site A/B or Bomb timing occurs.

## QA and release criteria

**Node regression** checks: original TDM and Bomb map isolation; six physical lab blocks; six collidable research devices; full indoor roof and perimeter; every team spawn free of collisions; no unsafe map IDs; correct initial facing; A* availability on the left and right corridors; room Save/Cancel and map ID persistence. Bundled `assets/game.js` must exactly match the ordered source modules.

**Windows Chromium** test harness (`tools/bot-ai-m7-browser.mjs`, separate from player runtime) now covers **both Block Labs factions**. It first opens original game + a **CI-only** bridge and measures a wall-clock TDM WebGL/BOT smoke, then uses canonical production `update(1/60)` for an accelerated BOT-only 5v5 Deathmatch. It requires a genuine match finish, BOT kills, projectile activity, A* movement and zero reported JS exceptions. The automated run must not claim actual laptop FPS or subjective visual certification.

**Status:** source and tests implemented. The latest GitHub CI for the exact commit must be checked before declaring **VERIFIED**. Owner visual feedback on the actual 3D scene may require a follow-up dressing/visibility pass; automatic geometry checks are not a substitute for that.
