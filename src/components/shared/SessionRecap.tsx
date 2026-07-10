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
  title = 'Session Complete',
  returnLabel = 'Return to Path',
}: SessionRecapProps) {
  const metric = recap.score_metric;
  const score = metric === 'readiness'
    ? recap.readiness_score
    : metric === 'mastery'
      ? recap.mastery_score
      : recap.avg_score;
  const percentage = Math.round(Math.max(0, Math.min(1, score ?? 0)) * 100);
  const scoreLabel = metric === 'readiness' ? 'Readiness' : metric === 'mastery' ? 'Mastery' : 'Progress';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-2 sm:p-4 animate-fade-rise overflow-hidden">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-recap-title"
        tabIndex={-1}
        className="max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white border border-slate-200 rounded-2xl sm:rounded-3xl px-5 py-6 sm:p-10 w-full max-w-lg shadow-2xl flex flex-col items-center outline-none"
      >
        
        {/* Header */}
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
          <Target size={32} />
        </div>
        <h2 id="session-recap-title" className="text-2xl sm:text-3xl text-center font-display text-slate-900 mb-8 tracking-tight">{title}</h2>
        
        {/* Score Ring */}
        <div className="relative w-32 h-32 shrink-0 flex items-center justify-center rounded-full border-4 border-slate-100 mb-10">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-500 opacity-20" />
          <svg viewBox="0 0 128 128" aria-hidden="true" className="absolute inset-0 w-full h-full -rotate-90">
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
            <div className="text-4xl font-semibold text-slate-900 leading-none tabular-nums">{percentage}<span className="text-xl text-slate-400">%</span></div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-indigo-600 mt-1">{scoreLabel}</div>
          </div>
        </div>

        <div className="w-full space-y-8">
          {/* Nodes Completed */}
          {recap.nodes_completed.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-widest font-semibold text-slate-500 mb-4 border-b border-slate-100 pb-2">Skills Practiced</h3>
              <ul className="space-y-3">
                {recap.nodes_completed.map((node, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-slate-700 font-medium">
                    <CheckCircle2 size={18} className="text-emerald-500" />
                    {node}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Weaknesses */}
          {recap.weaknesses && recap.weaknesses.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-widest font-semibold text-slate-500 mb-4 border-b border-slate-100 pb-2">Focus Areas</h3>
              <ul className="space-y-3">
                {recap.weaknesses.map((w, idx) => (
                  <li key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex gap-3">
                    <TrendingDown size={18} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-sm text-slate-900 font-bold mb-1">{labelSkillId(w.skill_id)}</strong>
                      {w.last_raw && <p className="text-sm text-slate-600 leading-relaxed">{w.last_raw}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 z-10 -mx-5 sm:-mx-10 mt-8 w-[calc(100%+2.5rem)] sm:w-[calc(100%+5rem)] border-t border-slate-100 bg-white/95 px-5 sm:px-10 pb-1 pt-4 backdrop-blur">
          {onPractice && (
            <button
              type="button"
              disabled={practiceDisabled}
              className="w-full py-4 rounded-2xl border border-slate-300 bg-white text-slate-800 font-semibold text-sm transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
              onClick={onPractice}
            >
              {practiceDisabled ? 'Starting Practice...' : 'Practice This Skill Again'}
            </button>
          )}
          <button
            className={`${onPractice ? 'mt-3' : ''} w-full py-4 rounded-2xl bg-slate-900 text-white font-semibold text-sm transition-all hover:bg-indigo-600 active:scale-95`}
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
