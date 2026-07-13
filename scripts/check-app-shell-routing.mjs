import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { careerCompetenceLabel, careerPracticeHref, deriveCareerPathPresentation, mergeCareerMemoryIntoPath } from '../src/lib/careerPathPresentation.mjs';

const failures = [];

const read = (rel) => readFileSync(join(process.cwd(), rel), 'utf8');

const meService = read('src/services/me.ts');
const billingService = read('src/services/billing.ts');
const appHeader = read('src/components/shared/AppHeader.tsx');
const dashboard = read('src/app/dashboard/page.tsx');
const careerPage = read('src/app/career/page.tsx');
const mapPage = read('src/app/(gamified)/map/page.tsx');
const modePage = read('src/app/(gamified)/mode/page.tsx');
const profile = read('src/app/profile/page.tsx');
const pathMap = read('src/components/shared/PathMap.tsx');
const sessionPage = read('src/app/session/[id]/page.tsx');
const sessionHook = read('src/hooks/useZiddSession.ts');
const creditsBadge = read('src/components/billing/CreditsBadge.tsx');
const gd = read('src/app/(professional)/simulator/gd/page.tsx');
const interview = read('src/app/(professional)/simulator/interview/page.tsx');
const middleware = read('src/middleware.ts');
const nextConfig = read('next.config.mjs');

if (!existsSync(join(process.cwd(), 'src/app/career/page.tsx'))) {
  failures.push('career dashboard must live at src/app/career/page.tsx.');
}

for (const forbidden of ['ignoreBuildErrors', 'ignoreDuringBuilds']) {
  if (nextConfig.includes(forbidden)) {
    failures.push(`next.config.mjs must not use ${forbidden}; production builds should run type and lint gates.`);
  }
}

if (!dashboard.includes('homeForMe') || dashboard.includes('Career practice')) {
  failures.push('/dashboard must be a neutral resolver, not the career dashboard UI.');
}

if (!meService.includes("return '/career'")) {
  failures.push('homeForMe should route completed career users to /career.');
}

if (meService.includes('destinationForPreferences')) {
  failures.push('destinationForPreferences should be removed so My Path, dashboard resume, and CTAs share one route helper.');
}

if (meService.includes('placed_modules')) {
  failures.push('placed_modules must not drive frontend routing; backend progress is the source of path readiness.');
}

for (const [name, source] of [
  ['AppHeader', appHeader],
  ['mode page', modePage],
  ['profile page', profile],
  ['map page', mapPage],
]) {
  if (source.includes("router.push('/dashboard')") || source.includes("router.replace('/dashboard')")) {
    failures.push(`${name} should not hard-route protected users to /dashboard.`);
  }
}

if (mapPage.includes('Choose mode') && mapPage.includes('nodes.length === 0')) {
  failures.push('/map empty/error state must not send users back into the mode-selection loop.');
}

if (!mapPage.includes('progression_unavailable')) {
  failures.push('/map should classify progression_unavailable separately from empty path state.');
}

if (modePage.includes('placed_modules')) {
  failures.push('/mode must not write placed_modules when a user chooses prep/test.');
}

if (!gd.includes("router.push('/map')") || !interview.includes("router.push('/map')")) {
  failures.push('simulator close/leave/practice-again should return to /map, not /mode.');
}

if (!careerPage.includes("Continue {activeLabel ?? 'your'} path") || careerPage.includes('Resume {activeLabel')) {
  failures.push('career route-only CTA must say Continue <module> path, not Resume.');
}

for (const token of ['Ready for next skill', 'Practice checkpoint passed', 'Practice this skill again?', 'Practice again']) {
  if (!mapPage.includes(token)) {
    failures.push(`career map reattempt modal must preserve checkpoint semantics with ${token}.`);
  }
}
if (mapPage.includes('>Completed</p>') || mapPage.includes('Your completed progress stays saved.')) {
  failures.push('career map reattempt modal must not describe ready-to-advance nodes as completed.');
}

const freshPath = deriveCareerPathPresentation([
  { status: 'active', attempts: 0, clean_streak: 0, mastery: 0 },
  { status: 'locked', attempts: 0, clean_streak: 0, mastery: 0 },
]);
if (freshPath.hasPathActivity || freshPath.pathFillPercentage !== 0 || freshPath.headline !== 'Your journey begins') {
  failures.push('A newly unlocked zero-attempt path must begin at 0% with journey-begins copy.');
}
const practicedPath = deriveCareerPathPresentation([
  { status: 'ready_to_advance', attempts: 2, clean_streak: 1, mastery: 0.8 },
  { status: 'locked', attempts: 0, clean_streak: 0, mastery: 0 },
]);
if (!practicedPath.hasPathActivity || practicedPath.headline !== 'Your journey continues') {
  failures.push('A path with durable practice evidence must use journey-continues copy.');
}

const personalizedPath = mergeCareerMemoryIntoPath(
  [{ node_id: 'int_02_strength_with_evidence', status: 'ready_to_advance', display_mastery: 0.85 }],
  {
    active_gaps: [{
      skill_id: 'int_02_strength_with_evidence',
      focus_id: 'int_02_strength_with_evidence',
      status: 'active_gap',
      readiness: 0.63,
      gap: 'Add a concrete long-term result.',
    }],
  },
);
if (
  personalizedPath[0].display_status !== 'needs_remediation'
  || personalizedPath[0].display_mastery !== 0.63
  || personalizedPath[0].last_gap !== 'Add a concrete long-term result.'
) {
  failures.push('Career path must project the latest learning-memory gap over stale ready-to-advance presentation.');
}
const improvingPath = mergeCareerMemoryIntoPath(
  [{ node_id: 'int_06_failure_ownership', status: 'ready_to_advance', display_mastery: 0.85 }],
  { improving_gaps: [{ skill_id: 'int_06_failure_ownership', focus_id: 'int_06_failure_ownership', status: 'improving', readiness: 0.8 }] },
);
if (improvingPath[0].display_status !== 'improving') {
  failures.push('Improving memory must not create multiple active You-are-here nodes.');
}
const activeNode = mergeCareerMemoryIntoPath(
  [{ node_id: 'int_01_elevator_pitch', status: 'active', display_mastery: 0.4 }],
  { improving_gaps: [{ skill_id: 'int_01_elevator_pitch', focus_id: 'int_01_elevator_pitch', status: 'improving', readiness: 0.8 }] },
);
if (activeNode[0].display_status !== 'active') {
  failures.push('Memory overlay must preserve the path single active You-are-here node.');
}
const fallbackFocus = mergeCareerMemoryIntoPath(
  [{ node_id: 'int_01_elevator_pitch', status: 'ready_to_advance', last_gap: 'int_01_elevator_pitch' }],
  { active_gaps: [{ skill_id: 'int_00_general_communication', focus_id: 'int_01_elevator_pitch', status: 'active_gap', readiness: 0.4 }] },
);
if (fallbackFocus[0].display_status !== 'needs_remediation' || fallbackFocus[0].last_gap !== '') {
  failures.push('Fallback skills must target their recommended node without leaking stale machine gap IDs.');
}
const unmappedFocus = mergeCareerMemoryIntoPath(
  [{ node_id: 'int_01_elevator_pitch', status: 'ready_to_advance', display_mastery: 0.85 }],
  { active_gaps: [{ skill_id: 'legacy_unmapped_gap', focus_id: '', status: 'active_gap', readiness: 0.2 }] },
);
if ((unmappedFocus[0].display_status ?? unmappedFocus[0].status) !== 'ready_to_advance') {
  failures.push('Unmapped memory must not overwrite an unrelated path node.');
}
if (careerPracticeHref({ focus_id: '' }) !== '/map') {
  failures.push('Unmapped memory must route to the path without a dead focus query.');
}
if (careerPracticeHref({ focus_id: 'int_02_strength_with_evidence' }) !== '/map?focus=int_02_strength_with_evidence') {
  failures.push('Mapped memory must route to its exact practice node.');
}
if (careerCompetenceLabel('active_gap') !== 'Needs focused practice') {
  failures.push('Career surfaces must share one learner-facing competence vocabulary.');
}

if (!pathMap.includes('deriveCareerPathPresentation(nodes)')) {
  failures.push('PathMap must use the shared behavioral path derivation.');
}
if (!sessionPage.includes('teachingStatusFor({')) {
  failures.push('Teaching screen must use the shared behavioral status derivation.');
}

if (
  !creditsBadge.includes('text-[11px] uppercase')
  || !creditsBadge.includes('text-slate-600')
  || !creditsBadge.includes('className="sr-only"')
  || !creditsBadge.includes('open credit packs')
) {
  failures.push('CreditsBadge must expose its visible balance/credits plus the open-packs purpose accessibly.');
}

if (/text-\[(?:9|10)px\][^"\n]*(?:text-slate-400|text-emerald-600)|(?:text-slate-400|text-emerald-600)[^"\n]*text-\[(?:9|10)px\]/.test(profile)) {
  failures.push('profile labels must avoid 9-10px slate-400/emerald-600 contrast failures.');
}

if (!middleware.includes("pathname === '/dashboard'") || !middleware.includes("'/subjects'")) {
  failures.push('middleware should redirect school users away from /dashboard before React renders.');
}

for (const token of ['ME_ACTIVITY_CACHE_MS', 'activityRequest', 'invalidateMeActivityCache']) {
  if (!meService.includes(token)) {
    failures.push(`me service is missing ${token} for /me/activity caching.`);
  }
}
if (
  !sessionHook.includes('invalidateMeLearningGraphCache')
  || !sessionHook.includes('function invalidateCareerEvidenceCaches')
  || (sessionHook.match(/invalidateCareerEvidenceCaches\(\)/g) ?? []).length < 7
  || !sessionHook.includes("data.status === 'completed' && !data.report")
) {
  failures.push('Normal, recovered, prep, and scored completions must invalidate cached career growth evidence.');
}

for (const token of ['BALANCE_CACHE_MS', 'balanceRequest', 'invalidateBalanceCache']) {
  if (!billingService.includes(token)) {
    failures.push(`billing service is missing ${token} for /billing/balance caching.`);
  }
}

if (failures.length) {
  console.error('App shell routing check failed:');
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
