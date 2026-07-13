"use client";

import { useEffect, useRef } from 'react';
import { endSessionEvidenceFor } from '@/lib/sessionStreamPresentation.mjs';

interface EndSessionConfirmModalProps {
  open: boolean;
  type: 'gd' | 'interview';
  round: number;
  maxRounds: number;
  scorableTurns: number;
  minScorableTurns: number;
  coverageCovered?: number;
  coverageRequired?: number;
  integrityFlagCount?: number;
  isClosing?: boolean;
  isBusy?: boolean;
  showCancel?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function EndSessionConfirmModal({
  open,
  type,
  round,
  maxRounds,
  scorableTurns,
  minScorableTurns,
  coverageCovered,
  coverageRequired,
  integrityFlagCount = 0,
  isClosing = false,
  isBusy = false,
  showCancel = true,
  onCancel,
  onConfirm,
}: EndSessionConfirmModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const showCancelRef = useRef(showCancel);
  const isClosingRef = useRef(isClosing);
  onCancelRef.current = onCancel;
  showCancelRef.current = showCancel;
  isClosingRef.current = isClosing;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusPreferredControl = () => {
      const preferred = showCancelRef.current ? cancelRef.current : confirmRef.current;
      if (preferred && !preferred.disabled) {
        preferred.focus();
      } else {
        dialogRef.current?.focus();
      }
    };
    const raf = requestAnimationFrame(focusPreferredControl);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showCancelRef.current && !isClosingRef.current) {
          event.preventDefault();
          onCancelRef.current();
        }
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const activeElement = document.activeElement as HTMLElement | null;
    if (!activeElement || !dialogRef.current.contains(activeElement) || activeElement.matches(':disabled')) {
      const preferred = showCancel ? cancelRef.current : confirmRef.current;
      if (preferred && !preferred.disabled) preferred.focus();
      else dialogRef.current.focus();
    }
  }, [isBusy, isClosing, open, showCancel]);

  if (!open) return null;

  const evidence = endSessionEvidenceFor({
    scorableTurns,
    minScorableTurns,
    coverageCovered,
    coverageRequired,
    integrityFlagCount,
  });
  const testName = type === 'gd' ? 'group discussion' : 'interview';

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/45 backdrop-blur-sm p-4"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${type}-end-session-title`}
        className="w-full max-w-md rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-2xl outline-none"
      >
        <div className="mb-5">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
            End {testName} test
          </p>
          <h2 id={`${type}-end-session-title`} className="mt-2 text-xl font-black tracking-tight text-slate-950">
            End and generate the report?
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            You are at round {Math.min(Math.max(round, 1), maxRounds)}/{maxRounds}, with {scorableTurns}/{minScorableTurns} score-eligible answers.
          </p>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">{evidence.label}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{evidence.copy}</p>
          <dl className="mt-3 space-y-1.5 border-t border-slate-200 pt-3 text-xs text-slate-600">
            <div className="flex items-start justify-between gap-3">
              <dt className="min-w-0 break-words">Score-eligible answers</dt>
              <dd className="shrink-0 font-medium tabular-nums text-slate-900">{scorableTurns}/{minScorableTurns}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="min-w-0 break-words">Evidence coverage</dt>
              <dd className="shrink-0 text-right font-medium tabular-nums text-slate-900">
                {evidence.coverageKnown
                  ? `${coverageCovered} covered / ${coverageRequired} needed`
                  : 'Not yet verified'}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="min-w-0 break-words">Integrity flags</dt>
              <dd className="shrink-0 font-medium tabular-nums text-slate-900">{integrityFlagCount}</dd>
            </div>
          </dl>
          <p className="mt-3 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-500">
            Backend validation decides whether the report is final, partial, or not scored after the session ends.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {showCancel && (
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              disabled={isClosing}
              className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue Test
            </button>
          )}
          <button
              ref={confirmRef}
              type="button"
              onClick={onConfirm}
              disabled={isClosing || isBusy}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
          >
            {isClosing
              ? 'Generating Report...'
              : isBusy
                ? 'Finishing Current Turn...'
                : evidence.actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
