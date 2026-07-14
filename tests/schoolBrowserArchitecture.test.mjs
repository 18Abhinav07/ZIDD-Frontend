import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  SCHOOL_ACTION_LABELS,
  createIsolatedSchoolContext,
} from './browser/school-browser-contract.mjs';

const BASE_URL = 'http://localhost:3001';
const REPO_ROOT = path.resolve(import.meta.dirname, '..');

const EXPECTED_ACTION_LABELS = {
  complete_profile: 'Set up school prep',
  edit_profile: 'Edit school profile',
  start_placement: 'Start readiness check',
  resume_placement: 'Continue readiness check',
  finish_placement: 'Finish readiness check',
  view_placement_report: 'View readiness report',
  start_recap: 'Start recap path',
  resume_recap: 'Continue recap',
  revise_recap_path: 'Review recap path',
  start_curriculum: 'Start target class',
  resume_curriculum: 'Continue class',
  start_masterclass: 'Start masterclass',
  resume_masterclass: 'Continue masterclass',
  resume_support: 'Continue support',
  view_support_plan: 'Open support plan',
  view_report: 'View report',
  retry: 'Retry',
};

test('defines the full canonical School action label map', () => {
  assert.deepEqual(SCHOOL_ACTION_LABELS, EXPECTED_ACTION_LABELS);
});

test('copies only localhost NextAuth session and CSRF cookies into an isolated context', async () => {
  const localSessionCookie = {
    name: 'next-auth.session-token',
    value: 'session-value',
    domain: 'localhost',
    path: '/',
  };
  const localCsrfCookie = {
    name: 'next-auth.csrf-token',
    value: 'csrf-value',
    domain: 'localhost',
    path: '/',
  };
  const defaultContextCalls = [];
  const defaultContext = {
    cookies: async (urls) => {
      defaultContextCalls.push(['cookies', urls]);
      return [
        localSessionCookie,
        localCsrfCookie,
        { name: 'theme', value: 'dark', domain: 'localhost', path: '/' },
        { ...localSessionCookie, domain: 'example.com' },
      ];
    },
  };
  const addedCookies = [];
  const page = { marker: 'isolated-page' };
  const isolatedContext = {
    addCookies: async (cookies) => addedCookies.push(...cookies),
    close: async () => {},
    newPage: async () => page,
  };
  const browser = {
    contexts: () => [defaultContext],
    newContext: async () => isolatedContext,
  };

  const result = await createIsolatedSchoolContext(browser, BASE_URL);

  assert.deepEqual(defaultContextCalls, [['cookies', [BASE_URL]]]);
  assert.deepEqual(addedCookies, [localSessionCookie, localCsrfCookie]);
  assert.deepEqual(result, { context: isolatedContext, page });
});

test('closes the isolated context when page creation fails', async () => {
  const setupFailure = new Error('synthetic page setup failure');
  let isolatedContextClosed = false;
  const defaultContext = {
    cookies: async () => [{
      name: 'next-auth.session-token',
      value: 'session-value',
      domain: 'localhost',
      path: '/',
    }],
  };
  const isolatedContext = {
    addCookies: async () => {},
    close: async () => {
      isolatedContextClosed = true;
    },
    newPage: async () => {
      throw setupFailure;
    },
  };
  const browser = {
    contexts: () => [defaultContext],
    newContext: async () => isolatedContext,
  };

  await assert.rejects(
    createIsolatedSchoolContext(browser, BASE_URL),
    (error) => error === setupFailure,
  );
  assert.equal(isolatedContextClosed, true);
});

test('every rendered canonical School page requests restrained header controls', () => {
  const directHeaderPages = [
    'src/app/school/page.tsx',
    'src/app/school/onboarding/page.tsx',
    'src/app/school/placement/report/page.tsx',
  ];

  for (const relativePath of directHeaderPages) {
    const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
    assert.match(
      source,
      /<AppHeader\b[^>]*appearance="school"/,
      `${relativePath} must opt into the School header appearance`,
    );
  }

  const learningShellPages = [
    'src/app/school/placement/page.tsx',
    'src/app/school/recap/page.tsx',
  ];
  for (const relativePath of learningShellPages) {
    const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
    assert.match(
      source,
      /<SchoolLearningShell\b/,
      `${relativePath} must render through the School learning shell`,
    );
  }

  const learningShellSource = fs.readFileSync(
    path.join(REPO_ROOT, 'src/components/school/SchoolLearningShell.tsx'),
    'utf8',
  );
  assert.match(learningShellSource, /<AppHeader\b[^>]*appearance="school"/);

  const headerSource = fs.readFileSync(
    path.join(REPO_ROOT, 'src/components/shared/AppHeader.tsx'),
    'utf8',
  );
  assert.match(headerSource, /appearance\?: 'default' \| 'school'/);
  assert.match(headerSource, /appearance === 'school'/);
  assert.match(headerSource, /rounded-full/);
  assert.match(headerSource, /authStatus === 'authenticated'/);
  assert.match(headerSource, /showCredits && !schoolControls/);
  assert.match(
    headerSource,
    /authSession\?\.user\?\.image \|\| AVATAR_PATHS\.casual_male/,
  );
});

test('School proxy forwards an explicit header allowlist without browser auth cookies', () => {
  const proxySource = fs.readFileSync(
    path.join(REPO_ROOT, 'src/app/api/school/[...path]/route.ts'),
    'utf8',
  );
  assert.match(proxySource, /REQUEST_HEADER_ALLOWLIST/);
  assert.match(proxySource, /RESPONSE_HEADER_ALLOWLIST/);
  assert.match(proxySource, /'authorization'/);
  assert.match(proxySource, /'content-type'/);
  assert.doesNotMatch(proxySource, /headers\.set\(['"]cookie['"]/);
  assert.match(proxySource, /if \(!REQUEST_HEADER_ALLOWLIST\.has\(lower\)\) return/);
});

test('School proxy composes browser cancellation with a bounded upstream policy and cleans up', () => {
  const proxySource = fs.readFileSync(
    path.join(REPO_ROOT, 'src/app/api/school/[...path]/route.ts'),
    'utf8',
  );
  assert.match(proxySource, /schoolProxyTimeoutMs\(path/);
  assert.match(proxySource, /requestSignal\.addEventListener\('abort'/);
  assert.match(proxySource, /requestSignal\.removeEventListener\('abort'/);
  assert.match(proxySource, /createUpstreamAbort\(request\.signal, timeoutMs\)/);
  assert.match(proxySource, /clearTimeout\(timeout\)/);
  assert.match(proxySource, /signal: upstreamAbort\.signal/);
  assert.match(proxySource, /upstreamAbort\.abort\(reason\)/);
  assert.match(proxySource, /upstreamAbort\.cleanup\(\)/);
});

test('a nested School layout owns finite unavailable and failure states for every canonical route', () => {
  const layoutPath = path.join(REPO_ROOT, 'src/app/school/layout.tsx');
  assert.ok(fs.existsSync(layoutPath), 'src/app/school/layout.tsx must guard every canonical School route');
  const layoutSource = fs.readFileSync(layoutPath, 'utf8');
  assert.match(layoutSource, /getSchoolStateResponse/);
  assert.match(layoutSource, /state\.available === false/);
  assert.match(layoutSource, /School learning is not available in this release/);
  assert.match(layoutSource, /Return to Career Prep/);
  assert.match(layoutSource, /\/career\?view=career/);
  assert.match(layoutSource, /setRetryKey/);
  assert.match(layoutSource, /SchoolClassHomeSkeleton/);
});

test('School Playwright suites use named finite test, expect, action, and navigation deadlines', () => {
  const timeoutPath = path.join(REPO_ROOT, 'tests/browser/school-browser-timeouts.ts');
  assert.ok(fs.existsSync(timeoutPath), 'School browser suites must share named finite deadlines');
  const timeoutSource = fs.readFileSync(timeoutPath, 'utf8');
  for (const token of [
    'SCHOOL_BROWSER_ACTION_TIMEOUT_MS',
    'SCHOOL_BROWSER_NAVIGATION_TIMEOUT_MS',
    'SCHOOL_EVALUATOR_EXPECT_TIMEOUT_MS',
    'SCHOOL_EVALUATOR_FLOW_TIMEOUT_MS',
  ]) {
    assert.match(timeoutSource, new RegExp(`export const ${token} = [1-9]`));
  }

  const deadlineFiles = [
    'playwright.school.config.ts',
    'playwright.school-phase-b.config.ts',
    'playwright.school-recap.config.ts',
    'playwright.school-curriculum-masterclass.config.ts',
    'tests/browser/school-placement-live.spec.ts',
    'tests/browser/school-recap-live.spec.ts',
    'tests/browser/school-curriculum-masterclass-live.spec.ts',
  ];
  for (const relativePath of deadlineFiles) {
    const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
    assert.doesNotMatch(source, /timeout:\s*0|setDefaultTimeout\(0\)|test\.setTimeout\(0\)/);
  }

  for (const relativePath of deadlineFiles.slice(0, 4)) {
    const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
    assert.match(source, /actionTimeout:/);
    assert.match(source, /navigationTimeout:/);
  }
});
