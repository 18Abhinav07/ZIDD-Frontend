import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (relativePath) => {
  const absolutePath = path.join(root, relativePath);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : '';
};

const creditsBadge = read('src/components/billing/CreditsBadge.tsx');
const packsModal = read('src/components/billing/PacksModal.tsx');
const paywallModal = read('src/components/billing/PaywallModal.tsx');
const appSessionProvider = read('src/components/shared/AppSessionProvider.tsx');
const profilePage = read('src/app/profile/page.tsx');
const mapPage = read('src/app/(gamified)/map/page.tsx');
const sessionPage = read('src/app/session/[id]/page.tsx');

test('wallet presentation is server-owned during beta', () => {
  for (const [label, source] of [
    ['credit badge', creditsBadge],
    ['pack purchase modal', packsModal],
    ['paywall modal', paywallModal],
    ['app session provider', appSessionProvider],
    ['profile wallet', profilePage],
  ]) {
    assert.doesNotMatch(source, /isBetaBillingDisabled|NEXT_PUBLIC_BETA_BILLING_DISABLED/,
      `${label} must defer beta presentation to the backend wallet state`);
  }

  assert.match(creditsBadge, /purchases_enabled === true/);
  assert.match(creditsBadge, /beta_expires_at/);
  assert.match(packsModal, /purchasesEnabled/);
  assert.match(paywallModal, /purchasesEnabled/);
  assert.match(appSessionProvider, /void loadBalance\(accountChanged && !firstObservation\)/);
  assert.match(profilePage, /beta_expires_at/);
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
