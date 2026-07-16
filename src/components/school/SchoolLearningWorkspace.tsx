"use client";

import type { CSSProperties, ReactNode } from 'react';
import { ArrowLeft, BookOpenText } from 'lucide-react';
import styles from './SchoolLearningWorkspace.module.css';

interface SchoolLearningWorkspaceProps {
  title: string;
  eyebrow: string;
  onBack: () => void;
  children: ReactNode;
  coach: ReactNode;
  compactCoach?: ReactNode;
  mobileCoach?: ReactNode;
  progress?: ReactNode;
  headerMeta?: ReactNode;
  headerIcon?: ReactNode;
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
  eyebrow,
  onBack,
  children,
  coach,
  compactCoach,
  mobileCoach,
  progress,
  headerMeta,
  headerIcon,
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

        <section className={styles.activitySurface} aria-label={workspaceLabel} data-school-region="activity-surface">
          <header className={styles.activityHeader}>
            <button type="button" onClick={onBack} className={styles.backButton} aria-label={backLabel} title={backLabel}>
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
            <div className={styles.heading}>
              <p className={styles.eyebrow}>
                {headerIcon ?? <BookOpenText size={14} aria-hidden="true" />}
                <span className={styles.eyebrowText}>{eyebrow}</span>
                {headerMeta ? <span className={styles.headerMeta}>{headerMeta}</span> : null}
              </p>
              <h1 className={styles.title}>{title}</h1>
            </div>
            {compactCoach ? <div className={styles.compactCoach}>{compactCoach}</div> : null}
          </header>

          {mobileCoach ? (
            <aside className={styles.mobileCoach} aria-label={coachLabel} data-school-region="mobile-coach">
              {mobileCoach}
            </aside>
          ) : null}

          {progress ? (
            <div className={styles.progress} aria-label={progressLabel}>
              {progress}
            </div>
          ) : null}

          <div className={styles.body}>{children}</div>
        </section>
      </main>
    </div>
  );
}
