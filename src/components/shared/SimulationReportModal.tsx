"use client";

import { useEffect, useState } from 'react';
import { SimulationReport } from '@/types';
import { Award, CheckCircle2, ArrowUpRight } from 'lucide-react';

interface SimulationReportModalProps {
  type: 'gd' | 'interview';
  report: SimulationReport;
  onClose: () => void;
}

interface Dimension {
  label: string;
  value: number; // 0-1
}

// Only the rubric dimensions the backend actually scored for this mode. The
// report carries all five fields, but the other mode's default to 0.0, so
// rendering them would print misleading empty bars.
function dimensionsFor(type: 'gd' | 'interview', report: SimulationReport): Dimension[] {
  if (type === 'gd') {
    return [
      { label: 'Participation', value: report.participation_score },
      { label: 'Relevance', value: report.relevance_score },
      { label: 'Language', value: report.language_score },
    ];
  }
  return [
    { label: 'Clarity', value: report.clarity_score },
    { label: 'Confidence', value: report.confidence_score },
  ];
}

function barColor(value: number): string {
  if (value >= 0.7) return 'bg-emerald-500';
  if (value >= 0.45) return 'bg-indigo-500';
  return 'bg-amber-500';
}

export function SimulationReportModal({ type, report, onClose }: SimulationReportModalProps) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const overall = Math.round(report.score * 100);
  const dimensions = dimensionsFor(type, report);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-rise">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header + overall score ring */}
        <div className="flex flex-col items-center px-10 pt-10 pb-8 shrink-0">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-5">
            <Award size={28} />
          </div>
          <h2 className="text-2xl font-display text-slate-900 mb-1 tracking-tight">Assessment Complete</h2>
          <p className="text-sm text-slate-500 mb-7">
            {type === 'gd' ? 'Group discussion' : 'Interview'} performance, scored across the full session
          </p>

          <div className="relative w-28 h-28 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="56" cy="56" r="52" fill="none" stroke="currentColor" strokeWidth="5" className="text-slate-100" />
              <circle
                cx="56" cy="56" r="52"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray="327"
                strokeDashoffset={shown ? 327 - (327 * overall) / 100 : 327}
                className="text-indigo-600 transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="text-center">
              <div className="text-3xl font-black text-slate-900 leading-none">
                {overall}<span className="text-lg text-slate-400">%</span>
              </div>
              <div className="text-[9px] uppercase tracking-widest font-bold text-indigo-600 mt-1">Overall</div>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="px-10 pb-2 overflow-y-auto scrollbar-hide space-y-7">

          {/* Rubric sub-scores */}
          <div>
            <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 mb-4 border-b border-slate-100 pb-2">Rubric</h3>
            <ul className="space-y-4">
              {dimensions.map((d) => {
                const pct = Math.round(d.value * 100);
                return (
                  <li key={d.label}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-sm font-bold text-slate-700">{d.label}</span>
                      <span className="text-sm font-black text-slate-900 tabular-nums">{pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${barColor(d.value)}`}
                        style={{ width: shown ? `${pct}%` : '0%' }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Strengths */}
          {report.strengths.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 mb-4 border-b border-slate-100 pb-2">What Landed</h3>
              <ul className="space-y-3">
                {report.strengths.map((s, idx) => (
                  <li key={idx} className="flex gap-3 text-sm text-slate-700 leading-relaxed">
                    <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Improvements */}
          {report.improvements.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 mb-4 border-b border-slate-100 pb-2">Work On Next</h3>
              <ul className="space-y-3">
                {report.improvements.map((s, idx) => (
                  <li key={idx} className="bg-amber-50/60 border border-amber-100 rounded-2xl p-4 flex gap-3">
                    <ArrowUpRight size={18} className="text-amber-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700 leading-relaxed">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Narrative summary */}
          {report.summary && (
            <div>
              <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 mb-4 border-b border-slate-100 pb-2">The Read</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{report.summary}</p>
            </div>
          )}
        </div>

        {/* Footer action */}
        <div className="px-10 pt-5 pb-8 shrink-0">
          <button
            className="w-full py-4 rounded-2xl bg-slate-900 text-white font-black text-sm transition-all hover:bg-indigo-600 active:scale-95"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
