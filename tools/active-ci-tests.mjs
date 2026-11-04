// Routine Windows CI allowlist. Archived BOT AI M0–M7 milestone suites are
// NOT part of routine PR or push gates. Preserve them under npm test and the
// manually dispatched historical workflows.
// This list is intentionally explicit: new security-critical tests must be
// added intentionally and reviewed, never silently discovered/omitted.
import {spawnSync} from 'node:child_process';
const tests=[
 'background-simulation-clock',
 'bomb-drop-signal',
 'bomb-mission',
 'bomb-retake-radar',
 'bomb-tactical-hardening',
 'bomb-uncontested-defuse',
 'camera-look',
 'damage-range',
 'defense-bot-weapons',
 'gunplay-ballistics',
 'authoritative-recoil',
 'ci-workflow-policy',
 'k2-shotgun-rpg-ads',
 'match-input-liveness',
 'muzzle-sockets',
 'online-bomb-score-collision',
 'online-grenade-visibility',
 'online-kill-hud',
 'online-movement-prediction',
 'online-ready-kick-results',
 'online-results-parity',
 'online-room-error-recovery',
 'online-room-master',
 'online-session-recovery',
 'online-tracer-world-speed',
 'parity',
 'shotgun-horizontal-pattern',
 'weapon-balance',
 'weapon-casing-regression'
].map(name=>'tests/'+name+'.test.mjs');
if(tests.some(p=>/bot-ai-m[0-7]|bot-ai-m7-browser/i.test(p)))
 throw new Error('Routine CI cannot recertify historical BOT milestones');
const result=spawnSync(process.execPath,['--test',...tests],{stdio:'inherit',shell:false});
if(result.error)throw result.error;
process.exit(result.status??1);
