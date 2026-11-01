import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const html = readFileSync(resolve(root, 'dist/index.html'), 'utf8');
const entries = readdirSync(resolve(root, 'dist/assets'));
assert.match(html, /<script[^>]+type="module"[^>]+src="\/assets\//);
assert.doesNotMatch(html, /cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js/);
assert.doesNotMatch(html, /src="\.\/assets\/game\.js"/);
assert.ok(entries.some(name => name.endsWith('.js')), 'Production JavaScript missing');
assert.ok(entries.some(name => name.endsWith('.css')), 'Production CSS missing');
assert.ok(entries.some(name => name.endsWith('.mp4')), 'Gameplay videos missing');
assert.ok(entries.some(name => name.endsWith('.mp3')), 'PointBlock menu BGM missing');
assert.ok(entries.some(name => name.endsWith('.png')), 'PointBlock logo missing');
for (const name of entries) assert.ok(statSync(resolve(root, 'dist/assets', name)).size > 0, 'Empty asset: ' + name);
console.log('PASS: production bundle contains JS, CSS, videos, logo, and no Three.js CDN');
