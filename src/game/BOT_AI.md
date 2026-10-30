# BLOCK BUDDIES — Five-star BOT AI

## Existing engine remains authoritative
The AI uses the current A* navigation (`gPath`), `los`, collision `resolve`, weapon registry `WP`, ammo/reload timers, hit logic `fire`, and Bomb Mission plant/defuse rules. No new combat system, network service, ML runtime or external dependency has been added.

## Modules
- `src/game/41-bot-weapons.js`: ammunition, safe reload, sidearm choice, grenade safety and canonical combat dispatch.
- `src/game/87-bomb-tactics.js`: planted-device defense, one-bot dropped-device recovery, site guard/escort/interceptor roles, and Police retake and defuser decisions.
- `src/game/89-bot-tactical-intelligence.js`: shared `BOT_TACTICS` configuration for 5-star difficulty, cover, threat assessment, limited last-seen memory, reload decisions, and retreat.
- `src/game/90-bot-ai.js`: active movement and firing integration. `botsUpdOld` is UNUSED legacy code; do not edit to change gameplay.
- `src/game/85-lobby-and-match.js`: five-star UI and fresh tactical state after bot spawn.

## Behavior
Deathmatch: push visible enemies, pursue only their last-seen coordinates behind walls, patrol different routes, strafe, retreat at low HP, and use actual A*-reachable world geometry to hide.

Bomb: Police spread between site A, site B and patrol until a retake is needed. Terrorists prioritize plant, guard after placement from staggered positions and intercept nearby Police; a single recoverer heads to dropped bomb while other teammates cover its approaches. Original interact radius and victory logic are untouched.

## Performance and testing
Cover candidates must be walkable and break LOS, and are checked against existing A* routes. Both successful and failed cover searches have a cooldown: open arenas cannot cause expensive resampling every frame. The browser bundle is committed; Windows users can simply `git pull` and open `index.html`. Tests: `tests/bot-five-star.test.mjs`.

Heuristic AI is not a neural network. Difficulty values live in `BOT_TACTICS`; avoid duplicating combat stats or map-specific shortcuts.
