import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const tutorActivity = read('src/components/school/tutor/SchoolActivityRenderer.tsx');
const tutorWorkspace = read('src/components/school/tutor/SchoolTutorWorkspace.tsx');
const supportActivity = read('src/components/school/support/SchoolSupportActivity.tsx');
const recap = read('src/app/school/recap/page.tsx');
const masterclass = read('src/app/school/masterclass/[sessionId]/page.tsx');
const progressRail = read('src/components/school/tutor/SchoolProgressRail.tsx');
const workspaceStyles = read('src/components/school/SchoolLearningWorkspace.module.css');
const recapBrowser = read('tests/browser/school-recap-live.spec.ts');
const curriculumBrowser = read('tests/browser/school-curriculum-masterclass-live.spec.ts');

test('MCQ options select existing answer state and submit only through one explicit command', () => {
  for (const [name, activity] of [
    ['tutor', tutorActivity],
    ['shared support', supportActivity],
  ] as const) {
    assert.match(activity, /<fieldset[^>]*>[\s\S]*?<legend[^>]*>Choose one answer<\/legend>/, `${name} needs a labelled radio group`);
    assert.match(activity, /type="radio"/, `${name} choices need native radio semantics`);
    assert.match(activity, /checked=\{answer === option\}/, `${name} choices need controlled selection`);
    assert.match(activity, /onChange=\{\(\) => onAnswerChange\(option\)\}/, `${name} choices must update existing answer state`);
    assert.doesNotMatch(activity, /onClick=\{\(\) => onSubmit\(option\)\}/, `${name} option taps must not submit`);
    assert.match(activity, /onClick=\{\(\) => onSubmit\(\)\}/, `${name} needs one explicit submit command`);
    assert.match(activity, /disabled=\{submitting \|\| !answer\.trim\(\)\}/, `${name} submit must require a selection`);
    assert.match(activity, /Check my answer/, `${name} submit command needs canonical copy`);
  }

  for (const [name, parent] of [
    ['tutor', tutorWorkspace],
    ['recap', recap],
    ['focused practice', masterclass],
  ] as const) {
    assert.match(parent, /\|\| submitInFlightRef\.current/, `${name} must synchronously reject duplicate submits`);
    assert.match(parent, /submitInFlightRef\.current = true;[\s\S]*?finally \{[\s\S]*?submitInFlightRef\.current = false;/, `${name} must hold its submit lock for the full request`);
  }
});

test('tutor and recap focus new questions without moving the mobile viewport', () => {
  assert.match(tutorActivity, /questionHeadingRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(recap, /questionHeadingRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
});

test('focused browser flows select radios before explicitly checking the answer', () => {
  for (const [name, browser] of [
    ['recap', recapBrowser],
    ['curriculum and focused practice', curriculumBrowser],
  ] as const) {
    assert.match(browser, /getByRole\('radio', \{ name: answer, exact: true \}\)/, `${name} must select an option as a radio`);
    assert.match(browser, /getByRole\('button', \{ name: 'Check my answer', exact: true \}\)\.click\(\)/, `${name} must explicitly submit the selection`);
    assert.doesNotMatch(browser, /getByRole\('button', \{ name: answer, exact: true \}\)/, `${name} must not treat an option as a submit button`);
  }
});

test('shared support preserves title data without repeating the workspace activity heading', () => {
  assert.match(supportActivity, /title: string/);
  assert.match(supportActivity, /aria-label=\{title\}/);
  assert.doesNotMatch(supportActivity, /<h2[^>]*>\{title\}<\/h2>/);
  assert.match(supportActivity, /<h1[\s\S]*?data-testid=\{`\$\{testIdPrefix\}-question`\}[\s\S]*?>[\s\S]*?\{prompt\}[\s\S]*?<\/h1>/);
  assert.match(recap, /title=\{activity\.title\}/);
  assert.match(masterclass, /title=\{activity\.title\}/);
  assert.doesNotMatch(supportActivity, /teachingBlock|feedback\.message|Coach clue/);
});

test('readiness and lesson questions use measured prompt emphasis', () => {
  const lessonQuestion = tutorActivity.match(/const QUESTION_PROMPT_CLASS = '([^']+)'/)?.[1] ?? '';
  const readinessQuestion = supportActivity.match(/data-testid=\{`\$\{testIdPrefix\}-question`\}[\s\S]*?className="([^"]+)"/)?.[1] ?? '';

  for (const [name, question] of [
    ['lesson', lessonQuestion],
    ['readiness', readinessQuestion],
  ] as const) {
    assert.match(question, /\bfont-normal\b/, `${name} question should use measured emphasis`);
    assert.doesNotMatch(question, /\bfont-bold\b/, `${name} question should not read like a page headline`);
  }
});

test('continue-only teaching uses a full-width instruction panel', () => {
  const continuePrompt = tutorActivity.match(/const CONTINUE_PROMPT_CLASS = '([^']+)'/)?.[1] ?? '';

  assert.match(continuePrompt, /\bw-full\b/);
  assert.match(continuePrompt, /\bmax-w-none\b/);
  assert.match(continuePrompt, /bg-\[var\(--school-surface-soft\)\]/);
  assert.doesNotMatch(continuePrompt, /max-w-\[31ch\]|text-\[1\.85rem\]|sm:text-\[2\.35rem\]/);
  assert.match(
    tutorActivity,
    /className=\{isContinueOnlyActivity \? CONTINUE_PROMPT_CLASS : QUESTION_PROMPT_CLASS\}/,
  );
});

test('chapter checks describe the authored response action instead of calling every item an own-words answer', () => {
  assert.match(tutorActivity, /function chapterCheckInstruction\(/);
  assert.match(tutorActivity, /case 'single_choice':[\s\S]*?Choose the answer that fits best\./);
  assert.match(tutorActivity, /case 'ordering':[\s\S]*?Put the items in the requested order\./);
  assert.match(tutorActivity, /case 'sentence_completion':[\s\S]*?Complete the sentence with the best answer\./);
  assert.match(tutorActivity, /case 'paragraph_text':[\s\S]*?Use your own words and include the detail the question asks for\./);
  assert.doesNotMatch(tutorActivity, /Answer this chapter challenge in your own words\./);
});

test('Learning Back and progress strips stay compact without repeating stage content', () => {
  const backButtonRule = workspaceStyles.match(/\.backButton \{[\s\S]*?\n\}/)?.[0] ?? '';

  assert.match(backButtonRule, /width: 44px;/);
  assert.match(backButtonRule, /height: 44px;/);
  assert.match(progressRail, /role="progressbar"/);
  assert.match(recap, /data-testid="school-recap-progress"/);
  assert.doesNotMatch(progressRail + recap, /<details|View stages|View skills|session\.levels\.map|path\.modules\.map/);
});
