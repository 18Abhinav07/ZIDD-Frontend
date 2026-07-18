import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(path, 'utf8');

const pages = {
  curriculum: read('src/components/school/tutor/SchoolTutorWorkspace.tsx'),
  placement: read('src/app/school/placement/page.tsx'),
  recap: read('src/app/school/recap/page.tsx'),
  masterclass: read('src/app/school/masterclass/[sessionId]/page.tsx'),
};

test('uncertain School evaluator responses refresh authoritative state before entering passive pending mode', () => {
  for (const [surface, source] of Object.entries(pages)) {
    assert.match(source, /recoverSchoolAnswerState\(\{[\s\S]*?refreshState: \(\) => getSchoolState\(\{ force: true \}\)/, `${surface} must refresh School state after an uncertain answer result`);
    assert.match(source, /recovery\.kind === 'pending'/, `${surface} must only enter passive mode after state confirms it`);
  }

  assert.match(pages.curriculum, /setSchoolStatus\(recovery\.state\.status\)/);
  assert.match(pages.placement, /setAwaitingEvaluation\(true\)/);
  assert.match(pages.recap, /setAwaitingEvaluation\(true\)/);
  assert.match(pages.masterclass, /setSchoolStatus\(recovery\.state\.status\)/);
});

test('pending state disables resubmission and recovers after reload or a passive poll', () => {
  assert.match(pages.curriculum, /activityView\.canSubmit/);
  assert.match(pages.placement, /awaitingEvaluation/);
  assert.match(pages.recap, /canAnswer=\{awaitingEvaluation \? false : activity\.can_answer\}/);
  assert.match(pages.masterclass, /activityView\.canSubmit/);

  for (const [surface, source] of Object.entries(pages)) {
    assert.match(source, /startSingleFlightRevalidation\(/, `${surface} must recover pending work without another answer POST`);
  }
});
