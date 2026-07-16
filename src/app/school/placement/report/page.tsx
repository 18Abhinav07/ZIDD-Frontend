"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
  ReloadIcon,
} from '@radix-ui/react-icons';
import { SchoolReportSkeleton } from '@/components/learning/LearningSkeletons';
import {
  SchoolDisclosure,
  SchoolPageHeading,
  schoolPrimaryActionClass,
  schoolSecondaryActionClass,
} from '@/components/school/SchoolPrimitives';
import { learnerSafeErrorMessage } from '@/lib/errorCopy';
import {
  constrainPlacementReportActionToSession,
  placementEvaluatedClassLabel,
  placementEvidenceLead,
  placementLearningPathDetail,
  recapModuleDisplayLabel,
  resolveSchoolPlacementReportAction,
  type SchoolPlacementReportAction,
} from '@/lib/schoolPlacementReportPolicy';
import {
  createSchoolRouteLoadSingleFlight,
  schoolRouteLoadDisposition,
  schoolRouteLoadKey,
  type SchoolRouteLoadOwner,
} from '@/lib/schoolRouteLoadPolicy';
import { getSchoolAvatarTheme } from '@/lib/schoolTheme';
import {
  getSchoolPlacementReport,
  getSchoolPlacement,
  getSchoolLoadScope,
  getSchoolState,
  startSchoolRecap,
  type SchoolPlacementReport,
} from '@/services/schoolRebuild';

const PLACEMENT_STAGE_LABELS: Record<string, string> = {
  snapshot: 'Snapshot',
  placement_snapshot: 'Snapshot',
  targeted_diagnostic: 'Focused check',
  placement_targeted: 'Focused check',
  confirmatory: 'Confirmation',
  placement_confirmatory: 'Confirmation',
};

function placementStageLabel(stage: string) {
  return PLACEMENT_STAGE_LABELS[stage] ?? 'Additional check';
}

function placementBasisCopy(scoringSource: string) {
  if (scoringSource === 'committed_learning_events') {
    return 'This result uses the answers committed during your starting-point check. Each saved answer counts once.';
  }
  if (scoringSource === 'placement_session_state') {
    return 'This result uses the completed answers saved with your starting-point session.';
  }
  return 'This result uses the placement answers saved by Zidd.';
}

function conclusionLabel(report: SchoolPlacementReport) {
  if (report.placement_status === 'target_ready') return `Ready for Class ${report.target_class_no}`;
  if (report.placement_status === 'below_target') return 'A foundation path comes first';
  if (report.placement_status === 'insufficient_evidence') return 'More evidence is needed';
  return 'Starting point paused';
}

function conclusionColor(report: SchoolPlacementReport) {
  if (report.placement_status === 'target_ready') return 'border-teal-700 text-teal-800';
  if (report.placement_status === 'below_target') return 'border-orange-600 text-orange-800';
  return 'border-[var(--school-accent)] text-[var(--school-accent-deep)]';
}

interface PlacementReportSnapshot {
  report: SchoolPlacementReport;
  currentAction: SchoolPlacementReportAction;
}

const placementReportLoadSingleFlight = createSchoolRouteLoadSingleFlight<PlacementReportSnapshot>();

async function loadPlacementReportSnapshot(): Promise<PlacementReportSnapshot> {
  const [reportResult, stateResult] = await Promise.allSettled([
    getSchoolPlacementReport(),
    getSchoolState({ force: true }),
  ]);
  if (reportResult.status === 'rejected') throw reportResult.reason;
  const report = reportResult.value;
  const state = stateResult.status === 'fulfilled' ? stateResult.value : null;
  const proposedAction = resolveSchoolPlacementReportAction(report, state);
  if (
    proposedAction.kind === 'current'
    && ['resume_placement', 'finish_placement'].includes(proposedAction.action)
  ) {
    const placementResult = await Promise.allSettled([
      getSchoolPlacement(report.placement_session_id),
    ]);
    return {
      report,
      currentAction: constrainPlacementReportActionToSession(
        proposedAction,
        {
          placementSessionId: report.placement_session_id,
          profileVersionId: report.profile_version_id,
        },
        placementResult[0].status === 'fulfilled' ? placementResult[0].value : null,
      ),
    };
  }
  return {
    report,
    currentAction: proposedAction,
  };
}

function PlacementReportContent({
  report,
  currentAction,
  starting,
  error,
  onBack,
  onPrimaryAction,
  onRetry,
}: {
  report: SchoolPlacementReport;
  currentAction: SchoolPlacementReportAction;
  starting: boolean;
  error: string;
  onBack: () => void;
  onPrimaryAction: () => void;
  onRetry: () => void;
}) {
  const theme = getSchoolAvatarTheme(report.coach_avatar_id, report.coach_palette_id);
  const stageEvidence = Object.entries(report.evidence_summary.stage_counts)
    .filter(([, count]) => count > 0)
    .map(([stage, count]) => ({ stage: placementStageLabel(stage), count }));
  const leadEvidence = placementEvidenceLead(report);
  const historical = currentAction.kind === 'historical_only';
  const continuationUnavailable = currentAction.kind === 'current_unavailable';
  const nextReason = currentAction.learnerMessage;
  const learningPath = placementLearningPathDetail(report);

  return (
    <main
      className="mx-auto min-h-[calc(100dvh-68px)] w-full max-w-[1240px] overflow-x-hidden px-4 pb-24 pt-12 sm:px-7 sm:pt-16 lg:px-10"
      style={theme.style}
    >
      <header className="grid gap-9 border-b border-[var(--school-line-strong)] pb-10 lg:grid-cols-[minmax(0,1fr)_230px] lg:items-end lg:gap-[clamp(3rem,8vw,7rem)] lg:pb-14">
        <SchoolPageHeading
          eyebrow="Starting-point report"
          title={report.learner_summary}
          description="This conclusion comes from saved evidence. It is not a school mark, percentage, or rank."
        />
        <div className={`border-l-2 py-1 pl-5 ${conclusionColor(report)}`}>
          <span className="block font-mono text-[9px] font-semibold uppercase text-slate-500">
            {historical ? 'Past starting point' : 'Current starting point'}
          </span>
          <strong className="mt-2 block text-sm font-semibold text-slate-800">{conclusionLabel(report)}</strong>
          <small className="mt-2 block font-mono text-[9px] font-semibold uppercase text-slate-500">Evidence summary. No mark.</small>
        </div>
      </header>

      <div className="grid gap-12 pt-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.68fr)] lg:gap-[clamp(3.5rem,9vw,8rem)] lg:pt-14">
        <section aria-labelledby="placement-evidence-title">
          <p className="font-mono text-[10px] font-semibold uppercase text-[var(--school-muted)]">What we saw</p>
          <h2 id="placement-evidence-title" className="mt-3 font-display text-[2.15rem] font-normal leading-[1.04] text-slate-950 sm:text-[2.65rem]">
            What the evidence supports
          </h2>
          {leadEvidence.rows.length > 0 ? (
            <ol className="mt-7 border-t border-[var(--school-line)]">
              {leadEvidence.rows.map((row, index) => (
              <li key={`${index}-${row}`} className="grid grid-cols-[32px_minmax(0,1fr)] gap-4 border-b border-[var(--school-line)] py-5 sm:grid-cols-[40px_minmax(0,1fr)] sm:gap-5">
                <span className="pt-1 font-mono text-[10px] font-semibold text-slate-400">{String(index + 1).padStart(2, '0')}</span>
                <p className="text-sm leading-6 text-slate-600">{row}</p>
              </li>
              ))}
            </ol>
          ) : (
            <p className="mt-7 border-y border-[var(--school-line)] py-5 text-sm leading-6 text-slate-600">
              {leadEvidence.emptyMessage}
            </p>
          )}
        </section>

        <aside className="self-start border-t border-[var(--school-line-strong)] pt-7 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-1" aria-labelledby="placement-next-title">
          <span className="block h-1 w-10 rounded-full bg-[var(--school-accent)]" aria-hidden="true" />
          <p className="mt-7 font-mono text-[10px] font-semibold uppercase text-[var(--school-muted)]">What happens next</p>
          <h2 id="placement-next-title" className="mt-3 font-display text-[2rem] font-normal leading-[1.05] text-slate-950">
            {historical ? 'This result remains in your learning history' : currentAction.label}
          </h2>
          <p className="mt-4 text-sm leading-6 text-slate-600">{nextReason}</p>
          {error ? <p role="alert" className="mt-4 border-y border-red-200 bg-red-50 px-3 py-3 text-sm font-semibold text-red-800">{error}</p> : null}
          <div className="mt-7 flex flex-col items-start gap-3">
            {currentAction.kind === 'current' ? (
              <button
                type="button"
                onClick={onPrimaryAction}
                disabled={starting && currentAction.effect === 'start_recap'}
                aria-busy={starting && currentAction.effect === 'start_recap'}
                className={`${schoolPrimaryActionClass} w-full sm:w-auto`}
              >
                {starting && currentAction.effect === 'start_recap'
                  ? 'Opening foundation path'
                  : currentAction.label}
                <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : continuationUnavailable ? (
              <button type="button" onClick={onRetry} className={`${schoolSecondaryActionClass} w-full sm:w-auto`}>
                <ReloadIcon className="h-4 w-4" aria-hidden="true" />
                Check for another question
              </button>
            ) : (
              <button type="button" onClick={onBack} className={`${schoolPrimaryActionClass} w-full sm:w-auto`}>
                Return to current School plan
                <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            {!historical ? (
              <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-[var(--school-accent-deep)]">
                <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
                Back to School
              </button>
            ) : null}
          </div>
        </aside>
      </div>

      <section className="mt-14 max-w-[900px] border-t border-[var(--school-line-strong)] pt-10" aria-label="Placement report details">
        <SchoolPageHeading
          eyebrow="Report details"
          title="Open the saved detail when you need it"
          description="The conclusion and current next step stay above. These sections preserve the evidence behind them."
          level="h2"
          size="section"
        />

        <div className="mt-6">
          <SchoolDisclosure title="Parent summary" summary="A concise explanation for a parent or guardian">
            <p>{report.parent_summary}</p>
          </SchoolDisclosure>

          <SchoolDisclosure title="How this starting point was chosen" summary="Evidence method and current School state">
            <p>{placementBasisCopy(report.evidence_summary.scoring_source)}</p>
            <dl className="mt-4 divide-y divide-[var(--school-line)] border-y border-[var(--school-line)]">
              <div className="flex flex-wrap justify-between gap-3 py-3"><dt>Target class</dt><dd className="font-semibold text-slate-900">Class {report.target_class_no}</dd></div>
              <div className="flex flex-wrap justify-between gap-3 py-3"><dt>Starting point evaluated</dt><dd className="font-semibold text-slate-900">{placementEvaluatedClassLabel(report)}</dd></div>
              <div className="flex flex-wrap justify-between gap-3 py-3"><dt>{learningPath.label}</dt><dd className="font-semibold text-slate-900">{learningPath.value}</dd></div>
            </dl>
            <div className="mt-4">
              <p className="font-semibold text-slate-900">Current next step</p>
              <p className="mt-2">{currentAction.kind === 'historical_only' ? 'Open School to confirm the current next step.' : currentAction.label}</p>
              <p className="mt-2 text-xs text-slate-500">This comes from the latest School state. An older report cannot override the current path.</p>
            </div>
          </SchoolDisclosure>

          <SchoolDisclosure title="Saved answer details" summary={`${report.evidence_summary.total_attempts} saved answers were used`}>
            <dl className="divide-y divide-[var(--school-line)] border-y border-[var(--school-line)]">
              <div className="flex justify-between gap-4 py-3"><dt>Saved answers used</dt><dd className="font-semibold text-slate-900">{report.evidence_summary.total_attempts}</dd></div>
              <div className="flex justify-between gap-4 py-3"><dt>Strong checks</dt><dd className="font-semibold text-slate-900">{report.evidence_summary.correct_attempts}</dd></div>
              <div className="flex justify-between gap-4 py-3"><dt>Needs another look</dt><dd className="font-semibold text-slate-900">{report.evidence_summary.incorrect_attempts}</dd></div>
            </dl>
            {stageEvidence.length > 0 ? (
              <ul className="mt-4 space-y-2" aria-label="Evidence gathered by stage">
                {stageEvidence.map((entry) => <li key={entry.stage}>{entry.stage}: {entry.count}</li>)}
              </ul>
            ) : null}
          </SchoolDisclosure>

          {report.placement_status === 'below_target' ? (
            <SchoolDisclosure title="Foundation skills to strengthen" summary={`${report.blocking_skills.length} ${report.blocking_skills.length === 1 ? 'skill needs' : 'skills need'} focused practice`}>
            {report.blocking_skills.length > 0 ? (
              <div className="divide-y divide-[var(--school-line)] border-y border-[var(--school-line)]">
                {report.blocking_skills.map((skill) => (
                  <article key={`${skill.label}-${skill.source_class_no}`} className="py-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-semibold text-slate-950">{skill.label}</h3>
                      <p className="text-xs text-slate-500">Class {skill.source_class_no} foundation</p>
                    </div>
                    <p className="mt-2">{skill.learner_reason}</p>
                    <p className="mt-2 text-xs text-slate-500">{skill.correct_attempts} of {skill.attempts} saved checks were strong</p>
                  </article>
                ))}
              </div>
            ) : <p>No blocking foundation gap was confirmed.</p>}
            {report.recommended_recap_modules.length > 0 ? (
              <div className="mt-5">
                <p className="font-semibold text-slate-900">Recommended foundation work</p>
                <ul className="mt-2 space-y-2">
                  {report.recommended_recap_modules.map((module) => <li key={module.module_id}>{recapModuleDisplayLabel(module)}</li>)}
                </ul>
              </div>
            ) : null}
            </SchoolDisclosure>
          ) : null}

          {report.placement_status === 'target_ready' ? (
            <SchoolDisclosure title="Skills to keep watching" summary={`${report.watchlist_skills.length} ${report.watchlist_skills.length === 1 ? 'skill' : 'skills'} to revisit during class work`}>
            {report.watchlist_skills.length > 0 ? (
              <ul className="divide-y divide-[var(--school-line)] border-y border-[var(--school-line)]">
                {report.watchlist_skills.map((skill) => (
                  <li key={`${skill.label}-${skill.source_class_no}`} className="py-4">
                    <p className="font-semibold text-slate-950">{skill.label}</p>
                    <p className="mt-1">Your coach will check this Class {skill.source_class_no} skill again inside lessons.</p>
                  </li>
                ))}
              </ul>
            ) : <p>No additional watchlist skill was recorded.</p>}
            </SchoolDisclosure>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export default function SchoolPlacementReportPage() {
  const router = useRouter();
  const [report, setReport] = useState<SchoolPlacementReport | null>(null);
  const [currentAction, setCurrentAction] = useState<SchoolPlacementReportAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const mountedRef = useRef(false);
  const loadRequestIdRef = useRef(0);
  const loadOwnerRef = useRef<SchoolRouteLoadOwner | null>(null);
  const startingRef = useRef(false);

  const load = useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    let requestOwner: SchoolRouteLoadOwner | null = null;
    const requestDisposition = async () => {
      if (!requestOwner) return mountedRef.current && loadRequestIdRef.current === requestId ? 'commit' : 'ignore';
      try {
        const currentScope = await getSchoolLoadScope();
        return schoolRouteLoadDisposition(loadOwnerRef.current, requestOwner, mountedRef.current, currentScope);
      } catch {
        return 'ignore';
      }
    };
    setLoading(true);
    setError('');
    try {
      const scope = await getSchoolLoadScope();
      if (!mountedRef.current || loadRequestIdRef.current !== requestId) return;
      requestOwner = { requestId, scopeKey: scope.key };
      loadOwnerRef.current = requestOwner;
      const snapshot = await placementReportLoadSingleFlight.run(
        loadPlacementReportSnapshot,
        schoolRouteLoadKey(scope, 'placement-report'),
      );
      const disposition = await requestDisposition();
      if (disposition !== 'commit') {
        if (disposition === 'retry') queueMicrotask(() => void load());
        return;
      }
      setReport(snapshot.report);
      setCurrentAction(snapshot.currentAction);
    } catch (err: unknown) {
      const disposition = await requestDisposition();
      if (disposition !== 'commit') {
        if (disposition === 'retry') queueMicrotask(() => void load());
        return;
      }
      setError(learnerSafeErrorMessage(err, 'Could not load the starting-point report.'));
      setReport(null);
      setCurrentAction(null);
    } finally {
      if (await requestDisposition() === 'commit') setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
      loadRequestIdRef.current += 1;
      loadOwnerRef.current = null;
    };
  }, [load]);

  const runPrimaryAction = async () => {
    if (!currentAction || currentAction.kind !== 'current') return;
    if (currentAction.effect !== 'start_recap') {
      router.push(currentAction.url);
      return;
    }
    if (!report || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setError('');
    let recapStarted = false;
    try {
      await startSchoolRecap();
      recapStarted = true;
      const refreshedState = await getSchoolState({ force: true });
      const refreshedAction = resolveSchoolPlacementReportAction(report, refreshedState);
      if (refreshedAction.kind !== 'current') throw new Error('school_state_unresolved');
      setCurrentAction(refreshedAction);
      router.push(refreshedAction.url);
    } catch (err: unknown) {
      setError(learnerSafeErrorMessage(
        err,
        recapStarted
          ? 'The foundation path started, but its current route could not be confirmed. Reloading the saved School state.'
          : 'Could not start the foundation path.',
      ));
      if (recapStarted) queueMicrotask(() => void load());
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  return (
    <div className="mode-school min-h-[100dvh] bg-background font-body text-slate-950">
      {loading ? <SchoolReportSkeleton /> : report && currentAction ? (
        <PlacementReportContent
          report={report}
          currentAction={currentAction}
          starting={starting}
          error={error}
          onBack={() => router.push('/school')}
          onPrimaryAction={() => void runPrimaryAction()}
          onRetry={() => void load()}
        />
      ) : (
        <main className="mx-auto flex min-h-[calc(100dvh-68px)] w-full max-w-[760px] items-center px-4 py-16 sm:px-8">
          <section className="w-full border-y border-red-200 py-8" role="alert">
            <div className="flex items-start gap-3 text-red-800">
              <ExclamationTriangleIcon className="mt-1 h-5 w-5 flex-none" aria-hidden="true" />
              <div className="min-w-0">
                <h1 className="font-display text-[2.3rem] font-normal leading-[1.05] text-slate-950">We could not open your starting-point report</h1>
                <p className="mt-3 text-sm leading-6 text-slate-600">{error || 'No saved starting-point report is available yet.'}</p>
                <button type="button" onClick={() => void load()} className={`${schoolPrimaryActionClass} mt-6`}>
                  <ReloadIcon className="h-4 w-4" aria-hidden="true" />
                  Retry
                </button>
              </div>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
