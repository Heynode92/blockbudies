# HOSPITAL — Authoritative Owner-Blueprint Map Specification

**Map ID:** `hospital`
**Game mode:** Bomb Mission only
**Current implementation:** Blueprint-corrected layout, 2026-10-31
**Playable scale:** 160 × 160 Three.js world units, X/Z in [-80,80]
**Active source:** `src/game/14-hospital.js`
**Direct-open artifact:** `assets/game.js`
**Source of truth:** the owner's original 632×627 pixel diagram, clarified by the second diagram with black arrows.

## Meaning of every blueprint color

- **Gray:** real traversable hospital corridors, intersections, loops and connecting hallways.
- **White:** impassable hospital wing / room partitions. These shapes are solid full-height walls, not playable floor.
- **Purple at top-left:** Police spawn room.
- **Red at bottom-right:** Terrorist spawn room.
- **A at upper-right:** surgical/operating Bomb Site A.
- **B at left-middle:** ward/radiology Bomb Site B.
- **Black arrows:** pathways that must stay connected and unobstructed in both directions. They do not represent walls or one-way player movement.

These meanings replace all guesses made in the initial Hospital implementation. Do not return to the old 14 generic box layout.

## One-to-one geometry mapping

`HOSPITAL_BLUEPRINT.width=632` and `height=627`. All architectural measurements are defined relative to these pixel coordinates, then translated through `hospitalPxPoint()` into 160×160 world space. There is no independent second handwritten "visual version" that can disagree with the physical map.

- `outlinePx` (32 ordered vertices) describes the full irregular **outer edge of the walkable gray corridor network**, including top, left, right and bottom steps/notches. Each edge generates a real `wl()` collision wall in the normal `OB` array.
- `roomsPx` describes the **eight internal white room islands**, decomposed into **10 rectangular parts** so the irregular lower-left L-shaped room is preserved. Each part is converted to a full-height physical wing.
- There is a single continuous vinyl gray floor at ground level, an indoor ceiling with registered `LT` collision, and illuminated clinical wall panels. Space outside the drawn gray outline is **not** playable, despite the bounding 160×160 floor/ceiling being rectangular.
- `HOSPITAL_DEF.furniture` contains **20 themed hospital props** derived from pixel-space placements in the gray corridor area, with seven objects shifted toward the hallway edges to preserve the arrow-marked centerline routes. Each gameplay-scale prop uses `wl()` collision; nonblocking signs/glass accents use the engine's batched decoration system.

### Spawn and objective anchors

| Item | Location | Meaning |
|---|---|---|
| Police | Five safe slots near (-68,-67) | Upper-left purple room |
| Terrorist | Five safe slots near (69,73) | Lower-right red room |
| Site A | (67,-43) | Upper-right operating wing |
| Site B | (-67,3) | Left-middle imaging/ward wing |

Site radius remains the canonical `BOMB_RULES.siteRadius`. No Bomb timings, round resolution, weapon damage, team composition or BOT tactical policy were changed.

## Appearance and production architecture

Hospital remains an **indoor modern clinical complex**, not a row of generic white cubes. The room boundaries have distinct medical department color bands, recessed observation glazing, sealed service-door facades, wall guards, rail/pipe trim and wayfinding signs. Shared materials and geometry use existing `mk()/wl()/dk()/flushDeco()` primitives and Three.js, with no new external assets or dependencies. The interior also includes nurse stations, hospital beds, stretchers, clinical cabinets, wheelchairs, imaging equipment, waiting benches, overhead departmental signage and luminous ceiling panels.

The styling never overrides the owner-drawn corridor footprint. Do not add floor-height decoration to a gray hallway without confirming all arrow-route clearances.

## Other map isolation

`src/game/11-bomb-map.js` chooses Hospital via the existing `selectGameMap()` registry; `src/game/12-block-town.js` holds the Hospital map ID, site anchors and preview metadata. Hospital scene geometry and `OB/BR/LT` snapshots are cached independently and hidden during Lockdown, Block Town, Block District and Block Labs. Existing gameplay and map selection in Room Master remain unchanged except that Hospital is a selectable Bomb Mission map.

## Regression and browser acceptance — October 31, 2026

- [Windows Node regression #343](https://github.com/Heynode92/blockbudies/actions/runs/41198370309): **386/386 PASS**, canonical JS syntax and `assets/game.js` source-manifest parity PASS.
- These Node tests check 32 physical outline walls, 10 white collision pieces, **10 representative white screenshot samples blocked**, **20 gray/arrow samples free**, both planted-site circles free, every spawn slot free, all 20 spawn-to-site A* paths, zero opposing spawn direct LOS, hospital roof collision and correct multi-map snapshot isolation.
- [Windows Chromium Hospital checks #74](https://github.com/Heynode92/blockbudies/actions/runs/41198370465), on the exact gameplay bundle commit `ba77e5d069cd8ceb35a02e4240f22c3ba6571d69`: **Hospital Police SUCCESS, 10/10 genuine Bomb rounds, zero JS exceptions** (Police wins 6, Terrorist wins 4, planted-at-finish Site B 5 / Site A 0). **Hospital Terrorist SUCCESS, 10/10 Bomb rounds, zero JS exceptions** (Police wins 5, Terrorist wins 5, planted-at-finish Site B 7 / Site A 0). This is **20 total completed rounds on the corrected hospital layout**.
- The two Hospital jobs individually passed; **do not interpret that as success of unrelated Lockdown, Block Town or Block Labs jobs in the same matrix**. Both A and B are physically accessible and plantable, but the small sampled CI outcomes happened to use only B; final objective-choice balance is a distinct issue.
- Chromium SwiftShader accelerated simulation validates functionality, **not the owner's real Windows GPU frame rate, aesthetic approval, or a mathematical proof of equal Bomb Site use**.

**Status:** OWNER-BLUEPRINT CORRIDOR FIDELITY + NODE REGRESSION VERIFIED, HOSPITAL BROWSER FUNCTIONAL QA VERIFIED. Final subjective visual sign-off and hardware FPS not yet certified.
