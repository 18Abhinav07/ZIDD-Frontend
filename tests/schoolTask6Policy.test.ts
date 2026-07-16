import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  constrainPlacementReportActionToSession,
  placementEvaluatedClassLabel,
  placementEvidenceLead,
  placementLearningPathDetail,
  recapModuleDisplayLabel,
  resolveSchoolPlacementReportAction,
} from '../src/lib/schoolPlacementReportPolicy.ts';
import {
  createSchoolRouteLoadSingleFlight,
  isSchoolRouteLoadCurrent,
  schoolRouteLoadDisposition,
} from '../src/lib/schoolRouteLoadPolicy.ts';
import { SchoolStateRequestCache } from '../src/lib/schoolStateCachePolicy.ts';

test('state requests dedupe per auth key and generation even when forced', async () => {
  const cache = new SchoolStateRequestCache<{ id: string }>(5_000);
  let resolve!: (value: { id: string }) => void;
  let calls = 0;
  const load = () => {
    calls += 1;
    return new Promise<{ id: string }>((done) => { resolve = done; });
  };

  const first = cache.get({ authKey: 'auth:a', force: true, load, now: 10 });
  const second = cache.get({ authKey: 'auth:a', force: true, load, now: 10 });
  assert.equal(calls, 1);
  resolve({ id: 'shared' });
  assert.deepEqual(await Promise.all([first, second]), [{ id: 'shared' }, { id: 'shared' }]);
});

test('state invalidation prevents a pre-mutation request from filling or satisfying the new generation', async () => {
  const cache = new SchoolStateRequestCache<{ id: string }>(5_000);
  const resolvers: Array<(value: { id: string }) => void> = [];
  let calls = 0;
  const load = () => {
    calls += 1;
    return new Promise<{ id: string }>((resolve) => resolvers.push(resolve));
  };

  const stale = cache.get({ authKey: 'auth:a', force: true, load, now: 10 });
  cache.invalidate();
  const current = cache.get({ authKey: 'auth:a', force: true, load, now: 11 });
  assert.equal(calls, 2);
  resolvers[0]({ id: 'stale' });
  resolvers[1]({ id: 'current' });
  assert.equal((await stale).id, 'stale');
  assert.equal((await current).id, 'current');
  assert.equal((await cache.get({ authKey: 'auth:a', force: false, load, now: 12 })).id, 'current');
  assert.equal(calls, 2);
});

test('state requests never share cache or in-flight work across auth keys', async () => {
  const cache = new SchoolStateRequestCache<{ id: string }>(5_000);
  let calls = 0;
  const load = async (id: string) => {
    calls += 1;
    return { id };
  };
  const [a, b] = await Promise.all([
    cache.get({ authKey: 'auth:a', force: true, load: () => load('a'), now: 10 }),
    cache.get({ authKey: 'auth:b', force: true, load: () => load('b'), now: 10 }),
  ]);
  assert.deepEqual([a.id, b.id], ['a', 'b']);
  assert.equal(calls, 2);
});

const report = { profile_version_id: 'profile-v1', target_class_no: 4 };
const state = {
  profile_status: 'complete',
  profile_version_id: 'profile-v1',
  learner_message: 'Your chapter is waiting.',
  next_action: 'resume_curriculum',
  next_action_url: '/school/session/curriculum-v1',
  allowed_next_actions: ['resume_curriculum'],
};

test('placement report uses a same-version current curriculum action and exact URL', () => {
  assert.deepEqual(resolveSchoolPlacementReportAction(report, state), {
    kind: 'current',
    action: 'resume_curriculum',
    label: 'Continue chapter',
    learnerMessage: 'Your chapter is waiting.',
    url: '/school/session/curriculum-v1',
    effect: 'navigate',
  });
});

test('placement report fails closed when the current state version mismatches or is unavailable', () => {
  assert.equal(resolveSchoolPlacementReportAction(report, null).kind, 'historical_only');
  assert.equal(resolveSchoolPlacementReportAction(report, {
    ...state,
    profile_version_id: 'profile-v2',
  }).kind, 'historical_only');
  assert.equal(resolveSchoolPlacementReportAction(report, {
    ...state,
    allowed_next_actions: [],
  }).kind, 'historical_only');
});

test('placement report maps recap, focused practice, and placement without mutating history', () => {
  assert.deepEqual(resolveSchoolPlacementReportAction(report, {
    ...state,
    next_action: 'start_recap',
    next_action_url: '/school/recap',
    allowed_next_actions: ['start_recap'],
  }), {
    kind: 'current',
    action: 'start_recap',
    label: 'Start foundation path',
    learnerMessage: 'Your chapter is waiting.',
    url: '/school/recap',
    effect: 'start_recap',
  });
  const masterclassAction = resolveSchoolPlacementReportAction(report, {
    ...state,
    next_action: 'resume_masterclass',
    next_action_url: '/school/masterclass/masterclass-v1',
    allowed_next_actions: ['resume_masterclass'],
  });
  assert.equal(masterclassAction.kind, 'current');
  assert.equal(masterclassAction.kind === 'current' ? masterclassAction.label : '', 'Continue focused practice');
  const startMasterclassAction = resolveSchoolPlacementReportAction(report, {
    ...state,
    next_action: 'start_masterclass',
    next_action_url: '/school/session/curriculum-v1',
    allowed_next_actions: ['start_masterclass'],
  });
  assert.equal(startMasterclassAction.kind, 'current');
  assert.equal(
    startMasterclassAction.kind === 'current' ? startMasterclassAction.label : '',
    'Start focused practice',
  );
  const placementAction = resolveSchoolPlacementReportAction(report, {
    ...state,
    next_action: 'resume_placement',
    next_action_url: '/school/placement/placement-v1',
    allowed_next_actions: ['resume_placement'],
  });
  assert.equal(placementAction.kind, 'current');
  assert.equal(placementAction.kind === 'current' ? placementAction.url : '', '/school/placement/placement-v1');
});

test('placement report never promises continuation when the saved session has no next question', () => {
  const action = resolveSchoolPlacementReportAction(report, {
    ...state,
    next_action: 'resume_placement',
    next_action_url: '/school/placement/placement-v1',
    allowed_next_actions: ['resume_placement'],
  });
  const constrained = constrainPlacementReportActionToSession(
    action,
    { placementSessionId: 'placement-v1', profileVersionId: 'profile-v1' },
    {
      session_id: 'placement-v1',
      profile_version_id: 'profile-v1',
      status: 'insufficient_evidence',
      next_item: null,
    },
  );

  assert.deepEqual(constrained, {
    kind: 'current_unavailable',
    action: 'resume_placement',
    label: 'Starting-point check is waiting',
    learnerMessage: 'Your saved answers are safe, but no additional question is available yet. Zidd will not pretend this check can continue.',
  });
});

test('placement report keeps continuation only for the matching active session with a next item', () => {
  const action = resolveSchoolPlacementReportAction(report, {
    ...state,
    next_action: 'resume_placement',
    next_action_url: '/school/placement/placement-v1',
    allowed_next_actions: ['resume_placement'],
  });
  const context = { placementSessionId: 'placement-v1', profileVersionId: 'profile-v1' };
  const constrained = constrainPlacementReportActionToSession(action, context, {
    session_id: 'placement-v1',
    profile_version_id: 'profile-v1',
    status: 'in_progress',
    next_item: { item_id: 'item-v2' },
  });

  assert.deepEqual(constrained, action);
  assert.equal(constrainPlacementReportActionToSession(action, context, null).kind, 'current_unavailable');
  assert.equal(constrainPlacementReportActionToSession(action, context, {
    session_id: 'other-placement',
    profile_version_id: 'profile-v1',
    status: 'in_progress',
    next_item: { item_id: 'item-v2' },
  }).kind, 'current_unavailable');
});

test('locked placement reports do not claim that learning begins in the evaluated class', () => {
  assert.deepEqual(placementLearningPathDetail({
    unlock_state: 'locked',
    active_learning_class_no: 4,
  }), {
    label: 'Learning path',
    value: 'No learning path assigned',
  });
  assert.deepEqual(placementLearningPathDetail({
    unlock_state: 'target_unlocked',
    active_learning_class_no: 5,
  }), {
    label: 'Learning begins in',
    value: 'Class 5',
  });
});

test('placement report never renders a missing evaluated class as bare Class null', () => {
  assert.equal(placementEvaluatedClassLabel({
    placement_status: 'below_target',
    evaluated_class_no: null,
  }), 'Skill-by-skill foundation path');
  assert.equal(placementEvaluatedClassLabel({
    placement_status: 'below_target',
    evaluated_class_no: 4,
  }), 'Class 4');
  assert.equal(placementEvaluatedClassLabel({
    placement_status: 'insufficient_evidence',
    evaluated_class_no: null,
  }), 'Not decided');
});

test('recap module display removes duplicate skill wording without hiding distinct focus', () => {
  assert.equal(recapModuleDisplayLabel({
    title: 'Recap: Infer an unstated reason from evidence',
    focus: 'Infer an unstated reason from evidence',
  }), 'Recap: Infer an unstated reason from evidence');
  assert.equal(recapModuleDisplayLabel({
    title: 'Recap: Reading clues',
    focus: 'Infer an unstated reason from evidence',
  }), 'Recap: Reading clues: Infer an unstated reason from evidence');
});

test('placement report lead evidence is qualitative and status-compatible', () => {
  const blocking = [{
    label: 'Sequence events',
    learner_reason: 'Connect each event to the clue that proves what happened next.',
  }];
  const watchlist = [{ label: 'Character motivation', source_class_no: 4 }];

  assert.deepEqual(placementEvidenceLead({
    placement_status: 'below_target',
    blocking_skills: blocking,
    watchlist_skills: watchlist,
  }), {
    rows: ['Connect each event to the clue that proves what happened next.'],
    emptyMessage: '',
  });
  assert.deepEqual(placementEvidenceLead({
    placement_status: 'target_ready',
    blocking_skills: blocking,
    watchlist_skills: watchlist,
  }), {
    rows: ['Character motivation will be checked again during Class 4 work.'],
    emptyMessage: '',
  });
  assert.deepEqual(placementEvidenceLead({
    placement_status: 'insufficient_evidence',
    blocking_skills: blocking,
    watchlist_skills: watchlist,
  }), {
    rows: [],
    emptyMessage: 'This check did not produce enough reliable evidence to name a strength or a gap. Saved answer counts remain available in report details.',
  });
});

test('route load single-flight shares concurrent work and ownership rejects stale commits', async () => {
  const singleFlight = createSchoolRouteLoadSingleFlight<number>();
  let calls = 0;
  let resolve!: (value: number) => void;
  const first = singleFlight.run(() => {
    calls += 1;
    return new Promise<number>((done) => { resolve = done; });
  });
  const second = singleFlight.run(async () => {
    calls += 1;
    return 2;
  });
  assert.equal(calls, 1);
  resolve(1);
  assert.deepEqual(await Promise.all([first, second]), [1, 1]);
  const currentScope = { authKey: 'auth:a', generation: 0, key: 'auth:a:school-generation:0' };
  const currentOwner = { requestId: 2, scopeKey: currentScope.key };
  assert.equal(isSchoolRouteLoadCurrent(currentOwner, currentOwner, true, currentScope), true);
  assert.equal(isSchoolRouteLoadCurrent(currentOwner, { ...currentOwner, requestId: 1 }, true, currentScope), false);
  assert.equal(isSchoolRouteLoadCurrent(currentOwner, { ...currentOwner, scopeKey: 'auth:b:school-generation:0' }, true, currentScope), false);
  assert.equal(isSchoolRouteLoadCurrent(currentOwner, currentOwner, false, currentScope), false);
});

test('route ownership retries the same request after an auth scope transition', () => {
  const owner = { requestId: 2, scopeKey: 'anonymous:school-generation:0' };
  assert.equal(schoolRouteLoadDisposition(owner, owner, true, {
    authKey: 'user-a',
    generation: 0,
    key: 'user-a:school-generation:0',
  }), 'retry');
  assert.equal(schoolRouteLoadDisposition(owner, owner, true, {
    authKey: 'anonymous',
    generation: 0,
    key: owner.scopeKey,
  }), 'commit');
  assert.equal(schoolRouteLoadDisposition({ ...owner, requestId: 3 }, owner, true, {
    authKey: 'user-a',
    generation: 0,
    key: 'user-a:school-generation:0',
  }), 'ignore');
});

test('generation invalidation before resolution blocks old result and finally commits', async () => {
  const cache = new SchoolStateRequestCache<{ id: string }>(5_000);
  const scopeA = cache.loadScope('auth:a');
  const owner = { requestId: 1, scopeKey: scopeA.key };
  const currentOwner = owner;
  let currentScope = scopeA;
  let resolve!: (value: string) => void;
  const flight = new Promise<string>((done) => { resolve = done; });
  const commits: string[] = [];

  cache.invalidate();
  currentScope = cache.loadScope('auth:a');
  resolve('old-result');
  await flight;
  if (isSchoolRouteLoadCurrent(currentOwner, owner, true, currentScope)) {
    commits.push('result');
  }
  if (isSchoolRouteLoadCurrent(currentOwner, owner, true, currentScope)) {
    commits.push('finally');
  }

  assert.deepEqual(commits, []);
});

test('auth change before rejection blocks old error and finally commits', async () => {
  const cache = new SchoolStateRequestCache<{ id: string }>(5_000);
  const scopeA = cache.loadScope('auth:a');
  const owner = { requestId: 1, scopeKey: scopeA.key };
  const currentOwner = owner;
  let currentScope = scopeA;
  let reject!: (error: Error) => void;
  const flight = new Promise<string>((_resolve, fail) => { reject = fail; });
  const commits: string[] = [];

  currentScope = cache.loadScope('auth:b');
  reject(new Error('old-error'));
  try {
    await flight;
  } catch {
    if (isSchoolRouteLoadCurrent(currentOwner, owner, true, currentScope)) {
      commits.push('error');
    }
  } finally {
    if (isSchoolRouteLoadCurrent(currentOwner, owner, true, currentScope)) {
      commits.push('finally');
    }
  }

  assert.deepEqual(commits, []);
});

test('route flights isolate auth changes and cache generations while deduping one scope', async () => {
  const cache = new SchoolStateRequestCache<{ id: string }>(5_000);
  const scopedCache = cache as SchoolStateRequestCache<{ id: string }> & {
    loadScope(authKey: string): { authKey: string; generation: number; key: string };
  };
  const singleFlight = createSchoolRouteLoadSingleFlight<{ owner: string }>();
  const routeKey = (scope: { key: string }) => `${scope.key}:placement-report`;
  let resolveA!: (value: { owner: string }) => void;
  let calls = 0;

  const scopeA = scopedCache.loadScope('auth:a');
  const callerA = singleFlight.run(() => {
    calls += 1;
    return new Promise<{ owner: string }>((resolve) => { resolveA = resolve; });
  }, routeKey(scopeA));
  const strictModeDuplicate = singleFlight.run(async () => {
    calls += 1;
    return { owner: 'duplicate' };
  }, routeKey(scopeA));
  assert.equal(callerA, strictModeDuplicate);
  assert.equal(calls, 1);

  const scopeB = scopedCache.loadScope('auth:b');
  const callerB = singleFlight.run(async () => {
    calls += 1;
    return { owner: 'B' };
  }, routeKey(scopeB));
  assert.notEqual(callerB, callerA);
  const resultB = await callerB;
  assert.deepEqual(resultB, { owner: 'B' });

  cache.invalidate();
  const scopeC = scopedCache.loadScope('auth:a');
  const callerC = singleFlight.run(async () => {
    calls += 1;
    return { owner: 'C' };
  }, routeKey(scopeC));
  assert.notEqual(scopeC.key, scopeA.key);
  assert.notEqual(callerC, callerA);
  const resultC = await callerC;
  assert.deepEqual(resultC, { owner: 'C' });

  resolveA({ owner: 'A' });
  const resultA = await callerA;
  assert.deepEqual(resultA, { owner: 'A' });
  assert.equal(await strictModeDuplicate, resultA);
  assert.notEqual(resultB, resultA);
  assert.notEqual(resultC, resultA);
  assert.equal(calls, 3);
});

test('every module-global School route flight uses an auth and generation scope', () => {
  const routes = [
    'src/app/school/placement/report/page.tsx',
    'src/app/school/reports/page.tsx',
    'src/app/school/parent/page.tsx',
    'src/app/school/classes/[classNo]/page.tsx',
    'src/app/school/classes/[classNo]/chapters/[chapterId]/page.tsx',
  ];
  for (const route of routes) {
    const source = fs.readFileSync(route, 'utf8');
    assert.match(source, /getSchoolLoadScope/);
    assert.match(source, /schoolRouteLoadKey/);
    assert.match(source, /scopeKey/);
    assert.match(source, /await requestDisposition\(\)/);
    assert.match(source, /disposition === 'retry'/);
  }
});
