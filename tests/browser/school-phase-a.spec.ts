import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';
import {
  SCHOOL_ACTION_LABELS,
  createIsolatedSchoolContext,
} from './school-browser-contract.mjs';

const BASE_URL = 'http://localhost:3001';
const CDP_URL = process.env.ZIDD_CDP_URL || 'http://127.0.0.1:9222';
const SCHOOL_QA_EMAIL = 'theopenassets@gmail.com';

const LEGACY_SCHOOL_URLS = [
  '/subjects',
  '/subjects/v2',
  '/subjects/v3',
  '/subjects/class/5',
  '/subjects/test/legacy-school-test',
] as const;

type SchoolState = {
  status: string;
  next_action: string | null;
  next_action_url: string;
  allowed_next_actions: string[];
  learner_message: string;
  parent_message: string;
};

async function schoolPage(): Promise<{ context: BrowserContext; page: Page }> {
  const browser = await chromium.connectOverCDP(CDP_URL);
  return createIsolatedSchoolContext(browser, BASE_URL) as Promise<{
    context: BrowserContext;
    page: Page;
  }>;
}

type SchoolAction = keyof typeof SCHOOL_ACTION_LABELS;

function isSchoolAction(action: string): action is SchoolAction {
  return Object.prototype.hasOwnProperty.call(SCHOOL_ACTION_LABELS, action);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('Phase A School shell and legacy quarantine use the dedicated authenticated profile', async ({}, testInfo) => {
  const { context, page } = await schoolPage();
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const httpErrors: string[] = [];
  const visitedUrls: string[] = [];
  const tracePath = testInfo.outputPath('trace.zip');
  let tracingStarted = false;

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`);
  });
  page.on('response', (response) => {
    const url = response.url();
    if (
      response.status() >= 400
      && url.startsWith(BASE_URL)
      && !url.endsWith('/favicon.ico')
    ) {
      httpErrors.push(`${response.status()} ${response.request().method()} ${url}`);
    }
  });

  try {
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    tracingStarted = true;
    await page.goto(`${BASE_URL}/school`, { waitUntil: 'domcontentloaded' });
    visitedUrls.push(page.url());
    await expect(page.getByRole('heading', { name: 'Your school path' })).toBeVisible();

    // The backend access token stays inside browser memory. The test runner
    // receives only identity and public School-state evidence.
    const authenticatedState = await page.evaluate(async (expectedEmail: string) => {
      const sessionResponse = await fetch('/api/auth/session', { cache: 'no-store' });
      const session = await sessionResponse.json();
      const email = session?.user?.email ?? null;
      const accessToken = typeof session?.accessToken === 'string'
        ? session.accessToken
        : null;
      const tokenInPageBody = accessToken
        ? document.body.innerHTML.includes(accessToken)
        : false;
      if (email !== expectedEmail || !accessToken) {
        return {
          email,
          tokenPresent: Boolean(accessToken),
          tokenInPageBody,
          status: 0,
          body: null,
          bodyPreview: 'authenticated_school_session_missing',
        };
      }
      const response = await fetch('/api/school/state', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const bodyText = await response.text();
      let body: SchoolState | null = null;
      try {
        body = JSON.parse(bodyText) as SchoolState;
      } catch {
        // The body preview keeps upstream failures diagnosable without
        // returning credentials or full server responses.
      }
      return {
        email,
        tokenPresent: true,
        tokenInPageBody,
        status: response.status,
        body,
        bodyPreview: bodyText.slice(0, 300),
      };
    }, SCHOOL_QA_EMAIL) as {
      email: string | null;
      tokenPresent: boolean;
      tokenInPageBody: boolean;
      status: number;
      body: SchoolState | null;
      bodyPreview: string;
    };

    expect(authenticatedState.email).toBe(SCHOOL_QA_EMAIL);
    expect(authenticatedState.tokenPresent).toBe(true);
    expect(authenticatedState.tokenInPageBody).toBe(false);
    expect(authenticatedState.status, authenticatedState.bodyPreview).toBe(200);
    expect(authenticatedState.body).not.toBeNull();
    if (!authenticatedState.body) throw new Error('school_state_json_missing');
    const state = authenticatedState.body;
    expect(Array.isArray(state.allowed_next_actions)).toBe(true);
    expect(state.next_action === null
      ? state.allowed_next_actions.length === 0
      : state.allowed_next_actions.includes(state.next_action)).toBe(true);
    expect(state.next_action_url.startsWith('/school')).toBe(true);
    await expect(page.getByText(state.learner_message, { exact: true })).toBeVisible();
    await expect(page.getByText(state.parent_message, { exact: true })).toBeVisible();
    await expect(page.getByText(/School V2|School V3/)).toHaveCount(0);

    const actionLabelPattern = new RegExp(
      `^(?:${Object.values(SCHOOL_ACTION_LABELS).map(escapeRegExp).join('|')})$`,
    );
    const schoolActionControls = page.locator('main').getByRole('button', {
      name: actionLabelPattern,
    });
    for (const action of state.allowed_next_actions) {
      expect(isSchoolAction(action), `Unknown School action: ${action}`).toBe(true);
      if (!isSchoolAction(action)) throw new Error(`unknown_school_action:${action}`);
      await expect(page.locator('main').getByRole('button', {
        name: SCHOOL_ACTION_LABELS[action],
        exact: true,
      })).toBeVisible();
    }
    const shellButtons = (await schoolActionControls.allTextContents())
      .map((label) => label.trim())
      .filter(Boolean);
    await expect(schoolActionControls).toHaveCount(state.allowed_next_actions.length);
    if (state.allowed_next_actions.length === 0) expect(shellButtons).toEqual([]);

    await page.screenshot({
      path: testInfo.outputPath('school-shell.png'),
      fullPage: true,
    });

    for (const legacyPath of LEGACY_SCHOOL_URLS) {
      await page.goto(`${BASE_URL}${legacyPath}`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(`${BASE_URL}/school`);
      await expect(page.getByRole('heading', { name: 'Your school path' })).toBeVisible();
      visitedUrls.push(`${legacyPath} -> ${page.url()}`);
    }

    const evidence = {
      account: SCHOOL_QA_EMAIL,
      cdp_url: CDP_URL,
      frontend_url: BASE_URL,
      current_url: page.url(),
      visited_urls: visitedUrls,
      school_state: {
        status: state.status,
        next_action: state.next_action,
        next_action_url: state.next_action_url,
        allowed_next_actions: state.allowed_next_actions,
      },
      visible_evidence: {
        heading: 'Your school path',
        learner_message: state.learner_message,
        parent_message: state.parent_message,
        action_labels: shellButtons,
        prompt_answer_feedback: {
          applicable: false,
          reason: 'Phase A validates route and state quarantine before a learning activity.',
        },
      },
      console_errors: consoleErrors,
      failed_requests: failedRequests,
      http_errors: httpErrors,
    };
    await testInfo.attach('phase-a-browser-evidence.json', {
      body: JSON.stringify(evidence, null, 2),
      contentType: 'application/json',
    });

    expect(failedRequests).toEqual([]);
    expect(httpErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  } finally {
    try {
      if (tracingStarted) await context.tracing.stop({ path: tracePath });
    } finally {
      await context.close();
    }
  }
});
