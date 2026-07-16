"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  SchoolPlacementActivity,
  SchoolPlacementSkeleton,
} from '@/components/school/placement/SchoolPlacementWorkspace';
import {
  resolveSchoolStateDestination,
  startSingleFlightRevalidation,
} from '@/lib/schoolActivityPolicy';
import { learnerSafeErrorMessage } from '@/lib/errorCopy';
import { resolveSchoolPlacementMutation } from '@/lib/schoolPlacementLifecycle';
import { getSchoolAvatarTheme } from '@/lib/schoolTheme';
import {
  abandonSchoolPlacement,
  answerSchoolPlacement,
  getSchoolPlacement,
  getSchoolState,
  startSchoolPlacement,
  type SchoolCoachIdentity,
  type SchoolPlacementResponse,
  type SchoolState,
} from '@/services/schoolRebuild';

const PLACEMENT_REVALIDATE_MS = 5_000;

function isPlacementDestination(destination: string) {
  return destination === '/school/placement'
    || destination.startsWith('/school/placement?')
    || destination.startsWith('/school/placement#');
}

function errorCode(error: unknown) {
  return error instanceof Error ? error.message : '';
}

export default function SchoolPlacementPage() {
  const router = useRouter();
  const [placement, setPlacement] = useState<SchoolPlacementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  const [confirmingAbandon, setConfirmingAbandon] = useState(false);
  const [awaitingEvaluation, setAwaitingEvaluation] = useState(false);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [stateMessage, setStateMessage] = useState('');
  const [targetClassNo, setTargetClassNo] = useState<number | null>(null);
  const [coachIdentity, setCoachIdentity] = useState<SchoolCoachIdentity>({
    coach_avatar_id: null,
    coach_palette_id: null,
  });
  const [placementLoadFailed, setPlacementLoadFailed] = useState(false);
  const [canStartPlacement, setCanStartPlacement] = useState(false);
  const [placementRedirecting, setPlacementRedirecting] = useState(false);
  const [placementRecoveryRequired, setPlacementRecoveryRequired] = useState(false);
  const [reportAvailable, setReportAvailable] = useState(false);
  const questionHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const lastFocusedItemIdRef = useRef<string | null>(null);
  const loadRequestIdRef = useRef(0);
  const mountedRef = useRef(false);
  const startingRef = useRef(false);
  const submittingRef = useRef(false);
  const abandoningRef = useRef(false);

  const applyStateIdentity = useCallback((state: SchoolState) => {
    setTargetClassNo(state.target_class_no);
    setCoachIdentity({
      coach_avatar_id: state.coach_avatar_id,
      coach_palette_id: state.coach_palette_id,
    });
    setStateMessage(state.learner_message);
    setReportAvailable(state.allowed_next_actions.includes('view_placement_report'));
  }, []);

  const enterPlacementRecovery = useCallback((message: string) => {
    setAwaitingEvaluation(false);
    setPlacementRecoveryRequired(true);
    setPlacementLoadFailed(false);
    setCanStartPlacement(false);
    setPlacementRedirecting(false);
    setStateMessage(message);
  }, []);

  const load = useCallback(async (background = false) => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    if (!background) {
      setLoading(true);
      setError('');
      setPlacementLoadFailed(false);
      setCanStartPlacement(false);
      setPlacementRedirecting(false);
      setPlacementRecoveryRequired(false);
      setReportAvailable(false);
    }
    try {
      const state = await getSchoolState({ force: true });
      if (!mountedRef.current || loadRequestIdRef.current !== requestId) return;
      applyStateIdentity(state);
      setError('');
      setPlacementLoadFailed(false);
      setCanStartPlacement(false);
      setPlacementRedirecting(false);
      setPlacementRecoveryRequired(false);

      if (
        state.status === 'awaiting_evaluation'
        && state.active_flow === 'placement'
        && state.active_session_id
      ) {
        const pendingPlacement = await getSchoolPlacement(state.active_session_id);
        if (!mountedRef.current || loadRequestIdRef.current !== requestId) return;
        if (
          pendingPlacement.session_id !== state.active_session_id
          || pendingPlacement.profile_version_id !== state.profile_version_id
        ) {
          throw new Error('school_placement_identity_mismatch');
        }
        setPlacement(pendingPlacement);
        setAwaitingEvaluation(true);
        return;
      }

      const destination = resolveSchoolStateDestination({
        nextAction: state.next_action,
        allowedNextActions: state.allowed_next_actions,
        nextActionUrl: state.next_action_url,
      });
      if (!destination) throw new Error('school_state_unresolved');
      if (!isPlacementDestination(destination)) {
        setPlacement(null);
        setAwaitingEvaluation(false);
        setPlacementRedirecting(true);
        router.replace(destination);
        return;
      }
      if (state.next_action === 'start_placement') {
        setPlacement(null);
        setAwaitingEvaluation(false);
        setCanStartPlacement(true);
        return;
      }
      if (
        !['resume_placement', 'finish_placement'].includes(state.next_action ?? '')
        || !state.active_session_id
      ) {
        throw new Error('school_state_unresolved');
      }
      const activePlacement = await getSchoolPlacement(state.active_session_id);
      if (!mountedRef.current || loadRequestIdRef.current !== requestId) return;
      if (
        activePlacement.session_id !== state.active_session_id
        || activePlacement.profile_version_id !== state.profile_version_id
      ) {
        throw new Error('school_placement_identity_mismatch');
      }
      setPlacement(activePlacement);
      setAwaitingEvaluation(false);
    } catch (err: unknown) {
      if (!mountedRef.current || loadRequestIdRef.current !== requestId) return;
      if (background) {
        setStateMessage('Your saved work is still being checked. Zidd will try the School state again automatically.');
        return;
      }
      setError(learnerSafeErrorMessage(err, 'Could not load the starting-point check. Please retry.'));
      setPlacement(null);
      setAwaitingEvaluation(false);
      setPlacementLoadFailed(true);
      setCanStartPlacement(false);
      setPlacementRedirecting(false);
    } finally {
      if (mountedRef.current && loadRequestIdRef.current === requestId && !background) {
        setLoading(false);
      }
    }
  }, [applyStateIdentity, router]);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
      loadRequestIdRef.current += 1;
    };
  }, [load]);

  useEffect(() => {
    if (!awaitingEvaluation) return;
    const revalidator = startSingleFlightRevalidation({
      intervalMs: PLACEMENT_REVALIDATE_MS,
      revalidate: () => load(true),
      schedule: (callback, intervalMs) => window.setInterval(callback, intervalMs),
      cancelSchedule: (timer) => window.clearInterval(timer),
    });
    return () => revalidator.cancel();
  }, [awaitingEvaluation, load]);

  const reconcileMutation = async (nextPlacement: SchoolPlacementResponse) => {
    setCanStartPlacement(false);
    setAwaitingEvaluation(false);
    setPlacementRecoveryRequired(false);
    setReportAvailable(false);

    const state = await getSchoolState({ force: true });
    applyStateIdentity(state);
    const decision = resolveSchoolPlacementMutation(nextPlacement, state);

    if (decision.kind === 'recover') {
      enterPlacementRecovery(
        decision.reason === 'identity_mismatch'
          ? 'Your saved work belongs to a different School session or profile version than the current state. Refresh before continuing.'
          : 'Your saved work could not be matched to a current School step. Refresh before continuing.',
      );
    } else if (decision.kind === 'pending') {
      setPlacement(nextPlacement);
      setAwaitingEvaluation(true);
    } else if (decision.kind === 'interactive' || decision.kind === 'terminal') {
      setPlacement(nextPlacement);
    } else if (decision.kind === 'start') {
      setPlacement(null);
      setCanStartPlacement(true);
    } else {
      setPlacement(null);
      setPlacementRedirecting(true);
      router.replace(decision.destination);
    }

    return decision;
  };

  const begin = async () => {
    if (!canStartPlacement || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setError('');
    let started = false;
    try {
      const nextPlacement = await startSchoolPlacement();
      started = true;
      await reconcileMutation(nextPlacement);
    } catch (err: unknown) {
      if (started) {
        enterPlacementRecovery('Your check started, but the current School step could not be confirmed. Refresh before answering.');
      } else {
        setError(learnerSafeErrorMessage(err, 'The starting-point check is not ready for this class yet.'));
      }
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  const submit = async () => {
    const item = placement?.next_item;
    if (!placement || !item || submittingRef.current) return;
    const finalAnswer = answer;
    if (!finalAnswer.trim()) return;
    submittingRef.current = true;
    setSubmitting(true);
    setAnswer(finalAnswer);
    setError('');
    let answerSaved = false;
    try {
      const nextPlacement = await answerSchoolPlacement(placement.session_id, item.item_id, finalAnswer);
      answerSaved = true;
      const decision = await reconcileMutation(nextPlacement);
      if (decision.kind !== 'pending' && decision.kind !== 'recover') setAnswer('');
    } catch (err: unknown) {
      const code = errorCode(err);
      if (code === 'placement_answer_in_progress') {
        setAwaitingEvaluation(true);
        setStateMessage('Your saved answer is still being checked. This page will refresh when it is ready.');
      } else if (code === 'unexpected_placement_item') {
        enterPlacementRecovery('Your saved question changed while this page was open. Refreshing the canonical check now.');
        void load(true);
      } else if (answerSaved) {
        enterPlacementRecovery('Your answer was saved, but the next School step could not be confirmed. Refresh before answering again.');
      } else {
        setError(learnerSafeErrorMessage(err, 'Could not submit that answer. Your response is still here so you can retry.'));
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const abandon = async () => {
    if (!placement || abandoningRef.current) return;
    abandoningRef.current = true;
    setAbandoning(true);
    setError('');
    let stopped = false;
    try {
      const nextPlacement = await abandonSchoolPlacement(placement.session_id);
      stopped = true;
      setConfirmingAbandon(false);
      setAnswer('');
      await reconcileMutation(nextPlacement);
    } catch (err: unknown) {
      if (stopped) {
        enterPlacementRecovery('The check stopped, but the current School step could not be confirmed. Refresh before continuing.');
      } else {
        setError(learnerSafeErrorMessage(err, 'Could not stop the starting-point check. Please retry.'));
      }
    } finally {
      abandoningRef.current = false;
      setAbandoning(false);
    }
  };

  const item = placement?.next_item;

  useEffect(() => {
    const itemId = awaitingEvaluation || placementRecoveryRequired ? null : item?.item_id ?? null;
    if (!itemId || lastFocusedItemIdRef.current === itemId) return;
    lastFocusedItemIdRef.current = itemId;
    const frame = requestAnimationFrame(() => questionHeadingRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [awaitingEvaluation, item?.item_id, placementRecoveryRequired]);

  if (loading) return <SchoolPlacementSkeleton />;

  const coachAvatarId = placement?.coach_avatar_id ?? coachIdentity.coach_avatar_id;
  const coachPaletteId = placement?.coach_palette_id ?? coachIdentity.coach_palette_id;
  const theme = getSchoolAvatarTheme(coachAvatarId, coachPaletteId);

  return (
    <div className="mode-school min-h-[100dvh] overflow-x-hidden bg-background font-body text-slate-950" style={theme.style}>
      <SchoolPlacementActivity
        placement={placement}
        targetClassNo={targetClassNo}
        coachAvatarId={coachAvatarId}
        coachPaletteId={coachPaletteId}
        canStartPlacement={canStartPlacement}
        placementLoadFailed={placementLoadFailed}
        placementRedirecting={placementRedirecting}
        placementRecoveryRequired={placementRecoveryRequired}
        awaitingEvaluation={awaitingEvaluation}
        reportAvailable={reportAvailable}
        stateMessage={stateMessage}
        starting={starting}
        submitting={submitting}
        abandoning={abandoning}
        confirmingAbandon={confirmingAbandon}
        answer={answer}
        error={error}
        questionHeadingRef={questionHeadingRef}
        onAnswerChange={setAnswer}
        onBegin={() => void begin()}
        onSubmit={() => void submit()}
        onRequestAbandon={() => setConfirmingAbandon(true)}
        onCancelAbandon={() => setConfirmingAbandon(false)}
        onConfirmAbandon={() => void abandon()}
        onRefresh={() => void load()}
        onReturnToSchool={() => router.push('/school')}
        onViewReport={() => router.push('/school/placement/report')}
      />
    </div>
  );
}
