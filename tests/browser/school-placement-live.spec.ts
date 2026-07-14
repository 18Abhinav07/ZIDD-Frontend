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
const SCENARIO = process.env.SCHOOL_PLACEMENT_SCENARIO ?? 'target_ready';

const ANSWERS: Array<{ match: RegExp; answer: string }> = [
  { match: /Where did Rina sit/i, answer: 'on the mat' },
  { match: /mostly about/i, answer: 'caring for a dog' },
  { match: /Why did Kabir switch on the lamp/i, answer: 'Kabir switched on the lamp because the room was dark.' },
  { match: /What does tiny mean/i, answer: 'small' },
  { match: /Which word names a thing/i, answer: 'flower' },
  { match: /Which word names a person/i, answer: 'teacher' },
  { match: /Which word shows a past action/i, answer: 'played' },
  { match: /complete English sentence about the bird/i, answer: 'The bird rests on a branch and watches the garden below.' },
  { match: /Where did the children go, and why/i, answer: 'The children went under a tree because the afternoon sun was hot.' },
];

type JourneyRow = {
  number: number;
  stage: string;
  instruction: string;
  passage: string;
  prompt: string;
  support: string;
  answer: string;
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
  await page.goto(`${BASE_URL}/school/placement`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/auth/login')) {
    throw new Error('Dedicated School Chrome profile is not authenticated');
  }
  return page;
}

function answerFor(prompt: string): string {
  if (SCENARIO === 'below_target' && /Which word names a thing/i.test(prompt)) {
    return 'red';
  }
  const row = ANSWERS.find((candidate) => candidate.match.test(prompt));
  if (!row) throw new Error(`No real-learner answer prepared for visible prompt: ${prompt}`);
  return row.answer;
}

test('visible authenticated learner completes the Class 3 readiness snapshot', async () => {
  test.setTimeout(SCHOOL_EVALUATOR_FLOW_TIMEOUT_MS);
  const page = await visibleSchoolPage();
  const start = page.getByRole('button', { name: 'Start readiness check', exact: true });
  const reportButton = page.getByRole('button', { name: 'View readiness report', exact: true });
  const reportHeading = page.getByRole('heading', { name: 'Your starting point', exact: true });
  await expect(
    start
      .or(page.getByTestId('school-placement-question'))
      .or(reportButton)
      .or(reportHeading),
  ).toBeVisible({ timeout: SCHOOL_BROWSER_EXPECT_TIMEOUT_MS });
  if (await start.isVisible()) await start.click();

  const transcript: JourneyRow[] = [];
  for (let number = 1; number <= 18; number += 1) {
    if (await reportButton.isVisible() || await reportHeading.isVisible()) break;
    const question = page.getByTestId('school-placement-question');
    await expect(question).toBeVisible({ timeout: SCHOOL_BROWSER_EXPECT_TIMEOUT_MS });
    const prompt = (await question.innerText()).trim();
    const answer = answerFor(prompt);
    const stage = (await page.getByTestId('school-placement-progress').innerText()).trim();
    transcript.push({
      number,
      stage,
      instruction: (await page.getByTestId('school-placement-instruction').innerText()).trim(),
      passage: (await page.getByTestId('school-placement-passage').innerText()).trim(),
      prompt,
      support: (await page.getByTestId('school-placement-support').innerText()).trim(),
      answer,
    });

    console.log(`[placement ${stage}] ${prompt} -> ${answer}`);

    const option = page.getByRole('button', { name: answer, exact: true });
    if (await option.isVisible()) {
      await option.click();
    } else {
      await page.getByLabel('Your readiness answer').fill(answer);
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
    }

    await page.waitForFunction((previousPrompt) => {
      const current = document.querySelector('h2[tabindex="-1"]');
      const hasLearnerError = Array.from(document.querySelectorAll('[role="alert"]'))
        .some((alert) => Boolean(alert.textContent?.trim()));
      return hasLearnerError || !current || current.textContent?.trim() !== previousPrompt;
    }, prompt, { timeout: SCHOOL_EVALUATOR_EXPECT_TIMEOUT_MS });
    const alert = page.locator('[role="alert"]').filter({ hasText: /\S/ }).first();
    if (await alert.isVisible()) {
      throw new Error(`Visible placement submission failed: ${(await alert.innerText()).trim()}`);
    }
  }

  if (await reportButton.isVisible()) await reportButton.click();
  await expect(reportHeading).toBeVisible({ timeout: SCHOOL_BROWSER_EXPECT_TIMEOUT_MS });
  if (SCENARIO === 'below_target') {
    await expect(page.getByRole('button', { name: 'Start recap path', exact: true })).toBeVisible();
  } else {
    await expect(page.getByRole('button', { name: 'Start target class', exact: true })).toBeVisible();
  }

  const outputDirectory = path.resolve('test-results/school-browser');
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, `live-placement-${SCENARIO}-log.json`),
    JSON.stringify({ scenario: SCENARIO, finalUrl: page.url(), transcript }, null, 2),
    'utf8',
  );
});
