import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Only builds the isolated review page. It never rewrites the game's
// scripts/lingyin_world.js bundle or its collision/navigation sources.
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/main-hall-preview.ts'),
      formats: ['es'],
      fileName: () => 'lingyin-main-hall.js',
    },
    outDir: resolve(__dirname, '../preview'),
    emptyOutDir: false,
    sourcemap: false,
    minify: true,
    rollupOptions: {
      external: (id: string) => id === 'three' || id.startsWith('three/addons/'),
    },
  },
});
