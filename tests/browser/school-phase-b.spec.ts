import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { createIsolatedSchoolContext } from './school-browser-contract.mjs';

const BASE_URL = 'http://localhost:3001';
const CDP_URL = process.env.ZIDD_CDP_URL || 'http://127.0.0.1:9222';
const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
} as const;

type BrowserEvidence = {
  context: string;
  viewport: { width: number; height: number };
  path: string;
  overflow: number;
  regions: Array<{ name: string; top: number; right: number; bottom: number; left: number }>;
};

function schoolQaEmail() {
  const email = process.env.SCHOOL_QA_EMAIL?.trim();
  if (!email) throw new Error('SCHOOL_QA_EMAIL is required for the dedicated School browser account');
  return email;
}

type CapturedSchoolRequest = {
  path: string;
  payload: Record<string, unknown>;
};

const SAFE_SCHOOL_REQUEST_FIELDS = new Set([
  'display_name',
  'school_name',
  'board_id',
  'target_class_no',
  'subject_ids',
  'preferred_teaching_language',
  'english_comfort',
  'learner_goal',
  'parent_goal',
  'prior_difficulty_signals',
  'current_step',
  'request_id',
  'profile_version_id',
  'expected_revision',
]);

async function schoolPage(viewport: { width: number; height: number }) {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const result = await createIsolatedSchoolContext(browser, BASE_URL) as {
    context: BrowserContext;
    page: Page;
  };
  await setExactCssViewport(result.page, viewport);
  return result;
}

async function setExactCssViewport(page: Page, target: { width: number; height: number }) {
  let requested = { ...target };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.setViewportSize(requested);
    const actual = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));
    if (actual.width === target.width && actual.height === target.height) return;
    if (actual.width <= 0 || actual.height <= 0) break;
    requested = {
      width: Math.max(1, Math.round(requested.width * target.width / actual.width)),
      height: Math.max(1, Math.round(requested.height * target.height / actual.height)),
    };
  }
  const actual = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  throw new Error(
    `Could not calibrate CSS viewport to ${target.width}x${target.height}; received ${actual.width}x${actual.height}`,
  );
}

async function verifyQaIdentity(page: Page) {
  const expectedEmail = schoolQaEmail();
  const identity = await page.evaluate(async (expectedEmail: string) => {
    const response = await fetch('/api/auth/session', { cache: 'no-store' });
    const session = await response.json();
    const accessToken = typeof session?.accessToken === 'string' ? session.accessToken : null;
    return {
      email: session?.user?.email ?? null,
      tokenPresent: Boolean(accessToken),
      tokenVisible: accessToken ? document.body.innerHTML.includes(accessToken) : false,
      expectedEmail,
    };
  }, expectedEmail);

  expect(identity.email).toBe(expectedEmail);
  expect(identity.tokenPresent).toBe(true);
  expect(identity.tokenVisible).toBe(false);
}

async function currentSessionEmail(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    const response = await fetch('/api/auth/session', { cache: 'no-store' });
    const session = await response.json();
    return session?.user?.email ?? null;
  });
}

async function chooseQaGoogleAccount(page: Page) {
  if (new URL(page.url()).hostname !== 'accounts.google.com') return;
  const expectedEmail = schoolQaEmail();

  const account = page.locator(`[data-identifier="${expectedEmail}"]`).first();
  if (await account.isVisible()) {
    await account.click();
    return;
  }

  const emailText = page.getByText(expectedEmail, { exact: true }).first();
  await expect(emailText).toBeVisible();
  await emailText.click();
}

async function signInWithQaGoogleAccount(page: Page) {
  await expect(page).toHaveURL(/\/auth\/login/);
  await page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
  await page.waitForURL((url) => url.hostname === 'accounts.google.com', {
    waitUntil: 'domcontentloaded',
  });
  await chooseQaGoogleAccount(page);
  await page.waitForURL((url) => url.origin === BASE_URL, {
    waitUntil: 'domcontentloaded',
  });
  await expect.poll(() => currentSessionEmail(page)).toBe(schoolQaEmail());
}

async function startTrace(context: BrowserContext) {
  await context.tracing.start({ screenshots: false, snapshots: false, sources: false });
}

async function stopTrace(context: BrowserContext, testInfo: TestInfo, directory: string) {
  const tracePath = testInfo.outputPath(`${directory}/trace.zip`);
  await mkdir(path.dirname(tracePath), { recursive: true });
  await context.tracing.stop({ path: tracePath });
}

async function assertLayout(page: Page, context: string): Promise<BrowserEvidence> {
  const evidence = await page.evaluate((label: string) => {
    const root = document.documentElement;
    const regions = Array.from(document.querySelectorAll<HTMLElement>('[data-school-region]'))
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          name: element.dataset.schoolRegion ?? 'unnamed',
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left,
        };
      });
    return {
      context: label,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      path: location.pathname,
      overflow: root.scrollWidth - root.clientWidth,
      regions,
    };
  }, context);

  expect(evidence.overflow, `${context} has horizontal overflow`).toBeLessThanOrEqual(1);
  for (const region of evidence.regions) {
    expect(region.left, `${context}:${region.name} extends left`).toBeGreaterThanOrEqual(-1);
    expect(region.right, `${context}:${region.name} extends right`).toBeLessThanOrEqual(evidence.viewport.width + 1);
    expect(region.bottom - region.top, `${context}:${region.name} collapsed`).toBeGreaterThan(0);
  }

  const rail = evidence.regions.find((region) => region.name === 'step-rail');
  const workspace = evidence.regions.find((region) => region.name === 'form-workspace');
  if (rail && workspace) {
    expect(rail.right, `${context}: desktop rail overlaps workspace`).toBeLessThanOrEqual(workspace.left + 1);
  }
  const progress = evidence.regions.find((region) => region.name === 'mobile-progress');
  if (progress && workspace) {
    expect(progress.bottom, `${context}: mobile progress overlaps workspace`).toBeLessThanOrEqual(workspace.top + 1);
  }
  return evidence;
}

async function expectFocusedHeading(page: Page, name: string) {
  const heading = page.getByRole('heading', { name, exact: true });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
}

async function continueExistingStep(page: Page, nextHeading: string) {
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expectFocusedHeading(page, nextHeading);
  await expect(page.getByRole('status')).toContainText('Saved.');
}

test('Phase B onboarding persists, resumes, activates, and stops at authorized readiness', async ({}, testInfo) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const httpErrors: string[] = [];
  const schoolRequests: string[] = [];
  const schoolRequestPayloads: CapturedSchoolRequest[] = [];
  const requestCaptureErrors: string[] = [];
  let expectedInterceptedStateFailures = 0;
  let expectedInterceptedConsoleErrors = 0;
  const layoutEvidence: BrowserEvidence[] = [];
  let firstContext: BrowserContext | null = null;
  let resumedContext: BrowserContext | null = null;

  const observe = (page: Page) => {
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      if (
        expectedInterceptedConsoleErrors > 0
        && message.text().includes('Failed to load resource')
        && message.text().includes('503')
      ) {
        expectedInterceptedConsoleErrors -= 1;
        return;
      }
      consoleErrors.push(message.text());
    });
    page.on('requestfailed', (request) => {
      const url = new URL(request.url());
      const errorText = request.failure()?.errorText ?? 'failed';
      const expectedNextNavigationCancellation = (
        request.method() === 'GET'
        && url.origin === BASE_URL
        && url.searchParams.has('_rsc')
        && errorText === 'net::ERR_ABORTED'
      );
      if (!expectedNextNavigationCancellation) {
        failedRequests.push(`${request.method()} ${request.url()}: ${errorText}`);
      }
    });
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (
        request.method() !== 'POST'
        || !['/api/school/onboarding', '/api/school/onboarding/complete'].includes(url.pathname)
      ) return;
      try {
        const rawPayload = request.postDataJSON() as Record<string, unknown>;
        const unknownFields = Object.keys(rawPayload).filter((field) => !SAFE_SCHOOL_REQUEST_FIELDS.has(field));
        if (unknownFields.length) {
          requestCaptureErrors.push(`${url.pathname}: unexpected fields ${unknownFields.join(', ')}`);
          return;
        }
        schoolRequestPayloads.push({ path: url.pathname, payload: structuredClone(rawPayload) });
      } catch (error) {
        requestCaptureErrors.push(`${url.pathname}: ${String(error)}`);
      }
    });
    page.on('response', (response) => {
      const url = response.url();
      if (url.startsWith(BASE_URL) && url.includes('/api/school/')) {
        schoolRequests.push(`${response.status()} ${response.request().method()} ${new URL(url).pathname}`);
      }
      if (response.status() >= 400 && url.startsWith(BASE_URL) && !url.endsWith('/favicon.ico')) {
        if (
          response.status() === 503
          && new URL(url).pathname === '/api/school/state'
          && expectedInterceptedStateFailures > 0
        ) {
          expectedInterceptedStateFailures -= 1;
          return;
        }
        httpErrors.push(`${response.status()} ${response.request().method()} ${url}`);
      }
    });
  };

  try {
    const first = await schoolPage(VIEWPORTS.desktop);
    firstContext = first.context;
    observe(first.page);
    await startTrace(first.context);
    await first.page.goto(`${BASE_URL}/school`, { waitUntil: 'domcontentloaded' });
    await verifyQaIdentity(first.page);
    await expect(first.page.getByRole('button', { name: 'Set up school prep', exact: true })).toBeVisible();
    await first.page.getByRole('button', { name: 'Set up school prep', exact: true }).click();
    await expectFocusedHeading(first.page, 'Learner details');
    layoutEvidence.push(await assertLayout(first.page, 'desktop learner step'));

    await first.page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(first.page.getByText('Learner name must be between 2 and 120 characters.', { exact: true })).toBeVisible();
    await expect(first.page.getByText('School name must be between 2 and 160 characters.', { exact: true })).toBeVisible();
    await first.page.getByLabel('Learner name').fill('Aarav');
    await first.page.getByLabel('School name').fill('Open Assets School');
    await first.page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expectFocusedHeading(first.page, 'Class and subject');
    await expect(first.page).toHaveURL(/\/school\/onboarding\?step=2$/);

    await first.page.goBack();
    await expectFocusedHeading(first.page, 'Learner details');
    await expect(first.page.getByLabel('Learner name')).toHaveValue('Aarav');
    await first.page.reload({ waitUntil: 'domcontentloaded' });
    await expect(first.page.getByLabel('School name')).toHaveValue('Open Assets School');
    await stopTrace(first.context, testInfo, 'initial-context');
    await first.context.close();
    firstContext = null;

    const resumed = await schoolPage(VIEWPORTS.mobile);
    resumedContext = resumed.context;
    const page = resumed.page;
    observe(page);
    await startTrace(resumed.context);
    await page.goto(`${BASE_URL}/school/onboarding`, { waitUntil: 'domcontentloaded' });
    await verifyQaIdentity(page);
    await expectFocusedHeading(page, 'Class and subject');
    await expect(
      page.locator('[data-school-region="mobile-progress"]')
        .getByText('Step 2 of 5', { exact: true }),
    ).toBeVisible();
    await expect(page.locator('[aria-current="step"]:visible')).toHaveText(/Class/);
    layoutEvidence.push(await assertLayout(page, 'mobile resumed class step'));
    await page.getByRole('radio', { name: /^CBSE/ }).click();
    await page.getByRole('radio', { name: 'Class 3', exact: true }).click();
    await page.getByRole('radio', { name: /^English/ }).click();
    await continueExistingStep(page, 'Teaching language');

    await setExactCssViewport(page, VIEWPORTS.tablet);
    await page.getByRole('radio', { name: /^Hinglish/ }).click();
    await expect(page.getByRole('radio', { name: /^Hinglish/ })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('radio', { name: 'I understand some English but need support', exact: true }).click();
    layoutEvidence.push(await assertLayout(page, 'tablet language step'));
    await continueExistingStep(page, 'Goals and difficulty');

    await page.getByLabel('Learner goal').fill('Read stories confidently and write clear chapter answers.');
    await page.getByRole('button', { name: 'Reading passages', exact: true }).click();
    await page.getByRole('button', { name: 'Chapter answers', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Reading passages', exact: true })).toHaveAttribute('aria-pressed', 'true');
    layoutEvidence.push(await assertLayout(page, 'tablet goals step'));
    await continueExistingStep(page, 'Review and confirm');

    await setExactCssViewport(page, VIEWPORTS.desktop);
    await expect(page.getByText('Hinglish', { exact: true })).toBeVisible();
    await expect(page.getByText(/Confirming creates the learner's School setup/)).toBeVisible();
    await expect(page.getByText(/School V2|School V3|answer_key|profile_version_id/)).toHaveCount(0);
    layoutEvidence.push(await assertLayout(page, 'desktop initial review'));
    let failPostActivationStateRefresh = true;
    await page.route('**/api/school/state', async (route) => {
      if (failPostActivationStateRefresh && route.request().method() === 'GET') {
        failPostActivationStateRefresh = false;
        expectedInterceptedStateFailures += 1;
        expectedInterceptedConsoleErrors += 1;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'intercepted_state_refresh_failure' }),
        });
        return;
      }
      await route.continue();
    });
    await page.getByRole('button', { name: 'Confirm setup', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('without submitting it again');
    const activationRequestsBeforeReload = schoolRequestPayloads.filter(
      (request) => request.path === '/api/school/onboarding/complete',
    );
    expect(activationRequestsBeforeReload).toHaveLength(1);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/school\/placement$/);
    expect(schoolRequestPayloads.filter(
      (request) => request.path === '/api/school/onboarding/complete',
    )).toHaveLength(1);
    await page.unroute('**/api/school/state');
    await expect(page.getByRole('heading', { name: 'Find the right starting point', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start readiness check', exact: true })).toBeVisible();

    await page.goto(`${BASE_URL}/school`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Class 3 · English · Teaching in Hinglish', { exact: true })).toBeVisible();
    await page.goto(`${BASE_URL}/school/onboarding`, { waitUntil: 'domcontentloaded' });
    await expectFocusedHeading(page, 'Learner details');
    await continueExistingStep(page, 'Class and subject');
    await continueExistingStep(page, 'Teaching language');
    await continueExistingStep(page, 'Goals and difficulty');
    await continueExistingStep(page, 'Review and confirm');
    await expect(page.getByText('No compatibility changes detected.', { exact: false })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Material changes to curriculum/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expectFocusedHeading(page, 'Goals and difficulty');
    await page.getByLabel('Parent goal').fill('Build a steady weekly reading habit.');
    await continueExistingStep(page, 'Review and confirm');
    await expect(page.getByText('No compatibility changes detected.', { exact: false })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Material changes to curriculum/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Save without restart', exact: true }).click();
    await expect(page).toHaveURL(/\/school\/placement$/);

    await page.goto(`${BASE_URL}/school/onboarding`, { waitUntil: 'domcontentloaded' });
    await expectFocusedHeading(page, 'Learner details');
    await continueExistingStep(page, 'Class and subject');
    await continueExistingStep(page, 'Teaching language');
    await page.getByRole('radio', { name: 'I am comfortable and want sharper practice', exact: true }).click();
    await continueExistingStep(page, 'Goals and difficulty');
    await continueExistingStep(page, 'Review and confirm');
    await expect(page.getByText('Confirm setup changes', { exact: true })).toBeVisible();
    await expect(page.getByText(/restart incompatible current School work/)).toBeVisible();
    await page.getByRole('button', { name: 'Confirm and activate', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Confirm the School work restart notice');
    await page.getByRole('checkbox', { name: /Material changes to curriculum/ }).check();
    await page.getByRole('button', { name: 'Confirm and activate', exact: true }).click();
    await expect(page).toHaveURL(/\/school\/placement$/);
    await expect(page.getByRole('button', { name: 'Start readiness check', exact: true })).toBeVisible();
    layoutEvidence.push(await assertLayout(page, 'desktop authorized readiness landing'));

    const requestShapeCounts = Object.entries(schoolRequestPayloads.reduce<Record<string, number>>(
      (counts, request) => {
        const shape = `${request.path} [${Object.keys(request.payload).sort().join(',')}]`;
        counts[shape] = (counts[shape] ?? 0) + 1;
        return counts;
      },
      {},
    )).map(([shape, count]) => ({ shape, count }));
    await testInfo.attach('phase-b-browser-evidence.json', {
      body: JSON.stringify({
        qa_identity_verified: true,
        final_path: new URL(page.url()).pathname,
        layout_evidence: layoutEvidence,
        school_requests: schoolRequests,
        request_shape_counts: requestShapeCounts,
        placement_start_request_count: schoolRequests.filter(
          (entry) => entry.includes('POST /api/school/placement/start'),
        ).length,
        console_error_count: consoleErrors.length,
        failed_request_count: failedRequests.length,
        http_error_count: httpErrors.length,
      }, null, 2),
      contentType: 'application/json',
    });

    expect(schoolRequests.filter((entry) => entry.includes('POST /api/school/placement/start'))).toEqual([]);
    const savePayloads = schoolRequestPayloads.filter((request) => request.path === '/api/school/onboarding');
    const activationPayloads = schoolRequestPayloads.filter(
      (request) => request.path === '/api/school/onboarding/complete',
    );
    expect(savePayloads.length).toBeGreaterThan(0);
    expect(activationPayloads).toHaveLength(3);
    expect(new Set(schoolRequestPayloads.map((request) => request.payload.request_id)).size)
      .toBe(schoolRequestPayloads.length);
    for (const request of schoolRequestPayloads) {
      expect(request.payload.request_id).toMatch(/^[0-9a-f-]{36}$/i);
    }
    for (const request of savePayloads) {
      const hasProfileLineage = typeof request.payload.profile_version_id === 'string';
      const hasRevisionLineage = typeof request.payload.expected_revision === 'number';
      expect(hasProfileLineage).toBe(hasRevisionLineage);
      if (hasProfileLineage) {
        expect(request.payload.profile_version_id).toMatch(/^[0-9a-f-]{36}$/i);
        expect(request.payload.expected_revision).toEqual(expect.any(Number));
      }
    }
    for (const request of activationPayloads) {
      expect(Object.keys(request.payload).sort()).toEqual([
        'expected_revision',
        'profile_version_id',
        'request_id',
      ]);
      expect(request.payload.expected_revision).toEqual(expect.any(Number));
    }
    expect(JSON.stringify(schoolRequestPayloads)).not.toMatch(/access.?token|authorization|cookie|bearer/i);
    expect(requestCaptureErrors).toEqual([]);
    expect(expectedInterceptedStateFailures).toBe(0);
    expect(expectedInterceptedConsoleErrors).toBe(0);
    expect(failedRequests).toEqual([]);
    expect(httpErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    await stopTrace(resumed.context, testInfo, 'resumed-context');
    await resumed.context.close();
    resumedContext = null;
  } finally {
    if (firstContext) {
      await firstContext.tracing.stop().catch(() => {});
      await firstContext.close();
    }
    if (resumedContext) {
      await resumedContext.tracing.stop().catch(() => {});
      await resumedContext.close();
    }
  }
});

test('Phase B dedicated School profile signs out, remains protected, and signs back in', async ({}, testInfo) => {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const defaultContext = browser.contexts()[0];
  expect(defaultContext, 'dedicated Chrome profile must expose its default context').toBeTruthy();
  const page = await defaultContext.newPage();

  try {
    await setExactCssViewport(page, VIEWPORTS.desktop);
    await page.goto(`${BASE_URL}/school`, { waitUntil: 'domcontentloaded' });
    if (await currentSessionEmail(page) === null) {
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await signInWithQaGoogleAccount(page);
      await page.goto(`${BASE_URL}/school`, { waitUntil: 'domcontentloaded' });
    }
    await verifyQaIdentity(page);
    await expect(page.getByText('Class 3 · English · Teaching in Hinglish', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL(/\/auth\/login/);

    await page.goto(`${BASE_URL}/school`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/auth\/login\?callbackUrl=%2Fschool/);
    await page.getByRole('button', { name: /continue with google/i }).click();
    await signInWithQaGoogleAccount(page);

    await page.goto(`${BASE_URL}/school`, { waitUntil: 'domcontentloaded' });
    await verifyQaIdentity(page);
    await expect(page.getByText('Class 3 · English · Teaching in Hinglish', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start readiness check', exact: true })).toBeVisible();
    await testInfo.attach('phase-b-auth-evidence.json', {
      body: JSON.stringify({
        qa_identity_verified: true,
        school_state_restored: true,
        final_path: new URL(page.url()).pathname,
      }, null, 2),
      contentType: 'application/json',
    });
  } finally {
    await page.close();
  }
});
