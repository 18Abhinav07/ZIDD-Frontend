"use client";

import type { ReactNode, RefObject } from 'react';
import { PaperPlaneIcon } from '@radix-ui/react-icons';
import { schoolPrimaryActionClass } from '@/components/school/SchoolPrimitives';

type SupportTone = 'readiness' | 'masterclass';

interface SupportFeedback {
  correct: boolean;
  message: string;
}

interface SchoolSupportActivityProps {
  testIdPrefix: 'school-recap' | 'school-masterclass';
  tone: SupportTone;
  kindLabel: string;
  sourceLabel?: string;
  title: string;
  teachingBlock: string;
  passage: string;
  prompt: string;
  options: string[] | null;
  answer: string;
  inputId: string;
  inputLabel: string;
  submitting: boolean;
  canAnswer: boolean;
  feedback?: SupportFeedback | null;
  error?: string;
  questionRef?: RefObject<HTMLHeadingElement>;
  footer?: ReactNode;
  onAnswerChange: (value: string) => void;
  onSubmit: (value?: string) => void;
}

export function SchoolSupportActivity({
  testIdPrefix,
  tone,
  kindLabel,
  sourceLabel,
  title,
  teachingBlock,
  passage,
  prompt,
  options,
  answer,
  inputId,
  inputLabel,
  submitting,
  canAnswer,
  feedback,
  error,
  questionRef,
  footer,
  onAnswerChange,
  onSubmit,
}: SchoolSupportActivityProps) {
  const isFocusedSupport = tone === 'masterclass';

  return (
    <section
      data-testid={`${testIdPrefix}-card`}
      aria-busy={submitting}
      aria-label={title}
      className="px-5 py-7 sm:px-9 sm:py-9"
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] font-semibold uppercase text-[var(--school-accent-deep)]">
        <span data-testid={`${testIdPrefix}-kind`}>{kindLabel}</span>
        {sourceLabel ? (
          <>
            <span aria-hidden="true" className="text-slate-300">/</span>
            <span className="text-slate-500">{sourceLabel}</span>
          </>
        ) : null}
      </p>

      <section
        data-testid={`${testIdPrefix}-teaching`}
        className="mt-6 border-l-2 border-[var(--school-accent-border)] bg-[var(--school-accent-soft)] px-5 py-4 text-sm font-medium leading-6 text-[var(--school-muted)]"
      >
        <p className="font-mono text-[10px] font-semibold uppercase text-[var(--school-accent-deep)]">Coach clue</p>
        <p className="mt-2">{teachingBlock}</p>
      </section>

      <section className="mt-7 border-l-2 border-[var(--school-accent-border)] py-1 pl-5 sm:pl-6">
        <p className="font-mono text-[10px] font-semibold uppercase text-[var(--school-faint)]">Read this</p>
        <p
          data-testid={`${testIdPrefix}-passage`}
          className="mt-3 max-w-[68ch] font-display text-[1.4rem] font-normal leading-[1.45] text-[var(--school-ink)] sm:text-[1.6rem]"
        >
          {passage}
        </p>
      </section>

      <div className="pt-8">
        <p className="font-mono text-[10px] font-semibold uppercase text-[var(--school-accent-deep)]">Your turn</p>
        <h2
          ref={questionRef}
          data-testid={`${testIdPrefix}-question`}
          tabIndex={-1}
          aria-live="polite"
          className="mt-2 max-w-[31ch] font-sans text-[1.85rem] font-bold leading-[1.08] text-[var(--school-ink)] outline-none sm:text-[2.35rem]"
        >
          {prompt}
        </h2>

        {!canAnswer ? (
          <div role="status" className="mt-5 border-y border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            Your coach is getting the next step ready.
          </div>
        ) : options?.length ? (
          <div className="mt-5">
            <fieldset disabled={submitting}>
              <legend className="sr-only">Choose one answer</legend>
              <div className="grid gap-2.5">
                {options.map((option, index) => (
                  <label
                    key={`${index}-${option}`}
                    className={`flex min-h-14 min-w-0 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold text-[var(--school-ink)] transition-colors ${
                      answer === option
                        ? 'border-[var(--school-accent)] bg-[var(--school-accent-soft)]'
                        : 'border-[var(--school-line-strong)] bg-[var(--school-paper)] hover:border-[var(--school-accent)] hover:bg-[var(--school-accent-soft)]'
                    } has-[:disabled]:cursor-wait has-[:disabled]:opacity-55`}
                  >
                    <input
                      type="radio"
                      name={`${inputId}-choice`}
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
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <label htmlFor={inputId} className="sr-only">{inputLabel}</label>
              <input
                id={inputId}
                value={answer}
                onChange={(event) => onAnswerChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onSubmit();
                }}
                placeholder="Write your answer"
                disabled={submitting}
                className="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-base font-normal text-slate-900 outline-none transition focus:border-[var(--school-accent)] focus:ring-4 focus:ring-[var(--school-accent-soft)] disabled:cursor-wait disabled:bg-slate-50"
              />
            </div>
            <button
              type="button"
              onClick={() => onSubmit()}
              disabled={submitting || !answer.trim()}
              className={schoolPrimaryActionClass}
            >
              <PaperPlaneIcon className="h-4 w-4" aria-hidden="true" />
              {submitting ? 'Checking your answer' : 'Check my answer'}
            </button>
          </div>
        )}
      </div>

      {feedback ? (
        <p
          data-testid={`${testIdPrefix}-feedback`}
          role="status"
          aria-live="polite"
          className={`mt-6 border-y px-4 py-3 text-sm font-semibold ${
            feedback.correct
              ? 'border-teal-200 bg-teal-50 text-teal-900'
              : 'border-orange-200 bg-orange-50 text-orange-950'
          }`}
        >
          {feedback.message}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-6 border-y border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900">
          {error}
        </p>
      ) : null}

      {isFocusedSupport ? (
        <p className="mt-5 text-xs leading-5 text-[var(--school-accent-deep)]">
          Your chapter position stays saved until you finish or explicitly return.
        </p>
      ) : null}

      {footer ? <div className="mt-7 border-t border-slate-200 pt-5">{footer}</div> : null}
    </section>
  );
}
