import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { teachingStatusFor } from '../src/lib/sessionStreamPresentation.mjs';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const billing = read('src/services/billing.ts');
const mapPage = read('src/app/(gamified)/map/page.tsx');
const subjectsPage = read('src/app/subjects/page.tsx');
const classPage = read('src/app/subjects/class/[classNo]/page.tsx');
const testPage = read('src/app/subjects/test/[testId]/page.tsx');
const careerPage = read('src/app/career/page.tsx');
const profilePage = read('src/app/profile/page.tsx');
const meService = read('src/services/me.ts');
const loginPage = read('src/app/auth/login/page.tsx');
const onboardingPage = read('src/app/onboarding/page.tsx');
const creditsBadge = read('src/components/billing/CreditsBadge.tsx');
const paywallModal = read('src/components/billing/PaywallModal.tsx');
const reportModal = read('src/components/shared/SimulationReportModal.tsx');
const reportPresentationPath = path.join(root, 'src/lib/simulationReportPresentation.mjs');
const reportPresentationSource = fs.existsSync(reportPresentationPath)
  ? fs.readFileSync(reportPresentationPath, 'utf8')
  : '';
const reportPresentation = fs.existsSync(reportPresentationPath)
  ? await import(pathToFileURL(reportPresentationPath))
  : null;
const sessionRecap = read('src/components/shared/SessionRecap.tsx');
const pathMap = read('src/components/shared/PathMap.tsx');
const scenarioPicker = read('src/components/shared/ScenarioPicker.tsx');
const sessionPage = read('src/app/session/[id]/page.tsx');
const sessionStreamPresentation = read('src/lib/sessionStreamPresentation.mjs');
const tutorShell = read('src/components/tutor/TutorShell.tsx');
const simulatorShell = read('src/components/simulator/SimulatorShell.tsx');
const endSessionConfirm = read('src/components/simulator/EndSessionConfirmModal.tsx');
const gdSimulatorPage = read('src/app/(professional)/simulator/gd/page.tsx');
const interviewSimulatorPage = read('src/app/(professional)/simulator/interview/page.tsx');
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

if (!meService.includes('memory_context')) {
  failures.push('me service must type /me/learning-graph memory_context so the profile can render canonical career growth buckets.');
}

for (const token of ['getMeLearningGraph', 'learningGraph', 'Career growth', 'Active gaps', 'Improving', 'Resolved', 'Mastered', 'latest_evidence', 'repeat_count', 'Practice focus', 'onPracticeCareerGap']) {
  if (!profilePage.includes(token)) {
    failures.push(`profile page must render canonical career growth graph from /me/learning-graph with ${token}`);
  }
}

for (const token of ['getMeLearningGraph', 'careerLearningGraph', 'memory_context', 'Career focus', 'active_gaps', 'improving_gaps', 'latest_evidence', 'repeat_count', 'Practice focus', 'onPracticeCareerFocus']) {
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

if (!/const onPracticeCareerFocus = async \(\) => \{[\s\S]{0,520}updatePreferences\(\{ active_module: focusModule, pending_module: null, test_mode: false \}\)[\s\S]{0,260}careerPracticeHref\(careerFocus \|\| \{\}\)/.test(careerPage)) {
  failures.push('career home focus CTA must activate prep and route through the validated focus helper.');
}

if (!/updatePreferences\(\{ pending_module: moduleId, active_module: null, test_mode: null \}\)[\s\S]{0,180}router\.push\('\/mode'\)/.test(careerPage)) {
  failures.push('career home openPath flow must preserve updatePreferences -> /mode routing.');
}

if (!/<span>Status: \{focusStatus\}<\/span>[\s\S]{0,120}<span>Readiness: \{focusReadiness\}<\/span>/.test(careerPage)) {
  failures.push('career home focus panel must render Status and Readiness as separate visible fields inside the focus metadata row.');
}

if (!/repeat_count > 0 &&/.test(careerPage)) {
  failures.push('career home focus panel must suppress a meaningless zero repeated-issue count.');
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

const reportSources = `${reportModal}\n${reportPresentationSource}`;
for (const token of ['learner_assessment_caveats', 'simulator_integrity_notes', 'score_breakdown', 'Learner Evidence Caveats', 'Simulator Integrity Notes', 'Score Breakdown']) {
  if (!reportSources.includes(token)) {
    failures.push(`SimulationReportModal must render split assessment/report contract with ${token}.`);
  }
}

for (const token of ['max-h-[calc(100dvh-2rem)]', 'shrink-0']) {
  if (!reportModal.includes(token)) {
    failures.push(`SimulationReportModal must keep only its body scrollable while header/footer stay stable with ${token}.`);
  }
}
if (!/className="[^"]*flex[^"]*flex-col[^"]*overflow-hidden/.test(reportModal)) {
  failures.push('SimulationReportModal dialog must be a flex column with overflow contained.');
}
if (!/className="[^"]*min-h-0[^"]*flex-1[^"]*overflow-y-auto[^"]*overscroll-contain/.test(reportModal)) {
  failures.push('SimulationReportModal body must own vertical scrolling and overscroll containment.');
}

for (const token of ['scoreExplanationRows', 'Why this score', 'Coverage cap', 'Simulator integrity cap']) {
  if (!reportModal.includes(token)) {
    failures.push(`SimulationReportModal must explain score adjustments in learner-readable language with ${token}.`);
  }
}

if (!reportPresentation?.reportPresentationFor || !reportPresentation?.splitAssessmentCaveats) {
  failures.push('Simulation report presentation must be derived by a pure, testable helper.');
} else {
  const insufficient = reportPresentation.reportPresentationFor({ validity_status: 'insufficient_evidence' });
  const invalid = reportPresentation.reportPresentationFor({ validity_status: 'invalid_simulation' });
  const provisional = reportPresentation.reportPresentationFor({ validity_status: 'partial' });
  const capped = reportPresentation.reportPresentationFor({ validity_status: 'partial', score_breakdown: { coverage_cap: 0.7 } });
  const finalWithNotes = reportPresentation.reportPresentationFor({
    validity_status: 'final',
    assessment_caveats: ['sImUlAtOr CaVeAt: repaired speaker routing'],
  });
  const split = reportPresentation.splitAssessmentCaveats({
    learner_assessment_caveats: ['Short answer'],
    assessment_caveats: [
      'SIMULATOR CAVEAT: repaired speaker routing',
      'simulator INTEGRITY: fallback response inserted',
    ],
  });

  if (insufficient.title !== 'Session Review' || insufficient.scoreLabel !== 'Not scored' || !insufficient.isNotScored) {
    failures.push('Insufficient-evidence reports must present Session Review / Not scored.');
  }
  if (invalid.title !== 'Session Review' || invalid.scoreLabel !== 'Not scored' || !invalid.isNotScored) {
    failures.push('Invalid simulations must present Session Review / Not scored.');
  }
  if (provisional.title !== 'Assessment Review' || provisional.scoreLabel !== 'Provisional') {
    failures.push('Uncapped partial reports must present Assessment Review / Provisional.');
  }
  if (capped.title !== 'Assessment Review' || capped.scoreLabel !== 'Capped') {
    failures.push('Numerically capped partial reports must present Assessment Review / Capped.');
  }
  if (finalWithNotes.title !== 'Assessment Complete' || finalWithNotes.scoreLabel !== 'Final' || !/Integrity Notes/i.test(finalWithNotes.validityLabel)) {
    failures.push('Final reports with merged integrity caveats must remain final while naming the integrity notes.');
  }
  if (
    split.learner.some((note) => /simulator (?:caveat|integrity):/i.test(note))
    || !split.integrity.includes('repaired speaker routing')
    || !split.integrity.includes('fallback response inserted')
  ) {
    failures.push('Legacy simulator caveat/integrity prefixes must merge case-insensitively into integrity notes, never learner caveats.');
  }
}

for (const token of ['presentation.title', 'presentation.scoreLabel', '!presentation.isNotScored', '!presentation.isFinal', 'isFirstSim && !presentation.isNotScored']) {
  if (!reportModal.includes(token)) {
    failures.push(`SimulationReportModal must render validity-derived report semantics with ${token}.`);
  }
}

if (reportModal.includes('>Assessment Complete<') || reportModal.includes('Score reflects partial participation')) {
  failures.push('SimulationReportModal must not hard-code final or partial-score language outside validity-derived presentation.');
}

if (!/if \(presentation\.isNotScored\) return;[\s\S]{0,240}getMe\(\)/.test(reportModal)) {
  failures.push('SimulationReportModal must consume first_sim_complete only after a scored report is presented.');
}

if (!/typeof scoreBreakdown\.coverage_cap === 'number' && \([\s\S]{0,420}Coverage Cap/.test(reportModal)) {
  failures.push('SimulationReportModal must render the Coverage Cap card only when coverage_cap is numeric.');
}

if (!/typeof scoreBreakdown\.validity_cap === 'number' && \([\s\S]{0,420}Validity Cap/.test(reportModal)) {
  failures.push('SimulationReportModal must render the Validity Cap card only when validity_cap is numeric.');
}

if (!/grid-cols-1[\s\S]{0,100}sm:grid-cols-3/.test(reportModal)) {
  failures.push('SimulationReportModal evidence and score grids must collapse to one column on narrow screens.');
}

for (const token of ['coverageCovered?: number', 'coverageRequired?: number', 'integrityFlagCount?: number', 'Backend validation decides', 'Insufficient answer evidence', 'Insufficient coverage', 'Integrity risk', 'Evidence ready for validation']) {
  if (!`${endSessionConfirm}\n${sessionStreamPresentation}`.includes(token)) {
    failures.push(`EndSessionConfirmModal must distinguish backend validation evidence with ${token}.`);
  }
}

for (const token of ['Coverage not yet verified', 'End & Validate Report', 'endSessionEvidenceFor']) {
  if (!`${endSessionConfirm}\n${sessionStreamPresentation}`.includes(token)) {
    failures.push(`End-session evidence must represent unknown coverage explicitly with ${token}.`);
  }
}

for (const token of ['dialogRef', 'previousFocus', "event.key !== 'Tab'", "event.key === 'Escape'", 'querySelectorAll<HTMLElement>', 'previousFocus?.focus()', 'tabIndex={-1}']) {
  if (!endSessionConfirm.includes(token)) {
    failures.push(`EndSessionConfirmModal must own a complete keyboard focus lifecycle with ${token}.`);
  }
}
if (!/event\.key === 'Escape'[\s\S]{0,180}showCancel/.test(endSessionConfirm)) {
  failures.push('EndSessionConfirmModal Escape handling must cancel only when cancellation is available.');
}

if (simulatorShell.includes('onSaveLater') || simulatorShell.includes('Save for Later')) {
  failures.push('SimulatorShell must have one clear Leave action because leaving already preserves the transcript.');
}

for (const token of ['isEndDisabled?: boolean', 'disabled={isClosing || isEndDisabled}']) {
  if (!simulatorShell.includes(token)) {
    failures.push(`SimulatorShell must use an explicit end-action busy contract with ${token}.`);
  }
}

for (const token of ['isBusy?: boolean', 'disabled={isClosing || isBusy}']) {
  if (!endSessionConfirm.includes(token)) {
    failures.push(`EndSessionConfirmModal must block confirmation while recovery settles with ${token}.`);
  }
}

for (const [name, source] of [['GD', gdSimulatorPage], ['Interview', interviewSimulatorPage]]) {
  for (const token of ['activeStreamKind', 'isRecoveringTurn', 'const isEndDisabled =', 'const inputDisabled = simulatorInputBlocked({', 'isEndDisabled={isEndDisabled}', 'isBusy={isEndDisabled}', 'simulatorStatusFor({', 'coverageCovered={coverageCovered}', 'coverageRequired={coverageRequired}', 'integrityFlagCount={integrityFlagCount}']) {
    if (!source.includes(token)) failures.push(`${name} simulator must wire ${token}.`);
  }
  if (!/simulatorStatusFor\(\{[\s\S]{0,180}isRecoveringTurn/.test(source)) {
    failures.push(`${name} simulator status must surface turn recovery as Reviewing.`);
  }
  if (!/const submitDraft[\s\S]{0,320}inputDisabled/.test(source)) {
    failures.push(`${name} simulator submitDraft must use the shared recovery-aware input guard.`);
  }
  if (!/const handleQuickAction[\s\S]{0,180}if \(inputDisabled\) return;/.test(source)) {
    failures.push(`${name} simulator quick actions must be inert while recovery owns the turn.`);
  }
  if (!/const handleConfirmEnd = \(\) => \{[\s\S]{0,120}if \(isEndDisabled\) return;/.test(source)) {
    failures.push(`${name} simulator must reject modal confirmation while end actions are busy.`);
  }
  if (source.includes('handleSaveLater') || source.includes('onSaveLater=')) {
    failures.push(`${name} simulator must remove the duplicate save-later path.`);
  }
}

const shortViewportDialogClasses = reportModal.match(
  /data-short-viewport-fallback="dialog-scroll"[\s\S]{0,260}className="([^"]+)"/,
)?.[1] ?? '';
if (
  !shortViewportDialogClasses.includes('[@media(max-height:640px)]:block')
  || !shortViewportDialogClasses.includes('[@media(max-height:640px)]:overflow-y-auto')
) {
  failures.push('SimulationReportModal must switch to a reachable dialog-scroll fallback on short viewports.');
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
  if (!`${sessionPage}\n${sessionStreamPresentation}`.includes(token)) {
    failures.push(`Session page must expose correct prep processing copy/status with ${token}.`);
  }
}

if (
  teachingStatusFor({ teachingBlocked: true, checkpointReached: true }) !== 'Blocked'
  || teachingStatusFor({ checkpointReached: true }) !== 'Complete'
  || !sessionPage.includes('teachingStatusFor({')
) {
  failures.push('A successful pending next-skill transition must show Complete, while true blocked states remain Blocked.');
}

for (const forbidden of ["? 'Paused'", "? 'Checkpoint reached'", 'statusForActiveStream(activeStreamKind)']) {
  if (sessionPage.includes(forbidden)) {
    failures.push(`Teaching status must use Preparing, Reviewing, Ready, Complete, or Blocked; remove ${forbidden}.`);
  }
}

for (const token of ['latestProgressMastery', 'progress?.mastery ?? state?.current_mastery', 'latestProgressStreak', 'latestProgressAttempts']) {
  if (!sessionPage.includes(token)) {
    failures.push(`Session page must render latest progress frames before stale done-state progress with ${token}.`);
  }
}

for (const token of ['cleanStreak={visibleCleanStreak}', 'attempts={visibleAttempts}']) {
  if (!sessionPage.includes(token)) {
    failures.push(`Session page must pass visible completed-node evidence into TutorShell with ${token}.`);
  }
}

for (const token of [
  'progress?.readiness_score ?? state?.readiness_score',
  'pendingTransition?.from_readiness_score',
  'pendingTransition?.from_clean_streak',
  'pendingTransition?.from_attempts',
  "pendingTransition?.from_display_status || ''",
]) {
  if (!sessionPage.includes(token)) {
    failures.push(`Prep readiness and transition reloads must use immutable completed-node evidence with ${token}.`);
  }
}

for (const forbidden of ['Ready checkpoint reached', 'Ready to advance', 'Proceed to Next Skill']) {
  if (sessionPage.includes(forbidden)) {
    failures.push(`Professional transition copy must not imply mastery/advancement while a current gap may exist: remove "${forbidden}".`);
  }
}

for (const token of ['Practice checkpoint passed', 'Next Skill', 'Keep Practicing This Skill']) {
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

for (const token of ['cleanStreak?: number', 'attempts?: number', 'Attempts', 'Clean passes', 'min-w-0', 'overflow-hidden']) {
  if (!tutorShell.includes(token)) {
    failures.push(`TutorShell must present compact, overflow-safe attempt evidence with ${token}.`);
  }
}

const compactEvidenceClasses = tutorShell.match(
  /data-progress-evidence="compact"[\s\S]{0,120}className="([^"]+)"/,
)?.[1] ?? '';
const wideEvidenceClasses = tutorShell.match(
  /data-progress-evidence="wide"[\s\S]{0,120}className="([^"]+)"/,
)?.[1] ?? '';
if (
  tutorShell.includes('A {attempts}')
  || !compactEvidenceClasses.includes('inline-flex')
  || !compactEvidenceClasses.includes('basis-full')
  || !compactEvidenceClasses.includes('flex-wrap')
  || !compactEvidenceClasses.includes('xl:hidden')
  || compactEvidenceClasses.includes('min-[')
  || compactEvidenceClasses.split(/\s+/).includes('hidden')
) {
  failures.push('TutorShell compact attempt evidence must stay visible and wrap safely from 320px through large widths.');
}
if (
  !wideEvidenceClasses.includes('hidden')
  || !wideEvidenceClasses.includes('xl:flex')
  || /(?:sm|md|lg):flex/.test(wideEvidenceClasses)
) {
  failures.push('TutorShell wide attempt evidence chip must not activate before the xl breakpoint.');
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
