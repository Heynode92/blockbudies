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

## Active Room Master lobby (2026-10-30)

CREATE ROOM and OPEN now lead directly to the dedicated `lbroomlive` waiting screen.
Click a team slot to choose Police/Terrorist; the player is the only human participant.
Slot capacity comes from `BOMB_RULES.teamSize` and BOT preview names from `BN`.
AI occupants are clearly marked ON START: only `startMatch()` creates BOTs and all
remaining slots are automatically populated when the game begins.

Room Settings opens an in-room modal; Save Changes updates the current room without leaving the lobby.
Leave Room deletes the Room Master room from localStorage and memory; returning to
main menu and browser pagehide also close an owned room. Room activity is a local
log, not online chat. START MATCH calls existing `begin(roomSide)` and changes the
initial freeze countdown to 3-2-1 while retaining the loadout picker. Following
Bomb Mode round timers, bomb mechanics, AI and weapon settings are unchanged.

Both modes now use `BOMB_RULES.teamSize` for the existing BOT spawn count. UI BOT totals
are calculated from the same setting rather than embedded numeric assumptions.

## Real Inventory soldier preview (2026-10-30)

The active Room Lobby's left panel uses the SAME WebGL soldier preview as Inventory,
not a static SVG. The shared `inventoryPreviewMount` moves the existing renderer
canvas between `ivpreview` and `rmlpreview`, preserving the real `terro(0)`
character, weapon meshes from `mkGun(id)`, animation/IK poses and drag-to-turn.
On room entry/re-entry, `inventoryRoomPreviewOpen` reads the saved, ownership-validated
`inventoryEquipped("main")` selection. This is the Inventory **IN USE** primary
(and updates after player equips a different weapon), not the Inventory catalog
preview pick. The Room panel displays the canonical weapon name and class.
No new renderer, player model, weapon ID mapping, network dependency or gameplay
stat logic is introduced; the preview loop pauses when neither Inventory nor
Room Lobby is visible and maintains the inventory camera separately.

## Room-only 3–2–1, team-synchronized preview and 3D loading (2026-10-30)

Switching between Police and Terrorists now selects each faction's real
`terro(side)` character appearance. Both actors are cached and swap the *same*
Inventory preview renderer/weapon meshes; the `inventoryEquipped("main")` gun
remains in use. Reopening Inventory restores the Police preview.

START MATCH is a guarded, cancelable requestAnimationFrame state machine:
- 3–2–1 is shown only over the Room Lobby before any match initialization.
- Fullscreen transition captures actual WebGL map frames. Loading percentage tracks
  map capture, synchronous match initialization, and first rendered gameplay frame,
  not random percentages or fake requests.
- The original begin() creates maps, BOTs and inventory primary under the opaque
  transition. The old initial in-match countdown is suppressed. Gameplay simulation
  does not run until loading reaches 100% and the fade completes.
- Following Bomb Mode rounds retain their canonical freeze period. The previous
  TDM `mt.t>59.2` check that caused the stuck GO banner is removed.

Leaving/closing a room or page aborts pending countdown/transition callbacks.
No new WebGL renderer, multiplayer server, weapon stat modification or dependency.

The fullscreen loading map is captured immediately after WebGL renders in
`modePreviewDraw()`, not an unrelated rAF that could read a cleared buffer.
Missing map readiness aborts instead of faking a complete load. The 100%
bar is held visibly before the fade starts.

## Room loading → live, timed weapon selection (2026-10-30)

The room pre-match 3–2–1 is the only opening countdown. At match preparation,
the transition captures the exact pre-round weapon-pick duration already assigned
by `startMatch` or `bombStartMatch`, clears `mt.cd` (no duplicate freeze),
and pauses simulation until fullscreen loading is at 100% and faded out.

After fade, `loadoutBeginLiveWindow` enables an independent picker timer in
`77-loadout-picker.js`. Its `wsLiveTime` decrements from `update(dt)`, while
`mt.cd` stays at zero: keyboard movement, simulation, combat and match timer
continue normally. Weapon choice still respects Inventory ownership, hotkeys
1–5, manual confirmation, and auto-confirm on expiry.

The cursor remains available for weapon cards. In the 3D playing field, mouse
hover-aim still works during the live selection window. Hovering over the picker
does not alter aim. Confirming by user click can obtain pointer lock; browser
activation rules prohibit forcing pointer lock at the end of a loading timer.
Standard later Bomb Mode freeze + loadout selection remains unchanged.

## Room Master settings modal (2026-10-30)

The active Room Lobby's **ROOM SETTINGS** button now opens a modal **over the
same lobby**, instead of navigating to the Room Browser's creation/editor view.
The existing Create Room form remains intact for initial room creation.

The modal maintains a separate unsaved draft (room name, game mode, map,
kill limit, match minutes, max rounds, round minutes). Native dropdowns, matching
the existing Create Room controls, populate allowed values exclusively from
`ROOM_LIMITS`. Only the selected mode's two fields are displayed (Kill Limit +
Match Time for TDM; Max Rounds + Round Time for Bomb). Current playable map names,
descriptions and the actual rendered 3D map come from `MODE_MAP_PREVIEWS`
and the existing WebGL preview in `84-live-map-preview.js`.

SAVE CHANGES validates/normalizes with the shared `roomSaveDraft` path,
persists to the same browser-local room record, refreshes the existing Room
Information panel and remains in the room. Cancel, X, Escape and backdrop
click discard draft changes and restore the original 3D map preview. The modal
blocks Start Match while open; leaving a room also closes the popup. The
player's selected Police/Terrorist slot and equipped Inventory weapon are
unchanged by the room-settings modal. The dialog supports keyboard focus,
Escape and Tab cycling and scales to smaller screens.

No multiplayer network, simulated map or new backend is introduced.
