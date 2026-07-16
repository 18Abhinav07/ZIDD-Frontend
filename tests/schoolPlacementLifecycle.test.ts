import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const lifecyclePath = path.resolve(
  import.meta.dirname,
  '../src/lib/schoolPlacementLifecycle.ts',
);

async function loadLifecycle() {
  assert.equal(
    fs.existsSync(lifecyclePath),
    true,
    'placement lifecycle helper must exist',
  );
  return import(pathToFileURL(lifecyclePath).href);
}

const interactivePlacement = {
  session_id: 'placement-1',
  profile_version_id: 'profile-1',
  status: 'in_progress',
  next_item: { item_id: 'item-2' },
} as const;

const baseState = {
  status: 'in_progress',
  active_flow: 'placement',
  active_session_id: 'placement-1',
  profile_version_id: 'profile-1',
  next_action: 'resume_placement',
  next_action_url: '/school/readiness/placement-1',
  allowed_next_actions: ['resume_placement'],
} as const;

test('mutation question becomes interactive only after session and profile ownership match', async () => {
  const { resolveSchoolPlacementMutation } = await loadLifecycle();

  assert.deepEqual(resolveSchoolPlacementMutation(interactivePlacement, baseState), {
    kind: 'interactive',
    reportAvailable: false,
  });

  for (const state of [
    { ...baseState, active_session_id: 'placement-2' },
    { ...baseState, profile_version_id: 'profile-2' },
  ]) {
    assert.deepEqual(resolveSchoolPlacementMutation(interactivePlacement, state), {
      kind: 'recover',
      reportAvailable: false,
      reason: 'identity_mismatch',
    });
  }
});

test('confirmed pending placement remains disabled while polling continues', async () => {
  const { resolveSchoolPlacementMutation } = await loadLifecycle();

  assert.deepEqual(resolveSchoolPlacementMutation(interactivePlacement, {
    ...baseState,
    status: 'awaiting_evaluation',
    next_action: null,
    next_action_url: '/school/readiness/placement-1',
    allowed_next_actions: [],
  }), {
    kind: 'pending',
    reportAvailable: false,
  });
});

test('completed placement follows primary state action while retaining report as secondary', async () => {
  const { resolveSchoolPlacementMutation } = await loadLifecycle();
  const completedPlacement = {
    ...interactivePlacement,
    status: 'below_target',
    next_item: null,
  } as const;

  assert.deepEqual(resolveSchoolPlacementMutation(completedPlacement, {
    ...baseState,
    status: 'ready',
    active_flow: 'placement_report',
    next_action: 'start_recap',
    next_action_url: '/school/recap',
    allowed_next_actions: ['view_placement_report', 'start_recap'],
  }), {
    kind: 'navigate',
    destination: '/school/recap',
    reportAvailable: true,
  });
});

test('completed placement fails closed when refreshed state still claims an interactive action', async () => {
  const { resolveSchoolPlacementMutation } = await loadLifecycle();
  const completedPlacement = {
    ...interactivePlacement,
    status: 'below_target',
    next_item: null,
  } as const;

  assert.deepEqual(resolveSchoolPlacementMutation(completedPlacement, baseState), {
    kind: 'recover',
    reportAvailable: false,
    reason: 'state_unresolved',
  });
});

test('abandoned placement exposes report only behind the primary restart action', async () => {
  const { resolveSchoolPlacementMutation } = await loadLifecycle();
  const abandonedPlacement = {
    ...interactivePlacement,
    status: 'abandoned',
    next_item: null,
  } as const;

  assert.deepEqual(resolveSchoolPlacementMutation(abandonedPlacement, {
    ...baseState,
    status: 'recoverable_error',
    active_flow: 'placement_report',
    next_action: 'start_placement',
    next_action_url: '/school/readiness',
    allowed_next_actions: ['view_placement_report', 'start_placement'],
  }), {
    kind: 'start',
    reportAvailable: true,
  });
});
