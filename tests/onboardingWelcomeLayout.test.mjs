import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const page = fs.readFileSync('src/app/onboarding/page.tsx', 'utf8');

test('welcome onboarding uses a dedicated coach panel and separate name task form', () => {
  assert.match(page, /data-testid="onboarding-welcome-layout"/);
  assert.match(page, /data-testid="onboarding-welcome-guide"/);
  assert.match(page, /data-testid="onboarding-welcome-form"/);
  assert.match(page, /lg:grid-cols-\[minmax\(0,0\.82fr\)_minmax\(0,1\.18fr\)\]/);
  assert.match(page, /<form[\s\S]*?onSubmit=\{handleWelcomeSubmit\}/);
  assert.match(page, /id="display-name"/);
  assert.match(page, /onboarding-welcome-skeleton/);
});

test('welcome copy gives each panel a distinct job instead of restating the name prompt', () => {
  assert.match(page, /A path built around you\./);
  assert.match(page, /What should I call you\?/);
  assert.doesNotMatch(page, /Start with your name\./);
});
