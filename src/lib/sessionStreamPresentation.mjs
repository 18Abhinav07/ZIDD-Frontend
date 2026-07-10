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
