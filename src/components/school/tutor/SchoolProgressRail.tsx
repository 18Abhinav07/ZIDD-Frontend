import { BookmarkIcon, CheckIcon, TargetIcon } from '@radix-ui/react-icons';
import type { SchoolCurriculumSession } from '@/services/schoolRebuild';

interface SchoolProgressRailProps {
  session: SchoolCurriculumSession;
}

function isComplete(status: string) {
  return status === 'complete' || status === 'completed' || status === 'passed';
}

function assessmentLabel(session: SchoolCurriculumSession) {
  const assessment = session.chapter_assessment;
  if (!assessment || assessment.status === 'not_started') return 'Starts after the lesson stages';
  if (assessment.status === 'passed') return 'Challenge complete';
  if (assessment.status === 'needs_support') return 'More guided support is ready';
  if (assessment.status === 'remediation') return 'A short revision is in progress';
  return `Question ${assessment.item_number} of ${assessment.total_items}`;
}

export function SchoolProgressRail({ session }: SchoolProgressRailProps) {
  const currentLevel = session.levels[session.progress.current_level_index] ?? null;
  const activity = session.current_activity;
  const memory = session.memory_summary?.active_gaps.find((gap) => gap.recommended_next_action.trim()) ?? null;
  const progressPercent = session.progress.total_levels > 0
    ? Math.round((session.progress.completed_levels / session.progress.total_levels) * 100)
    : 0;

  return (
    <div data-testid="school-tutor-progress" className="min-w-0">
      <section aria-labelledby="school-current-stage" className="grid min-w-0 gap-3 sm:grid-cols-[minmax(150px,auto)_minmax(180px,1fr)_auto] sm:items-center sm:gap-5">
        <div className="min-w-0">
          <p className="font-mono text-[9px] font-semibold uppercase text-[var(--school-accent-deep)]">Lesson progress</p>
          <h2 id="school-current-stage" className="mt-1 truncate text-sm font-semibold text-[var(--school-ink)]">
            {currentLevel?.title || 'Chapter challenge'}
          </h2>
        </div>
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

      <details className="group mt-3 border-t border-[var(--school-line)] pt-3">
        <summary className="-my-1.5 flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-1.5 text-xs font-semibold text-[var(--school-muted)] focus-visible:outline-none">
          <span>{activity?.title || assessmentLabel(session)}</span>
          <span className="font-mono text-[9px] uppercase text-[var(--school-accent-deep)] group-open:hidden">View stages</span>
          <span className="hidden font-mono text-[9px] uppercase text-[var(--school-accent-deep)] group-open:inline">Hide stages</span>
        </summary>
        <div className="mt-3 grid gap-5 border-t border-[var(--school-line)] pt-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <ol className="grid gap-2 sm:grid-cols-2">
            {session.levels.map((level, index) => {
              const current = index === session.progress.current_level_index && session.phase !== 'complete';
              const complete = isComplete(level.status);
              return (
                <li key={level.level_id} aria-current={current ? 'step' : undefined} className="flex min-w-0 items-center gap-2.5">
                  <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-md border text-[10px] font-semibold ${
                    complete
                      ? 'border-[var(--school-green)] bg-[var(--school-green)] text-white'
                      : current
                        ? 'border-[var(--school-accent)] bg-[var(--school-accent-soft)] text-[var(--school-accent-deep)]'
                        : 'border-[var(--school-line-strong)] bg-[var(--school-paper)] text-[var(--school-faint)]'
                  }`}>
                    {complete ? <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
                  </span>
                  <span className={`min-w-0 truncate text-xs font-semibold ${current ? 'text-[var(--school-ink)]' : 'text-[var(--school-muted)]'}`}>
                    {level.title}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="space-y-3 border-t border-[var(--school-line)] pt-3 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <div className="flex gap-2 text-[var(--school-muted)]">
              <TargetIcon className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
              <p className="text-xs font-medium leading-5">{assessmentLabel(session)}</p>
            </div>
            {memory ? (
              <div data-testid="school-tutor-memory" className="flex gap-2 text-[var(--school-muted)]" aria-label="Learning memory">
                <BookmarkIcon className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
                <p className="break-words text-xs leading-5">{memory.recommended_next_action}</p>
              </div>
            ) : null}
          </div>
        </div>
      </details>
    </div>
  );
}
