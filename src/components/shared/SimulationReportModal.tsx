"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SimulationReport } from '@/types';
import { Award, CheckCircle2, ArrowUpRight, RotateCcw, Quote, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { getMe, updatePreferences } from '@/services/me';
import { reportPresentationFor } from '@/lib/simulationReportPresentation.mjs';

function cn(...inputs: (string | undefined | false | null)[]) {
  return clsx(inputs);
}

interface SimulationReportModalProps {
  type: 'gd' | 'interview';
  report: SimulationReport;
  onClose: () => void;
  onPracticeAgain?: () => void;
  practiceActionLabel?: string;
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

function pct(value: number | null | undefined): string {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : 'N/A';
}

function scoreExplanationRows(
  report: SimulationReport,
  scoreLabel: string,
  isFinal: boolean,
  isNotScored: boolean,
): Array<{ label: string; text: string; tone: 'neutral' | 'warning' | 'success' }> {
  if (isNotScored) return [];
  const rows: Array<{ label: string; text: string; tone: 'neutral' | 'warning' | 'success' }> = [];
  const breakdown = report.score_breakdown ?? {};
  const modelScore = typeof breakdown.model_score === 'number' ? pct(breakdown.model_score) : null;
  const roundMean = typeof breakdown.round_quality_mean === 'number' ? pct(breakdown.round_quality_mean) : null;
  const roundWeight = typeof breakdown.round_quality_weight === 'number' ? pct(breakdown.round_quality_weight) : null;
  if (modelScore || roundMean || roundWeight) {
    const scoreNoun = isFinal ? 'final score' : `${scoreLabel.toLowerCase()} score`;
    rows.push({
      label: isFinal ? 'Final score blend' : `${scoreLabel} score blend`,
      text: `The ${scoreNoun} blends the session-level read${modelScore ? ` (${modelScore})` : ''}${roundMean ? ` with the average quality of answered turns (${roundMean})` : ''}${roundWeight ? ` using a ${roundWeight} round-quality weight` : ''}.`,
      tone: 'neutral',
    });
  }
  if (typeof breakdown.coverage_cap === 'number') {
    rows.push({
      label: 'Coverage cap',
      text: `Coverage limited this score to ${pct(breakdown.coverage_cap)} because the session did not cover enough distinct evidence areas.`,
      tone: 'warning',
    });
  }
  if (typeof breakdown.validity_cap === 'number') {
    rows.push({
      label: 'Simulator integrity cap',
      text: `Simulator repairs or invalid panel behavior capped score confidence at ${pct(breakdown.validity_cap)}. This is tracked separately from learner weaknesses.`,
      tone: 'warning',
    });
  }
  if (isFinal && rows.length === 0) {
    rows.push({
      label: 'Final assessment',
      text: 'Enough answered turns and coverage were available, so the final score reflects the assessed rubric evidence.',
      tone: 'success',
    });
  }
  return rows;
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
  practiceActionLabel,
  simTurn,
  maxRounds,
}: SimulationReportModalProps) {
  const [shown, setShown] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isFirstSim, setIsFirstSim] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const presentation = reportPresentationFor(report);

  useEffect(() => {
    setMounted(true);
    const raf = requestAnimationFrame(() => setShown(true));

    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (presentation.isNotScored) return;

    getMe()
      .then((me) => {
        if (!me.preferences.first_sim_complete) {
          setIsFirstSim(true);
          return updatePreferences({ first_sim_complete: true });
        }
      })
      .catch(() => {});
  }, [presentation.isNotScored]);

  useEffect(() => {
    if (!mounted) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
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

  const overall = Math.round(report.score * 100);
  const band = scoreBand(overall);
  const dimensions = dimensionsFor(type, report);
  const isEarlyEnd = simTurn !== undefined
    && maxRounds !== undefined
    && simTurn < maxRounds;
  const isInsufficientEvidence = report.validity_status === 'insufficient_evidence';
  const isInvalidSimulation = report.validity_status === 'invalid_simulation';
  const isPartialScored = !presentation.isNotScored && !presentation.isFinal;
  const weakest = presentation.isNotScored ? null : lowestDimension(dimensions);
  const splitCaveats = presentation.caveats as { learner: string[]; integrity: string[] };
  const scoreBreakdown = report.score_breakdown ?? {};
  const hasScoreBreakdown = !presentation.isNotScored
    && Object.values(scoreBreakdown).some((value) => typeof value === 'number');
  const scoreRows = scoreExplanationRows(
    report,
    presentation.scoreLabel,
    presentation.isFinal,
    presentation.isNotScored,
  );
  const coverage = report.coverage_map;
  const hasCoverage = Boolean(
    report.scorable_turn_count !== undefined ||
    coverage?.required_unique !== undefined ||
    coverage?.unique_covered !== undefined
  );
  const dimensionLabels = new Set(dimensions.map((dimension) => dimension.label));
  const scoreAdjustmentEntries = Object.entries(report.score_explanations ?? {})
    .filter(([label, value]) => (
      !dimensionLabels.has(label)
      && ['overall', 'round evidence', 'coverage'].includes(label.trim().toLowerCase())
      && Boolean(String(value || '').trim())
    ));
  const practiceLabel = practiceActionLabel ?? (
    isInvalidSimulation
      ? 'Retry Assessment'
      : isInsufficientEvidence
      ? 'Complete a Full Attempt'
      : weakest
      ? `Drill ${weakest.label}`
      : 'Practice Again'
  );
  const practiceIsReturnAction = /^return\b/i.test(practiceLabel.trim());

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-2 sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assessment-report-title"
        tabIndex={-1}
        data-short-viewport-fallback="dialog-scroll"
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl outline-none sm:max-h-[calc(100dvh-2rem)] [@media(max-height:640px)]:block [@media(max-height:640px)]:overflow-y-auto"
      >

        {/* Header + overall score ring */}
        <div className="flex flex-col items-center px-6 sm:px-8 pt-6 pb-4 shrink-0">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-3">
            <Award size={22} />
          </div>
          <h2 id="assessment-report-title" className="mb-1 break-words text-center font-display text-xl tracking-tight text-slate-900">{presentation.title}</h2>
          <p className="mb-3 break-words text-center text-xs text-slate-500">
            {type === 'gd' ? 'Group discussion' : 'Interview'} assessment based on the evidence in this session
          </p>

          <div className={cn(
            "mb-3 w-full rounded-xl border px-4 py-3 text-left",
            presentation.tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
            presentation.tone === 'warning' && 'border-amber-200 bg-amber-50 text-amber-800',
            presentation.tone === 'danger' && 'border-red-200 bg-red-50 text-red-700',
          )}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
              {presentation.isFinal ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
              <span className="min-w-0 whitespace-normal break-words">{presentation.validityLabel}</span>
            </div>
            <p className="mt-1 whitespace-normal break-words text-xs font-normal leading-relaxed opacity-90">{presentation.validityDetail}</p>
          </div>

          {isEarlyEnd && (
            <p className="mb-3 whitespace-normal break-words rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-xs font-medium leading-5 text-amber-800">
              Session ended early at round {simTurn} of {maxRounds}.{' '}
              {presentation.isNotScored
                ? 'Backend validation did not score this report.'
                : isPartialScored
                  ? 'The result uses only the measured evidence collected before the session ended.'
                  : 'Backend validation still found enough measured evidence for a final assessment.'}
            </p>
          )}

          <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 112 112" aria-hidden="true" className="absolute inset-0 w-full h-full -rotate-90 overflow-visible">
              <circle cx="56" cy="56" r="52" fill="none" stroke="currentColor" strokeWidth="5" className="text-slate-100" />
              {!presentation.isNotScored && (
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
              {presentation.isNotScored ? (
                <>
                  <div className="break-words text-lg font-semibold leading-tight text-slate-900">{presentation.scoreLabel}</div>
                  <div className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-red-600">
                    {isInvalidSimulation ? 'Simulation' : 'Evidence'}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-3xl font-semibold text-slate-900 leading-none tabular-nums">
                    {overall}<span className="text-lg text-slate-400">%</span>
                  </div>
                  <div className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-indigo-600">{presentation.scoreLabel}</div>
                  <p className={cn("mt-0.5 break-words text-[10px] font-medium", band.color)}>{band.label}</p>
                </>
              )}
            </div>
          </div>

          {/* Baseline message for first-ever completed sim */}
          {isFirstSim && !presentation.isNotScored && (
            <p className="mt-3 break-words text-center text-[11px] text-slate-400">
              This is your first measured baseline for future attempts.
            </p>
          )}
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 min-w-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-4 sm:px-8">

          {splitCaveats.learner.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-widest font-semibold text-slate-500 mb-3 border-b border-slate-100 pb-2">Learner Evidence Caveats</h3>
              <div className="space-y-2">
                {splitCaveats.learner.map((caveat) => (
                  <p
                    key={caveat}
                    className="overflow-visible whitespace-normal break-words rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm font-normal leading-6 text-amber-900"
                  >
                    {caveat}
                  </p>
                ))}
              </div>
            </div>
          )}

          {hasCoverage && (
            <div>
              <h3 className="text-xs uppercase tracking-widest font-semibold text-slate-500 mb-4 border-b border-slate-100 pb-2">Assessment Evidence</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="whitespace-normal break-words text-[10px] font-semibold uppercase tracking-wider text-slate-500">Answered</p>
                  <p className="mt-1 whitespace-normal break-words text-lg font-semibold tabular-nums text-slate-900">{report.scorable_turn_count ?? 0}</p>
                </div>
                <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="whitespace-normal break-words text-[10px] font-semibold uppercase tracking-wider text-slate-500">Covered</p>
                  <p className="mt-1 whitespace-normal break-words text-lg font-semibold tabular-nums text-slate-900">{coverage?.unique_covered ?? 0}</p>
                </div>
                <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="whitespace-normal break-words text-[10px] font-semibold uppercase tracking-wider text-slate-500">Needed</p>
                  <p className="mt-1 whitespace-normal break-words text-lg font-semibold tabular-nums text-slate-900">{coverage?.required_unique ?? 0}</p>
                </div>
              </div>
              {coverage?.repeated_prompt_count ? (
                <p className="mt-3 text-sm font-normal leading-6 text-amber-700 bg-amber-50 border border-amber-100 rounded-2xl px-3 py-2">
                  {coverage.repeated_prompt_count} repeated prompt{coverage.repeated_prompt_count === 1 ? '' : 's'} reduced assessment confidence.
                </p>
              ) : null}
            </div>
          )}

          {hasScoreBreakdown && !presentation.isNotScored && (
            <div>
              <h3 className="text-xs uppercase tracking-widest font-semibold text-slate-500 mb-4 border-b border-slate-100 pb-2">Score Breakdown</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {typeof scoreBreakdown.model_score === 'number' && (
                  <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="whitespace-normal break-words text-[10px] font-semibold uppercase tracking-wider text-slate-500">Model</p>
                    <p className="mt-1 whitespace-normal break-words text-base font-semibold tabular-nums text-slate-900">{pct(scoreBreakdown.model_score)}</p>
                  </div>
                )}
                {typeof scoreBreakdown.round_quality_mean === 'number' && (
                  <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="whitespace-normal break-words text-[10px] font-semibold uppercase tracking-wider text-slate-500">Round Mean</p>
                    <p className="mt-1 whitespace-normal break-words text-base font-semibold tabular-nums text-slate-900">{pct(scoreBreakdown.round_quality_mean)}</p>
                  </div>
                )}
                <div className={cn(
                  "min-w-0 rounded-lg border p-3",
                  presentation.isFinal
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-amber-200 bg-amber-50 text-amber-900',
                )}>
                  <p className={cn(
                    "whitespace-normal break-words text-[10px] font-semibold uppercase tracking-wider",
                    presentation.isFinal ? 'text-white/70' : 'text-amber-700',
                  )}>{presentation.scoreLabel}</p>
                  <p className="mt-1 whitespace-normal break-words text-base font-semibold tabular-nums">{pct(scoreBreakdown.final_score ?? report.score)}</p>
                </div>
                {typeof scoreBreakdown.coverage_cap === 'number' && (
                  <div className="min-w-0 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                    <p className="whitespace-normal break-words text-[10px] font-semibold uppercase tracking-wider text-amber-700">Coverage Cap</p>
                    <p className="mt-1 whitespace-normal break-words text-base font-semibold tabular-nums">{pct(scoreBreakdown.coverage_cap)}</p>
                  </div>
                )}
                {typeof scoreBreakdown.validity_cap === 'number' && (
                  <div className="min-w-0 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                    <p className="whitespace-normal break-words text-[10px] font-semibold uppercase tracking-wider text-amber-700">Validity Cap</p>
                    <p className="mt-1 whitespace-normal break-words text-base font-semibold tabular-nums">{pct(scoreBreakdown.validity_cap)}</p>
                  </div>
                )}
              </div>
              {(typeof scoreBreakdown.round_quality_weight === 'number'
                || typeof scoreBreakdown.coverage_cap === 'number'
                || typeof scoreBreakdown.validity_cap === 'number') && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                  <span className="whitespace-normal break-words font-medium text-slate-800">Assessment calculation: </span>
                  {typeof scoreBreakdown.round_quality_weight === 'number' && (
                    <span>{pct(scoreBreakdown.round_quality_weight)} of the blend comes from answered-turn quality. </span>
                  )}
                  {typeof scoreBreakdown.coverage_cap === 'number' && (
                    <span>Coverage limited the maximum to {pct(scoreBreakdown.coverage_cap)}. </span>
                  )}
                  {typeof scoreBreakdown.validity_cap === 'number' && (
                    <span>Simulator validity limited confidence to {pct(scoreBreakdown.validity_cap)}.</span>
                  )}
                </div>
              )}
              {typeof scoreBreakdown.repeated_prompt_count === 'number' && scoreBreakdown.repeated_prompt_count > 0 && (
                <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal leading-6 text-slate-600">
                  Repeated unanswered prompts counted by scoring: {scoreBreakdown.repeated_prompt_count}.
                </p>
              )}
            </div>
          )}

          {scoreRows.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-widest font-semibold text-slate-500 mb-4 border-b border-slate-100 pb-2">Why this score</h3>
              <ul className="space-y-2">
                {scoreRows.map((row) => (
                  <li
                    key={row.label}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-left",
                      row.tone === 'warning' && 'border-amber-200 bg-amber-50 text-amber-900',
                      row.tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-900',
                      row.tone === 'neutral' && 'border-slate-200 bg-slate-50 text-slate-700',
                    )}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em]">{row.label}</p>
                    <p className="mt-1 text-sm font-normal leading-6 whitespace-normal break-words">{row.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.evidence_quotes && report.evidence_quotes.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-widest font-semibold text-slate-500 mb-4 border-b border-slate-100 pb-2">Evidence Quotes</h3>
              <ul className="space-y-3">
                {report.evidence_quotes.slice(0, 4).map((quote) => (
                  <li key={quote} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <Quote size={16} className="text-slate-400 shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-600 leading-relaxed break-words min-w-0">{quote}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Rubric sub-scores */}
          {!presentation.isNotScored && (
          <div>
            <h3 className="text-xs uppercase tracking-widest font-semibold text-slate-500 mb-4 border-b border-slate-100 pb-2">Rubric</h3>
            <ul className="space-y-4">
              {dimensions.map((d) => {
                const pct = Math.round(d.value * 100);
                const explanation = report.score_explanations?.[d.label];
                return (
                  <li key={d.label}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="min-w-0 whitespace-normal break-words text-sm font-medium text-slate-700">{d.label}</span>
                      <span className="shrink-0 whitespace-normal break-words text-sm font-medium tabular-nums text-slate-900">{pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${barColor(d.value)}`}
                        style={{ width: shown ? `${pct}%` : '0%' }}
                      />
                    </div>
                    {explanation && (
                      <p className="text-sm text-slate-500 mt-1.5 leading-6 break-words min-w-0">{explanation}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
          )}

          {!presentation.isNotScored && scoreAdjustmentEntries.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-widest font-semibold text-slate-500 mb-4 border-b border-slate-100 pb-2">Score Adjustments</h3>
              <ul className="space-y-3">
                {scoreAdjustmentEntries.map(([label, explanation]) => (
                  <li key={label} className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">{label}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-700 break-words min-w-0">{explanation}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {splitCaveats.integrity.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-widest font-semibold text-slate-500 mb-3 border-b border-slate-100 pb-2">Simulator Integrity Notes</h3>
              <p className="mb-3 text-sm leading-6 text-slate-500">
                These are simulator events, not learner weaknesses. Score handling already accounts for them where required.
              </p>
              <div className="space-y-2">
                {splitCaveats.integrity.map((note) => (
                  <p
                    key={note}
                    className="overflow-visible whitespace-normal break-words rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-normal leading-6 text-slate-600"
                  >
                    {note}
                  </p>
                ))}
              </div>
            </div>
          )}

          {presentation.isNotScored && (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
              <h3 className="text-xs uppercase tracking-widest font-semibold text-red-600 mb-2">Rubric not scored</h3>
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
              <h3 className="text-xs uppercase tracking-widest font-semibold text-slate-500 mb-4 border-b border-slate-100 pb-2">What Landed</h3>
              <ul className="space-y-3">
                {report.strengths.map((s, idx) => (
                  <li key={idx} className="flex gap-3 text-sm text-slate-700 leading-relaxed">
                    <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span className="break-words min-w-0">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Improvements */}
          {report.improvements.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-widest font-semibold text-slate-500 mb-4 border-b border-slate-100 pb-2">Work On Next</h3>
              <ul className="space-y-3">
                {report.improvements.map((s, idx) => (
                  <li key={idx} className="bg-amber-50/60 border border-amber-100 rounded-2xl p-4 flex gap-3">
                    <ArrowUpRight size={18} className="text-amber-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700 leading-relaxed break-words min-w-0">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* The Read — behavioral observations (preferred) or narrative fallback */}
          {(report.read_observations?.length || report.summary) && (
            <div>
              <h3 className="text-xs uppercase tracking-widest font-semibold text-slate-500 mb-4 border-b border-slate-100 pb-2">The Read</h3>
              {report.read_observations && report.read_observations.length > 0 ? (
                <ul className="space-y-3">
                  {report.read_observations.map((obs, idx) => {
                    const icons = [Quote, ArrowUpRight, RotateCcw];
                    const Icon = icons[idx] ?? ArrowUpRight;
                    const iconColors = ['text-slate-400', 'text-emerald-500', 'text-indigo-500'];
                    return (
                      <li key={idx} className="flex gap-3 text-sm text-slate-600 leading-relaxed">
                        <Icon size={16} className={cn("shrink-0 mt-0.5", iconColors[idx] ?? 'text-slate-400')} />
                        <span className="break-words min-w-0">{obs}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-slate-600 leading-relaxed break-words min-w-0">{report.summary}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer — recovery CTAs + return */}
        <div className="z-10 shrink-0 space-y-3 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-8">
          {onPracticeAgain && (
            <button
              className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm transition-all hover:bg-indigo-700 active:scale-95"
              onClick={onPracticeAgain}
            >
              {practiceLabel}
            </button>
          )}
          {(!onPracticeAgain || !practiceIsReturnAction) && (
            <button
              className={cn(
                "w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95",
                onPracticeAgain
                  ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  : "bg-slate-900 text-white hover:bg-indigo-600"
              )}
              onClick={onClose}
            >
              {onPracticeAgain ? 'Return to Map' : 'Done'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
