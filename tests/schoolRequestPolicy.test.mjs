import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const policyPath = 'src/lib/schoolRequestPolicy.mjs';

test('School request policy acknowledges cloud evaluator answers within 10 seconds and leaves local Qwen unbounded', async () => {
  assert.ok(fs.existsSync(policyPath), 'School request policy module must exist');
  const {
    SCHOOL_CLOUD_EVALUATOR_TIMEOUT_MS,
    SCHOOL_PROXY_REQUEST_TIMEOUT_MS,
    isSchoolEvaluatorPath,
    schoolProxyTimeoutMs,
  } = await import(`../${policyPath}`);

  for (const evaluatorPath of [
    ['placement', 'placement-id', 'answer'],
    ['recap', 'recap-id', 'answer'],
    ['curriculum', 'curriculum-id', 'answer'],
    ['masterclass', 'masterclass-id', 'answer'],
  ]) {
    assert.equal(isSchoolEvaluatorPath(evaluatorPath), true);
    assert.equal(schoolProxyTimeoutMs(evaluatorPath, true), null);
    assert.equal(
      schoolProxyTimeoutMs(evaluatorPath, false),
      SCHOOL_CLOUD_EVALUATOR_TIMEOUT_MS,
    );
  }

  for (const ordinaryPath of [
    ['state'],
    ['catalog'],
    ['onboarding'],
    ['placement', 'start'],
    ['placement', 'placement-id', 'abandon'],
    ['curriculum', 'curriculum-id', 'resume-masterclass'],
  ]) {
    assert.equal(isSchoolEvaluatorPath(ordinaryPath), false);
    assert.equal(schoolProxyTimeoutMs(ordinaryPath, true), null);
    assert.equal(
      schoolProxyTimeoutMs(ordinaryPath, false),
      SCHOOL_PROXY_REQUEST_TIMEOUT_MS,
    );
  }

  assert.ok(Number.isFinite(SCHOOL_PROXY_REQUEST_TIMEOUT_MS));
  assert.ok(SCHOOL_PROXY_REQUEST_TIMEOUT_MS > 0);
  assert.equal(SCHOOL_CLOUD_EVALUATOR_TIMEOUT_MS, 10_000);
});

test('an uncertain evaluator answer becomes passive only after authoritative state confirms evaluation is pending', async () => {
  const { recoverSchoolAnswerState } = await import(`../${policyPath}`);
  let refreshCalls = 0;

  const recovery = await recoverSchoolAnswerState({
    error: new Error('request_timeout'),
    refreshState: async () => {
      refreshCalls += 1;
      return { status: 'awaiting_evaluation', active_flow: 'curriculum' };
    },
  });

  assert.equal(refreshCalls, 1);
  assert.deepEqual(recovery, {
    kind: 'pending',
    state: { status: 'awaiting_evaluation', active_flow: 'curriculum' },
  });
});

test('known in-progress responses and reloads preserve passive pending until authoritative state advances', async () => {
  const { recoverSchoolAnswerState } = await import(`../${policyPath}`);
  const pendingState = { status: 'awaiting_evaluation', active_flow: 'placement' };

  const inProgress = await recoverSchoolAnswerState({
    error: new Error('placement_answer_in_progress'),
    refreshState: async () => pendingState,
  });
  assert.deepEqual(inProgress, { kind: 'pending', state: pendingState });

  const reloaded = await recoverSchoolAnswerState({
    error: new Error('request_timeout'),
    refreshState: async () => ({ status: 'in_progress', active_flow: 'placement' }),
  });
  assert.equal(reloaded.kind, 'not_pending');
});
