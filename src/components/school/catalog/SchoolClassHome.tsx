"use client";

import { ArrowRightIcon, GearIcon, RowsIcon } from '@radix-ui/react-icons';
import {
  SchoolPageHeading,
  SchoolStatusChip,
  schoolPrimaryActionClass,
} from '@/components/school/SchoolPrimitives';
import type { SchoolClassMap } from '@/services/schoolRebuild';
import styles from './SchoolPathMap.module.css';

interface SchoolClassHomeProps {
  schoolClass: SchoolClassMap;
  learnerMessage: string;
  primaryAction?: {
    label: string;
    onSelect: () => void;
  };
  onViewMap: () => void;
  onChangeSetup: () => void;
}

export function SchoolClassHome({
  schoolClass,
  learnerMessage,
  primaryAction,
  onViewMap,
  onChangeSetup,
}: SchoolClassHomeProps) {
  const completed = schoolClass.chapters.filter((chapter) => chapter.status === 'complete').length;
  const activeChapter = schoolClass.chapters.find(
    (chapter) => chapter.chapter_id === schoolClass.active_chapter_id,
  );
  const growingSkills = schoolClass.recent_growth.improving_count
    + schoolClass.recent_growth.active_focus_count;

  return (
    <main className={styles.home}>
      <section className={styles.homeHero} aria-label="Current class activity">
        <div className={styles.homeCopy}>
          <SchoolPageHeading
            eyebrow={`English · Class ${schoolClass.class_no}`}
            title="Your English class"
            description="Continue your chapter or look ahead at the class journey."
          />

          <div className={styles.homeContext}>
            <SchoolStatusChip tone={activeChapter?.status === 'needs_support' ? 'support' : 'accent'}>
              {activeChapter?.status === 'needs_support' ? 'Support ready' : 'Active chapter'}
            </SchoolStatusChip>
            <span className="text-xs font-medium text-slate-500">{schoolClass.book_title}</span>
          </div>

          {activeChapter ? (
            <>
              <h2 className={styles.homeChapterTitle}>{activeChapter.title}</h2>
              <p className={styles.homeMessage}>
                {activeChapter.completed_levels} of {activeChapter.total_levels} learning levels complete.{' '}
                {learnerMessage}
              </p>
            </>
          ) : (
            <>
              <h2 className={styles.homeChapterTitle}>No approved chapters are available</h2>
              <p className={styles.homeMessage}>
                Your class setup is saved. Approved learning content will appear here when it is ready.
              </p>
            </>
          )}

          <div className={styles.homeActions}>
            {primaryAction ? (
              <button type="button" onClick={primaryAction.onSelect} className={schoolPrimaryActionClass}>
                {primaryAction.label}
                <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
            <button type="button" onClick={onViewMap} className={styles.homeLinkAction}>
              <RowsIcon className="h-4 w-4" aria-hidden="true" />
              View class journey
            </button>
          </div>

          <button
            type="button"
            onClick={onChangeSetup}
            className={styles.homeSetup}
          >
            <GearIcon className="h-4 w-4" aria-hidden="true" />
            Change class or subject
          </button>
        </div>

      </section>

      <section className={styles.homeThread} aria-label="Recent growth">
        <span className={styles.homeThreadLabel}>Recent growth</span>
        <div className={styles.homeThreadCopy}>
          <span className={styles.homeThreadNumber} aria-hidden="true">
            {activeChapter ? String(activeChapter.chapter_no).padStart(2, '0') : '--'}
          </span>
          <div>
            <strong>{activeChapter?.title ?? schoolClass.book_title}</strong>
          </div>
        </div>
        <span className={styles.homeThreadMeta}>
          {schoolClass.recent_growth.strong_count} strong · {growingSkills} growing · {completed} of{' '}
          {schoolClass.chapters.length} chapters complete
        </span>
      </section>
    </main>
  );
}
