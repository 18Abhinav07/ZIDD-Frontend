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

export function isSchoolEvaluatorPath(path) {
  const normalizedPath = Array.isArray(path) ? path.join('/') : String(path || '');
  return SCHOOL_EVALUATOR_PATHS.some((pattern) => pattern.test(normalizedPath));
}

export function schoolProxyTimeoutMs(path, localQwenMode) {
  if (localQwenMode) return null;
  if (!isSchoolEvaluatorPath(path)) return SCHOOL_PROXY_REQUEST_TIMEOUT_MS;
  return SCHOOL_CLOUD_EVALUATOR_TIMEOUT_MS;
}
