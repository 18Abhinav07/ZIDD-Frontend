"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SessionRecapFrame } from '@/types';
import { Target, CheckCircle2, TrendingDown } from 'lucide-react';
import { labelSkillId } from '@/lib/skillLabels';

interface SessionRecapProps {
  recap: SessionRecapFrame;
  onClose?: () => void;
  onPractice?: () => void;
  practiceDisabled?: boolean;
  title?: string;
  returnLabel?: string;
}

export function SessionRecap({
  recap,
  onClose,
  onPractice,
  practiceDisabled = false,
  title = 'Session Recap',
  returnLabel = 'Return to Path',
}: SessionRecapProps) {
  const metric = recap.score_metric;
  const score = metric === 'readiness'
    ? recap.readiness_score
    : metric === 'mastery'
      ? recap.mastery_score
      : recap.avg_score;
  const percentage = Math.round(Math.max(0, Math.min(1, score ?? 0)) * 100);
  const scoreLabel = metric === 'readiness'
    ? 'Overall prep readiness'
    : metric === 'mastery'
      ? 'Mastery'
      : 'Progress';
  // Portal to <body>: this report renders inside the tutor shell, whose
  // transforms would otherwise trap this fixed overlay and offset it.
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose?.();
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
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [mounted, onClose]);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-900/40 p-2 backdrop-blur-sm sm:p-4 animate-fade-rise">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-recap-title"
        tabIndex={-1}
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl outline-none sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl"
      >

        <div className="flex shrink-0 flex-col items-center px-5 pb-4 pt-6 text-center sm:px-10 sm:pb-5 sm:pt-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 sm:h-14 sm:w-14">
            <Target size={28} aria-hidden="true" />
          </div>
          <h2 id="session-recap-title" className="max-w-full whitespace-normal break-words text-xl font-display tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
        </div>

        <div
          data-session-recap-scroll="body"
          tabIndex={0}
          aria-label="Session recap details"
          className="min-h-0 w-full flex-1 overflow-y-auto overscroll-contain px-5 pb-6 sm:px-10 sm:pb-8"
        >
          <div
            role="group"
            aria-label={`${scoreLabel}: ${percentage}%`}
            className="mb-8 flex flex-col items-center sm:mb-10"
          >
            <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-4 border-slate-100 sm:h-32 sm:w-32">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500 opacity-20" />
              <svg viewBox="0 0 128 128" aria-hidden="true" className="absolute inset-0 h-full w-full -rotate-90">
                <circle
                  cx="64" cy="64" r="60"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray="377"
                  strokeDashoffset={377 - (377 * percentage) / 100}
                  className="text-indigo-600 transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="text-center">
                <div className="text-3xl font-semibold leading-none tabular-nums text-slate-900 sm:text-4xl">{percentage}<span className="text-lg text-slate-400 sm:text-xl">%</span></div>
              </div>
            </div>
            <p className="mt-3 max-w-full whitespace-normal break-words text-center text-xs font-bold uppercase tracking-widest text-indigo-600">{scoreLabel}</p>
          </div>

          <div className="w-full space-y-8">
            {recap.nodes_completed.length > 0 && (
              <div>
                <h3 className="mb-4 border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Skills Practiced</h3>
                <ul className="space-y-3">
                  {recap.nodes_completed.map((node, idx) => (
                    <li key={idx} className="flex min-w-0 items-start gap-3 font-medium text-slate-700">
                      <CheckCircle2 size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-500" />
                      <span className="min-w-0 whitespace-normal break-words">{node}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {recap.weaknesses && recap.weaknesses.length > 0 && (
              <div>
                <h3 className="mb-1 border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Focus Areas</h3>
                <ul>
                  {recap.weaknesses.map((w, idx) => (
                    <li key={idx} data-recap-focus-item className="flex min-w-0 gap-3 border-b border-slate-100 py-4 last:border-b-0">
                      <TrendingDown size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-500" />
                      <div className="min-w-0">
                        <strong className="mb-1 block whitespace-normal break-words text-sm font-bold text-slate-900">{labelSkillId(w.skill_id)}</strong>
                        {w.last_raw && <p className="whitespace-normal break-words text-sm leading-relaxed text-slate-600">{w.last_raw}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div
          data-session-recap-actions="footer"
          className="w-full shrink-0 space-y-3 border-t border-slate-100 bg-white px-5 py-4 sm:px-10 sm:py-5"
        >
          {onPractice && (
            <button
              data-session-recap-action="practice"
              type="button"
              disabled={practiceDisabled}
              className="min-h-12 w-full whitespace-normal break-words rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
              onClick={onPractice}
            >
              {practiceDisabled ? 'Starting Practice...' : 'Practice This Skill Again'}
            </button>
          )}
          <button
            data-session-recap-action="return"
            type="button"
            className="min-h-12 w-full whitespace-normal break-words rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-600 active:scale-[0.99]"
            onClick={onClose}
          >
            {returnLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
