# BLOCK BUDDIES — Tactical Footstep Audio

## Implementation

`src/game/66-footsteps.js` provides spatialized Web Audio footsteps using the existing `AC` context and `SND` setting. No sound files or external dependencies are downloaded. Contact sounds are synthesized on first use, with **three cached samples per surface** (15 samples total).

- **Outdoor concrete:** bright, compact boot contact
- **Asphalt road:** lower, damped scrape
- **Building interior:** reinforced indoor shoe impact
- **Metal walkways or roofs:** sharper impact and short resonance
- **Indoor tile:** crisp, slightly brighter footfalls

The City map uses its actual road strips, building footprints and elevated surfaces. The indoor Bomb Mode map uses the four pre-existing SECURITY/WAREHOUSE/REACTOR/LABORATORY floor zones. These labels describe audio material approximations; they do not modify physical world meshes or collision.

## Tactical hearing

- **24 world-unit radius** (hard cutoff); 2.2-unit reference distance and inverse rolloff 1.35
- Web Audio `PannerNode` with `panningModel="HRTF"`, updating listener position and heading from the actual world camera every rendered frame
- On obstruction by the existing `los()` function, sound becomes muffled via a 920 Hz low-pass and approximately half source volume
- Friendlies and enemies follow the same rules; the audio system does not expose team identity
- Player own footsteps are centered, kept softer than close-by characters, and generated from actual movement
- Maximum 16 overlapping footstep voices; short sounds and shared audio buffers avoid permanent nodes/memory accumulation

## Lifecycle and audio security

`footstepAdvance` is invoked only after the collision-adjusted movement delta is known. There are no footsteps while motionless, dead, airborne, during freeze, or from large teleports. BOT timing uses the active `botsUpd`, not the unused `botsUpdOld`. Both player and BOT distance accumulators reset on respawn. 

The AudioContext unlock is bound to actual pointer/keyboard gestures; it is never treated as guaranteed before the browser grants audio playback. `SND=false` disables new footsteps. The source uses native browser Web Audio only—no remote assets or external sample packs.

### QA

Regression scenarios in `tests/footsteps-3d-audio.test.mjs`: surface mapping, real-motion cadence, airborne/freeze silence, synthesized bank content, spatial HRTF and falloff, wall muffling, listener heading, source/bundle parity. Headset listening in a real browser is still required for subjective timbre and localization verification.
