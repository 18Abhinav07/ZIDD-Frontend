"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SchoolTutorSkeleton } from '@/components/learning/LearningSkeletons';
import { SchoolLearningShell } from '@/components/school/SchoolLearningShell';
import {
  PlacementStageRail,
  SchoolPlacementActivity,
  placementStageLabel,
} from '@/components/school/placement/SchoolPlacementWorkspace';
import { resolveSchoolStateDestination } from '@/lib/schoolActivityPolicy';
import { learnerSafeErrorMessage } from '@/lib/errorCopy';
import {
  abandonSchoolPlacement,
  answerSchoolPlacement,
  getSchoolPlacement,
  getSchoolState,
  startSchoolPlacement,
  type SchoolCoachIdentity,
  type SchoolPlacementResponse,
} from '@/services/schoolRebuild';

export default function SchoolPlacementPage() {
  const router = useRouter();
  const [placement, setPlacement] = useState<SchoolPlacementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  const [confirmingAbandon, setConfirmingAbandon] = useState(false);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [targetClassNo, setTargetClassNo] = useState<number | null>(null);
  const [coachIdentity, setCoachIdentity] = useState<SchoolCoachIdentity>({
    coach_avatar_id: null,
    coach_palette_id: null,
  });
  const [placementLoadFailed, setPlacementLoadFailed] = useState(false);
  const [canStartPlacement, setCanStartPlacement] = useState(false);
  const [placementRedirecting, setPlacementRedirecting] = useState(false);
  const questionHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const lastFocusedItemIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setPlacementLoadFailed(false);
    setCanStartPlacement(false);
    setPlacementRedirecting(false);
    try {
      const state = await getSchoolState();
      setTargetClassNo(state.target_class_no);
      setCoachIdentity({
        coach_avatar_id: state.coach_avatar_id,
        coach_palette_id: state.coach_palette_id,
      });
      const destination = resolveSchoolStateDestination({
        nextAction: state.next_action,
        allowedNextActions: state.allowed_next_actions,
        nextActionUrl: state.next_action_url,
      });
      if (!destination) throw new Error('school_state_unresolved');
      if (destination !== '/school/placement') {
        setPlacement(null);
        setPlacementRedirecting(true);
        router.replace(destination);
        return;
      }
      if (state.next_action === 'start_placement') {
        setPlacement(null);
        setCanStartPlacement(true);
        return;
      }
      if (!['resume_placement', 'finish_placement'].includes(state.next_action ?? '') || !state.active_session_id) {
        throw new Error('school_state_unresolved');
      }
      setPlacement(await getSchoolPlacement(state.active_session_id));
      setCanStartPlacement(state.next_action === 'resume_placement');
    } catch (err: unknown) {
      setError(learnerSafeErrorMessage(err, 'Could not load the readiness check. Please retry.'));
      setPlacement(null);
      setPlacementLoadFailed(true);
      setCanStartPlacement(false);
      setPlacementRedirecting(false);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const begin = async () => {
    if (!canStartPlacement || starting) return;
    setStarting(true);
    setError('');
    try {
      setPlacement(await startSchoolPlacement());
      setCanStartPlacement(false);
    } catch (err: unknown) {
      setError(learnerSafeErrorMessage(err, 'Readiness check is not ready for this class yet.'));
    } finally {
      setStarting(false);
    }
  };

  const submit = async (value?: string) => {
    const item = placement?.next_item;
    if (!placement || !item || submitting) return;
    const finalAnswer = value ?? answer;
    if (!finalAnswer.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await answerSchoolPlacement(placement.session_id, item.item_id, finalAnswer);
      setPlacement(result);
      setAnswer('');
    } catch (err: unknown) {
      setError(learnerSafeErrorMessage(err, 'Could not submit that answer. Please retry.'));
    } finally {
      setSubmitting(false);
    }
  };

  const abandon = async () => {
    if (!placement || abandoning) return;
    setAbandoning(true);
    setError('');
    try {
      setPlacement(await abandonSchoolPlacement(placement.session_id));
      setConfirmingAbandon(false);
      setAnswer('');
    } catch (err: unknown) {
      setError(learnerSafeErrorMessage(err, 'Could not stop the readiness check. Please retry.'));
    } finally {
      setAbandoning(false);
    }
  };

  const item = placement?.next_item;

  useEffect(() => {
    const itemId = item?.item_id ?? null;
    if (!itemId || lastFocusedItemIdRef.current === itemId) return;
    lastFocusedItemIdRef.current = itemId;
    const frame = requestAnimationFrame(() => questionHeadingRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [item?.item_id]);

  if (loading) return <SchoolTutorSkeleton />;

  const coachStatus = placementRedirecting
    ? 'Opening your report'
    : placementLoadFailed
      ? 'Let\'s try again'
      : placement?.status === 'target_ready' || placement?.status === 'below_target'
        ? 'Your path is ready'
        : placement?.status === 'insufficient_evidence'
          ? 'A few more answers'
          : placement?.status === 'abandoned'
            ? 'Stopped for now'
            : placement
              ? placementStageLabel(placement.stage)
              : 'Ready when you are';
  const coachNote = placementRedirecting
    ? 'Your answers are saved. Your starting path is ready to open.'
    : placementLoadFailed
      ? 'Your saved work is safe. Try loading this check again.'
      : item?.support
        || (placement?.status === 'target_ready' || placement?.status === 'below_target'
          ? 'Your saved answers are ready to become a learning path.'
          : placement?.status === 'insufficient_evidence'
            ? 'Your work is saved. A few more answers will help me choose the right lessons.'
            : placement?.status === 'abandoned'
              ? 'Your saved answers are still here whenever you are ready to begin again.'
              : 'There are no marks today. Every answer helps me choose what to teach next.');

  return (
    <SchoolLearningShell
      title={item?.learner_skill_label || 'Find your starting point'}
      eyebrow="Starting-point check"
      coachStatus={coachStatus}
      coachNote={coachNote}
      coachAvatarId={placement?.coach_avatar_id ?? coachIdentity.coach_avatar_id}
      coachPaletteId={placement?.coach_palette_id ?? coachIdentity.coach_palette_id}
      onBack={() => router.push('/school')}
      headerMeta={placement ? `${placement.answered_count} answered` : undefined}
      progress={placementLoadFailed || placementRedirecting ? undefined : <PlacementStageRail placement={placement} />}
    >
      <SchoolPlacementActivity
        placement={placement}
        targetClassNo={targetClassNo}
        canStartPlacement={canStartPlacement}
        placementLoadFailed={placementLoadFailed}
        placementRedirecting={placementRedirecting}
        starting={starting}
        submitting={submitting}
        abandoning={abandoning}
        confirmingAbandon={confirmingAbandon}
        answer={answer}
        error={error}
        questionHeadingRef={questionHeadingRef}
        onAnswerChange={setAnswer}
        onBegin={() => void begin()}
        onSubmit={(value) => void submit(value)}
        onRequestAbandon={() => setConfirmingAbandon(true)}
        onCancelAbandon={() => setConfirmingAbandon(false)}
        onConfirmAbandon={() => void abandon()}
        onRefresh={() => void load()}
        onResume={() => void begin()}
        onReturnToSchool={() => router.push('/school')}
        onViewReport={() => router.push('/school/placement/report')}
      />
    </SchoolLearningShell>
  );
}
