import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// A browser ESM bridge used by the parent FPS. Keep Three external so every
// scene object shares the game's import-map instance of the library.
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/team-map-entry.ts'),
      formats: ['es'],
      fileName: () => 'lingyin_world.js',
    },
    outDir: resolve(__dirname, '../scripts'),
    emptyOutDir: false,
    sourcemap: false,
    minify: true,
    rollupOptions: {
      external: (id: string) => id === 'three' || id.startsWith('three/addons/'),
    },
  },
});
