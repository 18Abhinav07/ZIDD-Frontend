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
  assert.match(workspace, /from '@\/components\/learning\/LearningWorkspace'/);
  assert.match(workspace, /from '@\/components\/school\/SchoolCoachPanel'/);
  assert.match(workspace, /<LearningWorkspace/);
  assert.match(workspace, /coach={<SchoolCoachPanel/);
  assert.match(workspace, /progress={<SchoolProgressRail/);
  assert.match(workspace, /<SchoolActivityRenderer/);
  assert.match(workspace, /chapterMapHref/);
  assert.match(progress, /aria-current={current \? 'step' : undefined}/);
  assert.match(workspace, /const learnerStage =/);
  assert.match(workspace, /eyebrow={`\$\{session\.chapter\.title\} · \$\{learnerStage\}`}/);
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
    'Chapter complete',
  ]) {
    assert.match(renderer, new RegExp(label));
  }

  for (const field of [
    'teaching_block',
    'passage',
    'prompt',
    'options',
    'last_feedback',
    'chapter_assessment',
  ]) {
    assert.match(renderer, new RegExp(field));
  }

  assert.doesNotMatch(renderer, /\{activity\.kind\}/);
  assert.doesNotMatch(renderer, /kind\.replaceAll/);
  assert.doesNotMatch(renderer, /memory_summary/);
  assert.doesNotMatch(renderer, /\bEMA\b|evidence field|certification/i);
  assert.match(
    renderer,
    /activity\.kind === 'chapter_check' \? 'Instructions' : 'Coach clue'/,
  );
});

test('progress keeps backend stage, activity, and memory context compact and secondary', () => {
  assert.match(progress, /session\.progress\.current_level_index/);
  assert.match(progress, /session\.current_activity/);
  assert.match(progress, /memory_summary\?\.active_gaps/);
  assert.match(progress, /What I am watching/);
  assert.match(progress, /data-testid="school-tutor-memory"/);
});

test('answer submission keeps backend activity idempotency, unlimited open-answer evaluation, and single-flight polling', () => {
  assert.match(workspace, /submitInFlightRef\.current/);
  assert.match(workspace, /answerSchoolCurriculum\(session\.session_id, activity\.activity_id, finalAnswer\)/);
  assert.match(workspace, /runCurriculumMutation/);
  assert.match(workspace, /curriculumActivityView/);
  assert.match(workspace, /startSingleFlightRevalidation/);
  assert.match(service, /answerSchoolCurriculum[\s\S]*?timeoutMs: null/);
  assert.doesNotMatch(workspace, /Promise\.race|setTimeout\(/);
});

test('pending evaluation uses a message skeleton and one stable pending label without a spinner', () => {
  assert.match(renderer, /data-testid="school-tutor-message-skeleton"/);
  assert.match(renderer, /Checking your answer/);
  assert.match(renderer, /pendingLabel="Checking your answer"/);
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
  assert.doesNotMatch(owned, /lucide-react|font-black|gradient|border-l-[2-9]|(?:rose|sky|cyan|emerald|amber)-/i);
});
