"use client";

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SimulationReport } from '@/types';
import { Award, CheckCircle2, ArrowUpRight, RotateCcw, Quote, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { getMe, updatePreferences } from '@/services/me';

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

function measuredDimension(label: string, value: number | null | undefined): Dimension | null {
  return typeof value === 'number' ? { label, value } : null;
}

// Only the rubric dimensions the backend actually scored for this mode. The
// report carries all five fields, but the other mode's default to 0.0, so
// rendering them would print misleading empty bars.
function dimensionsFor(type: 'gd' | 'interview', report: SimulationReport): Dimension[] {
  if (type === 'gd') {
    const dims = [
      measuredDimension('Participation', report.participation_score),
      measuredDimension('Relevance', report.relevance_score),
      measuredDimension('Language', report.language_score),
    ].filter((dimension): dimension is Dimension => Boolean(dimension));
    if (report.assertiveness_score !== undefined) {
      dims.push({ label: 'Assertiveness', value: report.assertiveness_score });
    }
    return dims;
  }
  return [
    measuredDimension('Clarity', report.clarity_score),
    measuredDimension('Confidence', report.confidence_score),
  ].filter((dimension): dimension is Dimension => Boolean(dimension));
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

function validityCopy(report: SimulationReport): { label: string; detail: string; className: string } {
  const status = report.validity_status || (report.assessment_caveats?.length ? 'partial' : 'final');
  if (status === 'insufficient_evidence') {
    return {
      label: 'Insufficient Evidence',
      detail: 'This is not a final score. Complete more answered rounds before using this assessment.',
      className: 'bg-red-50 border-red-200 text-red-700',
    };
  }
  if (status === 'invalid_simulation') {
    return {
      label: 'Invalid Simulation',
      detail: 'The simulator produced invalid panel behavior, so this run should be retried instead of scored.',
      className: 'bg-red-50 border-red-200 text-red-700',
    };
  }
  if (status === 'partial') {
    return {
      label: 'Partial Assessment',
      detail: 'The score is capped or caveated because the session did not cover enough evidence.',
      className: 'bg-amber-50 border-amber-200 text-amber-700',
    };
  }
  return {
    label: 'Final Assessment',
    detail: 'Enough answered turns and coverage were available for scoring.',
    className: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  };
}

// Returns the dimension with the lowest score — used to label the practice CTA.
function lowestDimension(dimensions: Dimension[]): Dimension | null {
  if (dimensions.length === 0) return null;
  return dimensions.reduce((min, d) => (d.value < min.value ? d : min), dimensions[0]);
}

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

    getMe()
      .then((me) => {
        if (!me.preferences.first_sim_complete) {
          setIsFirstSim(true);
          return updatePreferences({ first_sim_complete: true });
        }
      })
      .catch(() => {});

    return () => cancelAnimationFrame(raf);
  }, []);

  const overall = Math.round(report.score * 100);
  const band = scoreBand(overall);
  const dimensions = dimensionsFor(type, report);
  const isPartialSession = simTurn !== undefined && maxRounds !== undefined && simTurn < maxRounds;
  const isInsufficientEvidence = report.validity_status === 'insufficient_evidence';
  const isInvalidSimulation = report.validity_status === 'invalid_simulation';
  const isNotScored = isInsufficientEvidence || isInvalidSimulation;
  const weakest = isNotScored ? null : lowestDimension(dimensions);
  const validity = validityCopy(report);
  const coverage = report.coverage_map;
  const hasCoverage = Boolean(
    report.scorable_turn_count !== undefined ||
    coverage?.required_unique !== undefined ||
    coverage?.unique_covered !== undefined
  );

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

          <div className={cn("w-full mb-5 rounded-2xl border px-4 py-3 text-left", validity.className)}>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
              <AlertTriangle size={15} />
              {validity.label}
            </div>
            <p className="mt-1 text-xs leading-relaxed font-semibold opacity-90">{validity.detail}</p>
          </div>

          {/* Partial session warning */}
          {isPartialSession && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700 text-xs font-semibold mb-5 text-center">
              Session ended early — Round {simTurn} of {maxRounds}. Score reflects partial participation.
            </div>
          )}

          {report.assessment_caveats && report.assessment_caveats.length > 0 && (
            <div className="space-y-2 mb-5 w-full">
              {report.assessment_caveats.map((caveat) => (
                <div
                  key={caveat}
                  className="px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700 text-xs font-semibold text-center"
                >
                  {caveat}
                </div>
              ))}
            </div>
          )}

          <div className="relative w-28 h-28 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="56" cy="56" r="52" fill="none" stroke="currentColor" strokeWidth="5" className="text-slate-100" />
              {!isNotScored && (
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
              )}
            </svg>
            <div className="text-center">
              {isNotScored ? (
                <>
                  <div className="text-lg font-black text-slate-900 leading-tight">Not scored</div>
                  <div className="text-[9px] uppercase tracking-widest font-bold text-red-600 mt-1">
                    {isInvalidSimulation ? 'Simulation' : 'Evidence'}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-3xl font-black text-slate-900 leading-none">
                    {overall}<span className="text-lg text-slate-400">%</span>
                  </div>
                  <div className="text-[9px] uppercase tracking-widest font-bold text-indigo-600 mt-1">Overall</div>
                  <p className={cn("text-[10px] font-bold mt-0.5", band.color)}>{band.label}</p>
                </>
              )}
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

          {hasCoverage && (
            <div>
              <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 mb-4 border-b border-slate-100 pb-2">Assessment Evidence</h3>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-[10px] uppercase tracking-wider font-black text-slate-400">Answered</p>
                  <p className="mt-1 text-lg font-black text-slate-900 tabular-nums">{report.scorable_turn_count ?? 0}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-[10px] uppercase tracking-wider font-black text-slate-400">Covered</p>
                  <p className="mt-1 text-lg font-black text-slate-900 tabular-nums">{coverage?.unique_covered ?? 0}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-[10px] uppercase tracking-wider font-black text-slate-400">Needed</p>
                  <p className="mt-1 text-lg font-black text-slate-900 tabular-nums">{coverage?.required_unique ?? 0}</p>
                </div>
              </div>
              {coverage?.repeated_prompt_count ? (
                <p className="mt-3 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-2xl px-3 py-2">
                  {coverage.repeated_prompt_count} repeated prompt{coverage.repeated_prompt_count === 1 ? '' : 's'} reduced assessment confidence.
                </p>
              ) : null}
            </div>
          )}

          {/* Rubric sub-scores */}
          {!isNotScored && (
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
          )}

          {isNotScored && (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
              <h3 className="text-xs uppercase tracking-widest font-black text-red-600 mb-2">Rubric not scored</h3>
              <p className="text-sm text-red-700 leading-relaxed">
                {isInvalidSimulation
                  ? 'The simulator transcript was invalid, so rubric dimensions were not applied to the learner.'
                  : 'The session did not have enough answered turns to grade dimensions fairly.'}
              </p>
            </div>
          )}

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
              {isInvalidSimulation
                ? 'Retry Assessment'
                : isInsufficientEvidence
                ? 'Complete a Full Attempt'
                : weakest
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
