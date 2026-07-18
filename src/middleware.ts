import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import {
  authCookieNamesToClear,
  deletionCookieOptions,
  hasSessionAuthCookie,
} from '@/lib/authCookiePolicy.mjs';

type ProfileGate = {
  user_id?: string;
  onboarding?: {
    completed?: boolean;
    primary_motive?: 'school' | 'career' | null;
  };
  home?: string;
};

const PROFILE_GATE_UNAUTHORIZED = 'profile_gate_unauthorized' as const;
type ProfileGateResult = ProfileGate | null | typeof PROFILE_GATE_UNAUTHORIZED;

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/career',
  '/profile',
  '/onboarding',
  '/map',
  '/mode',
  '/session',
  '/school',
  '/subjects',
  '/simulator',
];

const AUTH_LOGIN_PATH = '/auth/login';
const PROFILE_CHECK_TIMEOUT_MS = 8000;
const PROFILE_GATE_CACHE_MS = 30_000;
const INCOMPLETE_PROFILE_GATE_CACHE_MS = 1500;
const MAX_PROFILE_GATE_CACHE_ENTRIES = 500;
const profileGateCache = new Map<string, { profile: ProfileGate; expiresAt: number }>();

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function redirectToLogin(req: NextRequest, callbackPath: string, reason?: string) {
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/auth/login';
  loginUrl.search = '';
  loginUrl.searchParams.set('callbackUrl', callbackPath);
  if (reason) {
    loginUrl.searchParams.set('reason', reason);
  }
  return NextResponse.redirect(loginUrl);
}

function clearAuthCookies(req: NextRequest, response: NextResponse) {
  const observedCookieNames = req.cookies.getAll().map((cookie) => cookie.name);
  for (const cookieName of authCookieNamesToClear(observedCookieNames)) {
    response.cookies.set(deletionCookieOptions(cookieName));
  }
}

function hasAuthCookie(req: NextRequest): boolean {
  return hasSessionAuthCookie(req.cookies.getAll().map((cookie) => cookie.name));
}

function redirectToLoginAndClearAuth(req: NextRequest, callbackPath: string, reason: string) {
  const response = redirectToLogin(req, callbackPath, reason);
  clearAuthCookies(req, response);
  return response;
}

function redirectToCleanLogin(req: NextRequest, reason: string) {
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = AUTH_LOGIN_PATH;
  loginUrl.search = '';
  loginUrl.searchParams.set('reason', reason);
  const response = NextResponse.redirect(loginUrl);
  clearAuthCookies(req, response);
  return response;
}

function continueDuringProfileGateOutage() {
  const response = NextResponse.next();
  response.headers.set('x-zidd-profile-gate', 'unavailable');
  return response;
}

function homeForProfile(profile: ProfileGate): string {
  if (profile.home) {
    return profile.home;
  }
  return profile.onboarding?.primary_motive === 'school' ? '/school' : '/career';
}

async function hashAccessToken(accessToken: string): Promise<string> {
  const bytes = new TextEncoder().encode(accessToken);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function pruneProfileGateCache(now = Date.now()) {
  for (const [key, value] of Array.from(profileGateCache.entries())) {
    if (value.expiresAt <= now) {
      profileGateCache.delete(key);
    }
  }
  while (profileGateCache.size > MAX_PROFILE_GATE_CACHE_ENTRIES) {
    const oldestKey = profileGateCache.keys().next().value;
    if (!oldestKey) break;
    profileGateCache.delete(oldestKey);
  }
}

async function loadProfileGate(accessToken: string): Promise<ProfileGateResult> {
  const now = Date.now();
  pruneProfileGateCache(now);

  const cacheKey = await hashAccessToken(accessToken);
  const cached = profileGateCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.profile;
  }

  const backendUrl = process.env.BACKEND_INTERNAL_URL;
  if (!backendUrl) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROFILE_CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(`${backendUrl}/me/gate`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (res.status === 401) {
      return PROFILE_GATE_UNAUTHORIZED;
    }
    if (!res.ok) {
      throw new Error(`profile gate failed: ${res.status}`);
    }
    const profile = await res.json();
    const ttl = profile?.onboarding?.completed
      ? PROFILE_GATE_CACHE_MS
      : INCOMPLETE_PROFILE_GATE_CACHE_MS;
    profileGateCache.set(cacheKey, { profile, expiresAt: Date.now() + ttl });
    pruneProfileGateCache();
    return profile;
  } finally {
    clearTimeout(timeout);
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname === AUTH_LOGIN_PATH) {
    let token: Awaited<ReturnType<typeof getToken>> = null;
    try {
      token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    } catch {
      return redirectToCleanLogin(req, 'auth_cookie_reset');
    }
    if (token == null && hasAuthCookie(req)) {
      return redirectToCleanLogin(req, 'auth_cookie_reset');
    }
    return NextResponse.next();
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const callbackPath = `${pathname}${search}`;
  let token: Awaited<ReturnType<typeof getToken>> = null;
  try {
    token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  } catch {
    return redirectToLoginAndClearAuth(req, callbackPath, 'auth_cookie_reset');
  }

  if (token == null && hasAuthCookie(req)) {
    return redirectToLoginAndClearAuth(req, callbackPath, 'auth_cookie_reset');
  }

  if (!token?.accessToken || typeof token.accessToken !== 'string') {
    return hasAuthCookie(req)
      ? redirectToLoginAndClearAuth(req, callbackPath, 'auth_cookie_reset')
      : redirectToLogin(req, callbackPath);
  }

  let profile: ProfileGateResult = null;
  try {
    profile = await loadProfileGate(token.accessToken);
  } catch {
    return continueDuringProfileGateOutage();
  }

  if (profile === PROFILE_GATE_UNAUTHORIZED) {
    return redirectToLoginAndClearAuth(req, callbackPath, 'profile_unauthorized');
  }

  if (!profile) {
    return redirectToLogin(req, callbackPath, 'profile_missing');
  }

  const onboardingComplete = Boolean(profile.onboarding?.completed);
  if (!onboardingComplete && pathname !== '/onboarding') {
    const onboardingUrl = req.nextUrl.clone();
    onboardingUrl.pathname = '/onboarding';
    onboardingUrl.search = '';
    return NextResponse.redirect(onboardingUrl);
  }

  if (onboardingComplete && pathname === '/onboarding') {
    const homeUrl = req.nextUrl.clone();
    homeUrl.pathname = homeForProfile(profile);
    homeUrl.search = '';
    return NextResponse.redirect(homeUrl);
  }

  if (onboardingComplete && pathname === '/dashboard') {
    const homeUrl = req.nextUrl.clone();
    homeUrl.pathname = homeForProfile(profile);
    homeUrl.search = '';
    return NextResponse.redirect(homeUrl);
  }

  if (onboardingComplete && (pathname === '/subjects' || pathname.startsWith('/subjects/'))) {
    const schoolUrl = req.nextUrl.clone();
    schoolUrl.pathname = '/school';
    schoolUrl.search = '';
    return NextResponse.redirect(schoolUrl);
  }

  if (onboardingComplete || pathname === '/onboarding') {
    return NextResponse.next();
  }

  return redirectToLogin(req, callbackPath, 'profile_unknown');
}

export const config = {
  matcher: [
    '/auth/login',
    '/dashboard/:path*',
    '/career/:path*',
    '/profile/:path*',
    '/onboarding/:path*',
    '/map/:path*',
    '/mode/:path*',
    '/session/:path*',
    '/school/:path*',
    '/subjects/:path*',
    '/simulator/:path*',
  ],
};
