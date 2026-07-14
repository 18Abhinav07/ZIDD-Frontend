import assert from 'node:assert/strict';
import test from 'node:test';
import {
  authorizedSchoolActions,
  completedMasterclassReturnAction,
  curriculumActivityView,
  releaseSchoolTutorLoad,
  placementLoadDecision,
  recapLoadDecision,
  runCurriculumMutation,
  schoolCurriculumSessionOwnedByState,
  resolveSchoolStateAction,
  resolveSchoolStateDestination,
  schoolMasterclassLineage,
  schoolMasterclassShellBackAction,
  schoolSubjectLabel,
  schoolTutorLoadDecision,
  schoolTutorLoadOwnedBy,
  startSingleFlightRevalidation,
} from '../src/lib/schoolActivityPolicy.ts';

test('school navigation follows only an allowed backend action and destination', () => {
  assert.equal(resolveSchoolStateDestination({
    nextAction: 'resume_recap',
    allowedNextActions: ['resume_recap'],
    nextActionUrl: '/school/recap/recap-1',
  }), '/school/recap/recap-1');
});

test('school navigation accepts the canonical start masterclass action', () => {
  assert.equal(resolveSchoolStateDestination({
    nextAction: 'start_masterclass',
    allowedNextActions: ['start_masterclass'],
    nextActionUrl: '/school/session/curriculum-1',
  }), '/school/session/curriculum-1');
});

test('school navigation canonicalizes readiness aliases to the rendered placement routes', () => {
  assert.equal(resolveSchoolStateDestination({
    nextAction: 'start_placement',
    allowedNextActions: ['start_placement'],
    nextActionUrl: '/school/readiness',
  }), '/school/placement');
  assert.equal(resolveSchoolStateDestination({
    nextAction: 'resume_placement',
    allowedNextActions: ['resume_placement'],
    nextActionUrl: '/school/readiness/placement-1',
  }), '/school/placement');
  assert.equal(resolveSchoolStateDestination({
    nextAction: 'view_placement_report',
    allowedNextActions: ['view_placement_report'],
    nextActionUrl: '/school/readiness/report',
  }), '/school/placement/report');
});

test('school state action preserves the exact validated backend action and URL', () => {
  assert.deepEqual(resolveSchoolStateAction({
    nextAction: 'start_curriculum',
    allowedNextActions: ['start_curriculum'],
    nextActionUrl: '/school/classes/5',
  }), {
    action: 'start_curriculum',
    href: '/school/classes/5',
  });
  assert.equal(resolveSchoolStateAction({
    nextAction: 'start_curriculum',
    allowedNextActions: [],
    nextActionUrl: '/school/classes/5',
  }), null);
});

test('school navigation fails closed for an unapproved or external destination', () => {
  assert.equal(resolveSchoolStateDestination({
    nextAction: 'resume_recap',
    allowedNextActions: [],
    nextActionUrl: '/school/recap/recap-1',
  }), null);
  assert.equal(resolveSchoolStateDestination({
    nextAction: 'resume_recap',
    allowedNextActions: ['resume_recap'],
    nextActionUrl: '/career',
  }), null);
});

test('placement load error never exposes start', () => {
  assert.deepEqual(placementLoadDecision({
    loadFailed: true,
    activeFlow: null,
    activeSessionId: null,
    allowedNextActions: ['start_placement'],
  }), { kind: 'load_error', canStart: false });
});

test('placement start requires explicit backend authorization', () => {
  assert.deepEqual(placementLoadDecision({
    loadFailed: false,
    activeFlow: 'none',
    activeSessionId: null,
    allowedNextActions: ['start_placement'],
  }), { kind: 'start', canStart: true });

  assert.deepEqual(placementLoadDecision({
    loadFailed: false,
    activeFlow: 'none',
    activeSessionId: null,
    allowedNextActions: [],
  }), { kind: 'recover', canStart: false });
});

test('placement report and conclusive placement statuses redirect to canonical report', () => {
  assert.deepEqual(placementLoadDecision({
    loadFailed: false,
    activeFlow: 'placement_report',
    activeSessionId: 'placement-1',
    allowedNextActions: ['view_placement_report'],
  }), { kind: 'redirect', href: '/school/readiness/report', canStart: false });

  for (const placementStatus of ['target_ready', 'below_target']) {
    assert.deepEqual(placementLoadDecision({
      loadFailed: false,
      activeFlow: 'placement',
      activeSessionId: 'placement-1',
      allowedNextActions: [],
      placementStatus,
    }), { kind: 'redirect', href: '/school/readiness/report', canStart: false });
  }

  assert.deepEqual(placementLoadDecision({
    loadFailed: false,
    activeFlow: 'placement_report',
    activeSessionId: 'placement-1',
    allowedNextActions: ['view_placement_report', 'start_placement'],
    placementStatus: 'abandoned',
  }), { kind: 'start', canStart: true });
});

test('recap load error never exposes start and authorization is explicit', () => {
  assert.deepEqual(recapLoadDecision({
    loadFailed: true,
    activeFlow: null,
    activeSessionId: null,
    allowedNextActions: ['start_recap'],
  }), { kind: 'load_error', canStart: false });

  assert.deepEqual(recapLoadDecision({
    loadFailed: false,
    activeFlow: 'placement_report',
    activeSessionId: null,
    allowedNextActions: ['start_recap'],
  }), { kind: 'start', canStart: true });
});

test('pending curriculum is passive and schedules revalidation', () => {
  assert.deepEqual(curriculumActivityView({
    schoolStatus: 'awaiting_evaluation',
    sessionStatus: 'active',
    phase: 'learning',
    activityId: 'activity-1',
    canAnswer: true,
  }), {
    kind: 'pending',
    canSubmit: false,
    pollDue: true,
    pollAfterMs: 5_000,
  });
});

test('curriculum completion requires explicit status and phase', () => {
  assert.equal(curriculumActivityView({
    schoolStatus: 'in_progress',
    sessionStatus: 'complete',
    phase: 'complete',
    activityId: null,
    canAnswer: false,
  }).kind, 'complete');

  assert.equal(curriculumActivityView({
    schoolStatus: 'in_progress',
    sessionStatus: 'active',
    phase: 'learning',
    activityId: null,
    canAnswer: false,
  }).kind, 'recover');
});

test('successful curriculum mutation is committed before refresh and retained on refresh failure', async () => {
  const previousSession = { session_id: 'old', current_activity: { activity_id: 'old-question' } };
  const nextSession = { session_id: 'new', current_activity: { activity_id: 'new-question' } };
  const events: string[] = [];
  let visibleSession = previousSession;

  const result = await runCurriculumMutation({
    mutate: async () => nextSession,
    refreshState: async () => {
      events.push('refresh');
      throw new Error('state_refresh_failed');
    },
    commitSession: (session) => {
      visibleSession = session;
      events.push('commit');
    },
    commitSchoolStatus: () => events.push('status'),
  });

  assert.deepEqual(events, ['commit', 'refresh']);
  assert.equal(visibleSession, nextSession);
  assert.equal(result.nextSession, nextSession);
  assert.equal(result.refreshFailed, true);
});

test('null primary with nonempty allowed actions fails closed', () => {
  assert.deepEqual(authorizedSchoolActions({
    statusKnown: true,
    nextAction: null,
    allowedNextActions: ['start_placement'],
  }), []);

  assert.deepEqual(authorizedSchoolActions({
    statusKnown: true,
    nextAction: null,
    allowedNextActions: [],
  }), []);
});

test('school shell exposes exactly the backend primary action', () => {
  assert.deepEqual(authorizedSchoolActions({
    statusKnown: true,
    nextAction: 'start_placement',
    allowedNextActions: ['view_report', 'start_placement', 'edit_profile'],
  }), ['start_placement']);

  assert.deepEqual(authorizedSchoolActions({
    statusKnown: true,
    nextAction: 'start_placement',
    allowedNextActions: ['view_report'],
  }), []);

  assert.deepEqual(authorizedSchoolActions({
    statusKnown: false,
    nextAction: 'start_placement',
    allowedNextActions: ['start_placement'],
  }), []);
});

test('school shell exposes backend sign in as the only unauthenticated action', () => {
  assert.deepEqual(authorizedSchoolActions({
    statusKnown: true,
    nextAction: 'sign_in',
    allowedNextActions: ['sign_in'],
  }), ['sign_in']);
});

test('unknown subject ids fail closed to a learner-safe label', () => {
  assert.equal(schoolSubjectLabel('english'), 'English');
  assert.equal(schoolSubjectLabel('internal_subject_v4'), 'School subject');
  assert.equal(schoolSubjectLabel(null), 'School subject');
});

test('single-flight revalidation prevents overlap and cancels its timer', async () => {
  let tick: (() => void) | null = null;
  let cleared = false;
  let resolveLoad: (() => void) | null = null;
  let calls = 0;
  const fireTick = () => {
    if (!tick) throw new Error('timer_not_scheduled');
    tick();
  };
  const finishLoad = () => {
    if (!resolveLoad) throw new Error('load_not_started');
    resolveLoad();
  };

  const revalidator = startSingleFlightRevalidation({
    intervalMs: 5_000,
    revalidate: () => {
      calls += 1;
      return new Promise<void>((resolve) => {
        resolveLoad = resolve;
      });
    },
    schedule: (callback) => {
      tick = callback;
      return 7;
    },
    cancelSchedule: (timer) => {
      assert.equal(timer, 7);
      cleared = true;
    },
  });

  fireTick();
  fireTick();
  assert.equal(calls, 1);

  finishLoad();
  await Promise.resolve();
  await Promise.resolve();
  fireTick();
  assert.equal(calls, 2);

  revalidator.cancel();
  assert.equal(cleared, true);
  fireTick();
  assert.equal(calls, 2);
});

test('tutor load ownership dedupes one session but immediately replaces it for a changed route', () => {
  const first = schoolTutorLoadDecision(null, { sessionId: 'session-a', requestId: 1 });
  assert.deepEqual(first, {
    kind: 'start',
    owner: { sessionId: 'session-a', requestId: 1 },
  });

  assert.deepEqual(schoolTutorLoadDecision(first.owner, {
    sessionId: 'session-a',
    requestId: 2,
  }), {
    kind: 'dedupe',
    owner: first.owner,
  });

  const replacement = schoolTutorLoadDecision(first.owner, {
    sessionId: 'session-b',
    requestId: 2,
  });
  assert.deepEqual(replacement, {
    kind: 'start',
    owner: { sessionId: 'session-b', requestId: 2 },
  });
  assert.equal(schoolTutorLoadOwnedBy(replacement.owner, first.owner), false);
  assert.equal(schoolTutorLoadOwnedBy(replacement.owner, replacement.owner), true);
  assert.equal(releaseSchoolTutorLoad(replacement.owner, first.owner), replacement.owner);
  assert.equal(releaseSchoolTutorLoad(replacement.owner, replacement.owner), null);
});

test('curriculum ownership accepts null backend state only for a terminal fetched session', () => {
  const base = {
    activeSessionId: null,
    requestedSessionId: 'curriculum-1',
    fetchedSessionId: 'curriculum-1',
    linkedMasterclassSessionId: null,
  } as const;

  assert.equal(schoolCurriculumSessionOwnedByState({ ...base, status: 'complete' }), true);
  assert.equal(schoolCurriculumSessionOwnedByState({ ...base, status: 'active' }), false);
  assert.equal(schoolCurriculumSessionOwnedByState({
    ...base,
    status: 'paused_for_masterclass',
    linkedMasterclassSessionId: 'masterclass-1',
  }), false);
  assert.equal(schoolCurriculumSessionOwnedByState({
    ...base,
    activeSessionId: 'masterclass-1',
    status: 'paused_for_masterclass',
    linkedMasterclassSessionId: 'masterclass-1',
  }), true);
});

const masterclassIdentity = {
  sessionId: 'masterclass-1',
  linkedCurriculumSessionId: 'curriculum-1',
  interruptId: 'interrupt-1',
  levelId: 'level-1',
} as const;

test('completed masterclass still active on its parent resumes through the backend once', () => {
  const lineage = schoolMasterclassLineage(masterclassIdentity, {
    sessionId: 'curriculum-1',
    activeInterrupt: {
      masterclassSessionId: 'masterclass-1',
      interruptId: 'interrupt-1',
      levelId: 'level-1',
    },
    interruptHistory: [],
  });

  assert.equal(lineage, 'active');
  assert.equal(completedMasterclassReturnAction(lineage), 'resume');
});

test('historical completed masterclass routes to its linked parent without resuming twice', () => {
  const lineage = schoolMasterclassLineage(masterclassIdentity, {
    sessionId: 'curriculum-1',
    activeInterrupt: null,
    interruptHistory: [{
      masterclassSessionId: 'masterclass-1',
      interruptId: 'interrupt-1',
      levelId: 'level-1',
    }],
  });

  assert.equal(lineage, 'history');
  assert.equal(completedMasterclassReturnAction(lineage), 'route');
});

test('active masterclass shell back requires confirmation before abandonment', () => {
  assert.equal(schoolMasterclassShellBackAction('active', 'active'), 'confirm_abandon');
});

test('current completed masterclass shell back resumes its active parent interrupt', () => {
  assert.equal(schoolMasterclassShellBackAction('complete', 'active'), 'resume');
});

test('historical completed masterclass shell back routes without repeating resume', () => {
  assert.equal(schoolMasterclassShellBackAction('complete', 'history'), 'route');
});

test('abandoned masterclass shell back routes directly to its linked parent', () => {
  assert.equal(schoolMasterclassShellBackAction('abandoned', 'history'), 'route');
});

test('missing masterclass shell back uses the safe curriculum fallback', () => {
  assert.equal(schoolMasterclassShellBackAction(null, null), 'fallback');
});
