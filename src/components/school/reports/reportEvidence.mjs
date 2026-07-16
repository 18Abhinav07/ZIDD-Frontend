/**
 * @typedef {{
 *   active_learning_class_no?: number | null,
 * }} ParentStateEvidence
 * @typedef {{ active_learning_class_no?: number | null }} CurriculumClassEvidence
 * @typedef {{ class_no?: number | null }} ClassMapEvidence
 * @typedef {{
 *   chapter_id: string,
 *   title: string,
 *   status: 'complete' | 'active' | 'ready' | 'locked' | 'needs_support',
 *   completed_levels: number,
 *   total_levels: number,
 * }} PracticeChapterEvidence
 * @typedef {{
 *   active_chapter_id?: string | null,
 *   chapters: PracticeChapterEvidence[],
 * }} PracticeClassMapEvidence
 * @typedef {{
 *   title: string,
 *   focus?: string,
 *   skill_ids: string[],
 * }} ReportLevelEvidence
 */

/**
 * Reports use authored learning labels rather than exposing engine identifiers.
 * Unknown identifiers deliberately collapse to a neutral learner-safe label.
 *
 * @param {ReportLevelEvidence[] | null | undefined} levels
 * @returns {(skillId: string) => string}
 */
export function createLearnerSafeSkillLabeler(levels) {
  const labels = new Map();
  for (const level of levels ?? []) {
    const label = String(level.title || level.focus || '').trim();
    if (!label) continue;
    for (const skillId of level.skill_ids ?? []) {
      if (!labels.has(skillId)) labels.set(skillId, label);
    }
  }
  return (skillId) => labels.get(skillId) ?? 'Current learning skill';
}

/**
 * Collapse skills that share one learner-facing authored label. Multi-skill
 * activities write evidence to each assessed skill, so summing their attempts
 * would count one answer more than once; the largest persisted count is the
 * truthful learner-facing total.
 *
 * @param {Array<{
 *   skill_id: string,
 *   skill_label?: string,
 *   attempts?: number,
 *   last_attempt_type?: string,
 * }>} skills
 * @param {(skillId: string) => string} labelSkill
 * @returns {Array<{
 *   label: string,
 *   attempts: number,
 *   last_attempt_type: string,
 *   skill_count: number,
 * }>}
 */
export function groupSkillEvidenceByLabel(skills, labelSkill) {
  const grouped = new Map();
  for (const skill of skills ?? []) {
    const label = String(skill.skill_label || labelSkill(skill.skill_id) || '').trim();
    if (!label || label === 'Current learning skill') continue;
    const attempts = Math.max(0, Number.isFinite(skill.attempts) ? Math.trunc(skill.attempts) : 0);
    const key = label.toLocaleLowerCase('en');
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, {
        label,
        attempts,
        last_attempt_type: String(skill.last_attempt_type || ''),
        skill_count: 1,
      });
      continue;
    }
    current.skill_count += 1;
    if (attempts > current.attempts) {
      current.attempts = attempts;
      current.last_attempt_type = String(skill.last_attempt_type || '');
    }
  }
  return [...grouped.values()];
}

/**
 * @param {number} attempts
 * @param {string | null | undefined} attemptType
 * @returns {string}
 */
export function describeSavedAttempts(attempts, attemptType) {
  const count = Math.max(0, Number.isFinite(attempts) ? Math.trunc(attempts) : 0);
  const kind = String(attemptType || 'learning').replaceAll('_', ' ').trim() || 'learning';
  const alreadyNamesCheck = /\bcheck$/i.test(kind);
  const noun = alreadyNamesCheck ? kind : `${kind} check`;
  return `${count} saved ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * A state action cannot safely promise continuation when the active placement
 * session itself has no next question.
 *
 * @param {{
 *   active_flow?: string | null,
 *   active_session_id?: string | null,
 *   profile_version_id?: string | null,
 *   next_action?: string | null,
 * }} state
 * @param {{
 *   session_id?: string | null,
 *   profile_version_id?: string | null,
 *   status?: string | null,
 *   next_item?: unknown,
 * } | null | undefined} placement
 * @returns {{ heading: string, actionLabel: string, message: string } | null}
 */
export function reportPlacementContinuationOverride(state, placement) {
  const placementContinuation = state.active_flow === 'placement'
    && (state.next_action === 'resume_placement' || state.next_action === 'finish_placement');
  if (!placementContinuation) return null;

  const canContinue = placement?.session_id === state.active_session_id
    && placement?.profile_version_id === state.profile_version_id
    && placement?.status === 'in_progress'
    && Boolean(placement?.next_item);
  if (canContinue) return null;

  return {
    heading: 'Starting-point check is waiting',
    actionLabel: 'Check for another question',
    message: 'Your saved answers are safe, but no additional question is available for this check yet.',
  };
}

/**
 * @param {{
 *   curriculumSession?: CurriculumClassEvidence | null,
 *   classMap?: ClassMapEvidence | null,
 *   state: ParentStateEvidence,
 * }} evidence
 * @returns {number | null}
 */
export function resolveParentCurrentClassNo({ curriculumSession, classMap, state }) {
  return curriculumSession?.active_learning_class_no
    ?? classMap?.class_no
    ?? state.active_learning_class_no
    ?? null;
}

/**
 * @param {PracticeChapterEvidence} chapter
 * @returns {boolean}
 */
function hasCurrentPracticeStatus(chapter) {
  return chapter.status === 'active' || chapter.status === 'needs_support';
}

/**
 * @param {PracticeClassMapEvidence | null | undefined} classMap
 * @returns {PracticeChapterEvidence | null}
 */
export function selectLearnerPracticeChapter(classMap) {
  if (!classMap) return null;
  const pointedChapter = classMap.chapters.find((chapter) => chapter.chapter_id === classMap.active_chapter_id);
  if (pointedChapter && hasCurrentPracticeStatus(pointedChapter)) return pointedChapter;
  return classMap.chapters.find(hasCurrentPracticeStatus) ?? null;
}

/**
 * @param {PracticeClassMapEvidence | null | undefined} classMap
 * @returns {PracticeChapterEvidence | null}
 */
export function selectParentCurrentChapter(classMap) {
  if (!classMap) return null;
  const pointedChapter = classMap.chapters.find((chapter) => chapter.chapter_id === classMap.active_chapter_id);
  if (pointedChapter && hasCurrentPracticeStatus(pointedChapter)) return pointedChapter;
  return classMap.chapters.find(hasCurrentPracticeStatus) ?? null;
}

/**
 * A ready chapter is the learner's next destination, not current practice.
 * Prefer the curriculum engine's persisted next chapter, then the class map.
 *
 * @param {PracticeClassMapEvidence | null | undefined} classMap
 * @param {{
 *   status?: string,
 *   next_available_chapter?: { chapter_id: string, title: string } | null,
 * } | null | undefined} curriculumSession
 * @returns {{ chapter_id: string, title: string } | PracticeChapterEvidence | null}
 */
export function selectParentNextChapter(classMap, curriculumSession) {
  if (curriculumSession?.status === 'complete' && curriculumSession.next_available_chapter) {
    return curriculumSession.next_available_chapter;
  }
  return classMap?.chapters.find((chapter) => chapter.status === 'ready') ?? null;
}
