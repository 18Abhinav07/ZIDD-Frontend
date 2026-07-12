function hasProgressEvidence(node = {}) {
  const status = node.display_status ?? node.status;
  return Boolean(
    node.completed
    || node.mastered
    || node.node_mastered
    || (node.attempts ?? 0) > 0
    || (node.clean_streak ?? 0) > 0
    || (node.display_mastery ?? node.mastery ?? 0) > 0
    || ['ready_to_advance', 'proficient', 'mastered', 'needs_remediation'].includes(status)
  );
}

export function deriveCareerPathPresentation(nodes = []) {
  const lastProgressIndex = nodes.reduce(
    (latest, node, index) => hasProgressEvidence(node) ? index : latest,
    -1,
  );
  const allNodesMastered = nodes.length > 0 && nodes.every((node) => {
    const status = node.display_status ?? node.status;
    return Boolean(node.mastered || node.node_mastered || status === 'mastered');
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
