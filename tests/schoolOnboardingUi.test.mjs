import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(path, 'utf8');

const page = read('src/app/school/onboarding/page.tsx');
const wizard = read('src/components/school/onboarding/SchoolOnboardingWizard.tsx');
const rail = read('src/components/school/onboarding/OnboardingStepRail.tsx');
const setup = read('src/components/school/setup/ClassSubjectStep.tsx');
const schoolHome = read('src/app/school/page.tsx');
const ownedSurface = [page, wizard, rail, setup].join('\n');

test('onboarding presents one saved step at a time with the canonical compact progress rail', () => {
  assert.match(rail, /SCHOOL_ONBOARDING_STEPS/);
  assert.match(rail, /step <= persistedStep/);
  assert.match(wizard, /clampOnboardingRouteStep\(searchParams\.get\('step'\), persistedStep\)/);
  assert.match(wizard, /persistedStep=\{persistedStep\}/);
  assert.match(rail, /onSelect\(step\)/);
  assert.match(rail, /aria-current=\{current \? 'step' : undefined\}/);
  assert.match(rail, /aria-disabled=\{!available \|\| undefined\}/);
  assert.match(rail, /Step \{String\(currentStep \+ 1\)\.padStart\(2, '0'\)\} of \{String\(SCHOOL_ONBOARDING_STEPS\.length\)\.padStart\(2, '0'\)\}/);
  assert.match(rail, /grid grid-cols-5/);
  assert.doesNotMatch(rail, /overflow-x-auto|rounded-xl/);

  assert.match(wizard, /data-school-region="form-workspace"/);
  assert.doesNotMatch(wizard, /eyebrow=\{`Step \$\{step \+ 1\} of 5`\}/);
  assert.equal((`${wizard}\n${rail}`.match(/aria-live="polite"/g) ?? []).length, 1);
  assert.match(wizard, /<SchoolPageHeading/);
  assert.match(wizard, /level="h2"/);
});

test('step one omits Back while later onboarding steps retain it', () => {
  assert.match(
    wizard,
    /\{step > 0 \? \([\s\S]*?<button[\s\S]*?navigateToStep[\s\S]*?Back[\s\S]*?: null\}/,
  );
  assert.doesNotMatch(wizard, /disabled=\{step === 0 \|\| busy\}/);
});

test('onboarding uses the canonical editorial frame with one page title and one primary command', () => {
  assert.match(page, /max-w-\[1240px\]/);
  assert.match(page, /School, shaped around you/);
  assert.match(page, /Set up learning around school, language, and goals\./);
  assert.match(page, /Five short steps save the class, language, and learning preferences\./);
  assert.match(page, /<SchoolPageHeading/);
  assert.doesNotMatch(page, /SchoolCoachPanel/);
  assert.match(page, /<SchoolOnboardingWizard \/>/);
  assert.doesNotMatch(page, /rounded-3xl|lg:grid-cols-\[minmax\(0,1fr\)_320px\]/);
  assert.doesNotMatch(wizard, /<h1\b/);
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
  assert.match(setup, /availableBoards\.map/);
  assert.match(setup, /selectedBoard\.subjects\.filter/);
  assert.match(setup, /selectedSubject\.classes[\s\S]*?\.filter/);
  assert.match(setup, /isSchoolCatalogSupportAvailable/);
  assert.doesNotMatch(setup, /BOARD_OPTIONS|CLASS_OPTIONS/);
});

test('onboarding uses the shared School theme and Radix icon vocabulary', () => {
  assert.match(page, /getSchoolAvatarTheme\(null, null\)/);
  assert.match(page, /style=\{theme\.style\}/);
  assert.doesNotMatch(page, /SchoolCoachPanel/);
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

test('onboarding checks backend navigation authority and exposes loading, saved, pending, and error states', () => {
  assert.match(wizard, /getSchoolState\(\{ force: true \}\)/);
  assert.match(wizard, /resolveSchoolStateDestination/);
  assert.match(wizard, /router\.replace\(destination\)/);
  assert.match(wizard, /aria-busy="true"/);
  assert.match(wizard, /Saving this step/);
  assert.match(wizard, /Saved\./);
  assert.match(wizard, /role="alert"/);
  assert.doesNotMatch(ownedSurface, /localStorage|(?:bg|from|via|to)-gradient|tracking-\[-/);
});

test('explicit active-profile editing is narrow and does not bypass activation recovery', () => {
  assert.match(
    schoolHome,
    /onChangeSetup=\{\(\) => router\.push\(schoolProfileEditHref\(\)\)\}/,
  );
  assert.match(wizard, /searchParams\.get\('intent'\) === 'edit_profile'/);
  assert.match(
    wizard,
    /const recovery = await getActivationCoordinator\(\)\.recover\(\);[\s\S]*?recovery\.kind === 'route'[\s\S]*?router\.replace\(recovery\.href\)[\s\S]*?const state = await getSchoolState/,
  );
  assert.match(
    wizard,
    /recovery\.kind === 'no_marker' \|\| recovery\.kind === 'stale_marker'/,
  );
  assert.match(
    wizard,
    /state\.profile_status === 'complete'[\s\S]*?snapshot\.active_profile/,
  );
  assert.match(wizard, /hydrateSchoolOnboarding\(snapshot\)/);
  assert.match(wizard, /intent=edit_profile/);
  assert.match(wizard, /profile_version_id: draft\.profile_version_id/);
  assert.match(wizard, /expected_revision: draft\.draft_revision/);
  assert.match(wizard, /createOnboardingRequestCoordinator\(requestId\)/);
});
