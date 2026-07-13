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
      <section aria-labelledby="school-current-stage">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--school-accent-deep)]">
          Chapter progress
        </p>
        <h2 id="school-current-stage" className="mt-2 font-display text-2xl font-normal leading-tight text-slate-950">
          {currentLevel?.title || 'Chapter challenge'}
        </h2>
        <p className="mt-2 break-words text-sm font-medium leading-5 text-slate-600">
          {activity?.title || assessmentLabel(session)}
        </p>
        <div
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200"
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
        <p className="mt-2 text-xs font-medium text-slate-500">
          {session.progress.completed_levels} of {session.progress.total_levels} stages complete
        </p>
      </section>

      <ol className="mt-6 border-y border-slate-200 py-3">
        {session.levels.map((level, index) => {
          const current = index === session.progress.current_level_index && session.phase !== 'complete';
          const complete = isComplete(level.status);
          return (
            <li
              key={level.level_id}
              aria-current={current ? 'step' : undefined}
              className="flex min-w-0 items-center gap-3 py-2"
            >
              <span
                className={`flex h-7 w-7 flex-none items-center justify-center rounded-md border text-xs font-semibold ${
                  complete
                    ? 'border-teal-700 bg-teal-700 text-white'
                    : current
                      ? 'border-[var(--school-accent)] bg-[var(--school-accent-soft)] text-[var(--school-accent-deep)]'
                      : 'border-slate-300 bg-white text-slate-400'
                }`}
              >
                {complete ? <CheckIcon className="h-4 w-4" aria-hidden="true" /> : index + 1}
              </span>
              <div className="min-w-0">
                <p className={`break-words text-sm font-semibold leading-5 ${current ? 'text-slate-950' : 'text-slate-600'}`}>
                  {level.title}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  {complete ? 'Complete' : current ? 'Now' : 'Coming up'}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <section className="py-5" aria-label="Chapter challenge">
        <div className="flex items-center gap-2 text-[var(--school-accent-deep)]">
          <TargetIcon className="h-4 w-4" aria-hidden="true" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">Chapter challenge</p>
        </div>
        <p className="mt-2 text-sm font-semibold leading-5 text-slate-700">{assessmentLabel(session)}</p>
      </section>

      {memory ? (
        <aside
          data-testid="school-tutor-memory"
          className="border-t border-slate-200 pt-5 text-slate-500"
          aria-label="Learning memory"
        >
          <div className="flex items-center gap-2">
            <BookmarkIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">What I am watching</p>
          </div>
          <p className="mt-2 break-words text-xs leading-5">{memory.recommended_next_action}</p>
        </aside>
      ) : null}
    </div>
  );
}
