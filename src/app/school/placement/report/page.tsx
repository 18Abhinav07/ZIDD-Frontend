"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircledIcon,
  ExclamationTriangleIcon,
  ReloadIcon,
} from '@radix-ui/react-icons';
import { SchoolReportSkeleton } from '@/components/learning/LearningSkeletons';
import { SchoolCoachPanel } from '@/components/school/SchoolCoachPanel';
import {
  SchoolDisclosure,
  SchoolPageHeading,
  SchoolStatusChip,
  schoolPrimaryActionClass,
  schoolSecondaryActionClass,
} from '@/components/school/SchoolPrimitives';
import { AppHeader } from '@/components/shared/AppHeader';
import { learnerSafeErrorMessage } from '@/lib/errorCopy';
import {
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
  if (report.placement_status === 'insufficient_evidence') return 'More answers are needed';
  return 'More answers are needed';
}

function conclusionTone(report: SchoolPlacementReport): 'success' | 'support' | 'neutral' {
  if (report.placement_status === 'target_ready') return 'success';
  if (report.placement_status === 'below_target') return 'support';
  return 'neutral';
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
  return {
    report,
    currentAction: resolveSchoolPlacementReportAction(report, state),
  };
}

function PlacementReportContent({
  report,
  currentAction,
  starting,
  error,
  onBack,
  onPrimaryAction,
}: {
  report: SchoolPlacementReport;
  currentAction: SchoolPlacementReportAction;
  starting: boolean;
  error: string;
  onBack: () => void;
  onPrimaryAction: () => void;
}) {
  const theme = getSchoolAvatarTheme(report.coach_avatar_id, report.coach_palette_id);
  const stageEvidence = Object.entries(report.evidence_summary.stage_counts)
    .filter(([, count]) => count > 0)
    .map(([stage, count]) => ({ stage: placementStageLabel(stage), count }));

  const nextReason = currentAction.learnerMessage;

  return (
    <main
      className="mx-auto min-h-[100dvh] w-full max-w-[1160px] overflow-x-hidden px-5 pb-24 pt-28 sm:px-8 lg:px-12"
      style={theme.style}
    >
      <SchoolPageHeading
        eyebrow="Starting-point report"
        title={report.learner_summary}
        description="This is the conclusion from your saved answers, not a school mark."
      />

      <section className="mt-8 grid gap-7 border-y border-slate-200 py-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-stretch" aria-label="Placement result">
        <div className="min-w-0">
          <SchoolStatusChip tone={conclusionTone(report)}>{conclusionLabel(report)}</SchoolStatusChip>

          <dl className="mt-6 divide-y divide-slate-200 border-y border-slate-200 text-sm">
            <div className="flex flex-wrap justify-between gap-2 py-3">
              <dt className="text-slate-500">Target class</dt>
              <dd className="font-semibold text-slate-900">Class {report.target_class_no}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 py-3">
              <dt className="text-slate-500">Starting point evaluated</dt>
              <dd className="font-semibold text-slate-900">Class {report.evaluated_class_no}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 py-3">
              <dt className="text-slate-500">Learning begins in</dt>
              <dd className="font-semibold text-slate-900">Class {report.active_learning_class_no}</dd>
            </div>
          </dl>

          <div className="mt-7 rounded-2xl border border-[var(--school-accent-border)] bg-[var(--school-accent-soft)] p-5">
            <p className="text-[11px] font-semibold uppercase text-[var(--school-accent-deep)]">One next step</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">{nextReason}</p>
            {error ? <p role="alert" className="mt-3 text-sm font-semibold text-red-800">{error}</p> : null}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              {currentAction.kind === 'current' ? (
                <button
                  type="button"
                  onClick={onPrimaryAction}
                  disabled={starting && currentAction.effect === 'start_recap'}
                  aria-busy={starting && currentAction.effect === 'start_recap'}
                  className={schoolPrimaryActionClass}
                >
                  <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                  {starting && currentAction.effect === 'start_recap'
                    ? 'Opening foundation path'
                    : currentAction.label}
                </button>
              ) : (
                <p className="text-sm font-medium text-slate-700">Current School action unavailable. This report remains historical.</p>
              )}
              <button type="button" onClick={onBack} className={schoolSecondaryActionClass}>
                <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
                Back to School
              </button>
            </div>
          </div>
        </div>

        <aside className="h-[280px] lg:h-auto lg:min-h-[420px]" aria-label="Starting-point coach">
          <SchoolCoachPanel
            avatarId={report.coach_avatar_id}
            paletteId={report.coach_palette_id}
            status={conclusionLabel(report)}
            note={nextReason}
          />
        </aside>
      </section>

      <section className="mt-10 max-w-[900px]" aria-label="Placement report details">
        <SchoolPageHeading
          eyebrow="Report details"
          title="See the evidence when you need it."
          description="The conclusion stays first. Open any section for the saved detail behind it."
          level="h2"
          size="section"
        />

        <div className="mt-6">
          <SchoolDisclosure title="Parent summary" summary="A concise explanation for a parent or guardian">
            <p>{report.parent_summary}</p>
          </SchoolDisclosure>

          <SchoolDisclosure title="How this starting point was chosen" summary="Evidence method and current School state">
            <p>{placementBasisCopy(report.evidence_summary.scoring_source)}</p>
            <div className="mt-4">
              <p className="font-semibold text-slate-900">Current next step</p>
              <p className="mt-2">
                {currentAction.kind === 'current'
                  ? currentAction.label
                  : 'Open School to confirm the current next step.'}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                This comes from your latest School state, so an older report cannot override your current path.
              </p>
            </div>
          </SchoolDisclosure>

          <SchoolDisclosure title="Saved answer details" summary={`${report.evidence_summary.total_attempts} saved answers were used`}>
            <dl className="divide-y divide-slate-200 border-y border-slate-200">
              <div className="flex justify-between gap-4 py-3"><dt>Saved answers used</dt><dd className="font-semibold text-slate-900">{report.evidence_summary.total_attempts}</dd></div>
              <div className="flex justify-between gap-4 py-3"><dt>Strong checks</dt><dd className="font-semibold text-slate-900">{report.evidence_summary.correct_attempts}</dd></div>
              <div className="flex justify-between gap-4 py-3"><dt>Needs another look</dt><dd className="font-semibold text-slate-900">{report.evidence_summary.incorrect_attempts}</dd></div>
            </dl>
            {stageEvidence.length > 0 ? (
              <ul className="mt-4 space-y-2" aria-label="Evidence gathered by stage">
                {stageEvidence.map((entry) => (
                  <li key={entry.stage} className="flex items-center gap-2">
                    <CheckCircledIcon className="h-4 w-4 text-teal-700" aria-hidden="true" />
                    {entry.stage}: {entry.count}
                  </li>
                ))}
              </ul>
            ) : null}
          </SchoolDisclosure>

          <SchoolDisclosure title="Skills to strengthen" summary={`${report.blocking_skills.length} blocking ${report.blocking_skills.length === 1 ? 'skill' : 'skills'} recorded`}>
            {report.blocking_skills.length > 0 ? (
              <div className="divide-y divide-slate-200 border-y border-slate-200">
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
                  {report.recommended_recap_modules.map((module) => (
                    <li key={module.module_id}>{module.title}: {module.focus}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </SchoolDisclosure>

          <SchoolDisclosure title="Skills to keep watching" summary={`${report.watchlist_skills.length} ${report.watchlist_skills.length === 1 ? 'skill' : 'skills'} on the watchlist`}>
            {report.watchlist_skills.length > 0 ? (
              <ul className="divide-y divide-slate-200 border-y border-slate-200">
                {report.watchlist_skills.map((skill) => (
                  <li key={`${skill.label}-${skill.source_class_no}`} className="py-4">
                    <p className="font-semibold text-slate-950">{skill.label}</p>
                    <p className="mt-1">Your coach will check this Class {skill.source_class_no} skill again inside lessons.</p>
                  </li>
                ))}
              </ul>
            ) : <p>No additional watchlist skill was recorded.</p>}
          </SchoolDisclosure>
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
        return schoolRouteLoadDisposition(
          loadOwnerRef.current,
          requestOwner,
          mountedRef.current,
          currentScope,
        );
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
      if (await requestDisposition() === 'commit') {
        setLoading(false);
      }
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
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setError('');
    try {
      await startSchoolRecap();
      router.push(currentAction.url);
    } catch (err: unknown) {
      setError(learnerSafeErrorMessage(err, 'Could not start the foundation path.'));
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  return (
    <div className="mode-school min-h-[100dvh] bg-background font-body text-slate-950">
      <AppHeader title="Starting-point report" appearance="school" showCredits={false} />
      {loading ? <SchoolReportSkeleton /> : report && currentAction ? (
        <PlacementReportContent
          report={report}
          currentAction={currentAction}
          starting={starting}
          error={error}
          onBack={() => router.push('/school')}
          onPrimaryAction={() => void runPrimaryAction()}
        />
      ) : (
        <main className="mx-auto flex min-h-[100dvh] w-full max-w-[760px] items-center px-5 py-28 sm:px-8">
          <section className="w-full rounded-2xl border border-red-200 bg-[var(--school-surface,#fcfdff)] px-6 py-7" role="alert">
            <div className="flex items-start gap-3 text-red-800">
              <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
              <div className="min-w-0">
                <h1 className="font-display text-[2rem] font-normal leading-tight text-slate-950">We could not open your starting-point report</h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {error || 'No completed starting-point report is available yet.'}
                </p>
                <button type="button" onClick={() => void load()} className={`${schoolPrimaryActionClass} mt-5`}>
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
