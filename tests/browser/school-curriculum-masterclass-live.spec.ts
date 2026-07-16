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

async function visibleSchoolPage(): Promise<Page> {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  if (!context) throw new Error('Dedicated School Chrome context is unavailable');
  const page = context.pages().find((candidate) => candidate.url().startsWith(BASE_URL))
    ?? await context.newPage();
  page.setDefaultTimeout(SCHOOL_BROWSER_ACTION_TIMEOUT_MS);
  page.setDefaultNavigationTimeout(SCHOOL_BROWSER_NAVIGATION_TIMEOUT_MS);
  await page.bringToFront();
  await page.goto(`${BASE_URL}/school/curriculum`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/auth/login')) throw new Error('School Chrome is not authenticated');
  return page;
}

async function answerOption(page: Page, answer: string) {
  const previousKind = ((await page.getByTestId('school-curriculum-kind').textContent()) ?? '').trim();
  const previousQuestion = (await page.getByTestId('school-curriculum-question').innerText()).trim();
  await page.getByRole('radio', { name: answer, exact: true }).check();
  await page.getByRole('button', { name: 'Check my answer', exact: true }).click();
  await page.waitForFunction(({ kind, question }) => {
    const handoff = document.querySelector('[data-testid="school-curriculum-masterclass-handoff"]');
    const currentKind = document.querySelector('[data-testid="school-curriculum-kind"]')?.textContent?.trim();
    const currentQuestion = document.querySelector('[data-testid="school-curriculum-question"]')?.textContent?.trim();
    const error = Array.from(document.querySelectorAll('[role="alert"]'))
      .some((node) => Boolean(node.textContent?.trim()));
    return Boolean(handoff || error || currentKind !== kind || currentQuestion !== question);
  }, { kind: previousKind, question: previousQuestion }, {
    timeout: SCHOOL_EVALUATOR_EXPECT_TIMEOUT_MS,
  });
}

test('visible learner pauses a chapter, completes linked practice, and resumes exact work', async () => {
  test.setTimeout(SCHOOL_EVALUATOR_FLOW_TIMEOUT_MS);
  const page = await visibleSchoolPage();
  const startChapter = page.getByRole('button', { name: /Start Chapter 1/i });
  await expect(startChapter.or(page.getByTestId('school-curriculum-card'))).toBeVisible({
    timeout: SCHOOL_BROWSER_EXPECT_TIMEOUT_MS,
  });
  if (await startChapter.isVisible()) await startChapter.click();
  await expect(page.getByTestId('school-curriculum-card')).toBeVisible({
    timeout: SCHOOL_BROWSER_EXPECT_TIMEOUT_MS,
  });

  const transcript: Array<Record<string, string>> = [];
  transcript.push({
    kind: ((await page.getByTestId('school-curriculum-kind').textContent()) ?? '').trim(),
    teaching: (await page.getByTestId('school-curriculum-teaching').innerText()).trim(),
    passage: (await page.getByTestId('school-curriculum-passage').innerText()).trim(),
    question: (await page.getByTestId('school-curriculum-question').innerText()).trim(),
    answer: 'hide',
  });
  await answerOption(page, 'hide');
  await expect(page.getByTestId('school-curriculum-kind')).toHaveText('Bridge support');

  transcript.push({
    kind: ((await page.getByTestId('school-curriculum-kind').textContent()) ?? '').trim(),
    teaching: (await page.getByTestId('school-curriculum-teaching').innerText()).trim(),
    passage: (await page.getByTestId('school-curriculum-passage').innerText()).trim(),
    question: (await page.getByTestId('school-curriculum-question').innerText()).trim(),
    answer: 'sleep',
  });
  await answerOption(page, 'sleep');
  await expect(page.getByTestId('school-curriculum-masterclass-handoff')).toBeVisible({
    timeout: SCHOOL_BROWSER_EXPECT_TIMEOUT_MS,
  });

  await page.getByRole('button', { name: 'Start focused practice', exact: true }).click();
  await expect(page.getByTestId('school-masterclass-card')).toBeVisible({
    timeout: SCHOOL_BROWSER_EXPECT_TIMEOUT_MS,
  });
  transcript.push({
    kind: 'Focused masterclass',
    teaching: (await page.getByTestId('school-masterclass-teaching').innerText()).trim(),
    passage: (await page.getByTestId('school-masterclass-passage').innerText()).trim(),
    question: (await page.getByTestId('school-masterclass-question').innerText()).trim(),
    answer: 'share',
  });
  await page.getByRole('radio', { name: 'share', exact: true }).check();
  await page.getByRole('button', { name: 'Check my answer', exact: true }).click();
  await expect(page.getByTestId('school-masterclass-complete')).toBeVisible({
    timeout: SCHOOL_EVALUATOR_EXPECT_TIMEOUT_MS,
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('school-masterclass-complete')).toBeVisible({
    timeout: SCHOOL_BROWSER_EXPECT_TIMEOUT_MS,
  });
  await page.getByRole('button', { name: 'Return to chapter', exact: true }).click();
  await expect(page.getByTestId('school-curriculum-card')).toBeVisible({
    timeout: SCHOOL_BROWSER_EXPECT_TIMEOUT_MS,
  });
  await expect(page.getByTestId('school-curriculum-kind')).toHaveText('Independent check');

  const outputDirectory = path.resolve('test-results/school-browser');
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, 'live-curriculum-masterclass-log.json'),
    JSON.stringify({ finalUrl: page.url(), transcript }, null, 2),
    'utf8',
  );
});
