import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Vite integration bridge: preserve the existing ordered shared-scope game while
// making npm/Vite the only runtime build path. Convert to true per-feature ESM
// later, with isolated state and parity tests, rather than risking gameplay.
const RUNTIME_ID = 'virtual:pointblock-game';
// CSS loads via explicit HTML <link> tags before JS, avoiding unstyled SVG flashes.
const VIRTUAL_RUNTIME_ID = '\0' + RUNTIME_ID;

export function pointBlockGamePlugin(root) {
  const manifestFile = resolve(root, 'tools/source-manifest.json');
  const readManifest = () => {
    const parsed = JSON.parse(readFileSync(manifestFile, 'utf8'));
    for (const [key, prefix, ext] of [['parts', 'src/game/', '.js'], ['styles', 'src/styles/', '.css']]) {
      if (!Array.isArray(parsed[key]) || !parsed[key].length) throw new Error(`Invalid ${key} source manifest`);
      const seen = new Set();
      for (const item of parsed[key]) {
        if (typeof item !== 'string' || !item.startsWith(prefix) || !item.endsWith(ext) ||
            item.includes('..') || item.includes('\\') || seen.has(item)) {
          throw new Error(`Invalid or duplicated source path: ${item}`);
        }
        seen.add(item);
      }
    }
    return parsed;
  };
  const sources = entries => entries.map(path =>
    readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n'));
  const watch = new Set();

  return {
    name: 'pointblock-source-runtime',
    enforce: 'pre',
    resolveId(id) {
      if (id === RUNTIME_ID) return VIRTUAL_RUNTIME_ID;
      return null;
    },
    load(id) {
      if (id !== VIRTUAL_RUNTIME_ID) return null;
      const manifest = readManifest();
      watch.clear();
      for (const path of manifest.parts) watch.add(resolve(root, path));
      watch.add(manifestFile);
      for (const path of watch) this.addWatchFile(path);
      return `export function mountPointBlock(THREE, GAME_ASSET_URLS, MENU_BGM, BACKGROUND_SIM, PB_ONLINE, PB_WALLET) {\n${sources(manifest.parts).join('')}\n}\n`;
    },
    handleHotUpdate(ctx) {
      if (!watch.has(resolve(ctx.file))) return;
      const mod = ctx.server.moduleGraph.getModuleById(VIRTUAL_RUNTIME_ID);
      if (mod) ctx.server.moduleGraph.invalidateModule(mod);
      // Canvas, WebGL state and registered listeners require a clean reload.
      ctx.server.ws.send({ type: 'full-reload' });
      return [];
    }
  };
}
