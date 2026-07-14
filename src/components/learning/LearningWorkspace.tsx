"use client";

import type { CSSProperties, ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeftIcon, ReaderIcon } from '@radix-ui/react-icons';

export interface LearningWorkspaceProps {
  title: string;
  eyebrow: string;
  onBack: () => void;
  children: ReactNode;
  coach: ReactNode;
  compactCoach?: ReactNode;
  progress?: ReactNode;
  topBar?: ReactNode;
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

export function LearningWorkspace({
  title,
  eyebrow,
  onBack,
  children,
  coach,
  compactCoach,
  progress,
  topBar,
  headerMeta,
  headerIcon,
  backLabel = 'Back to learning path',
  coachLabel = 'Learning coach',
  progressLabel = 'Learning progress',
  workspaceLabel = 'Learning activity',
  className = '',
  themeStyle,
  rootDataAttributes,
}: LearningWorkspaceProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={`min-h-[100dvh] overflow-x-hidden bg-background text-slate-900 ${className}`}
      style={themeStyle}
      {...rootDataAttributes}
    >
      {topBar}
      <main className={`mx-auto w-full max-w-[1540px] px-3 pb-4 sm:px-5 sm:pb-6 lg:px-6 ${topBar ? 'pt-20' : 'pt-3 sm:pt-5'}`}>
        <div className={`grid min-h-[calc(100dvh-6rem)] min-w-0 grid-cols-1 gap-4 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-5 xl:gap-6 ${
          progress ? 'xl:grid-cols-[380px_minmax(0,1fr)_280px]' : ''
        }`}>
          <aside className="hidden min-h-0 lg:block lg:h-[calc(100dvh-6rem)]" aria-label={coachLabel}>
            <div className="h-full lg:sticky lg:top-20">{coach}</div>
          </aside>

          <motion.section
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex min-h-[calc(100dvh-5.75rem)] min-w-0 flex-col overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-[var(--school-surface,#fcfdff)] shadow-[0_24px_60px_-42px_rgba(15,23,42,0.32)] sm:rounded-[2rem] lg:h-[calc(100dvh-6rem)] lg:min-h-0 xl:rounded-[2.5rem]"
            aria-label={workspaceLabel}
          >
            <header className="flex min-h-[4.5rem] items-center gap-3 border-b border-slate-200/80 px-3 py-3 sm:px-6 sm:py-4">
              <button
                type="button"
                onClick={onBack}
                aria-label={backLabel}
                title={backLabel}
                className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-slate-200 bg-[var(--school-surface,#fcfdff)] text-slate-600 transition-[transform,background-color,border-color,color] hover:border-[var(--school-accent-border)] hover:bg-[var(--school-accent-soft)] hover:text-[var(--school-accent-deep)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--school-accent)] focus-visible:ring-offset-2"
              >
                <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--school-accent-deep)]">
                  {headerIcon ?? <ReaderIcon className="h-3.5 w-3.5" aria-hidden="true" />}
                  <span>{eyebrow}</span>
                  {headerMeta ? <span className="text-slate-500">{headerMeta}</span> : null}
                </p>
                <h1 className="mt-1 line-clamp-2 font-display text-[1.65rem] font-normal leading-[1.05] text-slate-900 sm:text-[2rem]">{title}</h1>
              </div>
              {compactCoach ? <div className="flex-none lg:hidden">{compactCoach}</div> : null}
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          </motion.section>

          {progress ? (
            <aside
              className="min-h-0 px-1 py-3 sm:px-2 lg:col-span-2 lg:py-4 xl:col-span-1 xl:h-[calc(100dvh-6rem)] xl:px-0 xl:py-0"
              aria-label={progressLabel}
            >
              <div className="xl:sticky xl:top-20 xl:max-h-full xl:overflow-y-auto">
                {progress}
              </div>
            </aside>
          ) : null}
        </div>
      </main>
    </div>
  );
}
