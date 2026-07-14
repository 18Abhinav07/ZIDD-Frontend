import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const wizardSource = fs.readFileSync(
  'src/components/school/onboarding/SchoolOnboardingWizard.tsx',
  'utf8',
);
const stepPath = 'src/components/school/setup/ClassSubjectStep.tsx';

test('school setup renders backend catalog pairs through a dedicated accessible step', () => {
  assert.equal(fs.existsSync(stepPath), true, 'ClassSubjectStep must exist');
  const stepSource = fs.readFileSync(stepPath, 'utf8');

  assert.match(stepSource, /import type \{ SchoolCatalog \}/);
  assert.match(stepSource, /catalog\.boards\.map/);
  assert.match(stepSource, /selectedBoard\.subjects\.map/);
  assert.match(stepSource, /selectedSubject\.classes\.map/);
  assert.match(stepSource, /type="radio"/);
  assert.match(stepSource, /name="subject_id"/);
  assert.match(stepSource, /name="target_class_no"/);
  assert.doesNotMatch(stepSource, /coming soon/i);
  assert.match(stepSource, /disabled=\{!supported\}/);
  assert.match(stepSource, /Unavailable/);
  assert.match(stepSource, /UnavailableCatalogScope/);
  assert.match(stepSource, /unavailableBoard\.subjects\.map/);
  assert.match(stepSource, /subject\.classes\.map/);
  assert.doesNotMatch(stepSource, /BOARD_OPTIONS|CLASS_OPTIONS/);
});

test('catalog choices fail closed with a shape-matched skeleton and retry state', () => {
  assert.equal(fs.existsSync(stepPath), true, 'ClassSubjectStep must exist');
  const stepSource = fs.readFileSync(stepPath, 'utf8');

  assert.match(stepSource, /data-school-catalog-skeleton/);
  assert.match(stepSource, /onRetry/);
  assert.match(stepSource, />\s*Retry\s*</);
  assert.doesNotMatch(stepSource, /Loader2/);
});

test('wizard fetches the backend catalog and preserves restart-confirmation authority', () => {
  assert.match(wizardSource, /getSchoolCatalog/);
  assert.match(wizardSource, /<ClassSubjectStep/);
  assert.doesNotMatch(wizardSource, /const CLASS_OPTIONS/);
  assert.match(wizardSource, /hasMaterialSchoolProfileChanges/);
  assert.match(wizardSource, /'material_edit'/);
  assert.match(wizardSource, /!editConfirmed/);
});
