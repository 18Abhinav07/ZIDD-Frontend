import { CURRICULUM_REVALIDATE_MS } from './schoolActivityPolicy.ts';

export interface MasterclassActivityViewInput {
  schoolStatus: string | null;
  sessionStatus: 'active' | 'complete' | 'abandoned' | null;
  activityId: string | null;
  canAnswer: boolean;
}

export type MasterclassActivityView =
  | { kind: 'pending'; canSubmit: false; pollDue: true; pollAfterMs: number }
  | { kind: 'activity'; canSubmit: boolean; pollDue: false; pollAfterMs: null }
  | { kind: 'passive'; canSubmit: false; pollDue: false; pollAfterMs: null };

export function masterclassActivityView(
  input: MasterclassActivityViewInput,
): MasterclassActivityView {
  if (input.schoolStatus === 'awaiting_evaluation') {
    return {
      kind: 'pending',
      canSubmit: false,
      pollDue: true,
      pollAfterMs: CURRICULUM_REVALIDATE_MS,
    };
  }
  if (
    input.schoolStatus === 'in_progress'
    && input.sessionStatus === 'active'
    && input.activityId
  ) {
    return {
      kind: 'activity',
      canSubmit: input.canAnswer,
      pollDue: false,
      pollAfterMs: null,
    };
  }
  return { kind: 'passive', canSubmit: false, pollDue: false, pollAfterMs: null };
}

export function isMasterclassAnswerInProgress(error: unknown): error is Error {
  return error instanceof Error && error.message === 'masterclass_answer_in_progress';
}
