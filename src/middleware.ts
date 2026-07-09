import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

type ProfileGate = {
  user_id?: string;
  onboarding?: {
    completed?: boolean;
    primary_motive?: 'school' | 'career' | null;
  };
  home?: string;
};

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/career',
  '/profile',
  '/onboarding',
  '/map',
  '/mode',
  '/session',
  '/subjects',
  '/simulator',
];

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

function homeForProfile(profile: ProfileGate): string {
  if (profile.home) {
    return profile.home;
  }
  return profile.onboarding?.primary_motive === 'school' ? '/subjects' : '/career';
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

async function loadProfileGate(accessToken: string): Promise<ProfileGate | null> {
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
      return null;
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

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const callbackPath = `${pathname}${search}`;

  if (!token?.accessToken || typeof token.accessToken !== 'string') {
    return redirectToLogin(req, callbackPath);
  }

  let profile: ProfileGate | null = null;
  try {
    profile = await loadProfileGate(token.accessToken);
  } catch {
    return redirectToLogin(req, callbackPath, 'profile_check_failed');
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

  if (onboardingComplete || pathname === '/onboarding') {
    return NextResponse.next();
  }

  return redirectToLogin(req, callbackPath, 'profile_unknown');
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/career/:path*',
    '/profile/:path*',
    '/onboarding/:path*',
    '/map/:path*',
    '/mode/:path*',
    '/session/:path*',
    '/subjects/:path*',
    '/simulator/:path*',
  ],
};
