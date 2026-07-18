"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircledIcon,
  ReloadIcon,
} from '@radix-ui/react-icons';
import { SchoolTutorSkeleton } from '@/components/learning/LearningSkeletons';
import { SchoolLearningShell } from '@/components/school/SchoolLearningShell';
import {
  SchoolStatusChip,
  schoolPrimaryActionClass,
  schoolSecondaryActionClass,
} from '@/components/school/SchoolPrimitives';
import { SchoolSupportActivity } from '@/components/school/support/SchoolSupportActivity';
import {
  recapLoadDecision,
  resolveSchoolStateDestination,
} from '@/lib/schoolActivityPolicy';
import { learnerSafeErrorMessage } from '@/lib/errorCopy';
import {
  resolveSchoolCoachPresentation,
  selectVisibleSchoolCoachFeedback,
} from '@/lib/schoolTeachingPresentation';
import {
  answerSchoolRecap,
  getActiveSchoolRecap,
  getSchoolState,
  startSchoolRecap,
  type SchoolRecapPath,
} from '@/services/schoolRebuild';

function activityLabel(kind: string) {
  if (kind === 'independent_check') return 'Try it yourself';
  if (kind === 'transfer_check') return 'Try it in a new story';
  if (kind.startsWith('revision_level_')) return 'Fresh practice';
  if (kind === 'masterclass') return 'Skill boost';
  if (kind === 'bridge') return 'A little more help';
  return 'Learn together';
}

function ReadinessProgress({ path }: { path: SchoolRecapPath }) {
  const progressPercent = path.progress.total_modules > 0
    ? Math.round((path.progress.completed_modules / path.progress.total_modules) * 100)
    : 0;

  return (
    <section
      data-testid="school-recap-progress"
      className="grid min-w-0 grid-cols-[auto_minmax(36px,1fr)_auto] items-center gap-2 sm:gap-5"
      aria-label={`Readiness path progress for Class ${path.target_class_no}`}
    >
      <p className="whitespace-nowrap font-mono text-[10px] font-semibold uppercase text-[var(--school-muted)]">Readiness path</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#dedfdc]" role="progressbar" aria-label="Completed readiness skills" aria-valuemin={0} aria-valuemax={path.progress.total_modules} aria-valuenow={path.progress.completed_modules}>
        <span className="block h-full rounded-full bg-[var(--school-accent)] transition-[width] motion-reduce:transition-none" style={{ width: `${progressPercent}%` }} />
      </div>
      <p className="whitespace-nowrap font-mono text-[10px] font-semibold text-[var(--school-faint)]">
        {String(path.progress.completed_modules).padStart(2, '0')} / {String(path.progress.total_modules).padStart(2, '0')}
      </p>
    </section>
  );
}

export default function SchoolRecapPage() {
  const router = useRouter();
  const [path, setPath] = useState<SchoolRecapPath | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [recapLoadFailed, setRecapLoadFailed] = useState(false);
  const [canStartRecap, setCanStartRecap] = useState(false);
  const questionHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const lastFocusedActivityIdRef = useRef<string | null>(null);
  const submitInFlightRef = useRef(false);
  const startInFlightRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setRecapLoadFailed(false);
      setCanStartRecap(false);
    try {
      const state = await getSchoolState();
      const decision = recapLoadDecision({
        loadFailed: false,
        activeFlow: state.active_flow,
        activeSessionId: state.active_session_id,
        allowedNextActions: state.allowed_next_actions,
        placementStatus: state.placement_status,
      });
      if (decision.kind === 'load_session') {
        const activePath = await getActiveSchoolRecap();
        if (activePath.session_id !== decision.sessionId) throw new Error('school_state_unresolved');
        setPath(activePath);
        return;
      }
      if (decision.kind === 'start') {
        setCanStartRecap(true);
        setPath(null);
        return;
      }
      const destination = resolveSchoolStateDestination({
        nextAction: state.next_action,
        allowedNextActions: state.allowed_next_actions,
        nextActionUrl: state.next_action_url,
      });
      if (destination && destination !== '/school/recap') {
        router.replace(destination);
        return;
      }
      throw new Error('school_state_unresolved');
    } catch (err: unknown) {
      setError(learnerSafeErrorMessage(err, 'No readiness path is open yet.'));
      setPath(null);
      setRecapLoadFailed(true);
      setCanStartRecap(false);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const begin = async () => {
    if (!canStartRecap || starting || startInFlightRef.current) return;
    startInFlightRef.current = true;
    setStarting(true);
    setError('');
    try {
      setPath(await startSchoolRecap());
      setCanStartRecap(false);
    } catch (err: unknown) {
      setError(learnerSafeErrorMessage(err, 'Could not open your readiness path.'));
    } finally {
      startInFlightRef.current = false;
      setStarting(false);
    }
  };

  const submit = async (value?: string) => {
    const activity = path?.current_activity;
    const finalAnswer = value ?? answer;
    if (!path || !activity || !activity.can_answer || !finalAnswer.trim() || submitting || submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      setPath(await answerSchoolRecap(path.session_id, activity.activity_id, finalAnswer));
      setAnswer('');
    } catch (err: unknown) {
      setError(learnerSafeErrorMessage(err, 'Your answer was not checked. Please try again.'));
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const followAuthoritativeState = async () => {
    setError('');
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

  const activity = path?.current_activity;
  const currentModule = path?.modules[path.current_module_index] ?? null;
  const visibleFeedback = selectVisibleSchoolCoachFeedback(
    activity?.activity_id,
    path?.last_feedback,
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
      : activity ? activityLabel(activity.kind) : path?.status === 'complete' ? 'Ready for class' : 'Your next skill',
    fallbackMessage: activity?.focus || currentModule?.focus || 'We will rebuild only the earlier skills that help you feel ready for your class.',
    activityKey: activity?.activity_id || path?.status || 'readiness-path',
    teachingBlock: activity?.teaching_block,
    feedback: visibleFeedback?.message,
    pendingMessage: submitting || (path?.status === 'active' && activity?.can_answer === false)
      ? 'I am reviewing your answer and preparing the next step.'
      : null,
    transitionMessage: path?.status === 'complete'
      ? `Your prerequisite skills are complete. Class ${path.target_class_no} is ready to open.`
      : path?.status === 'needs_support' || path?.status === 'capped_support'
        ? 'Your work is saved. Continue from your School path with the support selected for you.'
        : path?.status === 'needs_path_revision'
          ? 'Your completed work is saved while I adjust the next skill in your path.'
          : null,
    error,
    tone: visibleFeedback?.correct === true
      ? 'success'
      : visibleFeedback?.correct === false
        ? 'warning'
        : path?.status === 'complete'
          ? 'success'
          : 'neutral',
  });

  useEffect(() => {
    const activityId = activity?.activity_id ?? null;
    if (!activityId || lastFocusedActivityIdRef.current === activityId) return;
    lastFocusedActivityIdRef.current = activityId;
    const frame = requestAnimationFrame(() => questionHeadingRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [activity?.activity_id]);

  if (loading) return <SchoolTutorSkeleton />;

  return (
    <SchoolLearningShell
      title={activity?.title || currentModule?.title || 'Your readiness path'}
      coachStatus={coachPresentation.status}
      coachNote={coachPresentation.message}
      coachHint={coachPresentation.hint}
      coachTone={coachPresentation.tone}
      coachAvatarId={path?.coach_avatar_id}
      coachPaletteId={path?.coach_palette_id}
      onBack={() => router.push('/school')}
      progress={path ? <ReadinessProgress path={path} /> : undefined}
    >
      {recapLoadFailed ? (
        <section role="alert" className="px-5 py-8 sm:px-8 sm:py-10">
          <p className="text-[10px] font-semibold uppercase text-red-700">We could not open this path</p>
          <h2 className="mt-3 font-display text-[2rem] font-normal leading-tight text-slate-950">Your saved work is still safe.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            {error || 'Return to your school path or try loading this page again.'}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => void load()} className={schoolPrimaryActionClass}>
              <ReloadIcon className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
            <button type="button" onClick={() => router.push('/school')} className={schoolSecondaryActionClass}>
              <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
              Back to school
            </button>
          </div>
        </section>
      ) : path?.status === 'complete' ? (
        <section data-testid="school-recap-complete" className="px-5 py-8 sm:px-8 sm:py-10">
          <CheckCircledIcon className="h-8 w-8 text-teal-700" aria-hidden="true" />
          <p className="mt-5 text-[10px] font-semibold uppercase text-teal-700">Readiness path complete</p>
          <h2 className="mt-3 font-display text-[2rem] font-normal leading-tight text-slate-950 sm:text-[2.5rem]">You are ready to begin Class {path.target_class_no}.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            You rebuilt the prerequisite skills selected from your readiness check. Your class chapters are now ready.
          </p>
          <button type="button" onClick={() => void followAuthoritativeState()} className={`${schoolPrimaryActionClass} mt-7`}>
            Open target class
            <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </section>
      ) : path?.status === 'needs_support' || path?.status === 'capped_support' ? (
        <section className="px-5 py-8 sm:px-8 sm:py-10">
          <SchoolStatusChip tone="support">A different next step will help</SchoolStatusChip>
          <h2 className="mt-4 font-display text-[2rem] font-normal leading-tight text-slate-950">Your work is saved.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Return to your school path to continue with the support step chosen from your work.</p>
          <button type="button" onClick={() => router.push('/school')} className={`${schoolPrimaryActionClass} mt-6`}>
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            Back to school
          </button>
        </section>
      ) : path?.status === 'needs_path_revision' ? (
        <section className="px-5 py-8 sm:px-8 sm:py-10">
          <SchoolStatusChip tone="support">Your route is being adjusted</SchoolStatusChip>
          <h2 className="mt-4 font-display text-[2rem] font-normal leading-tight text-slate-950">We found a better skill to practise next.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Your completed work stays saved. Return to school to open the updated route.</p>
          <button type="button" onClick={() => router.push('/school')} className={`${schoolPrimaryActionClass} mt-6`}>
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            Back to school
          </button>
        </section>
      ) : path?.status === 'active' && activity ? (
        <SchoolSupportActivity
          testIdPrefix="school-recap"
          title={activity.title}
          passage={activity.passage}
          prompt={activity.prompt}
          options={activity.options}
          answer={answer}
          inputId="school-recap-answer"
          inputLabel="Your recap answer"
          submitting={submitting}
          canAnswer={activity.can_answer}
          questionRef={questionHeadingRef}
          onAnswerChange={setAnswer}
          onSubmit={(value) => void submit(value)}
        />
      ) : path?.status === 'active' ? (
        <section role="status" aria-live="polite" className="px-5 py-8 sm:px-8 sm:py-10">
          <p className="text-[10px] font-semibold uppercase text-[var(--school-accent-deep)]">Your next activity is getting ready</p>
          <h2 className="mt-3 font-display text-[2rem] font-normal leading-tight text-slate-950">Everything you finished is saved.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Try loading the next activity again. This will not unlock or skip any work.</p>
          <button type="button" onClick={() => void load()} className={`${schoolPrimaryActionClass} mt-6`}>
            <ReloadIcon className="h-4 w-4" aria-hidden="true" />
            Load next activity
          </button>
        </section>
      ) : path ? (
        <section role="alert" className="px-5 py-8 sm:px-8 sm:py-10">
          <p className="text-[10px] font-semibold uppercase text-red-700">This path needs attention</p>
          <h2 className="mt-3 font-display text-[2rem] font-normal leading-tight text-slate-950">Your work is saved.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">Return to school while Zidd restores the right next step.</p>
          <button type="button" onClick={() => router.push('/school')} className={`${schoolPrimaryActionClass} mt-6`}>
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            Back to school
          </button>
        </section>
      ) : (
        <section className="px-5 py-8 sm:px-8 sm:py-10">
          <p className="text-[10px] font-semibold uppercase text-[var(--school-accent-deep)]">Readiness path</p>
          <h2 className="mt-3 font-display text-[2rem] font-normal leading-tight text-slate-950">A short bridge to your class</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            {error || 'Start from your readiness report. Zidd includes only the prerequisite skills you need before your class.'}
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            {canStartRecap ? (
              <button type="button" onClick={() => void begin()} disabled={starting} className={schoolPrimaryActionClass}>
                {starting ? 'Opening your path' : 'Start recap path'}
                <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
            <button type="button" onClick={() => router.push('/school/placement/report')} className={schoolSecondaryActionClass}>
              Readiness report
            </button>
            <button type="button" onClick={() => void load()} className={schoolSecondaryActionClass}>
              <ReloadIcon className="h-4 w-4" aria-hidden="true" />
              Refresh
            </button>
          </div>
        </section>
      )}
    </SchoolLearningShell>
  );
}
