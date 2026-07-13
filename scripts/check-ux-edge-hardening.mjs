import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const billing = read('src/services/billing.ts');
const mapPage = read('src/app/(gamified)/map/page.tsx');
const careerPage = read('src/app/career/page.tsx');
const profilePage = read('src/app/profile/page.tsx');
const meService = read('src/services/me.ts');
const loginPage = read('src/app/auth/login/page.tsx');
const onboardingPage = read('src/app/onboarding/page.tsx');
const creditsBadge = read('src/components/billing/CreditsBadge.tsx');
const paywallModal = read('src/components/billing/PaywallModal.tsx');
const reportModal = read('src/components/shared/SimulationReportModal.tsx');
const sessionRecap = read('src/components/shared/SessionRecap.tsx');
const pathMap = read('src/components/shared/PathMap.tsx');
const scenarioPicker = read('src/components/shared/ScenarioPicker.tsx');
const sessionPage = read('src/app/session/[id]/page.tsx');
const tutorShell = read('src/components/tutor/TutorShell.tsx');
const spokenCard = read('src/components/cards/SpokenAnswerCard.tsx');
const fillBlankCard = read('src/components/cards/FillInTheBlankCard.tsx');
const multipleChoiceCard = read('src/components/cards/MultipleChoiceCard.tsx');
const types = read('src/types/index.ts');

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

if (!meService.includes('memory_context')) {
  failures.push('me service must type /me/learning-graph memory_context so the profile can render canonical career growth buckets.');
}

for (const token of ['getMeLearningGraph', 'learningGraph', 'Career growth', 'Active gaps', 'Improving', 'Resolved', 'Mastered', 'latest_evidence', 'repeat_count', 'Practice this', 'onPracticeCareerGap']) {
  if (!profilePage.includes(token)) {
    failures.push(`profile page must render canonical career growth graph from /me/learning-graph with ${token}`);
  }
}

for (const token of ['getMeLearningGraph', 'careerLearningGraph', 'memory_context', 'Career focus', 'active_gaps', 'improving_gaps', 'latest_evidence', 'repeat_count', 'Practice this gap', 'onPracticeCareerFocus']) {
  if (!careerPage.includes(token)) {
    failures.push(`career home must surface canonical career learning focus from /me/learning-graph with ${token}`);
  }
}

if (!/getMeLearningGraph\(\)[\s\S]{0,320}setCareerLearningGraph\(nextGraph\)/.test(careerPage)) {
  failures.push('career home must populate careerLearningGraph from getMeLearningGraph(), not from unrelated source tokens.');
}

if (!/const careerMemory = careerLearningGraph\?\.memory_context;[\s\S]{0,220}careerMemory\?\.active_gaps\?\.\[0\][\s\S]{0,120}careerMemory\?\.improving_gaps\?\.\[0\]/.test(careerPage)) {
  failures.push('career home focus must derive from memory_context.active_gaps before improving_gaps.');
}

if (!careerPage.includes('{(careerFocus || careerLearningGraphError) && (')) {
  failures.push('career home must render the focus panel when a focus item exists or the learning graph degraded.');
}

if (!/const onPracticeCareerFocus = async \(\) => \{[\s\S]{0,180}openPath\(focusModule\)/.test(careerPage)) {
  failures.push('career home focus CTA must use the existing openPath flow.');
}

if (!/updatePreferences\(\{ pending_module: moduleId, active_module: null, test_mode: null \}\)[\s\S]{0,180}router\.push\('\/mode'\)/.test(careerPage)) {
  failures.push('career home openPath flow must preserve updatePreferences -> /mode routing.');
}

if (!/<span>Status: \{focusStatus\}<\/span>[\s\S]{0,120}<span>Readiness: \{focusReadiness\}<\/span>/.test(careerPage)) {
  failures.push('career home focus panel must render Status and Readiness as separate visible fields inside the focus metadata row.');
}

if (/repeat_count > 0 &&/.test(careerPage)) {
  failures.push('career home focus panel must show repeated issue count even when it is zero.');
}

if (!/<span>\{repeat_count\} repeated issue\{repeat_count === 1 \? '' : 's'\}<\/span>/.test(careerPage)) {
  failures.push('career home focus panel must render the repeated issue count directly, including zero.');
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

if (!paywallModal.includes('{open && !packsOpen && (')) {
  failures.push('PaywallModal must replace the paywall overlay with PacksModal during top-up instead of stacking both overlays.');
}

if (!/onPurchased=\{\(granted\) => \{[\s\S]{0,180}setPacksOpen\(false\)[\s\S]{0,120}void onConfirm\(\)/.test(paywallModal)) {
  failures.push('PaywallModal must close the packs overlay before retrying the gated start after purchase.');
}

if (!paywallModal.includes('const handleClose = () =>') || !paywallModal.includes('if (!confirming) onClose();')) {
  failures.push('PaywallModal must not allow backdrop/close dismissal while a confirmed start is in flight.');
}

for (const token of ['learner_assessment_caveats', 'simulator_integrity_notes', 'score_breakdown', 'Learner Evidence Caveats', 'Simulator Integrity Notes', 'Score Breakdown']) {
  if (!reportModal.includes(token)) {
    failures.push(`SimulationReportModal must render split assessment/report contract with ${token}.`);
  }
}

for (const token of ['max-h-[calc(100dvh-2rem)]', 'overflow-y-auto space-y-6 flex-1 min-h-0 overscroll-contain', 'whitespace-normal break-words overflow-visible']) {
  if (!reportModal.includes(token)) {
    failures.push(`SimulationReportModal must keep long reports scrollable/readable with ${token}.`);
  }
}

const reportWrapChecks = [
  [
    'learner caveats',
    /Learner Evidence Caveats[\s\S]{0,900}className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs font-semibold text-left leading-relaxed whitespace-normal break-words overflow-visible"/,
  ],
  [
    'simulator integrity notes',
    /Simulator Integrity Notes[\s\S]{0,900}className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-semibold text-left leading-relaxed whitespace-normal break-words overflow-visible"/,
  ],
  [
    'evidence quotes',
    /Evidence Quotes[\s\S]{0,900}<span className="text-sm text-slate-600 leading-relaxed break-words min-w-0">\{quote\}<\/span>/,
  ],
  [
    'rubric explanations',
    /Rubric[\s\S]{0,1200}<p className="text-\[11px\] text-slate-500 mt-1\.5 leading-relaxed break-words min-w-0">\{explanation\}<\/p>/,
  ],
  [
    'score adjustment explanations',
    /Score Adjustments[\s\S]{0,900}<p className="mt-1 text-sm leading-relaxed text-slate-700 break-words min-w-0">\{explanation\}<\/p>/,
  ],
  [
    'strength rows',
    /What Landed[\s\S]{0,900}<span className="break-words min-w-0">\{s\}<\/span>/,
  ],
  [
    'improvement rows',
    /Work On Next[\s\S]{0,900}<span className="text-sm text-slate-700 leading-relaxed break-words min-w-0">\{s\}<\/span>/,
  ],
  [
    'read observations',
    /The Read[\s\S]{0,1400}<span className="break-words min-w-0">\{obs\}<\/span>/,
  ],
  [
    'read summary',
    /<p className="text-sm text-slate-600 leading-relaxed break-words min-w-0">\{report\.summary\}<\/p>/,
  ],
];

for (const [label, pattern] of reportWrapChecks) {
  if (!pattern.test(reportModal)) {
    failures.push(`SimulationReportModal ${label} must bind wrapping classes to the rendered text node.`);
  }
}

for (const token of ['scoreExplanationRows', 'Why this score', 'Final score blends', 'Coverage cap lowered', 'Simulator integrity cap lowered']) {
  if (!reportModal.includes(token)) {
    failures.push(`SimulationReportModal must explain score adjustments in learner-readable language with ${token}.`);
  }
}

for (const token of ['Integrity-Capped Assessment', 'Integrity-Flagged Assessment', 'simulator repairs capped score confidence', 'partial read, not a final score']) {
  if (!reportModal.includes(token)) {
    failures.push(`SimulationReportModal must distinguish coverage partials from simulator-integrity partials with ${token}.`);
  }
}

if (/if \(explicitLearner\.length \|\| explicitIntegrity\.length\)[\s\S]{0,220}return/.test(reportModal)) {
  failures.push('SimulationReportModal must merge legacy assessment_caveats with explicit learner/integrity arrays instead of returning early.');
}

if (!/if \(coverageCap\) \{[\s\S]{0,260}score is capped/.test(reportModal)) {
  failures.push('SimulationReportModal must use coverage cap language only inside the numeric coverageCap branch.');
}

if (/if \(hasCoverageShortfall\) \{[\s\S]{0,260}score is capped/.test(reportModal)) {
  failures.push('SimulationReportModal must not say coverage shortfall capped the score unless score_breakdown.coverage_cap is numeric.');
}

if (!/if \(validityCap\) \{[\s\S]{0,320}Integrity-Capped Assessment[\s\S]{0,260}capped score confidence/.test(reportModal)) {
  failures.push('SimulationReportModal must use simulator integrity cap language only inside the numeric validityCap branch.');
}

if (/if \(hasIntegrityNotes\) \{[\s\S]{0,320}capped/.test(reportModal)) {
  failures.push('SimulationReportModal must not say simulator integrity notes capped the score unless score_breakdown.validity_cap is numeric.');
}

if (/score is capped or caveated/.test(reportModal)) {
  failures.push('SimulationReportModal generic partial copy must not blur capped and caveated states.');
}

if (!/typeof scoreBreakdown\.coverage_cap === 'number' && \([\s\S]{0,260}Coverage Cap/.test(reportModal)) {
  failures.push('SimulationReportModal must render the Coverage Cap card only when coverage_cap is numeric.');
}

if (!/typeof scoreBreakdown\.validity_cap === 'number' && \([\s\S]{0,260}Validity Cap/.test(reportModal)) {
  failures.push('SimulationReportModal must render the Validity Cap card only when validity_cap is numeric.');
}

for (const token of ['practiceIsReturnAction', '!practiceIsReturnAction']) {
  if (!reportModal.includes(token)) {
    failures.push(`SimulationReportModal must collapse duplicate return CTAs with ${token}.`);
  }
}

if (sessionRecap.includes('Accuracy') || !sessionRecap.includes('Readiness')) {
  failures.push('SessionRecap must label prep completion as Readiness, not Accuracy.');
}

if (sessionRecap.includes('Milestones Hit') || !sessionRecap.includes('Skills Practiced')) {
  failures.push('SessionRecap must call completed prep nodes Skills Practiced, not Milestones Hit.');
}

if (!sessionRecap.includes('returnLabel') || !sessionPage.includes('returnLabel="Back to Career Map"')) {
  failures.push('SessionRecap must allow career prep to use an explicit Back to Career Map return label.');
}

if (!sessionPage.includes("router.push('/map')") || sessionPage.includes("router.push(isProfessional ? '/mode' : '/map')")) {
  failures.push('Prep session leave/not-found/recap routes must return to /map, not /mode.');
}

for (const token of ['Setting up your prompt...', 'Reviewing your answer...', 'statusLabel={tutorStatusLabel}']) {
  if (!sessionPage.includes(token)) {
    failures.push(`Session page must expose correct prep processing copy/status with ${token}.`);
  }
}

for (const token of ['latestProgressMastery', 'progress?.mastery ?? state?.current_mastery', 'latestProgressStreak', 'latestProgressAttempts']) {
  if (!sessionPage.includes(token)) {
    failures.push(`Session page must render latest progress frames before stale done-state progress with ${token}.`);
  }
}

for (const forbidden of ['Ready checkpoint reached', 'Ready to advance', 'Proceed to Next Skill']) {
  if (sessionPage.includes(forbidden)) {
    failures.push(`Professional transition copy must not imply mastery/advancement while a current gap may exist: remove "${forbidden}".`);
  }
}

for (const token of ['Practice checkpoint reached', 'Next Skill', 'Keep Practicing This Skill']) {
  if (!sessionPage.includes(token)) {
    failures.push(`Session transition card must use clearer practice-vs-next-skill wording with ${token}.`);
  }
}

if (!tutorShell.includes('statusLabel?: string') || !tutorShell.includes('statusLabel ?? treatment.label')) {
  failures.push('TutorShell must allow state-based status labels so disabled inputs do not show Listening.');
}

if (
  !tutorShell.includes('const progressLabel = mode === \'professional\' ? \'Readiness\' : \'Mastery\'')
  || !tutorShell.includes('{progressLabel}')
) {
  failures.push('TutorShell must label professional prep progress as Readiness while preserving Mastery for non-professional learning flows.');
}

if (
  !types.includes('module_id?: string')
  || !sessionPage.includes("['interview_prep', 'gd_prep', 'interview_test', 'gd_test'].includes(state?.task_type || '')")
  || !sessionPage.includes("state?.module_id === 'interview'")
  || !sessionPage.includes("state?.module_id === 'group_discussion'")
  || !sessionPage.includes("state?.competency_node?.startsWith('int_')")
  || !sessionPage.includes("state?.competency_node?.startsWith('gd_')")
) {
  failures.push('Session page must classify professional career prep from task_type, module_id, and node prefix so restored sessions show Readiness.');
}

if (
  pathMap.includes('Next skill ready')
  || !pathMap.includes('Ready for next skill')
  || !pathMap.includes('Sustained Mastery')
  || pathMap.includes('Complete every skill to arrive')
) {
  failures.push('PathMap must distinguish ready-to-advance from sustained mastery in visible labels and destination copy.');
}

if (pathMap.includes('aria-label={`${node.title} ${status}`') || !pathMap.includes('statusDescription')) {
  failures.push('PathMap aria labels must use learner-facing status text, not raw backend status enums.');
}

if (
  !pathMap.includes("const isActive = status === 'active' || status === 'in_progress'")
  || !pathMap.includes('const isNeedsPractice')
  || !pathMap.includes("Needs practice")
) {
  failures.push('PathMap must not treat needs_remediation or other unlocked non-ready statuses as the active node.');
}

if (scenarioPicker.includes('>Ready<') || !scenarioPicker.includes('Ready for next skill')) {
  failures.push('ScenarioPicker ready status must say Ready for next skill, not generic Ready.');
}

if (
  !scenarioPicker.includes('const status = node.display_status ?? node.status')
  || !scenarioPicker.includes("status === 'mastered'")
  || !scenarioPicker.includes('const ready = !mastered')
) {
  failures.push('ScenarioPicker must derive mastered/ready badges from normalized display_status precedence.');
}

if (!mapPage.includes('node.completed || mastered') || !mapPage.includes("status === 'ready_to_advance'")) {
  failures.push('Career map completed-node clicks must trigger reattempt confirmation for completed/ready nodes, not only mastered nodes.');
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
