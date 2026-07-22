"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExclamationTriangleIcon, ReloadIcon } from '@radix-ui/react-icons';
import { SchoolTutorSkeleton } from '@/components/learning/LearningSkeletons';
import { SchoolCoachPanel } from '@/components/school/SchoolCoachPanel';
import { SchoolLearningWorkspace } from '@/components/school/SchoolLearningWorkspace';
import { schoolPrimaryActionClass, schoolSecondaryActionClass } from '@/components/school/SchoolPrimitives';
import { useResolvedSchoolCoachIdentity } from '@/components/school/shell/SchoolCoachIdentityContext';
import { SchoolActivityRenderer, schoolActivityLabel } from '@/components/school/tutor/SchoolActivityRenderer';
import { SchoolProgressRail } from '@/components/school/tutor/SchoolProgressRail';
import { learnerSafeErrorMessage } from '@/lib/errorCopy';
import { recoverSchoolAnswerState } from '@/lib/schoolRequestPolicy.mjs';
import { getSchoolAvatarTheme } from '@/lib/schoolTheme';
import {
  resolveSchoolCoachPresentation,
  selectVisibleSchoolCoachFeedback,
} from '@/lib/schoolTeachingPresentation';
import {
  CURRICULUM_REVALIDATE_MS,
  createSchoolPendingEvaluationDraftStore,
  curriculumAnswerCanContinueWithoutStateRefresh,
  curriculumMasterclassAction,
  curriculumActivityView,
  pendingCurriculumAnswerValue,
  reconcilePendingCurriculumEvaluation,
  resolveSchoolPassiveStateDestination,
  resolveSchoolStateDestination,
  releaseSchoolTutorLoad,
  runCurriculumMutation,
  schoolCurriculumSessionOwnedByState,
  schoolTutorLoadDecision,
  schoolTutorLoadOwnedBy,
  startSingleFlightRevalidation,
  type PendingCurriculumEvaluation,
  type SchoolTutorLoadOwner,
} from '@/lib/schoolActivityPolicy';
import {
  answerSchoolCurriculum,
  getSchoolCurriculumAnswerStatus,
  getSchoolCurriculumWorkspace,
  getSchoolState,
  isSchoolEvaluatorPendingAnswer,
  resumeSchoolCurriculumMasterclass,
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
  const [pendingEvaluation, setPendingEvaluationState] = useState<PendingCurriculumEvaluation | null>(null);
  const [openingMasterclass, setOpeningMasterclass] = useState(false);
  const [resumingMasterclass, setResumingMasterclass] = useState(false);
  const [error, setError] = useState('');
  const loadOwnerRef = useRef<SchoolTutorLoadOwner | null>(null);
  const loadRequestIdRef = useRef(0);
  const submitInFlightRef = useRef(false);
  const masterclassInFlightRef = useRef(false);
  const pendingEvaluationRef = useRef<PendingCurriculumEvaluation | null>(null);
  const pendingDraftStore = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      return createSchoolPendingEvaluationDraftStore(window.sessionStorage);
    } catch {
      return null;
    }
  }, []);

  const setPendingEvaluation = useCallback((next: PendingCurriculumEvaluation | null) => {
    pendingEvaluationRef.current = next;
    setPendingEvaluationState(next);
  }, []);

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
      const { state, session: nextSession } = await getSchoolCurriculumWorkspace(sessionId);
      if (!schoolTutorLoadOwnedBy(loadOwnerRef.current, requestOwner)) return;
      const destination = resolveSchoolStateDestination({
        nextAction: state.next_action,
        allowedNextActions: state.allowed_next_actions,
        nextActionUrl: state.next_action_url,
      }) ?? resolveSchoolPassiveStateDestination({
        status: state.status,
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
      const fetchedActivityId = nextSession.current_activity?.activity_id ?? null;
      const observedPending = pendingEvaluationRef.current
        ?? (state.status === 'awaiting_evaluation' && fetchedActivityId
          ? {
            activityId: fetchedActivityId,
            stableActiveReads: 0,
            retryAnswer: pendingDraftStore?.read({ sessionId, activityId: fetchedActivityId }) ?? undefined,
          }
          : null);
      if (observedPending) {
        const pendingResolution = reconcilePendingCurriculumEvaluation({
          pending: observedPending,
          schoolStatus: state.status,
          fetchedActivityId,
          fetchedSessionStatus: nextSession.status,
        });
        if (pendingResolution.kind === 'pending') {
          setPendingEvaluation(pendingResolution.pending);
          setSession(nextSession);
          setSchoolStatus(state.status);
          setSchoolNextAction(state.next_action);
          setError('');
          return;
        }
        const pendingAnswerValue = pendingCurriculumAnswerValue({
          pending: observedPending,
          resolution: pendingResolution,
        });
        if (pendingAnswerValue !== null) setAnswer(pendingAnswerValue);
        if (pendingResolution.kind === 'retry') {
          setPendingEvaluation(null);
          setSession(nextSession);
          setSchoolStatus(state.status);
          setSchoolNextAction(state.next_action);
          setError('We could not finish checking that answer. Please try again.');
          return;
        }
        pendingDraftStore?.clear({
          sessionId,
          activityId: observedPending.activityId,
        });
        setPendingEvaluation(null);
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
  }, [pendingDraftStore, router, sessionId, setPendingEvaluation]);

  useEffect(() => {
    void load();
  }, [load]);

  const activity = session?.current_activity ?? null;
  const activityView = curriculumActivityView({
    schoolStatus: pendingEvaluation ? 'awaiting_evaluation' : schoolStatus,
    sessionStatus: session?.status ?? null,
    phase: session?.phase ?? null,
    activityId: activity?.activity_id ?? null,
    canAnswer: activity?.can_answer === true,
  });

  const pollPendingCurriculumAnswer = useCallback(async () => {
    const pending = pendingEvaluationRef.current;
    if (!pending) return;
    const activityId = pending.activityId;
    const result = await getSchoolCurriculumAnswerStatus(sessionId, activityId);
    if (
      pendingEvaluationRef.current?.activityId !== activityId
    ) return;

    if (result.status === 'awaiting_evaluation') return;
    if (result.status === 'retry') {
      setPendingEvaluation(null);
      setAnswer(pending.retryAnswer ?? '');
      setSchoolStatus('in_progress');
      setSchoolNextAction(null);
      setError('We could not finish checking that answer. Please try again.');
      return;
    }

    const nextSession = result.session;
    if (nextSession.session_id !== sessionId) {
      throw new Error('school_session_ownership_mismatch');
    }
    pendingDraftStore?.clear({ sessionId, activityId });
    setPendingEvaluation(null);
    setAnswer('');
    setSession(nextSession);
    setSchoolStatus('in_progress');
    setSchoolNextAction(null);
    setError('');

    if (!curriculumAnswerCanContinueWithoutStateRefresh({
      sessionStatus: nextSession.status,
      activityId: nextSession.current_activity?.activity_id ?? null,
      canAnswer: nextSession.current_activity?.can_answer === true,
    })) {
      await load({ background: true });
    }
  }, [load, pendingDraftStore, sessionId, setPendingEvaluation]);

  useEffect(() => {
    if (!activityView.pollDue) return;
    const revalidator = startSingleFlightRevalidation({
      intervalMs: activityView.pollAfterMs ?? CURRICULUM_REVALIDATE_MS,
      revalidate: pollPendingCurriculumAnswer,
      schedule: (callback, intervalMs) => window.setInterval(callback, intervalMs),
      cancelSchedule: (timer) => window.clearInterval(timer),
    });
    return () => revalidator.cancel();
  }, [activityView.pollAfterMs, activityView.pollDue, pollPendingCurriculumAnswer]);

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
    pendingDraftStore?.write({
      sessionId: session.session_id,
      activityId: activity.activity_id,
      answer: finalAnswer,
    });
    try {
      const answerResult = await answerSchoolCurriculum(session.session_id, activity.activity_id, finalAnswer);
      if (isSchoolEvaluatorPendingAnswer(answerResult)) {
        setSchoolStatus('awaiting_evaluation');
        setSchoolNextAction(null);
        setPendingEvaluation({
          activityId: answerResult.activity_id,
          stableActiveReads: 0,
          retryAnswer: finalAnswer,
        });
        setAnswer('');
        setError('');
        return;
      }
      pendingDraftStore?.clear({
        sessionId: session.session_id,
        activityId: activity.activity_id,
      });
      setPendingEvaluation(null);
      if (curriculumAnswerCanContinueWithoutStateRefresh({
        sessionStatus: answerResult.status,
        activityId: answerResult.current_activity?.activity_id ?? null,
        canAnswer: answerResult.current_activity?.can_answer === true,
      })) {
        if (answerResult.session_id !== sessionId) {
          throw new Error('school_session_ownership_mismatch');
        }
        // The answer response was persisted transactionally. Let the learner
        // continue immediately; a canonical state read is only needed when a
        // response branches or completes the chapter.
        setSession(answerResult);
        setAnswer('');
        setSchoolStatus('in_progress');
        setError('');
        return;
      }
      const refreshResult: { state: Awaited<ReturnType<typeof getSchoolState>> | null } = { state: null };
      const result = await runCurriculumMutation({
        mutate: () => Promise.resolve(answerResult),
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
        setError('The lesson status could not refresh automatically. Refresh to confirm the current step.');
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
      try {
        const recovery = await recoverSchoolAnswerState({
          error: err,
          refreshState: () => getSchoolState({ force: true }),
        });
        if (recovery.kind === 'pending_unconfirmed') {
          setSchoolStatus('awaiting_evaluation');
          setSchoolNextAction(null);
          setPendingEvaluation({
            activityId: activity.activity_id,
            stableActiveReads: 0,
            retryAnswer: finalAnswer,
          });
          setAnswer('');
          setError('');
          void load({ background: true });
          return;
        }
        if (recovery.kind === 'pending') {
          setSchoolStatus(recovery.state.status);
          setSchoolNextAction(recovery.state.next_action);
          setPendingEvaluation({
            activityId: activity.activity_id,
            stableActiveReads: 0,
            retryAnswer: finalAnswer,
          });
          setAnswer('');
          setError('');
          void load({ background: true });
          return;
        }
        if (recovery.kind === 'advanced') {
          setSchoolStatus(recovery.state.status);
          setSchoolNextAction(recovery.state.next_action);
          setPendingEvaluation({
            activityId: activity.activity_id,
            stableActiveReads: 0,
            retryAnswer: finalAnswer,
          });
          setError('');
          void load({ background: true });
          return;
        }
      } catch (refreshError: unknown) {
        setError(learnerSafeErrorMessage(refreshError, 'Could not confirm the current lesson status. Please refresh before trying again.'));
        return;
      }
      const staleAnswer = err instanceof Error && err.message === 'stale_curriculum_answer';
      if (staleAnswer) {
        pendingDraftStore?.clear({
          sessionId: session.session_id,
          activityId: activity.activity_id,
        });
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

  const resumeMasterclass = async () => {
    if (
      !session?.active_interrupt
      || schoolNextAction !== 'resume_masterclass'
      || resumingMasterclass
      || masterclassInFlightRef.current
    ) return;
    masterclassInFlightRef.current = true;
    setResumingMasterclass(true);
    setError('');
    try {
      const resumed = await resumeSchoolCurriculumMasterclass(session.session_id);
      if (resumed.session_id !== session.session_id) {
        throw new Error('school_session_ownership_mismatch');
      }
      setSession(resumed);
      const state = await getSchoolState({ force: true });
      setSchoolStatus(state.status);
      setSchoolNextAction(state.next_action);
      const destination = resolveSchoolStateDestination({
        nextAction: state.next_action,
        allowedNextActions: state.allowed_next_actions,
        nextActionUrl: state.next_action_url,
      });
      if (!destination) throw new Error('school_state_unresolved');
      if (destination !== `/school/session/${sessionId}`) {
        router.push(destination);
        return;
      }
      await load({ background: true });
    } catch (err: unknown) {
      setError(learnerSafeErrorMessage(err, 'Could not return to the chapter yet. Please retry.'));
    } finally {
      masterclassInFlightRef.current = false;
      setResumingMasterclass(false);
    }
  };

  const coachIdentity = useResolvedSchoolCoachIdentity({
    avatarId: session?.coach_avatar_id,
    paletteId: session?.coach_palette_id,
  });

  if (loading) return <SchoolTutorSkeleton />;

  if (!session) {
    return (
      <div className="mode-school min-h-[100dvh] bg-background font-body text-slate-950">
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
  const feedbackForCurrentLevel = activity?.level_id === session.last_feedback?.level_id
    ? session.last_feedback
    : null;
  const visibleFeedback = selectVisibleSchoolCoachFeedback(
    activity?.activity_id,
    feedbackForCurrentLevel,
    { includePrevious: true },
  );
  const feedbackIsFromPreviousActivity = Boolean(
    visibleFeedback
    && activity
    && visibleFeedback.activity_id !== activity.activity_id,
  );
  const feedbackTone = visibleFeedback?.correct === true
    ? 'success'
    : visibleFeedback?.correct === false
      ? 'warning'
      : 'neutral';
  const isSavingTeachingStep = activity?.interaction_type === 'continue';
  const coachStatus = submitting
    ? isSavingTeachingStep
      ? 'Saving your progress'
      : 'Checking your answer'
    : activityView.kind === 'pending'
      ? 'Reviewing your answer'
      : visibleFeedback?.message
        ? feedbackIsFromPreviousActivity
          ? visibleFeedback.correct === true
                ? 'Previous answer: what worked'
                : visibleFeedback.correct === false
                  ? 'Previous answer: try this'
                  : 'Coach note from the previous step'
          : visibleFeedback.correct === true
            ? 'What worked'
            : visibleFeedback.correct === false
              ? 'Try this next'
              : 'Coach feedback'
        : session.phase === 'paused_for_masterclass'
          ? schoolNextAction === 'resume_masterclass'
            ? 'Ready to return'
            : 'Focused practice'
          : activityView.kind === 'support'
            ? 'Support is ready'
            : activityView.kind === 'complete'
              ? 'Chapter complete'
              : activity
                ? schoolActivityLabel(activity.kind)
                : 'Your lesson';
  const masterclassFocus = session.active_interrupt?.focus?.trim();
  const learnableMasterclassFocus = masterclassFocus
    ? `${masterclassFocus.slice(0, 1).toLowerCase()}${masterclassFocus.slice(1)}`
    : 'build this skill';
  const transitionMessage = session.phase === 'paused_for_masterclass' && session.active_interrupt
    && schoolNextAction === 'resume_masterclass'
    ? `Your focused practice is complete. Return to ${session.chapter.title} at the saved lesson step.`
    : session.phase === 'paused_for_masterclass' && session.active_interrupt
    ? `Your place in ${session.chapter.title} is saved. This short practice will help you learn how to ${learnableMasterclassFocus}, then bring you back here.`
    : activityView.kind === 'support'
      ? 'Your answers and chapter place are saved. Continue from the chapter map with the support selected for you.'
      : activityView.kind === 'complete'
        ? 'This chapter is complete and your progress is saved. Return to the map to choose what comes next.'
        : null;
  const coachPresentation = resolveSchoolCoachPresentation({
    status: coachStatus,
    fallbackMessage: activity?.focus || currentLevel?.teaching_goal || session.chapter.unit_title,
    activityKey: activity?.activity_id || session.phase,
    teachingBlock: activity?.teaching_block,
    feedback: visibleFeedback?.message,
    pendingMessage: submitting
      ? isSavingTeachingStep
        ? 'Saving this teaching step. Your chapter place is being saved.'
        : 'Checking your answer. Your response is being saved.'
      : activityView.kind === 'pending'
        ? 'School is reviewing your answer. Feedback will appear here when the next step is ready.'
        : null,
    transitionMessage,
    error,
    tone: feedbackTone,
  });
  const theme = getSchoolAvatarTheme(coachIdentity.avatarId, coachIdentity.paletteId);
  const masterclassAction = curriculumMasterclassAction(schoolNextAction);
  const showWorkspaceBack = activityView.kind === 'activity'
    || (session.phase === 'paused_for_masterclass' && session.active_interrupt !== null);

  return (
    <SchoolLearningWorkspace
      title={activity?.title || session.chapter.title}
      onBack={() => router.push(chapterMapHref)}
      showBack={showWorkspaceBack}
      coach={(
        <SchoolCoachPanel
          avatarId={coachIdentity.avatarId}
          paletteId={coachIdentity.paletteId}
          status={coachPresentation.status}
          note={coachPresentation.message}
          hint={coachPresentation.hint}
          tone={coachPresentation.tone}
          variant="immersive"
        />
      )}
      progress={<SchoolProgressRail session={session} />}
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
        resumingMasterclass={resumingMasterclass}
        onAnswerChange={setAnswer}
        onSubmit={(value) => void submit(value)}
        onOpenMasterclass={masterclassAction === 'start' ? () => void openMasterclass() : undefined}
        onResumeMasterclass={masterclassAction === 'resume' ? () => void resumeMasterclass() : undefined}
        onExit={() => router.push(chapterMapHref)}
        onRetry={() => void load()}
      />
    </SchoolLearningWorkspace>
  );
}
