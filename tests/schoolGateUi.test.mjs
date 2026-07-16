import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const onboarding = fs.readFileSync(
  'src/components/school/onboarding/SchoolOnboardingWizard.tsx',
  'utf8',
);
const placementReport = fs.readFileSync(
  'src/app/school/placement/report/page.tsx',
  'utf8',
);

test('school onboarding uses a stable pending action and a shape-matched skeleton', () => {
  assert.match(onboarding, /function OnboardingSkeleton/);
  assert.match(onboarding, /aria-busy="true"/);
  assert.match(onboarding, /busy \? 'Saving this step'/);
  assert.match(onboarding, /'Confirming setup'/);
  assert.match(onboarding, /min-w-\[11rem\]/);
  assert.doesNotMatch(onboarding, /Loader2|animate-spin/);
});

test('placement report explains the backend-owned placement decision without raw engine fields', () => {
  for (const requiredContract of [
    'SchoolReportSkeleton',
    'Starting-point report',
    'Target class',
    'Starting point evaluated',
    'Saved answers used',
    'Skills to strengthen',
    'Skills to keep watching',
    'stage_counts',
    'scoring_source',
    'blocking_skills',
    'watchlist_skills',
  ]) {
    assert.match(placementReport, new RegExp(requiredContract));
  }

  assert.doesNotMatch(placementReport, /Loader2|animate-spin/);
  assert.doesNotMatch(placementReport, /answer_key|model_answer|rubric/);
  assert.doesNotMatch(
    placementReport,
    /\{report\.evidence_summary\.scoring_source\}/,
    'raw scoring source must be translated into learner-facing copy',
  );
});

test('placement report uses current same-version state while keeping report actions historical', () => {
  assert.match(placementReport, /getSchoolPlacementReport\(\)/);
  assert.match(placementReport, /getSchoolState\(\{ force: true \}\)/);
  assert.match(placementReport, /resolveSchoolPlacementReportAction/);
  assert.match(placementReport, /await startSchoolRecap\(\)/);
  assert.match(placementReport, /startingRef\.current/);
  assert.match(
    placementReport,
    /const refreshedState = await getSchoolState\(\{ force: true \}\)/,
  );
  assert.match(
    placementReport,
    /resolveSchoolPlacementReportAction\(report, refreshedState\)/,
  );
  assert.match(placementReport, /router\.push\(refreshedAction\.url\)/);
  assert.match(placementReport, /Return to current School plan/);
  assert.doesNotMatch(placementReport, /allowed_next_actions\.includes/);
});
