import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(path, 'utf8');

const pages = {
  curriculum: read('src/components/school/tutor/SchoolTutorWorkspace.tsx'),
  placement: read('src/app/school/placement/page.tsx'),
  recap: read('src/app/school/recap/page.tsx'),
  masterclass: read('src/app/school/masterclass/[sessionId]/page.tsx'),
};

test('durable 202 acknowledgements enter compact passive polling immediately, while ambiguous failures still refresh state', () => {
  const acknowledgedBranches = [
    [pages.curriculum, 'pendingDraftStore?.clear'],
    [pages.placement, 'const nextPlacement = answerResult'],
    [pages.recap, 'setPath(answerResult)'],
    [pages.masterclass, 'const nextSession = answerResult'],
  ];

  for (const [source, endMarker] of acknowledgedBranches) {
    const start = source.indexOf('if (isSchoolEvaluatorPendingAnswer(answerResult))');
    const end = source.indexOf(endMarker, start);
    assert.ok(start >= 0 && end > start, 'known acknowledgement branch must be present');
    const branch = source.slice(start, end);
    assert.doesNotMatch(branch, /recoverSchoolAnswerState/, 'a durable acknowledgement must not wait for a redundant state read');
    assert.doesNotMatch(branch, /void load\(/, 'a durable acknowledgement must wait for its compact answer status instead of reloading School state');
  }

  for (const [surface, source] of Object.entries(pages)) {
    assert.match(source, /recoverSchoolAnswerState\(\{[\s\S]*?refreshState: \(\) => getSchoolState\(\{ force: true \}\)/, `${surface} must refresh School state after an ambiguous answer failure`);
    assert.match(source, /recovery\.kind === 'pending'/, `${surface} must recover a persisted pending job after uncertainty`);
    assert.match(source, /recovery\.kind === 'advanced'/, `${surface} must recover an already-advanced answer after uncertainty`);
  }
});

test('every queued School flow resolves through compact answer status and refreshes broader state only after resolution', () => {
  for (const [surface, source, functionName, pollerName] of [
    ['curriculum', pages.curriculum, 'getSchoolCurriculumAnswerStatus', 'pollPendingCurriculumAnswer'],
    ['placement', pages.placement, 'getSchoolPlacementAnswerStatus', 'pollPendingPlacementAnswer'],
    ['recap', pages.recap, 'getSchoolRecapAnswerStatus', 'pollPendingRecapAnswer'],
    ['masterclass', pages.masterclass, 'getSchoolMasterclassAnswerStatus', 'pollPendingMasterclassAnswer'],
  ]) {
    assert.match(source, new RegExp(functionName), `${surface} needs a compact answer-status client`);
    assert.match(source, new RegExp(`const ${pollerName} = useCallback`), `${surface} needs a single-flight status poller`);
    assert.match(source, new RegExp(`revalidate: ${pollerName}`), `${surface} must use its status poller`);
  }
});

test('pending state disables resubmission and recovers after reload or a passive poll', () => {
  assert.match(pages.curriculum, /activityView\.canSubmit/);
  assert.match(pages.placement, /awaitingEvaluation/);
  assert.match(pages.recap, /canAnswer=\{awaitingEvaluation \? false : activity\.can_answer\}/);
  assert.match(pages.masterclass, /activityView\.canSubmit/);

  for (const [surface, source] of Object.entries(pages)) {
    assert.match(source, /startSingleFlightRevalidation\(/, `${surface} must recover pending work without another answer POST`);
  }
});

test('queued evaluator retry preserves the answer only for the same learner activity', () => {
  assert.match(pages.curriculum, /pendingDraftStore\?\.write\(/);
  assert.match(pages.curriculum, /retryAnswer: finalAnswer/);
  assert.match(pages.curriculum, /pendingDraftStore\?\.read\(\{ sessionId, activityId: fetchedActivityId \}\)/);
  assert.match(pages.curriculum, /pendingDraftStore\?\.clear\(/);
});

test('a transient state refresh after a queued answer stays passive across every School flow', () => {
  assert.match(
    pages.curriculum,
    /recovery\.kind === 'pending_unconfirmed'[\s\S]*?setSchoolStatus\('awaiting_evaluation'\)[\s\S]*?setPendingEvaluation\([\s\S]*?void load\(\{ background: true \}\)/,
  );
  assert.match(
    pages.placement,
    /recovery\.kind === 'pending_unconfirmed'[\s\S]*?setAwaitingEvaluation\(true\)[\s\S]*?void load\(true, true\)/,
  );
  assert.match(
    pages.recap,
    /recovery\.kind === 'pending_unconfirmed'[\s\S]*?setAwaitingEvaluation\(true\)[\s\S]*?void load\(\{ background: true \}\)/,
  );
  assert.match(
    pages.masterclass,
    /recovery\.kind === 'pending_unconfirmed'[\s\S]*?setSchoolStatus\('awaiting_evaluation'\)[\s\S]*?void load\(\{ background: true \}\)/,
  );
  assert.match(
    read('src/lib/schoolRequestPolicy.mjs'),
    /\| \{ kind: 'pending_unconfirmed' \}/,
  );
});
