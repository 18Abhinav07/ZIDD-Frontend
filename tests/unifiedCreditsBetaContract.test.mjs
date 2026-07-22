import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(path, 'utf8');

const billing = read('src/services/billing.ts');
const types = read('src/types/index.ts');
const me = read('src/services/me.ts');
const provider = read('src/components/shared/AppSessionProvider.tsx');
const badge = read('src/components/billing/CreditsBadge.tsx');
const paywall = read('src/components/billing/PaywallModal.tsx');
const schoolService = read('src/services/schoolRebuild.ts');
const classPage = read('src/app/school/classes/[classNo]/page.tsx');
const chapterPage = read('src/app/school/classes/[classNo]/chapters/[chapterId]/page.tsx');

test('wallet and /me retain the server-owned unified credit fields', () => {
  for (const source of [types, me]) {
    for (const field of [
      'beta_credits',
      'paid_credits',
      'promo_credits',
      'beta_expires_at',
      'purchases_enabled',
    ]) {
      assert.match(source, new RegExp(`${field}:`), `${field} must remain typed from the backend`);
    }
  }

  assert.match(provider, /void loadBalance\(accountChanged && !firstObservation\)\.catch\(\(\) => null\);/);
  assert.doesNotMatch(provider, /const betaBalance/);
});

test('wallet presentation keeps beta credit visibility while server-disabled purchases stay unavailable', () => {
  assert.match(badge, /balance\?\.purchases_enabled === true/);
  assert.match(badge, /balance\?\.beta_expires_at/);
  assert.match(badge, /purchasesEnabled=\{purchasesEnabled\}/);
  assert.doesNotMatch(badge, /if \(billingDisabled\) return null;/);
  assert.match(paywall, /purchasesEnabled/);
  assert.match(paywall, /billingScopeLabel/);
  assert.doesNotMatch(paywall, /Practice runs are free for your first couple of tries/);
});

test('School curriculum starts preserve server 402 details and leave the current route in place', () => {
  assert.match(billing, /export async function postJsonWithPaywall/);
  assert.match(billing, /apiFetchResponse/);
  assert.match(billing, /case 'attempt':/);
  assert.match(billing, /case 'feature':/);
  assert.match(schoolService, /export type SchoolCurriculumStartResult/);
  assert.match(schoolService, /postJsonWithPaywall<SchoolCurriculumSession>\('\/school\/curriculum\/start'/);
  assert.match(schoolService, /options\.confirm \? \{ confirm: true \} : \{\}/);
  assert.match(billing, /typeof detail\.code === 'string'/);

  for (const source of [classPage, chapterPage]) {
    assert.match(source, /if \(!result\.ok\) \{[\s\S]*?setPaywall\(result\.paywall\);/);
    assert.match(source, /<PaywallModal/);
    assert.match(source, /onConfirm=\{\(\) => .*\(true\)\}/);
    assert.match(source, /purchasesEnabled=\{balance\?\.purchases_enabled\}/);
    assert.match(source, /void loadBalance\(true\)\.catch\(\(\) => null\);/);
  }
});
