"use client";

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowRightIcon,
  ExclamationTriangleIcon,
  ReloadIcon,
} from '@radix-ui/react-icons';
import { SchoolReportSkeleton } from '@/components/learning/LearningSkeletons';
import {
  SchoolPageHeading,
  SchoolStatusChip,
  schoolPrimaryActionClass,
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
  const subjectLabel = supportPlan?.subject_id
    ? supportPlan.subject_id.charAt(0).toUpperCase() + supportPlan.subject_id.slice(1)
    : 'School';

  return (
    <div className="mode-school min-h-[100dvh] bg-background font-body text-slate-950" style={theme.style}>
      {snapshot && supportPlan ? (
        <main className="mx-auto w-full max-w-[1180px] overflow-x-hidden px-5 pb-24 pt-14 sm:px-8 sm:pt-16 lg:px-12">
          <header className="max-w-[820px] border-b border-slate-200 pb-9">
            <SchoolPageHeading
              eyebrow="Support plan"
              title="Let’s try this a different way."
              description="Your current goal and progress are saved. We’ll change the explanation and take the next step more slowly."
            />
          </header>

          <section className="grid gap-6 border-b border-slate-200 py-8 md:grid-cols-[220px_minmax(0,1fr)]" aria-labelledby="support-now-heading">
            <div>
              <SchoolStatusChip tone="support">Extra support needed</SchoolStatusChip>
              <h2 id="support-now-heading" className="mt-3 font-display text-[2rem] font-normal leading-tight">{supportPlan.focus || 'One skill needs a different explanation'}</h2>
            </div>
            <dl className="divide-y divide-slate-200 border-y border-slate-200 text-sm">
              <div className="grid gap-1 py-4 sm:grid-cols-[150px_minmax(0,1fr)]">
                <dt className="font-mono text-[10px] font-semibold uppercase text-slate-500">Saved goal</dt>
                <dd className="leading-6 text-slate-700">
                  Build confidence with {supportPlan.focus || `this Class ${supportPlan.target_class_no} ${subjectLabel} skill`}.
                </dd>
              </div>
              <div className="grid gap-1 py-4 sm:grid-cols-[150px_minmax(0,1fr)]">
                <dt className="font-mono text-[10px] font-semibold uppercase text-slate-500">What we noticed</dt>
                <dd className="leading-6 text-slate-700">
                  The last few tries still needed help, so repeating the same explanation would not be useful.
                </dd>
              </div>
              <div className="grid gap-1 py-4 sm:grid-cols-[150px_minmax(0,1fr)]">
                <dt className="font-mono text-[10px] font-semibold uppercase text-slate-500">What changes next</dt>
                <dd className="leading-6 text-slate-700">A new example, one smaller step at a time, and a fresh check when you are ready.</dd>
              </div>
            </dl>
          </section>

          <section className="py-8" aria-labelledby="support-next-heading">
            <SchoolPageHeading
              eyebrow="Next step"
              title={supportPlan.reason === 'masterclass_cap_exceeded' && supportPlan.parent_flow_type === 'curriculum'
                ? 'Continue when you are ready.'
                : 'See what to practise next.'}
              description="There is no lost work and no penalty for taking a different route."
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
              ) : (
                <button type="button" onClick={() => router.push('/school/reports')} className={schoolPrimaryActionClass}>
                  See my learning plan <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
            {error ? <p role="alert" className="mt-4 text-sm font-medium text-red-800">{error}</p> : null}
          </section>
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
