const INTERNAL_ERROR_PATTERN = /^(API Error(?::|$)|HTTP|[a-z]+_[a-z0-9_]+)$/i;

const DEFAULT_ERROR_COPY: Record<string, string> = {
  request_timeout: 'The server took too long to respond. Please try again.',
  open_answer_evaluation_timeout: 'Review is taking longer than expected. Your answer was not submitted, so please try again.',
  open_answer_evaluation_unavailable: 'Writing review is temporarily unavailable. Your answer was not submitted, so please try again.',
  auth_backend_timeout: 'Sign-in took too long. Please try again.',
  Unauthorized: 'Your session expired. Please sign in again.',
};

export function learnerSafeErrorMessage(
  err: unknown,
  fallback: string,
  overrides: Record<string, string> = {},
): string {
  const raw = err instanceof Error ? err.message.trim() : '';
  const copy = { ...DEFAULT_ERROR_COPY, ...overrides };
  if (!raw) return fallback;
  if (copy[raw]) return copy[raw];
  if (/fetch failed|failed to fetch|networkerror|load failed/i.test(raw)) {
    return 'Could not reach the server. Please check the app server and try again.';
  }
  if (INTERNAL_ERROR_PATTERN.test(raw)) return fallback;
  return fallback;
}
