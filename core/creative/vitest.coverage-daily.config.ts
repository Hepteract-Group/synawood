import { defineConfig } from 'vitest/config'

/**
 * Daily coverage report (#160) — full @synawood/creative surface, no fail gate.
 * PR gate stays in vitest.config.ts (`npm run test:ad-generator:coverage`).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage-full',
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts', '**/fixtures/**', '**/index.ts'],
      // Report only — do not fail the daily job on global % (PR gate enforces Ad Generator).
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },
    },
  },
})
