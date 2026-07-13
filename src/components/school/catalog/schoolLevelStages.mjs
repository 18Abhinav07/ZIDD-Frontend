export const SCHOOL_STAGE_ORDER = Object.freeze([
  'Discover',
  'Practise Together',
  'Try It Yourself',
  'Use It Somewhere New',
]);

/**
 * @typedef {'complete' | 'active' | 'ready' | 'locked' | 'needs_support'} SchoolMapStatus
 * @typedef {{ level_id: string, learner_stage: string, title: string, status: SchoolMapStatus }} AuthoredLevel
 * @typedef {{ title: string, status: SchoolMapStatus }} ChapterCheck
 */

/**
 * @param {Array<{ status: SchoolMapStatus }>} levels
 * @returns {SchoolMapStatus}
 */
export function aggregateSchoolStageStatus(levels) {
  if (levels.some((level) => level.status === 'needs_support')) return 'needs_support';
  if (levels.some((level) => level.status === 'active')) return 'active';
  if (levels.length > 0 && levels.every((level) => level.status === 'complete')) return 'complete';
  if (levels.some((level) => level.status === 'ready')) return 'ready';
  return 'locked';
}

/**
 * @param {AuthoredLevel[]} levels
 * @param {SchoolMapStatus} status
 * @returns {AuthoredLevel | undefined}
 */
function selectCurrentAuthoredLevel(levels, status) {
  return levels.find((level) => level.status === status)
    ?? levels.find((level) => level.status === 'active')
    ?? levels.find((level) => level.status === 'needs_support')
    ?? levels.find((level) => level.status === 'ready')
    ?? levels.find((level) => level.status !== 'locked')
    ?? levels[0];
}

/**
 * @param {AuthoredLevel[]} levels
 * @param {ChapterCheck} chapterCheck
 * @param {string} chapterId
 */
export function buildSchoolLevelStages(levels, chapterCheck, chapterId) {
  const learnerStages = SCHOOL_STAGE_ORDER.map((label, index) => {
    const authoredLevels = levels.filter((level) => level.learner_stage === label);
    const status = aggregateSchoolStageStatus(authoredLevels);
    const selectedLevel = selectCurrentAuthoredLevel(authoredLevels, status);

    return {
      id: `${chapterId}:learner-stage:${index + 1}`,
      label,
      title: selectedLevel?.title ?? label,
      status,
      interactive: status !== 'locked',
      authoredLevelIds: authoredLevels.map((level) => level.level_id),
    };
  });

  return [
    ...learnerStages,
    {
      id: `${chapterId}:challenge`,
      label: 'Chapter Challenge',
      title: chapterCheck.title,
      status: chapterCheck.status,
      interactive: chapterCheck.status !== 'locked',
      authoredLevelIds: [],
    },
  ];
}
