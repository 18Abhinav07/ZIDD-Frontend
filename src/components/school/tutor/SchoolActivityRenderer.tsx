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
type SchoolSourceReference = NonNullable<SchoolActivity['source_reference']>;

const TEACHING_STEP_ACKNOWLEDGEMENT = 'continue';
const CONTINUE_PROMPT_CLASS = 'mt-3 w-full max-w-none break-words rounded-lg border border-[var(--school-line)] bg-[var(--school-surface-soft)] px-5 py-5 font-sans text-lg font-normal leading-8 text-[var(--school-ink)] outline-none sm:px-6 sm:py-6 sm:text-xl';
const QUESTION_PROMPT_CLASS = 'mt-2 max-w-[31ch] break-words font-sans text-[1.85rem] font-normal leading-[1.08] text-[var(--school-ink)] outline-none sm:text-[2.35rem]';

function officialNcertSourceUrl(sourceUrl: string | null | undefined) {
  if (!sourceUrl) return null;

  try {
    const url = new URL(sourceUrl);
    return url.protocol === 'https:' && url.hostname === 'ncert.nic.in'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function sourceAnchorLabel(anchor: NonNullable<SchoolSourceReference['anchors']>[number]) {
  const sectionLabel = anchor.section_label?.trim();
  const pageStart = Number.isInteger(anchor.page_start) && anchor.page_start! > 0
    ? anchor.page_start
    : null;
  const pageEnd = pageStart && Number.isInteger(anchor.page_end) && anchor.page_end! >= pageStart
    ? anchor.page_end
    : null;
  const pageLabel = pageStart
    ? pageEnd && pageEnd !== pageStart
      ? `pp. ${pageStart}-${pageEnd}`
      : `p. ${pageStart}`
    : null;

  return [sectionLabel, pageLabel].filter(Boolean).join(' - ') || null;
}

function sourceReferenceDetails(sourceReference: SchoolActivity['source_reference']) {
  if (!sourceReference?.anchors?.length) return null;

  const anchors = sourceReference.anchors.flatMap((anchor) => {
    const sourceUrl = officialNcertSourceUrl(anchor.source_url);
    const label = sourceAnchorLabel(anchor);
    return sourceUrl && label ? [{ label, sourceUrl }] : [];
  });

  return anchors.length ? {
    bookTitle: sourceReference.book_title?.trim() || null,
    chapterTitle: sourceReference.chapter_title?.trim() || null,
    anchors,
  } : null;
}

interface SchoolActivityRendererProps {
  session: SchoolCurriculumSession;
  view: CurriculumActivityView;
  answer: string;
  submitting: boolean;
  openingMasterclass: boolean;
  resumingMasterclass: boolean;
  onAnswerChange: (answer: string) => void;
  onSubmit: (answer?: string) => void;
  onOpenMasterclass?: () => void;
  onResumeMasterclass?: () => void;
  onExit: () => void;
  onRetry: () => void;
}

export function schoolActivityLabel(kind: SchoolActivity['kind']) {
  switch (kind) {
    case 'guided_check':
    case 'v2_guided_practice':
      return 'Practise together';
    case 'bridge':
    case 'v2_connect':
      return 'Connect the idea';
    case 'v2_co_construct':
      return 'Build it together';
    case 'masterclass':
      return 'Focused practice';
    case 'revision_level_1':
    case 'revision_level_2':
    case 'revision_level_3':
      return 'Try it another way';
    case 'independent_check':
      return 'Try it yourself';
    case 'v2_independent_application':
      return 'Apply it yourself';
    case 'transfer_check':
    case 'v2_transfer':
      return 'Use it somewhere new';
    case 'v2_review':
      return 'Review and strengthen';
    case 'v2_support':
      return 'Get extra support';
    case 'chapter_check':
      return 'Chapter challenge';
  }
}

function chapterCheckInstruction(activity: SchoolActivity): string | null {
  if (activity.kind !== 'chapter_check') return null;

  switch (activity.interaction_type) {
    case 'single_choice':
    case 'multi_select':
    case 'classification':
      return 'Choose the answer that fits best.';
    case 'ordering':
      return 'Put the items in the requested order.';
    case 'matching':
      return 'Match each item with the best partner.';
    case 'cloze':
    case 'sentence_completion':
      return 'Complete the sentence with the best answer.';
    case 'paragraph_text':
    case 'summary':
    case 'reflection':
    case 'creative_continuation':
    case 'dialogue':
      return 'Use your own words and include the detail the question asks for.';
    case 'short_text':
    case 'evidence_text':
      return 'Write a complete answer to the question.';
    default:
      return activity.options?.length ? 'Choose the answer that fits best.' : null;
  }
}

function PendingEvaluation({ onExit }: { onExit: () => void }) {
  return (
    <section role="status" aria-live="polite" className="px-5 py-9 sm:px-8 sm:py-12">
      <div className="max-w-xl">
        <h1 className="font-sans text-3xl font-bold leading-tight text-slate-950 sm:text-4xl">Your answer is saved</h1>
        <p className="mt-4 text-base font-normal leading-7 text-slate-700">
          Your place in this chapter is saved, and feedback will appear here.
        </p>
        <div aria-hidden="true" data-testid="school-tutor-message-skeleton" className="mt-8 space-y-4">
          <div className="h-7 w-2/3 rounded-lg bg-slate-100 motion-safe:animate-pulse motion-reduce:animate-none" />
          <div className="h-4 w-full rounded-full bg-slate-200 motion-safe:animate-pulse motion-reduce:animate-none" />
          <div className="h-4 w-5/6 rounded-full bg-slate-200 motion-safe:animate-pulse motion-reduce:animate-none" />
          <div className="h-4 w-2/3 rounded-full bg-slate-200 motion-safe:animate-pulse motion-reduce:animate-none" />
        </div>
        <button type="button" onClick={onExit} className={`mt-8 ${schoolSecondaryActionClass}`}>
          <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" /> Return to chapter map
        </button>
      </div>
    </section>
  );
}

function ActivityCard({
  activity,
  answer,
  submitting,
  canSubmit,
  onAnswerChange,
  onSubmit,
}: {
  activity: SchoolActivity;
  answer: string;
  submitting: boolean;
  canSubmit: boolean;
  onAnswerChange: (answer: string) => void;
  onSubmit: (answer?: string) => void;
}) {
  const questionHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const isContinueOnlyActivity = activity.interaction_type === 'continue';
  const sourceDetails = sourceReferenceDetails(activity.source_reference);
  const chapterInstruction = chapterCheckInstruction(activity);

  useEffect(() => {
    const frame = requestAnimationFrame(() => questionHeadingRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [activity.activity_id]);

  return (
    <article data-testid="school-tutor-activity" className="flex min-h-full flex-col">
      <div className="px-5 pb-8 pt-7 sm:px-9 sm:pb-10 sm:pt-9">
        {activity.passage ? (
          <section className="border-l-2 border-[var(--school-accent-border)] py-1 pl-5 sm:pl-6">
            <p className="font-mono text-[10px] font-semibold uppercase text-[var(--school-faint)]">Read the passage</p>
            <p data-testid="school-tutor-passage" className="mt-3 whitespace-pre-wrap break-words font-display text-[1.45rem] font-normal leading-[1.45] text-[var(--school-ink)] sm:text-[1.65rem]">
              {activity.passage}
            </p>
          </section>
        ) : null}

        <section className={activity.passage ? 'pt-8' : 'pt-1'} aria-labelledby="school-tutor-question">
          <p className="font-mono text-[10px] font-semibold uppercase text-[var(--school-accent-deep)]">
            {isContinueOnlyActivity ? 'Learn and continue' : 'Think and answer'}
          </p>
          <h1
            id="school-tutor-question"
            ref={questionHeadingRef}
            tabIndex={-1}
            data-testid="school-tutor-question"
            className={isContinueOnlyActivity ? CONTINUE_PROMPT_CLASS : QUESTION_PROMPT_CLASS}
          >
            {activity.prompt}
          </h1>
          {chapterInstruction ? (
            <p className="mt-3 text-xs font-semibold text-[var(--school-accent-deep)]">{chapterInstruction}</p>
          ) : null}
          {sourceDetails ? (
            <details data-testid="school-tutor-source-details" className="mt-7 max-w-xl border-t border-[var(--school-line)]">
              <summary className="cursor-pointer py-3 text-sm font-semibold text-[var(--school-accent-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--school-accent)] focus-visible:ring-offset-2">
                NCERT source details
              </summary>
              <div className="space-y-3 pb-1 text-sm leading-6 text-[var(--school-muted)]">
                {sourceDetails.bookTitle ? <p><span className="font-semibold text-[var(--school-ink)]">Book</span>: {sourceDetails.bookTitle}</p> : null}
                {sourceDetails.chapterTitle ? <p><span className="font-semibold text-[var(--school-ink)]">Chapter</span>: {sourceDetails.chapterTitle}</p> : null}
                <ul className="space-y-2">
                  {sourceDetails.anchors.map((anchor) => (
                    <li key={`${anchor.sourceUrl}-${anchor.label}`}>
                      <a
                        href={anchor.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[var(--school-accent-deep)] underline decoration-[var(--school-accent-border)] underline-offset-4 hover:text-[var(--school-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--school-accent)] focus-visible:ring-offset-2"
                      >
                        {anchor.label}<span className="sr-only"> on the NCERT website</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          ) : null}
        </section>
      </div>

      {isContinueOnlyActivity ? (
        <div className="mt-auto border-t border-slate-200 px-4 py-5 sm:px-6 sm:py-6">
          <button
            type="button"
            onClick={() => onSubmit(TEACHING_STEP_ACKNOWLEDGEMENT)}
            disabled={submitting || !canSubmit}
            className={`${schoolPrimaryActionClass} w-full sm:w-auto`}
          >
            <PlayIcon className="h-4 w-4" aria-hidden="true" />
            <span>{submitting ? 'Saving your progress' : 'Continue'}</span>
          </button>
        </div>
      ) : canSubmit && activity.options?.length ? (
        <div className="mt-auto border-t border-slate-200 px-4 py-5 sm:px-6 sm:py-6">
          <fieldset disabled={submitting}>
            <legend className="sr-only">Choose one answer</legend>
            <div className="grid gap-2.5">
              {activity.options.map((option, index) => (
                <label
                  key={`${index}-${option}`}
                  className={`group flex min-h-14 min-w-0 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold text-[var(--school-ink)] transition-colors ${
                    answer === option
                      ? 'border-[var(--school-accent)] bg-[var(--school-accent-soft)]'
                      : 'border-[var(--school-line-strong)] bg-[var(--school-paper)] hover:border-[var(--school-accent)] hover:bg-[var(--school-accent-soft)]'
                  } has-[:disabled]:cursor-wait has-[:disabled]:opacity-60`}
                >
                  <input
                    type="radio"
                    name={`school-tutor-choice-${activity.activity_id}`}
                    value={option}
                    checked={answer === option}
                    onChange={() => onAnswerChange(option)}
                    disabled={submitting}
                    className="h-5 w-5 flex-none accent-[var(--school-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--school-accent)] focus-visible:ring-offset-2"
                  />
                  <span aria-hidden="true" className="flex h-7 w-7 flex-none items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="min-w-0 break-words">{option}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button
            type="button"
            onClick={() => onSubmit()}
            disabled={submitting || !answer.trim()}
            className={`${schoolPrimaryActionClass} mt-4 w-full sm:w-auto`}
          >
            <PaperPlaneIcon className="h-4 w-4" aria-hidden="true" />
            {submitting ? 'Checking your answer' : 'Check my answer'}
          </button>
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
              {submitting ? 'Checking your answer' : 'Check my answer'}
            </button>
          </div>
        </div>
      ) : (
        <p role="status" className="mt-auto border-t border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold leading-6 text-slate-700 sm:px-8">
          Your next question is being prepared. Refresh this lesson if it does not appear.
        </p>
      )}
    </article>
  );
}

export function SchoolActivityRenderer({
  session,
  view,
  answer,
  submitting,
  openingMasterclass,
  resumingMasterclass,
  onAnswerChange,
  onSubmit,
  onOpenMasterclass,
  onResumeMasterclass,
  onExit,
  onRetry,
}: SchoolActivityRendererProps) {
  const activity = session.current_activity;

  return (
    <div className="flex min-h-full flex-col">
      {session.phase === 'paused_for_masterclass' && session.active_interrupt ? (
        <section data-testid="school-tutor-masterclass-handoff" className="px-5 py-9 sm:px-8 sm:py-12">
          <h1 className="max-w-xl break-words font-sans text-3xl font-bold leading-tight text-slate-950 sm:text-4xl">
            {onResumeMasterclass ? 'Return to your chapter' : 'Focused practice is ready'}
          </h1>
          {onResumeMasterclass ? (
            <button
              type="button"
              onClick={onResumeMasterclass}
              disabled={resumingMasterclass}
              className={`mt-8 ${schoolPrimaryActionClass}`}
            >
              <PlayIcon className="h-4 w-4" aria-hidden="true" />
              {resumingMasterclass ? 'Returning to chapter' : 'Return to chapter'}
            </button>
          ) : onOpenMasterclass ? (
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
        <PendingEvaluation onExit={onExit} />
      ) : view.kind === 'support' ? (
        <section role="status" className="px-5 py-9 sm:px-8 sm:py-12">
          <h1 className="max-w-xl font-sans text-3xl font-bold leading-tight text-slate-950 sm:text-4xl">Continue from your chapter path</h1>
          <button type="button" onClick={onExit} className={`mt-8 ${schoolPrimaryActionClass}`}>
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" /> Return to chapter map
          </button>
        </section>
      ) : view.kind === 'activity' && activity ? (
        <ActivityCard
          activity={activity}
          answer={answer}
          submitting={submitting}
          canSubmit={view.canSubmit}
          onAnswerChange={onAnswerChange}
          onSubmit={onSubmit}
        />
      ) : view.kind === 'complete' ? (
        <section role="status" aria-live="polite" className="px-5 py-9 sm:px-8 sm:py-12">
          <CheckCircledIcon className="h-9 w-9 text-teal-700" aria-hidden="true" />
          <h1 className="mt-5 max-w-xl font-sans text-4xl font-bold leading-tight text-slate-950">Your chapter map is ready</h1>
          <button type="button" onClick={onExit} className={`mt-8 ${schoolPrimaryActionClass}`}>
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" /> Return to chapter map
          </button>
        </section>
      ) : (
        <section role="alert" className="px-5 py-9 sm:px-8 sm:py-12">
          <h1 className="font-sans text-3xl font-bold text-slate-950">We could not find the next lesson step</h1>
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

    </div>
  );
}
