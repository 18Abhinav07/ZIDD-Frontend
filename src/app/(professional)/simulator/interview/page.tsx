"use client";

import { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useZiddSession, MAX_SIM_ROUNDS } from '@/hooks/useZiddSession';
import { SimulatorShell } from '@/components/simulator/SimulatorShell';
import { SessionRecap } from '@/components/shared/SessionRecap';
import { SimulationReportModal } from '@/components/shared/SimulationReportModal';
import { SessionNotFound } from '@/components/shared/SessionNotFound';
import { CreditsBadge } from '@/components/billing/CreditsBadge';

function formatInterviewLabel(value?: string | null): string {
  const clean = String(value || 'Interview')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return 'Interview';
  return clean.replace(/\b\w/g, (char) => char.toUpperCase());
}

function safeInterviewerRole(value?: string | null): string {
  const clean = String(value || '').toLowerCase();
  if (clean.includes('technical') || clean.includes('project')) return 'Technical Interviewer';
  if (clean.includes('behavior')) return 'Behavioral Interviewer';
  if (clean.includes('hr')) return 'HR Interviewer';
  if (clean.includes('management')) return 'Management Interviewer';
  if (clean.includes('pressure')) return 'Panel Interviewer';
  return 'Interview Panel';
}

function interviewTitle(label: string, role?: string | null): string {
  const cleanRole = String(role || '').trim();
  return cleanRole ? `${label}: ${cleanRole}` : label;
}

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
    isBootstrapping,
    bootstrap,
    streamTurn,
    endSession,
    disconnect
  } = useZiddSession(sessionId, true);

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
  }, [sessionId]);

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

  const interviewerName = state?.personas?.[0]?.name || 'Interviewer';
  const scenario = state?.scenario_config;
  const roleFocus = scenario?.target_role || report?.role_focus || '';
  const interviewLabel = formatInterviewLabel(scenario?.interview_type || 'Interview');
  const interviewerRole = safeInterviewerRole(scenario?.interview_type);
  const isComplete = Boolean(report || (state?.status === 'ended' && state?.simulation_report));

  const participants = [
    {
      id: 'interviewer',
      name: interviewerName,
      role: interviewerRole,
      isActive: isStreaming || messages[messages.length - 1]?.role === 'assistant',
    }
  ];

  if (!sessionId || notFound) {
    return <SessionNotFound onBack={() => router.push('/map')} />;
  }

  if (isBootstrapping) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex items-center justify-center text-sm text-white/60">
        Restoring your interview…
      </div>
    );
  }

  return (
    <>
      <SimulatorShell
        type="interview"
        title={interviewTitle(interviewLabel, roleFocus)}
        participants={participants}
        onEnd={handleEnd}
        round={simTurn}
        isClosing={isClosing}
        isComplete={isComplete}
        messages={messages.map(m => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          speaker_name: m.speaker_name || (m.role === 'assistant' ? interviewerName : 'You')
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
          type="interview"
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

export default function InterviewPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#0a0a0a] flex items-center justify-center text-sm text-white/60">Preparing your session…</div>}>
      <InterviewContent />
    </Suspense>
  );
}
