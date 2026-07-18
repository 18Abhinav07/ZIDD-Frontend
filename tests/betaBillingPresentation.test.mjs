import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const read = (relativePath) => {
  const absolutePath = path.join(root, relativePath);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : '';
};

const configPath = path.join(root, 'src/lib/publicConfig.mjs');
const creditsBadge = read('src/components/billing/CreditsBadge.tsx');
const packsModal = read('src/components/billing/PacksModal.tsx');
const paywallModal = read('src/components/billing/PaywallModal.tsx');
const appSessionProvider = read('src/components/shared/AppSessionProvider.tsx');
const profilePage = read('src/app/profile/page.tsx');
const mapPage = read('src/app/(gamified)/map/page.tsx');
const sessionPage = read('src/app/session/[id]/page.tsx');
const envExample = read('.env.example');
const packageJson = read('package.json');

test('beta billing presentation is enabled unless the public flag is exactly 1', async () => {
  assert.equal(
    fs.existsSync(configPath),
    true,
    'src/lib/publicConfig.mjs must expose the beta billing presentation capability',
  );

  const originalValue = process.env.NEXT_PUBLIC_BETA_BILLING_DISABLED;
  const configUrl = pathToFileURL(configPath).href;
  try {
    delete process.env.NEXT_PUBLIC_BETA_BILLING_DISABLED;
    const enabledByDefault = await import(`${configUrl}?case=unset`);
    assert.equal(enabledByDefault.isBetaBillingDisabled(), false);

    process.env.NEXT_PUBLIC_BETA_BILLING_DISABLED = '1';
    const disabledForBeta = await import(`${configUrl}?case=disabled`);
    assert.equal(disabledForBeta.isBetaBillingDisabled(), true);

    process.env.NEXT_PUBLIC_BETA_BILLING_DISABLED = '0';
    const explicitlyEnabled = await import(`${configUrl}?case=enabled`);
    assert.equal(explicitlyEnabled.isBetaBillingDisabled(), false);
  } finally {
    if (originalValue === undefined) {
      delete process.env.NEXT_PUBLIC_BETA_BILLING_DISABLED;
    } else {
      process.env.NEXT_PUBLIC_BETA_BILLING_DISABLED = originalValue;
    }
  }
});

test('all billing presentation entry points use the shared public capability', () => {
  for (const [label, source] of [
    ['credit badge', creditsBadge],
    ['pack purchase modal', packsModal],
    ['paywall modal', paywallModal],
    ['profile wallet', profilePage],
  ]) {
    assert.match(source, /isBetaBillingDisabled/, `${label} must use the shared beta billing flag`);
  }

  assert.match(creditsBadge, /if \(billingDisabled\) return null;/);
  assert.match(packsModal, /if \(billingDisabled \|\| !open\) return;/);
  assert.match(packsModal, /if \(billingDisabled\) return null;/);
  assert.match(paywallModal, /if \(billingDisabled\) return null;/);
  assert.match(profilePage, /\{!billingDisabled && \(/);
  assert.match(appSessionProvider, /if \(!billingDisabled\) \{\s*void loadBalance/);
  assert.match(appSessionProvider, /if \(billingDisabled\) \{\s*const betaBalance/);
  assert.match(envExample, /NEXT_PUBLIC_BETA_BILLING_DISABLED=0/);
  assert.match(packageJson, /NEXT_PUBLIC_BETA_BILLING_DISABLED=1/);
});

test('the flag cannot bypass backend-owned Career session billing', () => {
  for (const [label, source] of [
    ['Career map', mapPage],
    ['Career session', sessionPage],
  ]) {
    assert.match(source, /startSessionWithPaywall/, `${label} must retain the backend session-start contract`);
    assert.doesNotMatch(
      source,
      /isBetaBillingDisabled|NEXT_PUBLIC_BETA_BILLING_DISABLED/,
      `${label} must not turn a presentation flag into client-side entitlement`,
    );
  }

  assert.match(packsModal, /createOrder\(pack\.id\)/);
  assert.match(packsModal, /loadRazorpay\(\)/);
});
