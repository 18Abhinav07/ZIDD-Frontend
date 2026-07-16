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
  kind: 'current_unavailable';
  action: 'resume_placement' | 'finish_placement';
  label: string;
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
const PLACEMENT_CONTINUATION_UNAVAILABLE_MESSAGE = 'Your saved answers are safe, but no additional question is available yet. Zidd will not pretend this check can continue.';

interface PlacementReportLineage {
  placementSessionId: string;
  profileVersionId: string;
}

interface PlacementContinuationSession {
  session_id: string;
  profile_version_id: string;
  status: string;
  next_item: { item_id: string } | null;
}

interface PlacementLearningPath {
  unlock_state: string;
  active_learning_class_no: number;
}

interface PlacementEvaluatedClass {
  placement_status: string;
  evaluated_class_no: number | null;
}

interface RecapModuleLabel {
  title: string;
  focus: string;
}

interface PlacementEvidenceReport {
  placement_status: string;
  blocking_skills: Array<{ learner_reason: string }>;
  watchlist_skills: Array<{ label: string; source_class_no: number }>;
}

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

export function constrainPlacementReportActionToSession(
  action: SchoolPlacementReportAction,
  lineage: PlacementReportLineage,
  session: PlacementContinuationSession | null,
): SchoolPlacementReportAction {
  if (
    action.kind !== 'current'
    || !['resume_placement', 'finish_placement'].includes(action.action)
  ) {
    return action;
  }

  if (
    session
    && session.session_id === lineage.placementSessionId
    && session.profile_version_id === lineage.profileVersionId
    && session.status === 'in_progress'
    && session.next_item
  ) {
    return action;
  }

  return {
    kind: 'current_unavailable',
    action: action.action as 'resume_placement' | 'finish_placement',
    label: 'Starting-point check is waiting',
    learnerMessage: PLACEMENT_CONTINUATION_UNAVAILABLE_MESSAGE,
  };
}

export function placementLearningPathDetail(report: PlacementLearningPath): {
  label: string;
  value: string;
} {
  if (report.unlock_state === 'locked') {
    return { label: 'Learning path', value: 'No learning path assigned' };
  }
  return {
    label: 'Learning begins in',
    value: `Class ${report.active_learning_class_no}`,
  };
}

export function placementEvaluatedClassLabel(report: PlacementEvaluatedClass): string {
  if (report.evaluated_class_no !== null) {
    return `Class ${report.evaluated_class_no}`;
  }
  if (report.placement_status === 'below_target') {
    return 'Skill-by-skill foundation path';
  }
  if (report.placement_status === 'target_ready') {
    return 'Target class ready';
  }
  return 'Not decided';
}

export function recapModuleDisplayLabel(module: RecapModuleLabel): string {
  const titleSkill = module.title.replace(/^Recap:\s*/i, '').trim().toLocaleLowerCase();
  const focus = module.focus.trim();
  return titleSkill === focus.toLocaleLowerCase()
    ? module.title
    : `${module.title}: ${focus}`;
}

export function placementEvidenceLead(report: PlacementEvidenceReport): {
  rows: string[];
  emptyMessage: string;
} {
  if (report.placement_status === 'below_target') {
    const rows = report.blocking_skills
      .map((skill) => skill.learner_reason.trim())
      .filter(Boolean);
    return {
      rows,
      emptyMessage: rows.length > 0
        ? ''
        : 'The report recommends foundation work but does not include a learner-facing reason yet. Saved answer counts remain available in report details.',
    };
  }

  if (report.placement_status === 'target_ready') {
    const rows = report.watchlist_skills.map((skill) => (
      `${skill.label} will be checked again during Class ${skill.source_class_no} work.`
    ));
    return {
      rows,
      emptyMessage: rows.length > 0
        ? ''
        : 'No additional focus was confirmed. Saved answer counts remain available in report details.',
    };
  }

  return {
    rows: [],
    emptyMessage: 'This check did not produce enough reliable evidence to name a strength or a gap. Saved answer counts remain available in report details.',
  };
}
