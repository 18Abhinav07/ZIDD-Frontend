import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'school-curriculum-masterclass-live.spec.ts',
  timeout: 0,
  expect: { timeout: 0 },
  workers: 1,
  retries: 0,
  outputDir: 'test-results/school-browser/curriculum-masterclass',
  reporter: [['list']],
  use: { trace: 'off', screenshot: 'off' },
});
