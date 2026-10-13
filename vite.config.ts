import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative paths so the built game works from any folder (a zip, a file host, a sub-folder of a site).
  base: './',
  test: { include: ['src/**/*.test.ts'] },
});
