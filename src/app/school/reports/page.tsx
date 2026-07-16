"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExclamationTriangleIcon, ReloadIcon } from '@radix-ui/react-icons';
import { SchoolReportSkeleton } from '@/components/learning/LearningSkeletons';
import { SchoolPageHeading, schoolPrimaryActionClass } from '@/components/school/SchoolPrimitives';
import { LearnerGrowthSummary } from '@/components/school/reports/LearnerGrowthSummary';
import { reportPlacementContinuationOverride } from '@/components/school/reports/reportEvidence.mjs';
import { resolveSchoolStateDestination } from '@/lib/schoolActivityPolicy';
import { learnerSafeErrorMessage } from '@/lib/errorCopy';
import {
  createSchoolRouteLoadSingleFlight,
  schoolRouteLoadDisposition,
  schoolRouteLoadKey,
  type SchoolRouteLoadOwner,
} from '@/lib/schoolRouteLoadPolicy';
import {
  getSchoolClassMap,
  getSchoolCurriculumSession,
  getSchoolLoadScope,
  getSchoolMasterclass,
  getSchoolPlacement,
  getSchoolOnboarding,
  getSchoolPlacementReport,
  getSchoolState,
  getSchoolSupportPlan,
  type SchoolCoachIdentity,
  type SchoolClassMap,
  type SchoolCurriculumSession,
  type SchoolPlacementReport,
  type SchoolState,
  type SchoolSupportPlan,
} from '@/services/schoolRebuild';

interface LearnerReportSnapshot {
  state: SchoolState;
  placementReport: SchoolPlacementReport | null;
  classMap: SchoolClassMap | null;
  curriculumSession: SchoolCurriculumSession | null;
  supportPlan: SchoolSupportPlan | null;
  activeCoachIdentity: SchoolCoachIdentity | null;
  learnerName: string | null;
  nextStepOverride: {
    heading: string;
    actionLabel: string;
    message: string;
  } | null;
  limitations: string[];
}

interface LearnerEvidence<T> {
  value: T | null;
  limitation?: string;
}

const learnerReportLoadSingleFlight = createSchoolRouteLoadSingleFlight<LearnerReportSnapshot>();

async function loadLearnerReportSnapshot(): Promise<LearnerReportSnapshot> {
  const state = await getSchoolState({ force: true });
  if (state.profile_status === 'unauthenticated') {
    return {
      state,
      placementReport: null,
      classMap: null,
      curriculumSession: null,
      supportPlan: null,
      activeCoachIdentity: null,
      learnerName: null,
      nextStepOverride: null,
      limitations: [],
    };
  }

  const placementPromise: Promise<LearnerEvidence<SchoolPlacementReport>> = (
    ['below_target', 'target_ready', 'insufficient_evidence'].includes(state.placement_status)
      ? getSchoolPlacementReport()
        .then((value) => ({ value }))
        .catch(() => ({
          value: null,
          limitation: 'Your placement summary could not be loaded, so this page is not making placement claims right now.',
        }))
      : Promise.resolve({
        value: null,
        limitation: 'A completed placement report is not available yet.',
      })
  );
  const activeClassNo = state.active_learning_class_no ?? state.target_class_no;
  const classMapPromise: Promise<LearnerEvidence<SchoolClassMap>> = (
    state.subject_id && activeClassNo && state.unlock_state === 'target_unlocked'
      ? getSchoolClassMap(state.subject_id, activeClassNo)
        .then((value) => ({ value }))
        .catch(() => ({
          value: null,
          limitation: 'The active class map could not be loaded, so chapter progress is not shown.',
        }))
      : Promise.resolve({
        value: null,
        limitation: 'Chapter achievements appear after the target class is unlocked.',
      })
  );
  const learningPromise: Promise<LearnerEvidence<{
    curriculumSession: SchoolCurriculumSession | null;
    supportPlan: SchoolSupportPlan | null;
    activeCoachIdentity: SchoolCoachIdentity | null;
  }>> = (async () => {
    if (!state.active_session_id || !['curriculum', 'masterclass', 'support'].includes(state.active_flow)) {
      return { value: { curriculumSession: null, supportPlan: null, activeCoachIdentity: null } };
    }
    try {
      if (state.active_flow === 'support') {
        const supportPlan = await getSchoolSupportPlan(state.active_session_id);
        if (
          supportPlan.session_id !== state.active_session_id
          || supportPlan.profile_version_id !== state.profile_version_id
        ) {
          throw new Error('school_support_session_mismatch');
        }
        return {
          value: { curriculumSession: null, supportPlan, activeCoachIdentity: supportPlan },
        };
      }
      if (state.active_flow === 'masterclass') {
        const masterclass = await getSchoolMasterclass(state.active_session_id);
        return {
          value: {
            curriculumSession: await getSchoolCurriculumSession(masterclass.linked_curriculum_session_id),
            supportPlan: null,
            activeCoachIdentity: masterclass,
          },
        };
      }
      const curriculumSession = await getSchoolCurriculumSession(state.active_session_id);
      return {
        value: { curriculumSession, supportPlan: null, activeCoachIdentity: curriculumSession },
      };
    } catch {
      return {
        value: null,
        limitation: 'Current lesson evidence could not be loaded, so this report is not naming lesson-level strengths or gaps.',
      };
    }
  })();
  const learnerNamePromise = getSchoolOnboarding()
    .then((onboarding) => onboarding.active_profile?.display_name?.trim() || null)
    .catch(() => null);
  const activePlacementPromise = state.active_flow === 'placement' && state.active_session_id
    ? getSchoolPlacement(state.active_session_id).catch(() => null)
    : Promise.resolve(null);
  const [placement, classMap, learning, learnerName, activePlacement] = await Promise.all([
    placementPromise,
    classMapPromise,
    learningPromise,
    learnerNamePromise,
    activePlacementPromise,
  ]);
  return {
    state,
    placementReport: placement.value,
    classMap: classMap.value,
    curriculumSession: learning.value?.curriculumSession ?? null,
    supportPlan: learning.value?.supportPlan ?? null,
    activeCoachIdentity: learning.value?.activeCoachIdentity ?? null,
    learnerName,
    nextStepOverride: reportPlacementContinuationOverride(state, activePlacement),
    limitations: [placement.limitation, classMap.limitation, learning.limitation]
      .filter((value): value is string => Boolean(value)),
  };
}

export default function SchoolReportsPage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<LearnerReportSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const mountedRef = useRef(false);
  const loadRequestIdRef = useRef(0);
  const loadOwnerRef = useRef<SchoolRouteLoadOwner | null>(null);

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
      const nextSnapshot = await learnerReportLoadSingleFlight.run(
        loadLearnerReportSnapshot,
        schoolRouteLoadKey(scope, 'learner-report'),
      );
      const disposition = await requestDisposition();
      if (disposition !== 'commit') {
        if (disposition === 'retry') queueMicrotask(() => void load());
        return;
      }
      if (nextSnapshot.state.profile_status === 'unauthenticated') {
        router.replace('/auth/login');
        return;
      }
      setSnapshot(nextSnapshot);
    } catch (err: unknown) {
      const disposition = await requestDisposition();
      if (disposition !== 'commit') {
        if (disposition === 'retry') queueMicrotask(() => void load());
        return;
      }
      setError(learnerSafeErrorMessage(err, 'Could not load your growth report. Please retry.'));
      setSnapshot(null);
    } finally {
      if (await requestDisposition() === 'commit') {
        setLoading(false);
      }
    }
  }, [router]);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
      loadRequestIdRef.current += 1;
      loadOwnerRef.current = null;
    };
  }, [load]);

  const followAuthoritativeState = () => {
    if (!snapshot) return;
    const destination = resolveSchoolStateDestination({
      nextAction: snapshot.state.next_action,
      allowedNextActions: snapshot.state.allowed_next_actions,
      nextActionUrl: snapshot.state.next_action_url,
    });
    if (!destination) {
      setError('School Prep has not authorized a next step yet.');
      return;
    }
    router.push(destination);
  };

  return (
    <div className="mode-school min-h-[100dvh] bg-background font-body text-slate-950">
      {loading ? <SchoolReportSkeleton /> : snapshot ? (
        <LearnerGrowthSummary
          state={snapshot.state}
          placementReport={snapshot.placementReport}
          classMap={snapshot.classMap}
          curriculumSession={snapshot.curriculumSession}
          supportPlan={snapshot.supportPlan}
          activeCoachIdentity={snapshot.activeCoachIdentity}
          learnerName={snapshot.learnerName}
          nextStepOverride={snapshot.nextStepOverride}
          limitations={snapshot.limitations}
          onNextAction={snapshot.nextStepOverride ? () => void load() : followAuthoritativeState}
          onOpenClassMap={() => {
            const classNo = snapshot.classMap?.class_no;
            router.push(classNo ? `/school/classes/${classNo}` : '/school');
          }}
          onOpenParentView={() => router.push('/school/parent')}
        />
      ) : (
        <main className="mx-auto flex min-h-[100dvh] w-full max-w-[760px] items-center overflow-x-hidden px-5 py-28 sm:px-8">
          <section className="w-full border-y border-red-200 py-8" role="alert" aria-live="polite">
            <div className="flex items-start gap-4">
              <ExclamationTriangleIcon className="mt-1 h-5 w-5 flex-none text-red-700" aria-hidden="true" />
              <div className="min-w-0">
                <SchoolPageHeading
                  eyebrow="Report unavailable"
                  title="We could not open your growth report."
                  description={error || 'No saved School evidence is available yet.'}
                />
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
