"use client";

import type { ReactNode, RefObject } from 'react';
import { PaperPlaneIcon } from '@radix-ui/react-icons';
import { schoolPrimaryActionClass } from '@/components/school/SchoolPrimitives';
import type { SchoolSourceReference } from '@/services/schoolRebuild';

function officialNcertSourceUrl(sourceUrl: string | null | undefined) {
  if (!sourceUrl) return null;

  try {
    const url = new URL(sourceUrl);
    return url.protocol === 'https:'
      && url.hostname === 'ncert.nic.in'
      && url.username === ''
      && url.password === ''
      && url.port === ''
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

function sourceReferenceDetails(sourceReference: SchoolSourceReference | null | undefined) {
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

interface SchoolSupportActivityProps {
  testIdPrefix: 'school-recap' | 'school-masterclass';
  title: string;
  passage: string;
  prompt: string;
  options: string[] | null;
  answer: string;
  inputId: string;
  inputLabel: string;
  submitting: boolean;
  canAnswer: boolean;
  sourceReference?: SchoolSourceReference | null;
  questionRef?: RefObject<HTMLHeadingElement>;
  footer?: ReactNode;
  onAnswerChange: (value: string) => void;
  onSubmit: (value?: string) => void;
}

export function SchoolSupportActivity({
  testIdPrefix,
  title,
  passage,
  prompt,
  options,
  answer,
  inputId,
  inputLabel,
  submitting,
  canAnswer,
  sourceReference,
  questionRef,
  footer,
  onAnswerChange,
  onSubmit,
}: SchoolSupportActivityProps) {
  const sourceDetails = sourceReferenceDetails(sourceReference);

  return (
    <section
      data-testid={`${testIdPrefix}-card`}
      aria-busy={submitting}
      aria-label={title}
      className="px-5 py-7 sm:px-9 sm:py-9"
    >
      {passage ? (
        <section className="border-l-2 border-[var(--school-accent-border)] py-1 pl-5 sm:pl-6">
          <p className="font-mono text-[10px] font-semibold uppercase text-[var(--school-faint)]">Read this</p>
          <p
            data-testid={`${testIdPrefix}-passage`}
            className="mt-3 max-w-[68ch] font-display text-[1.4rem] font-normal leading-[1.45] text-[var(--school-ink)] sm:text-[1.6rem]"
          >
            {passage}
          </p>
        </section>
      ) : null}

      <div className={passage ? 'pt-8' : 'pt-1'}>
        <p className="font-mono text-[10px] font-semibold uppercase text-[var(--school-accent-deep)]">Your turn</p>
        <h1
          ref={questionRef}
          data-testid={`${testIdPrefix}-question`}
          tabIndex={-1}
          aria-live="polite"
          className="mt-2 max-w-[31ch] font-sans text-[1.85rem] font-normal leading-[1.08] text-[var(--school-ink)] outline-none sm:text-[2.35rem]"
        >
          {prompt}
        </h1>

        {sourceDetails ? (
          <details data-testid={`${testIdPrefix}-source-details`} className="mt-7 max-w-xl border-t border-[var(--school-line)]">
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

        {!canAnswer ? (
          <div aria-hidden="true" className="mt-6 max-w-xl space-y-3">
            <div className="h-4 w-full animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none" />
            <div className="h-4 w-4/5 animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none" />
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

      {footer ? <div className="mt-7 border-t border-slate-200 pt-5">{footer}</div> : null}
    </section>
  );
}
