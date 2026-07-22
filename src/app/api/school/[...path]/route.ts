import { NextRequest } from 'next/server';
import { schoolProxyTimeoutMs } from '@/lib/schoolRequestPolicy.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL;
const SCHOOL_QWEN_REQUESTS_UNBOUNDED = process.env.NEXT_PUBLIC_SCHOOL_QWEN_UNBOUNDED === '1';
const REQUEST_HEADER_ALLOWLIST = new Set([
  'accept',
  'authorization',
  'content-type',
  'traceparent',
  'tracestate',
  'x-request-id',
]);
const RESPONSE_HEADER_ALLOWLIST = new Set([
  'content-type',
  'retry-after',
  'traceparent',
  'tracestate',
  'x-request-id',
]);

type RouteContext = {
  params: {
    path?: string[];
  };
};

type UpstreamAbort = {
  signal: AbortSignal;
  abort: (reason?: unknown) => void;
  cleanup: () => void;
};

function createUpstreamAbort(requestSignal: AbortSignal, timeoutMs: number | null): UpstreamAbort {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let listening = false;
  let cleaned = false;

  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    if (listening) requestSignal.removeEventListener('abort', onRequestAbort);
    if (timeout !== null) clearTimeout(timeout);
  }

  function abort(reason?: unknown) {
    if (!controller.signal.aborted) controller.abort(reason);
    cleanup();
  }

  function onRequestAbort() {
    abort(requestSignal.reason ?? new DOMException('browser_request_cancelled', 'AbortError'));
  }

  if (requestSignal.aborted) {
    onRequestAbort();
  } else {
    requestSignal.addEventListener('abort', onRequestAbort, { once: true });
    listening = true;
    if (timeoutMs !== null) {
      timeout = setTimeout(() => {
        abort(new DOMException('school_proxy_timeout', 'TimeoutError'));
      }, timeoutMs);
    }
  }

  return { signal: controller.signal, abort, cleanup };
}

function backendUrlFor(request: NextRequest, path: string[]): string {
  if (!BACKEND_URL) {
    throw new Error('BACKEND_INTERNAL_URL is required for School proxying');
  }
  const requestUrl = new URL(request.url);
  const backend = new URL(`/school/${path.join('/')}`, BACKEND_URL);
  backend.search = requestUrl.search;
  return backend.toString();
}

function forwardedRequestHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  request.headers.forEach((value, name) => {
    const lower = name.toLowerCase();
    if (!REQUEST_HEADER_ALLOWLIST.has(lower)) return;
    headers.set(name, value);
  });
  return headers;
}

function forwardedResponseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  upstream.headers.forEach((value, name) => {
    if (RESPONSE_HEADER_ALLOWLIST.has(name.toLowerCase())) headers.set(name, value);
  });
  headers.set('Cache-Control', 'no-store');
  return headers;
}

async function proxySchool(request: NextRequest, context: RouteContext): Promise<Response> {
  const method = request.method.toUpperCase();
  const path = context.params.path ?? [];
  const timeoutMs = schoolProxyTimeoutMs(path, SCHOOL_QWEN_REQUESTS_UNBOUNDED);
  const upstreamAbort = createUpstreamAbort(request.signal, timeoutMs);

  try {
    const body = method === 'GET' || method === 'HEAD'
      ? undefined
      : await request.arrayBuffer();
    const upstream = await fetch(backendUrlFor(request, path), {
      method,
      headers: forwardedRequestHeaders(request),
      body,
      cache: 'no-store',
      signal: upstreamAbort.signal,
    });
    // School responses are bounded JSON documents. Buffer them before handing
    // them back to Next so a completed FastAPI response cannot remain open in
    // the browser proxy until its deadline expires.
    const responseBody = method === 'HEAD' ? null : await upstream.arrayBuffer();
    upstreamAbort.cleanup();
    return new Response(responseBody, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: forwardedResponseHeaders(upstream),
    });
  } catch {
    upstreamAbort.cleanup();
    return Response.json(
      { detail: { code: 'school_proxy_unavailable' } },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const GET = proxySchool;
export const POST = proxySchool;
