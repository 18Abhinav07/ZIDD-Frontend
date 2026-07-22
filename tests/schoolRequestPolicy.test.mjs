import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const policyPath = 'src/lib/schoolRequestPolicy.mjs';

test('School reads do not abort before the proxy deadline', async () => {
  const {
    SCHOOL_PROXY_REQUEST_TIMEOUT_MS,
    SCHOOL_READ_TIMEOUT_MS,
  } = await import(`../${policyPath}`);

  assert.equal(
    SCHOOL_READ_TIMEOUT_MS,
    SCHOOL_PROXY_REQUEST_TIMEOUT_MS,
    'a browser read must not cancel while the School proxy still permits the request',
  );
});

test('School answer commands use the control budget while local Qwen remains unbounded', async () => {
  assert.ok(fs.existsSync(policyPath), 'School request policy module must exist');
  const {
    SCHOOL_PROXY_REQUEST_TIMEOUT_MS,
    schoolProxyTimeoutMs,
  } = await import(`../${policyPath}`);

  for (const answerPath of [
    ['placement', 'placement-id', 'answer'],
    ['recap', 'recap-id', 'answer'],
    ['curriculum', 'curriculum-id', 'answer'],
    ['masterclass', 'masterclass-id', 'answer'],
  ]) {
    assert.equal(schoolProxyTimeoutMs(answerPath, true), null);
    assert.equal(
      schoolProxyTimeoutMs(answerPath, false),
      SCHOOL_PROXY_REQUEST_TIMEOUT_MS,
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
    assert.equal(schoolProxyTimeoutMs(ordinaryPath, true), null);
    assert.equal(
      schoolProxyTimeoutMs(ordinaryPath, false),
      SCHOOL_PROXY_REQUEST_TIMEOUT_MS,
    );
  }

  assert.ok(Number.isFinite(SCHOOL_PROXY_REQUEST_TIMEOUT_MS));
  assert.ok(SCHOOL_PROXY_REQUEST_TIMEOUT_MS > 0);
  assert.equal(SCHOOL_PROXY_REQUEST_TIMEOUT_MS, 30_000);
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
  assert.equal(reloaded.kind, 'advanced');
});

test('a 202 acknowledgement or timed-out answer recovers through advanced authoritative School state', async () => {
  const { recoverSchoolAnswerState } = await import(`../${policyPath}`);
  const advancedState = {
    status: 'in_progress',
    active_flow: 'curriculum',
    active_session_id: 'curriculum-2',
  };
  const pendingResponse = {
    status: 'awaiting_evaluation',
    session_id: 'curriculum-1',
    activity_id: 'activity-1',
    state_url: '/school/state',
  };

  const acknowledged = await recoverSchoolAnswerState({
    response: pendingResponse,
    refreshState: async () => advancedState,
  });
  const timedOut = await recoverSchoolAnswerState({
    error: new Error('request_timeout'),
    refreshState: async () => advancedState,
  });

  assert.deepEqual(acknowledged, { kind: 'advanced', state: advancedState });
  assert.deepEqual(timedOut, { kind: 'advanced', state: advancedState });
});

test('a queued evaluator answer remains pending when its first state refresh hits a transient 5xx', async () => {
  const {
    isTransientSchoolStateRefreshError,
    recoverSchoolAnswerState,
  } = await import(`../${policyPath}`);
  const pendingResponse = {
    status: 'awaiting_evaluation',
    session_id: 'masterclass-1',
    activity_id: 'activity-1',
    state_url: '/school/state',
  };
  const temporaryFailure = new Error('API Error: 500');

  assert.equal(isTransientSchoolStateRefreshError(temporaryFailure), true);
  const recovery = await recoverSchoolAnswerState({
    response: pendingResponse,
    refreshState: async () => {
      throw temporaryFailure;
    },
  });

  assert.deepEqual(recovery, { kind: 'pending_unconfirmed' });
});

test('a non-transient refresh failure is still surfaced rather than treated as an answer acknowledgement', async () => {
  const { recoverSchoolAnswerState } = await import(`../${policyPath}`);
  await assert.rejects(
    recoverSchoolAnswerState({
      response: {
        status: 'awaiting_evaluation',
        session_id: 'masterclass-1',
        activity_id: 'activity-1',
        state_url: '/school/state',
      },
      refreshState: async () => {
        throw new Error('school_masterclass_lineage_mismatch');
      },
    }),
    /school_masterclass_lineage_mismatch/,
  );
});

test('a missing authoritative School state fails closed instead of advancing recovery', async () => {
  const { recoverSchoolAnswerState } = await import(`../${policyPath}`);

  await assert.rejects(
    recoverSchoolAnswerState({
      error: new Error('request_timeout'),
      refreshState: async () => null,
    }),
    /school_state_unresolved/,
  );
});

test('an uncertain curriculum start retries the same durable request until its response is available', async () => {
  const { recoverSchoolCurriculumStart } = await import(`../${policyPath}`);
  const waits = [];
  let calls = 0;
  const completedStart = { ok: true, data: { session_id: 'curriculum-2' } };

  const recovery = await recoverSchoolCurriculumStart({
    error: new Error('request_timeout'),
    attempts: 3,
    delayMs: 125,
    wait: async (delayMs) => waits.push(delayMs),
    retryStart: async () => {
      calls += 1;
      if (calls === 1) throw new Error('curriculum_start_in_progress');
      return completedStart;
    },
  });

  assert.deepEqual(recovery, { kind: 'recovered', result: completedStart });
  assert.equal(calls, 2);
  assert.deepEqual(waits, [125, 125]);
});

test('a curriculum start recovery neither retries unrelated failures nor invents a completed response', async () => {
  const { recoverSchoolCurriculumStart } = await import(`../${policyPath}`);
  let calls = 0;

  const unrelated = await recoverSchoolCurriculumStart({
    error: new Error('curriculum_locked'),
    retryStart: async () => {
      calls += 1;
      return { ok: true };
    },
  });
  assert.deepEqual(unrelated, { kind: 'not_uncertain' });
  assert.equal(calls, 0);

  const pending = await recoverSchoolCurriculumStart({
    error: new Error('curriculum_start_in_progress'),
    attempts: 2,
    wait: async () => {},
    retryStart: async () => {
      calls += 1;
      throw new Error('curriculum_start_in_progress');
    },
  });
  assert.equal(pending.kind, 'pending');
  assert.equal(pending.error.message, 'curriculum_start_in_progress');
  assert.equal(calls, 2);
});
