"use client";

import { useEffect, useRef } from 'react';
import {
  ArrowLeftIcon,
  CheckCircledIcon,
  PaperPlaneIcon,
  PlayIcon,
  ReloadIcon,
} from '@radix-ui/react-icons';
import {
  schoolPrimaryActionClass,
  schoolSecondaryActionClass,
} from '@/components/school/SchoolPrimitives';
import type { CurriculumActivityView } from '@/lib/schoolActivityPolicy';
import type { SchoolCurriculumSession } from '@/services/schoolRebuild';

type SchoolActivity = NonNullable<SchoolCurriculumSession['current_activity']>;
type SchoolFeedback = NonNullable<SchoolCurriculumSession['last_feedback']>;

interface SchoolActivityRendererProps {
  session: SchoolCurriculumSession;
  view: CurriculumActivityView;
  answer: string;
  submitting: boolean;
  openingMasterclass: boolean;
  error: string;
  onAnswerChange: (answer: string) => void;
  onSubmit: (answer?: string) => void;
  onOpenMasterclass?: () => void;
  onExit: () => void;
  onRetry: () => void;
}

export function schoolActivityLabel(kind: SchoolActivity['kind']) {
  switch (kind) {
    case 'guided_check':
      return 'Practise together';
    case 'bridge':
      return 'Connect the idea';
    case 'masterclass':
      return 'Focused practice';
    case 'revision_level_1':
    case 'revision_level_2':
    case 'revision_level_3':
      return 'Try it another way';
    case 'independent_check':
      return 'Try it yourself';
    case 'transfer_check':
      return 'Use it somewhere new';
    case 'chapter_check':
      return 'Chapter challenge';
  }
}

function Feedback({ feedback, className = '' }: { feedback: SchoolFeedback; className?: string }) {
  const tone = feedback.result_visible === false || feedback.correct === null
    ? 'border-slate-200 bg-slate-50 text-slate-700'
    : feedback.correct
      ? 'border-teal-200 bg-teal-50 text-teal-900'
      : 'border-orange-200 bg-orange-50 text-orange-950';

  return (
    <p
      data-testid="school-tutor-feedback"
      role="status"
      aria-live="polite"
      className={`border-y px-5 py-4 text-sm font-semibold leading-6 sm:px-8 ${tone} ${className}`}
    >
      {feedback.message}
    </p>
  );
}

function PendingEvaluation({ pendingLabel }: { pendingLabel: string }) {
  return (
    <section role="status" aria-live="polite" className="px-5 py-9 sm:px-8 sm:py-12">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-700">Answer submitted</p>
      <h2 className="mt-2 font-display text-3xl font-normal text-slate-950">{pendingLabel}</h2>
      <div data-testid="school-tutor-message-skeleton" aria-hidden="true" className="mt-7 max-w-xl space-y-3">
        <div className="h-4 w-full animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none" />
        <div className="h-4 w-5/6 animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none" />
        <div className="h-4 w-2/3 animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none" />
      </div>
    </section>
  );
}

function ActivityCard({
  activity,
  feedback,
  answer,
  submitting,
  canSubmit,
  onAnswerChange,
  onSubmit,
}: {
  activity: SchoolActivity;
  feedback: SchoolFeedback | null;
  answer: string;
  submitting: boolean;
  canSubmit: boolean;
  onAnswerChange: (answer: string) => void;
  onSubmit: (answer?: string) => void;
}) {
  const questionHeadingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => questionHeadingRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [activity.activity_id]);

  return (
    <article data-testid="school-tutor-activity" className="flex min-h-full flex-col">
      <div className="px-5 pb-7 pt-6 sm:px-8 sm:pb-9 sm:pt-8">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--school-accent-deep)]">
          <span>{schoolActivityLabel(activity.kind)}</span>
          <span aria-hidden="true" className="text-slate-300">/</span>
          <span className="break-words text-slate-500">{activity.focus}</span>
        </p>

        {activity.teaching_block ? (
          <section data-testid="school-tutor-teaching" className="mt-6 border-y border-[var(--school-accent-border)] bg-[var(--school-accent-soft)] px-4 py-4 text-sm font-medium leading-6 text-slate-700 sm:px-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--school-accent-deep)]">
              {activity.kind === 'chapter_check' ? 'Instructions' : 'Coach clue'}
            </p>
            <p className="mt-2">{activity.teaching_block}</p>
          </section>
        ) : null}

        {activity.passage ? (
          <section className="mt-6 border-b border-slate-200 pb-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Read</p>
            <p data-testid="school-tutor-passage" className="mt-3 whitespace-pre-wrap break-words text-base font-medium leading-7 text-slate-800">
              {activity.passage}
            </p>
          </section>
        ) : null}

        <section className="pt-6" aria-labelledby="school-tutor-question">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--school-accent-deep)]">Think and answer</p>
          <h2
            id="school-tutor-question"
            ref={questionHeadingRef}
            tabIndex={-1}
            data-testid="school-tutor-question"
            className="mt-2 max-w-[34ch] break-words font-display text-[2rem] font-normal leading-[1.08] text-slate-950 outline-none sm:text-[2.4rem]"
          >
            {activity.prompt}
          </h2>
          {activity.kind === 'chapter_check' ? (
            <p className="mt-3 text-xs font-semibold text-[var(--school-accent-deep)]">Answer this chapter challenge in your own words.</p>
          ) : null}
        </section>
      </div>

      {canSubmit && activity.options?.length ? (
        <div className="mt-auto border-t border-slate-200 px-4 py-5 sm:px-6 sm:py-6">
          <div className="grid gap-2 sm:grid-cols-2">
            {activity.options.map((option, index) => (
              <button
                key={`${index}-${option}`}
                type="button"
                onClick={() => onSubmit(option)}
                disabled={submitting}
                className="group flex min-h-14 min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 transition-colors hover:border-[var(--school-accent)] hover:bg-[var(--school-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--school-accent)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
              >
                <span aria-hidden="true" className="flex h-7 w-7 flex-none items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="min-w-0 break-words">{option}</span>
              </button>
            ))}
          </div>
          {submitting ? <p role="status" className="mt-3 text-xs font-semibold text-slate-500">Checking your answer</p> : null}
        </div>
      ) : canSubmit ? (
        <div className="mt-auto border-t border-slate-200 px-4 py-5 sm:px-6 sm:py-6">
          <label htmlFor="school-tutor-answer" className="mb-2 block text-xs font-semibold text-slate-600">Your answer</label>
          <div className={activity.response_mode === 'paragraph' ? 'flex flex-col gap-3' : 'flex flex-col gap-3 sm:flex-row'}>
            {activity.response_mode === 'paragraph' ? (
              <textarea
                id="school-tutor-answer"
                value={answer}
                onChange={(event) => onAnswerChange(event.target.value)}
                disabled={submitting}
                maxLength={800}
                rows={7}
                placeholder="Write your answer"
                className="min-h-44 w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-base font-normal leading-7 text-slate-900 outline-none focus:border-[var(--school-accent)] focus:ring-4 focus:ring-[var(--school-accent-soft)] disabled:bg-slate-100"
              />
            ) : (
              <input
                id="school-tutor-answer"
                value={answer}
                onChange={(event) => onAnswerChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !submitting) onSubmit();
                }}
                disabled={submitting}
                placeholder="Type your answer"
                className="min-h-12 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-base font-normal text-slate-900 outline-none focus:border-[var(--school-accent)] focus:ring-4 focus:ring-[var(--school-accent-soft)] disabled:bg-slate-100"
              />
            )}
            <button
              type="button"
              onClick={() => onSubmit()}
              disabled={submitting || !answer.trim()}
              className={`${schoolPrimaryActionClass} flex-none`}
            >
              <PaperPlaneIcon className="h-4 w-4" aria-hidden="true" />
              {submitting ? 'Checking your answer' : 'Check answer'}
            </button>
          </div>
        </div>
      ) : (
        <p role="status" className="mt-auto border-t border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold leading-6 text-slate-700 sm:px-8">
          Your next question is being prepared. Refresh this lesson if it does not appear.
        </p>
      )}

      {feedback ? <Feedback feedback={feedback} className="mt-5" /> : null}
    </article>
  );
}

export function SchoolActivityRenderer({
  session,
  view,
  answer,
  submitting,
  openingMasterclass,
  error,
  onAnswerChange,
  onSubmit,
  onOpenMasterclass,
  onExit,
  onRetry,
}: SchoolActivityRendererProps) {
  const activity = session.current_activity;
  const priorFeedback = session.last_feedback && activity && session.last_feedback.activity_id !== activity.activity_id
    ? session.last_feedback
    : null;
  const currentFeedback = session.last_feedback && activity && session.last_feedback.activity_id === activity.activity_id
    ? session.last_feedback
    : null;

  return (
    <div className="flex min-h-full flex-col">
      {priorFeedback ? <Feedback feedback={priorFeedback} /> : null}

      {session.phase === 'paused_for_masterclass' && session.active_interrupt ? (
        <section data-testid="school-tutor-masterclass-handoff" className="px-5 py-9 sm:px-8 sm:py-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-700">Focused practice</p>
          <h2 className="mt-3 max-w-xl break-words font-display text-3xl font-normal leading-tight text-slate-950 sm:text-4xl">
            Pause here and strengthen {session.active_interrupt.focus}
          </h2>
          <p className="mt-4 max-w-2xl border-y border-orange-200 bg-orange-50 px-4 py-4 text-sm font-medium leading-6 text-slate-700">
            Your exact place in {session.chapter.title} is saved. Finish this short practice, then return to the same stage.
          </p>
          {onOpenMasterclass ? (
            <button
              type="button"
              onClick={onOpenMasterclass}
              disabled={openingMasterclass}
              className={`mt-8 ${schoolPrimaryActionClass}`}
            >
              <PlayIcon className="h-4 w-4" aria-hidden="true" />
              {openingMasterclass ? 'Opening focused practice' : 'Start focused practice'}
            </button>
          ) : null}
        </section>
      ) : view.kind === 'pending' ? (
        <PendingEvaluation pendingLabel="Checking your answer" />
      ) : view.kind === 'support' ? (
        <section role="status" className="px-5 py-9 sm:px-8 sm:py-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-700">More support is ready</p>
          <h2 className="mt-3 max-w-xl font-display text-3xl font-normal leading-tight text-slate-950 sm:text-4xl">This chapter is paused for a revised path</h2>
          <p className="mt-4 max-w-2xl border-y border-orange-200 bg-orange-50 px-4 py-4 text-sm leading-6 text-slate-700">
            Your answers and chapter place are saved. Return to the chapter map to continue with the support selected for you.
          </p>
          {session.chapter_assessment?.last_result ? (
            <p className="mt-5 text-sm font-semibold text-slate-700">Latest chapter challenge: {Math.round(session.chapter_assessment.last_result.score * 100)}%</p>
          ) : null}
          <button type="button" onClick={onExit} className={`mt-8 ${schoolPrimaryActionClass}`}>
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" /> Return to chapter map
          </button>
        </section>
      ) : view.kind === 'activity' && activity ? (
        <ActivityCard
          activity={activity}
          feedback={currentFeedback}
          answer={answer}
          submitting={submitting}
          canSubmit={view.canSubmit}
          onAnswerChange={onAnswerChange}
          onSubmit={onSubmit}
        />
      ) : view.kind === 'complete' ? (
        <section role="status" aria-live="polite" className="px-5 py-9 sm:px-8 sm:py-12">
          <CheckCircledIcon className="h-9 w-9 text-teal-700" aria-hidden="true" />
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-700">Chapter complete</p>
          <h2 className="mt-2 max-w-xl font-display text-4xl font-normal leading-tight text-slate-950">Your chapter map is ready</h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">Your progress is saved. Return to the map to review this chapter or choose what comes next.</p>
          <button type="button" onClick={onExit} className={`mt-8 ${schoolPrimaryActionClass}`}>
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" /> Return to chapter map
          </button>
        </section>
      ) : (
        <section role="alert" className="px-5 py-9 sm:px-8 sm:py-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-red-700">Lesson unavailable</p>
          <h2 className="mt-2 font-display text-3xl font-normal text-slate-950">We could not find the next lesson step</h2>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={onRetry} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-800 px-5 py-2.5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2">
              <ReloadIcon className="h-4 w-4" aria-hidden="true" /> Refresh lesson
            </button>
            <button type="button" onClick={onExit} className={schoolSecondaryActionClass}>
              <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" /> Return to chapter map
            </button>
          </div>
        </section>
      )}

      {error ? <p role="alert" className="mt-auto border-t border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-800 sm:px-8">{error}</p> : null}
    </div>
  );
}
