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
  assert.doesNotMatch(shell, /grid-cols-\[.*_.*_.*/);
  assert.match(learning, /SchoolLearningWorkspace/);
  assert.match(tutor, /SchoolLearningWorkspace/);
  assert.doesNotMatch(learning + tutor, /components\/learning\/LearningWorkspace/);
});

test('lesson progress is compact and options remain scannable', () => {
  const progress = read('src/components/school/tutor/SchoolProgressRail.tsx');
  const activity = read('src/components/school/tutor/SchoolActivityRenderer.tsx');
  const support = read('src/components/school/support/SchoolSupportActivity.tsx');
  const recap = read('src/app/school/recap/page.tsx');
  const masterclass = read('src/app/school/masterclass/[sessionId]/page.tsx');

  assert.match(progress, /<details/);
  assert.match(progress, /role="progressbar"/);
  assert.match(recap, /data-testid="school-recap-progress"[\s\S]*?<details/);
  assert.match(masterclass, /data-testid="school-masterclass-context"[\s\S]*?<details/);
  assert.doesNotMatch(activity + support, /sm:grid-cols-2/);
});

test('mobile learning keeps coach identity, status, and guidance instead of an avatar-only fallback', () => {
  const workspace = read('src/components/school/SchoolLearningWorkspace.tsx');
  const learning = read('src/components/school/SchoolLearningShell.tsx');
  const tutor = read('src/components/school/tutor/SchoolTutorWorkspace.tsx');
  const coach = read('src/components/school/SchoolCoachPanel.tsx');
  const styles = read('src/components/school/SchoolLearningWorkspace.module.css');

  assert.match(workspace, /data-school-region="mobile-coach"/);
  assert.match(learning, /mobileCoach={<SchoolCoachPanel[\s\S]*?variant="inline"/);
  assert.match(tutor, /mobileCoach={<SchoolCoachPanel[\s\S]*?variant="inline"/);
  assert.match(coach, /variant === 'inline'/);
  assert.match(styles, /\.mobileCoach\s*\{[^}]*display:\s*none/);
  assert.match(styles, /@media \(max-width: 820px\)[\s\S]*?\.mobileCoach\s*\{[^}]*display:\s*block/);
});
