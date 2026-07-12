import assert from 'node:assert/strict';
import test from 'node:test';

import {
  authCookieNamesToClear,
  deletionCookieOptions,
  hasSessionAuthCookie,
} from '../src/lib/authCookiePolicy.mjs';

test('detects base and supported chunked NextAuth session cookies', () => {
  assert.equal(hasSessionAuthCookie(['next-auth.session-token']), true);
  assert.equal(hasSessionAuthCookie(['__Secure-next-auth.session-token']), true);
  assert.equal(hasSessionAuthCookie(['next-auth.session-token.0']), true);
  assert.equal(hasSessionAuthCookie(['__Secure-next-auth.session-token.7']), true);
  assert.equal(hasSessionAuthCookie(['next-auth.session-token.8']), true);
  assert.equal(hasSessionAuthCookie(['__Secure-next-auth.session-token.125']), true);
});

test('does not mistake login flow cookies for a corrupt session', () => {
  assert.equal(hasSessionAuthCookie(['next-auth.callback-url']), false);
  assert.equal(hasSessionAuthCookie(['next-auth.csrf-token']), false);
  assert.equal(hasSessionAuthCookie(['next-auth.pkce.code_verifier']), false);
  assert.equal(hasSessionAuthCookie([]), false);
});

test('rejects malformed chunks and unrelated lookalike cookies', () => {
  assert.equal(hasSessionAuthCookie(['next-auth.session-token.invalid']), false);
  assert.equal(hasSessionAuthCookie(['custom-next-auth.session-token']), false);
});

test('cookie reset covers base auth cookies and every observed chunk index', () => {
  const names = authCookieNamesToClear([
    'next-auth.session-token.12',
    '__Secure-next-auth.session-token.125',
    'unrelated-cookie',
  ]);
  assert.ok(names.includes('next-auth.session-token'));
  assert.ok(names.includes('next-auth.session-token.12'));
  assert.ok(names.includes('__Secure-next-auth.session-token.125'));
  assert.ok(names.includes('__Host-next-auth.csrf-token'));
  assert.equal(names.includes('unrelated-cookie'), false);
  assert.equal(new Set(names).size, names.length);
});

test('secure-prefixed deletion cookies preserve browser-required attributes', () => {
  assert.equal(deletionCookieOptions('__Secure-next-auth.session-token').secure, true);
  assert.equal(deletionCookieOptions('__Host-next-auth.csrf-token').secure, true);
  assert.equal(deletionCookieOptions('next-auth.session-token').secure, false);
  assert.equal(deletionCookieOptions('__Host-next-auth.csrf-token').path, '/');
});
