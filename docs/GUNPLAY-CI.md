# PointBlock gunplay and Windows CI — 2026-11-04

The current ballistic protocol is `pointblock-gunplay-2026-11-04-v3-barrel`. The backend controls real H/V recoil, recoil-rotated muzzle position, final projectile velocity, hit registration and damage. The frontend reads certified barrel yaw/pitch to animate the existing gun and hands; it must never submit trusted shot data.

Routine CI: `vite.yml` and `online-frontend-build.yml` run `npm run test:ci`, production build and distributable checks. `pointblock-gunplay-windows.yml` runs dedicated authoritative recoil and muzzle tests. The approved test list is `tools/active-ci-tests.mjs`.

Historical BOT AI M0–M7 milestones are completed. Their historical tests, code and evidence remain intact, but `bot-ai-m0.yml` and `bot-ai-m7-browser.yml` accept manual `workflow_dispatch` only. Ordinary push and PR activity does not recertify them. `npm test` or `npm run test:full` remains a manual full test option.

Existing test failures must be classified separately as real defects, stale expectations, missing mocks, historical tests or newly introduced regressions. Correct approved test contracts without changing authorized gameplay; never label skipped tests PASS.

Windows workflow only: no mandatory Linux, WSL or Docker. No runtime/5v5 certification is inferred from CI. Current FE/BE dependencies have no committed lockfile; package installation therefore uses existing project manifests until a separately reviewed lockfile is added.
