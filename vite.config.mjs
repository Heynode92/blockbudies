import { defineConfig } from 'vite';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pointBlockGamePlugin } from './tools/vite-game-plugin.mjs';

const root = dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  base: '/',
  plugins: [pointBlockGamePlugin(root)],
  server: { host: '127.0.0.1', port: 5173, strictPort: false },
  preview: { host: '127.0.0.1' },
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true }
});
