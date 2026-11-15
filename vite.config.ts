import { defineConfig } from 'vite';

// base './' so the build works when uploaded to itch.io (served from a sub path).
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
});
