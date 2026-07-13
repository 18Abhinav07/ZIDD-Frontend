import { defineConfig } from '@playwright/test';

const discoveryOnly = process.argv.includes('--list');
const outputDir = discoveryOnly
  ? 'test-results/school-browser/phase-b-discovery'
  : 'test-results/school-browser/phase-b';
const jsonOutputFile = discoveryOnly
  ? 'test-results/school-browser/phase-b-discovery-results.json'
  : 'test-results/school-browser/phase-b-results.json';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'school-phase-b.spec.ts',
  timeout: 0,
  expect: { timeout: 0 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  outputDir,
  reporter: [
    ['list'],
    ['json', { outputFile: jsonOutputFile }],
  ],
  use: {
    trace: 'off',
    screenshot: 'off',
  },
});
