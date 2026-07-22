// Cloud semantic answers are durable before the worker completes. Poll quickly
// enough that a completed result feels immediate, while keeping the loop
// single-flight so an individual learner cannot fan out read requests.
export const CURRICULUM_REVALIDATE_MS = 1_000;

export interface SchoolTutorLoadOwner {
  sessionId: string;
  requestId: number;
}

export type SchoolTutorLoadDecision =
  | { kind: 'start'; owner: SchoolTutorLoadOwner }
  | { kind: 'dedupe'; owner: SchoolTutorLoadOwner };

export function schoolTutorLoadDecision(
  currentOwner: SchoolTutorLoadOwner | null,
  candidate: SchoolTutorLoadOwner,
): SchoolTutorLoadDecision {
  if (currentOwner?.sessionId === candidate.sessionId) {
    return { kind: 'dedupe', owner: currentOwner };
  }
  return { kind: 'start', owner: candidate };
}

export function schoolTutorLoadOwnedBy(
  currentOwner: SchoolTutorLoadOwner | null,
  requestOwner: SchoolTutorLoadOwner,
) {
  return currentOwner?.sessionId === requestOwner.sessionId
    && currentOwner.requestId === requestOwner.requestId;
}

export function releaseSchoolTutorLoad(
  currentOwner: SchoolTutorLoadOwner | null,
  requestOwner: SchoolTutorLoadOwner,
): SchoolTutorLoadOwner | null {
  return schoolTutorLoadOwnedBy(currentOwner, requestOwner) ? null : currentOwner;
}

export function schoolCurriculumSessionOwnedByState(input: {
  activeSessionId: string | null;
  requestedSessionId: string;
  fetchedSessionId: string;
  status: 'active' | 'paused_for_masterclass' | 'complete';
  linkedMasterclassSessionId: string | null;
}) {
  if (input.fetchedSessionId !== input.requestedSessionId) return false;
  if (input.activeSessionId === input.requestedSessionId) return true;
  if (input.activeSessionId === null) return input.status === 'complete';
  return input.status === 'paused_for_masterclass'
    && input.linkedMasterclassSessionId === input.activeSessionId;
}

interface MasterclassIdentity {
  sessionId: string;
  linkedCurriculumSessionId: string;
  interruptId: string;
  levelId: string;
}

interface CurriculumInterruptIdentity {
  masterclassSessionId: string | null;
  interruptId: string;
  levelId: string;
}

export type SchoolMasterclassLineage = 'active' | 'history' | null;

export function schoolMasterclassLineage(
  masterclass: MasterclassIdentity,
  curriculum: {
    sessionId: string;
    activeInterrupt: CurriculumInterruptIdentity | null;
    interruptHistory: CurriculumInterruptIdentity[];
  },
): SchoolMasterclassLineage {
  if (curriculum.sessionId !== masterclass.linkedCurriculumSessionId) return null;
  const exactMatch = (interrupt: CurriculumInterruptIdentity) => (
    interrupt.masterclassSessionId === masterclass.sessionId
    && interrupt.interruptId === masterclass.interruptId
    && interrupt.levelId === masterclass.levelId
  );
  if (curriculum.activeInterrupt && exactMatch(curriculum.activeInterrupt)) return 'active';
  if (curriculum.interruptHistory.some(exactMatch)) return 'history';
  return null;
}

export function completedMasterclassReturnAction(
  lineage: SchoolMasterclassLineage,
): 'resume' | 'route' {
  return lineage === 'active' ? 'resume' : 'route';
}

export function curriculumMasterclassAction(
  nextAction: string | null,
): 'start' | 'resume' | null {
  if (nextAction === 'start_masterclass') return 'start';
  if (nextAction === 'resume_masterclass') return 'resume';
  return null;
}

export function schoolMasterclassShellBackAction(
  status: 'active' | 'complete' | 'abandoned' | null,
  lineage: SchoolMasterclassLineage,
): 'confirm_abandon' | 'resume' | 'route' | 'fallback' {
  if (status === null) return 'fallback';
  if (status === 'active') return 'confirm_abandon';
  if (status === 'complete' && lineage === 'active') return 'resume';
  return 'route';
}

export function resolveSchoolStateAction<Action extends string>(input: {
  nextAction: Action | null;
  allowedNextActions: readonly Action[];
  nextActionUrl: string;
}): { action: Action; href: string } | null {
  if (!input.nextAction || !input.allowedNextActions.includes(input.nextAction)) return null;
  if (!/^\/school(?:[/?#]|$)/.test(input.nextActionUrl)) return null;
  return { action: input.nextAction, href: input.nextActionUrl };
}

function canonicalSchoolDestination(destination: string): string {
  if (/^\/school\/readiness\/report(?:[?#]|$)/.test(destination)) {
    return destination.replace('/school/readiness/report', '/school/placement/report');
  }
  if (/^\/school\/readiness(?:\/[^/?#]+)?(?:[?#]|$)/.test(destination)) {
    const suffix = destination.match(/[?#].*$/)?.[0] ?? '';
    return `/school/placement${suffix}`;
  }
  return destination;
}

export function resolveSchoolStateDestination<Action extends string>(input: {
  nextAction: Action | null;
  allowedNextActions: readonly Action[];
  nextActionUrl: string;
}): string | null {
  const destination = resolveSchoolStateAction(input)?.href;
  if (!destination) return null;

  return canonicalSchoolDestination(destination);
}

export function resolveSchoolMapDestination(input: {
  profileStatus: string;
  unlockState: string;
  subjectId: string | null;
  activeLearningClassNo: number | null;
  targetClassNo: number | null;
}): string | null {
  const classNo = input.activeLearningClassNo ?? input.targetClassNo;
  if (
    input.profileStatus !== 'complete'
    || input.unlockState !== 'target_unlocked'
    || !input.subjectId
    || !Number.isInteger(classNo)
  ) return null;

  return `/school/classes/${classNo}`;
}

/**
 * A chapter map may be browsed freely, but starting a lesson is still owned by
 * the canonical School state. The state action targets the class map rather
 * than a deep chapter URL, so the selected chapter must separately be the
 * backend-marked ready chapter.
 */
export function canStartSchoolChapter(input: {
  action: string | null;
  actionHref: string | null;
  classNo: number;
  chapterStatus: string;
}): boolean {
  return input.action === 'start_curriculum'
    && input.actionHref === `/school/classes/${input.classNo}`
    && input.chapterStatus === 'ready';
}

export function resolveSchoolPassiveStateDestination<Action extends string>(input: {
  status: string;
  nextAction: Action | null;
  allowedNextActions: readonly Action[];
  nextActionUrl: string;
}): string | null {
  if (
    input.status !== 'awaiting_evaluation'
    || input.nextAction !== null
    || input.allowedNextActions.length !== 0
    || !/^\/school(?:[/?#]|$)/.test(input.nextActionUrl)
  ) return null;

  return canonicalSchoolDestination(input.nextActionUrl);
}

export function schoolSubjectLabel(subjectId: string | null): string {
  return subjectId === 'english' ? 'English' : 'School subject';
}

export interface LoadDecisionInput {
  loadFailed: boolean;
  activeFlow: string | null;
  activeSessionId: string | null;
  allowedNextActions: readonly string[];
  placementStatus?: string | null;
}

export type PlacementLoadDecision =
  | { kind: 'load_error'; canStart: false }
  | { kind: 'redirect'; href: '/school/readiness/report'; canStart: false }
  | { kind: 'load_session'; sessionId: string; canStart: false }
  | { kind: 'start'; canStart: true }
  | { kind: 'recover'; canStart: false };

const PLACEMENT_REPORT_STATUSES = new Set([
  'target_ready',
  'below_target',
]);

export function placementLoadDecision(input: LoadDecisionInput): PlacementLoadDecision {
  if (input.loadFailed) return { kind: 'load_error', canStart: false };
  if (
    input.placementStatus === 'abandoned'
    && input.allowedNextActions.includes('start_placement')
  ) {
    return { kind: 'start', canStart: true };
  }
  if (
    input.activeFlow === 'placement_report'
    || input.activeFlow === 'report'
    || (input.placementStatus != null && PLACEMENT_REPORT_STATUSES.has(input.placementStatus))
  ) {
    return { kind: 'redirect', href: '/school/readiness/report', canStart: false };
  }
  if (input.activeFlow === 'placement' && input.activeSessionId) {
    return { kind: 'load_session', sessionId: input.activeSessionId, canStart: false };
  }
  if (input.allowedNextActions.includes('start_placement')) {
    return { kind: 'start', canStart: true };
  }
  return { kind: 'recover', canStart: false };
}

export type RecapLoadDecision =
  | { kind: 'load_error'; canStart: false }
  | { kind: 'load_session'; sessionId: string; canStart: false }
  | { kind: 'start'; canStart: true }
  | { kind: 'recover'; canStart: false };

export function recapLoadDecision(input: LoadDecisionInput): RecapLoadDecision {
  if (input.loadFailed) return { kind: 'load_error', canStart: false };
  if (input.activeFlow === 'recap' && input.activeSessionId) {
    return { kind: 'load_session', sessionId: input.activeSessionId, canStart: false };
  }
  if (input.allowedNextActions.includes('start_recap')) {
    return { kind: 'start', canStart: true };
  }
  return { kind: 'recover', canStart: false };
}

export interface CurriculumViewInput {
  schoolStatus: string | null;
  sessionStatus: string | null;
  phase: string | null;
  activityId: string | null;
  canAnswer: boolean;
}

export type CurriculumActivityView =
  | { kind: 'pending'; canSubmit: false; pollDue: true; pollAfterMs: number }
  | { kind: 'support'; canSubmit: false; pollDue: false; pollAfterMs: null }
  | { kind: 'activity'; canSubmit: boolean; pollDue: false; pollAfterMs: null }
  | { kind: 'complete'; canSubmit: false; pollDue: false; pollAfterMs: null }
  | { kind: 'recover'; canSubmit: false; pollDue: false; pollAfterMs: null };

export function curriculumActivityView(input: CurriculumViewInput): CurriculumActivityView {
  if (input.schoolStatus === 'awaiting_evaluation') {
    return {
      kind: 'pending',
      canSubmit: false,
      pollDue: true,
      pollAfterMs: CURRICULUM_REVALIDATE_MS,
    };
  }
  if (input.phase === 'needs_support' || input.phase === 'capped_support') {
    return { kind: 'support', canSubmit: false, pollDue: false, pollAfterMs: null };
  }
  if (input.activityId) {
    return {
      kind: 'activity',
      canSubmit: input.canAnswer,
      pollDue: false,
      pollAfterMs: null,
    };
  }
  if (input.sessionStatus === 'complete' && input.phase === 'complete') {
    return { kind: 'complete', canSubmit: false, pollDue: false, pollAfterMs: null };
  }
  return { kind: 'recover', canSubmit: false, pollDue: false, pollAfterMs: null };
}

/**
 * A persisted curriculum response is already authoritative for the normal
 * next-activity transition. Avoid serially fetching global School state before
 * showing that next activity. Terminal and branch states still require the
 * canonical state read because they can route outside this session.
 */
export function curriculumAnswerCanContinueWithoutStateRefresh(input: {
  sessionStatus: string;
  activityId: string | null;
  canAnswer: boolean;
}): boolean {
  return input.sessionStatus === 'active'
    && input.activityId !== null
    && input.canAnswer;
}

export interface PendingCurriculumEvaluation {
  activityId: string;
  stableActiveReads: number;
  /** Retained only until this exact activity resolves or becomes retryable. */
  retryAnswer?: string;
}

interface SchoolPendingEvaluationDraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PENDING_CURRICULUM_ANSWER_STORAGE_PREFIX = 'zidd.school.pending-curriculum-answer.v1';

function pendingCurriculumAnswerStorageKey(input: {
  sessionId: string;
  activityId: string;
}) {
  return [
    PENDING_CURRICULUM_ANSWER_STORAGE_PREFIX,
    encodeURIComponent(input.sessionId),
    encodeURIComponent(input.activityId),
  ].join(':');
}

/**
 * Keep a learner's submitted answer through the short durable-evaluator window.
 * The value is session-scoped, never resubmitted automatically, and only becomes
 * visible again when the same authored activity is explicitly retryable.
 */
export function createSchoolPendingEvaluationDraftStore(
  storage: SchoolPendingEvaluationDraftStorage,
) {
  return {
    read(input: { sessionId: string; activityId: string }): string | null {
      try {
        const value = storage.getItem(pendingCurriculumAnswerStorageKey(input));
        return value?.trim() ? value : null;
      } catch {
        return null;
      }
    },
    write(input: { sessionId: string; activityId: string; answer: string }) {
      try {
        storage.setItem(pendingCurriculumAnswerStorageKey(input), input.answer);
      } catch {
        // Storage is best-effort. The durable backend job remains authoritative.
      }
    },
    clear(input: { sessionId: string; activityId: string }) {
      try {
        storage.removeItem(pendingCurriculumAnswerStorageKey(input));
      } catch {
        // A blocked storage area must never interrupt a lesson transition.
      }
    },
  };
}

export type PendingCurriculumEvaluationResolution =
  | { kind: 'pending'; pending: PendingCurriculumEvaluation }
  | { kind: 'resolved' }
  | { kind: 'retry' };

/**
 * Reconcile the state/session split read that follows a queued evaluator answer.
 * The state endpoint can observe the completed job milliseconds before the
 * session endpoint observes its transitioned activity. Keep the learner passive
 * through one such mixed snapshot; a second stable old activity is a failed job
 * and must be deliberately retryable instead of leaving the lesson stuck.
 */
export function reconcilePendingCurriculumEvaluation(input: {
  pending: PendingCurriculumEvaluation;
  schoolStatus: string | null;
  fetchedActivityId: string | null;
  fetchedSessionStatus: string | null;
}): PendingCurriculumEvaluationResolution {
  if (input.schoolStatus === 'awaiting_evaluation') {
    return { kind: 'pending', pending: input.pending };
  }
  if (
    input.fetchedSessionStatus !== 'active'
    || input.fetchedActivityId !== input.pending.activityId
  ) {
    return { kind: 'resolved' };
  }
  const stableActiveReads = input.pending.stableActiveReads + 1;
  if (stableActiveReads < 2) {
    return {
      kind: 'pending',
      pending: { ...input.pending, stableActiveReads },
    };
  }
  return { kind: 'retry' };
}

/**
 * Keep a draft only when an uncertain request never became a committed answer.
 * A confirmed activity transition must never prefill the next learner task.
 */
export function pendingCurriculumAnswerValue(input: {
  pending: PendingCurriculumEvaluation;
  resolution: PendingCurriculumEvaluationResolution;
}): string | null {
  if (input.resolution.kind === 'pending') return null;
  if (input.resolution.kind === 'resolved') return '';
  return input.pending.retryAnswer ?? '';
}

export async function runCurriculumMutation<Session, State>(options: {
  mutate: () => Promise<Session>;
  refreshState: () => Promise<State>;
  commitSession: (session: Session) => void;
  commitSchoolStatus: (state: State) => void;
}): Promise<{
  nextSession: Session;
  refreshFailed: boolean;
  refreshError: unknown | null;
}> {
  const nextSession = await options.mutate();
  options.commitSession(nextSession);
  try {
    const state = await options.refreshState();
    options.commitSchoolStatus(state);
    return { nextSession, refreshFailed: false, refreshError: null };
  } catch (refreshError: unknown) {
    return { nextSession, refreshFailed: true, refreshError };
  }
}

export function startSingleFlightRevalidation<Timer>(options: {
  intervalMs: number;
  revalidate: () => Promise<void>;
  schedule: (callback: () => void, intervalMs: number) => Timer;
  cancelSchedule: (timer: Timer) => void;
}) {
  let cancelled = false;
  let inFlight = false;
  const tick = () => {
    if (cancelled || inFlight) return;
    inFlight = true;
    void options.revalidate()
      .catch(() => undefined)
      .finally(() => {
        inFlight = false;
      });
  };
  const timer = options.schedule(tick, options.intervalMs);
  return {
    cancel() {
      if (cancelled) return;
      cancelled = true;
      options.cancelSchedule(timer);
    },
  };
}

export function authorizedSchoolActions<Action extends string>(input: {
  statusKnown: boolean;
  nextAction: Action | null;
  allowedNextActions: readonly Action[];
}): Action[] {
  if (!input.statusKnown) return [];
  const actionContractValid = input.nextAction === null
    ? input.allowedNextActions.length === 0
    : input.allowedNextActions.includes(input.nextAction);
  return actionContractValid && input.nextAction ? [input.nextAction] : [];
}
