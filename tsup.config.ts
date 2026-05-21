import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  splitting: true,
  dts: true,
  clean: true,
  sourcemap: true,
  loader: { '.md': 'text' },
  target: 'node18',
  outDir: 'dist',
  banner: {
    js: '#!/usr/bin/env node',
  },
});
