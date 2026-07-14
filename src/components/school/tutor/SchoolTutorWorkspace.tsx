"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExclamationTriangleIcon, ReloadIcon } from '@radix-ui/react-icons';
import { LearningWorkspace } from '@/components/learning/LearningWorkspace';
import { SchoolTutorSkeleton } from '@/components/learning/LearningSkeletons';
import { SchoolCoachPanel } from '@/components/school/SchoolCoachPanel';
import { schoolPrimaryActionClass, schoolSecondaryActionClass } from '@/components/school/SchoolPrimitives';
import { SchoolActivityRenderer, schoolActivityLabel } from '@/components/school/tutor/SchoolActivityRenderer';
import { SchoolProgressRail } from '@/components/school/tutor/SchoolProgressRail';
import { AppHeader } from '@/components/shared/AppHeader';
import { learnerSafeErrorMessage } from '@/lib/errorCopy';
import { getSchoolAvatarTheme } from '@/lib/schoolTheme';
import {
  CURRICULUM_REVALIDATE_MS,
  curriculumActivityView,
  resolveSchoolStateDestination,
  releaseSchoolTutorLoad,
  runCurriculumMutation,
  schoolCurriculumSessionOwnedByState,
  schoolTutorLoadDecision,
  schoolTutorLoadOwnedBy,
  startSingleFlightRevalidation,
  type SchoolTutorLoadOwner,
} from '@/lib/schoolActivityPolicy';
import {
  answerSchoolCurriculum,
  getSchoolCurriculumSession,
  getSchoolState,
  startSchoolCurriculumMasterclass,
  type SchoolCurriculumSession,
  type SchoolNextAction,
  type SchoolStateStatus,
} from '@/services/schoolRebuild';

interface SchoolTutorWorkspaceProps {
  sessionId: string;
}

export function SchoolTutorWorkspace({ sessionId }: SchoolTutorWorkspaceProps) {
  const router = useRouter();
  const [session, setSession] = useState<SchoolCurriculumSession | null>(null);
  const [schoolStatus, setSchoolStatus] = useState<SchoolStateStatus | null>(null);
  const [schoolNextAction, setSchoolNextAction] = useState<SchoolNextAction | null>(null);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [openingMasterclass, setOpeningMasterclass] = useState(false);
  const [error, setError] = useState('');
  const loadOwnerRef = useRef<SchoolTutorLoadOwner | null>(null);
  const loadRequestIdRef = useRef(0);
  const submitInFlightRef = useRef(false);
  const masterclassInFlightRef = useRef(false);

  const load = useCallback(async ({ background = false }: { background?: boolean } = {}) => {
    const decision = schoolTutorLoadDecision(loadOwnerRef.current, {
      sessionId,
      requestId: loadRequestIdRef.current + 1,
    });
    if (decision.kind === 'dedupe') return;
    const requestOwner = decision.owner;
    loadOwnerRef.current = requestOwner;
    loadRequestIdRef.current = requestOwner.requestId;
    if (!background) {
      setLoading(true);
      setError('');
    }

    try {
      const [state, nextSession] = await Promise.all([
        getSchoolState({ force: true }),
        getSchoolCurriculumSession(sessionId),
      ]);
      if (!schoolTutorLoadOwnedBy(loadOwnerRef.current, requestOwner)) return;
      const destination = resolveSchoolStateDestination({
        nextAction: state.next_action,
        allowedNextActions: state.allowed_next_actions,
        nextActionUrl: state.next_action_url,
      });
      if (!destination) throw new Error('school_state_unresolved');
      if (destination !== `/school/session/${sessionId}`) {
        router.replace(destination);
        return;
      }
      if (!schoolCurriculumSessionOwnedByState({
        activeSessionId: state.active_session_id,
        requestedSessionId: sessionId,
        fetchedSessionId: nextSession.session_id,
        status: nextSession.status,
        linkedMasterclassSessionId: nextSession.active_interrupt?.masterclass_session_id ?? null,
      })) {
        throw new Error('school_session_ownership_mismatch');
      }
      setSession(nextSession);
      setSchoolStatus(state.status);
      setSchoolNextAction(state.next_action);
      setError('');
    } catch (err: unknown) {
      if (!schoolTutorLoadOwnedBy(loadOwnerRef.current, requestOwner)) return;
      const ownershipMismatch = err instanceof Error && err.message === 'school_session_ownership_mismatch';
      if (!background || ownershipMismatch) {
        setSession(null);
        setSchoolStatus(null);
        setSchoolNextAction(null);
      }
      setError(ownershipMismatch
        ? 'Another School lesson is active. Return to your School path to continue safely.'
        : learnerSafeErrorMessage(err, 'Could not load this lesson. Please retry.'));
    } finally {
      const requestStillOwnsLoad = schoolTutorLoadOwnedBy(loadOwnerRef.current, requestOwner);
      loadOwnerRef.current = releaseSchoolTutorLoad(loadOwnerRef.current, requestOwner);
      if (!background && requestStillOwnsLoad) setLoading(false);
    }
  }, [router, sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activity = session?.current_activity ?? null;
  const activityView = curriculumActivityView({
    schoolStatus,
    sessionStatus: session?.status ?? null,
    phase: session?.phase ?? null,
    activityId: activity?.activity_id ?? null,
    canAnswer: activity?.can_answer === true,
  });

  useEffect(() => {
    if (!activityView.pollDue) return;
    const revalidator = startSingleFlightRevalidation({
      intervalMs: activityView.pollAfterMs ?? CURRICULUM_REVALIDATE_MS,
      revalidate: () => load({ background: true }),
      schedule: (callback, intervalMs) => window.setInterval(callback, intervalMs),
      cancelSchedule: (timer) => window.clearInterval(timer),
    });
    return () => revalidator.cancel();
  }, [activityView.pollAfterMs, activityView.pollDue, load]);

  const chapterMapHref = useMemo(() => session
    ? `/school/classes/${session.active_learning_class_no}/chapters/${session.chapter.chapter_id}`
    : '/school', [session]);

  const submit = async (value?: string) => {
    const activity = session?.current_activity;
    const finalAnswer = value ?? answer;
    if (
      !session
      || !activity
      || !activityView.canSubmit
      || !finalAnswer.trim()
      || submitting
      || submitInFlightRef.current
    ) return;

    submitInFlightRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      const refreshResult: { state: Awaited<ReturnType<typeof getSchoolState>> | null } = { state: null };
      const result = await runCurriculumMutation({
        mutate: () => answerSchoolCurriculum(session.session_id, activity.activity_id, finalAnswer),
        refreshState: async () => {
          refreshResult.state = await getSchoolState({ force: true });
          return refreshResult.state.status;
        },
        commitSession: (nextSession) => {
          if (nextSession.session_id !== sessionId) throw new Error('school_session_ownership_mismatch');
          setSession(nextSession);
          setAnswer('');
        },
        commitSchoolStatus: setSchoolStatus,
      });
      if (result.refreshFailed) {
        setError('Your answer is saved. The lesson status will refresh automatically.');
      } else if (refreshResult.state) {
        const refreshedState = refreshResult.state;
        setSchoolNextAction(refreshedState.next_action);
        const destination = resolveSchoolStateDestination({
          nextAction: refreshedState.next_action,
          allowedNextActions: refreshedState.allowed_next_actions,
          nextActionUrl: refreshedState.next_action_url,
        });
        if (destination && destination !== `/school/session/${sessionId}`) {
          router.replace(destination);
        }
      }
    } catch (err: unknown) {
      const staleAnswer = err instanceof Error && err.message === 'stale_curriculum_answer';
      if (staleAnswer) {
        setAnswer('');
        await load({ background: true });
      } else {
        setError(learnerSafeErrorMessage(err, 'Could not check that answer. Please retry.'));
      }
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const openMasterclass = async () => {
    if (
      !session?.active_interrupt
      || schoolNextAction !== 'start_masterclass'
      || openingMasterclass
      || masterclassInFlightRef.current
    ) return;
    masterclassInFlightRef.current = true;
    setOpeningMasterclass(true);
    setError('');
    try {
      const existingId = session.active_interrupt.masterclass_session_id;
      if (existingId) throw new Error('school_state_unresolved');
      await startSchoolCurriculumMasterclass(session.session_id);
      const state = await getSchoolState({ force: true });
      const destination = resolveSchoolStateDestination({
        nextAction: state.next_action,
        allowedNextActions: state.allowed_next_actions,
        nextActionUrl: state.next_action_url,
      });
      if (!destination) throw new Error('school_state_unresolved');
      router.push(destination);
    } catch (err: unknown) {
      setError(learnerSafeErrorMessage(err, 'Could not open focused practice. Please retry.'));
    } finally {
      masterclassInFlightRef.current = false;
      setOpeningMasterclass(false);
    }
  };

  if (loading) return <SchoolTutorSkeleton />;

  if (!session) {
    return (
      <div className="mode-school min-h-[100dvh] bg-background font-body text-slate-950">
        <AppHeader title="School Prep" appearance="school" showCredits={false} />
        <main className="mx-auto flex min-h-[100dvh] max-w-2xl items-center px-5 py-28 sm:px-8">
          <section role="alert" className="w-full rounded-lg border border-red-200 bg-white p-6">
            <div className="flex gap-3">
              <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-none text-red-700" aria-hidden="true" />
              <div className="min-w-0">
                <h1 className="font-display text-2xl font-normal">Lesson unavailable</h1>
                <p className="mt-2 break-words text-sm font-semibold leading-6 text-slate-600">{error}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" onClick={() => void load()} className={schoolPrimaryActionClass}>
                    <ReloadIcon className="h-4 w-4" aria-hidden="true" /> Retry
                  </button>
                  <button type="button" onClick={() => router.push('/school')} className={schoolSecondaryActionClass}>
                    Return to School
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const currentLevel = session.levels[session.progress.current_level_index] ?? null;
  const learnerStage = currentLevel?.title
    || (activity ? schoolActivityLabel(activity.kind) : 'Chapter learning');
  const coachStatus = session.phase === 'paused_for_masterclass'
    ? 'Focused practice'
    : activityView.kind === 'pending'
      ? 'Reviewing your answer'
      : activityView.kind === 'support'
        ? 'Support is ready'
        : activityView.kind === 'complete'
          ? 'Chapter complete'
          : activity
            ? schoolActivityLabel(activity.kind)
            : 'Your lesson';
  const coachNote = activity?.focus
    || currentLevel?.teaching_goal
    || session.chapter.unit_title;
  const headerMeta = session.phase === 'chapter_check' && session.chapter_assessment
    ? `Question ${session.chapter_assessment.item_number} of ${session.chapter_assessment.total_items}`
    : `${session.progress.completed_levels} of ${session.progress.total_levels} stages`;
  const theme = getSchoolAvatarTheme(session.coach_avatar_id, session.coach_palette_id);
  const canStartMasterclass = schoolNextAction === 'start_masterclass';

  return (
    <LearningWorkspace
      title={activity?.title || session.chapter.title}
      eyebrow={`${session.chapter.title} · ${learnerStage}`}
      onBack={() => router.push(chapterMapHref)}
      coach={<SchoolCoachPanel avatarId={session.coach_avatar_id} paletteId={session.coach_palette_id} status={coachStatus} note={coachNote} variant="immersive" />}
      compactCoach={<SchoolCoachPanel avatarId={session.coach_avatar_id} paletteId={session.coach_palette_id} status={coachStatus} note={coachNote} compact />}
      progress={<SchoolProgressRail session={session} />}
      topBar={<AppHeader title="School Prep" appearance="school" showCredits={false} />}
      headerMeta={<span>{headerMeta}</span>}
      backLabel="Return to chapter map"
      coachLabel="School learning coach"
      progressLabel="Chapter progress"
      workspaceLabel="School tutor activity"
      className="mode-school bg-background font-body"
      themeStyle={theme.style}
      rootDataAttributes={{ 'data-school-region': 'tutor-workspace' }}
    >
      <SchoolActivityRenderer
        session={session}
        view={activityView}
        answer={answer}
        submitting={submitting}
        openingMasterclass={openingMasterclass}
        error={error}
        onAnswerChange={setAnswer}
        onSubmit={(value) => void submit(value)}
        onOpenMasterclass={canStartMasterclass ? () => void openMasterclass() : undefined}
        onExit={() => router.push(chapterMapHref)}
        onRetry={() => void load()}
      />
    </LearningWorkspace>
  );
}
