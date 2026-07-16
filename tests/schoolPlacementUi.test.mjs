import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const pageSource = fs.readFileSync(path.join(ROOT, 'src/app/school/placement/page.tsx'), 'utf8');
const workspacePath = path.join(
  ROOT,
  'src/components/school/placement/SchoolPlacementWorkspace.tsx',
);
const reportPath = path.join(ROOT, 'src/app/school/placement/report/page.tsx');

test('placement uses the canonical entry composition without spinner loading', () => {
  assert.match(pageSource, /<SchoolPlacementSkeleton\s*\/>/);
  assert.match(pageSource, /<SchoolPlacementActivity/);
  assert.doesNotMatch(pageSource, /<SchoolLearningShell/);
  assert.doesNotMatch(pageSource, /Loader2|animate-spin/);
  assert.match(pageSource, /const coachAvatarId = placement\?\.coach_avatar_id \?\? coachIdentity\.coach_avatar_id/);
  assert.match(pageSource, /const coachPaletteId = placement\?\.coach_palette_id \?\? coachIdentity\.coach_palette_id/);
  assert.match(pageSource, /coachAvatarId=\{coachAvatarId\}/);
  assert.match(pageSource, /coachPaletteId=\{coachPaletteId\}/);
  assert.doesNotMatch(pageSource, /avatarSeed|coach_seed/);
});

test('placement presentation keeps one child-facing activity and a compact three-stage rail', () => {
  assert.equal(fs.existsSync(workspacePath), true, 'placement workspace component must exist');
  const source = fs.readFileSync(workspacePath, 'utf8');

  for (const label of ['Snapshot', 'Focused Check', 'Confirmation']) {
    assert.match(source, new RegExp(`label: '${label}'`));
  }
  assert.match(source, /aria-current=\{current \? 'step' : undefined\}/);
  assert.match(source, /const activeIndex = placement[\s\S]*?: -1/);
  assert.match(source, /const finished = placement !== null && placement\.status !== 'in_progress'/);
  assert.match(source, /const current = !finished && index === activeIndex/);
  assert.match(source, /data-testid="school-placement-progress"/);
  assert.match(source, /data-testid="school-placement-card"/);
  assert.match(source, /data-testid="school-placement-passage"/);
  assert.match(source, /data-testid="school-placement-question"/);
  assert.match(source, /resolveSchoolCoachPresentation/);
  assert.match(source, /fallbackMessage: item\.instruction/);
  assert.match(source, /teachingBlock: item\.support/);
  assert.match(source, /<SchoolLearningWorkspace/);
  assert.match(source, /<SchoolCoachPanel/);
  assert.match(source, /actions=\{\(/);
  assert.match(source, /aria-label="Stop starting-point check"/);
  assert.match(source, /aria-label="Refresh starting-point check"/);
  assert.doesNotMatch(source, />\s*Stop for now\s*<\/button>/);
  assert.doesNotMatch(source, /item\.learner_skill_label|<SchoolStatusChip/);
  assert.match(source, /A starting point, not a test\./);
  assert.match(source, /About 8 minutes/);
  assert.doesNotMatch(source, /PlacementCoachScene/);
  assert.match(source, /<SchoolCoachPanel/);
  assert.match(source, /schoolPrimaryActionClass/);
  assert.match(source, /schoolSecondaryActionClass/);
  assert.match(source, /@radix-ui\/react-icons/);
  assert.doesNotMatch(source, /Loader2|animate-spin/);
  assert.doesNotMatch(source, /Targeted check|evidence conflicts|Readiness journey|Placement status|lucide-react|font-black|(?:sky|emerald|amber)-|localStorage|(?:bg|from|via|to)-gradient|tracking-\[-/);
});

test('placement route retains its backend and learner-control contracts', () => {
  for (const contract of [
    'getSchoolState({ force: true })',
    'getSchoolPlacement(state.active_session_id)',
    'startSchoolPlacement()',
    'answerSchoolPlacement(placement.session_id, item.item_id, finalAnswer)',
    'abandonSchoolPlacement(placement.session_id)',
    'resolveSchoolStateDestination',
    'router.replace(destination)',
  ]) {
    assert.ok(pageSource.includes(contract), `missing placement contract: ${contract}`);
  }
  assert.match(pageSource, /if \(!canStartPlacement \|\| startingRef\.current\) return/);
  assert.match(pageSource, /if \(!placement \|\| !item \|\| submittingRef\.current\) return/);
  assert.match(pageSource, /if \(!placement \|\| abandoningRef\.current\) return/);
  assert.match(pageSource, /state\.status === 'awaiting_evaluation'/);
  assert.match(pageSource, /allowed_next_actions\.includes\('view_placement_report'\)/);
  assert.match(pageSource, /startSingleFlightRevalidation/);
  assert.match(pageSource, /window\.setInterval/);
  assert.doesNotMatch(pageSource, /window\.setTimeout/);
  assert.match(pageSource, /resolveSchoolPlacementMutation/);
  assert.match(pageSource, /profile_version_id/);
  assert.match(pageSource, /placementRecoveryRequired/);
  assert.match(
    pageSource,
    /router\.push\('\/school\/placement\/report'\)/,
    'a placement report remains available as a secondary learner action',
  );
});

test('placement recovery disables mutation-returned questions until School state confirms ownership', () => {
  const source = fs.readFileSync(workspacePath, 'utf8');

  assert.match(source, /placementRecoveryRequired/);
  assert.match(source, /Current School step needs confirmation/);
  assert.match(source, /Refresh School state/);
  assert.match(source, /reportAvailable[\s\S]*?tone="secondary"[\s\S]*?See my starting point/);
});

test('placement multiple choice selects a radio answer before one explicit confirmation', () => {
  const source = fs.readFileSync(workspacePath, 'utf8');

  assert.match(source, /type="radio"/);
  assert.match(source, /name="school-placement-answer"/);
  assert.match(source, /checked=\{answer === option\}/);
  assert.match(source, /onChange=\{\(\) => onAnswerChange\(option\)\}/);
  assert.doesNotMatch(source, /onSubmit\(option\)/);
  assert.equal(source.match(/Check my answer/g)?.length, 1);
  assert.match(source, /onClick=\{\(\) => onSubmit\(\)\}/);
  assert.match(source, /disabled=\{submitting \|\| !answer\.trim\(\)\}/);
});

test('placement question focus preserves the top context on narrow viewports', () => {
  assert.match(pageSource, /questionHeadingRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(pageSource, /questionHeadingRef\.current\?\.focus\(\)/);
});

test('insufficient evidence never restarts placement when the backend cannot resume it', () => {
  const source = fs.readFileSync(workspacePath, 'utf8');

  assert.match(source, /This saved check cannot continue yet/);
  assert.match(source, /no additional question for this saved session/);
  assert.match(source, /Starting again could replace your saved answers/);
  assert.doesNotMatch(source, /Continue the check|onResume/);
  assert.doesNotMatch(pageSource, /setCanStartPlacement\(state\.next_action === 'resume_placement'\)/);
});

test('placement report leads with the exact conclusion and progressively discloses evidence', () => {
  const source = fs.readFileSync(reportPath, 'utf8');

  for (const status of ['target_ready', 'below_target', 'insufficient_evidence']) {
    assert.match(source, new RegExp(status));
  }
  for (const field of [
    'report.learner_summary',
    'report.parent_summary',
    'report.target_class_no',
    'report.blocking_skills',
    'report.watchlist_skills',
    'report.evidence_summary',
  ]) {
    assert.ok(source.includes(field), `missing report truth: ${field}`);
  }
  for (const disclosure of [
    'How this starting point was chosen',
    'Saved answer details',
    'Foundation skills to strengthen',
    'Skills to keep watching',
    'Parent summary',
  ]) {
    assert.match(source, new RegExp(disclosure));
  }
  assert.match(
    source,
    /<SchoolPageHeading\s+eyebrow="Starting-point report"\s+title=\{report\.learner_summary\}/,
  );
  assert.match(source, /What we saw/);
  assert.match(source, /What the evidence supports/);
  assert.match(source, /placementLearningPathDetail\(report\)/);
  assert.match(source, /placementEvaluatedClassLabel\(report\)/);
  assert.match(source, /learningPath\.label/);
  assert.match(source, /learningPath\.value/);
  assert.match(source, /What happens next/);
  assert.doesNotMatch(source, /title="Your starting point"/);
  assert.equal(
    source.match(/report\.parent_summary/g)?.length,
    1,
    'parent summary must render only inside its progressive disclosure',
  );
  assert.match(
    source,
    /<SchoolDisclosure title="Parent summary"[\s\S]*?<p[^>]*>\{report\.parent_summary\}<\/p>[\s\S]*?<\/SchoolDisclosure>/,
  );
  assert.match(source, /<SchoolDisclosure/);
  assert.match(source, /getSchoolState\(\{ force: true \}\)/);
  assert.match(source, /resolveSchoolPlacementReportAction/);
  assert.match(source, /currentAction\.label/);
  assert.doesNotMatch(source, /report\.allowed_next_actions/);
  assert.doesNotMatch(source, /Available next steps from this report/);
  assert.match(source, /createSchoolRouteLoadSingleFlight/);
  assert.match(source, /schoolRouteLoadDisposition/);
  assert.match(source, /startingRef\.current/);
  assert.match(source, /schoolPrimaryActionClass/);
  assert.match(source, /@radix-ui\/react-icons/);
  assert.doesNotMatch(source, /lucide-react|font-black|(?:sky|emerald|amber)-|localStorage|(?:bg|from|via|to)-gradient|tracking-\[-/);
});
