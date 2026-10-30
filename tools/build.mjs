// No dependencies. Restore the original single shared JavaScript closure in source order.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(resolve(root, 'tools/source-manifest.json'), 'utf8'));
const segments = (await Promise.all(manifest.parts.map(p => readFile(resolve(root, p), 'utf8'))))
  .map(source => source.replace(/\r\n/g, '\n'));
const content = '(function(){\n' + segments.join('') + '})();\n';
const target = resolve(root, 'assets/game.js');
if (process.argv.includes('--check')) {
  const expected = (await readFile(target, 'utf8')).replace(/\r\n/g, '\n');
  if (content !== expected) { console.error('Bundle out of sync; run node tools/build.mjs'); process.exitCode = 1; }
  else console.log('PASS: generated game script matches ordered modules');
} else {
  await writeFile(target, content, 'utf8');
  console.log('Built assets/game.js from ' + manifest.parts.length + ' modules');
}
