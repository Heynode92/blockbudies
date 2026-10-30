# BLOCK BUDDIES — Room Lobby (Local MVP)

The main menu's **START** button opens the new two-panel **Room Lobby** instead of the previous Select Mode screen. The left panel lists rooms created and saved in the **current browser**; the right panel creates/edits rooms, presents a real live map preview and provides Room Master controls.

## Boundaries: local play, not online multiplayer

This repository ships a static file-based Three.js game launched directly from `index.html`; it does not currently have a multiplayer room server, authentication, WebSocket lobby directory, matchmaking, or player-to-player state sync. Consequently, rooms are **local saved match presets** and the original **1 human + 9 BOT** 5v5 engine remains authoritative. No public room records, network ping metrics, fake player occupants, or cross-browser join claims are rendered. Persisted room names are always inserted via `textContent` to prevent HTML/script injection.

Room creation, opening, editing, starting and closing are handled by `src/game/83-room-lobby.js`, with input validation centralized in `ROOM_LIMITS`; storage uses `bbfps_local_rooms_v1`, and failure to access localStorage degrades to memory-only.

## Room Master configuration

- **Team Death Match / Block District:** team kill limit (20, 30, 50, 75, 100), match duration (1, 3, 5, 10, 15 minutes). A match ends when either team reaches the configured total or the timer expires; existing team scoring and damage remain unchanged.
- **Bomb Mode / Lockdown:** maximum rounds (3, 5, 7, 9, 12), round duration (1, 2, 3, 4 minutes). Rounds-to-win is a majority of max rounds. The original plant/defuse timing, bomb fuse, sites and round transition remain unchanged.
- Both modes use the **only currently implemented maps**. The map selection displays the actual map and is disabled until more genuine playable maps are implemented.
- After **CREATE ROOM**, the creator is Room Master and can **SAVE SETTINGS**, **CLOSE ROOM**, or **START MATCH**, which opens the original Police/Terrorist team-selection screen.

## Source integration and regression

The UI is in `index.html`, CSS in `src/styles/04-lobby.css`, state controller in `src/game/83-room-lobby.js`, real WebGL preview in `src/game/84-live-map-preview.js`. Existing match timer / round handling is adjusted in `src/game/85-lobby-and-match.js`, `src/game/86-bomb-mission.js` and `src/game/95-simulation.js` with bounded room-setting accessors (the legacy defaults remain if no room is active).

`tests/room-lobby.test.mjs` covers create/open/save/close, local storage validation, XSS-safe name rendering, TDM/Bomb rules, startup module ordering and bundle parity. Continue committing `assets/game.js` whenever game sources change so Windows players only need `git pull` and `index.html`.
