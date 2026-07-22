import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const loginPagePath = 'src/app/auth/login/page.tsx';

test('Google sign-in remains available when passive session hydration is loading', () => {
  const source = fs.readFileSync(loginPagePath, 'utf8');

  assert.match(
    source,
    /const busy = Boolean\(loadingAction\) \|\| routing;/,
    'an unavailable or stale session must not lock the recovery sign-in action',
  );
  assert.doesNotMatch(
    source,
    /const busy = Boolean\(loadingAction\) \|\| routing \|\| status === 'loading';/,
  );
});
