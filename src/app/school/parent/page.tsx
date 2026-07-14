"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExclamationTriangleIcon, ReloadIcon } from '@radix-ui/react-icons';
import { SchoolReportSkeleton } from '@/components/learning/LearningSkeletons';
import { SchoolPageHeading, schoolPrimaryActionClass } from '@/components/school/SchoolPrimitives';
import { ParentGrowthReport } from '@/components/school/reports/ParentGrowthReport';
import { AppHeader } from '@/components/shared/AppHeader';
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
  getActiveSchoolRecap,
  getSchoolLoadScope,
  getSchoolMasterclass,
  getSchoolPlacementReport,
  getSchoolState,
  getSchoolSupportPlan,
  type SchoolCoachIdentity,
  type SchoolClassMap,
  type SchoolCurriculumSession,
  type SchoolPlacementReport,
  type SchoolRecapPath,
  type SchoolState,
  type SchoolSupportPlan,
} from '@/services/schoolRebuild';

interface ParentReportSnapshot {
  state: SchoolState;
  placementReport: SchoolPlacementReport | null;
  classMap: SchoolClassMap | null;
  curriculumSession: SchoolCurriculumSession | null;
  recapSession: SchoolRecapPath | null;
  supportPlan: SchoolSupportPlan | null;
  activeCoachIdentity: SchoolCoachIdentity | null;
  limitations: string[];
}

interface ParentEvidence<T> {
  value: T | null;
  limitation?: string;
}

const parentReportLoadSingleFlight = createSchoolRouteLoadSingleFlight<ParentReportSnapshot>();

async function loadParentReportSnapshot(): Promise<ParentReportSnapshot> {
  const state = await getSchoolState({ force: true });
  if (state.profile_status === 'unauthenticated') {
    return {
      state,
      placementReport: null,
      classMap: null,
      curriculumSession: null,
      recapSession: null,
      supportPlan: null,
      activeCoachIdentity: null,
      limitations: [],
    };
  }

  const placementPromise: Promise<ParentEvidence<SchoolPlacementReport>> = (
    ['below_target', 'target_ready', 'insufficient_evidence'].includes(state.placement_status)
      ? getSchoolPlacementReport()
        .then((value) => ({ value }))
        .catch(() => ({
          value: null,
          limitation: 'Placement evidence is temporarily unavailable, so no placement figures are shown.',
        }))
      : Promise.resolve({
        value: null,
        limitation: 'A completed placement report is not available yet.',
      })
  );
  const activeClassNo = state.active_learning_class_no ?? state.target_class_no;
  const classMapPromise: Promise<ParentEvidence<SchoolClassMap>> = (
    state.subject_id && activeClassNo && state.unlock_state === 'target_unlocked'
      ? getSchoolClassMap(state.subject_id, activeClassNo)
        .then((value) => ({ value }))
        .catch(() => ({
          value: null,
          limitation: 'The class catalog is temporarily unavailable, so chapter progress is not shown.',
        }))
      : Promise.resolve({ value: null })
  );
  const learningPromise: Promise<ParentEvidence<{
    curriculumSession: SchoolCurriculumSession | null;
    recapSession: SchoolRecapPath | null;
    supportPlan: SchoolSupportPlan | null;
    activeCoachIdentity: SchoolCoachIdentity | null;
  }>> = (async () => {
    if (!state.active_session_id || !['curriculum', 'masterclass', 'support', 'recap'].includes(state.active_flow)) {
      return {
        value: {
          curriculumSession: null,
          recapSession: null,
          supportPlan: null,
          activeCoachIdentity: null,
        },
      };
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
          value: {
            curriculumSession: null,
            recapSession: null,
            supportPlan,
            activeCoachIdentity: supportPlan,
          },
        };
      }
      if (state.active_flow === 'recap') {
        const recapSession = await getActiveSchoolRecap();
        if (recapSession.session_id !== state.active_session_id) {
          throw new Error('school_recap_session_mismatch');
        }
        return {
          value: {
            curriculumSession: null,
            recapSession,
            supportPlan: null,
            activeCoachIdentity: recapSession,
          },
        };
      }
      if (state.active_flow === 'curriculum') {
        const curriculumSession = await getSchoolCurriculumSession(state.active_session_id);
        return {
          value: {
            curriculumSession,
            recapSession: null,
            supportPlan: null,
            activeCoachIdentity: curriculumSession,
          },
        };
      }
      const masterclass = await getSchoolMasterclass(state.active_session_id);
      return {
        value: {
          curriculumSession: await getSchoolCurriculumSession(masterclass.linked_curriculum_session_id),
          recapSession: null,
          supportPlan: null,
          activeCoachIdentity: masterclass,
        },
      };
    } catch {
      return {
        value: null,
        limitation: state.active_flow === 'masterclass'
          ? 'The linked curriculum session could not be loaded, so current gaps and masterclass events are not shown.'
          : 'The active curriculum session could not be loaded, so current gaps and masterclass events are not shown.',
      };
    }
  })();

  const [placement, classMap, learning] = await Promise.all([
    placementPromise,
    classMapPromise,
    learningPromise,
  ]);
  return {
    state,
    placementReport: placement.value,
    classMap: classMap.value,
    curriculumSession: learning.value?.curriculumSession ?? null,
    recapSession: learning.value?.recapSession ?? null,
    supportPlan: learning.value?.supportPlan ?? null,
    activeCoachIdentity: learning.value?.activeCoachIdentity ?? null,
    limitations: [placement.limitation, classMap.limitation, learning.limitation]
      .filter((value): value is string => Boolean(value)),
  };
}

export default function SchoolParentPage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ParentReportSnapshot | null>(null);
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
      const nextSnapshot = await parentReportLoadSingleFlight.run(
        loadParentReportSnapshot,
        schoolRouteLoadKey(scope, 'parent-report'),
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
      setError(learnerSafeErrorMessage(err, 'Could not load the parent report. Please retry.'));
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
      <AppHeader title="Parent report" appearance="school" />
      {loading ? <SchoolReportSkeleton /> : snapshot ? (
        <ParentGrowthReport
          state={snapshot.state}
          placementReport={snapshot.placementReport}
          classMap={snapshot.classMap}
          curriculumSession={snapshot.curriculumSession}
          recapSession={snapshot.recapSession}
          supportPlan={snapshot.supportPlan}
          activeCoachIdentity={snapshot.activeCoachIdentity}
          limitations={snapshot.limitations}
          onNextAction={followAuthoritativeState}
          onOpenLearnerView={() => router.push('/school/reports')}
        />
      ) : (
        <main className="mx-auto flex min-h-[100dvh] w-full max-w-[760px] items-center overflow-x-hidden px-5 py-28 sm:px-8">
          <section className="w-full border-y border-red-200 py-8" role="alert" aria-live="polite">
            <div className="flex items-start gap-4">
              <ExclamationTriangleIcon className="mt-1 h-5 w-5 flex-none text-red-700" aria-hidden="true" />
              <div className="min-w-0">
                <SchoolPageHeading
                  eyebrow="Report unavailable"
                  title="We could not open the parent report."
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
