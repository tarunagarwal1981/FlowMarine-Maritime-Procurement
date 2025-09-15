import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/test/**/*.{test,spec}.{js,ts}'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'prisma/**',
      'src/test/validate*.{js,ts}',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'prisma/**',
        'src/test/**',
        'src/scripts/**',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/controllers': path.resolve(__dirname, './src/controllers'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/middleware': path.resolve(__dirname, './src/middleware'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/models': path.resolve(__dirname, './src/models'),
      '@/config': path.resolve(__dirname, './src/config'),
    },
  },
});