#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const hook = readFileSync('src/hooks/useZiddSession.ts', 'utf8');
const interviewPage = readFileSync('src/app/(professional)/simulator/interview/page.tsx', 'utf8');
const gdPage = readFileSync('src/app/(professional)/simulator/gd/page.tsx', 'utf8');
const tutorShell = readFileSync('src/components/tutor/TutorShell.tsx', 'utf8');
const simulatorShell = readFileSync('src/components/simulator/SimulatorShell.tsx', 'utf8');
const gdBriefingCard = readFileSync('src/components/simulator/GDBriefingCard.tsx', 'utf8');
const simulationReportModal = readFileSync('src/components/shared/SimulationReportModal.tsx', 'utf8');
const coachingNudge = readFileSync('src/lib/coachingNudge.ts', 'utf8');
const sessionRecap = readFileSync('src/components/shared/SessionRecap.tsx', 'utf8');
const pathMap = readFileSync('src/components/shared/PathMap.tsx', 'utf8');
const creditsBadge = readFileSync('src/components/billing/CreditsBadge.tsx', 'utf8');

const failures = [];

if (!hook.includes('isBootstrapping')) {
  failures.push('useZiddSession must expose isBootstrapping so simulator pages do not render a generic shell before restore.');
}

if (!hook.includes('terminalSession')) {
  failures.push('useZiddSession bootstrap must explicitly stop opening streams for ended/scored sessions.');
}

if (!hook.includes('pendingVisibleSimTurnRef')) {
  failures.push('useZiddSession must keep simulation round updates pending until the next visible assistant prompt token arrives.');
}

if (hook.includes('if (sim.turn) setSimTurn(sim.turn)')) {
  failures.push('useZiddSession must not render the next simulation round before the matching assistant prompt is visible.');
}

if (!hook.includes('pendingVisibleSimTurnRef.current = sim.turn')) {
  failures.push('useZiddSession must store incoming simulation round frames as pending visible state.');
}

if (!hook.includes('setSimTurn(pendingVisibleSimTurnRef.current)')) {
  failures.push('useZiddSession must promote the pending simulation round when a visible assistant message starts streaming.');
}

for (const token of [
  'roundFromDoneFrame',
  'done.assessment_state?.progress?.round_count',
  'setSimTurn(doneRound)',
]) {
  if (!hook.includes(token)) {
    failures.push(`useZiddSession must recover the simulator round from the terminal done frame when the simulation_state SSE frame is missed; missing ${token}.`);
  }
}

if (!hook.includes("data.state?.simulation_report")) {
  failures.push('useZiddSession bootstrap must treat a persisted simulation_report as terminal reload state.');
}

if (!hook.includes('setReport(data.state.simulation_report)')) {
  failures.push('useZiddSession bootstrap must restore the persisted simulation report after reload.');
}

if (!hook.includes('closingRef.current = true')) {
  failures.push('useZiddSession bootstrap must latch completed simulations so reload does not auto-score or reset them.');
}

const restoredMessageMatch = hook.match(/function normalizeTranscriptMessages[\s\S]*?function hasOpeningTranscriptMessage/);
const restoredMessageBlock = restoredMessageMatch?.[0] ?? '';
for (const field of ['speaker_id', 'node_id', 'transition_id', 'message_kind', 'status']) {
  if (!restoredMessageBlock.includes(field)) {
    failures.push(`useZiddSession transcript bootstrap must preserve restored message metadata field ${field}.`);
  }
}

if (!hook.includes('closingRef.current = false') || !hook.includes('Could not score this session')) {
  failures.push('useZiddSession endSession must release its close latch and surface a retryable scoring error on /end failure.');
}

if (!/(if\s*\(terminalSession\)|if\s*\(snapshot\.terminalSession\))\s*\{[^}]*setIsBootstrapping\(false\);[^}]*return;[^}]*\}/s.test(hook)) {
  failures.push('useZiddSession must stop bootstrapping and return when a terminal session is restored.');
}

if (
  !hook.includes('data.state.simulation_tension') ||
  !hook.includes('setTension(Math.round(Math.max(0, Math.min(1, data.state.simulation_tension)) * 100))')
) {
  failures.push('useZiddSession must restore persisted simulation tension from transcript state during bootstrap.');
}

if (interviewPage.includes("state?.personas?.[0]?.role || 'Principal Interviewer'")) {
  failures.push('Interview simulator must not render raw backend persona.role as the visible interviewer bio.');
}

if (interviewPage.includes("'Principal Interviewer'") || interviewPage.includes('"Principal Interviewer"')) {
  failures.push('Interview simulator must not use Principal Interviewer as a generic fallback.');
}

if (interviewPage.includes("'your target role'") || interviewPage.includes('"your target role"')) {
  failures.push('Interview simulator must not show generic "your target role" fallback copy after reload.');
}

if (!interviewPage.includes('isBootstrapping')) {
  failures.push('Interview simulator must render a restoring state while session bootstrap is pending.');
}

if (!interviewPage.includes("report?.role_focus")) {
  failures.push('Interview simulator title must fall back to the persisted report role_focus on completed-session reload.');
}

if (!interviewPage.includes('<SimulationReportModal') || !interviewPage.includes('report={report}')) {
  failures.push('Interview simulator must render the restored completed-session report instead of only an active round shell.');
}

if (!interviewPage.includes('isComplete={isComplete}')) {
  failures.push('Interview simulator must pass completed/scored state to SimulatorShell.');
}

if (!gdPage.includes('isBootstrapping')) {
  failures.push('GD simulator must render a restoring state while session bootstrap is pending.');
}

if (gdPage.includes("'System'") || gdPage.includes('"System"')) {
  failures.push('GD simulator must not label assistant transcript messages as System.');
}

if (/\.filter\(\(p\)\s*=>\s*p\.role_type\s*!==\s*['"]moderator['"]/.test(gdPage)) {
  failures.push('GD simulator must render the moderator in the live roster because backend can route moderator turns.');
}

if (!gdPage.includes("speaker_id: 'moderator'")) {
  failures.push('GD simulator fallback roster must include a Moderator participant because backend can route moderator turns before persona state hydrates.');
}

if (!gdPage.includes("role_type === 'moderator' ? 'Facilitator'")) {
  failures.push('GD simulator must label moderator personas as Facilitator in the visible roster.');
}

if (!gdPage.includes('isComplete={isComplete}')) {
  failures.push('GD simulator must pass completed/scored state to SimulatorShell.');
}

if (simulatorShell.includes("'SYSTEM'")) {
  failures.push('SimulatorShell must not expose SYSTEM as a learner-visible speaker fallback.');
}

if (!simulatorShell.includes('useId') || !simulatorShell.includes('id={textareaId}') || !simulatorShell.includes('name={`${type}-response`}')) {
  failures.push('SimulatorShell textarea must have stable id/name attributes so forms, browser autofill, and accessibility tooling have a real input contract.');
}

if (!simulatorShell.includes('onInput={(e) => setInputValue(e.currentTarget.value)}')) {
  failures.push('SimulatorShell textarea must listen to onInput as well as onChange so browser-filled GD/interview answers enable Send reliably.');
}

if (gdBriefingCard.includes('each participant contributes once per round')) {
  failures.push('GD briefing must not promise that every participant contributes once per round; backend routes one primary speaker plus optional reactors.');
}

if (!simulatorShell.includes('isComplete?: boolean') || !simulatorShell.includes("isComplete ? 'Complete'")) {
  failures.push('SimulatorShell must render a distinct Complete status for scored sessions.');
}

if (!simulatorShell.includes('statusLabel?: string') || !simulatorShell.includes('resolvedStatusLabel = statusLabel ??')) {
  failures.push('SimulatorShell must accept an explicit statusLabel so submitting/waiting states do not render as Live.');
}

if (!simulatorShell.includes('isInputDisabled?: boolean') || !simulatorShell.includes('const inputDisabled = Boolean(isInputDisabled)')) {
  failures.push('SimulatorShell must distinguish network streaming from input-disabled state.');
}

if (gdPage.includes('isStreaming={isStreaming || shouldClose') || interviewPage.includes('isStreaming={isStreaming || shouldClose')) {
  failures.push('Simulator pages must not pass shouldClose as isStreaming; round-cap/end states should not show Live.');
}

for (const [name, source] of [
  ['Interview simulator', interviewPage],
  ['GD simulator', gdPage],
]) {
  if (!source.includes('simulatorStatusLabel') || !source.includes('statusLabel={simulatorStatusLabel}') || !source.includes("'Reviewing'")) {
    failures.push(`${name} must pass explicit Ready/Reviewing/Scoring/Complete status labels to SimulatorShell.`);
  }
}

if (!gdPage.includes('backendScorableTurns') || !interviewPage.includes('backendScorableTurns')) {
  failures.push('Simulator end confirmation must use backend-owned assessment progress counts.');
}

for (const required of ['validity_status', 'scorable_turn_count', 'coverage_map', 'Assessment Evidence', 'Insufficient Evidence', 'Invalid Simulation']) {
  if (!simulationReportModal.includes(required)) {
    failures.push(`SimulationReportModal must render assessment validity and evidence field: ${required}`);
  }
}

for (const required of ['Score Adjustments', 'Object.entries(report.score_explanations ?? {})']) {
  if (!simulationReportModal.includes(required)) {
    failures.push(`SimulationReportModal must render backend score adjustment explanations; missing ${required}.`);
  }
}

for (const required of ['isInsufficientEvidence', 'isInvalidSimulation', 'isNotScored', 'Not scored', '!isNotScored &&', 'Rubric not scored']) {
  if (!simulationReportModal.includes(required)) {
    failures.push(`SimulationReportModal must not present not-scored reports as a 0% scored failure; missing ${required}`);
  }
}

if (!simulationReportModal.includes("weakest = isNotScored ? null")) {
  failures.push('SimulationReportModal must not derive weakest rubric-dimension CTA from not-scored reports.');
}

if (
  !simulationReportModal.includes('Learner Evidence Caveats') ||
  !simulationReportModal.includes('Simulator Integrity Notes') ||
  !simulationReportModal.includes('break-words') ||
  !simulationReportModal.includes('max-h-[calc(100dvh-2rem)]') ||
  !simulationReportModal.includes('flex flex-col') ||
  !simulationReportModal.includes('overflow-y-auto space-y-6 flex-1 min-h-0') ||
  simulationReportModal.includes('scrollbar-hide space-y-7 flex-1 min-h-0')
) {
  failures.push('SimulationReportModal must keep its header/footer inside the viewport and render caveats in a real scrollable body with wrapping.');
}

if (!simulatorShell.includes('{!isComplete && (')) {
  failures.push('SimulatorShell must hide End & Score once the session is complete.');
}

if (!simulatorShell.includes("isClosing ? 'Scoring'") || !simulatorShell.includes('effectiveCoachingTip')) {
  failures.push('SimulatorShell must show an explicit Scoring status and hide coaching nudges while scoring or complete.');
}

if (simulatorShell.includes('disabled={isStreaming || isClosing}') || simulatorShell.includes('coachingTip={coachingTip}')) {
  failures.push('SimulatorShell input bars must also disable on completed sessions and use effectiveCoachingTip.');
}

if (!creditsBadge.includes('hasLoadedOnMountRef') || creditsBadge.includes('loadBalance(refreshOnMount)')) {
  failures.push('CreditsBadge refreshOnMount must be a one-shot refresh, not a balance-update polling loop.');
}

for (const phrase of ['Good start', 'Great job', 'Well done', 'Awesome', 'nailed']) {
  if (coachingNudge.includes(phrase)) {
    failures.push(`Coaching nudges must not use celebratory overpraise in corrective moments: ${phrase}`);
  }
}

for (const phrase of ["You're doing great", 'Keep it up', 'You got this', 'Mastery is just a few turns away']) {
  if (pathMap.includes(phrase)) {
    failures.push(`PathMap node copy must not imply earned mastery or praise before the learner practices: ${phrase}`);
  }
}

for (const [name, source] of [
  ['Interview simulator', interviewPage],
  ['GD simulator', gdPage],
]) {
  if (source.includes("if (!rep) router.push('/map')")) {
    failures.push(`${name} must not route away when /end fails to return a report; scoring should stay retryable.`);
  }
  if (!source.includes('autoEndAttemptedRef')) {
    failures.push(`${name} must guard automatic scoring so a failed /end call does not loop indefinitely.`);
  }
  if (!source.includes('pendingClientTurnIdRef')) {
    failures.push(`${name} must preserve a stable client_turn_id across startup failures.`);
  }
  if (!source.includes('const clientTurnId = pendingClientTurnIdRef.current ?? crypto.randomUUID()')) {
    failures.push(`${name} must create/reuse a stable client turn id before sending.`);
  }
  if (!source.includes('setInputValue(\'\');')) {
    failures.push(`${name} must clear the textarea immediately after a guarded send starts.`);
  }
  if (!/streamTurn\(draft,\s*clientTurnId(?:,|\))/.test(source)) {
    failures.push(`${name} must pass the stable client turn id into streamTurn.`);
  }
  if (!source.includes('if (!result.started) {') || !source.includes('setInputValue(draft);')) {
    failures.push(`${name} must restore the draft when stream startup is not accepted.`);
  }
  if (!source.includes('if (result.completed)') || !source.includes('pendingClientTurnIdRef.current = null')) {
    failures.push(`${name} must clear the pending client turn id only after the stream completes.`);
  }
  if (!source.includes('Boolean(state?.block_reason)')) {
    failures.push(`${name} must block input when backend block_reason is set.`);
  }
  if (!source.includes('state?.assessment_state?.progress?.min_scorable_turns')) {
    failures.push(`${name} must use backend-owned min_scorable_turns in end confirmation.`);
  }
  if (source.includes('minScorableTurns={6}') || source.includes('minScorableTurns={5}')) {
    failures.push(`${name} must not hard-code end-confirmation scoring thresholds.`);
  }
}

if (/if \(!briefingDismissed\) return/.test(gdPage)) {
  failures.push('GD simulator must not block transcript/report restore behind the briefing card.');
}

if (tutorShell.includes('>Directive<')) {
  failures.push('TutorShell must not render the internal-sounding Directive label.');
}

if (sessionRecap.includes('{w.skill_id}')) {
  failures.push('SessionRecap must not render raw internal skill_id values in Focus Areas.');
}

if (!sessionRecap.includes('labelSkillId') || !sessionRecap.includes('@/lib/skillLabels')) {
  failures.push('SessionRecap Focus Areas must render learner-safe skill labels through labelSkillId.');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
