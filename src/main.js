import * as THREE from 'three';
import { mountPointBlock } from 'virtual:pointblock-game';
import 'virtual:pointblock-styles';
import deathmatchVideo from './assets/video/deatch_match_demo.mp4?url';
import bombVideo from './assets/video/bomb_mission_demo.mp4?url';

// The original gameplay is initialized once with the pinned r128 npm engine.
// Future ESM extraction must keep this entry point and its state boundaries.
mountPointBlock(THREE, Object.freeze({ deathmatch: deathmatchVideo, bomb: bombVideo }));
