import { defineConfig } from 'vitest/config'

/**
 * Wave 2B Ad Generator coverage gate (#160).
 * Target ≥90% on the testable library surface. Playwright / blob screenshot I/O
 * and the extract worker orchestrator are tracked in the daily full report job,
 * not this PR threshold (they need live env or heavy integration harness).
 */
const AD_GENERATOR_COVERAGE = [
  'src/brief/**/*.ts',
  'src/variant/**/*.ts',
  'src/extract/**/*.ts',
  'src/marketplace/**/*.ts',
  'src/generation-jobs/estimate-extract.ts',
]

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: AD_GENERATOR_COVERAGE,
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        '**/fixtures/**',
        '**/index.ts',
        'src/extract/pdf-parse-shim.d.ts',
        // Live I/O / multimodal — tracked in daily full coverage report (#160).
        'src/extract/capture-page-screenshot.ts',
        'src/extract/persist-screenshot-asset.ts',
        'src/extract/fetch-safe-bytes.ts',
        'src/extract/materialize-brand-images.ts',
        'src/extract/sample-dominant-color.ts',
        'src/extract/url-adapter.ts',
        'src/generation-jobs/enrich-brief-from-vision.ts',
        'src/generation-jobs/run-extract.ts',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        // Zod defaults / optional chaining inflate V8 branch counts; 75% is the bar.
        branches: 75,
      },
    },
  },
})
