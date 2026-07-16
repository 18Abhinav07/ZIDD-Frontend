import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const recapPath = 'src/app/school/recap/page.tsx';
const masterclassPath = 'src/app/school/masterclass/[sessionId]/page.tsx';
const supportPlanPath = 'src/app/school/support/[sessionId]/page.tsx';
const activityPath = 'src/components/school/support/SchoolSupportActivity.tsx';

async function source(path) {
  return readFile(path, 'utf8');
}

test('recap is a focused readiness workspace with backend-owned progression', async () => {
  const recap = await source(recapPath);

  for (const contract of [
    '<SchoolLearningShell',
    '<SchoolTutorSkeleton',
    '<SchoolSupportActivity',
    'recapLoadDecision',
    'resolveSchoolStateDestination',
    'getActiveSchoolRecap',
    'startSchoolRecap',
    'answerSchoolRecap',
    'nextAction: state.next_action',
    'allowedNextActions: state.allowed_next_actions',
    'router.replace(destination)',
    "decision.kind === 'load_session'",
    'activity.can_answer',
    'resolveSchoolCoachPresentation',
    'school-recap-complete',
    'A short bridge to your class',
    'Start recap path',
    'Open target class',
    'coachAvatarId={path?.coach_avatar_id}',
    'coachPaletteId={path?.coach_palette_id}',
  ]) {
    assert.ok(recap.includes(contract), `recap contract missing ${contract}`);
  }

  assert.ok(recap.includes('progress={path ? <ReadinessProgress'), 'recap must use the workspace progress rail');
  assert.ok(!recap.includes('path.modules.map'), 'module titles must not be repeated inside the compact progress strip');
  assert.ok(!recap.includes('Loader2'));
  assert.ok(!recap.includes('animate-spin'));
  assert.ok(!recap.includes('backend-authorized'));
  assert.ok(!recap.includes('Foundation bridge'));
  assert.ok(recap.includes("from '@radix-ui/react-icons'"));
  assert.ok(recap.includes('schoolPrimaryActionClass'));
  assert.ok(recap.includes('SchoolStatusChip'));
  assert.ok(!/lucide-react|font-black|gradient|(?:rose|sky|cyan)-/i.test(recap));
});

test('masterclass shows linked lesson context and preserves resume and abandon mutations', async () => {
  const masterclass = await source(masterclassPath);
  const masterclassChrome = masterclass.match(
    /function MasterclassProgress[\s\S]*?\n}\n\nexport default/,
  )?.[0] ?? '';

  for (const contract of [
    '<SchoolLearningShell',
    '<SchoolTutorSkeleton',
    '<SchoolSupportActivity',
    'getSchoolMasterclass',
    'getSchoolCurriculumSession',
    'linked_curriculum_session_id',
    'school_masterclass_lineage_mismatch',
    'schoolMasterclassLineage',
    'schoolMasterclassShellBackAction',
    'completedMasterclassReturnAction',
    'returnFromComplete',
    'onClick={returnFromComplete}',
    'handleShellBack',
    'onBack={handleShellBack}',
    "case 'confirm_abandon':",
    "case 'resume':",
    'curriculum?.chapter.title',
    'resolveSchoolCoachPresentation',
    'resumeSchoolCurriculumMasterclass',
    'abandonSchoolCurriculumMasterclass',
    'school-masterclass-complete',
    'Return without finishing',
    'This support visit will count',
    'Leave and return',
    'Keep practising',
    '<dialog',
    'showModal()',
    'getSchoolState({ force: true })',
    'resolveSchoolStateDestination',
    'router.push(destination)',
    'coachAvatarId={session?.coach_avatar_id}',
    'coachPaletteId={session?.coach_palette_id}',
  ]) {
    assert.ok(masterclass.includes(contract), `masterclass contract missing ${contract}`);
  }

  assert.ok(!masterclass.includes('Loader2'));
  assert.ok(!masterclass.includes('animate-spin'));
  assert.ok(!masterclass.includes('Chapter detour'));
  assert.match(masterclassChrome, /bg-\[var\(--school-accent-soft\)\]/);
  assert.doesNotMatch(masterclassChrome, /(?:text|border|bg)-orange-/);
  assert.ok(!/lucide-react|font-black|gradient|border-l-[2-9]|(?:rose|sky|cyan|emerald|amber)-/i.test(masterclass));
});

test('terminal support opens an evidence-backed plan instead of redirecting to School home', async () => {
  const support = await source(supportPlanPath);
  const service = await source('src/services/schoolRebuild.ts');

  for (const contract of [
    'getSchoolState({ force: true })',
    'getSchoolSupportPlan(sessionId)',
    "state.active_flow !== 'support'",
    'supportPlan.focus',
    'continueSchoolCurriculumAfterSupportCap(sessionId)',
    "router.replace(`/school/session/${continued.session_id}`)",
    'Continue this lesson',
    'Continuing lesson',
    'See what to practise next.',
    'There is no lost work and no penalty for taking a different route.',
    "router.push('/school/reports')",
    'SchoolReportSkeleton',
  ]) {
    assert.ok(support.includes(contract), `support plan contract missing ${contract}`);
  }
  assert.ok(!support.includes("redirect('/school')"));
  assert.ok(!support.includes('answer_key'));
  assert.ok(!support.includes('getSchoolCurriculumSession'));
  assert.ok(!support.includes('getActiveSchoolRecap'));
  assert.ok(!support.includes('SchoolCoachPanel'));
  assert.ok(!support.includes("router.push('/school/parent')"));
  assert.ok(!support.includes('supportPlan?.cap'));
  assert.ok(!support.includes('supportPlan?.history'));
  assert.match(service, /export interface SchoolSupportPlan extends SchoolCoachIdentity/);
  assert.match(service, /flow_type: 'support'/);
  assert.match(service, /parent_flow_type: 'curriculum' \| 'recap' \| 'readiness'/);
  assert.match(service, /cap: Partial</);
  assert.match(service, /history: Array</);
  assert.match(service, /export async function getSchoolSupportPlan\(sessionId: string\): Promise<SchoolSupportPlan>/);
  assert.match(service, /schoolReadFetch\(`\/school\/support\/\$\{sessionId\}`\)/);
  assert.match(service, /export async function continueSchoolCurriculumAfterSupportCap/);
  assert.match(service, /`\/school\/curriculum\/\$\{curriculumSessionId\}\/continue-after-support-cap`/);
});

test('support activity retains browser selectors and duplicate-submit controls', async () => {
  const activity = await source(activityPath);
  for (const contract of [
    'data-testid={`${testIdPrefix}-card`}',
    'data-testid={`${testIdPrefix}-passage`}',
    'data-testid={`${testIdPrefix}-question`}',
    'disabled={submitting}',
    "if (event.key === 'Enter') onSubmit();",
    "submitting ? 'Checking your answer' : 'Check my answer'",
  ]) {
    assert.ok(activity.includes(contract), `support activity contract missing ${contract}`);
  }

  assert.ok(!activity.includes('Loader2'));
  assert.ok(!activity.includes('animate-spin'));
  assert.ok(activity.includes("from '@radix-ui/react-icons'"));
  assert.ok(activity.includes('schoolPrimaryActionClass'));
  assert.doesNotMatch(activity, /kindLabel|teachingBlock|feedback\.message|Coach clue/);
  assert.ok(!/lucide-react|font-black|gradient|(?:rose|sky|cyan|emerald|amber)-/i.test(activity));
});
