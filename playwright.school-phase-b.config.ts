import { defineConfig } from '@playwright/test';
import {
  SCHOOL_BROWSER_ACTION_TIMEOUT_MS,
  SCHOOL_BROWSER_EXPECT_TIMEOUT_MS,
  SCHOOL_BROWSER_FLOW_TIMEOUT_MS,
  SCHOOL_BROWSER_NAVIGATION_TIMEOUT_MS,
} from './tests/browser/school-browser-timeouts';

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
  timeout: SCHOOL_BROWSER_FLOW_TIMEOUT_MS,
  expect: { timeout: SCHOOL_BROWSER_EXPECT_TIMEOUT_MS },
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
    actionTimeout: SCHOOL_BROWSER_ACTION_TIMEOUT_MS,
    navigationTimeout: SCHOOL_BROWSER_NAVIGATION_TIMEOUT_MS,
    trace: 'off',
    screenshot: 'off',
  },
});
