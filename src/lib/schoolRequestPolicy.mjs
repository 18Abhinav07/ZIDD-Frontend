// A read can hydrate the authoritative learning state after a completed
// chapter. Keep its browser deadline aligned with the proxy so the browser
// does not abort a request that the proxy is still allowed to complete.
export const SCHOOL_READ_TIMEOUT_MS = 30_000;
export const SCHOOL_CONTROL_TIMEOUT_MS = 30_000;
export const SCHOOL_PROXY_REQUEST_TIMEOUT_MS = 30_000;

const SCHOOL_ANSWER_IN_PROGRESS_CODES = new Set([
  'placement_answer_in_progress',
  'recap_answer_in_progress',
  'curriculum_answer_in_progress',
  'masterclass_answer_in_progress',
]);

const SCHOOL_CURRICULUM_START_RECOVERY_CODES = new Set([
  'request_timeout',
  'curriculum_start_in_progress',
]);
const DEFAULT_CURRICULUM_START_RECOVERY_ATTEMPTS = 4;
const DEFAULT_CURRICULUM_START_RECOVERY_DELAY_MS = 750;

export function schoolProxyTimeoutMs(path, localQwenMode) {
  void path;
  if (localQwenMode) return null;
  // Browser answer requests either enqueue cloud evaluation or commit a
  // deterministic transaction. They are control commands, not model calls.
  return SCHOOL_PROXY_REQUEST_TIMEOUT_MS;
}

export function isUncertainSchoolAnswerError(error) {
  if (!(error instanceof Error)) return false;
  return error.message === 'request_timeout'
    || SCHOOL_ANSWER_IN_PROGRESS_CODES.has(error.message);
}

export function isUncertainSchoolCurriculumStartError(error) {
  return error instanceof Error
    && SCHOOL_CURRICULUM_START_RECOVERY_CODES.has(error.message);
}

/**
 * Starting a chapter is a durable, idempotent server command. A browser may
 * lose the first response after the server has accepted it, so retry only the
 * same start request and only for the two known uncertain outcomes. This never
 * creates a new client start id or treats a failed start as successful.
 */
export async function recoverSchoolCurriculumStart({
  error,
  retryStart,
  attempts = DEFAULT_CURRICULUM_START_RECOVERY_ATTEMPTS,
  delayMs = DEFAULT_CURRICULUM_START_RECOVERY_DELAY_MS,
  wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
}) {
  if (!isUncertainSchoolCurriculumStartError(error)) {
    return { kind: 'not_uncertain' };
  }

  const retryAttempts = Number.isInteger(attempts) && attempts > 0
    ? attempts
    : DEFAULT_CURRICULUM_START_RECOVERY_ATTEMPTS;
  let latestError = error;

  for (let attempt = 0; attempt < retryAttempts; attempt += 1) {
    await wait(delayMs);
    try {
      return { kind: 'recovered', result: await retryStart() };
    } catch (retryError) {
      if (!isUncertainSchoolCurriculumStartError(retryError)) throw retryError;
      latestError = retryError;
    }
  }

  return { kind: 'pending', error: latestError };
}

/**
 * A queued answer is durable before the browser sees its next state. If the
 * first revalidation lands during a short proxy or database outage, keep the
 * screen passive and retry the read instead of telling a learner to submit the
 * same answer again.
 */
export function isTransientSchoolStateRefreshError(error) {
  if (!(error instanceof Error)) return false;
  const message = error.message.trim();
  return message === 'request_timeout'
    || /^API Error: 5\d{2}$/.test(message)
    || /fetch failed|failed to fetch|networkerror|load failed/i.test(message);
}

export function isSchoolEvaluatorPendingResponse(response) {
  return Boolean(
    response
    && typeof response === 'object'
    && response.status === 'awaiting_evaluation'
    && typeof response.session_id === 'string'
    && typeof response.activity_id === 'string'
    && typeof response.state_url === 'string',
  );
}

/**
 * @template State
 * @param {{
 *   error?: unknown;
 *   response?: unknown;
 *   refreshState: () => Promise<State>;
 * }} options
 * @returns {Promise<
 *   | { kind: 'not_uncertain' }
 *   | { kind: 'pending'; state: State }
 *   | { kind: 'pending_unconfirmed' }
 *   | { kind: 'advanced'; state: State }
 * >}
 */
export async function recoverSchoolAnswerState({ error, response, refreshState }) {
  if (!isUncertainSchoolAnswerError(error) && !isSchoolEvaluatorPendingResponse(response)) {
    return { kind: 'not_uncertain' };
  }
  let state;
  try {
    state = await refreshState();
  } catch (refreshError) {
    if (isTransientSchoolStateRefreshError(refreshError)) {
      return { kind: 'pending_unconfirmed' };
    }
    throw refreshError;
  }
  if (!state || typeof state !== 'object' || typeof state.status !== 'string') {
    throw new Error('school_state_unresolved');
  }
  if (state?.status === 'awaiting_evaluation') return { kind: 'pending', state };
  return { kind: 'advanced', state };
}
