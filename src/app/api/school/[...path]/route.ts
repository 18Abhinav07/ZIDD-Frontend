import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL;
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
  const body = method === 'GET' || method === 'HEAD'
    ? undefined
    : await request.arrayBuffer();

  try {
    const upstream = await fetch(backendUrlFor(request, path), {
      method,
      headers: forwardedRequestHeaders(request),
      body,
      cache: 'no-store',
    });
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: forwardedResponseHeaders(upstream),
    });
  } catch {
    return Response.json(
      { detail: { code: 'school_proxy_unavailable' } },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const GET = proxySchool;
export const POST = proxySchool;
