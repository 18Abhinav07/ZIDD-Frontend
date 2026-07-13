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
      className="px-5 py-6 sm:px-8 sm:py-9"
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--school-accent-deep)]">
        <span data-testid={`${testIdPrefix}-kind`}>{kindLabel}</span>
        {sourceLabel ? (
          <>
            <span aria-hidden="true" className="text-slate-300">/</span>
            <span className="text-slate-500">{sourceLabel}</span>
          </>
        ) : null}
      </p>

      <h2 className="mt-3 font-display text-2xl font-normal leading-tight text-slate-950 sm:text-3xl">{title}</h2>

      <section
        data-testid={`${testIdPrefix}-teaching`}
        className="mt-5 border-y border-[var(--school-accent-border)] bg-[var(--school-accent-soft)] px-4 py-4 text-sm font-medium leading-6 text-slate-800 sm:px-5"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--school-accent-deep)]">Coach clue</p>
        <p className="mt-2">{teachingBlock}</p>
      </section>

      <section className="mt-6 border-b border-slate-200 pb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Read this</p>
        <p
          data-testid={`${testIdPrefix}-passage`}
          className="mt-3 max-w-[68ch] text-base font-normal leading-7 text-slate-800"
        >
          {passage}
        </p>
      </section>

      <div className="pt-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--school-accent-deep)]">Your turn</p>
        <h3
          ref={questionRef}
          data-testid={`${testIdPrefix}-question`}
          tabIndex={-1}
          aria-live="polite"
          className="mt-2 max-w-[34ch] font-display text-[2rem] font-normal leading-[1.08] text-slate-950 outline-none sm:text-[2.4rem]"
        >
          {prompt}
        </h3>

        {!canAnswer ? (
          <div role="status" className="mt-5 border-y border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            Your coach is getting the next step ready.
          </div>
        ) : options?.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {options.map((option, index) => (
              <button
                key={`${index}-${option}`}
                type="button"
                onClick={() => onSubmit(option)}
                disabled={submitting}
                className="flex min-h-14 min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 transition-colors hover:border-[var(--school-accent)] hover:bg-[var(--school-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--school-accent)] focus-visible:ring-offset-2 active:translate-y-px disabled:cursor-wait disabled:opacity-55"
              >
                <span aria-hidden="true" className="flex h-7 w-7 flex-none items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="min-w-0 break-words">{option}</span>
              </button>
            ))}
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
              {submitting ? 'Checking answer' : 'Submit'}
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
