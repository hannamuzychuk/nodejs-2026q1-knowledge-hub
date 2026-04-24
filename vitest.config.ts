const { defineConfig } = require('vitest/config');
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.unit.spec.ts'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/**/*.module.ts', 'src/**/*.controller.ts'],
      thresholds: {
        lines: 90,
        branches: 85,
      },
    },
  },
  resolve: {
    alias: {
      src: resolve(__dirname, './src'),
    },
  },
});
