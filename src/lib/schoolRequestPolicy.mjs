export const SCHOOL_READ_TIMEOUT_MS = 20_000;
export const SCHOOL_CONTROL_TIMEOUT_MS = 30_000;
export const SCHOOL_PROXY_REQUEST_TIMEOUT_MS = 30_000;
export const SCHOOL_CLOUD_EVALUATOR_TIMEOUT_MS = 10_000;

const SCHOOL_EVALUATOR_PATHS = [
  /^placement\/[^/]+\/answer$/,
  /^recap\/[^/]+\/answer$/,
  /^curriculum\/[^/]+\/answer$/,
  /^masterclass\/[^/]+\/answer$/,
];

const SCHOOL_ANSWER_IN_PROGRESS_CODES = new Set([
  'placement_answer_in_progress',
  'recap_answer_in_progress',
  'curriculum_answer_in_progress',
  'masterclass_answer_in_progress',
]);

export function isSchoolEvaluatorPath(path) {
  const normalizedPath = Array.isArray(path) ? path.join('/') : String(path || '');
  return SCHOOL_EVALUATOR_PATHS.some((pattern) => pattern.test(normalizedPath));
}

export function schoolProxyTimeoutMs(path, localQwenMode) {
  if (localQwenMode) return null;
  if (!isSchoolEvaluatorPath(path)) return SCHOOL_PROXY_REQUEST_TIMEOUT_MS;
  return SCHOOL_CLOUD_EVALUATOR_TIMEOUT_MS;
}

export function isUncertainSchoolAnswerError(error) {
  if (!(error instanceof Error)) return false;
  return error.message === 'request_timeout'
    || SCHOOL_ANSWER_IN_PROGRESS_CODES.has(error.message);
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
 *   | { kind: 'advanced'; state: State }
 * >}
 */
export async function recoverSchoolAnswerState({ error, response, refreshState }) {
  if (!isUncertainSchoolAnswerError(error) && !isSchoolEvaluatorPendingResponse(response)) {
    return { kind: 'not_uncertain' };
  }
  const state = await refreshState();
  if (state?.status === 'awaiting_evaluation') return { kind: 'pending', state };
  return { kind: 'advanced', state };
}
