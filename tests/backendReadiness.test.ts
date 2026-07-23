import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BackendUnavailableError,
  createBackendReadinessGate,
} from '../src/lib/backendReadiness.ts';

function healthResponse(status: string, ok = true) {
  return {
    ok,
    async json() {
      return { status };
    },
  };
}

test('waitUntilReady resolves only after the backend reports ok', async () => {
  let attempts = 0;
  let elapsed = 0;
  const gate = createBackendReadinessGate({
    fetchImpl: async () => {
      attempts += 1;
      return attempts === 1
        ? healthResponse('starting', false)
        : healthResponse('ok');
    },
    now: () => elapsed,
    sleep: async (milliseconds) => {
      elapsed += milliseconds;
    },
    maxWaitMs: 100,
    requestTimeoutMs: 50,
    retryDelayMs: 10,
  });

  await gate.waitUntilReady();

  assert.equal(attempts, 2);
});

test('concurrent readiness waits share one wake-up sequence', async () => {
  let attempts = 0;
  let releaseProbe: ((response: ReturnType<typeof healthResponse>) => void) | undefined;
  const gate = createBackendReadinessGate({
    fetchImpl: async () => {
      attempts += 1;
      return new Promise((resolve) => {
        releaseProbe = resolve;
      });
    },
    maxWaitMs: 100,
    requestTimeoutMs: 50,
    retryDelayMs: 1,
    sleep: async () => {},
  });

  const first = gate.waitUntilReady();
  const second = gate.waitUntilReady();
  await Promise.resolve();

  assert.equal(attempts, 1);
  releaseProbe?.(healthResponse('ok'));
  await Promise.all([first, second]);
  assert.equal(attempts, 1);
});

test('a bounded failure clears the gate so a retry can succeed', async () => {
  let attempts = 0;
  let elapsed = 0;
  let ready = false;
  const gate = createBackendReadinessGate({
    fetchImpl: async () => {
      attempts += 1;
      return ready
        ? healthResponse('ok')
        : healthResponse('starting', false);
    },
    now: () => elapsed,
    sleep: async (milliseconds) => {
      elapsed += milliseconds;
    },
    maxWaitMs: 20,
    requestTimeoutMs: 10,
    retryDelayMs: 10,
  });

  await assert.rejects(gate.waitUntilReady(), BackendUnavailableError);

  ready = true;
  await gate.waitUntilReady();
  assert.ok(attempts >= 3);
});

test('passive warm-up sends one probe without entering the retry loop', async () => {
  let attempts = 0;
  const gate = createBackendReadinessGate({
    fetchImpl: async () => {
      attempts += 1;
      return healthResponse('starting', false);
    },
  });

  await gate.warmBackend();

  assert.equal(attempts, 1);
});

test('an explicit wait starts its own probe while passive warm-up is pending', async () => {
  let attempts = 0;
  let releaseWarm: ((response: ReturnType<typeof healthResponse>) => void) | undefined;
  const gate = createBackendReadinessGate({
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) {
        return new Promise((resolve) => {
          releaseWarm = resolve;
        });
      }
      return healthResponse('ok');
    },
    maxWaitMs: 100,
    requestTimeoutMs: 50,
    retryDelayMs: 1,
    sleep: async () => {},
  });

  const warming = gate.warmBackend();
  await Promise.resolve();
  const waiting = gate.waitUntilReady();
  await Promise.resolve();
  const attemptsBeforeWarmSettles = attempts;

  releaseWarm?.(healthResponse('starting', false));
  await Promise.all([warming, waiting]);

  assert.equal(attemptsBeforeWarmSettles, 2);
});

test('a synchronous fetch failure is retried inside the bounded sequence', async () => {
  let attempts = 0;
  let elapsed = 0;
  const gate = createBackendReadinessGate({
    fetchImpl: () => {
      attempts += 1;
      if (attempts === 1) throw new Error('synchronous transport failure');
      return Promise.resolve(healthResponse('ok'));
    },
    now: () => elapsed,
    sleep: async (milliseconds) => {
      elapsed += milliseconds;
    },
    maxWaitMs: 100,
    requestTimeoutMs: 50,
    retryDelayMs: 10,
  });

  await gate.waitUntilReady();

  assert.equal(attempts, 2);
});
