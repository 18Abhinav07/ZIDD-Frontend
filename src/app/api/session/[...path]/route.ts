import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL;
const SESSION_PROXY_MAX_ATTEMPTS = 2;
const SESSION_PROXY_UPSTREAM_TIMEOUT_MS = Number(
  process.env.SESSION_PROXY_UPSTREAM_TIMEOUT_MS ?? 300_000
);
const TRANSIENT_UPSTREAM_STATUS = new Set([502, 503, 504]);

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

type RouteContext = {
  params: {
    path?: string[];
  };
};

function backendUrlFor(request: NextRequest, path: string[]): string {
  if (!BACKEND_URL) {
    throw new Error('BACKEND_INTERNAL_URL is required for session proxying');
  }
  const url = new URL(request.url);
  const backend = new URL(`/session/${path.join('/')}`, BACKEND_URL);
  backend.search = url.search;
  return backend.toString();
}

function forwardedRequestHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  request.headers.forEach((value, name) => {
    const lower = name.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) return;
    if (lower === 'host') return;
    headers.set(name, value);
  });
  return headers;
}

function forwardedResponseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  upstream.headers.forEach((value, name) => {
    const lower = name.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) return;
    headers.set(name, value);
  });
  headers.set('Cache-Control', 'no-store');
  return headers;
}

function bodyHasJsonFields(body: ArrayBuffer | undefined, fields: string[]): boolean {
  if (!body) return false;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(body)) as unknown;
    if (!parsed || typeof parsed !== 'object') return false;
    return fields.every((field) => Object.prototype.hasOwnProperty.call(parsed, field));
  } catch {
    return false;
  }
}

function retryableSessionRequest(method: string, path: string[], body: ArrayBuffer | undefined): boolean {
  if (method === 'GET' || method === 'HEAD') return true;
  if (method !== 'POST' || path.length !== 1) return false;
  if (path[0] === 'turn') {
    return bodyHasJsonFields(body, ['client_turn_id', 'expected_session_version']);
  }
  if (path[0] === 'start') {
    return bodyHasJsonFields(body, ['client_start_id']);
  }
  return false;
}

async function fetchUpstream(
  request: NextRequest,
  path: string[],
  method: string,
  body: ArrayBuffer | undefined,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new DOMException('session_proxy_timeout', 'TimeoutError'));
  }, SESSION_PROXY_UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(backendUrlFor(request, path), {
      method,
      headers: forwardedRequestHeaders(request),
      body,
      cache: 'no-store',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function proxyFailureResponse(error: unknown): Response {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  const isTimeout = name === 'AbortError' || name === 'TimeoutError';
  return Response.json(
    { detail: { code: isTimeout ? 'session_proxy_timeout' : 'session_proxy_unavailable' } },
    {
      status: isTimeout ? 504 : 502,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}

function isSessionStartPaywall(method: string, path: string[], upstream: Response): boolean {
  return method === 'POST' && path.length === 1 && path[0] === 'start' && upstream.status === 402;
}

function isSessionStartControlConflict(method: string, path: string[], upstream: Response): boolean {
  return method === 'POST' && path.length === 1 && path[0] === 'start' && upstream.status === 409;
}

async function normalizedSessionStartPaywallResponse(upstream: Response): Promise<Response> {
  const body = await upstream.json().catch((): Record<string, unknown> => ({}));
  const detail = body.detail;
  if (detail && typeof detail === 'object' && 'error' in detail) {
    return Response.json(
      { ok: false, paywall: detail, detail },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return Response.json(
    body,
    {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}

async function normalizedSessionStartControlResponse(upstream: Response): Promise<Response> {
  const body = await upstream.json().catch((): Record<string, unknown> => ({}));
  const detail = body.detail;
  const code = detail && typeof detail === 'object'
    ? (detail as { code?: unknown }).code
    : undefined;
  const handledCodes = new Set([
    'start_in_progress',
    'source_transition_starting',
    'session_start_in_progress',
  ]);
  if (typeof code === 'string' && handledCodes.has(code)) {
    return Response.json(
      { ok: false, retryable_error: detail, detail },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return Response.json(
    body,
    {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}

async function proxySession(request: NextRequest, context: RouteContext): Promise<Response> {
  const method = request.method.toUpperCase();
  const path = context.params.path ?? [];
  const body = method === 'GET' || method === 'HEAD'
    ? undefined
    : await request.arrayBuffer();
  const attempts = retryableSessionRequest(method, path, body) ? SESSION_PROXY_MAX_ATTEMPTS : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const upstream = await fetchUpstream(request, path, method, body);

      if (
        attempt < attempts - 1 &&
        TRANSIENT_UPSTREAM_STATUS.has(upstream.status)
      ) {
        await upstream.body?.cancel();
        continue;
      }

      if (isSessionStartPaywall(method, path, upstream)) {
        return normalizedSessionStartPaywallResponse(upstream);
      }

      if (isSessionStartControlConflict(method, path, upstream)) {
        return normalizedSessionStartControlResponse(upstream);
      }

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: forwardedResponseHeaders(upstream),
      });
    } catch (error) {
      lastError = error;
      if (attempt >= attempts - 1) return proxyFailureResponse(error);
    }
  }

  return proxyFailureResponse(lastError);
}

export const GET = proxySession;
export const POST = proxySession;
