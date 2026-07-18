import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const proxy = fs.readFileSync('src/app/api/school/[...path]/route.ts', 'utf8');
const client = fs.readFileSync('src/services/schoolRebuild.ts', 'utf8');

test('Gemini local development keeps School requests bounded and Qwen opt-in is explicit', () => {
  const geminiScript = packageJson.scripts['dev:school-prep'];
  const qwenScript = packageJson.scripts['dev:school-prep:qwen'];

  assert.equal(typeof geminiScript, 'string');
  assert.equal(typeof qwenScript, 'string');
  assert.doesNotMatch(geminiScript, /NEXT_PUBLIC_SCHOOL_QWEN_UNBOUNDED=1/);
  assert.match(qwenScript, /NEXT_PUBLIC_SCHOOL_QWEN_UNBOUNDED=1/);
  assert.match(geminiScript, /NEXT_PUBLIC_BETA_BILLING_DISABLED=1/);
  assert.match(qwenScript, /NEXT_PUBLIC_BETA_BILLING_DISABLED=1/);

  for (const source of [proxy, client]) {
    assert.match(source, /NEXT_PUBLIC_SCHOOL_QWEN_UNBOUNDED/);
    assert.doesNotMatch(source, /NEXT_PUBLIC_SCHOOL_LOCAL_MODE/);
  }
});
