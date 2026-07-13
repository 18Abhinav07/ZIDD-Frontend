interface HistoricalPlacementReport {
  profile_version_id: string;
  target_class_no: number;
}

interface CurrentSchoolState {
  profile_status: string;
  profile_version_id: string | null;
  learner_message: string;
  next_action: string | null;
  next_action_url: string;
  allowed_next_actions: string[];
}

export type SchoolPlacementReportAction = {
  kind: 'historical_only';
  learnerMessage: string;
} | {
  kind: 'current';
  action: string;
  label: string;
  learnerMessage: string;
  url: string;
  effect: 'navigate' | 'start_recap';
};

const ACTION_LABELS: Record<string, string> = {
  start_placement: 'Start starting-point check',
  resume_placement: 'Continue starting-point check',
  finish_placement: 'Finish starting-point check',
  view_placement_report: 'View starting-point report',
  start_recap: 'Start foundation path',
  resume_recap: 'Continue foundation path',
  revise_recap_path: 'Review foundation path',
  start_curriculum: 'Start target class',
  resume_curriculum: 'Continue chapter',
  start_masterclass: 'Start focused practice',
  resume_masterclass: 'Continue focused practice',
  resume_support: 'Continue support',
  view_support_plan: 'Open support plan',
  view_report: 'View growth report',
  retry: 'Retry',
};

const HISTORICAL_ONLY_MESSAGE = 'Your saved placement conclusion is still available. Refresh School to confirm the current next step.';

export function resolveSchoolPlacementReportAction(
  report: HistoricalPlacementReport,
  state: CurrentSchoolState | null,
): SchoolPlacementReportAction {
  const action = state?.next_action;
  if (
    !state
    || state.profile_status !== 'complete'
    || state.profile_version_id !== report.profile_version_id
    || !action
    || !state.allowed_next_actions.includes(action)
    || !ACTION_LABELS[action]
    || !/^\/school(?:[/?#]|$)/.test(state.next_action_url)
  ) {
    return { kind: 'historical_only', learnerMessage: HISTORICAL_ONLY_MESSAGE };
  }

  return {
    kind: 'current',
    action,
    label: action === 'start_curriculum'
      ? `Start Class ${report.target_class_no}`
      : ACTION_LABELS[action],
    learnerMessage: state.learner_message,
    url: state.next_action_url,
    effect: action === 'start_recap' ? 'start_recap' : 'navigate',
  };
}
