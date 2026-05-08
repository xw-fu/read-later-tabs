import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json' with { type: 'json' };

export default defineConfig({
  plugins: [svelte(), crx({ manifest })],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    exclude: ['node_modules', 'dist', 'tests/e2e/**'],
    server: {
      deps: {
        inline: [/svelte/],
      },
    },
  },
  resolve: {
    conditions: process.env.VITEST ? ['browser'] : [],
  },
  build: {
    rollupOptions: {
      input: {
        newtab: 'newtab.html',
        popup: 'src/popup/popup.html',
        options: 'src/options/options.html',
      },
    },
  },
});
