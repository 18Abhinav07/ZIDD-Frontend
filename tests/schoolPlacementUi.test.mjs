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

test('placement uses the shared School learning workspace without spinner loading', () => {
  assert.match(pageSource, /<SchoolLearningShell/);
  assert.match(pageSource, /<SchoolTutorSkeleton\s*\/>/);
  assert.match(pageSource, /<PlacementStageRail placement=\{placement\} \/>/);
  assert.match(pageSource, /<SchoolPlacementActivity/);
  assert.doesNotMatch(pageSource, /Loader2|animate-spin/);
  assert.match(pageSource, /coachAvatarId=\{placement\?\.coach_avatar_id \?\? coachIdentity\.coach_avatar_id\}/);
  assert.match(pageSource, /coachPaletteId=\{placement\?\.coach_palette_id \?\? coachIdentity\.coach_palette_id\}/);
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
  assert.match(source, /data-testid="school-placement-instruction"/);
  assert.match(source, /data-testid="school-placement-passage"/);
  assert.match(source, /data-testid="school-placement-question"/);
  assert.match(source, /data-testid="school-placement-support"/);
  assert.match(source, /schoolPrimaryActionClass/);
  assert.match(source, /schoolSecondaryActionClass/);
  assert.match(source, /@radix-ui\/react-icons/);
  assert.doesNotMatch(source, /Loader2|animate-spin/);
  assert.doesNotMatch(source, /Targeted check|evidence conflicts|Readiness journey|Placement status|lucide-react|font-black|border-l-[2-9]|(?:sky|emerald|amber)-/);
});

test('placement route retains its backend and learner-control contracts', () => {
  for (const contract of [
    'getSchoolState()',
    'getSchoolPlacement(state.active_session_id)',
    'startSchoolPlacement()',
    'answerSchoolPlacement(placement.session_id, item.item_id, finalAnswer)',
    'abandonSchoolPlacement(placement.session_id)',
    'resolveSchoolStateDestination',
    'router.replace(destination)',
  ]) {
    assert.ok(pageSource.includes(contract), `missing placement contract: ${contract}`);
  }
  assert.match(pageSource, /if \(!canStartPlacement \|\| starting\) return/);
  assert.match(pageSource, /if \(!placement \|\| !item \|\| submitting\) return/);
  assert.match(pageSource, /if \(!placement \|\| abandoning\) return/);
  assert.match(
    pageSource,
    /router\.push\('\/school\/placement\/report'\)/,
    'completed placement must open its evidence report before the next School action',
  );
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
    'report.evaluated_class_no',
    'report.active_learning_class_no',
    'report.blocking_skills',
    'report.watchlist_skills',
    'report.evidence_summary',
  ]) {
    assert.ok(source.includes(field), `missing report truth: ${field}`);
  }
  for (const disclosure of [
    'How this starting point was chosen',
    'Saved answer details',
    'Skills to strengthen',
    'Skills to keep watching',
    'Parent summary',
  ]) {
    assert.match(source, new RegExp(disclosure));
  }
  assert.match(
    source,
    /<SchoolPageHeading\s+eyebrow="Starting-point report"\s+title=\{report\.learner_summary\}/,
  );
  assert.doesNotMatch(source, /title="Your starting point"/);
  assert.equal(
    source.match(/report\.parent_summary/g)?.length,
    1,
    'parent summary must render only inside its progressive disclosure',
  );
  assert.match(
    source,
    /<SchoolDisclosure title="Parent summary"[\s\S]*?<p>\{report\.parent_summary\}<\/p>[\s\S]*?<\/SchoolDisclosure>/,
  );
  assert.match(source, /<SchoolDisclosure/);
  assert.match(source, /getSchoolState\(\{ force: true \}\)/);
  assert.match(source, /resolveSchoolPlacementReportAction/);
  assert.match(source, /Current next step/);
  assert.match(source, /currentAction\.label/);
  assert.doesNotMatch(source, /report\.allowed_next_actions/);
  assert.doesNotMatch(source, /Available next steps from this report/);
  assert.match(source, /createSchoolRouteLoadSingleFlight/);
  assert.match(source, /schoolRouteLoadDisposition/);
  assert.match(source, /startingRef\.current/);
  assert.match(source, /schoolPrimaryActionClass/);
  assert.match(source, /@radix-ui\/react-icons/);
  assert.doesNotMatch(source, /lucide-react|font-black|border-l-[2-9]|(?:sky|emerald|amber)-/);
});
