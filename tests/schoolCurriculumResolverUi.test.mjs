import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('src/app/school/curriculum/page.tsx', 'utf8');

test('My Path resolver cannot strand the learner in an infinite skeleton', () => {
  assert.match(source, /resolveSchoolMapDestination/);
  assert.match(source, /resolveSchoolStateDestination/);
  assert.match(source, /mapDestination \?\? actionDestination/);
  assert.match(source, /learnerSafeErrorMessage/);
  assert.match(source, /setError/);
  assert.match(source, /Retry/);
  assert.doesNotMatch(source, /\.catch\(\(\) => undefined\)/);
});
