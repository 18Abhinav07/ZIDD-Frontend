import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const failures = [];
const root = process.cwd();
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const billing = read('src/services/billing.ts');
const mapPage = read('src/app/(gamified)/map/page.tsx');
const classPage = read('src/app/subjects/class/[classNo]/page.tsx');
const sessionPage = read('src/app/session/[id]/page.tsx');

if (!billing.includes('client_start_id: string;')) {
  failures.push('StartSessionArgs.client_start_id must be required so callers own the idempotency boundary.');
}

if (billing.includes('client_start_id: args.client_start_id ?? crypto.randomUUID()')) {
  failures.push('startSessionWithPaywall must not create a fresh client_start_id fallback internally.');
}

for (const token of [
  'recoverSessionStartTimeout',
  'SESSION_START_TIMEOUT_RECOVERY_ATTEMPTS',
  'client_start_id: args.client_start_id',
  'session_start_timeout',
]) {
  if (!billing.includes(token)) {
    failures.push(`billing.ts must recover timed-out /session/start calls idempotently with ${token}.`);
  }
}

for (const [label, source] of [
  ['career map page', mapPage],
  ['school class page', classPage],
  ['next-skill session page', sessionPage],
]) {
  if (!source.includes('client_start_id')) {
    failures.push(`${label} must pass a caller-owned client_start_id to /session/start.`);
  }
}

for (const [label, source] of [
  ['career map page', mapPage],
  ['school class page', classPage],
]) {
  if (!source.includes('useRef') || !source.includes('startId')) {
    failures.push(`${label} must keep start ids in a ref/state across retry/paywall confirm.`);
  }
}

if (!mapPage.includes('clearStartId') || !mapPage.includes('startIntentKey')) {
  failures.push('career map page must clear only the completed/cancelled start intent and key ids by intent.');
}

if (!classPage.includes('clearStartId')) {
  failures.push('school class page must clear the stable start id after success or terminal failure.');
}

if (!sessionPage.includes('pendingNextStartIdRef.current = clientStartId') || /catch \(err\)[\s\S]{0,120}pendingNextStartIdRef\.current = null/.test(sessionPage)) {
  failures.push('next-skill session page must preserve the stable client_start_id after timeout/error so retry can replay the completed paid start.');
}

if (failures.length) {
  console.error('Session start idempotency check failed:');
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
