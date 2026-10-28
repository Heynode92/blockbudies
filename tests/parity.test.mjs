import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFile(resolve(root, p), 'utf8');
const m = JSON.parse(await read('tools/source-manifest.json'));
const original = await read('tests/fixtures/source-original.html');
const css = (await Promise.all(m.styles.map(read))).join('');
const body = (await Promise.all(m.parts.map(read))).join('');
const bundle = await read('assets/game.js');
const index = await read('index.html');
test('CSS exactly matches original', () => {
  assert.equal(css, original.split('<style>\n')[1].split('</style>')[0]);
});
test('JS exactly matches original', () => {
  assert.equal(bundle, original.split('<script>\n')[1].split('</script>')[0]);
  assert.equal(bundle, '(function(){\n' + body + '})();\n');
});
test('HTML rehydrates to the exact original document', () => {
  const links = m.styles.map(p => '<link rel="stylesheet" href="./' + p + '">\n').join('');
  const roundtrip = index.replace(links, '<style>\n' + css + '</style>\n')
    .replace('<script src="./assets/game.js"></script>\n', '<script>\n' + bundle + '</script>\n');
  assert.equal(roundtrip, original);
});
test('manifest has unique and feature-specific paths', () => {
  assert.equal(new Set(m.parts).size, m.parts.length);
  assert.equal(new Set(m.styles).size, m.styles.length);
  assert.ok(m.parts.every(p => p.startsWith('src/game/')));
});
