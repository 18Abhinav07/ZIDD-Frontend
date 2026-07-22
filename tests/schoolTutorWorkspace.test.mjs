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
const learningShell = read('src/components/school/SchoolLearningShell.tsx');

test('canonical School tutor route delegates the requested session to the tutor workspace', () => {
  assert.match(route, /useParams<\{ sessionId: string \}>/);
  assert.match(route, /<SchoolTutorWorkspace sessionId={params\.sessionId} \/>/);
});

test('tutor workspace loads one backend-owned curriculum workspace snapshot, then fails closed on ownership drift', () => {
  assert.match(workspace, /getSchoolCurriculumWorkspace\(sessionId\)/);
  assert.match(workspace, /schoolTutorLoadDecision/);
  assert.match(workspace, /schoolTutorLoadOwnedBy/);
  assert.match(workspace, /releaseSchoolTutorLoad/);
  assert.doesNotMatch(workspace, /loadInFlightRef/);
  assert.match(workspace, /state\.active_session_id/);
  assert.match(workspace, /school_session_ownership_mismatch/);
  assert.match(workspace, /nextSession\.session_id !== sessionId/);
  assert.match(workspace, /<SchoolTutorSkeleton/);
});

test('expired curriculum snapshots redirect from the canonical workspace state before rendering a stale session', () => {
  assert.match(
    workspace,
    /const \{ state, session: nextSession \} = await getSchoolCurriculumWorkspace\(sessionId\);/,
  );
  assert.match(
    workspace,
    /if \(destination !== `\/school\/session\/\$\{sessionId\}`\) \{[\s\S]{0,120}router\.replace\(destination\);[\s\S]{0,120}return;/,
  );
  assert.doesNotMatch(workspace, /const \[state, nextSession\] = await Promise\.all\(/);
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

test('shared learning shell keeps a stable activity landmark instead of repeating the lesson title', () => {
  assert.match(learningShell, /workspaceLabel="School learning activity"/);
  assert.doesNotMatch(learningShell, /workspaceLabel=\{title\}/);
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
    /selectVisibleSchoolCoachFeedback\([\s\S]{0,120}activity\?\.activity_id,[\s\S]{0,120}feedbackForCurrentLevel,[\s\S]{0,120}includePrevious: true/,
  );
  assert.match(workspace, /feedback: visibleFeedback\?\.message/);
  assert.match(workspace, /Previous answer: what worked/);
  assert.match(workspace, /Previous answer: try this/);
  assert.match(workspace, /Coach note from the previous step/);
  assert.doesNotMatch(workspace, /Feedback on your previous answer/);

  assert.doesNotMatch(renderer, /\{activity\.kind\}/);
  assert.doesNotMatch(renderer, /kind\.replaceAll/);
  assert.doesNotMatch(renderer, /memory_summary/);
  assert.doesNotMatch(renderer, /\bEMA\b|evidence field|certification/i);
  assert.match(workspace, /resolveSchoolCoachPresentation/);
});

test('previous answer feedback stays within the current curriculum level', () => {
  assert.match(
    workspace,
    /const feedbackForCurrentLevel = activity\?\.level_id === session\.last_feedback\?\.level_id\s*\?\s*session\.last_feedback\s*:\s*null;/,
    'same-level feedback remains available to the previous-answer presentation',
  );
  assert.match(
    workspace,
    /selectVisibleSchoolCoachFeedback\([\s\S]{0,120}activity\?\.activity_id,[\s\S]{0,120}feedbackForCurrentLevel,[\s\S]{0,120}includePrevious: true/,
    'feedback from a different level is hidden before previous-answer selection',
  );
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
  assert.match(continueBranch, /'Saving your progress' : 'Continue'/);
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
  assert.match(workspace, /getSchoolCurriculumAnswerStatus/);
  assert.match(workspace, /revalidate: pollPendingCurriculumAnswer/);
  assert.match(service, /answerSchoolCurriculum[\s\S]*?schoolControlFetch\(/);
  assert.match(service, /schoolControlFetch[\s\S]*?SCHOOL_QWEN_REQUESTS_UNBOUNDED[\s\S]*?null/);
  assert.doesNotMatch(workspace, /Promise\.race|setTimeout\(/);
});

test('authoritative pending evaluation offers a safe chapter-map exit without advancing', () => {
  const pendingEvaluation = renderer.match(
    /function PendingEvaluation\(\{ onExit \}: \{ onExit: \(\) => void \}\) \{([\s\S]*?)\n\}/,
  )?.[1] ?? '';
  const pendingBranch = renderer.match(
    /view\.kind === 'pending' \? \(([\s\S]*?)\) : view\.kind === 'support'/,
  )?.[1] ?? '';

  assert.match(pendingEvaluation, /role="status"/);
  assert.match(pendingEvaluation, /aria-live="polite"/);
  assert.match(pendingEvaluation, />Your answer is saved</);
  assert.match(pendingEvaluation, /Your place in this chapter is saved[\s\S]*?feedback will appear here\./);
  assert.match(pendingEvaluation, /data-testid="school-tutor-message-skeleton"/);
  assert.match(pendingEvaluation, /animate-pulse/);
  assert.match(pendingEvaluation, /motion-reduce:animate-none/);
  assert.match(pendingEvaluation, /onClick=\{onExit\}/);
  assert.match(pendingEvaluation, /Return to chapter map/);
  assert.match(pendingBranch, /<PendingEvaluation onExit=\{onExit\} \/>/);
  assert.doesNotMatch(pendingBranch, /ActivityCard|onSubmit|Continue|Check my answer/);
  assert.match(workspace, /School is reviewing your answer\. Feedback will appear here when the next step is ready\./);
  assert.doesNotMatch([workspace, renderer].join('\n'), /Keep this page open/);
  assert.doesNotMatch(renderer, /pendingLabel=|Loader2/);
});

test('saving an answer does not masquerade as model review', () => {
  assert.match(
    workspace,
    /const coachStatus = submitting[\s\S]*?'Checking your answer'[\s\S]*?: activityView\.kind === 'pending'[\s\S]*?'Reviewing your answer'/,
  );
  assert.match(
    workspace,
    /pendingMessage: submitting[\s\S]*?'Checking your answer\. Your response is being saved\.'[\s\S]*?: activityView\.kind === 'pending'[\s\S]*?'School is reviewing your answer\. Feedback will appear here when the next step is ready\.'/,
  );
});

test('saving a teaching acknowledgement does not pretend it is an answer evaluation', () => {
  assert.match(
    workspace,
    /const isSavingTeachingStep = activity\?\.interaction_type === 'continue';/,
  );
  assert.match(
    workspace,
    /isSavingTeachingStep[\s\S]*?'Saving your progress'[\s\S]*?: 'Checking your answer'/,
  );
  assert.match(
    workspace,
    /isSavingTeachingStep[\s\S]*?'Saving this teaching step\. Your chapter place is being saved\.'[\s\S]*?: 'Checking your answer\. Your response is being saved\.'/,
  );
  assert.match(
    renderer,
    /\{submitting \? 'Saving your progress' : 'Continue'\}/,
  );
});

test('paused masterclass and all tutor exits use backend-owned canonical destinations', () => {
  assert.match(workspace, /active_interrupt\.masterclass_session_id/);
  assert.match(workspace, /setSchoolNextAction\(state\.next_action\)/);
  assert.match(workspace, /schoolNextAction !== 'start_masterclass'/);
  assert.match(workspace, /curriculumMasterclassAction\(schoolNextAction\)/);
  assert.match(workspace, /masterclassAction === 'start'/);
  assert.match(workspace, /masterclassAction === 'resume'/);
  assert.match(workspace, /resolveSchoolStateDestination/);
  assert.match(workspace, /router\.push\(destination\)/);
  assert.match(workspace, /startSchoolCurriculumMasterclass\(session\.session_id\)/);
  assert.match(workspace, /resumeSchoolCurriculumMasterclass\(session\.session_id\)/);
  assert.match(workspace, /schoolNextAction === 'resume_masterclass'/);
  assert.match(workspace, /help you learn how to \$\{learnableMasterclassFocus\}/);
  assert.doesNotMatch(workspace, /will strengthen \$\{session\.active_interrupt\.focus\}/);
  assert.match(workspace, /router\.push\(chapterMapHref\)/);
  assert.match(renderer, /onOpenMasterclass/);
  assert.match(renderer, /onResumeMasterclass/);
  assert.match(renderer, /'Return to chapter'/);
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
