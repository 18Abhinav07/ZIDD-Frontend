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

for (const token of [
  "type StartNodeResult = 'navigated' | 'paywall' | 'ignored'",
  'startInFlightRef = useRef(false)',
  "if (startInFlightRef.current) return 'ignored';",
  'startInFlightRef.current = true;',
  'startInFlightRef.current = false;',
]) {
  if (!mapPage.includes(token)) {
    failures.push(`career map page must guard all /session/start attempts with ${token}.`);
  }
}

if (!/const handleNodeClick = async[\s\S]{0,420}setError\(''\)/.test(mapPage)) {
  failures.push('career map node starts must clear stale PATH ERROR state before a fresh start or paywall.');
}

if (!/const handleConfirmStart = async[\s\S]{0,180}confirming[\s\S]{0,180}startInFlightRef\.current/.test(mapPage)) {
  failures.push('career map paywall confirm must synchronously guard duplicate confirm clicks.');
}

if (!/const handleReattemptConfirm = async[\s\S]{0,180}startInFlightRef\.current/.test(mapPage)) {
  failures.push('career map reattempt confirm must synchronously guard duplicate reattempt starts.');
}

if (!/const handleReattemptConfirm = async[\s\S]{0,420}startNode\(\s*reattemptNode\.node_id,\s*false,\s*true,/.test(mapPage)) {
  failures.push('career map reattempt decision must request an unconfirmed start so metered attempts show their price before charging.');
}

if (!/if \(result\.ok\)[\s\S]{0,420}routeToSession[\s\S]{0,80}return 'navigated'/.test(mapPage)) {
  failures.push('career map startNode must return explicit navigated status only after successful session navigation.');
}

if (!/setPaywall\(result\.paywall\)[\s\S]{0,220}return 'paywall'/.test(mapPage)) {
  failures.push('career map startNode must return explicit paywall status only when a paywall is surfaced.');
}

if (!/setPaywall\(result\.paywall\)[\s\S]{0,220}failedStartRef\.current = null/.test(mapPage)) {
  failures.push('career map must clear stale failed-start retry state when a newer paywall intent is active.');
}

if (!/const handlePaywallClose = \(\) => \{[\s\S]{0,220}failedStartRef\.current = null/.test(mapPage)) {
  failures.push('career map must clear stale failed-start retry state when paywall intent is cancelled.');
}

if (!classPage.includes('clearStartId')) {
  failures.push('school class page must clear the stable start id after success or terminal failure.');
}

if (!sessionPage.includes('startIdRef.current = clientStartId') || /catch \(err\)[\s\S]{0,120}startIdRef\.current = null/.test(sessionPage)) {
  failures.push('next-skill session page must preserve the stable client_start_id after timeout/error so retry can replay the completed paid start.');
}

for (const token of [
  'handleKeepPracticing',
  'reattempt_confirmed: reattemptConfirmed',
  "? 'reattempt'",
  "? 'advance_reattempt'",
  'source_session_id: id',
  'source_transition_id: transitionId',
]) {
  if (!sessionPage.includes(token)) {
    failures.push(`checkpoint Keep Practicing must start a same-skill source-transition reattempt with ${token}.`);
  }
}

if (/Keep Practicing This Skill[\s\S]{0,220}router\.push\('\/map'\)/.test(sessionPage)) {
  failures.push('checkpoint Keep Practicing must not navigate to the map without starting practice.');
}

if (failures.length) {
  console.error('Session start idempotency check failed:');
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
