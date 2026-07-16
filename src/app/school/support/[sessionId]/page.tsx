"use client";

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowRightIcon,
  ExclamationTriangleIcon,
  PersonIcon,
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
import { learnerSafeErrorMessage } from '@/lib/errorCopy';
import { resolveSchoolStateDestination } from '@/lib/schoolActivityPolicy';
import { getSchoolAvatarTheme } from '@/lib/schoolTheme';
import {
  continueSchoolCurriculumAfterSupportCap,
  getSchoolState,
  getSchoolSupportPlan,
  type SchoolState,
  type SchoolSupportPlan,
} from '@/services/schoolRebuild';

interface SupportSnapshot {
  state: SchoolState;
  supportPlan: SchoolSupportPlan | null;
}

async function loadSupportSnapshot(sessionId: string): Promise<SupportSnapshot> {
  const state = await getSchoolState({ force: true });
  if (state.profile_status === 'unauthenticated') {
    return { state, supportPlan: null };
  }
  const destination = resolveSchoolStateDestination({
    nextAction: state.next_action,
    allowedNextActions: state.allowed_next_actions,
    nextActionUrl: state.next_action_url,
  });
  if (!destination) throw new Error('school_state_unresolved');
  if (destination !== `/school/support/${sessionId}`) {
    return { state, supportPlan: null };
  }
  if (state.active_session_id !== sessionId || state.active_flow !== 'support') {
    throw new Error('school_support_session_mismatch');
  }

  const supportPlan = await getSchoolSupportPlan(sessionId);
  if (
    supportPlan.session_id !== sessionId
    || supportPlan.flow_type !== 'support'
    || supportPlan.profile_version_id !== state.profile_version_id
  ) {
    throw new Error('school_support_session_mismatch');
  }
  return { state, supportPlan };
}

export default function SchoolSupportPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = params.sessionId;
  const [snapshot, setSnapshot] = useState<SupportSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await loadSupportSnapshot(sessionId);
      if (next.state.profile_status === 'unauthenticated') {
        router.replace('/auth/login');
        return;
      }
      const destination = resolveSchoolStateDestination({
        nextAction: next.state.next_action,
        allowedNextActions: next.state.allowed_next_actions,
        nextActionUrl: next.state.next_action_url,
      });
      if (!destination) throw new Error('school_state_unresolved');
      if (destination !== `/school/support/${sessionId}`) {
        router.replace(destination);
        return;
      }
      if (!next.supportPlan) throw new Error('school_support_session_mismatch');
      setSnapshot(next);
    } catch (loadError: unknown) {
      setSnapshot(null);
      setError(loadError instanceof Error && loadError.message === 'school_support_session_mismatch'
        ? 'This support plan is not part of your active School path.'
        : learnerSafeErrorMessage(loadError, 'Could not load this support plan.'));
    } finally {
      setLoading(false);
    }
  }, [router, sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const continueLesson = useCallback(async () => {
    setContinuing(true);
    setError('');
    try {
      const continued = await continueSchoolCurriculumAfterSupportCap(sessionId);
      if (continued.session_id !== sessionId) {
        throw new Error('school_support_session_mismatch');
      }
      router.replace(`/school/session/${continued.session_id}`);
    } catch (continueError: unknown) {
      setError(learnerSafeErrorMessage(
        continueError,
        'Could not continue this lesson yet. Your saved work is still safe.',
      ));
    } finally {
      setContinuing(false);
    }
  }, [router, sessionId]);

  if (loading) return <SchoolReportSkeleton />;

  const supportPlan = snapshot?.supportPlan ?? null;
  const theme = getSchoolAvatarTheme(
    supportPlan?.coach_avatar_id,
    supportPlan?.coach_palette_id,
  );
  const supportVisitCount = supportPlan?.history.length ?? 0;
  const capUsed = supportPlan?.cap.used;
  const capLimit = supportPlan?.cap.limit;
  const subjectLabel = supportPlan?.subject_id
    ? supportPlan.subject_id.charAt(0).toUpperCase() + supportPlan.subject_id.slice(1)
    : 'School';

  return (
    <div className="mode-school min-h-[100dvh] bg-background font-body text-slate-950" style={theme.style}>
      {snapshot && supportPlan ? (
        <main className="mx-auto w-full max-w-[1180px] overflow-x-hidden px-5 pb-24 pt-14 sm:px-8 sm:pt-16 lg:px-12">
          <header className="grid gap-7 border-b border-slate-200 pb-9 md:grid-cols-[minmax(0,1fr)_280px] md:items-end">
            <SchoolPageHeading
              eyebrow="Support plan"
              title="A different route will help here."
              description={`Your Class ${supportPlan.target_class_no} ${subjectLabel} work is saved. Repeating the same support loop would not be useful, so this plan records the skill that still needs attention.`}
            />
            <SchoolCoachPanel
              avatarId={supportPlan.coach_avatar_id}
              paletteId={supportPlan.coach_palette_id}
              status="Pause and plan"
              note="Nothing is lost. This pause prevents repeated practice from pretending the skill is ready."
              compact
            />
          </header>

          <section className="grid gap-6 border-b border-slate-200 py-8 md:grid-cols-[220px_minmax(0,1fr)]" aria-labelledby="support-now-heading">
            <div>
              <SchoolStatusChip tone="support">Extra support needed</SchoolStatusChip>
              <h2 id="support-now-heading" className="mt-3 font-display text-[2rem] font-normal leading-tight">What is saved</h2>
            </div>
            <dl className="divide-y divide-slate-200 border-y border-slate-200 text-sm">
              <div className="grid gap-1 py-4 sm:grid-cols-[150px_minmax(0,1fr)]">
                <dt className="text-slate-500">Learning area</dt>
                <dd className="font-semibold text-slate-950">Class {supportPlan.target_class_no} {subjectLabel}</dd>
              </div>
              <div className="grid gap-1 py-4 sm:grid-cols-[150px_minmax(0,1fr)]">
                <dt className="text-slate-500">Current focus</dt>
                <dd className="font-semibold text-slate-950">{supportPlan.focus || 'A saved skill needs a revised support plan.'}</dd>
              </div>
              <div className="grid gap-1 py-4 sm:grid-cols-[150px_minmax(0,1fr)]">
                <dt className="text-slate-500">Why learning paused</dt>
                <dd className="leading-6 text-slate-700">
                  {supportPlan.reason === 'masterclass_cap_exceeded' && capUsed !== undefined && capLimit !== undefined
                    ? `The focused-practice limit was reached after ${capUsed} of ${capLimit} saved support visits.`
                    : 'The saved checks did not provide enough independent evidence to continue safely.'}
                </dd>
              </div>
              <div className="grid gap-1 py-4 sm:grid-cols-[150px_minmax(0,1fr)]">
                <dt className="text-slate-500">Saved history</dt>
                <dd className="leading-6 text-slate-700">
                  {supportVisitCount === 1 ? '1 support event is recorded.' : `${supportVisitCount} support events are recorded.`}
                </dd>
              </div>
            </dl>
          </section>

          <section className="py-8" aria-labelledby="support-next-heading">
            <SchoolPageHeading
              eyebrow="Next step"
              title="Review the evidence before choosing more practice."
              description="The learner report keeps this supportive. The parent view includes the detailed attention signal and support history."
              level="h2"
              size="section"
              id="support-next-heading"
            />
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {supportPlan.reason === 'masterclass_cap_exceeded' && supportPlan.parent_flow_type === 'curriculum' ? (
                <button
                  type="button"
                  onClick={() => void continueLesson()}
                  disabled={continuing}
                  className={schoolPrimaryActionClass}
                >
                  {continuing ? 'Continuing lesson' : 'Continue this lesson'}
                  {!continuing ? <ArrowRightIcon className="h-4 w-4" aria-hidden="true" /> : null}
                </button>
              ) : null}
              <button type="button" onClick={() => router.push('/school/reports')} className={schoolSecondaryActionClass}>
                See learner report <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => router.push('/school/parent')} className={schoolSecondaryActionClass}>
                <PersonIcon className="h-4 w-4" aria-hidden="true" /> Open parent view
              </button>
            </div>
            {error ? <p role="alert" className="mt-4 text-sm font-medium text-red-800">{error}</p> : null}
          </section>

          <SchoolDisclosure title="Why Zidd stopped the automatic loop" summary="The rule behind this support plan">
            <p>
              Focused practice is deliberately limited. When the same skill still needs help after the saved support visits, Zidd records the gap instead of repeatedly branching or inflating progress.
            </p>
          </SchoolDisclosure>
        </main>
      ) : (
        <main className="mx-auto flex min-h-[100dvh] w-full max-w-2xl items-center px-5 py-28 sm:px-8">
          <section role="alert" className="w-full border-y border-red-200 py-8">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-700" aria-hidden="true" />
            <SchoolPageHeading eyebrow="Support unavailable" title="Your saved School work is still safe." description={error} />
            <button type="button" onClick={() => void load()} className={`${schoolPrimaryActionClass} mt-6`}>
              <ReloadIcon className="h-4 w-4" aria-hidden="true" /> Try again
            </button>
          </section>
        </main>
      )}
    </div>
  );
}
