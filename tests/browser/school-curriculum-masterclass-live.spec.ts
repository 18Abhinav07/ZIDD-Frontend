import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, expect, test, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';
const CDP_URL = 'http://127.0.0.1:9225';

async function visibleSchoolPage(): Promise<Page> {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  if (!context) throw new Error('Dedicated School Chrome context is unavailable');
  const page = context.pages().find((candidate) => candidate.url().startsWith(BASE_URL))
    ?? await context.newPage();
  page.setDefaultTimeout(0);
  await page.bringToFront();
  await page.goto(`${BASE_URL}/school/curriculum`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/auth/login')) throw new Error('School Chrome is not authenticated');
  return page;
}

async function answerOption(page: Page, answer: string) {
  const previousKind = ((await page.getByTestId('school-curriculum-kind').textContent()) ?? '').trim();
  const previousQuestion = (await page.getByTestId('school-curriculum-question').innerText()).trim();
  await page.getByRole('button', { name: answer, exact: true }).click();
  await page.waitForFunction(({ kind, question }) => {
    const handoff = document.querySelector('[data-testid="school-curriculum-masterclass-handoff"]');
    const currentKind = document.querySelector('[data-testid="school-curriculum-kind"]')?.textContent?.trim();
    const currentQuestion = document.querySelector('[data-testid="school-curriculum-question"]')?.textContent?.trim();
    const error = Array.from(document.querySelectorAll('[role="alert"]'))
      .some((node) => Boolean(node.textContent?.trim()));
    return Boolean(handoff || error || currentKind !== kind || currentQuestion !== question);
  }, { kind: previousKind, question: previousQuestion });
}

test('visible learner pauses a chapter, completes linked practice, and resumes exact work', async () => {
  const page = await visibleSchoolPage();
  const startChapter = page.getByRole('button', { name: /Start Chapter 1/i });
  await expect(startChapter.or(page.getByTestId('school-curriculum-card'))).toBeVisible({ timeout: 0 });
  if (await startChapter.isVisible()) await startChapter.click();
  await expect(page.getByTestId('school-curriculum-card')).toBeVisible({ timeout: 0 });

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
  await expect(page.getByTestId('school-curriculum-masterclass-handoff')).toBeVisible({ timeout: 0 });

  await page.getByRole('button', { name: 'Start focused practice', exact: true }).click();
  await expect(page.getByTestId('school-masterclass-card')).toBeVisible({ timeout: 0 });
  transcript.push({
    kind: 'Focused masterclass',
    teaching: (await page.getByTestId('school-masterclass-teaching').innerText()).trim(),
    passage: (await page.getByTestId('school-masterclass-passage').innerText()).trim(),
    question: (await page.getByTestId('school-masterclass-question').innerText()).trim(),
    answer: 'share',
  });
  await page.getByRole('button', { name: 'share', exact: true }).click();
  await expect(page.getByTestId('school-masterclass-complete')).toBeVisible({ timeout: 0 });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('school-masterclass-complete')).toBeVisible({ timeout: 0 });
  await page.getByRole('button', { name: 'Return to chapter', exact: true }).click();
  await expect(page.getByTestId('school-curriculum-card')).toBeVisible({ timeout: 0 });
  await expect(page.getByTestId('school-curriculum-kind')).toHaveText('Independent check');

  const outputDirectory = path.resolve('test-results/school-browser');
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, 'live-curriculum-masterclass-log.json'),
    JSON.stringify({ finalUrl: page.url(), transcript }, null, 2),
    'utf8',
  );
});
