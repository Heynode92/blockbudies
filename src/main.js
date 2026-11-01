import * as THREE from 'three';
import { createPointBlockClient } from './network/pointblock-client.js';
import { createBackgroundTicker } from './background/background-ticker.js';
import { createSimulationClock } from './background/simulation-clock.js';
import { createMenuBgm } from './audio/menu-bgm.js';
import { mountPointBlock } from 'virtual:pointblock-game';
import deathmatchVideo from './assets/video/deatch_match_demo.mp4?url';
import bombVideo from './assets/video/bomb_mission_demo.mp4?url';
import menuMusic from './assets/audio/Pointblock_bgm.mp3?url';

const online = createPointBlockClient({ baseUrl: import.meta.env.VITE_POINTBLOCK_API_URL });

// The original gameplay is initialized once with the pinned r128 npm engine.
// Future ESM extraction must keep this entry point and its state boundaries.
const menuBgm = createMenuBgm(menuMusic);
const backgroundTicker = createBackgroundTicker();
mountPointBlock(THREE, Object.freeze({ deathmatch: deathmatchVideo, bomb: bombVideo }), menuBgm,
  Object.freeze({ ticker: backgroundTicker, createSimulationClock }), online);
menuBgm.enterMenu();
