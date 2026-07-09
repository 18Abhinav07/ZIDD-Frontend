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
import { SimPersona } from '@/types';

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
  const [recapVisible, setRecapVisible] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    disconnect();
    void endSession();
  };

  useEffect(() => {
    if (shouldClose && !isStreaming && !report && !isClosing && !autoEndAttemptedRef.current) {
      autoEndAttemptedRef.current = true;
      void endSession();
    }
  }, [shouldClose, isStreaming, report, isClosing, endSession]);

  const handleSend = async () => {
    const draft = inputValue.trim();
    const inputBlocked = state?.input_allowed === false || Boolean(state?.block_reason);
    if (!draft || isStreaming || isClosing || shouldClose || isSubmitting || submittingRef.current || inputBlocked) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    const clientTurnId = pendingClientTurnIdRef.current ?? crypto.randomUUID();
    pendingClientTurnIdRef.current = clientTurnId;
    setInputValue('');
    try {
      const result = await streamTurn(draft, clientTurnId);
      if (!result.started) {
        setInputValue(draft);
      }
      if (result.completed) {
        pendingClientTurnIdRef.current = null;
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
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

  const rawPersonas: SimPersona[] = state?.personas?.length ? state.personas : [
    FALLBACK_MODERATOR_PERSONA,
    { speaker_id: 'aggressive_challenger', name: 'Aggressive Challenger', role_type: 'debater', stance: 'forceful skeptic' },
    { speaker_id: 'data_driven_analyst', name: 'Data-Driven Analyst', role_type: 'debater', stance: 'evidence-first analyst' },
    { speaker_id: 'consensus_builder', name: 'Consensus Builder', role_type: 'debater', stance: 'collaborative synthesizer' },
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
  const isComplete = Boolean(report || (state?.status === 'ended' && state?.simulation_report));

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
          speaker_name: m.speaker_name || (m.role === 'user' ? 'You' : 'Panel')
        }))}
        inputValue={inputValue}
        setInputValue={setInputValue}
        onSend={handleSend}
        isStreaming={isStreaming || shouldClose || isSubmitting || state?.input_allowed === false || Boolean(state?.block_reason)}
        tension={tension}
        phase={state?.phase}
        error={error}
        headerExtra={<CreditsBadge refreshOnMount />}
        onLeave={handleLeave}
        onSaveLater={handleSaveLater}
      />

      {report && (
        <SimulationReportModal
          type="gd"
          report={report}
          simTurn={simTurn}
          maxRounds={MAX_SIM_ROUNDS}
          onClose={() => router.push('/map')}
          onPracticeAgain={() => router.push('/map')}
        />
      )}

      {!report && sessionRecap && recapVisible && (
        <SessionRecap recap={sessionRecap} onClose={() => setRecapVisible(false)} />
      )}
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
