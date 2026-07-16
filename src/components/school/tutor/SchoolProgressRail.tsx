import type { SchoolCurriculumSession } from '@/services/schoolRebuild';

interface SchoolProgressRailProps {
  session: SchoolCurriculumSession;
}

export function SchoolProgressRail({ session }: SchoolProgressRailProps) {
  const currentLevel = session.levels[session.progress.current_level_index] ?? null;
  const progressPercent = session.progress.total_levels > 0
    ? Math.round((session.progress.completed_levels / session.progress.total_levels) * 100)
    : 0;

  return (
    <section
      data-testid="school-tutor-progress"
      className="grid min-w-0 grid-cols-[auto_minmax(36px,1fr)_auto] items-center gap-2 sm:gap-5"
      aria-label={`Lesson progress. Current stage: ${currentLevel?.title || 'Chapter challenge'}`}
    >
      <p className="whitespace-nowrap font-mono text-[10px] font-semibold uppercase text-[var(--school-muted)]">
        Lesson progress
      </p>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-[#dedfdc]"
        role="progressbar"
        aria-label="Completed lesson stages"
        aria-valuemin={0}
        aria-valuemax={session.progress.total_levels}
        aria-valuenow={session.progress.completed_levels}
      >
        <span
          className="block h-full rounded-full bg-[var(--school-accent)] transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <p className="whitespace-nowrap font-mono text-[10px] font-semibold text-[var(--school-faint)]">
        {String(session.progress.completed_levels).padStart(2, '0')} / {String(session.progress.total_levels).padStart(2, '0')}
      </p>
    </section>
  );
}
