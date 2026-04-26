import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.unit.spec.ts'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/app.service.ts',
        'src/db/db.service.ts',
        'src/article/article.service.ts',
        'src/category/category.service.ts',
        'src/auth/guards/jwt-auth.guard.ts',
        'src/auth/guards/roles.guard.ts',
      ],
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
