# BLOCK BUDDIES — Five-star BOT AI

> **Current implementation reference.** For the future top-tier BOT modernization requirements, read [BOT AI Master Plan](../../docs/BOT_AI_MASTER_PLAN.md) and [BOT AI Implementation Log](../../docs/BOT_AI_IMPLEMENTATION_LOG.md). **M0 baseline VERIFIED; M1 perception IMPLEMENTED and automated tests PASS**, with manual Windows browser validation pending. See [M1 Validation](../../docs/BOT_AI_M1_VALIDATION.md). M2–M7 remain future enhancements. An existing five-star difficulty label is a configuration/UI value, not a validated competitive-bot benchmark.

## Existing engine remains authoritative
The AI uses the current A* navigation (`gPath`), `los`, collision `resolve`, weapon registry `WP`, ammo/reload timers, hit logic `fire`, and Bomb Mission plant/defuse rules. No new combat system, network service, ML runtime or external dependency has been added.

## Modules
- `src/game/88-bot-perception.js`: M1 evidence-only sight, 3.6s finite target memory, 2.4s legitimate team radio, bounded footstep/gunshot hearing, stale-information expiry, and match reset.

- `src/game/41-bot-weapons.js`: ammunition, safe reload, sidearm choice, grenade safety and canonical combat dispatch.
- `src/game/87-bomb-tactics.js`: planted-device defense, one-bot dropped-device recovery, site guard/escort/interceptor roles, and Police retake and defuser decisions.
- `src/game/89-bot-tactical-intelligence.js`: shared `BOT_TACTICS` configuration for 5-star difficulty, cover, threat assessment, limited last-seen memory, reload decisions, and retreat.
- `src/game/90-bot-ai.js`: active movement and firing integration. `botsUpdOld` is UNUSED legacy code; do not edit to change gameplay.
- `src/game/85-lobby-and-match.js`: five-star UI and fresh tactical state after bot spawn.

## Behavior
Deathmatch: engage currently observed enemies only; investigate recent personal sightings, valid team radio and short-lived sound cues without following invisible live coordinates. Existing A* patrol, strafe, retreat and cover remain authoritative.

Bomb: Police spread between sites and retake after planting; Terrorists plant, guard and recover the dropped device. Enemy chase goals now derive from timestamped observed/radio/acoustic positional clues, never hidden live enemy coordinates. Existing objective timings and scoring remain unchanged. Original interact radius and victory logic are untouched.

## Performance and testing
Cover candidates must be walkable and break LOS, and are checked against existing A* routes. Both successful and failed cover searches have a cooldown: open arenas cannot cause expensive resampling every frame. The browser bundle is committed; Windows users can simply `git pull` and open `index.html`. Tests: `tests/bot-five-star.test.mjs`.

Heuristic AI is not a neural network. Difficulty values live in `BOT_TACTICS`; avoid duplicating combat stats or map-specific shortcuts.
