import { getSession, signOut } from 'next-auth/react';

// The backend-issued JWT lives on the NextAuth session (populated from
// account.id_token verification in the jwt callback), not in localStorage.
const ACCESS_TOKEN_CACHE_MS = 60_000;
let cachedAccessToken: { token: string; cacheKey: string; expiresAt: number } | null = null;
let sessionRequest: Promise<string | null> | null = null;

function clearAccessTokenCache() {
  cachedAccessToken = null;
  sessionRequest = null;
}

export function invalidateAuthCache() {
  clearAccessTokenCache();
}

export function authCacheKeyForToken(token: string): string {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `auth:${(hash >>> 0).toString(36)}:${token.length}`;
}

function cacheResolvedAccessToken(token: string | null): string | null {
  if (!token) {
    clearAccessTokenCache();
    return null;
  }
  cachedAccessToken = {
    token,
    cacheKey: authCacheKeyForToken(token),
    expiresAt: Date.now() + ACCESS_TOKEN_CACHE_MS,
  };
  return token;
}

export async function getAccessToken(force = false): Promise<string | null> {
  if (force) clearAccessTokenCache();
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt > now) {
    return cachedAccessToken.token;
  }

  if (!sessionRequest) {
    sessionRequest = getSession()
      .then((session) => session?.accessToken ?? null)
      .finally(() => {
        sessionRequest = null;
      });
  }

  const token = await sessionRequest;
  return cacheResolvedAccessToken(token);
}

export async function getAuthCacheKey(): Promise<string> {
  const token = await getAccessToken();
  return token ? authCacheKeyForToken(token) : 'auth:anonymous';
}

export async function getAuthHeaders(force = false): Promise<Record<string, string>> {
  const token = await getAccessToken(force);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const getHeaders = async (forceAuth = false) => {
  return {
    'Content-Type': 'application/json',
    ...(await getAuthHeaders(forceAuth)),
  };
};

type ApiFetchOptions = RequestInit & { timeoutMs?: number | null };
const DEFAULT_API_TIMEOUT_MS = 20_000;

export async function apiFetch(endpoint: string, options: ApiFetchOptions = {}) {
  const { timeoutMs = DEFAULT_API_TIMEOUT_MS, signal, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = timeoutMs !== null
    ? setTimeout(() => {
        controller.abort(new DOMException('request_timeout', 'TimeoutError'));
      }, timeoutMs)
    : null;
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }

  let response: Response;
  const runFetch = async (forceAuth = false) => fetch(`/api${endpoint}`, {
    ...fetchOptions,
    signal: controller.signal,
    headers: {
      ...(await getHeaders(forceAuth)),
      ...fetchOptions.headers,
    },
  });
  try {
    response = await runFetch(false);
    if (response.status === 401) {
      invalidateAuthCache();
      response = await runFetch(true);
    }
  } catch (err: unknown) {
    const name = err instanceof DOMException || err instanceof Error ? err.name : '';
    if (name === 'AbortError' || name === 'TimeoutError') {
      throw new Error('request_timeout');
    }
    throw err;
  } finally {
    if (timeout !== null) clearTimeout(timeout);
  }

  if (response.status === 401) {
    // Session missing / expired / invalid: let NextAuth clear it and bounce to
    // login from ONE place, instead of every caller rendering a stale-session
    // error. A service has no router, so signOut's own redirect is the
    // portable choice.
    invalidateAuthCache();
    await signOut({ callbackUrl: '/auth/login' });
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const detail = errorData.detail;
    if (detail && typeof detail === 'object' && typeof detail.code === 'string') {
      throw new Error(detail.code);
    }
    throw new Error(typeof detail === 'string' ? detail : `API Error: ${response.status}`);
  }

  return response.json();
}
