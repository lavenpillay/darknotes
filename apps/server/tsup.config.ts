import { defineConfig } from 'tsup';

/**
 * Production build: one ES module in dist/. The shared @darknotes/core package ships as TypeScript source, so it
 * is bundled in; third-party packages stay external and are installed from package.json at runtime.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: ['@darknotes/core'],
});
