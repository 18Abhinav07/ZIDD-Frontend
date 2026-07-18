export type SchoolCoachTone = 'neutral' | 'pending' | 'success' | 'warning' | 'error';

export interface SchoolCoachHint {
  key: string;
  text: string;
}

export interface SchoolCoachPresentation {
  status: string;
  message: string;
  tone: SchoolCoachTone;
  hint: SchoolCoachHint | null;
}

interface SchoolCoachFeedbackCandidate {
  activity_id: string;
  message: string;
  result_visible?: boolean;
}

interface SchoolCoachFeedbackOptions {
  includePrevious?: boolean;
}

interface ResolveSchoolCoachPresentationInput {
  status: string;
  fallbackMessage: string;
  activityKey?: string | null;
  teachingBlock?: string | null;
  feedback?: string | null;
  pendingMessage?: string | null;
  transitionMessage?: string | null;
  error?: string | null;
  tone?: SchoolCoachTone;
}

function clean(value: string | null | undefined) {
  return value?.trim() ?? '';
}

export function selectVisibleSchoolCoachFeedback<T extends SchoolCoachFeedbackCandidate>(
  currentActivityId: string | null | undefined,
  feedback: T | null | undefined,
  options: SchoolCoachFeedbackOptions = {},
): T | null {
  if (!feedback || feedback.result_visible === false || !clean(feedback.message)) return null;
  const currentId = clean(currentActivityId);
  if (!currentId) return null;
  if (!options.includePrevious && clean(feedback.activity_id) !== currentId) return null;
  return feedback;
}

export function resolveSchoolCoachPresentation({
  status,
  fallbackMessage,
  activityKey,
  teachingBlock,
  feedback,
  pendingMessage,
  transitionMessage,
  error,
  tone = 'neutral',
}: ResolveSchoolCoachPresentationInput): SchoolCoachPresentation {
  const safeStatus = clean(status) || 'Your coach';
  const safeFallback = clean(fallbackMessage) || 'Take this one step at a time.';
  const safeError = clean(error);
  const safePending = clean(pendingMessage);
  const safeFeedback = clean(feedback);
  const safeTransition = clean(transitionMessage);
  const safeTeachingBlock = clean(teachingBlock);
  const hint = safeTeachingBlock
    ? {
        key: `${activityKey || 'school-guidance'}:${safeTeachingBlock}`,
        text: safeTeachingBlock,
      }
    : null;

  if (safeError) {
    return { status: 'Needs attention', message: safeError, tone: 'error', hint: null };
  }
  if (safePending) {
    return { status: safeStatus, message: safePending, tone: 'pending', hint: null };
  }
  if (safeTransition) {
    return { status: safeStatus, message: safeTransition, tone, hint: null };
  }
  if (safeFeedback) {
    return { status: safeStatus, message: safeFeedback, tone, hint };
  }

  return {
    status: safeStatus,
    message: safeFallback,
    tone,
    hint,
  };
}
