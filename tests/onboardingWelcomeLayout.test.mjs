import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const page = fs.readFileSync('src/app/onboarding/page.tsx', 'utf8');

test('every onboarding step uses the same split coach and task layout', () => {
  const frameUses = page.match(/<OnboardingStepFrame\b/g) || [];

  assert.equal(frameUses.length, 4);
  assert.match(page, /data-testid="onboarding-step-frame"/);
  assert.match(page, /data-testid="onboarding-guide-panel"/);
  assert.match(page, /data-testid="onboarding-welcome-form"/);
  assert.match(page, /data-testid="onboarding-path-step"/);
  assert.match(page, /data-testid="onboarding-school-details"/);
  assert.match(page, /data-testid="onboarding-career-details"/);
  assert.match(page, /lg:grid-cols-\[minmax\(0,0\.82fr\)_minmax\(0,1\.18fr\)\]/);
  assert.match(page, /<form[\s\S]*?onSubmit=\{handleWelcomeSubmit\}/);
  assert.match(page, /id="display-name"/);
  assert.match(page, /onboarding-welcome-skeleton/);
  assert.doesNotMatch(page, /step === 'welcome' \? "max-w-\[1120px\]" : "max-w-\[760px\]"/);
});

test('guide copy lives below the avatar instead of covering its upper body', () => {
  const imageBeforeCaption = page.match(
    /data-testid="onboarding-guide-image"([\s\S]*?)data-testid="onboarding-guide-caption"/
  );

  assert.ok(imageBeforeCaption, 'guide image should be followed by a separate caption region');
  assert.doesNotMatch(imageBeforeCaption[1], /<(?:h[1-6]|p|span)\b/);
  assert.match(page, /A path built around you\./);
  assert.match(page, /What should I call you\?/);
  assert.doesNotMatch(page, /Start with your name\./);
});

test('random onboarding coaches stay fully inside the image frame', () => {
  const guidePanel = page.match(
    /function OnboardingGuidePanel[\s\S]*?function OnboardingStepFrame/
  );

  assert.ok(guidePanel, 'onboarding guide panel should exist');
  assert.match(guidePanel[0], /object-contain object-center/);
  assert.match(guidePanel[0], /p-4 sm:p-5 lg:p-6/);
  assert.doesNotMatch(guidePanel[0], /getAvatarScaleClass/);
});
