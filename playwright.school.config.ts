import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'school-phase-a.spec.ts',
  timeout: 0,
  expect: { timeout: 0 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  outputDir: 'test-results/school-browser',
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/school-browser/results.json' }],
  ],
  use: {
    trace: 'off',
    screenshot: 'off',
  },
});
