export function slowStreamCopyFor(activeStreamKind) {
  if (activeStreamKind === 'opening') return 'Setting up your prompt...';
  if (activeStreamKind === 'learner_turn') return 'Reviewing your answer...';
  return 'Working on this turn...';
}

export function statusForActiveStream(activeStreamKind) {
  if (activeStreamKind === 'opening') return 'Preparing';
  if (activeStreamKind === 'learner_turn') return 'Reviewing';
  return 'Working';
}

/**
 * @param {{
 *   isComplete?: boolean,
 *   isClosing?: boolean,
 *   isRecoveringTurn?: boolean,
 *   isStreaming?: boolean,
 *   activeStreamKind?: 'opening' | 'learner_turn' | null,
 *   isSubmitting?: boolean,
 * }} state
 */
export function simulatorStatusFor({
  isComplete = false,
  isClosing = false,
  isRecoveringTurn = false,
  isStreaming = false,
  activeStreamKind = null,
  isSubmitting = false,
} = {}) {
  if (isComplete) return 'Complete';
  if (isClosing) return 'Scoring';
  if (isRecoveringTurn) return 'Reviewing';
  if (isStreaming) return statusForActiveStream(activeStreamKind);
  if (isSubmitting) return 'Reviewing';
  return 'Ready';
}

/**
 * @param {{
 *   isStreaming?: boolean,
 *   isRecoveringTurn?: boolean,
 *   isClosing?: boolean,
 *   shouldClose?: boolean,
 *   isSubmitting?: boolean,
 *   inputAllowed?: boolean,
 *   blockReason?: string | null,
 * }} state
 */
export function simulatorInputBlocked({
  isStreaming = false,
  isRecoveringTurn = false,
  isClosing = false,
  shouldClose = false,
  isSubmitting = false,
  inputAllowed = true,
  blockReason = null,
} = {}) {
  return Boolean(
    isStreaming ||
    isRecoveringTurn ||
    isClosing ||
    shouldClose ||
    isSubmitting ||
    inputAllowed === false ||
    blockReason
  );
}

/**
 * @param {{
 *   scorableTurns?: number,
 *   minScorableTurns?: number,
 *   coverageCovered?: number,
 *   coverageRequired?: number,
 *   integrityFlagCount?: number,
 *   reportAffectingFlagCount?: number,
 * }} evidence
 */
export function endSessionEvidenceFor({
  scorableTurns = 0,
  minScorableTurns = 0,
  coverageCovered,
  coverageRequired,
  integrityFlagCount = 0,
  reportAffectingFlagCount,
} = {}) {
  const hasEnoughAnswers = scorableTurns >= minScorableTurns;
  const coverageKnown = typeof coverageCovered === 'number' && typeof coverageRequired === 'number';
  const hasEnoughCoverage = Boolean(
    coverageKnown && (coverageRequired <= 0 || coverageCovered >= coverageRequired)
  );
  const effectiveReportAffectingFlagCount = typeof reportAffectingFlagCount === 'number'
    ? Math.max(0, reportAffectingFlagCount)
    : Math.max(0, integrityFlagCount);
  const hasSimulatorNotes = integrityFlagCount > 0;
  const hasIntegrityRisk = effectiveReportAffectingFlagCount > 0;

  let label;
  let copy;
  if (!hasEnoughAnswers) {
    label = 'Insufficient answer evidence';
    copy = 'This attempt may be marked not scored because too few score-eligible answers are available.';
  } else if (!coverageKnown) {
    label = 'Coverage not yet verified';
    copy = 'Answer evidence is available, but coverage has not been reported yet. Backend validation must verify it before assigning report status.';
  } else if (!hasEnoughCoverage) {
    label = 'Insufficient coverage';
    copy = 'Enough answers exist, but the assessed areas are not broad enough for an expected final report.';
  } else if (hasIntegrityRisk) {
    label = 'Report validity risk';
    copy = 'Answer and coverage evidence are present, but one or more simulator failures may make the report partial or invalid.';
  } else if (hasSimulatorNotes) {
    label = 'Evidence ready with simulator notes';
    copy = 'Current evidence supports a scored report. Repaired simulator output will be documented separately and will not be presented as a learner weakness.';
  } else {
    label = 'Evidence ready for validation';
    copy = 'Current answer and verified coverage evidence supports an expected scored report.';
  }

  const actionLabel = hasEnoughAnswers && !coverageKnown
    ? 'End & Validate Report'
    : hasEnoughAnswers && hasEnoughCoverage && !hasIntegrityRisk
      ? 'End & Generate Report'
      : 'End Anyway';

  return {
    label,
    copy,
    actionLabel,
    hasEnoughAnswers,
    coverageKnown,
    hasEnoughCoverage,
    hasIntegrityRisk,
    hasSimulatorNotes,
    reportAffectingFlagCount: effectiveReportAffectingFlagCount,
  };
}

/**
 * @param {{
 *   moduleComplete?: boolean,
 *   isBootstrapping?: boolean,
 *   isRecoveringTurn?: boolean,
 *   isStreaming?: boolean,
 *   activeStreamKind?: 'opening' | 'learner_turn' | null,
 *   isSubmitting?: boolean,
 *   teachingBlocked?: boolean,
 *   checkpointReached?: boolean,
 * }} state
 */
export function teachingStatusFor({
  moduleComplete = false,
  isBootstrapping = false,
  isRecoveringTurn = false,
  isStreaming = false,
  activeStreamKind = null,
  isSubmitting = false,
  teachingBlocked = false,
  checkpointReached = false,
} = {}) {
  if (moduleComplete) return 'Complete';
  if (isBootstrapping) return 'Preparing';
  if (isRecoveringTurn) return 'Reviewing';
  if (isStreaming) return statusForActiveStream(activeStreamKind);
  if (isSubmitting) return 'Reviewing';
  if (teachingBlocked) return 'Blocked';
  if (checkpointReached) return 'Complete';
  return 'Ready';
}

export function openingSnapshotComplete({
  openingStreamed = false,
  hasOpeningMessage = false,
  hasGamePrompt = false,
  terminalSession = false,
} = {}) {
  return Boolean(
    openingStreamed ||
    hasOpeningMessage ||
    hasGamePrompt ||
    terminalSession
  );
}

export function durableTurnCompleted(lastTurn, expectedClientTurnId) {
  return Boolean(
    expectedClientTurnId &&
    lastTurn?.client_turn_id === expectedClientTurnId &&
    lastTurn?.status === 'completed'
  );
}

export function shouldStartLateTurnRecovery({
  accepted = false,
  hasLearnerTurn = false,
  elapsedMs = 0,
  normalOwnershipMs = 0,
} = {}) {
  return Boolean(
    accepted &&
    hasLearnerTurn &&
    elapsedMs >= normalOwnershipMs
  );
}

export async function runLateTurnRecovery({
  expectedClientTurnId,
  deadlineMs,
  maxPolls,
  pollDelayMs,
  isOwner,
  pollTranscript,
  now = Date.now,
  wait = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
}) {
  let polls = 0;

  while (polls < maxPolls) {
    if (!isOwner()) return { status: 'cancelled', polls };
    const remainingMs = deadlineMs - now();
    if (remainingMs <= 0) break;

    await wait(Math.min(pollDelayMs, remainingMs));
    if (!isOwner()) return { status: 'cancelled', polls };
    if (now() >= deadlineMs) break;

    let outcome;
    try {
      outcome = await pollTranscript(expectedClientTurnId, deadlineMs);
    } catch {
      polls += 1;
      continue;
    }
    polls += 1;

    if (!isOwner()) return { status: 'cancelled', polls };
    if (outcome?.terminal) return { status: 'terminal', polls };
    if (outcome?.completed) return { status: 'completed', polls };
    if (outcome?.failed) return { status: 'failed', polls };
  }

  return isOwner()
    ? { status: 'exhausted', polls }
    : { status: 'cancelled', polls };
}

export function nextActiveStreamKind(currentKind, event) {
  if (event === 'opening_started') return 'opening';
  if (event === 'learner_turn_started') return 'learner_turn';
  if (
    event === 'completed' ||
    event === 'error' ||
    event === 'disconnected' ||
    event === 'session_changed'
  ) {
    return null;
  }
  return currentKind;
}
