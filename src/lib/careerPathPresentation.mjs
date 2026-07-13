function hasProgressEvidence(node = {}) {
  const status = node.display_status ?? node.status;
  return Boolean(
    node.completed
    || node.mastered
    || node.node_mastered
    || (node.attempts ?? 0) > 0
    || (node.clean_streak ?? 0) > 0
    || (node.display_mastery ?? node.mastery ?? 0) > 0
    || ['ready_to_advance', 'proficient', 'mastered', 'needs_remediation', 'improving'].includes(status)
  );
}

function currentStatusFor(item = {}) {
  return item.current_competence_status || item.status || '';
}

export function careerCompetenceLabel(status = '') {
  return {
    active_gap: 'Needs focused practice',
    needs_review: 'Review recommended',
    improving: 'Improving',
    resolved: 'Resolved',
    mastered: 'Mastered',
  }[status] || 'Tracked';
}

export function careerPracticeHref(item = {}) {
  const focusId = String(item?.focus_id || '').trim();
  return focusId ? `/map?focus=${encodeURIComponent(focusId)}` : '/map';
}

function learnerFacingGap(value = '') {
  const text = String(value || '').trim();
  return /^(?:gd|int)_\d+_[a-z0-9_]+$/i.test(text) ? '' : text;
}

export function mergeCareerMemoryIntoPath(nodes = [], memory = {}) {
  const bySkill = new Map();
  for (const bucket of ['mastered_skills', 'resolved_gaps', 'improving_gaps', 'active_gaps']) {
    for (const item of memory?.[bucket] || []) {
      const targetId = item?.focus_id;
      if (targetId) bySkill.set(targetId, item);
    }
  }

  return nodes.map((node) => {
    const item = bySkill.get(node.node_id);
    if (!item) return node;
    const currentStatus = currentStatusFor(item);
    const originalStatus = node.display_status ?? node.status;
    const displayStatus = ['active', 'in_progress'].includes(originalStatus)
      ? originalStatus
      : currentStatus === 'mastered'
      ? 'mastered'
      : currentStatus === 'resolved'
        ? 'ready_to_advance'
        : currentStatus === 'improving'
          ? 'improving'
          : currentStatus === 'active_gap' || currentStatus === 'needs_review'
            ? 'needs_remediation'
            : node.display_status ?? node.status;
    const readiness = Number(item.readiness);

    return {
      ...node,
      display_status: displayStatus,
      display_mastery: Number.isFinite(readiness)
        ? Math.max(0, Math.min(1, readiness))
        : node.display_mastery,
      last_gap: learnerFacingGap(item.gap),
      current_competence_status: currentStatus,
      milestone_mastered: Boolean(item.milestone_mastered || node.milestone_mastered),
    };
  });
}

export function deriveCareerPathPresentation(nodes = []) {
  const lastProgressIndex = nodes.reduce(
    (latest, node, index) => hasProgressEvidence(node) ? index : latest,
    -1,
  );
  const allNodesMastered = nodes.length > 0 && nodes.every((node) => {
    const status = node.display_status ?? node.status;
    const needsReview = status === 'needs_remediation'
      || ['active_gap', 'needs_review'].includes(node.current_competence_status);
    return !needsReview && Boolean(node.mastered || node.node_mastered || status === 'mastered');
  });
  const hasPathActivity = lastProgressIndex >= 0;
  const pathFillPercentage = allNodesMastered
    ? 100
    : lastProgressIndex < 0
      ? 0
      : (lastProgressIndex / Math.max(1, nodes.length - 1)) * 100;

  return {
    allNodesMastered,
    hasPathActivity,
    headline: hasPathActivity ? 'Your journey continues' : 'Your journey begins',
    lastProgressIndex,
    pathFillPercentage,
  };
}
