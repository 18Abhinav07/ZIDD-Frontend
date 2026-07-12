import assert from 'node:assert/strict';

const baseUrl = process.env.CAREER_BASE_URL || 'http://127.0.0.1:3000';

async function request(path, cookie) {
  return fetch(`${baseUrl}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: 'manual',
  });
}

const corrupt = await request('/career', 'next-auth.session-token=corrupt-token');
assert.equal(corrupt.status, 307);
assert.match(corrupt.headers.get('location') || '', /reason=auth_cookie_reset/);
assert.match(corrupt.headers.get('set-cookie') || '', /next-auth\.session-token=.*Expires=/i);

const secureChunk = await request('/career', '__Secure-next-auth.session-token.12=corrupt-token');
assert.equal(secureChunk.status, 307);
assert.match(secureChunk.headers.get('location') || '', /reason=auth_cookie_reset/);
assert.match(
  secureChunk.headers.get('set-cookie') || '',
  /__Secure-next-auth\.session-token\.12=.*Secure/i,
);

const callbackOnly = await request(
  '/auth/login',
  'next-auth.callback-url=http%3A%2F%2Flocalhost%3A3000%2Fcareer',
);
assert.equal(callbackOnly.status, 200);

console.log('Live auth middleware checks passed.');
