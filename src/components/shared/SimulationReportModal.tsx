"use client";

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SimulationReport } from '@/types';
import { Award, CheckCircle2, ArrowUpRight, RotateCcw, Quote } from 'lucide-react';
import { clsx } from 'clsx';

function cn(...inputs: (string | undefined | false | null)[]) {
  return clsx(inputs);
}

interface SimulationReportModalProps {
  type: 'gd' | 'interview';
  report: SimulationReport;
  onClose: () => void;
  onPracticeAgain?: () => void;
  simTurn?: number;
  maxRounds?: number;
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
    const dims: Dimension[] = [
      { label: 'Participation', value: report.participation_score },
      { label: 'Relevance', value: report.relevance_score },
      { label: 'Language', value: report.language_score },
    ];
    if (report.assertiveness_score !== undefined) {
      dims.push({ label: 'Assertiveness', value: report.assertiveness_score });
    }
    return dims;
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

function scoreBand(pct: number): { label: string; color: string } {
  if (pct >= 85) return { label: 'Advanced', color: 'text-emerald-600' };
  if (pct >= 70) return { label: 'Proficient', color: 'text-indigo-600' };
  if (pct >= 50) return { label: 'Learning Zone', color: 'text-amber-600' };
  return { label: 'Building Foundations', color: 'text-slate-500' };
}

// Returns the dimension with the lowest score — used to label the practice CTA.
function lowestDimension(dimensions: Dimension[]): Dimension | null {
  if (dimensions.length === 0) return null;
  return dimensions.reduce((min, d) => (d.value < min.value ? d : min), dimensions[0]);
}

const FIRST_SIM_KEY = 'zidd_first_sim_complete';

export function SimulationReportModal({
  type,
  report,
  onClose,
  onPracticeAgain,
  simTurn,
  maxRounds,
}: SimulationReportModalProps) {
  const [shown, setShown] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isFirstSim, setIsFirstSim] = useState(false);

  useEffect(() => {
    setMounted(true);
    const raf = requestAnimationFrame(() => setShown(true));

    // Mark first completion and remember the state for this render
    if (typeof window !== 'undefined') {
      if (!localStorage.getItem(FIRST_SIM_KEY)) {
        setIsFirstSim(true);
        localStorage.setItem(FIRST_SIM_KEY, '1');
      }
    }

    return () => cancelAnimationFrame(raf);
  }, []);

  const overall = Math.round(report.score * 100);
  const band = scoreBand(overall);
  const dimensions = dimensionsFor(type, report);
  const weakest = lowestDimension(dimensions);
  const isPartialSession = simTurn !== undefined && maxRounds !== undefined && simTurn < maxRounds;

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-rise">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header + overall score ring */}
        <div className="flex flex-col items-center px-10 pt-10 pb-8 shrink-0">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-5">
            <Award size={28} />
          </div>
          <h2 className="text-2xl font-display text-slate-900 mb-1 tracking-tight">Assessment Complete</h2>
          <p className="text-sm text-slate-500 mb-5">
            {type === 'gd' ? 'Group discussion' : 'Interview'} performance, scored across the full session
          </p>

          {/* Partial session warning */}
          {isPartialSession && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700 text-xs font-semibold mb-5 text-center">
              Session ended early — Round {simTurn} of {maxRounds}. Score reflects partial participation.
            </div>
          )}

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
              <p className={cn("text-[10px] font-bold mt-0.5", band.color)}>{band.label}</p>
            </div>
          </div>

          {/* Baseline message for first-ever completed sim */}
          {isFirstSim && (
            <p className="text-[11px] text-slate-400 mt-3 text-center">
              This is your baseline — the only direction is up.
            </p>
          )}
        </div>

        {/* Scrollable body */}
        <div className="px-10 pb-2 overflow-y-auto scrollbar-hide space-y-7">

          {/* Rubric sub-scores */}
          <div>
            <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 mb-4 border-b border-slate-100 pb-2">Rubric</h3>
            <ul className="space-y-4">
              {dimensions.map((d) => {
                const pct = Math.round(d.value * 100);
                const explanation = report.score_explanations?.[d.label];
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
                    {explanation && (
                      <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{explanation}</p>
                    )}
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

          {/* The Read — behavioral observations (preferred) or narrative fallback */}
          {(report.read_observations?.length || report.summary) && (
            <div>
              <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 mb-4 border-b border-slate-100 pb-2">The Read</h3>
              {report.read_observations && report.read_observations.length > 0 ? (
                <ul className="space-y-3">
                  {report.read_observations.map((obs, idx) => {
                    const icons = [Quote, ArrowUpRight, RotateCcw];
                    const Icon = icons[idx] ?? ArrowUpRight;
                    const iconColors = ['text-slate-400', 'text-emerald-500', 'text-indigo-500'];
                    return (
                      <li key={idx} className="flex gap-3 text-sm text-slate-600 leading-relaxed">
                        <Icon size={16} className={cn("shrink-0 mt-0.5", iconColors[idx] ?? 'text-slate-400')} />
                        <span>{obs}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-slate-600 leading-relaxed">{report.summary}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer — recovery CTAs + return */}
        <div className="px-10 pt-5 pb-8 shrink-0 space-y-3">
          {onPracticeAgain && (
            <button
              className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-sm transition-all hover:bg-indigo-700 active:scale-95"
              onClick={onPracticeAgain}
            >
              {weakest
                ? `Drill ${weakest.label} — Practice Again`
                : 'Practice Again'}
            </button>
          )}
          <button
            className={cn(
              "w-full py-4 rounded-2xl font-black text-sm transition-all active:scale-95",
              onPracticeAgain
                ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                : "bg-slate-900 text-white hover:bg-indigo-600"
            )}
            onClick={onClose}
          >
            {onPracticeAgain ? 'Return to Map' : 'Done'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
