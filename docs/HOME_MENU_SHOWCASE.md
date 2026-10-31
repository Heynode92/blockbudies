# BLOCK BUDDIES — Home Menu Gameplay Showcase

**Date:** 2026-10-31 (WIB)
**Scope:** main Home Menu `#lbs` ONLY. This is a presentation/UI feature, not a gameplay or map modification.

## Source of truth and assets

User-supplied, committed 1920×1080 gameplay clips:

| Mode | Exact committed path | Size |
|---|---|---:|
| Deathmatch | `src/assets/video/deatch_match_demo.mp4` | 21,266,877 bytes |
| Bomb Mission | `src/assets/video/bomb_mission_demo.mp4` | 8,482,000 bytes |

**Do not silently rename `deatch_match_demo.mp4`:** spelling deliberately follows the actual committed filename; the video module refers to that literal local relative URL. Videos are bundled as repository files, **not inlined in `assets/game.js`**, transcoded, uploaded to external servers or imported from untrusted CDNs.

## Screen composition

- The world background remains the **real animated Three.js Block District scene**, as defined by the original `src/game/10-world.js` and `src/game/99-render-loop.js`. No static replacement background; no second WebGL renderer, fake scene, altered bots, moved buildings, or network stream.
- The left branding panel retains BLOCK BUDDIES, FPS, Personal Best, and original messaging while introducing a cinematic 16:9 gameplay showcase with a true HTML5 video element. Tabs switch between Deathmatch and Bomb Mission.
- The right panel continues to use the original functional START, INVENTORY, SHOP, LEADERBOARD and SETTINGS buttons, with game-styled orange/navy surface treatment and responsive layouts for different resolutions.
- The user can pause or play the video and toggle audio. **Autoplay begins muted** to match browser autoplay security policy and avoid unexpected sound. Sources are whitelisted in `HOME_DEMOS` and cannot be sourced from arbitrary strings.
- The video is paused when the Home Menu is not visible (Room Lobby, Inventory, Shop, gameplay, etc.) or `document.hidden`; returning to the Home Menu resumes the current selection when the browser permits. Errors display an honest fallback. The source asset stays a local relative `file://`-compatible resource.
- Entering the Home Menu restores **Block District** from the actual game map selector even when previously previewing Bomb Mode or Block Labs. The original map/gameplay systems remain the only source of truth.

## Implementation ownership

- `index.html` — video and controls markup only inside the original `#lbs` screen.
- `src/styles/04-lobby.css` — desktop, responsive/mobile, reduced-motion-friendly homepage styles, all scoped to `#lbs`.
- `src/game/82-home-showcase.js` — local media selection, play/pause, sound, visibility, error handling. No new remote endpoints or render loops.
- `src/game/85-lobby-and-match.js` — Home Menu page lifecycle and original Block District restoration; no gameplay rules edited.
- `tools/source-manifest.json` — includes the module in the canonical order before the Room Lobby; `assets/game.js` remains directly openable on Windows.

## QA

[Windows regression #355](https://github.com/Heynode92/blockbudies/actions/runs/41200372925): **390/390 tests PASS**, including the new `tests/home-showcase.test.mjs` fixture validating local video file presence, MP4 container headers, URL whitelist, default mute, tab switching, pause/resume across menu/hidden-tab/gameplay, fallback state, and exact source-to-standalone-bundle parity.

This proves source and functional presentation contracts, **not subjective visual perfection or a measured GPU/decoder performance budget**. Chromium browser-matrix run [#78](https://github.com/Heynode92/blockbudies/actions/runs/41200373017) is tracked independently; a video may require an appropriate MP4 codec in the user's browser to play. Renderer/WebGL remains active behind the menu, so hardware performance should be checked on the actual device.

**User workflow:** `git pull origin main`, close the previous browser tab, open `index.html`. No local build runner, Docker, WSL or npm dependency changes.
