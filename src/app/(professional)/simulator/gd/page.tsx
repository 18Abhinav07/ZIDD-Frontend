"use client";

import { useEffect, useState, useMemo, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useZiddSession, MAX_SIM_ROUNDS } from '@/hooks/useZiddSession';
import { SimulatorShell } from '@/components/simulator/SimulatorShell';
import { GDBriefingCard } from '@/components/simulator/GDBriefingCard';
import { SessionRecap } from '@/components/shared/SessionRecap';
import { SimulationReportModal } from '@/components/shared/SimulationReportModal';
import { SessionNotFound } from '@/components/shared/SessionNotFound';
import { CreditsBadge } from '@/components/billing/CreditsBadge';
import { SimPersona } from '@/types';
import { getCoachingNudge } from '@/lib/coachingNudge';

function GDContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id') || '';
  const topicHint = searchParams.get('topic') || '';

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
    bootstrap,
    streamTurn,
    endSession,
    disconnect
  } = useZiddSession(sessionId, true);

  const [inputValue, setInputValue] = useState('');
  const [recapVisible, setRecapVisible] = useState(true);
  // Pre-session briefing: show until dismissed, then bootstrap the session
  const [briefingDismissed, setBriefingDismissed] = useState(false);

  // Tension annotation: track when tension spikes after a user turn
  const prevTensionRef = useRef(0);
  const [tensionAnnotations, setTensionAnnotations] = useState<Map<string, string>>(new Map());

  // Coaching nudge: memoized from messages so it re-evaluates on each new message
  const coachingNudge = useMemo(() => getCoachingNudge(messages), [messages]);

  useEffect(() => {
    if (!sessionId) return;
    if (!briefingDismissed) return; // wait for briefing dismissal before streaming
    bootstrap();
    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, briefingDismissed]);

  // Tension spike annotations: when tension jumps by 15+ after a user turn,
  // attach a small annotation tag to that user message in the transcript.
  useEffect(() => {
    const delta = tension - prevTensionRef.current;
    if (delta >= 15) {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
      if (lastUserMsg) {
        const copy =
          tension > 70
            ? `Tension +${delta}% — that's assertiveness. Keep it up.`
            : `Tension +${delta}% — direct engagement. GDs reward this.`;
        setTensionAnnotations((prev) => new Map(prev).set(lastUserMsg.id, copy));
      }
    }
    prevTensionRef.current = tension;
  }, [tension, messages]);

  const handleEnd = () => {
    disconnect();
    endSession().then((rep) => {
      if (!rep) router.push('/mode');
    });
  };

  useEffect(() => {
    if (shouldClose && !isStreaming && !report && !isClosing) {
      endSession().then((rep) => {
        if (!rep) router.push('/mode');
      });
    }
  }, [shouldClose, isStreaming, report, isClosing, endSession, router]);

  const handleSend = () => {
    if (!inputValue.trim() || isStreaming) return;
    streamTurn(inputValue);
    setInputValue('');
  };

  const handleLeave = () => {
    disconnect();
    router.push('/mode');
  };

  const handleSaveLater = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'zidd_saved_session',
        JSON.stringify({ session_id: sessionId, type: 'gd', savedAt: Date.now() })
      );
    }
    disconnect();
    router.push('/mode');
  };

  const latestSpeaker = messages[messages.length - 1]?.speaker_name;

  const STANCE_LABEL: Record<string, string> = {
    'strongly in favour': 'Strongly For',
    'strongly against': 'Strongly Against',
    'pragmatic middle ground': 'Moderate',
  };
  const prettyStance = (s?: string) => (s ? STANCE_LABEL[s.toLowerCase()] ?? s : undefined);

  const rawPersonas: SimPersona[] = state?.personas || [
    { speaker_id: 'gd_a', name: 'Aarav', stance: 'Strongly For' },
    { speaker_id: 'gd_b', name: 'Meera', stance: 'Strongly Against' },
    { speaker_id: 'gd_c', name: 'Kabir', stance: 'Moderate' },
  ];

  const participants = rawPersonas
    .filter((p) => p.name?.toLowerCase() !== 'moderator')
    .map((p) => ({
      id: p.speaker_id,
      name: p.name,
      role: p.role,
      stance: prettyStance(p.stance),
      isActive: latestSpeaker === p.name,
    }));

  if (!sessionId || notFound) {
    return <SessionNotFound onBack={() => router.push('/mode')} />;
  }

  // Show the briefing card until the learner dismisses it
  if (!briefingDismissed) {
    return (
      <GDBriefingCard
        topic={topicHint}
        onStart={() => setBriefingDismissed(true)}
        onSkip={() => setBriefingDismissed(true)}
      />
    );
  }

  return (
    <>
      <SimulatorShell
        type="gd"
        title="Group Discussion: Policy Debate"
        participants={participants}
        onEnd={handleEnd}
        round={simTurn}
        isClosing={isClosing}
        messages={messages.map(m => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          speaker_name: m.speaker_name || (m.role === 'user' ? 'You' : 'System')
        }))}
        inputValue={inputValue}
        setInputValue={setInputValue}
        onSend={handleSend}
        isStreaming={isStreaming || shouldClose}
        tension={tension}
        phase={state?.phase}
        error={error}
        headerExtra={<CreditsBadge />}
        onLeave={handleLeave}
        onSaveLater={handleSaveLater}
        coachingTip={coachingNudge?.text}
        tensionAnnotations={tensionAnnotations}
      />

      {report && (
        <SimulationReportModal
          type="gd"
          report={report}
          simTurn={simTurn}
          maxRounds={MAX_SIM_ROUNDS}
          onClose={() => router.push('/mode')}
          onPracticeAgain={() => router.push('/mode')}
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
