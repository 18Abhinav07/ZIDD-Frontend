import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'school-recap-live.spec.ts',
  timeout: 0,
  expect: { timeout: 0 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  outputDir: 'test-results/school-browser/recap',
  reporter: [['list']],
  use: { trace: 'off', screenshot: 'off' },
});
