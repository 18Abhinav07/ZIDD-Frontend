"use client";

import { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useZiddSession, MAX_SIM_ROUNDS } from '@/hooks/useZiddSession';
import { SimulatorShell } from '@/components/simulator/SimulatorShell';
import { SessionRecap } from '@/components/shared/SessionRecap';
import { SimulationReportModal } from '@/components/shared/SimulationReportModal';
import { SessionNotFound } from '@/components/shared/SessionNotFound';
import { CreditsBadge } from '@/components/billing/CreditsBadge';
import { EndSessionConfirmModal } from '@/components/simulator/EndSessionConfirmModal';
import { AssessmentClientAction } from '@/types';

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
  }, [sessionId]);

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
      if (result.completed) {
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

  const interviewerName = state?.personas?.[0]?.name || 'Interviewer';
  const scenario = state?.scenario_config;
  const roleFocus = scenario?.target_role || report?.role_focus || '';
  const interviewLabel = formatInterviewLabel(scenario?.interview_type || 'Interview');
  const interviewerRole = safeInterviewerRole(scenario?.interview_type);
  const isComplete = Boolean(report || (state?.status === 'ended' && state?.simulation_report));
  const simulatorStatusLabel = isComplete
    ? 'Complete'
    : isClosing
    ? 'Scoring'
    : isSubmitting || isStreaming
    ? 'Reviewing'
    : 'Ready';
  const scorableTurns = backendScorableTurns(state);
  const minScorableTurns = state?.assessment_state?.progress?.min_scorable_turns ?? 6;
  const leaveNotice = scorableTurns >= minScorableTurns
    ? `Your transcript is saved, but leaving now will not generate the scored interview report. Use End & Score if you want the report for this attempt. Current evidence: ${scorableTurns}/${minScorableTurns} score-eligible answers.`
    : `Your transcript is saved, but leaving now will not generate a reliable scored interview report. Current evidence: ${scorableTurns}/${minScorableTurns} score-eligible answers.`;
  const inputDisabled = isStreaming || shouldClose || isSubmitting || state?.input_allowed === false || Boolean(state?.block_reason);

  const participants = [
    {
      id: 'interviewer',
      name: interviewerName,
      role: interviewerRole,
      isActive: isStreaming || messages[messages.length - 1]?.role === 'assistant',
    }
  ];
  const quickActions = [
    {
      label: 'Clarify',
      value: 'What do you mean by that question?',
      icon: 'clarify' as const,
      action: {
        kind: 'clarify' as const,
        label: 'Clarify',
        source: 'quick_action' as const,
      },
    },
    {
      label: 'Move On',
      value: 'Can we move to a different topic?',
      icon: 'move' as const,
      action: {
        kind: 'move_on' as const,
        label: 'Move On',
        source: 'quick_action' as const,
      },
    },
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
          type="interview"
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
        type="interview"
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

export default function InterviewPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#0a0a0a] flex items-center justify-center text-sm text-white/60">Preparing your session…</div>}>
      <InterviewContent />
    </Suspense>
  );
}
