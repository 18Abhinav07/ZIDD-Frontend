"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useZiddSession, MAX_SIM_ROUNDS } from '@/hooks/useZiddSession';
import { SimulatorShell } from '@/components/simulator/SimulatorShell';
import { SessionRecap } from '@/components/shared/SessionRecap';
import { SimulationReportModal } from '@/components/shared/SimulationReportModal';
import { SessionNotFound } from '@/components/shared/SessionNotFound';
import { CreditsBadge } from '@/components/billing/CreditsBadge';

function InterviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id') || '';
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
    if (!sessionId) return;
    bootstrap();
    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

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
        JSON.stringify({ session_id: sessionId, type: 'interview', savedAt: Date.now() })
      );
    }
    disconnect();
    router.push('/mode');
  };

  const interviewerName = state?.personas?.[0]?.name || 'Interviewer';

  const participants = [
    {
      id: 'interviewer',
      name: interviewerName,
      role: 'Principal Interviewer',
      isActive: isStreaming || messages[messages.length - 1]?.role === 'assistant',
    }
  ];

  if (!sessionId || notFound) {
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
        isStreaming={isStreaming || shouldClose}
        tension={tension}
        phase={state?.phase}
        error={error}
        headerExtra={<CreditsBadge />}
        onLeave={handleLeave}
        onSaveLater={handleSaveLater}
      />

      {report && (
        <SimulationReportModal
          type="interview"
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

export default function InterviewPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#0a0a0a] flex items-center justify-center text-sm text-white/60">Preparing your session…</div>}>
      <InterviewContent />
    </Suspense>
  );
}
