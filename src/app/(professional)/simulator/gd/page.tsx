"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useZiddSession } from '@/hooks/useZiddSession';
import { SimulatorShell } from '@/components/simulator/SimulatorShell';
import { SessionRecap } from '@/components/shared/SessionRecap';
import { SimulationReportModal } from '@/components/shared/SimulationReportModal';
import { SessionNotFound } from '@/components/shared/SessionNotFound';
import { CreditsBadge } from '@/components/billing/CreditsBadge';
import { SimPersona } from '@/types';

function GDContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id') || 'demo-gd-session';
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

  useEffect(() => {
    // Rehydrate the transcript on reload, else stream the opening (see hook).
    bootstrap();
    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]); // Add sessionId to ensure it reconnects if it changes

  // Manual "End & Score": stop streaming, then close + score now. Falls back to
  // navigating home if scoring yields nothing. The hook's closingRef latch keeps
  // this safe alongside the auto-close effect below (fires at most once).
  const handleEnd = () => {
    disconnect();
    endSession().then((rep) => {
      if (!rep) router.push('/mode');
    });
  };

  // The Director signalled the panel is winding down: once the final round has
  // finished streaming, score the session and surface the report. If scoring
  // yields nothing (a torn-down session), still move the learner on rather than
  // leaving them on a locked, dead transcript.
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

  const latestSpeaker = messages[messages.length - 1]?.speaker_name;

  // The backend roster carries verbose debate stances ("strongly in favour");
  // map them to the short badge the avatar card shows. Unknown stances pass
  // through unchanged.
  const STANCE_LABEL: Record<string, string> = {
    'strongly in favour': 'Strongly For',
    'strongly against': 'Strongly Against',
    'pragmatic middle ground': 'Moderate',
  };
  const prettyStance = (s?: string) => (s ? STANCE_LABEL[s.toLowerCase()] ?? s : undefined);

  // Real roster rides the done frame; fall back to the named debaters before the
  // first done frame lands so the panel is never empty.
  const rawPersonas: SimPersona[] = state?.personas || [
    { speaker_id: 'gd_a', name: 'Aarav', stance: 'Strongly For' },
    { speaker_id: 'gd_b', name: 'Meera', stance: 'Strongly Against' },
    { speaker_id: 'gd_c', name: 'Kabir', stance: 'Moderate' },
  ];

  // Filter out the moderator from the visual panel — they speak but don't need
  // an avatar card. Show only the named debaters the learner argues against.
  const participants = rawPersonas
    .filter((p) => p.name?.toLowerCase() !== 'moderator')
    .map((p) => ({
      id: p.speaker_id,
      name: p.name,
      role: p.role,
      stance: prettyStance(p.stance),
      isActive: latestSpeaker === p.name,
    }));

  if (notFound) {
    return <SessionNotFound onBack={() => router.push('/mode')} />;
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
        // Lock input the moment the panel starts closing, so no turn lands after
        // the Director has called the session.
        isStreaming={isStreaming || shouldClose}
        tension={tension}
        phase={state?.phase}
        error={error}
        headerExtra={<CreditsBadge />}
      />

      {report && (
        <SimulationReportModal type="gd" report={report} onClose={() => router.push('/mode')} />
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
