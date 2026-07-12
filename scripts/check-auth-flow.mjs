import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const failures = [];

const dashboard = readFileSync(join(process.cwd(), 'src/app/dashboard/page.tsx'), 'utf8');
const career = readFileSync(join(process.cwd(), 'src/app/career/page.tsx'), 'utf8');
const api = readFileSync(join(process.cwd(), 'src/services/api.ts'), 'utf8');
const appHeader = readFileSync(join(process.cwd(), 'src/components/shared/AppHeader.tsx'), 'utf8');
const mapPage = readFileSync(join(process.cwd(), 'src/app/(gamified)/map/page.tsx'), 'utf8');
const onboardingService = readFileSync(join(process.cwd(), 'src/services/onboarding.ts'), 'utf8');
const login = readFileSync(join(process.cwd(), 'src/app/auth/login/page.tsx'), 'utf8');
const providers = readFileSync(join(process.cwd(), 'src/app/providers.tsx'), 'utf8');
const appSessionProvider = readFileSync(join(process.cwd(), 'src/components/shared/AppSessionProvider.tsx'), 'utf8');
const middleware = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf8');
const billingService = readFileSync(join(process.cwd(), 'src/services/billing.ts'), 'utf8');
const nextAuthRoute = readFileSync(join(process.cwd(), 'src/app/api/auth/[...nextauth]/route.ts'), 'utf8');
const meService = readFileSync(join(process.cwd(), 'src/services/me.ts'), 'utf8');
const schoolService = readFileSync(join(process.cwd(), 'src/services/school.ts'), 'utf8');
const progressionService = readFileSync(join(process.cwd(), 'src/services/progression.ts'), 'utf8');
const onboardingPage = readFileSync(join(process.cwd(), 'src/app/onboarding/page.tsx'), 'utf8');
const profilePage = readFileSync(join(process.cwd(), 'src/app/profile/page.tsx'), 'utf8');
const nextConfig = readFileSync(join(process.cwd(), 'next.config.mjs'), 'utf8');
const protectedClientPages = [
  'src/app/dashboard/page.tsx',
  'src/app/career/page.tsx',
  'src/app/profile/page.tsx',
  'src/app/onboarding/page.tsx',
  'src/app/subjects/page.tsx',
  'src/app/subjects/class/[classNo]/page.tsx',
  'src/app/subjects/test/[testId]/page.tsx',
  'src/app/(gamified)/mode/page.tsx',
];

if (!dashboard.includes('homeForMe') || dashboard.includes('getMeActivity')) {
  failures.push('dashboard must be a neutral home resolver and must not own activity/dashboard data.');
}

if (career.includes('getMeActivity().then(setActivity)')) {
  failures.push('career page must not load activity in parallel before /me proves onboarding is complete.');
}

const careerMeIndex = career.indexOf('const profile = cachedMe ?? await loadMe()');
const careerActivityIndex = career.indexOf('loadActivity()');
if (careerMeIndex === -1 || careerActivityIndex === -1 || careerActivityIndex < careerMeIndex) {
  failures.push('career page should load /me first, then /me/activity after routing decisions.');
}

if (!career.includes('.catch(() =>') || !career.includes('setActivity(null)')) {
  failures.push('career activity failures should not be treated as auth failures.');
}

const getSessionCalls = api.match(/\bgetSession\s*\(/g) || [];
if (getSessionCalls.length !== 1) {
  failures.push(`api helper should centralize getSession behind one cached call site; found ${getSessionCalls.length}.`);
}

for (const token of ['ACCESS_TOKEN_CACHE_MS', 'cachedAccessToken', 'sessionRequest']) {
  if (!api.includes(token)) {
    failures.push(`api helper is missing ${token} for short-lived token caching.`);
  }
}

for (const token of ['getAccessToken(force = false)', 'getAuthHeaders(force = false)', 'fetchWithOneAuthRetry', 'invalidateAuth: invalidateAuthCache']) {
  if (!api.includes(token)) {
    failures.push(`api helper must retry auth header resolution once before global sign-out; missing ${token}.`);
  }
}

for (const [label, source] of [
  ['NextAuth backend token exchange', nextAuthRoute],
  ['session start with paywall', billingService],
]) {
  for (const token of ['AbortController', 'setTimeout', 'signal: controller.signal', 'clearTimeout']) {
    if (!source.includes(token)) {
      failures.push(`${label} must use a bounded fetch timeout and is missing ${token}.`);
    }
  }
}

if (nextConfig.includes("?? 'http://127.0.0.1:8000'") || nextConfig.includes('?? "http://127.0.0.1:8000"')) {
  failures.push('next.config.mjs must not silently fall back API rewrites to localhost; BACKEND_INTERNAL_URL should be required like auth/session routes.');
}

if (!nextConfig.includes('BACKEND_INTERNAL_URL is required for API rewrites')) {
  failures.push('next.config.mjs should fail fast with a clear BACKEND_INTERNAL_URL error for API rewrites.');
}

if (!api.includes('60_000')) {
  failures.push('api access-token cache should be long enough to cover a normal route transition, not just a few seconds.');
}

if (/const token = await sessionRequest;\s*cachedAccessToken = \{ token, expiresAt: Date\.now\(\) \+ ACCESS_TOKEN_CACHE_MS \};/s.test(api)) {
  failures.push('api helper must not cache a missing/null access token for the full token-cache TTL.');
}

if (!api.includes('cacheResolvedAccessToken') || !api.includes('if (!token)')) {
  failures.push('api helper should cache only non-null access tokens and avoid poisoning auth with a transient null session.');
}

for (const token of ['export function invalidateAuthCache', 'authCacheKeyForToken', 'export async function getAuthCacheKey']) {
  if (!api.includes(token)) {
    failures.push(`api helper is missing ${token} so user-owned caches can be scoped to the active backend JWT.`);
  }
}

for (const token of ['ME_CACHE_MS', 'cachedMe', 'meRequest', 'invalidateMeCache']) {
  if (!meService.includes(token)) {
    failures.push(`me service is missing ${token} to deduplicate /me calls.`);
  }
}

for (const [label, source] of [
  ['me service', meService],
  ['billing service', billingService],
  ['school service', schoolService],
  ['progression service', progressionService],
]) {
  if (!source.includes('getAuthCacheKey')) {
    failures.push(`${label} cache must include getAuthCacheKey so account switching cannot reuse stale user data.`);
  }
}

if (!onboardingService.includes('invalidateMeCache') || !onboardingService.includes('.then((result) =>')) {
  failures.push('onboarding completion must invalidate the shared /me cache before routing to the next page.');
}

if (!meService.includes('myPathForMe')) {
  failures.push('me service should expose a single myPathForMe routing helper for the header My Path action.');
}

if (!meService.includes('pending_module') || !meService.includes('active_module') || !meService.includes('test_mode')) {
  failures.push('myPathForMe should distinguish career users with no module, pending mode selection, and active prep/test paths.');
}

if (!appHeader.includes('myPathForMe') || appHeader.includes('destinationForPreferences')) {
  failures.push('AppHeader My Path should use myPathForMe, not route directly to the raw progression map.');
}

for (const token of ["message === 'Unauthorized'", 'router.push(destination(me))']) {
  if (!appHeader.includes(token)) {
    failures.push(`AppHeader navigation must only redirect to login for real Unauthorized errors and reuse cached profile on transient failures; missing ${token}.`);
  }
}

if (!mapPage.includes('nodes.length === 0') || mapPage.includes('Choose mode')) {
  failures.push('map page should render an explicit empty/error recovery state without looping back to mode selection.');
}

if (!mapPage.includes('getProgressionMap')) {
  failures.push('map page should use the shared progression service so dev StrictMode does not duplicate progress reads.');
}

for (const token of ['progressionRequests', 'progressionCache', 'PROGRESSION_CACHE_MS']) {
  if (!progressionService.includes(token)) {
    failures.push(`progression service is missing ${token} for request dedupe.`);
  }
}

for (const token of ['schoolRequests', 'schoolCache', 'cachedSchoolFetch']) {
  if (!schoolService.includes(token)) {
    failures.push(`school service is missing ${token} for request dedupe.`);
  }
}

for (const token of ['PROFILE_GATE_CACHE_MS', 'profileGateCache', 'INCOMPLETE_PROFILE_GATE_CACHE_MS']) {
  if (!middleware.includes(token)) {
    failures.push(`middleware is missing ${token} to avoid hitting backend /me on every protected navigation.`);
  }
}

if (!middleware.includes('/me/gate')) {
  failures.push('middleware should call the lean /me/gate endpoint, not full /me, for auth/onboarding routing.');
}

if (!middleware.includes('hashAccessToken')) {
  failures.push('middleware should avoid storing raw bearer tokens as cache keys.');
}

if (!middleware.includes('MAX_PROFILE_GATE_CACHE_ENTRIES')) {
  failures.push('middleware profile gate cache must be bounded so a long-running process cannot grow forever.');
}

if (onboardingPage.includes("import { getMe }") || onboardingPage.includes('getMe()')) {
  failures.push('onboarding page must not call both /onboarding/state and /me; state should carry display_name.');
}

for (const rel of protectedClientPages) {
  const source = readFileSync(join(process.cwd(), rel), 'utf8');
  if (source.includes('useSession(') || source.includes("from 'next-auth/react'") && source.includes('useSession')) {
    failures.push(`${rel} should rely on middleware auth instead of making its own /api/auth/session call.`);
  }
}

if (login.includes(".catch(() => router.replace('/onboarding'))")) {
  failures.push('login must not send a stale authenticated cookie to onboarding when /me fails.');
}

if (/if\s*\(status === 'authenticated'\)\s*\{[^}]*router\.replace\(homeForMe\(me\)\)/s.test(login)) {
  failures.push('login must not auto-route an authenticated browser session; show an account card instead.');
}

if (!login.includes('handleExistingAccountContinue')) {
  failures.push('login should let the learner click the existing account card to continue.');
}

if (!login.includes('Continue as')) {
  failures.push('login should show a visible Continue as account card when a session already exists.');
}

if (!login.includes('Choose or add another Google account')) {
  failures.push('login should explain that the Google button can choose or add another account.');
}

if (!login.includes("prompt: 'select_account'")) {
  failures.push('Google account-switch action must force the Google account chooser.');
}

if (!login.includes('useSearchParams') || !login.includes("searchParams.get('error')")) {
  failures.push('login must read NextAuth callback errors from the URL and show learner-safe retry copy.');
}

if (!login.includes('Sign-in could not be completed. Please choose your Google account and try again.')) {
  failures.push('login must show learner-safe copy for NextAuth callback failures.');
}

if (!providers.includes('refetchOnWindowFocus={false}') || !providers.includes('refetchInterval={0}')) {
  failures.push('SessionProvider should not refetch /api/auth/session on focus or intervals.');
}

for (const token of ['AppSessionProvider', 'loadMe', 'loadActivity', 'loadBalance']) {
  if (!appSessionProvider.includes(token)) {
    failures.push(`AppSessionProvider is missing ${token} for shared profile/activity/balance state.`);
  }
}

if (/void loadMe\(accountChanged\);\s*void loadBalance\(accountChanged\);/.test(appSessionProvider)) {
  failures.push('AppSessionProvider background /me and /billing/balance loads must catch transient failures.');
}

if (!appSessionProvider.includes('void loadMe(accountChanged).catch(() => null)')) {
  failures.push('AppSessionProvider must catch background /me load failures.');
}

if (!appSessionProvider.includes('void loadBalance(accountChanged).catch(() => null)')) {
  failures.push('AppSessionProvider must catch background balance load failures.');
}

for (const token of ['authSession?.accessToken', 'observedAccessTokenRef', 'invalidateAuthCache', 'invalidateSchoolCache', 'invalidateProgressionCache']) {
  if (!appSessionProvider.includes(token)) {
    failures.push(`AppSessionProvider must clear account-scoped caches on active-account change and is missing ${token}.`);
  }
}

if (!providers.includes('<AppSessionProvider>')) {
  failures.push('Root providers should wrap the app in AppSessionProvider.');
}

if (!billingService.includes('NEXT_PUBLIC_ENABLE_DEV_CREDITS') || !billingService.includes('canShowDevCreditGrant')) {
  failures.push('Dev credit grant affordance must require an explicit NEXT_PUBLIC_ENABLE_DEV_CREDITS flag, not only localhost.');
}

if (!profilePage.includes('canShowDevCreditGrant()')) {
  failures.push('Profile wallet must call canShowDevCreditGrant() before rendering the dev credit button.');
}

if (failures.length) {
  console.error('Auth flow check failed:');
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
