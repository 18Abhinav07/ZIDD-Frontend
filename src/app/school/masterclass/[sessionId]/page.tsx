"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  CheckCircledIcon,
  ReaderIcon,
  ReloadIcon,
  TargetIcon,
} from '@radix-ui/react-icons';
import { SchoolTutorSkeleton } from '@/components/learning/LearningSkeletons';
import { SchoolLearningShell } from '@/components/school/SchoolLearningShell';
import {
  schoolPrimaryActionClass,
  schoolSecondaryActionClass,
} from '@/components/school/SchoolPrimitives';
import { SchoolSupportActivity } from '@/components/school/support/SchoolSupportActivity';
import { learnerSafeErrorMessage } from '@/lib/errorCopy';
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
import {
  isMasterclassAnswerInProgress,
  masterclassActivityView,
} from '@/lib/schoolMasterclassPolicy';
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
  const interruptedLevel = curriculum.levels.find((level) => level.level_id === session.level_id) ?? null;

  return (
    <div data-testid="school-masterclass-context" className="min-w-0">
      <section className="grid min-w-0 gap-3 sm:grid-cols-[minmax(150px,1fr)_minmax(160px,auto)] sm:items-center sm:gap-5" aria-labelledby="masterclass-return-target">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-mono text-[9px] font-semibold uppercase text-[var(--school-accent-deep)]">
            <TargetIcon className="h-3.5 w-3.5" aria-hidden="true" /> Focused practice
          </p>
          <h2 id="masterclass-return-target" className="mt-1 truncate text-sm font-semibold text-[var(--school-ink)]">{session.focus}</h2>
        </div>
        <p className="truncate text-xs font-medium text-[var(--school-muted)]">Return to {curriculum.chapter.title}</p>
      </section>

      <details className="group mt-3 border-t border-[var(--school-line)] pt-3">
        <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-4 text-xs font-semibold text-[var(--school-muted)]">
          <span className="flex items-center gap-2"><ReaderIcon className="h-3.5 w-3.5" aria-hidden="true" /> Your exact chapter place is saved</span>
          <span className="font-mono text-[9px] uppercase text-[var(--school-accent-deep)] group-open:hidden">View context</span>
          <span className="hidden font-mono text-[9px] uppercase text-[var(--school-accent-deep)] group-open:inline">Hide context</span>
        </summary>
        <dl className="mt-3 grid gap-4 border-t border-[var(--school-line)] pt-4 text-xs sm:grid-cols-3">
          <div>
            <dt className="font-mono text-[9px] font-semibold uppercase text-[var(--school-faint)]">Lesson step</dt>
            <dd className="mt-1 font-semibold text-[var(--school-ink)]">{interruptedLevel?.title || session.focus}</dd>
          </div>
          <div>
            <dt className="font-mono text-[9px] font-semibold uppercase text-[var(--school-faint)]">Skill focus</dt>
            <dd className="mt-1 font-semibold text-[var(--school-ink)]">{session.focus}</dd>
          </div>
          <div>
            <dt className="font-mono text-[9px] font-semibold uppercase text-[var(--school-faint)]">Support visit</dt>
            <dd className="mt-1 text-[var(--school-muted)]">{session.trigger_count} of 2</dd>
          </div>
        </dl>
      </details>
    </div>
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
      if (isMasterclassAnswerInProgress(err)) {
        setSchoolStatus('awaiting_evaluation');
        setAnswer('');
        setError('');
        void load({ background: true });
      } else {
        setError(learnerSafeErrorMessage(err, 'Your answer was not checked. Please try again.'));
      }
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

  const interruptedLevel = curriculum?.levels.find((level) => level.level_id === session?.level_id) ?? null;
  const lineage = session && curriculum ? lineageForSessions(session, curriculum) : null;
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
      eyebrow="Focused practice"
      coachStatus={session?.status === 'complete'
        ? 'Ready to return'
        : activityView.kind === 'pending'
          ? 'Reviewing your answer'
          : 'One skill at a time'}
      coachNote={activity?.focus || session?.focus || 'Your chapter place is saved while we strengthen this skill.'}
      coachAvatarId={session?.coach_avatar_id}
      coachPaletteId={session?.coach_palette_id}
      onBack={handleShellBack}
      backLabel={session?.status === 'active' ? 'Leave focused practice' : 'Return to chapter'}
      headerMeta={curriculum?.chapter.title || interruptedLevel?.title || undefined}
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
          tone="masterclass"
          kindLabel="Focused practice"
          sourceLabel={interruptedLevel?.title || 'Saved lesson step'}
          title={activity.title}
          teachingBlock={activity.teaching_block}
          passage={activity.passage}
          prompt={activity.prompt}
          options={activity.options}
          answer={answer}
          inputId="school-masterclass-answer"
          inputLabel="Your focused practice answer"
          submitting={submitting}
          canAnswer={activityView.canSubmit}
          feedback={session.last_feedback}
          error={error}
          questionRef={questionHeadingRef}
          onAnswerChange={setAnswer}
          onSubmit={(value) => void submit(value)}
          footer={(
            <div className="flex flex-col items-start gap-2">
              <button
                type="button"
                onClick={() => setConfirmingAbandon(true)}
                disabled={submitting}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--school-accent)] focus-visible:ring-offset-2 active:translate-y-px disabled:opacity-50"
              >
                <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" /> Return without finishing
              </button>
              <p className="text-xs leading-5 text-slate-500">
                This returns you to {curriculum?.chapter.title || 'the linked chapter'}. This support visit will still count, even though it was not finished.
              </p>
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
