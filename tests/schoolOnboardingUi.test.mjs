import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(path, 'utf8');

const page = read('src/app/school/onboarding/page.tsx');
const wizard = read('src/components/school/onboarding/SchoolOnboardingWizard.tsx');
const rail = read('src/components/school/onboarding/OnboardingStepRail.tsx');
const setup = read('src/components/school/setup/ClassSubjectStep.tsx');
const ownedSurface = [page, wizard, rail, setup].join('\n');

test('onboarding presents one saved step at a time with a compact revisitable rail', () => {
  assert.match(rail, /SCHOOL_ONBOARDING_STEPS/);
  assert.match(rail, /step <= persistedStep/);
  assert.match(wizard, /clampOnboardingRouteStep\(searchParams\.get\('step'\), persistedStep\)/);
  assert.match(wizard, /persistedStep=\{persistedStep\}/);
  assert.match(rail, /onSelect\(step\)/);
  assert.match(rail, /aria-current=\{current \? 'step' : undefined\}/);
  assert.match(rail, /aria-disabled=\{!available \|\| undefined\}/);
  assert.match(rail, /overflow-x-auto/);
  assert.doesNotMatch(rail, /grid-cols-5|rounded-xl/);

  assert.match(wizard, /data-school-region="form-workspace"/);
  assert.match(wizard, /Step \$\{step \+ 1\} of 5/);
  assert.match(wizard, /<SchoolPageHeading/);
});

test('onboarding keeps every real setup field and backend catalog authority', () => {
  for (const field of [
    'display_name',
    'school_name',
    'board_id',
    'target_class_no',
    'subject_ids',
    'preferred_teaching_language',
    'english_comfort',
    'learner_goal',
    'parent_goal',
    'prior_difficulty_signals',
  ]) {
    assert.match(`${wizard}\n${setup}`, new RegExp(field));
  }
  assert.match(wizard, /getSchoolCatalog/);
  assert.match(setup, /catalog\.boards\.map/);
  assert.match(setup, /selectedBoard\.subjects\.map/);
  assert.match(setup, /selectedSubject\.classes\.map/);
  assert.match(setup, /isSchoolCatalogSupportAvailable/);
  assert.doesNotMatch(setup, /BOARD_OPTIONS|CLASS_OPTIONS/);
});

test('onboarding uses the shared School theme and Radix icon vocabulary', () => {
  assert.match(page, /getSchoolAvatarTheme\(null, null\)/);
  assert.match(page, /style=\{theme\.style\}/);
  assert.match(page, /<SchoolCoachPanel/);
  assert.match(wizard, /schoolPrimaryActionClass/);
  assert.match(wizard, /schoolSecondaryActionClass/);
  assert.match(wizard, /<SchoolStatusChip/);
  assert.match(setup, /schoolSecondaryActionClass/);
  assert.match(ownedSurface, /@radix-ui\/react-icons/);
  assert.doesNotMatch(ownedSurface, /lucide-react|font-black|border-l-[2-9]|(?:sky|emerald|amber)-/);
});

test('dirty step navigation persists before routing and activation uses the saved revision', () => {
  assert.match(wizard, /dirtyStepRef/);
  assert.match(wizard, /decideSchoolOnboardingNavigation/);
  assert.match(wizard, /const persistOnboardingStep = async/);
  assert.match(
    wizard,
    /decision\.kind === 'save_then_navigate'[\s\S]*?await persistOnboardingStep\(decision\.dirtyStep\)[\s\S]*?if \(!saved\) return;[\s\S]*?router\.push/,
  );
  assert.match(
    wizard,
    /let activationDraft = draft;[\s\S]*?await persistOnboardingStep\(dirtyStepRef\.current\)[\s\S]*?activationDraft = saved\.draft/,
  );
  assert.match(wizard, /expected_revision: activationDraft\.draft_revision/);
});
