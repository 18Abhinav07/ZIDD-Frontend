import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchWithOneAuthRetry } from '../src/services/authenticatedFetch.mjs';

test('retries one 401 exactly once with forced auth refresh', async () => {
  const calls = [];
  let invalidations = 0;
  const responses = [{ status: 401 }, { status: 200 }];

  const response = await fetchWithOneAuthRetry({
    runFetch: async (forceAuth) => {
      calls.push(forceAuth);
      return responses[calls.length - 1];
    },
    invalidateAuth: () => { invalidations += 1; },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [false, true]);
  assert.equal(invalidations, 1);
});

test('does not loop when the forced retry is also unauthorized', async () => {
  const calls = [];
  const response = await fetchWithOneAuthRetry({
    runFetch: async (forceAuth) => {
      calls.push(forceAuth);
      return { status: 401 };
    },
    invalidateAuth: () => {},
  });

  assert.equal(response.status, 401);
  assert.deepEqual(calls, [false, true]);
});

test('does not invalidate or retry a non-401 response', async () => {
  let invalidations = 0;
  const calls = [];
  const response = await fetchWithOneAuthRetry({
    runFetch: async (forceAuth) => {
      calls.push(forceAuth);
      return { status: 503 };
    },
    invalidateAuth: () => { invalidations += 1; },
  });

  assert.equal(response.status, 503);
  assert.deepEqual(calls, [false]);
  assert.equal(invalidations, 0);
});
