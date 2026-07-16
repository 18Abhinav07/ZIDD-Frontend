import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, expect, test, type Page } from '@playwright/test';
import {
  SCHOOL_BROWSER_ACTION_TIMEOUT_MS,
  SCHOOL_BROWSER_EXPECT_TIMEOUT_MS,
  SCHOOL_BROWSER_NAVIGATION_TIMEOUT_MS,
  SCHOOL_EVALUATOR_EXPECT_TIMEOUT_MS,
  SCHOOL_EVALUATOR_FLOW_TIMEOUT_MS,
} from './school-browser-timeouts';

const BASE_URL = 'http://localhost:3001';
const CDP_URL = process.env.ZIDD_CDP_URL || 'http://127.0.0.1:9222';
const SCENARIO = process.env.SCHOOL_RECAP_SCENARIO ?? 'happy';

type RecapRow = {
  kind: string;
  teaching: string;
  passage: string;
  question: string;
  answer: string;
  feedback: string;
};

async function visibleSchoolPage(): Promise<Page> {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  if (!context) throw new Error('Dedicated School Chrome context is unavailable');
  const page = context.pages().find((candidate) => candidate.url().startsWith(BASE_URL))
    ?? await context.newPage();
  page.setDefaultTimeout(SCHOOL_BROWSER_ACTION_TIMEOUT_MS);
  page.setDefaultNavigationTimeout(SCHOOL_BROWSER_NAVIGATION_TIMEOUT_MS);
  await page.bringToFront();
  await page.goto(`${BASE_URL}/school/placement/report`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/auth/login')) {
    throw new Error('Dedicated School Chrome profile is not authenticated');
  }
  return page;
}

function learnerAnswer(question: string, kind: string, rowNumber: number): string {
  if (SCENARIO === 'remediation' && rowNumber === 0 && kind === 'Guided check') return 'wrote';
  if (SCENARIO === 'remediation' && kind === 'Bridge support') return 'held';
  if (/names a person/i.test(question)) return 'teacher';
  if (/describes the blanket/i.test(question)) return 'soft';
  if (/shows an action/i.test(question)) return 'rushed';
  if (/describes the fort/i.test(question)) return 'ancient';
  throw new Error(`No learner answer prepared for visible recap prompt: ${question}`);
}

test('visible learner completes the authored personalized readiness path', async () => {
  test.setTimeout(SCHOOL_EVALUATOR_FLOW_TIMEOUT_MS);
  const page = await visibleSchoolPage();
  const start = page.getByRole('button', { name: 'Start recap path', exact: true });
  await expect(start.or(page.getByTestId('school-recap-card')).or(page.getByTestId('school-recap-complete')))
    .toBeVisible({ timeout: SCHOOL_BROWSER_EXPECT_TIMEOUT_MS });
  if (await start.isVisible()) await start.click();

  await expect(page.getByTestId('school-recap-card').or(page.getByTestId('school-recap-complete')))
    .toBeVisible({ timeout: SCHOOL_BROWSER_EXPECT_TIMEOUT_MS });

  const transcript: RecapRow[] = [];
  for (let rowNumber = 0; rowNumber < 10; rowNumber += 1) {
    if (await page.getByTestId('school-recap-complete').isVisible()) break;

    const questionNode = page.getByTestId('school-recap-question');
    await expect(questionNode).toBeVisible({ timeout: SCHOOL_BROWSER_EXPECT_TIMEOUT_MS });
    const kind = ((await page.getByTestId('school-recap-kind').textContent()) ?? '').trim();
    const question = (await questionNode.innerText()).trim();
    const answer = learnerAnswer(question, kind, rowNumber);
    const row: RecapRow = {
      kind,
      teaching: (await page.getByTestId('school-recap-teaching').innerText()).trim(),
      passage: (await page.getByTestId('school-recap-passage').innerText()).trim(),
      question,
      answer,
      feedback: '',
    };
    console.log(`[recap ${kind}] ${question} -> ${answer}`);

    const option = page.getByRole('radio', { name: answer, exact: true });
    if (await option.isVisible()) {
      await option.check();
    } else {
      await page.getByLabel('Your recap answer').fill(answer);
    }
    await page.getByRole('button', { name: 'Check my answer', exact: true }).click();

    await page.waitForFunction(({ previousQuestion, previousKind }) => {
      const question = document.querySelector('[data-testid="school-recap-question"]');
      const kind = document.querySelector('[data-testid="school-recap-kind"]');
      const complete = document.querySelector('[data-testid="school-recap-complete"]');
      const error = Array.from(document.querySelectorAll('[role="alert"]'))
        .some((node) => Boolean(node.textContent?.trim()));
      return Boolean(
        complete
        || error
        || !question
        || question.textContent?.trim() !== previousQuestion
        || kind?.textContent?.trim() !== previousKind
      );
    }, { previousQuestion: question, previousKind: kind }, {
      timeout: SCHOOL_EVALUATOR_EXPECT_TIMEOUT_MS,
    });
    const alert = page.locator('[role="alert"]').filter({ hasText: /\S/ }).first();
    if (await alert.isVisible()) {
      throw new Error(`Visible recap submission failed: ${(await alert.innerText()).trim()}`);
    }
    const feedback = page.getByTestId('school-recap-feedback');
    if (await feedback.isVisible()) row.feedback = (await feedback.innerText()).trim();
    transcript.push(row);
  }

  await expect(page.getByTestId('school-recap-complete')).toBeVisible({
    timeout: SCHOOL_BROWSER_EXPECT_TIMEOUT_MS,
  });
  await expect(page.getByRole('button', { name: 'Open target class', exact: true })).toBeVisible();

  if (SCENARIO === 'happy') {
    expect(transcript.map((row) => row.kind)).toEqual([
      'Guided check',
      'Independent check',
      'Use it in a new passage',
    ]);
  } else {
    expect(transcript.map((row) => row.kind)).toContain('Bridge support');
    expect(transcript.map((row) => row.kind)).toContain('Focused masterclass');
  }

  const outputDirectory = path.resolve('test-results/school-browser');
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, `live-recap-${SCENARIO}-log.json`),
    JSON.stringify({ scenario: SCENARIO, finalUrl: page.url(), transcript }, null, 2),
    'utf8',
  );
});
