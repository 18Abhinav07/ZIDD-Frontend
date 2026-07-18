import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';

const route = read('src/app/school/session/[sessionId]/page.tsx');
const workspace = read('src/components/school/tutor/SchoolTutorWorkspace.tsx');
const renderer = read('src/components/school/tutor/SchoolActivityRenderer.tsx');
const progress = read('src/components/school/tutor/SchoolProgressRail.tsx');
const resolver = read('src/app/school/curriculum/page.tsx');
const service = read('src/services/schoolRebuild.ts');

test('canonical School tutor route delegates the requested session to the tutor workspace', () => {
  assert.match(route, /useParams<\{ sessionId: string \}>/);
  assert.match(route, /<SchoolTutorWorkspace sessionId={params\.sessionId} \/>/);
});

test('tutor workspace loads backend state and the exact curriculum session, then fails closed on ownership drift', () => {
  assert.match(workspace, /getSchoolState\(\{ force: true \}\)/);
  assert.match(workspace, /getSchoolCurriculumSession\(sessionId\)/);
  assert.match(workspace, /schoolTutorLoadDecision/);
  assert.match(workspace, /schoolTutorLoadOwnedBy/);
  assert.match(workspace, /releaseSchoolTutorLoad/);
  assert.doesNotMatch(workspace, /loadInFlightRef/);
  assert.match(workspace, /state\.active_session_id/);
  assert.match(workspace, /school_session_ownership_mismatch/);
  assert.match(workspace, /nextSession\.session_id !== sessionId/);
  assert.match(workspace, /<SchoolTutorSkeleton/);
});

test('workspace composes the shared coach, activity, and chapter progress regions', () => {
  assert.match(workspace, /from '@\/components\/school\/SchoolLearningWorkspace'/);
  assert.match(workspace, /from '@\/components\/school\/SchoolCoachPanel'/);
  assert.match(workspace, /<SchoolLearningWorkspace/);
  assert.match(workspace, /<SchoolCoachPanel/);
  assert.match(workspace, /progress={<SchoolProgressRail/);
  assert.match(workspace, /<SchoolActivityRenderer/);
  assert.match(workspace, /chapterMapHref/);
  assert.match(progress, /role="progressbar"/);
  assert.doesNotMatch(workspace, /const learnerStage =|eyebrow=/);
  assert.match(workspace, /title={activity\?\.title \|\| session\.chapter\.title}/);
});

test('activity renderer translates engine activity kinds and renders the complete backend learner response', () => {
  for (const label of [
    'Practise together',
    'Connect the idea',
    'Focused practice',
    'Try it another way',
    'Try it yourself',
    'Use it somewhere new',
    'Chapter challenge',
  ]) {
    assert.match(renderer, new RegExp(label));
  }

  for (const field of ['passage', 'prompt', 'options']) {
    assert.match(renderer, new RegExp(field));
  }

  assert.doesNotMatch(renderer, /teaching_block|last_feedback|Coach clue|school-tutor-feedback/);
  assert.match(workspace, /teachingBlock: activity\?\.teaching_block/);
  assert.match(
    workspace,
    /selectVisibleSchoolCoachFeedback\([\s\S]{0,120}activity\?\.activity_id,[\s\S]{0,120}session\.last_feedback,[\s\S]{0,120}includePrevious: true/,
  );
  assert.match(workspace, /feedback: visibleFeedback\?\.message/);
  assert.match(workspace, /Previous answer: what worked/);
  assert.match(workspace, /Previous answer: try this/);

  assert.doesNotMatch(renderer, /\{activity\.kind\}/);
  assert.doesNotMatch(renderer, /kind\.replaceAll/);
  assert.doesNotMatch(renderer, /memory_summary/);
  assert.doesNotMatch(renderer, /\bEMA\b|evidence field|certification/i);
  assert.match(workspace, /resolveSchoolCoachPresentation/);
});

test('v2 explicit Continue steps preserve answer interactions and suppress stale non-scored feedback', () => {
  const curriculumActivity = service.match(
    /export interface SchoolCurriculumSession[\s\S]*?current_activity: \{([\s\S]*?)\n  \} \| null;/,
  )?.[1] ?? '';

  for (const [kind, label] of [
    ['v2_connect', 'Connect the idea'],
    ['v2_co_construct', 'Build it together'],
    ['v2_guided_practice', 'Practise together'],
    ['v2_independent_application', 'Apply it yourself'],
    ['v2_transfer', 'Use it somewhere new'],
    ['v2_review', 'Review and strengthen'],
    ['v2_support', 'Get extra support'],
  ]) {
    assert.match(curriculumActivity, new RegExp(`'${kind}'`), `curriculum activity type must include ${kind}`);
    assert.match(
      renderer,
      new RegExp(`case '${kind}':[\\s\\S]{0,100}return '${label}';`),
      `renderer must label ${kind} as ${label}`,
    );
  }
  for (const unsupportedAlias of ['v2_independent_check', 'v2_transfer_check']) {
    assert.doesNotMatch(curriculumActivity, new RegExp(`'${unsupportedAlias}'`));
    assert.doesNotMatch(renderer, new RegExp(`case '${unsupportedAlias}':`));
  }

  assert.match(curriculumActivity, /interaction_type\?: SchoolCurriculumInteractionType \| null;/);
  assert.match(curriculumActivity, /evidence_role\?: SchoolCurriculumEvidenceRole \| null;/);
  const continueOnlyRule = renderer.match(/const isContinueOnlyActivity =[^;]+;/)?.[0] ?? '';
  assert.match(continueOnlyRule, /activity\.interaction_type === 'continue'/);
  assert.doesNotMatch(continueOnlyRule, /evidence_role/);
  assert.match(renderer, /const TEACHING_STEP_ACKNOWLEDGEMENT = 'continue';/);
  assert.match(renderer, /isContinueOnlyActivity \? 'Learn and continue' : 'Think and answer'/);

  const continueBranch = renderer.match(
    /\{isContinueOnlyActivity \? \(([\s\S]*?)\) : canSubmit && activity\.options\?\.length \? \(/,
  )?.[1] ?? '';
  assert.match(continueBranch, /onSubmit\(TEACHING_STEP_ACKNOWLEDGEMENT\)/);
  assert.match(continueBranch, />Continue</);
  assert.doesNotMatch(continueBranch, /<input|<textarea|Think and answer|Your answer|Check my answer/);
  assert.match(workspace, /feedback: visibleFeedback\?\.message/);
});

test('progress exposes only the compact backend completion count', () => {
  assert.match(progress, /session\.progress\.current_level_index/);
  assert.match(progress, /session\.progress\.completed_levels/);
  assert.match(progress, /session\.progress\.total_levels/);
  assert.doesNotMatch(progress, /session\.current_activity|memory_summary|session\.levels\.map|<details/);
});

test('answer submission keeps backend activity idempotency, local evaluator allowance, and single-flight polling', () => {
  assert.match(workspace, /submitInFlightRef\.current/);
  assert.match(workspace, /answerSchoolCurriculum\(session\.session_id, activity\.activity_id, finalAnswer\)/);
  assert.match(workspace, /runCurriculumMutation/);
  assert.match(workspace, /curriculumActivityView/);
  assert.match(workspace, /startSingleFlightRevalidation/);
  assert.match(service, /answerSchoolCurriculum[\s\S]*?schoolEvaluatorFetch\(/);
  assert.match(service, /schoolEvaluatorFetch[\s\S]*?SCHOOL_QWEN_REQUESTS_UNBOUNDED[\s\S]*?null/);
  assert.doesNotMatch(workspace, /Promise\.race|setTimeout\(/);
});

test('pending evaluation uses a message skeleton and one stable pending label without a spinner', () => {
  assert.match(renderer, /data-testid="school-tutor-message-skeleton"/);
  assert.match(workspace, /I am reviewing your answer/);
  assert.doesNotMatch(renderer, /pendingLabel=/);
  assert.doesNotMatch(renderer, /Loader2/);
});

test('paused masterclass and all tutor exits use backend-owned canonical destinations', () => {
  assert.match(workspace, /active_interrupt\.masterclass_session_id/);
  assert.match(workspace, /setSchoolNextAction\(state\.next_action\)/);
  assert.match(workspace, /schoolNextAction !== 'start_masterclass'/);
  assert.match(workspace, /canStartMasterclass/);
  assert.match(workspace, /resolveSchoolStateDestination/);
  assert.match(workspace, /router\.push\(destination\)/);
  assert.match(workspace, /startSchoolCurriculumMasterclass\(session\.session_id\)/);
  assert.match(workspace, /router\.push\(chapterMapHref\)/);
  assert.match(renderer, /onOpenMasterclass/);
  assert.match(renderer, /onOpenMasterclass \? \(/);
  assert.match(renderer, /onExit/);
});

test('legacy curriculum route is only a backend-state resolver', () => {
  assert.match(resolver, /getSchoolState\(\{ force: true \}\)/);
  assert.match(resolver, /resolveSchoolStateDestination/);
  assert.match(resolver, /router\.replace\(destination\)/);
  assert.doesNotMatch(resolver, /state\.active_flow|state\.active_session_id/);
  assert.doesNotMatch(resolver, /SchoolActivityRenderer|SchoolCoachPanel|SchoolJourneyMap|answerSchoolCurriculum/);
});

test('owned tutor production uses shared actions, Radix icons, and semantic School colors', () => {
  const owned = [workspace, renderer, progress].join('\n');
  assert.match(renderer, /schoolPrimaryActionClass/);
  assert.match(renderer, /schoolSecondaryActionClass/);
  assert.match(owned, /@radix-ui\/react-icons/);
  assert.doesNotMatch(owned, /lucide-react|font-black|gradient|(?:rose|sky|cyan|emerald|amber)-/i);
});
