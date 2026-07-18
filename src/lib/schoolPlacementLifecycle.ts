import { resolveSchoolStateDestination } from './schoolActivityPolicy.ts';

interface PlacementMutationSnapshot {
  session_id: string;
  profile_version_id: string;
  status: string;
  next_item: unknown | null;
}

interface PlacementMutationState {
  status: string;
  active_flow: string | null;
  active_session_id: string | null;
  profile_version_id: string | null;
  next_action: string | null;
  next_action_url: string;
  allowed_next_actions: readonly string[];
}

export type SchoolPlacementMutationDecision =
  | { kind: 'interactive'; reportAvailable: boolean }
  | { kind: 'pending'; reportAvailable: boolean }
  | { kind: 'settling'; reportAvailable: boolean }
  | { kind: 'terminal'; reportAvailable: boolean }
  | { kind: 'start'; reportAvailable: boolean }
  | { kind: 'resume'; reportAvailable: boolean }
  | { kind: 'navigate'; destination: string; reportAvailable: boolean }
  | {
    kind: 'recover';
    reportAvailable: boolean;
    reason: 'identity_mismatch' | 'state_unresolved';
  };

function isPlacementDestination(destination: string) {
  return destination === '/school/placement'
    || destination.startsWith('/school/placement?')
    || destination.startsWith('/school/placement#');
}

export interface SchoolPlacementAnswerDraft {
  itemId: string | null;
  value: string;
}

export function visiblePlacementAnswer(
  draft: SchoolPlacementAnswerDraft,
  currentItemId: string | null,
  awaitingEvaluation: boolean,
) {
  if (draft.itemId === currentItemId) return draft.value;
  return awaitingEvaluation && currentItemId === null ? draft.value : '';
}

export function resolveSchoolPlacementMutation(
  placement: PlacementMutationSnapshot,
  state: PlacementMutationState,
): SchoolPlacementMutationDecision {
  const reportAvailable = state.allowed_next_actions.includes('view_placement_report');
  const profileMatches = state.profile_version_id === placement.profile_version_id;
  const sessionMatches = state.active_session_id === placement.session_id;

  if (!profileMatches) {
    return { kind: 'recover', reportAvailable, reason: 'identity_mismatch' };
  }

  if (state.status === 'awaiting_evaluation') {
    return state.active_flow === 'placement' && sessionMatches
      ? { kind: 'pending', reportAvailable }
      : { kind: 'recover', reportAvailable, reason: 'identity_mismatch' };
  }

  const destination = resolveSchoolStateDestination({
    nextAction: state.next_action,
    allowedNextActions: state.allowed_next_actions,
    nextActionUrl: state.next_action_url,
  });
  if (!destination) {
    return { kind: 'recover', reportAvailable, reason: 'state_unresolved' };
  }

  const hasInteractiveQuestion = placement.status === 'in_progress'
    && placement.next_item !== null;
  if (hasInteractiveQuestion) {
    return state.active_flow === 'placement'
      && sessionMatches
      && isPlacementDestination(destination)
      && ['resume_placement', 'finish_placement'].includes(state.next_action ?? '')
      ? { kind: 'interactive', reportAvailable }
      : { kind: 'recover', reportAvailable, reason: 'identity_mismatch' };
  }

  if (!isPlacementDestination(destination)) {
    return { kind: 'navigate', destination, reportAvailable };
  }

  if (state.next_action === 'start_placement') {
    return { kind: 'start', reportAvailable };
  }

  if (
    placement.status === 'insufficient_evidence'
    && state.status === 'insufficient_evidence'
    && state.next_action === 'resume_placement'
    && state.active_flow === 'placement'
    && sessionMatches
  ) {
    return { kind: 'resume', reportAvailable };
  }

  if (state.active_flow !== 'placement' || !sessionMatches) {
    return { kind: 'recover', reportAvailable, reason: 'identity_mismatch' };
  }

  const terminalStateMatches = (
    placement.status === 'insufficient_evidence'
    && state.status === 'insufficient_evidence'
    && state.next_action === 'finish_placement'
  ) || (
    placement.status === 'in_progress'
    && ['resume_placement', 'finish_placement'].includes(state.next_action ?? '')
  );
  if (terminalStateMatches) {
    return { kind: 'terminal', reportAvailable };
  }

  if (placement.status !== 'in_progress') {
    return ['resume_placement', 'finish_placement'].includes(state.next_action ?? '')
      ? { kind: 'settling', reportAvailable }
      : { kind: 'recover', reportAvailable, reason: 'state_unresolved' };
  }
  return { kind: 'recover', reportAvailable, reason: 'state_unresolved' };
}
