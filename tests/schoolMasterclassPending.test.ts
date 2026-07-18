import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function loadMasterclassPolicy() {
  const policy = await import('../src/lib/schoolMasterclassPolicy.ts').catch(() => null);
  assert.ok(policy, 'masterclass pending policy must exist');
  return policy;
}

test('authoritative awaiting evaluation overrides a stale answerable masterclass activity', async () => {
  const { masterclassActivityView } = await loadMasterclassPolicy();

  assert.deepEqual(masterclassActivityView({
    schoolStatus: 'awaiting_evaluation',
    sessionStatus: 'active',
    activityId: 'activity-1',
    canAnswer: true,
  }), {
    kind: 'pending',
    canSubmit: false,
    pollDue: true,
    pollAfterMs: 5_000,
  });
});

test('masterclass answer controls return only after School state advances', async () => {
  const { masterclassActivityView } = await loadMasterclassPolicy();

  assert.deepEqual(masterclassActivityView({
    schoolStatus: 'in_progress',
    sessionStatus: 'active',
    activityId: 'activity-2',
    canAnswer: true,
  }), {
    kind: 'activity',
    canSubmit: true,
    pollDue: false,
    pollAfterMs: null,
  });
});

test('only the fenced in-progress response is classified as pending', async () => {
  const { isMasterclassAnswerInProgress } = await loadMasterclassPolicy();

  assert.equal(isMasterclassAnswerInProgress(new Error('masterclass_answer_in_progress')), true);
  assert.equal(isMasterclassAnswerInProgress(new Error('masterclass_answer_conflict')), false);
  assert.equal(isMasterclassAnswerInProgress('masterclass_answer_in_progress'), false);
});

test('masterclass page retains backend status, polls single-flight, and gates submission with policy', async () => {
  const page = await readFile('src/app/school/masterclass/[sessionId]/page.tsx', 'utf8');

  for (const contract of [
    'setSchoolStatus(state.status)',
    'masterclassActivityView({',
    'startSingleFlightRevalidation({',
    'load({ background: true })',
    '!activityView.canSubmit',
    'canAnswer={activityView.canSubmit}',
    'submitInFlightRef.current',
    'session.session_id',
    'activity.activity_id',
    'nextSession.interrupt_id !== session.interrupt_id',
    'recoverSchoolAnswerState({',
    'refreshState: () => getSchoolState({ force: true })',
    "recovery.kind === 'pending'",
    'setSchoolStatus(recovery.state.status)',
  ]) {
    assert.ok(page.includes(contract), `masterclass pending contract missing ${contract}`);
  }

  assert.match(page, /resolveSchoolStateDestination\([\s\S]*?\?\? resolveSchoolPassiveStateDestination\(/);
  assert.match(page, /recoverSchoolAnswerState\(\{[\s\S]*?refreshState: \(\) => getSchoolState\(\{ force: true \}\)[\s\S]*?recovery\.kind === 'pending'[\s\S]*?setError\(''\)[\s\S]*?load\(\{ background: true }\)/);
});

test('masterclass heading focus preserves the learner viewport position', async () => {
  const page = await readFile('src/app/school/masterclass/[sessionId]/page.tsx', 'utf8');

  assert.match(page, /questionHeadingRef\.current\?\.focus\(\{ preventScroll: true }\)/);
});
