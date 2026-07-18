const HOME_ACTION_LABELS = {
  start_curriculum: 'Start next chapter',
  resume_curriculum: 'Continue chapter',
  start_masterclass: 'Start focused practice',
  resume_masterclass: 'Continue focused practice',
  resume_support: 'Continue focused support',
  view_support_plan: 'Open support plan',
  view_report: 'Open learning report',
  start_recap: 'Start readiness path',
  resume_recap: 'Continue readiness path',
  revise_recap_path: 'Strengthen readiness path',
};

/**
 * @param {{
 *   unlock_state?: string | null,
 *   subject_id?: string | null,
 *   active_learning_class_no?: number | null,
 *   target_class_no?: number | null,
 * }} state
 */
export function shouldRenderUnlockedSchoolHome(state) {
  const activeClassNo = state.active_learning_class_no ?? state.target_class_no;
  return state.unlock_state === 'target_unlocked'
    && Boolean(state.subject_id)
    && Number.isInteger(activeClassNo);
}

/**
 * @param {string | null | undefined} action
 */
export function schoolHomeActionLabel(action) {
  return HOME_ACTION_LABELS[action] ?? 'Continue learning';
}
