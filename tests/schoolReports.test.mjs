import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  createLearnerSafeSkillLabeler,
  describeSavedAttempts,
  describeParentReadyChapter,
  describeParentRecapWatchlist,
  groupSkillEvidenceByLabel,
  humanizeReportActivityType,
  reportPlacementContinuationOverride,
  resolveParentCurrentClassNo,
  selectLearnerPracticeChapter,
  selectParentCurrentChapter,
  selectParentNextChapter,
} from '../src/components/school/reports/reportEvidence.mjs';

const read = (path) => fs.readFileSync(path, 'utf8');

const learnerRoute = read('src/app/school/reports/page.tsx');
const parentRoute = read('src/app/school/parent/page.tsx');
const placementReportRoute = read('src/app/school/placement/report/page.tsx');
const learnerReport = read('src/components/school/reports/LearnerGrowthSummary.tsx');
const parentReport = read('src/components/school/reports/ParentGrowthReport.tsx');
const reportEvidence = read('src/components/school/reports/reportEvidence.mjs');
const productionSurface = [
  learnerRoute,
  parentRoute,
  placementReportRoute,
  learnerReport,
  parentReport,
].join('\n');

test('report skill labels come from authored level copy and never expose engine ids', () => {
  const labelSkill = createLearnerSafeSkillLabeler([
    {
      title: 'Build a clear story sequence',
      focus: 'Connect each event to the detail that proves it.',
      skill_ids: ['english.story.sequence', 'english.story.evidence_link'],
    },
  ]);

  assert.equal(labelSkill('english.story.sequence'), 'Build a clear story sequence');
  assert.equal(labelSkill('unknown.internal_skill_id'), 'Current learning skill');
});

test('saved evidence copy stays truthful when the stored count spans activity types', () => {
  assert.equal(describeSavedAttempts(1, 'guided_check'), '1 saved learning check');
  assert.equal(describeSavedAttempts(3, 'guided_check'), '3 saved learning checks');
  assert.equal(describeSavedAttempts(2, ''), '2 saved learning checks');
  assert.equal(describeSavedAttempts(2, 'v2_review'), '2 saved learning checks');
  assert.equal(describeSavedAttempts(1, 'v2_independent_application'), '1 saved learning check');
});

test('report activity labels never expose version prefixes or snake case', () => {
  assert.equal(humanizeReportActivityType('v2_co_construct'), 'coach-supported practice');
  assert.equal(humanizeReportActivityType('v3_future_review'), 'future review');
  assert.doesNotMatch(describeSavedAttempts(4, 'v3_future_review'), /\bv\d+\b|_/i);
});

test('report evidence groups related skill ids without double-counting tagged attempts', () => {
  const labelSkill = createLearnerSafeSkillLabeler([
    {
      title: 'Follow every speaker',
      focus: 'Attribute dialogue and write a responsive exchange.',
      skill_ids: ['writing.dialogue', 'reading.dialogue_attribution'],
    },
  ]);

  assert.deepEqual(groupSkillEvidenceByLabel([
    {
      skill_id: 'writing.dialogue',
      attempts: 9,
      last_attempt_type: 'chapter_check',
    },
    {
      skill_id: 'reading.dialogue_attribution',
      attempts: 10,
      last_attempt_type: 'chapter_check',
    },
    {
      skill_id: 'vocab.chapter_word_usage',
      skill_label: 'Use chapter vocabulary',
      attempts: 15,
      last_attempt_type: 'chapter_check',
    },
    {
      skill_id: 'unknown.internal_skill_id',
      attempts: 50,
      last_attempt_type: 'chapter_check',
    },
  ], labelSkill), [
    {
      label: 'Follow every speaker',
      attempts: 10,
      last_attempt_type: 'chapter_check',
      skill_count: 2,
    },
    {
      label: 'Use chapter vocabulary',
      attempts: 15,
      last_attempt_type: 'chapter_check',
      skill_count: 1,
    },
  ]);
});

test('reports do not promise placement continuation when the saved session has no question', () => {
  const state = {
    active_flow: 'placement',
    active_session_id: 'placement-1',
    profile_version_id: 'profile-1',
    next_action: 'resume_placement',
  };
  const unavailable = reportPlacementContinuationOverride(state, {
    session_id: 'placement-1',
    profile_version_id: 'profile-1',
    status: 'insufficient_evidence',
    next_item: null,
  });
  assert.deepEqual(unavailable, {
    heading: 'Starting-point check is waiting',
    actionLabel: 'Check for another question',
    message: 'Your saved answers are safe, but no additional question is available for this check yet.',
  });
  assert.equal(reportPlacementContinuationOverride(state, {
    session_id: 'placement-1',
    profile_version_id: 'profile-1',
    status: 'in_progress',
    next_item: { item_id: 'next' },
  }), null);
});

test('locked target class is not promoted to the parent current class', () => {
  const lockedState = {
    unlock_state: 'locked',
    target_class_no: 5,
    active_learning_class_no: null,
  };

  assert.equal(resolveParentCurrentClassNo({
    curriculumSession: null,
    classMap: null,
    state: lockedState,
  }), null);
  assert.equal(resolveParentCurrentClassNo({
    curriculumSession: null,
    classMap: { class_no: 3 },
    state: lockedState,
  }), 3);
  assert.equal(resolveParentCurrentClassNo({
    curriculumSession: { active_learning_class_no: 2 },
    classMap: { class_no: 3 },
    state: lockedState,
  }), 2);
  assert.equal(parentReport.includes('state.target_class_no'), false);
  assert.match(parentReport, /Target class selected for placement/);
});

test('ready active pointer creates neither learner practice nor parent current chapter', () => {
  const readyUntouched = {
    chapter_id: 'chapter-ready',
    title: 'Ready but untouched',
    status: 'ready',
    completed_levels: 0,
    total_levels: 5,
  };

  const readyOnlyMap = {
    active_chapter_id: readyUntouched.chapter_id,
    chapters: [readyUntouched],
  };

  assert.equal(selectLearnerPracticeChapter(readyOnlyMap), null);
  assert.equal(selectParentCurrentChapter(readyOnlyMap), null);
  assert.equal(selectParentNextChapter(readyOnlyMap, null)?.chapter_id, 'chapter-ready');
  assert.equal(selectLearnerPracticeChapter({
    active_chapter_id: 'chapter-active',
    chapters: [{ ...readyUntouched, chapter_id: 'chapter-active', status: 'active' }],
  })?.chapter_id, 'chapter-active');
  assert.equal(selectLearnerPracticeChapter({
    active_chapter_id: 'chapter-support',
    chapters: [{ ...readyUntouched, chapter_id: 'chapter-support', status: 'needs_support' }],
  })?.chapter_id, 'chapter-support');
});

test('completed curriculum exposes its persisted next chapter without relabeling it as current', () => {
  const classMap = {
    active_chapter_id: 'chapter-next',
    chapters: [{
      chapter_id: 'chapter-next',
      title: 'Next chapter',
      status: 'ready',
      completed_levels: 0,
      total_levels: 6,
    }],
  };
  const curriculumSession = {
    status: 'complete',
    next_available_chapter: {
      chapter_id: 'chapter-next',
      title: 'Next chapter',
    },
  };

  assert.equal(selectParentCurrentChapter(classMap), null);
  assert.equal(selectParentNextChapter(classMap, curriculumSession)?.chapter_id, 'chapter-next');
  assert.match(parentReport, /Ready for \$\{nextChapterTitle\}/);
  assert.equal(describeParentReadyChapter({
    readinessPathComplete: false,
    currentClassNo: 5,
    nextChapterTitle: 'Next chapter',
  }), 'The previous chapter is complete. Next chapter is the next available Class 5 chapter.');
});

test('readiness-path completion is not mislabeled as a completed chapter', () => {
  assert.equal(describeParentReadyChapter({
    readinessPathComplete: true,
    hasCompletedChapter: false,
    currentClassNo: 5,
    nextChapterTitle: 'Papa\'s Spectacles',
  }), 'The prerequisite readiness path is complete. Papa\'s Spectacles is the first available Class 5 chapter.');
  assert.match(parentReport, /describeParentReadyChapter/);
  assert.match(parentReport, /Foundations rebuilt/);
  assert.match(parentReport, /recapSession\?\.progress\.completed_modules/);
  assert.match(parentReport, /const isActiveRecap = state\.active_flow === 'recap'/);
  assert.match(parentReport, /const recapModule = isActiveRecap/);
  assert.match(parentReport, /const currentClassNo = isActiveRecap/);
});

test('completed chapter progress takes precedence over historical readiness-path context', () => {
  assert.equal(describeParentReadyChapter({
    readinessPathComplete: true,
    hasCompletedChapter: true,
    currentClassNo: 5,
    nextChapterTitle: 'Gone with the Scooter',
  }), 'The previous chapter is complete. Gone with the Scooter is the next available Class 5 chapter.');
});

test('residual recap skills are framed as a target-class watchlist, not an active failure', () => {
  assert.deepEqual(describeParentRecapWatchlist({
    readinessPathComplete: true,
    currentClassNo: 5,
    focusCount: 3,
  }), {
    title: '3 skills will be watched in Class 5',
    detail: 'The readiness path unlocked Class 5. These skills will be checked again in chapter work; they are not a current learning pause.',
  });
  assert.match(parentReport, /describeParentRecapWatchlist/);
});

test('completed-only class map keeps history out of current practice and current chapter', () => {
  const completedChapter = {
    chapter_id: 'chapter-complete',
    title: 'Completed chapter',
    status: 'complete',
    completed_levels: 5,
    total_levels: 5,
  };
  const completedOnlyMap = {
    active_chapter_id: completedChapter.chapter_id,
    chapters: [completedChapter],
  };

  assert.equal(selectLearnerPracticeChapter(completedOnlyMap), null);
  assert.equal(selectParentCurrentChapter(completedOnlyMap), null);
});

test('School report routes preserve auth, loading, retry, and backend-owned navigation', () => {
  for (const route of [learnerRoute, parentRoute]) {
    assert.match(route, /getSchoolState\(\{ force: true \}\)/);
    assert.match(route, /profile_status === 'unauthenticated'/);
    assert.match(route, /router\.replace\('\/auth\/login'\)/);
    assert.match(route, /<SchoolReportSkeleton \/>/);
    assert.match(route, /learnerSafeErrorMessage/);
    assert.match(route, /aria-live="polite"/);
    assert.match(route, /void load\(\)/);
    assert.match(route, /resolveSchoolStateDestination/);
    assert.match(route, /router\.push\(destination\)/);
    assert.doesNotMatch(route, /next_action_url \|\|/);
    assert.doesNotMatch(route, /Loader2|animate-spin/);
  }
});

test('report routes load the persisted learner name without making it an evidence dependency', () => {
  for (const route of [learnerRoute, parentRoute]) {
    assert.match(route, /getSchoolOnboarding/);
    assert.match(route, /active_profile\?\.display_name/);
    assert.match(route, /learnerName=/);
  }
  assert.match(learnerReport, /learnerName/);
  assert.match(parentReport, /learnerName/);
});

test('report routes validate active placement continuation before exposing their one primary action', () => {
  for (const route of [learnerRoute, parentRoute]) {
    assert.match(route, /getSchoolPlacement/);
    assert.match(route, /reportPlacementContinuationOverride/);
    assert.match(route, /nextStepOverride=/);
  }
  assert.match(learnerReport, /nextStepOverride/);
  assert.match(parentReport, /nextStepOverride/);
});

test('learner and parent reports become passive while School evaluation is awaiting', () => {
  for (const report of [learnerReport, parentReport]) {
    assert.match(report, /state\.status === 'awaiting_evaluation'/);
    assert.match(report, /role="status"/);
    assert.match(report, /School is reviewing the latest saved work/);
    assert.match(report, /awaitingEvaluation \? \([\s\S]*?\) : \(/);
  }
});

test('report routes fetch only recognized placement and unlocked active class evidence', () => {
  for (const route of [learnerRoute, parentRoute]) {
    assert.match(route, /\['below_target', 'target_ready', 'insufficient_evidence'\]\.includes\(state\.placement_status\)/);
    assert.match(route, /state\.subject_id && activeClassNo && state\.unlock_state === 'target_unlocked'/);
    assert.match(route, /getSchoolPlacementReport/);
    assert.match(route, /getSchoolClassMap\(state\.subject_id, activeClassNo\)/);
    assert.match(route, /limitation:/);
  }

  assert.match(parentRoute, /state\.active_flow === 'curriculum'/);
  assert.match(parentRoute, /state\.active_flow === 'masterclass'/);
  assert.match(parentRoute, /state\.active_flow === 'support'/);
  assert.match(parentRoute, /getSchoolMasterclass\(state\.active_session_id\)/);
  assert.match(parentRoute, /getSchoolCurriculumSession\(masterclass\.linked_curriculum_session_id\)/);
  assert.match(parentRoute, /\['curriculum', 'masterclass', 'support', 'recap'\]\.includes\(state\.active_flow\)/);
  assert.match(parentRoute, /getSchoolSupportPlan\(state\.active_session_id\)/);
  assert.match(parentRoute, /state\.active_flow === 'recap'/);
  assert.match(parentRoute, /getActiveSchoolRecap\(\)/);
  assert.match(learnerRoute, /\['curriculum', 'masterclass', 'support'\]\.includes\(state\.active_flow\)/);
  assert.match(learnerRoute, /getSchoolSupportPlan\(state\.active_session_id\)/);
  assert.match(learnerRoute, /getSchoolCurriculumSession\(masterclass\.linked_curriculum_session_id\)/);
  for (const route of [learnerRoute, parentRoute]) {
    assert.doesNotMatch(route, /state\.active_flow === 'support'[\s\S]{0,500}getSchoolCurriculumSession\(state\.active_session_id\)/);
  }
  assert.match(learnerRoute, /Promise\.all/);
  assert.match(parentRoute, /Promise\.all/);
  for (const route of [learnerRoute, parentRoute]) {
    assert.match(route, /createSchoolRouteLoadSingleFlight/);
    assert.match(route, /schoolRouteLoadDisposition/);
  }
});

test('parent reports retain the completed readiness path after target-class unlock', () => {
  assert.match(parentRoute, /const shouldLoadRecap = state\.active_flow === 'recap'/);
  assert.match(parentRoute, /state\.placement_status === 'below_target'/);
  assert.match(parentRoute, /state\.unlock_state === 'target_unlocked'/);
  assert.match(parentRoute, /getActiveSchoolRecap\(\)/);
  assert.match(parentRoute, /recapSession: recap\.value \?\? learning\.value\?\.recapSession \?\? null/);
  assert.match(parentRoute, /recap\.limitation/);
});

test('active support reports consume support-plan evidence and its persisted coach identity', () => {
  assert.match(learnerRoute, /supportPlan={snapshot\.supportPlan}/);
  assert.match(parentRoute, /supportPlan={snapshot\.supportPlan}/);
  assert.match(learnerRoute, /activeCoachIdentity={snapshot\.activeCoachIdentity}/);
  assert.match(parentRoute, /activeCoachIdentity={snapshot\.activeCoachIdentity}/);
  assert.match(learnerReport, /const identity = activeCoachIdentity \?\?/);
  assert.match(parentReport, /const identity = activeCoachIdentity \?\?/);
  for (const report of [learnerReport, parentReport]) {
    assert.doesNotMatch(report, /getAvatarForSeed|coach_seed|avatarSeed/);
  }
});

test('parent report includes chapter-check revision history from the active support plan', () => {
  assert.match(parentReport, /supportPlan\?\.history/);
  assert.match(parentReport, /assessmentSupportHistory/);
  assert.match(parentReport, /supportHistoryCount/);
  assert.match(parentReport, /Focused revision/);
  assert.match(parentReport, /Expanded revision/);
  assert.match(parentReport, /Parent-supported pause/);
  assert.match(parentReport, /supportPlan\?\.focus \? 1 : 0/);
  assert.doesNotMatch(parentReport, /failed_rubric_item_ids|failed_hard_blocker_item_ids/);
});

test('learner report leads with child-friendly growth, practice, and one next challenge', () => {
  const labels = [
    'What you can do now',
    'What you are practising',
    'Your next challenge',
  ];
  let previousIndex = -1;
  for (const label of labels) {
    const index = learnerReport.indexOf(label);
    assert.ok(index > previousIndex, `${label} must appear in learner first-view order`);
    previousIndex = index;
  }

  for (const contract of [
    'SchoolPageHeading',
    'SchoolDisclosure',
    'getSchoolAvatarTheme',
    'Completed milestones',
    'Your current focus',
    'Starting point found',
    'Readiness path complete',
    'Not enough evidence yet',
    'Open parent view',
    'View class map',
  ]) {
    assert.match(learnerReport, new RegExp(contract));
  }

  assert.match(learnerReport, /evidence_summary\.total_attempts/);
  assert.match(learnerReport, /state\.next_action/);
  assert.match(learnerReport, /placementStillOwnsPath/);
  assert.match(learnerReport, /strong_skill_ids/);
  assert.match(learnerReport, /improving_skill_ids/);
  assert.match(learnerReport, /active_gaps/);
  assert.match(learnerReport, /strong_skills/);
  assert.match(learnerReport, /chapter_assessment\?\.last_result/);
  assert.match(learnerReport, /groupSkillEvidenceByLabel/);
  assert.match(learnerReport, /createLearnerSafeSkillLabeler/);
  assert.doesNotMatch(learnerReport, /latest saved answer|answer, [“\"]/i);
  assert.doesNotMatch(learnerReport, /SchoolCoachPanel/);
  assert.equal(learnerReport.match(/onClick=\{onNextAction\}/g)?.length, 1);
});

test('parent first viewport answers position, change, attention, and this week before detail', () => {
  const labels = ['Current position', 'What changed', 'Needs attention', 'This week'];
  let previousIndex = -1;
  for (const label of labels) {
    const index = parentReport.indexOf(label);
    assert.ok(index > previousIndex, `${label} must appear in parent first-view order`);
    previousIndex = index;
  }

  for (const contract of [
    'SchoolPageHeading',
    'SchoolDisclosure',
    'getSchoolAvatarTheme',
    'Current chapter',
    'Chapters complete',
    'Confirmed skills',
    'Recommended next action',
    "resolution === 'capped_out'",
    'recapSession',
    'recapModule',
    'Readiness module',
  ]) {
    assert.match(parentReport, new RegExp(contract));
  }
  assert.doesNotMatch(parentReport, /SchoolCoachPanel/);
  assert.match(parentReport, /createLearnerSafeSkillLabeler/);
  assert.match(parentReport, /chapter_assessment\?\.last_result/);
  assert.match(parentReport, /groupSkillEvidenceByLabel/);
  assert.doesNotMatch(parentReport, /latest saved answer|latest saved evidence[^.]*[“\"]/i);
  assert.equal(parentReport.match(/onClick=\{onNextAction\}/g)?.length, 1);
});

test('parent report keeps methodology and evidence density in native disclosures', () => {
  for (const title of [
    'Starting-point evidence',
    'Complete chapter list',
    'Skill evidence history',
    'Support history and limits',
    'Report limitations',
  ]) {
    assert.match(parentReport, new RegExp(`<SchoolDisclosure[\\s\\S]*?title="${title}"`));
  }

  for (const backendField of [
    'evidence_summary',
    'blocking_skills',
    'memory_summary',
    'interrupt_history',
    'completed_levels',
  ]) {
    assert.match(parentReport, new RegExp(backendField));
  }
  assert.match(parentReport, /placementIsConclusive/);
  assert.match(parentReport, /readinessPathComplete/);
  assert.match(parentReport, /resolveParentCurrentClassNo/);
  assert.match(parentReport, /historical starting-point evidence, not a current gap/);
  assert.match(parentReport, /Preliminary misses are not presented as lasting weaknesses/);
});

test('report layouts keep evidence readable at narrow widths without duplicating summary rows', () => {
  assert.match(parentReport, /grid grid-cols-1 border-y border-slate-200 text-sm sm:grid-cols-2/);
  assert.match(parentReport, /tabular-nums/);
  assert.match(learnerReport, /px-4 pb-24/);
  assert.match(placementReportRoute, /max-w-\[1180px\]/);

  assert.equal(learnerReport.match(/title="Your current focus"/g)?.length ?? 0, 0);
  assert.equal(parentReport.match(/title="Placement evidence detail"/g)?.length ?? 0, 0);
  assert.doesNotMatch(placementReportRoute, /Evidence summary\. No mark\./);
  assert.doesNotMatch(placementReportRoute, />Current next step</);

  for (const surface of [learnerReport, parentReport, placementReportRoute]) {
    assert.match(surface, /break-words/);
  }
});

test('missing evidence stays honest without developer-facing synthesis', () => {
  assert.match(learnerReport, /limitations\.length/);
  assert.match(parentReport, /limitations\.length/);
  assert.match(parentReport, /Some evidence is unavailable/);
  assert.doesNotMatch(parentReport, /engine-owned|seven-day learning-event|Cross-session recurring-gap|lifetime total/i);
  assert.doesNotMatch(parentReport, /weekly_score|recurrence_count|lifetime_masterclass_count/);
});

test('a target class opened with a watchlist is described as supported access, not blanket readiness', () => {
  const schoolRebuild = read('src/services/schoolRebuild.ts');

  assert.match(schoolRebuild, /deviation_note:\s*string/);
  assert.match(placementReportRoute, /report\.deviation_note/);
  assert.match(placementReportRoute, /Class \$\{report\.target_class_no\} is open/);
});

test('report production uses shared editorial primitives, Radix icons, and stable theme roles', () => {
  const completeProductionSurface = `${productionSurface}\n${reportEvidence}`;
  assert.match(completeProductionSurface, /@radix-ui\/react-icons/);
  assert.match(productionSurface, /font-display/);
  assert.match(productionSurface, /schoolPrimaryActionClass/);
  assert.match(productionSurface, /schoolSecondaryActionClass/);
  assert.doesNotMatch(completeProductionSurface, /lucide-react|font-black|gradient|border-l-[2-9]|(?:sky|rose)-/);
});

test('public report surfaces never render hidden grading or language-confidence fields', () => {
  for (const hiddenField of [
    'answer_key',
    'model_answer',
    'rubric',
    'language_confidence',
    'en_production_confidence',
  ]) {
    assert.equal(productionSurface.includes(hiddenField), false, hiddenField);
  }
});
