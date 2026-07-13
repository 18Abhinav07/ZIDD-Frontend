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
