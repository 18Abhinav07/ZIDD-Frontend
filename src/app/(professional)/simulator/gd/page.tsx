"use client";

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useZiddSession, MAX_SIM_ROUNDS } from '@/hooks/useZiddSession';
import { SimulatorShell } from '@/components/simulator/SimulatorShell';
import { GDBriefingCard } from '@/components/simulator/GDBriefingCard';
import { SessionRecap } from '@/components/shared/SessionRecap';
import { SimulationReportModal } from '@/components/shared/SimulationReportModal';
import { SessionNotFound } from '@/components/shared/SessionNotFound';
import { CreditsBadge } from '@/components/billing/CreditsBadge';
import { EndSessionConfirmModal } from '@/components/simulator/EndSessionConfirmModal';
import { AssessmentClientAction, SimPersona } from '@/types';

const FALLBACK_MODERATOR_PERSONA: SimPersona = {
  speaker_id: 'moderator',
  name: 'Moderator',
  role: 'Facilitator',
  role_type: 'moderator',
  stance: 'discussion facilitator',
};

function isModeratorPersona(persona: SimPersona) {
  return persona.role_type === 'moderator' || persona.name.toLowerCase() === 'moderator';
}

function scorableAssessmentTurns(events?: Array<Record<string, unknown>>) {
  return (events || []).filter((event) => (
    event.event_type === 'analysis' && event.scorable === true
  )).length;
}

function backendScorableTurns(state: ReturnType<typeof useZiddSession>['state']) {
  const progressCount = state?.assessment_state?.progress?.scorable_turn_count;
  return typeof progressCount === 'number'
    ? progressCount
    : scorableAssessmentTurns(state?.assessment_state?.assessment_events);
}

function GDContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id') || '';
  const topicHint = searchParams.get('topic') || '';
  // Pre-session briefing: show until dismissed, but never block restore.
  const [briefingDismissed, setBriefingDismissed] = useState(false);

  const {
    messages,
    state,
    tension,
    sessionRecap,
    simTurn,
    shouldClose,
    report,
    isClosing,
    error,
    notFound,
    isStreaming,
    isBootstrapping,
    bootstrap,
    streamTurn,
    endSession,
    disconnect
  } = useZiddSession(sessionId, briefingDismissed);

  const [inputValue, setInputValue] = useState('');
  const [recapVisible] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingAssessmentAction, setPendingAssessmentAction] = useState<AssessmentClientAction | null>(null);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const submittingRef = useRef(false);
  const pendingClientTurnIdRef = useRef<string | null>(null);
  const autoEndAttemptedRef = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    autoEndAttemptedRef.current = false;
    bootstrap();
    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, briefingDismissed]);

  const handleEnd = () => {
    setConfirmEndOpen(true);
  };

  const handleConfirmEnd = () => {
    setConfirmEndOpen(false);
    disconnect();
    void endSession();
  };

  useEffect(() => {
    if (shouldClose && !isStreaming && !report && !isClosing && !autoEndAttemptedRef.current) {
      autoEndAttemptedRef.current = true;
      setConfirmEndOpen(true);
    }
  }, [shouldClose, isStreaming, report, isClosing]);

  const handleInputChange = (value: string) => {
    setInputValue(value);
    setPendingAssessmentAction(null);
  };

  const submitDraft = async (draft: string, actionForTurn: AssessmentClientAction | null) => {
    const inputBlocked = state?.input_allowed === false || Boolean(state?.block_reason);
    if (!draft || isStreaming || isClosing || shouldClose || isSubmitting || submittingRef.current || inputBlocked) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    const clientTurnId = pendingClientTurnIdRef.current ?? crypto.randomUUID();
    pendingClientTurnIdRef.current = clientTurnId;
    setInputValue('');
    setPendingAssessmentAction(null);
    try {
      const result = await streamTurn(draft, clientTurnId, actionForTurn ?? undefined);
      if (!result.started) {
        setInputValue(draft);
        setPendingAssessmentAction(actionForTurn);
      }
      if (result.started) {
        pendingClientTurnIdRef.current = null;
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleQuickAction = (action: { value: string; action?: AssessmentClientAction }) => {
    const actionForTurn = action.action ?? null;
    if (!inputValue.trim()) {
      setInputValue(action.value.trim());
      setPendingAssessmentAction(actionForTurn);
      return;
    }
    setPendingAssessmentAction(actionForTurn);
  };

  const handleSend = async () => {
    await submitDraft(inputValue.trim(), pendingAssessmentAction);
  };

  const handleLeave = () => {
    disconnect();
    router.push('/map');
  };

  const handleSaveLater = () => {
    disconnect();
    router.push('/map');
  };

  const latestSpeaker = messages[messages.length - 1]?.speaker_name;
  const scenarioTopic = state?.scenario_config?.topic || topicHint;

  const STANCE_LABEL: Record<string, string> = {
    'strongly in favour': 'Strongly For',
    'strongly against': 'Strongly Against',
    'pragmatic middle ground': 'Moderate',
    'forceful skeptic': 'Challenger',
    'evidence-first analyst': 'Analyst',
    'reserved domain expert': 'Expert',
    'collaborative synthesizer': 'Builder',
    'counter-position specialist': 'Advocate',
  };
  const prettyStance = (s?: string) => {
    if (!s) return undefined;
    const lower = s.toLowerCase();
    const match = Object.entries(STANCE_LABEL).find(([key]) => lower.includes(key));
    return match?.[1] ?? s;
  };

  const backendPersonas: SimPersona[] = state?.personas?.length ? state.personas : [];
  const rawPersonas: SimPersona[] = backendPersonas.length ? backendPersonas : [
    FALLBACK_MODERATOR_PERSONA,
  ];
  const visiblePersonas = rawPersonas.some(isModeratorPersona)
    ? rawPersonas
    : [FALLBACK_MODERATOR_PERSONA, ...rawPersonas];

  const participants = visiblePersonas.map((p) => ({
    id: p.speaker_id,
    name: p.name,
    role: p.role_type === 'moderator' ? 'Facilitator' : p.role,
    stance: p.role_type === 'moderator' ? undefined : prettyStance(p.stance),
    isActive: latestSpeaker === p.name,
  }));
  const activeDebaters = backendPersonas.filter((p) => !isModeratorPersona(p));
  const quickActions = [
    ...activeDebaters.map((persona) => ({
      label: `Ask ${persona.name.split(' ')[0]}`,
      value: `${persona.name}, what is your strongest challenge here?`,
      icon: 'ask' as const,
      action: {
        kind: 'ask_panelist' as const,
        speaker_id: persona.speaker_id,
        speaker_name: persona.name,
        label: `Ask ${persona.name}`,
        source: 'quick_action' as const,
      },
    })),
    {
      label: 'Clarify',
      value: 'Can you clarify the current angle before I answer?',
      icon: 'clarify' as const,
      action: {
        kind: 'clarify' as const,
        label: 'Clarify',
        source: 'quick_action' as const,
      },
    },
    {
      label: 'Moderator Pivot',
      value: 'Moderator, can we pivot to a different angle on this topic?',
      icon: 'angle' as const,
      action: {
        kind: 'new_angle' as const,
        label: 'Moderator Pivot',
        source: 'quick_action' as const,
      },
    },
  ];
  const isComplete = Boolean(report || (state?.status === 'ended' && state?.simulation_report));
  const simulatorStatusLabel = isComplete
    ? 'Complete'
    : isClosing
    ? 'Scoring'
    : isSubmitting || isStreaming
    ? 'Reviewing'
    : 'Ready';
  const scorableTurns = backendScorableTurns(state);
  const minScorableTurns = state?.assessment_state?.progress?.min_scorable_turns ?? 5;
  const leaveNotice = scorableTurns >= minScorableTurns
    ? `Your transcript is saved, but leaving now will not generate the scored GD report. Use End & Score if you want the report for this attempt. Current evidence: ${scorableTurns}/${minScorableTurns} score-eligible answers.`
    : `Your transcript is saved, but leaving now will not generate a reliable scored GD report. Current evidence: ${scorableTurns}/${minScorableTurns} score-eligible answers.`;
  const inputDisabled = isStreaming || shouldClose || isSubmitting || state?.input_allowed === false || Boolean(state?.block_reason);

  if (!sessionId || notFound) {
    return <SessionNotFound onBack={() => router.push('/map')} />;
  }

  if (isBootstrapping) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex items-center justify-center text-sm text-white/60">
        Restoring your discussion…
      </div>
    );
  }

  // Show the briefing only for a fresh, non-terminal discussion.
  if (!briefingDismissed && messages.length === 0 && !report && !shouldClose) {
    return (
      <GDBriefingCard
        topic={scenarioTopic}
        onStart={() => setBriefingDismissed(true)}
        onSkip={() => setBriefingDismissed(true)}
      />
    );
  }

  return (
    <>
        <SimulatorShell
          type="gd"
          title={scenarioTopic ? `Group Discussion: ${scenarioTopic}` : 'Group Discussion'}
        participants={participants}
        onEnd={handleEnd}
        round={simTurn}
        isClosing={isClosing}
        isComplete={isComplete}
        messages={messages.map(m => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          speaker_name: m.speaker_name,
          message_kind: m.message_kind,
        }))}
        inputValue={inputValue}
        setInputValue={handleInputChange}
        onSend={handleSend}
        isStreaming={isStreaming || isSubmitting}
        isInputDisabled={inputDisabled}
        statusLabel={simulatorStatusLabel}
        tension={tension}
        phase={state?.phase}
        error={error}
        quickActions={quickActions}
        onQuickAction={handleQuickAction}
        headerExtra={<CreditsBadge refreshOnMount />}
        onLeave={handleLeave}
        onSaveLater={handleSaveLater}
        leaveNotice={leaveNotice}
      />

      {report && (
        <SimulationReportModal
          type="gd"
          report={report}
          simTurn={simTurn}
          maxRounds={MAX_SIM_ROUNDS}
          onClose={() => router.push('/map')}
          practiceActionLabel="Return to Career Map"
          onPracticeAgain={() => router.push('/map')}
        />
      )}

      {!report && sessionRecap && recapVisible && (
        <SessionRecap recap={sessionRecap} onClose={() => router.push('/map')} returnLabel="Back to Career Map" />
      )}

      <EndSessionConfirmModal
        open={confirmEndOpen}
        type="gd"
        round={simTurn}
        maxRounds={MAX_SIM_ROUNDS}
        scorableTurns={scorableTurns}
        minScorableTurns={minScorableTurns}
        isClosing={isClosing}
        showCancel={!shouldClose}
        onCancel={() => setConfirmEndOpen(false)}
        onConfirm={handleConfirmEnd}
      />
    </>
  );
}

export default function GDPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#0a0a0a] flex items-center justify-center text-sm text-white/60">Preparing your session…</div>}>
      <GDContent />
    </Suspense>
  );
}
