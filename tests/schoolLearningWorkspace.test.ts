import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('School teaching uses its canonical two-region workspace', () => {
  const shell = read('src/components/school/SchoolLearningWorkspace.tsx');
  const learning = read('src/components/school/SchoolLearningShell.tsx');
  const tutor = read('src/components/school/tutor/SchoolTutorWorkspace.tsx');

  assert.match(shell, /data-school-region="coach-rail"/);
  assert.match(shell, /data-school-region="activity-surface"/);
  assert.match(shell, /actions\?: ReactNode/);
  assert.match(shell, /aria-label="Activity controls"/);
  assert.match(shell, /showBack\?: boolean/);
  assert.match(shell, /showBack && onBack/);
  assert.doesNotMatch(shell, /grid-cols-\[.*_.*_.*/);
  assert.match(learning, /SchoolLearningWorkspace/);
  assert.match(tutor, /SchoolLearningWorkspace/);
  assert.doesNotMatch(learning + tutor, /components\/learning\/LearningWorkspace/);
});

test('terminal focused practice exposes one primary return action', () => {
  const masterclass = read('src/app/school/masterclass/[sessionId]/page.tsx');

  assert.match(masterclass, /showBack=\{session\?\.status === 'active'\}/);
  assert.match(masterclass, /onClick=\{returnFromComplete\}/);
});

test('terminal curriculum states expose their map exit once in the activity surface', () => {
  const tutor = read('src/components/school/tutor/SchoolTutorWorkspace.tsx');

  assert.match(
    tutor,
    /const showWorkspaceBack = activityView\.kind === 'activity'\s*\|\| \(session\.phase === 'paused_for_masterclass' && session\.active_interrupt !== null\);/,
  );
  assert.match(tutor, /<SchoolLearningWorkspace[\s\S]{0,240}showBack=\{showWorkspaceBack\}/);
});

test('lesson progress is compact and options remain scannable', () => {
  const progress = read('src/components/school/tutor/SchoolProgressRail.tsx');
  const activity = read('src/components/school/tutor/SchoolActivityRenderer.tsx');
  const support = read('src/components/school/support/SchoolSupportActivity.tsx');
  const recap = read('src/app/school/recap/page.tsx');
  const masterclass = read('src/app/school/masterclass/[sessionId]/page.tsx');

  assert.match(progress, /role="progressbar"/);
  assert.doesNotMatch(progress, /<details|session\.levels\.map|memory_summary/);
  assert.match(recap, /data-testid="school-recap-progress"/);
  assert.doesNotMatch(recap, /data-testid="school-recap-progress"[\s\S]*?<details/);
  assert.match(masterclass, /data-testid="school-masterclass-context"/);
  assert.doesNotMatch(masterclass, /data-testid="school-masterclass-context"[\s\S]*?<details/);
  assert.doesNotMatch(activity + support, /sm:grid-cols-2/);
});

test('mobile learning reflows the same coach dialogue above the activity', () => {
  const workspace = read('src/components/school/SchoolLearningWorkspace.tsx');
  const learning = read('src/components/school/SchoolLearningShell.tsx');
  const tutor = read('src/components/school/tutor/SchoolTutorWorkspace.tsx');
  const coach = read('src/components/school/SchoolCoachPanel.tsx');
  const styles = read('src/components/school/SchoolLearningWorkspace.module.css');

  assert.doesNotMatch(workspace, /data-school-region="mobile-coach"|mobileCoach/);
  assert.equal((learning.match(/<SchoolCoachPanel/g) ?? []).length, 1);
  assert.equal((tutor.match(/<SchoolCoachPanel/g) ?? []).length, 1);
  assert.match(coach, /data-testid="school-coach-dialogue"/);
  assert.match(styles, /grid-template-columns:\s*minmax\(320px, 360px\) minmax\(0, 1fr\)/);
  assert.match(styles, /\.coachRail\s*\{[^}]*height:\s*100%/);
  assert.match(styles, /\.activitySurface\s*\{[^}]*height:\s*100%/);
  assert.match(styles, /@media \(max-width: 820px\)[\s\S]*?\.coachRail\s*\{[^}]*height:\s*auto/);
});
