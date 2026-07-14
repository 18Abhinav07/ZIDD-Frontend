import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const policyPath = 'src/lib/schoolRequestPolicy.mjs';

test('School request policy grants local unbounded time only to evaluator answer paths', async () => {
  assert.ok(fs.existsSync(policyPath), 'School request policy module must exist');
  const {
    SCHOOL_CLOUD_EVALUATOR_TIMEOUT_MS,
    SCHOOL_PROXY_REQUEST_TIMEOUT_MS,
    isSchoolEvaluatorPath,
    schoolProxyTimeoutMs,
  } = await import(`../${policyPath}`);

  for (const evaluatorPath of [
    ['placement', 'placement-id', 'answer'],
    ['recap', 'recap-id', 'answer'],
    ['curriculum', 'curriculum-id', 'answer'],
    ['masterclass', 'masterclass-id', 'answer'],
  ]) {
    assert.equal(isSchoolEvaluatorPath(evaluatorPath), true);
    assert.equal(schoolProxyTimeoutMs(evaluatorPath, true), null);
    assert.equal(
      schoolProxyTimeoutMs(evaluatorPath, false),
      SCHOOL_CLOUD_EVALUATOR_TIMEOUT_MS,
    );
  }

  for (const ordinaryPath of [
    ['state'],
    ['catalog'],
    ['onboarding'],
    ['placement', 'start'],
    ['placement', 'placement-id', 'abandon'],
    ['curriculum', 'curriculum-id', 'resume-masterclass'],
  ]) {
    assert.equal(isSchoolEvaluatorPath(ordinaryPath), false);
    assert.equal(
      schoolProxyTimeoutMs(ordinaryPath, true),
      SCHOOL_PROXY_REQUEST_TIMEOUT_MS,
    );
  }

  assert.ok(Number.isFinite(SCHOOL_PROXY_REQUEST_TIMEOUT_MS));
  assert.ok(SCHOOL_PROXY_REQUEST_TIMEOUT_MS > 0);
  assert.ok(Number.isFinite(SCHOOL_CLOUD_EVALUATOR_TIMEOUT_MS));
  assert.ok(SCHOOL_CLOUD_EVALUATOR_TIMEOUT_MS > SCHOOL_PROXY_REQUEST_TIMEOUT_MS);
});
