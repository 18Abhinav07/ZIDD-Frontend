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
  assert.match(supportActivity, /<h2[\s\S]*?data-testid=\{`\$\{testIdPrefix\}-question`\}[\s\S]*?>[\s\S]*?\{prompt\}[\s\S]*?<\/h2>/);
  assert.match(recap, /title=\{activity\.title\}/);
  assert.match(masterclass, /title=\{activity\.title\}/);
});

test('Learning Back and progress disclosures expose 44px targets without adding layout density', () => {
  const backButtonRule = workspaceStyles.match(/\.backButton \{[\s\S]*?\n\}/)?.[0] ?? '';

  assert.match(backButtonRule, /width: 44px;/);
  assert.match(backButtonRule, /height: 44px;/);
  assert.match(backButtonRule, /margin: -1px;/);

  for (const [name, progress] of [
    ['tutor', progressRail],
    ['recap', recap],
  ] as const) {
    const summary = progress.match(/<summary className="[^"]+"/)?.[0] ?? '';
    assert.match(summary, /min-h-11/, `${name} progress disclosure needs a 44px minimum target`);
    assert.match(summary, /-my-1\.5/, `${name} progress disclosure must preserve its occupied height`);
    assert.match(summary, /py-1\.5/, `${name} progress disclosure must preserve its visual density`);
  }
});
