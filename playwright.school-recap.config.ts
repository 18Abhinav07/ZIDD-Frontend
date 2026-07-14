import { defineConfig } from '@playwright/test';
import {
  SCHOOL_BROWSER_ACTION_TIMEOUT_MS,
  SCHOOL_BROWSER_EXPECT_TIMEOUT_MS,
  SCHOOL_BROWSER_NAVIGATION_TIMEOUT_MS,
  SCHOOL_EVALUATOR_FLOW_TIMEOUT_MS,
} from './tests/browser/school-browser-timeouts';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'school-recap-live.spec.ts',
  timeout: SCHOOL_EVALUATOR_FLOW_TIMEOUT_MS,
  expect: { timeout: SCHOOL_BROWSER_EXPECT_TIMEOUT_MS },
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  outputDir: 'test-results/school-browser/recap',
  reporter: [['list']],
  use: {
    actionTimeout: SCHOOL_BROWSER_ACTION_TIMEOUT_MS,
    navigationTimeout: SCHOOL_BROWSER_NAVIGATION_TIMEOUT_MS,
    trace: 'off',
    screenshot: 'off',
  },
});
