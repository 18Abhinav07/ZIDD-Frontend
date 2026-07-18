"use client";

import { ArrowRightIcon, GearIcon, RowsIcon } from '@radix-ui/react-icons';
import {
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
  const chapterProgress = activeChapter && activeChapter.total_levels > 0
    ? Math.round((activeChapter.completed_levels / activeChapter.total_levels) * 100)
    : 0;
  const classProgress = schoolClass.chapters.length > 0
    ? Math.round((completed / schoolClass.chapters.length) * 100)
    : 0;

  return (
    <main className={styles.home}>
      <section className={styles.homeHero} aria-label="Current class activity">
        <div className={styles.homeCopy}>
          <p className={styles.homeEyebrow}>English · Class {schoolClass.class_no}</p>

          <div className={styles.homeContext}>
            <SchoolStatusChip tone={activeChapter?.status === 'needs_support' ? 'support' : 'accent'}>
              {activeChapter?.status === 'needs_support' ? 'Support ready' : 'Active chapter'}
            </SchoolStatusChip>
            <span className="text-xs font-medium text-slate-500">{schoolClass.book_title}</span>
          </div>

          {activeChapter ? (
            <>
              <h1 className={styles.homeChapterTitle}>{activeChapter.title}</h1>
              <p className={styles.homeMessage}>
                {learnerMessage}
              </p>
              <div className={styles.homeChapterProgress}>
                <div className={styles.homeProgressMeta}>
                  <span>Chapter progress</span>
                  <strong>{activeChapter.completed_levels} of {activeChapter.total_levels} stages</strong>
                </div>
                <div
                  className={styles.homeProgressTrack}
                  role="progressbar"
                  aria-label={`${activeChapter.title} progress`}
                  aria-valuemin={0}
                  aria-valuemax={activeChapter.total_levels}
                  aria-valuenow={activeChapter.completed_levels}
                >
                  <span className={styles.homeProgressFill} style={{ width: `${chapterProgress}%` }} />
                </div>
              </div>
            </>
          ) : (
            <>
              <h1 className={styles.homeChapterTitle}>No approved chapters are available</h1>
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
              View chapters
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

        <aside className={styles.homeProgressPanel} aria-label="Class progress">
          <p className={styles.homeProgressLabel}>Class progress</p>
          <div className={styles.homeProgressValue}>
            <strong>{completed}</strong>
            <span>/ {schoolClass.chapters.length}</span>
          </div>
          <p className={styles.homeProgressSummary}>chapters complete in {schoolClass.book_title}</p>
          <div
            className={styles.homeProgressTrack}
            role="progressbar"
            aria-label={`Class ${schoolClass.class_no} progress`}
            aria-valuemin={0}
            aria-valuemax={schoolClass.chapters.length}
            aria-valuenow={completed}
          >
            <span className={styles.homeProgressFill} style={{ width: `${classProgress}%` }} />
          </div>
          <dl className={styles.homeProgressStats}>
            <div>
              <dt>Skills in progress</dt>
              <dd>{growingSkills}</dd>
            </div>
            <div>
              <dt>{schoolClass.recent_growth.strong_count > 0 ? 'Strong skills' : 'Current chapter'}</dt>
              <dd>
                {schoolClass.recent_growth.strong_count > 0
                  ? schoolClass.recent_growth.strong_count
                  : activeChapter?.chapter_no ?? '—'}
              </dd>
            </div>
          </dl>
        </aside>
      </section>
    </main>
  );
}
