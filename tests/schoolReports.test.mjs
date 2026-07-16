import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  createLearnerSafeSkillLabeler,
  describeSavedAttempts,
  groupSkillEvidenceByLabel,
  reportPlacementContinuationOverride,
  resolveParentCurrentClassNo,
  selectLearnerPracticeChapter,
  selectParentCurrentChapter,
  selectParentNextChapter,
} from '../src/components/school/reports/reportEvidence.mjs';

const read = (path) => fs.readFileSync(path, 'utf8');

const learnerRoute = read('src/app/school/reports/page.tsx');
const parentRoute = read('src/app/school/parent/page.tsx');
const learnerReport = read('src/components/school/reports/LearnerGrowthSummary.tsx');
const parentReport = read('src/components/school/reports/ParentGrowthReport.tsx');
const reportEvidence = read('src/components/school/reports/reportEvidence.mjs');
const productionSurface = [learnerRoute, parentRoute, learnerReport, parentReport].join('\n');

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

test('saved evidence copy stays grammatical for singular and repeated attempts', () => {
  assert.equal(describeSavedAttempts(1, 'guided_check'), '1 saved guided check');
  assert.equal(describeSavedAttempts(3, 'guided_check'), '3 saved guided checks');
  assert.equal(describeSavedAttempts(2, ''), '2 saved learning checks');
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
  assert.match(parentReport, /The previous chapter is complete/);
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
    'SchoolCoachPanel',
    'getSchoolAvatarTheme',
    'What you have achieved',
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
  assert.match(learnerReport, /<SchoolCoachPanel[\s\S]*?compact/);
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
    'SchoolCoachPanel',
    'getSchoolAvatarTheme',
    'Current chapter',
    'Chapters complete',
    'Confirmed skills',
    'Current focus',
    'Recommended next action',
    "resolution === 'capped_out'",
    'recapSession',
    'recapModule',
    'Readiness module',
  ]) {
    assert.match(parentReport, new RegExp(contract));
  }
  assert.match(parentReport, /<SchoolCoachPanel[\s\S]*?compact/);
  assert.match(parentReport, /createLearnerSafeSkillLabeler/);
  assert.match(parentReport, /chapter_assessment\?\.last_result/);
  assert.match(parentReport, /groupSkillEvidenceByLabel/);
  assert.doesNotMatch(parentReport, /latest saved answer|latest saved evidence[^.]*[“\"]/i);
  assert.equal(parentReport.match(/onClick=\{onNextAction\}/g)?.length, 1);
});

test('parent report keeps methodology and evidence density in native disclosures', () => {
  for (const title of [
    'How the starting point was chosen',
    'Complete chapter list',
    'Placement evidence detail',
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
  assert.match(parentReport, /Not decided/);
  assert.match(parentReport, /Preliminary misses are not presented as lasting weaknesses/);
});

test('missing evidence stays honest without developer-facing synthesis', () => {
  assert.match(learnerReport, /limitations\.length/);
  assert.match(parentReport, /limitations\.length/);
  assert.match(parentReport, /Some evidence is unavailable/);
  assert.doesNotMatch(parentReport, /engine-owned|seven-day learning-event|Cross-session recurring-gap|lifetime total/i);
  assert.doesNotMatch(parentReport, /weekly_score|recurrence_count|lifetime_masterclass_count/);
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
