import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const billing = read('src/services/billing.ts');
const mapPage = read('src/app/(gamified)/map/page.tsx');
const subjectsPage = read('src/app/subjects/page.tsx');
const classPage = read('src/app/subjects/class/[classNo]/page.tsx');
const testPage = read('src/app/subjects/test/[testId]/page.tsx');
const careerPage = read('src/app/career/page.tsx');
const profilePage = read('src/app/profile/page.tsx');
const loginPage = read('src/app/auth/login/page.tsx');
const onboardingPage = read('src/app/onboarding/page.tsx');
const creditsBadge = read('src/components/billing/CreditsBadge.tsx');
const paywallModal = read('src/components/billing/PaywallModal.tsx');
const spokenCard = read('src/components/cards/SpokenAnswerCard.tsx');
const fillBlankCard = read('src/components/cards/FillInTheBlankCard.tsx');
const multipleChoiceCard = read('src/components/cards/MultipleChoiceCard.tsx');

const failures = [];

if (!billing.includes('friendlySessionStartErrorMessage')) {
  failures.push('session start errors must be normalized through friendlySessionStartErrorMessage');
}

if (/maybe\.code[\s\S]{0,120}return maybe\.code/.test(billing)) {
  failures.push('billing.ts must not prefer raw backend error codes over learner-safe messages');
}

if (!/API Error\|API Error:/.test(billing) && !/API Error\(\?:/.test(billing)) {
  failures.push('billing.ts must classify API Error status fallbacks as internal copy');
}

for (const token of ['INTERNAL_SESSION_ERROR_TEXT_PATTERN', 'Backend rejected', 'UndefinedColumn', 'Supabase']) {
  if (!billing.includes(token)) {
    failures.push(`billing.ts must classify backend/schema/database exception text as internal copy with ${token}`);
  }
}

if (/return raw && raw\.length < 160\s*\?\s*raw/.test(mapPage)) {
  failures.push('map startErrorMessage must not render arbitrary short raw error text');
}

if (!mapPage.includes('friendlySessionStartErrorMessage')) {
  failures.push('map startErrorMessage must use the shared friendly session-start copy helper');
}

if (!subjectsPage.includes('loadClasses') || !subjectsPage.includes('Retry')) {
  failures.push('subjects page top-level load failure must be retryable.');
}

const classLoadFailureBlock = classPage.match(/error && !detail \? \([\s\S]{0,1000}Retry[\s\S]{0,250}\) : detail/)?.[0] ?? '';
if (!classLoadFailureBlock.includes('Retry') || !classLoadFailureBlock.includes('loadClass')) {
  failures.push('class page top-level load failure must show a retry control that reloads the class.');
}

const testLoadFailureBlock = testPage.match(/error && !test \? \([\s\S]{0,1000}Retry[\s\S]{0,250}\) : result/)?.[0] ?? '';
if (!testPage.includes('loadTest') || !testLoadFailureBlock.includes('Retry') || !testLoadFailureBlock.includes('loadTest')) {
  failures.push('chapter test page top-level load failure must show a retry control that reloads the test.');
}

if (/getServerProgress\(classNo\)[\s\S]{0,260}\.catch\(\(\)\s*=>\s*\{\s*\}\)/.test(classPage)) {
  failures.push('class page must not silently swallow durable /school/progress failures');
}

for (const token of ['progressError', 'Could not load saved progress', 'Progress unavailable', 'Unavailable', 'Retry']) {
  if (!classPage.includes(token)) {
    failures.push(`class page progress failure state must include ${token}`);
  }
}

if (classPage.includes('Showing your last cached view')) {
  failures.push('class page must not claim a cached progress view when product progress is server-owned.');
}

if (!classPage.includes('disabled={starting !== null || progressUnavailable}')) {
  failures.push('class page must disable lesson starts while saved progress is unavailable.');
}

if (/loadActivity\(\)[\s\S]{0,260}\.catch\(\(\)\s*=>\s*\{\s*[^}]*setActivity\(null\);?\s*\}\)/.test(careerPage)) {
  failures.push('career page must not silently swallow /me/activity failures');
}

for (const token of ['activityError', 'Activity summary is temporarily unavailable', 'refreshActivity(true)']) {
  if (!careerPage.includes(token)) {
    failures.push(`career page degraded activity state must include ${token}`);
  }
}

if (/getMeActivity\(\)[\s\S]{0,260}\.catch\(\(\)\s*=>\s*\{\s*[^}]*setActivity\(null\);?\s*\}\)/.test(profilePage)) {
  failures.push('profile page must not silently swallow /me/activity failures');
}

for (const token of ['activityError', 'Tests unavailable', 'Average unavailable', 'Could not switch paths']) {
  if (!profilePage.includes(token)) {
    failures.push(`profile page degraded state must include ${token}`);
  }
}

if (/careerGoals\.slice\(0,\s*8\)/.test(profilePage)) {
  failures.push('profile page must not hide custom GD topics behind a combined first-8 career chip limit.');
}

for (const token of ['targetRoleChips', 'interviewGoalChips', 'gdTopicChips', 'customGdTopicChips']) {
  if (!profilePage.includes(token)) {
    failures.push(`profile page must render career profile groups separately with ${token}`);
  }
}

for (const [label, source] of [
  ['login page', loginPage],
  ['onboarding page', onboardingPage],
]) {
  if (!source.includes('learnerSafeErrorMessage')) {
    failures.push(`${label} must render learner-safe errors through learnerSafeErrorMessage`);
  }
  if (/setError\([^)]*err instanceof Error \? err\.message/.test(source)) {
    failures.push(`${label} must not render raw err.message`);
  }
}

for (const token of ['loadFailed', 'Credit balance unavailable', 'unavailable']) {
  if (!creditsBadge.includes(token)) {
    failures.push(`CreditsBadge must expose a retryable unavailable state with ${token}`);
  }
}

if (!paywallModal.includes('error?: string | null') || !paywallModal.includes('{error &&')) {
  failures.push('PaywallModal must render caller errors inside the modal so confirm timeout/retry failures are visible.');
}

if (!paywallModal.includes('disabled={confirming}')) {
  failures.push('PaywallModal must only disable confirm/cancel while the parent confirm action is actively running.');
}

for (const token of ['slowConfirming', 'Still starting your session', 'not charged twice', 'aria-live="polite"']) {
  if (!paywallModal.includes(token)) {
    failures.push(`PaywallModal must expose bounded long-start feedback with ${token}.`);
  }
}

if (!paywallModal.includes('const handleClose = () =>') || !paywallModal.includes('if (!confirming) onClose();')) {
  failures.push('PaywallModal must not allow backdrop/close dismissal while a confirmed start is in flight.');
}

if (!/const answer\s*=\s*value\.trim\(\)/.test(spokenCard)) {
  failures.push('SpokenAnswerCard must snapshot the trimmed answer before submit');
}

if (!/onSubmit:\s*\(answer:\s*string\)\s*=>\s*Promise<boolean>\s*\|\s*boolean/.test(spokenCard)) {
  failures.push('SpokenAnswerCard onSubmit must return whether stream startup was accepted.');
}

if (!/const accepted = await onSubmit\(answer\)/.test(spokenCard)) {
  failures.push('SpokenAnswerCard must await submit acceptance before clearing its textarea.');
}

if (!/if \(accepted !== false\)[\s\S]{0,80}setValue\(''\)/.test(spokenCard)) {
  failures.push('SpokenAnswerCard must preserve the typed answer when stream startup is rejected.');
}

if (!spokenCard.includes('disabled:cursor-wait') || !spokenCard.includes('disabled:bg-slate-100')) {
  failures.push('SpokenAnswerCard textarea must visibly lock while disabled/submitting');
}

for (const [label, source] of [
  ['FillInTheBlankCard', fillBlankCard],
  ['MultipleChoiceCard', multipleChoiceCard],
]) {
  if (!source.includes('const [submitting, setSubmitting] = useState(false)')) {
    failures.push(`${label} must use a local submitting lock so bridge cards disable immediately after submit.`);
  }
  if (!source.includes('const [submitted, setSubmitted] = useState(false)')) {
    failures.push(`${label} must keep accepted bridge submissions locked until the next prompt arrives.`);
  }
  if (!source.includes('const blocked = disabled || submitting || submitted')) {
    failures.push(`${label} must derive a blocked state from disabled || submitting || submitted.`);
  }
  if (!/const accepted = await onSubmit\(/.test(source)) {
    failures.push(`${label} must await onSubmit before unlocking or clearing local state.`);
  }
  if (!source.includes('setSubmitting(true)') || !source.includes('setSubmitting(false)')) {
    failures.push(`${label} must set and clear local submitting state around submit startup.`);
  }
  if (!source.includes('setSubmitted(true)')) {
    failures.push(`${label} must mark accepted card submissions as submitted.`);
  }
  if (!source.includes('setSubmitted(false)')) {
    failures.push(`${label} must reset submitted state when a new prompt arrives.`);
  }
  if (!source.includes('disabled={blocked')) {
    failures.push(`${label} inputs/options/buttons must use the local blocked state while submit startup is pending.`);
  }
}

if (failures.length) {
  console.error('UX edge hardening checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('UX edge hardening checks passed.');
