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
 */

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
