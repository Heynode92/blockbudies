# Blok Buddies FPS

Modular source migration of the uploaded **Blok Buddies FPS** browser game. Existing gameplay, original English strings, match flow, CSS, JavaScript execution order, and assets have not been changed.

## Play on Windows

Clone once: `git clone https://github.com/Heynode92/blockbudies.git`

To update later, run `git pull` in the repository directory. Open `index.html` directly in your browser. **No local runners, Docker, WSL, npm install, or build step required for playing.**

**External dependencies:** the original Three.js r128 CDN and Google Rajdhani font links have been kept unchanged. Internet access is needed to fetch these resources when not cached; game simulation is still offline/local. Multiplayer is not yet available.

## Source structure

- `index.html`: preserved DOM structure with CSS and JS file references.
- `src/styles/`: 6 ordered CSS files preserving original cascade.
- `src/game/`: 17 original code sections arranged by feature.
- `assets/game.js`: committed ready-to-play bundled script. Never edit this file directly.
- `tools/source-manifest.json`: authoritative source ordering.
- `tools/build.mjs`: deterministic no-dependency compiler for maintainers.
- `tests/parity.test.mjs`: regression test of exact JS, CSS, HTML extraction.
- `tests/fixtures/source-original.html`: immutable original reference (not loaded during gameplay).
- `docs/ARCHITECTURE.md`: architecture and migration rationale.
- `CHANGELOG.md`: log for every update.

## Maintainer-only checks

```powershell
node tools/build.mjs
node tools/build.mjs --check
node --test tests/parity.test.mjs
node --check assets/game.js
```

All source fragments belong to one originally shared immediately-invoked function expression (IIFE). They are assembled in order into the committed script. **Do not load the fragments as independent browser scripts** because that would break shared scope. No new packages, languages or game rules were introduced.

## Update policy

Every change must record the edited features and test results in `CHANGELOG.md`. Preserve existing behavior and original English interface unless a change is explicitly requested. Regenerate the bundle and run validation before every commit.
