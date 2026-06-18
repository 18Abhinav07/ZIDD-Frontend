"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useZiddSession } from '@/hooks/useZiddSession';
import { SimulatorShell } from '@/components/simulator/SimulatorShell';
import { SessionRecap } from '@/components/shared/SessionRecap';
import { SimulationReportModal } from '@/components/shared/SimulationReportModal';
import { SessionNotFound } from '@/components/shared/SessionNotFound';
import { CreditsBadge } from '@/components/billing/CreditsBadge';

function InterviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id') || 'demo-interview-session';
  const {
    messages,
    state,
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
  // navigating home if scoring yields nothing. The hook's closingRef latch makes
  // this safe alongside the auto-close effect below (fires at most once).
  const handleEnd = () => {
    disconnect();
    endSession().then((rep) => {
      if (!rep) router.push('/mode');
    });
  };

  // Interviewer wrapped up (or the round cap hit): once the closing turn has
  // streamed, score the session and show the report; fall back to navigating
  // home if scoring returns nothing.
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

  // Real roster rides the done frame (state.personas[0].name === 'Interviewer'
  // for interview_test). Fall back to the same neutral label, never a stale
  // persona name, before the first done frame lands.
  const interviewerName = state?.personas?.[0]?.name || 'Interviewer';

  const participants = [
    {
      id: 'interviewer',
      name: interviewerName,
      role: 'Principal Interviewer',
      isActive: isStreaming || messages[messages.length - 1]?.role === 'assistant',
    }
  ];

  if (notFound) {
    return <SessionNotFound onBack={() => router.push('/mode')} />;
  }

  return (
    <>
      <SimulatorShell
        type="interview"
        title="High-Stakes Interview"
        participants={participants}
        onEnd={handleEnd}
        round={simTurn}
        isClosing={isClosing}
        messages={messages.map(m => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          speaker_name: m.speaker_name || (m.role === 'assistant' ? interviewerName : 'You')
        }))}
        inputValue={inputValue}
        setInputValue={setInputValue}
        onSend={handleSend}
        // Lock input once the interview is closing so no answer lands after the
        // session has been called.
        isStreaming={isStreaming || shouldClose}
        phase={state?.phase}
        error={error}
        headerExtra={<CreditsBadge />}
      />

      {report && (
        <SimulationReportModal type="interview" report={report} onClose={() => router.push('/mode')} />
      )}

      {!report && sessionRecap && recapVisible && (
        <SessionRecap recap={sessionRecap} onClose={() => setRecapVisible(false)} />
      )}
    </>
  );
}

export default function InterviewPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#0a0a0a] flex items-center justify-center text-sm text-white/60">Preparing your session…</div>}>
      <InterviewContent />
    </Suspense>
  );
}
