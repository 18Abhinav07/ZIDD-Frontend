"use client";

import { useEffect, useRef, useState } from 'react';
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
  hasScoreBreakdown: boolean,
): Array<{ label: string; text: string; tone: 'neutral' | 'warning' | 'success' }> {
  const rows: Array<{ label: string; text: string; tone: 'neutral' | 'warning' | 'success' }> = [];
  const breakdown = report.score_breakdown ?? {};
  const modelScore = typeof breakdown.model_score === 'number' ? pct(breakdown.model_score) : null;
  const roundMean = typeof breakdown.round_quality_mean === 'number' ? pct(breakdown.round_quality_mean) : null;
  const roundWeight = typeof breakdown.round_quality_weight === 'number' ? pct(breakdown.round_quality_weight) : null;
  if (hasScoreBreakdown && (modelScore || roundMean || roundWeight)) {
    rows.push({
      label: 'Final score blends',
      text: `The final score blends the session-level read${modelScore ? ` (${modelScore})` : ''}${roundMean ? ` with the average quality of answered turns (${roundMean})` : ''}${roundWeight ? ` using a ${roundWeight} round-quality weight` : ''}.`,
      tone: 'neutral',
    });
  }
  if (typeof breakdown.coverage_cap === 'number') {
    rows.push({
      label: 'Coverage cap lowered',
      text: `The assessment did not cover enough distinct evidence areas, so the final score could not exceed ${pct(breakdown.coverage_cap)}.`,
      tone: 'warning',
    });
  }
  if (typeof breakdown.validity_cap === 'number') {
    rows.push({
      label: 'Simulator integrity cap lowered',
      text: `Simulator repairs or invalid panel behavior capped score confidence at ${pct(breakdown.validity_cap)}. This is tracked separately from learner weaknesses.`,
      tone: 'warning',
    });
  }
  if (report.validity_status === 'final' && rows.length === 0) {
    rows.push({
      label: 'Final assessment',
      text: 'Enough answered turns and coverage were available, so the final score reflects the assessed rubric evidence.',
      tone: 'success',
    });
  }
  return rows;
}

function splitLegacyCaveats(report: SimulationReport): {
  learner: string[];
  integrity: string[];
} {
  const learner: string[] = [...(report.learner_assessment_caveats ?? [])].filter(Boolean);
  const integrity: string[] = [...(report.simulator_integrity_notes ?? [])].filter(Boolean);
  for (const caveat of report.assessment_caveats ?? []) {
    if (caveat.startsWith('Simulator caveat:')) {
      integrity.push(caveat.replace(/^Simulator caveat:\s*/i, ''));
    } else {
      learner.push(caveat);
    }
  }
  return {
    learner: Array.from(new Set(learner)),
    integrity: Array.from(new Set(integrity)),
  };
}

function validityCopy(report: SimulationReport): { label: string; detail: string; className: string } {
  const status = report.validity_status;
  const coverageCap = typeof report.score_breakdown?.coverage_cap === 'number';
  const validityCap = typeof report.score_breakdown?.validity_cap === 'number';
  const hasIntegrityNotes = Boolean(report.simulator_integrity_notes?.length);
  const covered = report.coverage_map?.unique_covered ?? 0;
  const needed = report.coverage_map?.required_unique ?? 0;
  const hasCoverageShortfall = needed > 0 && covered < needed;
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
    if (coverageCap) {
      return {
        label: 'Partial Assessment',
        detail: 'The score is capped because the session did not cover enough distinct evidence or competencies.',
        className: 'bg-amber-50 border-amber-200 text-amber-700',
      };
    }
    if (hasCoverageShortfall) {
      return {
        label: 'Partial Assessment',
        detail: 'The session did not cover enough distinct evidence or competencies. Treat this as a partial read, not a final score.',
        className: 'bg-amber-50 border-amber-200 text-amber-700',
      };
    }
    if (validityCap) {
      return {
        label: 'Integrity-Capped Assessment',
        detail: 'Enough learner evidence was present, but simulator repairs capped score confidence. Review the integrity notes below.',
        className: 'bg-amber-50 border-amber-200 text-amber-700',
      };
    }
    if (hasIntegrityNotes) {
      return {
        label: 'Integrity-Flagged Assessment',
        detail: 'Enough learner evidence may be present, but simulator repairs or fallbacks were recorded. Review those notes separately from learner weaknesses.',
        className: 'bg-amber-50 border-amber-200 text-amber-700',
      };
    }
    return {
      label: 'Partial Assessment',
      detail: 'This assessment is partial or caveated. Review the evidence and integrity notes before using it as a reliable read.',
      className: 'bg-amber-50 border-amber-200 text-amber-700',
    };
  }
  if (status === 'final' && !coverageCap && !validityCap && !hasCoverageShortfall) {
    return {
      label: 'Final Assessment',
      detail: 'Enough answered turns and coverage were available for scoring.',
      className: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    };
  }
  return {
    label: 'Assessment Status Unverified',
    detail: 'This report does not include a verified final status. Review its evidence and limits before relying on the score.',
    className: 'bg-amber-50 border-amber-200 text-amber-800',
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
  practiceActionLabel,
  simTurn,
  maxRounds,
}: SimulationReportModalProps) {
  const [shown, setShown] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isFirstSim, setIsFirstSim] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

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
  const isPartialSession = report.validity_status !== 'final'
    && simTurn !== undefined
    && maxRounds !== undefined
    && simTurn < maxRounds;
  const isInsufficientEvidence = report.validity_status === 'insufficient_evidence';
  const isInvalidSimulation = report.validity_status === 'invalid_simulation';
  const isNotScored = isInsufficientEvidence || isInvalidSimulation;
  const weakest = isNotScored ? null : lowestDimension(dimensions);
  const validity = validityCopy(report);
  const splitCaveats = splitLegacyCaveats(report);
  const scoreBreakdown = report.score_breakdown ?? {};
  const hasScoreBreakdown = Object.values(scoreBreakdown).some((value) => value !== undefined && value !== null);
  const scoreRows = scoreExplanationRows(report, hasScoreBreakdown);
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
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl shadow-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto outline-none"
      >

        {/* Header + overall score ring */}
        <div className="flex flex-col items-center px-6 sm:px-8 pt-6 pb-4 shrink-0">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-3">
            <Award size={22} />
          </div>
          <h2 id="assessment-report-title" className="text-xl font-display text-slate-900 mb-1 tracking-tight">Assessment Complete</h2>
          <p className="text-xs text-slate-500 mb-3">
            {type === 'gd' ? 'Group discussion' : 'Interview'} assessment based on the evidence in this session
          </p>

          <div className={cn("w-full mb-3 rounded-xl border px-4 py-3 text-left", validity.className)}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
              {validity.label === 'Final Assessment' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
              {validity.label}
            </div>
            <p className="mt-1 text-xs leading-relaxed font-normal opacity-90">{validity.detail}</p>
          </div>

          {/* Partial session warning */}
          {isPartialSession && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs font-semibold mb-3 text-center">
              Session ended early — Round {simTurn} of {maxRounds}. Score reflects partial participation.
            </div>
          )}

          <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 112 112" aria-hidden="true" className="absolute inset-0 w-full h-full -rotate-90 overflow-visible">
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
                  <div className="text-lg font-semibold text-slate-900 leading-tight">Not scored</div>
                  <div className="text-[9px] uppercase tracking-widest font-bold text-red-600 mt-1">
                    {isInvalidSimulation ? 'Simulation' : 'Evidence'}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-3xl font-semibold text-slate-900 leading-none tabular-nums">
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
        <div className="px-5 sm:px-8 py-4 space-y-6 min-w-0">

          {splitCaveats.learner.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-widest font-semibold text-slate-500 mb-3 border-b border-slate-100 pb-2">Learner Evidence Caveats</h3>
              <div className="space-y-2">
                {splitCaveats.learner.map((caveat) => (
                  <div
                    key={caveat}
                    className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm font-normal text-left leading-6 whitespace-normal break-words overflow-visible"
                  >
                    {caveat}
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasCoverage && (
            <div>
              <h3 className="text-xs uppercase tracking-widest font-semibold text-slate-500 mb-4 border-b border-slate-100 pb-2">Assessment Evidence</h3>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Answered</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">{report.scorable_turn_count ?? 0}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Covered</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">{coverage?.unique_covered ?? 0}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Needed</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">{coverage?.required_unique ?? 0}</p>
                </div>
              </div>
              {coverage?.repeated_prompt_count ? (
                <p className="mt-3 text-sm font-normal leading-6 text-amber-700 bg-amber-50 border border-amber-100 rounded-2xl px-3 py-2">
                  {coverage.repeated_prompt_count} repeated prompt{coverage.repeated_prompt_count === 1 ? '' : 's'} reduced assessment confidence.
                </p>
              ) : null}
            </div>
          )}

          {hasScoreBreakdown && (
            <div>
              <h3 className="text-xs uppercase tracking-widest font-semibold text-slate-500 mb-4 border-b border-slate-100 pb-2">Score Breakdown</h3>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Model</p>
                  <p className="mt-1 text-base font-semibold text-slate-900 tabular-nums">{pct(scoreBreakdown.model_score)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Round Mean</p>
                  <p className="mt-1 text-base font-semibold text-slate-900 tabular-nums">{pct(scoreBreakdown.round_quality_mean)}</p>
                </div>
                <div className="rounded-lg bg-slate-900 border border-slate-900 p-3 text-white">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-white/70">Final</p>
                  <p className="mt-1 text-base font-semibold tabular-nums">{pct(scoreBreakdown.final_score ?? report.score)}</p>
                </div>
              </div>
              {(typeof scoreBreakdown.round_quality_weight === 'number'
                || typeof scoreBreakdown.coverage_cap === 'number'
                || typeof scoreBreakdown.validity_cap === 'number') && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                  <span className="font-semibold text-slate-800">Assessment calculation: </span>
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
          {!isNotScored && (
          <div>
            <h3 className="text-xs uppercase tracking-widest font-semibold text-slate-500 mb-4 border-b border-slate-100 pb-2">Rubric</h3>
            <ul className="space-y-4">
              {dimensions.map((d) => {
                const pct = Math.round(d.value * 100);
                const explanation = report.score_explanations?.[d.label];
                return (
                  <li key={d.label}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-sm font-bold text-slate-700">{d.label}</span>
                      <span className="text-sm font-semibold text-slate-900 tabular-nums">{pct}%</span>
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

          {!isNotScored && scoreAdjustmentEntries.length > 0 && (
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
                  <div
                    key={note}
                    className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-sm font-normal text-left leading-6 whitespace-normal break-words overflow-visible"
                  >
                    {note}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isNotScored && (
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
        <div className="sticky bottom-0 z-10 px-5 sm:px-8 py-4 space-y-3 border-t border-slate-100 bg-white/95 backdrop-blur">
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
