import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const middlewarePath = join(process.cwd(), 'src', 'middleware.ts');
const failures = [];

if (!existsSync(middlewarePath)) {
  failures.push('src/middleware.ts is missing; protected routes must be guarded before React renders.');
} else {
  const source = readFileSync(middlewarePath, 'utf8');
  const protectedRoutes = [
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

  if (!/from ['"]next-auth\/jwt['"]/.test(source) || !/\bgetToken\b/.test(source)) {
    failures.push('middleware must validate the NextAuth JWT with getToken before serving protected pages.');
  }

  for (const route of protectedRoutes) {
    if (!source.includes(`'${route}'`) && !source.includes(`"${route}"`)) {
      failures.push(`middleware does not protect ${route}.`);
    }
  }

  if (!source.includes('/auth/login')) {
    failures.push('middleware must redirect unauthenticated learners to /auth/login.');
  }

  for (const token of [
    'AUTH_COOKIE_BASE_NAMES',
    'clearAuthCookies',
    'auth_cookie_reset',
    "pathname === AUTH_LOGIN_PATH",
  ]) {
    if (!source.includes(token)) {
      failures.push(`middleware must reset stale/corrupt NextAuth cookies instead of 500ing and is missing ${token}.`);
    }
  }

  if (!/try\s*\{[\s\S]*getToken\(\{ req, secret: process\.env\.NEXTAUTH_SECRET \}\)[\s\S]*\}\s*catch\s*\{[\s\S]*auth_cookie_reset/.test(source)) {
    failures.push('middleware must catch getToken failures and clear auth cookies instead of letting protected pages 500.');
  }

  if (!source.includes('BACKEND_INTERNAL_URL') || !source.includes('/me/gate') || !/\bfetch\s*\(/.test(source)) {
    failures.push('middleware must check the lean backend /me/gate profile/onboarding state before serving app routes.');
  }

  if (source.includes('`${backendUrl}/me`') || source.includes('"${backendUrl}/me"')) {
    failures.push('middleware must not fetch full /me; protected-route gating should use /me/gate only.');
  }

  if (!source.includes('/onboarding') || !source.includes('onboarding') || !source.includes('completed')) {
    failures.push('middleware must redirect authenticated but incomplete learners to /onboarding.');
  }

  if (!source.includes('callbackUrl')) {
    failures.push('middleware must preserve the original protected URL in callbackUrl.');
  }

  if (!/export const config\s*=/.test(source) || !source.includes('matcher')) {
    failures.push('middleware must export a matcher for protected route prefixes.');
  }

  if (/\b(localStorage|sessionStorage)\b|zidd_/.test(source)) {
    failures.push('middleware must not use browser storage or zidd_* local state.');
  }
}

if (failures.length) {
  console.error('Auth middleware guard check failed:');
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
