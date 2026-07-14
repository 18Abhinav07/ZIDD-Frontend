import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildOnboardingStepPatch,
  clampOnboardingRouteStep,
  createSchoolActivationCoordinator,
  createSchoolActivationRecoveryStore,
  createOnboardingRequestCoordinator,
  decideSchoolOnboardingNavigation,
  emptySchoolOnboardingForm,
  hydrateSchoolOnboarding,
  hasMaterialSchoolProfileChanges,
  reconcileSchoolActivation,
  saveSchoolDraftWithConflictRefresh,
  validateSchoolOnboardingStep,
  type SchoolOnboardingForm,
  type SchoolOnboardingSnapshot,
} from '../src/lib/schoolOnboardingPolicy.ts';

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
    storedValues() {
      return Array.from(values.values());
    },
  };
}

const completeForm: SchoolOnboardingForm = {
  display_name: 'Mira',
  school_name: 'City School',
  board_id: 'cbse',
  target_class_no: 3,
  subject_ids: ['english'],
  preferred_teaching_language: 'hi_en',
  english_comfort: 'medium',
  learner_goal: 'Read stories with confidence.',
  parent_goal: '',
  prior_difficulty_signals: ['reading', 'chapter_answers'],
};

const activeProfile = {
  profile_version_id: '11111111-1111-4111-8111-111111111111',
  coach_avatar_id: 'brave_bella',
  coach_palette_id: 'brave_bella',
  ...completeForm,
  board_id: 'cbse' as const,
  target_class_no: 3,
  preferred_teaching_language: 'hi_en' as const,
  english_comfort: 'medium' as const,
};

const persistedDraft = {
  profile_version_id: '22222222-2222-4222-8222-222222222222',
  status: 'draft' as const,
  current_step: 2,
  draft_revision: 4,
  display_name: 'Persisted Mira',
  school_name: '',
  board_id: null,
  target_class_no: null,
  subject_ids: null,
  preferred_teaching_language: null,
  english_comfort: null,
  learner_goal: null,
  parent_goal: null,
  prior_difficulty_signals: null,
};

test('validates every step against the backend field contract', () => {
  assert.deepEqual(validateSchoolOnboardingStep(0, {
    ...completeForm,
    display_name: 'M',
    school_name: 'x'.repeat(161),
  }), {
    display_name: 'Learner name must be between 2 and 120 characters.',
    school_name: 'School name must be between 2 and 160 characters.',
  });

  assert.deepEqual(validateSchoolOnboardingStep(1, {
    ...completeForm,
    board_id: null,
    target_class_no: 6,
    subject_ids: ['english', 'maths'] as SchoolOnboardingForm['subject_ids'],
  }), {
    board_id: 'Choose an available curriculum.',
    subject_ids: 'Choose an available subject.',
  });

  assert.deepEqual(validateSchoolOnboardingStep(2, {
    ...completeForm,
    preferred_teaching_language: null,
    english_comfort: null,
  }), {
    preferred_teaching_language: 'Choose a teaching language.',
    english_comfort: 'Choose the learner\'s English comfort level.',
  });

  assert.deepEqual(validateSchoolOnboardingStep(3, {
    ...completeForm,
    learner_goal: 'x'.repeat(361),
    parent_goal: ' ',
    prior_difficulty_signals: ['reading', 'unknown'] as SchoolOnboardingForm['prior_difficulty_signals'],
  }), {
    learner_goal: 'Learner goal must be 360 characters or fewer.',
    prior_difficulty_signals: 'Choose only the available difficulty areas.',
  });

  assert.deepEqual(validateSchoolOnboardingStep(3, {
    ...completeForm,
    learner_goal: ' ',
    parent_goal: '',
  }), {
    learner_goal: 'Add at least one learner or parent goal.',
    parent_goal: 'Add at least one learner or parent goal.',
  });
});

test('hydrates the exact persisted draft without inventing completion values', () => {
  const snapshot: SchoolOnboardingSnapshot = {
    profile_status: 'incomplete',
    active_profile: null,
    profile: null,
    draft: persistedDraft,
  };

  const hydrated = hydrateSchoolOnboarding(snapshot);

  assert.equal(hydrated.source, 'draft');
  assert.equal(hydrated.persistedStep, 2);
  assert.equal(hydrated.draft?.draft_revision, 4);
  assert.deepEqual(hydrated.form, {
    display_name: 'Persisted Mira',
    school_name: '',
    board_id: null,
    target_class_no: null,
    subject_ids: [],
    preferred_teaching_language: null,
    english_comfort: null,
    learner_goal: '',
    parent_goal: '',
    prior_difficulty_signals: [],
  });
  assert.deepEqual(validateSchoolOnboardingStep(4, hydrated.form), {
    school_name: 'School name must be between 2 and 160 characters.',
    board_id: 'Choose an available curriculum.',
    target_class_no: 'Choose an available class.',
    subject_ids: 'Choose an available subject.',
    preferred_teaching_language: 'Choose a teaching language.',
    english_comfort: 'Choose the learner\'s English comfort level.',
    learner_goal: 'Add at least one learner or parent goal.',
    parent_goal: 'Add at least one learner or parent goal.',
  });
});

test('seeds active edits exactly and keeps a missing profile empty', () => {
  const active = hydrateSchoolOnboarding({
    profile_status: 'complete',
    active_profile: activeProfile,
    profile: activeProfile,
    draft: null,
  });
  assert.equal(active.source, 'active');
  assert.equal(active.persistedStep, 4);
  assert.deepEqual(active.form, completeForm);

  for (let requestedStep = 0; requestedStep <= 4; requestedStep += 1) {
    assert.deepEqual(decideSchoolOnboardingNavigation({
      busy: false,
      currentStep: 4,
      nextStep: requestedStep as 0 | 1 | 2 | 3 | 4,
      persistedStep: active.persistedStep,
      dirtyStep: null,
    }), requestedStep === 4 ? { kind: 'blocked' } : { kind: 'navigate' });
  }
  assert.equal(clampOnboardingRouteStep('2', active.persistedStep), 1);
  assert.equal(clampOnboardingRouteStep('9', active.persistedStep), 4);

  const missing = hydrateSchoolOnboarding({
    profile_status: 'missing',
    active_profile: null,
    profile: null,
    draft: null,
  });
  assert.equal(missing.source, 'default');
  assert.deepEqual(missing.form, emptySchoolOnboardingForm());
  assert.equal(missing.form.target_class_no, null);
  assert.equal(missing.form.preferred_teaching_language, null);
});

test('builds flattened patches containing only the current step fields', () => {
  assert.deepEqual(buildOnboardingStepPatch(0, completeForm), {
    display_name: 'Mira',
    school_name: 'City School',
    current_step: 1,
  });
  assert.deepEqual(buildOnboardingStepPatch(1, completeForm), {
    board_id: 'cbse',
    target_class_no: 3,
    subject_ids: ['english'],
    current_step: 2,
  });
  assert.deepEqual(buildOnboardingStepPatch(2, completeForm), {
    preferred_teaching_language: 'hi_en',
    english_comfort: 'medium',
    current_step: 3,
  });
  assert.deepEqual(buildOnboardingStepPatch(3, {
    ...completeForm,
    learner_goal: '  Read stories with confidence.  ',
  }), {
    learner_goal: 'Read stories with confidence.',
    parent_goal: '',
    prior_difficulty_signals: ['reading', 'chapter_answers'],
    current_step: 4,
  });
});

test('clamps route steps to the server-persisted boundary', () => {
  assert.equal(clampOnboardingRouteStep(null, 3), 3);
  assert.equal(clampOnboardingRouteStep('2', 3), 1);
  assert.equal(clampOnboardingRouteStep('5', 3), 3);
  assert.equal(clampOnboardingRouteStep('-7', 3), 0);
  assert.equal(clampOnboardingRouteStep('not-a-step', 3), 3);
  assert.equal(clampOnboardingRouteStep('5', 99), 4);
});

test('dirty revisitable navigation saves its owning step before changing routes', () => {
  assert.deepEqual(decideSchoolOnboardingNavigation({
    busy: false,
    currentStep: 3,
    nextStep: 1,
    persistedStep: 4,
    dirtyStep: 3,
  }), { kind: 'save_then_navigate', dirtyStep: 3 });

  assert.deepEqual(decideSchoolOnboardingNavigation({
    busy: false,
    currentStep: 3,
    nextStep: 1,
    persistedStep: 4,
    dirtyStep: null,
  }), { kind: 'navigate' });
});

test('onboarding navigation remains blocked while busy or beyond persisted progress', () => {
  assert.deepEqual(decideSchoolOnboardingNavigation({
    busy: true,
    currentStep: 2,
    nextStep: 1,
    persistedStep: 4,
    dirtyStep: 2,
  }), { kind: 'blocked' });
  assert.deepEqual(decideSchoolOnboardingNavigation({
    busy: false,
    currentStep: 1,
    nextStep: 4,
    persistedStep: 2,
    dirtyStep: 1,
  }), { kind: 'blocked' });
  assert.deepEqual(decideSchoolOnboardingNavigation({
    busy: false,
    currentStep: 2,
    nextStep: 2,
    persistedStep: 4,
    dirtyStep: 2,
  }), { kind: 'blocked' });
});

test('reuses request id and body only for the same uncertain save or activation payload', () => {
  const ids = ['save-1', 'save-2', 'activate-1', 'activate-2'];
  const coordinator = createOnboardingRequestCoordinator(() => ids.shift() ?? 'unexpected');
  const payload = { display_name: 'Mira', current_step: 1 };

  const first = coordinator.prepare('save', payload);
  payload.display_name = 'Changed after prepare';
  const retry = coordinator.prepare('save', { display_name: 'Mira', current_step: 1 });
  const changed = coordinator.prepare('save', { display_name: 'Mira B', current_step: 1 });
  const activation = coordinator.prepare('activate', {
    profile_version_id: 'draft-1',
    expected_revision: 2,
  });
  const activationRetry = coordinator.prepare('activate', {
    expected_revision: 2,
    profile_version_id: 'draft-1',
  });
  const nextActivation = coordinator.prepare('activate', {
    profile_version_id: 'draft-1',
    expected_revision: 3,
  });

  assert.equal(first.request_id, 'save-1');
  assert.deepEqual(first, retry);
  assert.equal(retry.display_name, 'Mira');
  assert.equal(changed.request_id, 'save-2');
  assert.equal(activation.request_id, 'activate-1');
  assert.deepEqual(activationRetry, activation);
  assert.equal(nextActivation.request_id, 'activate-2');
});

test('uncertain save retries preserve request lineage while changed payloads get a new request id', async () => {
  const ids = ['save-1', 'save-2'];
  const coordinator = createOnboardingRequestCoordinator(() => ids.shift() ?? 'unexpected');
  const requests: Array<Record<string, unknown>> = [];
  let failFirst = true;
  const save = async (payload: Record<string, unknown>) => {
    requests.push(structuredClone(payload));
    if (failFirst) {
      failFirst = false;
      throw new Error('network_failed_after_send');
    }
    return payload;
  };

  const basePayload = {
    learner_goal: 'Read clearly.',
    current_step: 4,
    profile_version_id: 'draft-v1',
    expected_revision: 7,
  };
  const first = coordinator.prepare('save', basePayload);
  await assert.rejects(save(first), /network_failed_after_send/);

  const unchangedRetry = coordinator.prepare('save', basePayload);
  await save(unchangedRetry);
  coordinator.clear(unchangedRetry.request_id);

  const changedRetry = coordinator.prepare('save', {
    ...basePayload,
    learner_goal: 'Read and write clearly.',
  });

  assert.deepEqual(requests[0], requests[1]);
  assert.equal(unchangedRetry.request_id, 'save-1');
  assert.equal(unchangedRetry.expected_revision, 7);
  assert.equal(changedRetry.request_id, 'save-2');
  assert.equal(changedRetry.expected_revision, 7);
  assert.equal(changedRetry.profile_version_id, 'draft-v1');
});

test('a typed draft conflict refreshes and hydrates server truth', async () => {
  let refreshCalls = 0;
  const result = await saveSchoolDraftWithConflictRefresh({
    save: async () => {
      throw new Error('school_draft_revision_conflict');
    },
    refresh: async () => {
      refreshCalls += 1;
      return {
        profile_status: 'incomplete',
        active_profile: null,
        profile: null,
        draft: persistedDraft,
      };
    },
  });

  assert.equal(refreshCalls, 1);
  assert.equal(result.kind, 'conflict_refreshed');
  if (result.kind !== 'conflict_refreshed') throw new Error('expected conflict refresh');
  assert.equal(result.hydrated.form.display_name, 'Persisted Mira');
  assert.equal(result.hydrated.draft?.draft_revision, 4);
});

test('activation success followed by state refresh failure retries refresh only', async () => {
  let activationCalls = 0;
  let refreshCalls = 0;
  const activatedProfile = { ...activeProfile, preferred_teaching_language: 'en' as const };

  const first = await reconcileSchoolActivation({
    committedProfile: null,
    activate: async () => {
      activationCalls += 1;
      return activatedProfile;
    },
    refreshState: async () => {
      refreshCalls += 1;
      throw new Error('network_failed');
    },
  });

  assert.equal(first.kind, 'saved_refresh_required');
  assert.equal(activationCalls, 1);
  assert.equal(refreshCalls, 1);
  assert.deepEqual(first.committedProfile, activatedProfile);

  const second = await reconcileSchoolActivation({
    committedProfile: first.committedProfile,
    activate: async () => {
      activationCalls += 1;
      return activatedProfile;
    },
    refreshState: async () => {
      refreshCalls += 1;
      return {
        next_action: 'start_placement',
        allowed_next_actions: ['start_placement'],
      };
    },
  });

  assert.equal(second.kind, 'ready');
  assert.equal(activationCalls, 1);
  assert.equal(refreshCalls, 2);
});

test('activation fails closed when refreshed state does not authorize placement', async () => {
  const result = await reconcileSchoolActivation({
    committedProfile: activeProfile,
    activate: async () => activeProfile,
    refreshState: async () => ({
      next_action: null,
      allowed_next_actions: [],
    }),
  });

  assert.equal(result.kind, 'saved_unexpected_state');
  assert.deepEqual(result.committedProfile, activeProfile);
});

test('activation refresh failure recovers after reload without re-posting activation', async () => {
  const storage = createMemoryStorage();
  let activationCalls = 0;
  let refreshCalls = 0;
  let onboardingCalls = 0;

  const firstCoordinator = createSchoolActivationCoordinator({
    recoveryStore: createSchoolActivationRecoveryStore(storage),
    activate: async () => {
      activationCalls += 1;
      return { profile: activeProfile };
    },
    loadOnboarding: async () => {
      onboardingCalls += 1;
      throw new Error('not_expected_before_reload');
    },
    refreshState: async () => {
      refreshCalls += 1;
      throw new Error('state_refresh_failed');
    },
  });

  const first = await firstCoordinator.submit({
    profile_version_id: activeProfile.profile_version_id,
    expected_revision: 7,
    request_id: 'activation-1',
  }, 'initial');
  assert.deepEqual(first, { kind: 'refresh_required' });
  assert.equal(activationCalls, 1);
  assert.equal(refreshCalls, 1);
  assert.equal(onboardingCalls, 0);
  assert.deepEqual(storage.storedValues(), [JSON.stringify({
    profile_version_id: activeProfile.profile_version_id,
    activation_context: 'initial',
  })]);

  const secondCoordinator = createSchoolActivationCoordinator({
    recoveryStore: createSchoolActivationRecoveryStore(storage),
    activate: async () => {
      activationCalls += 1;
      return { profile: activeProfile };
    },
    loadOnboarding: async () => {
      onboardingCalls += 1;
      return {
        profile_status: 'complete' as const,
        active_profile: activeProfile,
        profile: activeProfile,
        draft: null,
      };
    },
    refreshState: async () => {
      refreshCalls += 1;
      return {
        next_action: 'start_placement',
        allowed_next_actions: ['start_placement'],
        next_action_url: '/school/placement',
      };
    },
  });

  const recovered = await secondCoordinator.recover();
  assert.deepEqual(recovered, { kind: 'route', href: '/school/placement' });
  assert.equal(activationCalls, 1);
  assert.equal(refreshCalls, 2);
  assert.equal(onboardingCalls, 1);
  assert.equal(createSchoolActivationRecoveryStore(storage).read(), null);
});

test('duplicate activation submits share one in-flight POST', async () => {
  const storage = createMemoryStorage();
  let activationCalls = 0;
  const deferredActivation: { release: (() => void) | null } = { release: null };
  const coordinator = createSchoolActivationCoordinator({
    recoveryStore: createSchoolActivationRecoveryStore(storage),
    activate: async () => {
      activationCalls += 1;
      await new Promise<void>((resolve) => {
        deferredActivation.release = resolve;
      });
      return { profile: activeProfile };
    },
    loadOnboarding: async () => ({
      profile_status: 'complete',
      active_profile: activeProfile,
      profile: activeProfile,
      draft: null,
    }),
    refreshState: async () => ({
      next_action: 'start_placement',
      allowed_next_actions: ['start_placement'],
      next_action_url: '/school/placement',
    }),
  });
  const request = {
    profile_version_id: activeProfile.profile_version_id,
    expected_revision: 7,
    request_id: 'activation-1',
  };

  const first = coordinator.submit(request, 'initial');
  const duplicate = coordinator.submit(request, 'initial');
  assert.equal(first, duplicate);
  assert.equal(activationCalls, 1);
  if (!deferredActivation.release) throw new Error('activation_not_started');
  deferredActivation.release();

  assert.deepEqual(await first, { kind: 'route', href: '/school/placement' });
  assert.equal(activationCalls, 1);
});

test('reload clears stale and terminal recovery markers', async () => {
  const staleStorage = createMemoryStorage();
  const staleStore = createSchoolActivationRecoveryStore(staleStorage);
  staleStore.write({ profile_version_id: 'stale-profile', activation_context: 'initial' });
  let staleRefreshCalls = 0;
  const staleCoordinator = createSchoolActivationCoordinator({
    recoveryStore: staleStore,
    activate: async () => ({ profile: activeProfile }),
    loadOnboarding: async () => ({
      profile_status: 'complete',
      active_profile: activeProfile,
      profile: activeProfile,
      draft: null,
    }),
    refreshState: async () => {
      staleRefreshCalls += 1;
      throw new Error('must_not_refresh_stale_marker');
    },
  });

  const stale = await staleCoordinator.recover();
  assert.equal(stale.kind, 'stale_marker');
  assert.equal(staleStore.read(), null);
  assert.equal(staleRefreshCalls, 0);

  const finishedStorage = createMemoryStorage();
  const finishedStore = createSchoolActivationRecoveryStore(finishedStorage);
  finishedStore.write({
    profile_version_id: activeProfile.profile_version_id,
    activation_context: 'initial',
  });
  const finishedCoordinator = createSchoolActivationCoordinator({
    recoveryStore: finishedStore,
    activate: async () => ({ profile: activeProfile }),
    loadOnboarding: async () => ({
      profile_status: 'complete',
      active_profile: activeProfile,
      profile: activeProfile,
      draft: null,
    }),
    refreshState: async () => ({
      next_action: null,
      allowed_next_actions: [],
      next_action_url: '/school',
    }),
  });

  assert.deepEqual(await finishedCoordinator.recover(), { kind: 'unexpected_state' });
  assert.equal(finishedStore.read(), null);

  finishedStore.write({
    profile_version_id: activeProfile.profile_version_id,
    activation_context: 'initial',
  });
  const wrongActionCoordinator = createSchoolActivationCoordinator({
    recoveryStore: finishedStore,
    activate: async () => ({ profile: activeProfile }),
    loadOnboarding: async () => ({
      profile_status: 'complete',
      active_profile: activeProfile,
      profile: activeProfile,
      draft: null,
    }),
    refreshState: async () => ({
      next_action: 'start_curriculum',
      allowed_next_actions: ['start_curriculum'],
      next_action_url: '/school/curriculum',
    }),
  });
  assert.deepEqual(await wrongActionCoordinator.recover(), {
    kind: 'unexpected_state',
  });
  assert.equal(finishedStore.read(), null);
});

test('compatible profile activation routes only to backend-authorized placement, resume, or view work', async () => {
  const compatibleActions = [
    ['start_placement', '/school/placement'],
    ['resume_placement', '/school/placement'],
    ['view_placement_report', '/school/placement/report'],
    ['resume_recap', '/school/recap'],
    ['resume_curriculum', '/school/curriculum/session-1'],
    ['start_masterclass', '/school/curriculum/session-1'],
    ['resume_masterclass', '/school/curriculum/session-1'],
    ['resume_support', '/school/support'],
    ['view_support_plan', '/school/support'],
    ['view_report', '/school/report'],
  ] as const;

  for (const [nextAction, nextActionUrl] of compatibleActions) {
    const storage = createMemoryStorage();
    const store = createSchoolActivationRecoveryStore(storage);
    const coordinator = createSchoolActivationCoordinator({
      recoveryStore: store,
      activate: async () => ({ profile: activeProfile }),
      loadOnboarding: async () => ({
        profile_status: 'complete',
        active_profile: activeProfile,
        profile: activeProfile,
        draft: null,
      }),
      refreshState: async () => ({
        next_action: nextAction,
        allowed_next_actions: [nextAction],
        next_action_url: nextActionUrl,
      }),
    });

    const result = await coordinator.submit({ request_id: `activate-${nextAction}` }, 'compatible_edit');
    assert.deepEqual(result, { kind: 'route', href: nextActionUrl });
    assert.equal(store.read(), null);
  }
});

test('activation context never promotes initial, material, or compatible edits to a stronger client state', async () => {
  const cases = [
    { context: 'initial', nextAction: 'resume_curriculum', url: '/school/curriculum/session-1' },
    { context: 'material_edit', nextAction: 'resume_placement', url: '/school/placement' },
    { context: 'compatible_edit', nextAction: 'sign_in', url: '/school' },
    { context: 'compatible_edit', nextAction: 'complete_profile', url: '/school/onboarding' },
    { context: 'compatible_edit', nextAction: 'edit_profile', url: '/school/onboarding' },
    { context: 'compatible_edit', nextAction: 'finish_placement', url: '/school/placement' },
    { context: 'compatible_edit', nextAction: 'start_recap', url: '/school/recap' },
    { context: 'compatible_edit', nextAction: 'revise_recap_path', url: '/school/recap' },
    { context: 'compatible_edit', nextAction: 'start_curriculum', url: '/school/curriculum' },
    { context: 'compatible_edit', nextAction: 'retry', url: '/school' },
    { context: 'compatible_edit', nextAction: 'resume_recap', url: '/outside-school' },
  ] as const;

  for (const { context, nextAction, url } of cases) {
    const storage = createMemoryStorage();
    const store = createSchoolActivationRecoveryStore(storage);
    const coordinator = createSchoolActivationCoordinator({
      recoveryStore: store,
      activate: async () => ({ profile: activeProfile }),
      loadOnboarding: async () => ({
        profile_status: 'complete',
        active_profile: activeProfile,
        profile: activeProfile,
        draft: null,
      }),
      refreshState: async () => ({
        next_action: nextAction,
        allowed_next_actions: [nextAction],
        next_action_url: url,
      }),
    });

    assert.deepEqual(
      await coordinator.submit({ request_id: `activate-${context}` }, context),
      { kind: 'unexpected_state' },
    );
    assert.equal(store.read(), null);
  }
});

test('material edit detection ignores non-material profile changes and set ordering', () => {
  assert.equal(hasMaterialSchoolProfileChanges({
    ...completeForm,
    subject_ids: [...completeForm.subject_ids].reverse(),
    prior_difficulty_signals: [...completeForm.prior_difficulty_signals].reverse(),
  }, activeProfile), false);

  for (const form of [
    { ...completeForm, display_name: 'Mira B' },
    { ...completeForm, school_name: 'New City School' },
    { ...completeForm, learner_goal: 'Write clearer answers.' },
    { ...completeForm, parent_goal: 'Build a steady weekly reading habit.' },
  ]) {
    assert.equal(hasMaterialSchoolProfileChanges(form, activeProfile), false);
  }
});

test('material edit detection covers every compatibility field', () => {
  for (const form of [
    { ...completeForm, board_id: 'ncert' as const },
    { ...completeForm, target_class_no: 4 },
    { ...completeForm, subject_ids: ['maths'] },
    { ...completeForm, preferred_teaching_language: 'en' as const },
    { ...completeForm, english_comfort: 'high' as const },
    { ...completeForm, prior_difficulty_signals: ['grammar'] },
  ]) {
    assert.equal(hasMaterialSchoolProfileChanges(form, activeProfile), true);
  }
});
