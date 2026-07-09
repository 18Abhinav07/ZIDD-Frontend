import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const failures = [];
const root = process.cwd();
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const nextConfig = read('next.config.mjs');
const routePath = 'src/app/api/session/[...path]/route.ts';

if (!nextConfig.includes('session/')) {
  failures.push('next.config.mjs must exclude /api/session/* from the generic backend rewrite.');
}

if (!nextConfig.includes('BACKEND_INTERNAL_URL')) {
  failures.push('next.config.mjs must source the generic /api backend rewrite from BACKEND_INTERNAL_URL.');
}

if (nextConfig.includes("destination: 'http://127.0.0.1:8000/:path'")) {
  failures.push('next.config.mjs must not hardcode the generic backend rewrite to localhost.');
}

if (!existsSync(join(root, routePath))) {
  failures.push(`${routePath} must exist so session calls are proxied by a real route handler.`);
} else {
  const route = read(routePath);
  for (const token of [
    'BACKEND_INTERNAL_URL',
    'upstream.body',
    'export const GET',
    'export const POST',
    'cache: \'no-store\'',
  ]) {
    if (!route.includes(token)) {
      failures.push(`${routePath} is missing ${token}.`);
    }
  }
  for (const token of [
    'SESSION_PROXY_UPSTREAM_TIMEOUT_MS',
    'AbortController',
    'signal: controller.signal',
    'clearTimeout',
  ]) {
    if (!route.includes(token)) {
      failures.push(`${routePath} is missing bounded upstream timeout support: ${token}.`);
    }
  }
  if (!route.includes('bodyHasJsonFields')) {
    failures.push(`${routePath} must inspect POST JSON before retrying idempotent session writes.`);
  }
  if (!route.includes("path[0] === 'turn'")) {
    failures.push(`${routePath} must explicitly limit POST retries to /session/turn.`);
  }
  if (!route.includes("['client_turn_id', 'expected_session_version']")) {
    failures.push(`${routePath} must retry /session/turn only when client_turn_id and expected_session_version are present.`);
  }
  if (!route.includes("path[0] === 'start'")) {
    failures.push(`${routePath} must explicitly limit POST retries to /session/start.`);
  }
  if (!route.includes("['client_start_id']")) {
    failures.push(`${routePath} must retry /session/start only when client_start_id is present.`);
  }
  for (const token of [
    'isSessionStartPaywall',
    'normalizedSessionStartPaywallResponse',
    'upstream.status === 402',
    '{ ok: false, paywall: detail, detail }',
    'status: 200',
  ]) {
    if (!route.includes(token)) {
      failures.push(`${routePath} must normalize handled /session/start paywalls without browser-facing 402 noise: ${token}.`);
    }
  }
  for (const token of [
    'isSessionStartControlConflict',
    'normalizedSessionStartControlResponse',
    'upstream.status === 409',
    'retryable_error',
    'source_transition_starting',
  ]) {
    if (!route.includes(token)) {
      failures.push(`${routePath} must normalize handled /session/start control conflicts without browser-facing 409 noise: ${token}.`);
    }
  }
  if (!route.includes("return false;")) {
    failures.push(`${routePath} must keep non-idempotent session writes single-shot.`);
  }
}

if (failures.length) {
  console.error('Session proxy check failed:');
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
