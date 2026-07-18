"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  CheckCircledIcon,
  ReloadIcon,
} from '@radix-ui/react-icons';
import { SchoolTutorSkeleton } from '@/components/learning/LearningSkeletons';
import { SchoolLearningShell } from '@/components/school/SchoolLearningShell';
import {
  schoolPrimaryActionClass,
  schoolSecondaryActionClass,
} from '@/components/school/SchoolPrimitives';
import { SchoolSupportActivity } from '@/components/school/support/SchoolSupportActivity';
import { learnerSafeErrorMessage } from '@/lib/errorCopy';
import { recoverSchoolAnswerState } from '@/lib/schoolRequestPolicy.mjs';
import {
  resolveSchoolCoachPresentation,
  selectVisibleSchoolCoachFeedback,
} from '@/lib/schoolTeachingPresentation';
import {
  CURRICULUM_REVALIDATE_MS,
  completedMasterclassReturnAction,
  releaseSchoolTutorLoad,
  resolveSchoolPassiveStateDestination,
  resolveSchoolStateDestination,
  schoolMasterclassLineage,
  schoolMasterclassShellBackAction,
  schoolTutorLoadDecision,
  schoolTutorLoadOwnedBy,
  startSingleFlightRevalidation,
  type SchoolMasterclassLineage,
  type SchoolTutorLoadOwner,
} from '@/lib/schoolActivityPolicy';
import { masterclassActivityView } from '@/lib/schoolMasterclassPolicy';
import {
  abandonSchoolCurriculumMasterclass,
  answerSchoolMasterclass,
  getSchoolCurriculumSession,
  getSchoolMasterclass,
  getSchoolState,
  resumeSchoolCurriculumMasterclass,
  type SchoolCurriculumSession,
  type SchoolMasterclassSession,
  type SchoolStateStatus,
} from '@/services/schoolRebuild';

function lineageForSessions(
  session: SchoolMasterclassSession,
  linkedCurriculum: SchoolCurriculumSession,
): SchoolMasterclassLineage {
  return schoolMasterclassLineage({
    sessionId: session.session_id,
    linkedCurriculumSessionId: session.linked_curriculum_session_id,
    interruptId: session.interrupt_id,
    levelId: session.level_id,
  }, {
    sessionId: linkedCurriculum.session_id,
    activeInterrupt: linkedCurriculum.active_interrupt ? {
      masterclassSessionId: linkedCurriculum.active_interrupt.masterclass_session_id,
      interruptId: linkedCurriculum.active_interrupt.interrupt_id,
      levelId: linkedCurriculum.active_interrupt.level_id,
    } : null,
    interruptHistory: linkedCurriculum.interrupt_history.map((interrupt) => ({
      masterclassSessionId: interrupt.masterclass_session_id,
      interruptId: interrupt.interrupt_id,
      levelId: interrupt.level_id,
    })),
  });
}

function MasterclassProgress({
  session,
  curriculum,
}: {
  session: SchoolMasterclassSession;
  curriculum: SchoolCurriculumSession;
}) {
  return (
    <section
      data-testid="school-masterclass-context"
      className="grid min-w-0 grid-cols-[auto_minmax(36px,1fr)_auto] items-center gap-2 sm:gap-5"
      aria-label={`Focused practice linked to ${curriculum.chapter.title}`}
    >
      <p className="whitespace-nowrap font-mono text-[10px] font-semibold uppercase text-[var(--school-muted)]">Focused practice</p>
      <span className="h-1.5 rounded-full bg-[var(--school-accent-soft)]" aria-hidden="true" />
      <p className="whitespace-nowrap font-mono text-[10px] font-semibold text-[var(--school-faint)]">Visit {session.trigger_count} / 2</p>
    </section>
  );
}

export default function SchoolMasterclassPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = params.sessionId;
  const [session, setSession] = useState<SchoolMasterclassSession | null>(null);
  const [curriculum, setCurriculum] = useState<SchoolCurriculumSession | null>(null);
  const [schoolStatus, setSchoolStatus] = useState<SchoolStateStatus | null>(null);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingAbandon, setConfirmingAbandon] = useState(false);
  const [error, setError] = useState('');
  const loadOwnerRef = useRef<SchoolTutorLoadOwner | null>(null);
  const loadRequestIdRef = useRef(0);
  const submitInFlightRef = useRef(false);
  const actionInFlightRef = useRef(false);
  const questionHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const lastFocusedActivityIdRef = useRef<string | null>(null);
  const abandonDialogRef = useRef<HTMLDialogElement | null>(null);

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
        getSchoolMasterclass(sessionId),
      ]);
      if (!schoolTutorLoadOwnedBy(loadOwnerRef.current, requestOwner)) return;
      if (nextSession.session_id !== sessionId) throw new Error('school_masterclass_lineage_mismatch');
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
      if (destination !== `/school/masterclass/${sessionId}`) {
        router.replace(destination);
        return;
      }

      const linkedCurriculum = await getSchoolCurriculumSession(nextSession.linked_curriculum_session_id);
      if (!schoolTutorLoadOwnedBy(loadOwnerRef.current, requestOwner)) return;
      if (!lineageForSessions(nextSession, linkedCurriculum)) {
        throw new Error('school_masterclass_lineage_mismatch');
      }

      setSession(nextSession);
      setCurriculum(linkedCurriculum);
      setSchoolStatus(state.status);
      setError('');
    } catch (err: unknown) {
      if (!schoolTutorLoadOwnedBy(loadOwnerRef.current, requestOwner)) return;
      const lineageMismatch = err instanceof Error && err.message === 'school_masterclass_lineage_mismatch';
      if (!background || lineageMismatch) {
        setSession(null);
        setCurriculum(null);
        setSchoolStatus(null);
      }
      setError(lineageMismatch
        ? 'This focused practice is not linked to your active chapter. Return to School to continue safely.'
        : learnerSafeErrorMessage(err, 'Could not load focused practice.'));
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
  const activityView = masterclassActivityView({
    schoolStatus,
    sessionStatus: session?.status ?? null,
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

  const submit = async (value?: string) => {
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
      const nextSession = await answerSchoolMasterclass(
        session.session_id,
        activity.activity_id,
        finalAnswer,
      );
      if (
        nextSession.session_id !== session.session_id
        || nextSession.linked_curriculum_session_id !== session.linked_curriculum_session_id
        || nextSession.interrupt_id !== session.interrupt_id
      ) {
        throw new Error('school_masterclass_lineage_mismatch');
      }
      setSession(nextSession);
      setAnswer('');
    } catch (err: unknown) {
      try {
        const recovery = await recoverSchoolAnswerState({
          error: err,
          refreshState: () => getSchoolState({ force: true }),
        });
        if (recovery.kind === 'pending') {
          setSchoolStatus(recovery.state.status);
          setAnswer('');
          setError('');
          void load({ background: true });
          return;
        }
      } catch (refreshError: unknown) {
        setError(learnerSafeErrorMessage(refreshError, 'Could not confirm the focused-practice status. Please refresh before trying again.'));
        return;
      }
      setError(learnerSafeErrorMessage(err, 'Your answer was not checked. Please try again.'));
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const runLifecycleAction = async (action: 'resume' | 'abandon') => {
    if (!session || submitting || actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      const resumed = action === 'resume'
        ? await resumeSchoolCurriculumMasterclass(session.linked_curriculum_session_id)
        : await abandonSchoolCurriculumMasterclass(session.linked_curriculum_session_id);
      if (resumed.session_id !== session.linked_curriculum_session_id) {
        throw new Error('school_masterclass_lineage_mismatch');
      }
      const state = await getSchoolState({ force: true });
      const destination = resolveSchoolStateDestination({
        nextAction: state.next_action,
        allowedNextActions: state.allowed_next_actions,
        nextActionUrl: state.next_action_url,
      });
      if (!destination) throw new Error('school_state_unresolved');
      router.push(destination);
    } catch (err: unknown) {
      setError(learnerSafeErrorMessage(
        err,
        action === 'resume'
          ? 'Could not return to the chapter yet.'
          : 'Could not return to the chapter.',
      ));
    } finally {
      actionInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const resume = () => runLifecycleAction('resume');
  const abandon = () => runLifecycleAction('abandon');

  const returnToAuthoritativeState = async () => {
    try {
      const state = await getSchoolState({ force: true });
      const destination = resolveSchoolStateDestination({
        nextAction: state.next_action,
        allowedNextActions: state.allowed_next_actions,
        nextActionUrl: state.next_action_url,
      });
      if (!destination) throw new Error('school_state_unresolved');
      router.push(destination);
    } catch (err: unknown) {
      setError(learnerSafeErrorMessage(err, 'Could not open the backend-approved next step.'));
    }
  };

  const lineage = session && curriculum ? lineageForSessions(session, curriculum) : null;
  const visibleFeedback = selectVisibleSchoolCoachFeedback(
    activity?.activity_id,
    session?.last_feedback,
    { includePrevious: true },
  );
  const feedbackIsFromPreviousActivity = Boolean(
    visibleFeedback
    && activity
    && visibleFeedback.activity_id !== activity.activity_id,
  );
  const coachPresentation = resolveSchoolCoachPresentation({
    status: visibleFeedback
      ? feedbackIsFromPreviousActivity
        ? visibleFeedback.correct ? 'Previous answer: what worked' : 'Previous answer: try this'
        : visibleFeedback.correct ? 'What worked' : 'Try this next'
      : session?.status === 'complete'
        ? 'Ready to return'
        : activityView.kind === 'pending'
          ? 'Reviewing your answer'
          : 'One skill at a time',
    fallbackMessage: activity?.focus || session?.focus || 'Your chapter place is saved while we strengthen this skill.',
    activityKey: activity?.activity_id || session?.status || sessionId,
    teachingBlock: activity?.teaching_block,
    feedback: visibleFeedback?.message,
    pendingMessage: activityView.kind === 'pending' || submitting
      ? 'School is reviewing your answer. The next step will appear here when it is ready.'
      : null,
    transitionMessage: session?.status === 'complete'
      ? `This focused practice is complete. Return to ${curriculum?.chapter.title || 'your chapter'} at the saved lesson step.`
      : session?.status === 'abandoned'
        ? `This support visit is closed. Return to ${curriculum?.chapter.title || 'your chapter'} at the saved position.`
        : null,
    error,
    tone: visibleFeedback?.correct === true
      ? 'success'
      : visibleFeedback?.correct === false
        ? 'warning'
        : session?.status === 'complete'
          ? 'success'
          : 'neutral',
  });
  const returnFromComplete = () => {
    if (completedMasterclassReturnAction(lineage) === 'resume') {
      void resume();
      return;
    }
    void returnToAuthoritativeState();
  };
  const handleShellBack = () => {
    const backAction = schoolMasterclassShellBackAction(session?.status ?? null, lineage);
    switch (backAction) {
      case 'confirm_abandon':
        setConfirmingAbandon(true);
        return;
      case 'resume':
        void resume();
        return;
      case 'route':
        void returnToAuthoritativeState();
        return;
      case 'fallback':
        void returnToAuthoritativeState();
    }
  };

  useEffect(() => {
    const activityId = activity?.activity_id ?? null;
    if (!activityId || lastFocusedActivityIdRef.current === activityId) return;
    lastFocusedActivityIdRef.current = activityId;
    const frame = requestAnimationFrame(() => questionHeadingRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [activity?.activity_id]);

  useEffect(() => {
    const dialog = abandonDialogRef.current;
    if (!dialog) return;
    if (confirmingAbandon && !dialog.open) dialog.showModal();
    if (!confirmingAbandon && dialog.open) dialog.close();
  }, [confirmingAbandon]);

  if (loading) return <SchoolTutorSkeleton />;

  return (
    <SchoolLearningShell
      title={activity?.title || session?.focus || 'Focused practice'}
      coachStatus={coachPresentation.status}
      coachNote={coachPresentation.message}
      coachHint={coachPresentation.hint}
      coachTone={coachPresentation.tone}
      coachAvatarId={session?.coach_avatar_id}
      coachPaletteId={session?.coach_palette_id}
      onBack={handleShellBack}
      backLabel={session?.status === 'active' ? 'Leave focused practice' : 'Return to chapter'}
      progress={session && curriculum ? <MasterclassProgress session={session} curriculum={curriculum} /> : undefined}
    >
      {!session ? (
        <section data-testid="school-masterclass-error" role="alert" className="px-5 py-8 sm:px-8 sm:py-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-red-700">Focused practice unavailable</p>
          <h2 className="mt-3 font-display text-3xl font-normal text-slate-950">Your chapter work is still safe.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">{error || 'Try loading this practice again.'}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => void load()} className={schoolPrimaryActionClass}>
              <ReloadIcon className="h-4 w-4" aria-hidden="true" /> Try again
            </button>
            <button type="button" onClick={() => void returnToAuthoritativeState()} className={schoolSecondaryActionClass}>
              <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" /> Return to School
            </button>
          </div>
        </section>
      ) : session.status === 'complete' ? (
        <section data-testid="school-masterclass-complete" role="status" aria-live="polite" className="px-5 py-8 sm:px-8 sm:py-10">
          <CheckCircledIcon className="h-9 w-9 text-teal-700" aria-hidden="true" />
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-700">Skill practice complete</p>
          <h2 className="mt-3 font-display text-3xl font-normal leading-tight text-slate-950 sm:text-4xl">You are ready to return to your lesson.</h2>
          <p className={`mt-3 max-w-xl text-sm leading-6 ${error ? 'font-semibold text-red-700' : 'text-slate-600'}`}>
            {error || `Your place in ${curriculum?.chapter.title || 'the chapter'} is saved. Continue from the same lesson step and try the skill independently.`}
          </p>
          <button
            type="button"
            onClick={returnFromComplete}
            disabled={submitting}
            aria-busy={submitting}
            className={`mt-7 ${schoolPrimaryActionClass}`}
          >
            {submitting ? 'Returning to chapter' : 'Return to chapter'}
          </button>
        </section>
      ) : session.status === 'abandoned' ? (
        <section data-testid="school-masterclass-abandoned" className="px-5 py-8 sm:px-8 sm:py-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Practice closed</p>
          <h2 className="mt-3 font-display text-3xl font-normal text-slate-950">Return to your saved chapter position.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
            This support visit counted. Your next step is waiting in {curriculum?.chapter.title || 'the linked chapter'}.
          </p>
          <button type="button" onClick={() => void returnToAuthoritativeState()} className={`mt-6 ${schoolPrimaryActionClass}`}>
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" /> Return to chapter
          </button>
        </section>
      ) : activity ? (
        <SchoolSupportActivity
          testIdPrefix="school-masterclass"
          title={activity.title}
          passage={activity.passage}
          prompt={activity.prompt}
          options={activity.options}
          answer={answer}
          inputId="school-masterclass-answer"
          inputLabel="Your focused practice answer"
          submitting={submitting}
          canAnswer={activityView.canSubmit}
          sourceReference={activity.source_reference}
          questionRef={questionHeadingRef}
          onAnswerChange={setAnswer}
          onSubmit={(value) => void submit(value)}
          footer={(
            <div>
              <button
                type="button"
                onClick={() => setConfirmingAbandon(true)}
                disabled={submitting}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--school-accent)] focus-visible:ring-offset-2 active:translate-y-px disabled:opacity-50"
              >
                <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" /> Return without finishing
              </button>
            </div>
          )}
        />
      ) : (
        <section role="status" aria-live="polite" className="px-5 py-8 sm:px-8 sm:py-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--school-accent-deep)]">Getting your next practice ready</p>
          <h2 className="mt-3 font-display text-3xl font-normal text-slate-950">Everything you finished is saved.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">Refresh to continue from the same focused practice.</p>
          <button type="button" onClick={() => void load()} className={`mt-6 ${schoolPrimaryActionClass}`}>
            <ReloadIcon className="h-4 w-4" aria-hidden="true" /> Refresh practice
          </button>
        </section>
      )}
      <dialog
        ref={abandonDialogRef}
        onCancel={(event) => {
          event.preventDefault();
          setConfirmingAbandon(false);
        }}
        onClose={() => setConfirmingAbandon(false)}
        className="w-[calc(100%-2.5rem)] max-w-md rounded-lg border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-950/35 backdrop:backdrop-blur-sm"
      >
          <section
            aria-labelledby="leave-masterclass-title"
            className="p-6"
          >
            <p className="text-[10px] font-semibold uppercase text-orange-700">Leave focused practice?</p>
            <h2 id="leave-masterclass-title" className="mt-3 font-display text-3xl font-normal leading-tight text-slate-950">
              Your chapter place will stay saved.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              This support visit will count even if you leave before finishing. You can return to the linked chapter now.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setConfirmingAbandon(false)} disabled={submitting} className={schoolSecondaryActionClass}>
                Keep practising
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingAbandon(false);
                  void abandon();
                }}
                disabled={submitting}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-red-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                Leave and return
              </button>
            </div>
          </section>
      </dialog>
    </SchoolLearningShell>
  );
}
