// Billing client. Wraps the 6 verified /billing endpoints via apiFetch, plus a
// dedicated raw fetch for /session/start that can read structured paywall bodies
// (the Next session proxy normalizes handled backend 402s to 200 so the browser
// console does not report a false failed-resource error).
import { apiFetch, getAuthCacheKey, getAuthHeaders } from '@/services/api';
import { invalidateProgressionCache } from '@/services/progression';
import type {
  CreditsBalance,
  PackInfo,
  BillingQuote,
  UnlockInfo,
  OrderResponse,
  PaywallDetail,
  SimulationScenarioConfig,
} from '@/types';

// ── /billing reads + order creation (normal apiFetch path) ──

const BALANCE_CACHE_MS = 15_000;
const SESSION_START_TIMEOUT_MS = 120_000;
const SESSION_START_TIMEOUT_RECOVERY_ATTEMPTS = 3;
const SESSION_START_TIMEOUT_RECOVERY_DELAY_MS = 2_000;
const SESSION_START_TIMEOUT_RECOVERY_REQUEST_MS = 60_000;
let cachedBalance: { authKey: string; value: CreditsBalance; expiresAt: number } | null = null;
let balanceRequest: { authKey: string; promise: Promise<CreditsBalance> } | null = null;

export function invalidateBalanceCache() {
  cachedBalance = null;
  balanceRequest = null;
}

export async function getBalance(options: { force?: boolean } = {}): Promise<CreditsBalance> {
  const authKey = await getAuthCacheKey();
  const now = Date.now();
  if (!options.force && cachedBalance && cachedBalance.authKey === authKey && cachedBalance.expiresAt > now) {
    return Promise.resolve(cachedBalance.value);
  }
  if (!balanceRequest || balanceRequest.authKey !== authKey) {
    const promise = apiFetch('/billing/balance')
      .then((balance: CreditsBalance) => {
        cachedBalance = { authKey, value: balance, expiresAt: Date.now() + BALANCE_CACHE_MS };
        return balance;
      })
      .finally(() => {
        if (balanceRequest?.authKey === authKey) balanceRequest = null;
      });
    balanceRequest = { authKey, promise };
  }
  return balanceRequest.promise;
}

export async function getPacks(): Promise<PackInfo[]> {
  const data: { packs: PackInfo[] } = await apiFetch('/billing/packs');
  return data.packs;
}

export function getQuote(nodeId: string): Promise<BillingQuote> {
  return apiFetch(`/billing/quote?node_id=${encodeURIComponent(nodeId)}`);
}

export async function getUnlocks(): Promise<UnlockInfo[]> {
  const data: { unlocks: UnlockInfo[] } = await apiFetch('/billing/unlocks');
  return data.unlocks;
}

export function createOrder(packId: string): Promise<OrderResponse> {
  return apiFetch('/billing/purchase/order', {
    method: 'POST',
    body: JSON.stringify({ pack_id: packId }),
  });
}

// DEV-ONLY: top up the wallet locally without Razorpay (which needs a public
// webhook to grant credits). The backend route 404s outside non-prod.
export function devGrantCredits(amount = 500): Promise<{ credits: number; granted: number }> {
  invalidateBalanceCache();
  return apiFetch(`/billing/dev/grant?amount=${amount}`, { method: 'POST' }).then((result) => {
    invalidateBalanceCache();
    return result;
  });
}

// Verify a Razorpay Checkout success server-side and grant immediately — so a
// TEST payment funds the wallet on localhost (where the webhook can't reach the
// server) and as a safety net if the webhook is delayed. Idempotent server-side.
export function verifyPayment(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<{ granted: boolean; credits: number }> {
  invalidateBalanceCache();
  return apiFetch('/billing/razorpay/verify', { method: 'POST', body: JSON.stringify(payload) }).then((result) => {
    invalidateBalanceCache();
    return result;
  });
}

// True only on a local dev host, so dev-only affordances never render in prod.
export function isLocalDev(): boolean {
  if (typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

export function canShowDevCreditGrant(): boolean {
  return isLocalDev() && process.env.NEXT_PUBLIC_ENABLE_DEV_CREDITS === '1';
}

// ── /session/start with paywall awareness ──

export interface StartSessionArgs {
  competency_node: string;
  test_mode?: boolean;
  confirm?: boolean;
  reattempt_confirmed?: boolean;
  simulation_config?: SimulationScenarioConfig;
  client_start_id: string;
  source_session_id?: string;
  source_transition_id?: string;
}

// 2xx -> { ok: true, session_id, … } or normalized { ok: false, paywall };
// direct backend HTTP 402 is still accepted for non-proxied/test callers.
// any other non-2xx throws (mirrors apiFetch's surfacing of `detail`).
export type StartSessionResult =
  | {
      ok: true;
      session_id: string;
      node_title: string;
      first_message: string;
      current_mastery: number;
      resumed?: boolean;
    }
  | { ok: false; paywall: PaywallDetail };

const SESSION_START_ERROR_COPY: Record<string, string> = {
  session_start_timeout: 'Starting your session took too long. Please try again.',
  session_proxy_timeout: 'The tutor took too long to respond. Please try again.',
  start_in_progress: 'That session is already starting. Please wait a moment.',
  session_start_in_progress: 'That session is already starting. Please wait a moment.',
  session_already_starting: 'That session is already starting. Please wait a moment.',
  client_start_id_reused_with_different_payload: 'That start request got out of sync. Try again.',
  source_transition_starting: 'That next skill is already starting. Please wait a moment.',
  source_transition_not_replayable: 'That next skill handoff could not be recovered. Go back to your path and try again.',
  session_version_conflict: 'This session changed in another tab. Reload and try again.',
  turn_in_progress: 'Your previous answer is still being processed.',
  awaiting_next_skill: 'Start the next skill before sending another answer.',
  opening_in_progress: 'The next prompt is still loading. Please wait a moment.',
  progression_unavailable: 'We could not read your saved progress from the server. Please retry in a moment.',
  completed_node: 'This level is already completed. Confirm a reattempt to start again.',
  insufficient_credits: 'You need more credits to start this session.',
  payment_required: 'Confirm the credit use to start this session.',
  choose_path: 'Choose a path before starting a session.',
};

const NETWORK_ERROR_COPY = "Couldn't reach the tutor. Check your connection and try again.";
const DEFAULT_SESSION_START_ERROR = 'Something went wrong starting your session. Please try again.';
const INTERNAL_SESSION_ERROR_TEXT_PATTERN =
  /(Backend rejected|Supabase|Postgres|database|schema|SchemaDrift|UndefinedColumn|column .* does not exist|SQL|Traceback|exception|stack trace|JWT|token)/i;

function extractErrorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const maybe = err as { code?: unknown; message?: unknown; error?: unknown };
    for (const value of [maybe.message, maybe.error, maybe.code]) {
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return '';
}

function normalizeErrorCode(value: string): string {
  return value
    .trim()
    .replace(/^API Error:\s*/i, '')
    .replace(/[^a-zA-Z0-9_.:-]+/g, '_')
    .replace(/[-:.]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function looksInternalErrorText(value: string): boolean {
  const text = value.trim();
  if (!text) return true;
  if (INTERNAL_SESSION_ERROR_TEXT_PATTERN.test(text)) return true;
  if (/^(API Error(?::|$)|HTTP|session_|turn_|opening_|progression_|completed_node|[a-z]+_[a-z0-9_]+)$/i.test(text)) {
    return true;
  }
  if (/^[a-z0-9_:-]+$/i.test(text) && /_/.test(text)) return true;
  return false;
}

export function friendlySessionStartErrorMessage(
  err: unknown,
  fallback = DEFAULT_SESSION_START_ERROR
): string {
  const raw = extractErrorText(err);
  const code = normalizeErrorCode(raw);

  if (/Failed to fetch|NetworkError|load failed|AbortError/i.test(raw)) {
    return NETWORK_ERROR_COPY;
  }
  if (SESSION_START_ERROR_COPY[code]) {
    return SESSION_START_ERROR_COPY[code];
  }
  if (raw && !looksInternalErrorText(raw) && raw.length <= 180) {
    return raw;
  }
  return fallback;
}

function errorMessageFromDetail(detail: unknown, fallback: string): string {
  if (detail && typeof detail === 'object') {
    const maybe = detail as { code?: unknown; message?: unknown; error?: unknown };
    const message = typeof maybe.message === 'string' ? maybe.message.trim() : '';
    if (message && !looksInternalErrorText(message)) return message;
    for (const value of [maybe.code, maybe.error, message]) {
      if (typeof value === 'string' && value.trim()) {
        return friendlySessionStartErrorMessage(value, fallback);
      }
    }
  }
  return friendlySessionStartErrorMessage(detail, fallback);
}

class SessionStartError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'SessionStartError';
    this.code = code;
    this.status = status;
  }
}

function startRequestBody(args: StartSessionArgs): string {
  return JSON.stringify({
    competency_node: args.competency_node,
    test_mode: args.test_mode ?? false,
    confirm: args.confirm ?? false,
    reattempt_confirmed: args.reattempt_confirmed ?? false,
    simulation_config: args.simulation_config ?? {},
    client_start_id: args.client_start_id,
    source_session_id: args.source_session_id,
    source_transition_id: args.source_transition_id,
  });
}

async function fetchSessionStart(args: StartSessionArgs, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new DOMException('session_start_timeout', 'TimeoutError'));
  }, timeoutMs);
  try {
    return await fetch('/api/session/start', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(await getAuthHeaders()),
      },
      body: startRequestBody(args),
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readStartSessionResponse(response: Response): Promise<StartSessionResult> {
  if (response.status === 402) {
    const body = await response.json().catch(() => ({}));
    // FastAPI wraps the raised detail under `detail`.
    const detail = body?.detail as PaywallDetail | undefined;
    if (detail && typeof detail === 'object' && 'error' in detail) {
      return { ok: false, paywall: detail };
    }
    // Defensive: a 402 without the expected structured detail.
    throw new SessionStartError(
      friendlySessionStartErrorMessage(body?.detail, 'Confirm the credit use to start this session.'),
      normalizeErrorCode(extractErrorText(body?.detail) || 'payment_required'),
      response.status,
    );
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const rawCode =
      errorData?.detail && typeof errorData.detail === 'object'
        ? (errorData.detail as { code?: unknown; error?: unknown }).code
          ?? (errorData.detail as { code?: unknown; error?: unknown }).error
        : errorData?.detail;
    const code = normalizeErrorCode(extractErrorText(rawCode) || `HTTP_${response.status}`);
    throw new SessionStartError(
      errorMessageFromDetail(errorData.detail, `API Error: ${response.status}`),
      code,
      response.status,
    );
  }

  const data = await response.json();
  if (
    data?.ok === false &&
    data?.paywall &&
    typeof data.paywall === 'object' &&
    'error' in data.paywall
  ) {
    return { ok: false, paywall: data.paywall as PaywallDetail };
  }
  if (
    data?.ok === false &&
    data?.retryable_error &&
    typeof data.retryable_error === 'object'
  ) {
    const detail = data.retryable_error as { code?: unknown; message?: unknown };
    const code = normalizeErrorCode(extractErrorText(detail.code) || 'session_start_in_progress');
    throw new SessionStartError(
      errorMessageFromDetail(detail, DEFAULT_SESSION_START_ERROR),
      code,
      409,
    );
  }
  invalidateBalanceCache();
  invalidateProgressionCache();
  return { ok: true, ...data };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function recoverSessionStartTimeout(args: StartSessionArgs): Promise<StartSessionResult | null> {
  for (let attempt = 0; attempt < SESSION_START_TIMEOUT_RECOVERY_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await delay(SESSION_START_TIMEOUT_RECOVERY_DELAY_MS);
    }
    try {
      const response = await fetchSessionStart(args, SESSION_START_TIMEOUT_RECOVERY_REQUEST_MS);
      return await readStartSessionResponse(response);
    } catch (err) {
      if (
        err instanceof SessionStartError &&
        ['start_in_progress', 'session_start_in_progress', 'source_transition_starting'].includes(err.code)
      ) {
        continue;
      }
      if (err instanceof DOMException || err instanceof Error) {
        const name = err.name;
        if (name === 'AbortError' || name === 'TimeoutError') {
          continue;
        }
      }
      throw err;
    }
  }
  return null;
}

export async function startSessionWithPaywall(
  args: StartSessionArgs
): Promise<StartSessionResult> {
  let response: Response;
  try {
    response = await fetchSessionStart(args, SESSION_START_TIMEOUT_MS);
  } catch (err: unknown) {
    const name = err instanceof DOMException || err instanceof Error ? err.name : '';
    if (name === 'AbortError' || name === 'TimeoutError') {
      const recovered = await recoverSessionStartTimeout(args);
      if (recovered) return recovered;
      throw new Error(friendlySessionStartErrorMessage('session_start_timeout'));
    }
    throw err;
  }

  return readStartSessionResponse(response);
}
