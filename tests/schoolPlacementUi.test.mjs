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
const learningWorkspaceCssPath = path.join(
  ROOT,
  'src/components/school/SchoolLearningWorkspace.module.css',
);

test('placement uses the canonical entry composition without spinner loading', () => {
  assert.match(pageSource, /<SchoolPlacementSkeleton\s*\/>/);
  assert.match(pageSource, /<SchoolPlacementActivity/);
  assert.doesNotMatch(pageSource, /<SchoolLearningShell/);
  assert.doesNotMatch(pageSource, /Loader2|animate-spin/);
  assert.match(pageSource, /const placementHasCoachIdentity = Boolean/);
  assert.match(pageSource, /useResolvedSchoolCoachIdentity/);
  assert.match(pageSource, /const resolvedCoachIdentity = useResolvedSchoolCoachIdentity/);
  assert.match(pageSource, /const coachAvatarId = resolvedCoachIdentity.avatarId/);
  assert.match(pageSource, /const coachPaletteId = resolvedCoachIdentity.paletteId/);
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

test('placement back stop and refresh controls are borderless icon actions', () => {
  const source = fs.readFileSync(workspacePath, 'utf8');
  const workspaceCss = fs.readFileSync(learningWorkspaceCssPath, 'utf8');
  const utilityClasses = [...source.matchAll(
    /aria-label="(?:Stop|Refresh) starting-point check"[\s\S]*?className="([^"]+)"/g,
  )].map((match) => match[1].split(/\s+/));
  const backRule = workspaceCss.match(/\.backButton\s*\{([\s\S]*?)\}/)?.[1] ?? '';

  assert.equal(utilityClasses.length, 2);
  for (const tokens of utilityClasses) {
    assert.ok(tokens.includes('bg-transparent'));
    assert.ok(tokens.includes('border-0'));
    assert.equal(tokens.some((token) => token === 'border' || token.startsWith('border-[')), false);
    assert.ok(tokens.some((token) => token.startsWith('focus-visible:ring-')));
  }
  assert.match(backRule, /border:\s*0/);
  assert.match(backRule, /background:\s*transparent/);
  assert.match(workspaceCss, /\.backButton:focus-visible/);
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
  assert.match(
    pageSource,
    /if \(\(!canStartPlacement && !canResumePlacement\) \|\| startingRef\.current\) return/,
  );
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

test('insufficient evidence continues the same session when the backend authorizes resume', () => {
  const source = fs.readFileSync(workspacePath, 'utf8');
  const terminal = source.match(
    /if \(placement\.status === 'insufficient_evidence'\) \{([\s\S]*?)\n  if \(placement\.status === 'abandoned'\)/,
  )?.[1] ?? '';

  assert.match(pageSource, /canResumePlacement/);
  assert.match(pageSource, /state\.next_action === 'resume_placement'/);
  assert.match(pageSource, /startSchoolPlacement\(\)/);
  assert.match(source, /onResume/);
  assert.match(terminal, /Continue readiness check/);
  assert.doesNotMatch(terminal, /Back to School|Check for another question|onRefresh/);
  assert.doesNotMatch(terminal, /backend has no additional question/);
});

test('resumable placement state is rendered before fetching a terminal placement session', () => {
  const resumeBranch = pageSource.indexOf("if (state.next_action === 'resume_placement')");
  const placementFetch = pageSource.indexOf('const activePlacement = await getSchoolPlacement');

  assert.ok(resumeBranch >= 0, 'resume state needs an explicit branch');
  assert.ok(placementFetch >= 0, 'active placements still need a canonical fetch');
  assert.ok(
    resumeBranch < placementFetch,
    'a terminal insufficient-evidence session must not be fetched as active before resume',
  );
});

test('a queued placement answer resolves through its compact status before one canonical reconciliation', () => {
  assert.match(pageSource, /getSchoolPlacementAnswerStatus/);
  assert.match(pageSource, /pendingPlacementAnswerRef/);
  assert.match(pageSource, /const pollPendingPlacementAnswer = useCallback/);
  assert.match(pageSource, /revalidate: pollPendingPlacementAnswer/);
  assert.doesNotMatch(
    pageSource,
    /revalidate: \(\) => load\(true, true\)/,
    'a queued evaluator must not rebuild placement and global School state on every poll',
  );
  assert.match(pageSource, /const decision = await reconcileMutation\(status\.session\)/);
  assert.match(pageSource, /if \(status\.status === 'retry'\)/);
});

test('a backend-authorized resume is actionable even before a terminal placement payload is loaded', () => {
  const source = fs.readFileSync(workspacePath, 'utf8');
  const emptyPlacement = source.match(
    /if \(!placement\) \{([\s\S]*?)\n  if \(item\) \{/,
  )?.[1] ?? '';

  assert.match(emptyPlacement, /canResumePlacement/);
  assert.match(emptyPlacement, /onResume/);
  assert.match(emptyPlacement, /Continue readiness check/);
});

test('placement keeps its start or resume intent visible while the start request is pending', () => {
  const beginStart = pageSource.indexOf('  const begin = async () => {');
  const startRequest = pageSource.indexOf('const nextPlacement = await startSchoolPlacement();', beginStart);
  const beginEnd = pageSource.indexOf('\n  const submit = async () => {', beginStart);
  const begin = pageSource.slice(beginStart, beginEnd);
  const workspace = fs.readFileSync(workspacePath, 'utf8');

  assert.ok(beginStart >= 0 && startRequest > beginStart && beginEnd > startRequest);
  assert.doesNotMatch(
    begin.slice(0, startRequest),
    /setCanStartPlacement\(false\)|setCanResumePlacement\(false\)/,
    'startingRef already fences duplicate clicks; clearing the flags here turns a saved resume into a misleading refresh state',
  );
  assert.match(workspace, /disabled=\{starting\}/, 'the visible action remains non-interactive while its request is in flight');
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
