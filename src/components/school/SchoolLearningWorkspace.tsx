"use client";

import type { CSSProperties, ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import styles from './SchoolLearningWorkspace.module.css';

interface SchoolLearningWorkspaceProps {
  title: string;
  onBack: () => void;
  children: ReactNode;
  coach: ReactNode;
  progress?: ReactNode;
  actions?: ReactNode;
  showBack?: boolean;
  backLabel?: string;
  coachLabel?: string;
  progressLabel?: string;
  workspaceLabel?: string;
  className?: string;
  themeStyle?: CSSProperties;
  rootDataAttributes?: Record<`data-${string}`, string | undefined>;
}

export function SchoolLearningWorkspace({
  title,
  onBack,
  children,
  coach,
  progress,
  actions,
  showBack = true,
  backLabel = 'Back to School path',
  coachLabel = 'School learning coach',
  progressLabel = 'Lesson progress',
  workspaceLabel = 'School learning activity',
  className = '',
  themeStyle,
  rootDataAttributes,
}: SchoolLearningWorkspaceProps) {
  return (
    <div className={`${styles.workspace} ${className}`} style={themeStyle} {...rootDataAttributes}>
      <main className={styles.inner}>
        <aside className={styles.coachRail} aria-label={coachLabel} data-school-region="coach-rail">
          {coach}
        </aside>

        <section
          className={styles.activitySurface}
          aria-label={`${workspaceLabel}: ${title}`}
          data-school-region="activity-surface"
        >
          <div className={`${styles.utilityRow} ${showBack ? '' : styles.utilityRowWithoutBack}`}>
            {showBack && onBack ? (
              <button type="button" onClick={onBack} className={styles.backButton} aria-label={backLabel} title={backLabel}>
                <ArrowLeft size={18} aria-hidden="true" />
              </button>
            ) : null}
            {progress ? (
              <div className={styles.progress} aria-label={progressLabel}>
                {progress}
              </div>
            ) : null}
            {actions ? (
              <div className={styles.actions} aria-label="Activity controls">
                {actions}
              </div>
            ) : null}
          </div>

          <div className={styles.body}>{children}</div>
        </section>
      </main>
    </div>
  );
}
