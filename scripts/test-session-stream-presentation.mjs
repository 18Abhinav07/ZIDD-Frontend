import assert from 'node:assert/strict';
import test from 'node:test';

import * as presentation from '../src/lib/sessionStreamPresentation.mjs';

import {
  durableTurnCompleted,
  openingSnapshotComplete,
  nextActiveStreamKind,
  runLateTurnRecovery,
  slowStreamCopyFor,
  statusForActiveStream,
  teachingStatusFor,
} from '../src/lib/sessionStreamPresentation.mjs';

test('durable completed turn releases the matching client turn only', () => {
  const lastTurn = { client_turn_id: 'turn-2', status: 'completed' };
  assert.equal(durableTurnCompleted(lastTurn, 'turn-2'), true);
  assert.equal(durableTurnCompleted(lastTurn, 'turn-1'), false);
  assert.equal(durableTurnCompleted({ client_turn_id: 'turn-2', status: 'processing' }, 'turn-2'), false);
});

test('opening recovery waits for durable opening evidence', () => {
  assert.equal(openingSnapshotComplete({}), false);
  assert.equal(openingSnapshotComplete({ openingStreamed: true }), true);
  assert.equal(openingSnapshotComplete({ hasOpeningMessage: true }), true);
  assert.equal(openingSnapshotComplete({ hasGamePrompt: true }), true);
  assert.equal(openingSnapshotComplete({ terminalSession: true }), true);
});

test('opening streams remain in setup language after tokens arrive', () => {
  assert.equal(slowStreamCopyFor('opening'), 'Setting up your prompt...');
  assert.equal(statusForActiveStream('opening'), 'Preparing');
});

test('learner turns use review language', () => {
  assert.equal(slowStreamCopyFor('learner_turn'), 'Reviewing your answer...');
  assert.equal(statusForActiveStream('learner_turn'), 'Reviewing');
});

test('unknown active streams use neutral processing language', () => {
  assert.equal(slowStreamCopyFor(null), 'Working on this turn...');
  assert.equal(statusForActiveStream(null), 'Working');
});

test('simulator status follows stream ownership and terminal priority', () => {
  assert.equal(typeof presentation.simulatorStatusFor, 'function');
  const simulatorStatusFor = presentation.simulatorStatusFor;

  assert.equal(simulatorStatusFor({ isComplete: true, isClosing: true }), 'Complete');
  assert.equal(simulatorStatusFor({ isClosing: true, isStreaming: true }), 'Scoring');
  assert.equal(simulatorStatusFor({ isRecoveringTurn: true, isStreaming: true, activeStreamKind: 'opening' }), 'Reviewing');
  assert.equal(simulatorStatusFor({ isStreaming: true, activeStreamKind: 'opening' }), 'Preparing');
  assert.equal(simulatorStatusFor({ isStreaming: true, activeStreamKind: 'learner_turn' }), 'Reviewing');
  assert.equal(simulatorStatusFor({ isStreaming: true, activeStreamKind: null }), 'Working');
  assert.equal(simulatorStatusFor({ isSubmitting: true }), 'Reviewing');
  assert.equal(simulatorStatusFor({}), 'Ready');
});

test('simulator input guard blocks recovery and backend-owned locks', () => {
  assert.equal(typeof presentation.simulatorInputBlocked, 'function');
  const simulatorInputBlocked = presentation.simulatorInputBlocked;

  assert.equal(simulatorInputBlocked({ isRecoveringTurn: true }), true);
  assert.equal(simulatorInputBlocked({ isStreaming: true }), true);
  assert.equal(simulatorInputBlocked({ isClosing: true }), true);
  assert.equal(simulatorInputBlocked({ shouldClose: true }), true);
  assert.equal(simulatorInputBlocked({ isSubmitting: true }), true);
  assert.equal(simulatorInputBlocked({ inputAllowed: false }), true);
  assert.equal(simulatorInputBlocked({ blockReason: 'turn_locked' }), true);
  assert.equal(simulatorInputBlocked({}), false);
});

test('end evidence treats missing coverage as unknown, never sufficient', () => {
  assert.equal(typeof presentation.endSessionEvidenceFor, 'function');
  const endSessionEvidenceFor = presentation.endSessionEvidenceFor;
  const unknownCoverage = endSessionEvidenceFor({
    scorableTurns: 6,
    minScorableTurns: 6,
  });

  assert.equal(unknownCoverage.coverageKnown, false);
  assert.equal(unknownCoverage.hasEnoughCoverage, false);
  assert.equal(unknownCoverage.label, 'Coverage not yet verified');
  assert.equal(unknownCoverage.actionLabel, 'End & Validate Report');
  assert.doesNotMatch(unknownCoverage.copy, /coverage.*supports.*score/i);

  const verifiedCoverage = endSessionEvidenceFor({
    scorableTurns: 6,
    minScorableTurns: 6,
    coverageCovered: 4,
    coverageRequired: 4,
  });
  assert.equal(verifiedCoverage.coverageKnown, true);
  assert.equal(verifiedCoverage.hasEnoughCoverage, true);
  assert.equal(verifiedCoverage.label, 'Evidence ready for validation');
});

test('teaching status follows the learner-visible priority contract', () => {
  assert.equal(teachingStatusFor({ moduleComplete: true, teachingBlocked: true }), 'Complete');
  assert.equal(teachingStatusFor({ isBootstrapping: true, checkpointReached: true }), 'Preparing');
  assert.equal(teachingStatusFor({ isStreaming: true, activeStreamKind: 'opening' }), 'Preparing');
  assert.equal(teachingStatusFor({ isStreaming: true, activeStreamKind: 'learner_turn' }), 'Reviewing');
  assert.equal(teachingStatusFor({ teachingBlocked: true, checkpointReached: true }), 'Blocked');
  assert.equal(teachingStatusFor({ checkpointReached: true }), 'Complete');
  assert.equal(teachingStatusFor({}), 'Ready');
});

test('teaching status keeps an unknown active stream neutral', () => {
  assert.equal(teachingStatusFor({ isStreaming: true, activeStreamKind: null }), 'Working');
});

test('opening ownership survives tokens and clears on completion', () => {
  let kind = nextActiveStreamKind(null, 'opening_started');
  assert.equal(kind, 'opening');
  kind = nextActiveStreamKind(kind, 'message_received');
  assert.equal(kind, 'opening');
  kind = nextActiveStreamKind(kind, 'completed');
  assert.equal(kind, null);
});

test('sequential learner streams clear on errors and disconnects', () => {
  let kind = nextActiveStreamKind(null, 'learner_turn_started');
  assert.equal(kind, 'learner_turn');
  kind = nextActiveStreamKind(kind, 'error');
  assert.equal(kind, null);

  kind = nextActiveStreamKind(kind, 'learner_turn_started');
  assert.equal(kind, 'learner_turn');
  kind = nextActiveStreamKind(kind, 'disconnected');
  assert.equal(kind, null);
});

test('session changes clear any active ownership', () => {
  const kind = nextActiveStreamKind('opening', 'session_changed');
  assert.equal(kind, null);
});

function fakeLateRecoveryClock() {
  let currentTime = 0;
  return {
    now: () => currentTime,
    wait: async (delayMs) => {
      currentTime += delayMs;
    },
  };
}

test('late recovery keeps polling until the expected turn durably completes', async () => {
  const clock = fakeLateRecoveryClock();
  const observedTurnIds = [];
  const outcomes = [
    { foundExpectedTurn: true, completed: false, failed: false },
    { foundExpectedTurn: true, completed: true, failed: false },
  ];

  const result = await runLateTurnRecovery({
    expectedClientTurnId: 'turn-expected',
    deadlineMs: 60_000,
    maxPolls: 4,
    pollDelayMs: 10_000,
    isOwner: () => true,
    pollTranscript: async (clientTurnId) => {
      observedTurnIds.push(clientTurnId);
      return outcomes.shift();
    },
    ...clock,
  });

  assert.deepEqual(result, { status: 'completed', polls: 2 });
  assert.deepEqual(observedTurnIds, ['turn-expected', 'turn-expected']);
});

test('late recovery cancels a completed poll after session ownership changes', async () => {
  const clock = fakeLateRecoveryClock();
  let ownsTurn = true;
  let polls = 0;

  const result = await runLateTurnRecovery({
    expectedClientTurnId: 'turn-old-session',
    deadlineMs: 60_000,
    maxPolls: 4,
    pollDelayMs: 10_000,
    isOwner: () => ownsTurn,
    pollTranscript: async () => {
      polls += 1;
      ownsTurn = false;
      return { foundExpectedTurn: true, completed: true, failed: false };
    },
    ...clock,
  });

  assert.deepEqual(result, { status: 'cancelled', polls: 1 });
  assert.equal(polls, 1);
});

test('late recovery ignores durable completion for a different client turn id', async () => {
  const clock = fakeLateRecoveryClock();
  const durableTurns = [
    { client_turn_id: 'turn-other', status: 'completed' },
    { client_turn_id: 'turn-expected', status: 'completed' },
  ];

  const result = await runLateTurnRecovery({
    expectedClientTurnId: 'turn-expected',
    deadlineMs: 60_000,
    maxPolls: 4,
    pollDelayMs: 10_000,
    isOwner: () => true,
    pollTranscript: async (clientTurnId) => {
      const lastTurn = durableTurns.shift();
      return {
        foundExpectedTurn: true,
        completed: durableTurnCompleted(lastTurn, clientTurnId),
        failed: lastTurn?.client_turn_id === clientTurnId && lastTurn?.status === 'failed',
      };
    },
    ...clock,
  });

  assert.deepEqual(result, { status: 'completed', polls: 2 });
});

test('late recovery exhausts its finite polling budget', async () => {
  const clock = fakeLateRecoveryClock();
  let polls = 0;

  const result = await runLateTurnRecovery({
    expectedClientTurnId: 'turn-never-finishes',
    deadlineMs: 120_000,
    maxPolls: 3,
    pollDelayMs: 10_000,
    isOwner: () => true,
    pollTranscript: async () => {
      polls += 1;
      return { foundExpectedTurn: true, completed: false, failed: false };
    },
    ...clock,
  });

  assert.deepEqual(result, { status: 'exhausted', polls: 3 });
  assert.equal(polls, 3);
});

test('late recovery requires an accepted learner turn and the full normal ownership budget', () => {
  assert.equal(typeof presentation.shouldStartLateTurnRecovery, 'function');
  const shouldStartLateTurnRecovery = presentation.shouldStartLateTurnRecovery;
  const base = {
    accepted: true,
    hasLearnerTurn: true,
    elapsedMs: 150_000,
    normalOwnershipMs: 150_000,
  };

  assert.equal(shouldStartLateTurnRecovery(base), true);
  assert.equal(shouldStartLateTurnRecovery({ ...base, accepted: false }), false);
  assert.equal(shouldStartLateTurnRecovery({ ...base, hasLearnerTurn: false }), false);
  assert.equal(shouldStartLateTurnRecovery({ ...base, elapsedMs: 149_999 }), false);
});

test('late recovery stops immediately on a terminal transcript outcome', async () => {
  const clock = fakeLateRecoveryClock();
  let polls = 0;

  const result = await runLateTurnRecovery({
    expectedClientTurnId: 'turn-terminal',
    deadlineMs: 120_000,
    maxPolls: 8,
    pollDelayMs: 10_000,
    isOwner: () => true,
    pollTranscript: async () => {
      polls += 1;
      return { foundExpectedTurn: false, completed: false, failed: false, terminal: true };
    },
    ...clock,
  });

  assert.deepEqual(result, { status: 'terminal', polls: 1 });
  assert.equal(polls, 1);
});
