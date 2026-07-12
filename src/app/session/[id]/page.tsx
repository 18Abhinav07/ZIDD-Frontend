"use client";

import { useEffect, useState, useRef, useId, memo } from 'react';
import { useRouter } from 'next/navigation';
import { useZiddSession } from '@/hooks/useZiddSession';
import { slowStreamCopyFor, teachingStatusFor } from '@/lib/sessionStreamPresentation.mjs';
import { friendlySessionStartErrorMessage, startSessionWithPaywall } from '@/services/billing';
import { MultipleChoiceCard } from '@/components/cards/MultipleChoiceCard';
import { FillInTheBlankCard } from '@/components/cards/FillInTheBlankCard';
import { SpokenAnswerCard } from '@/components/cards/SpokenAnswerCard';
import { SessionRecap } from '@/components/shared/SessionRecap';
import { TutorShell } from '@/components/tutor/TutorShell';
import { SessionNotFound } from '@/components/shared/SessionNotFound';
import { PaywallModal } from '@/components/billing/PaywallModal';
import { useAppSession } from '@/components/shared/AppSessionProvider';
import { PaperPlaneIcon, ChatBubbleIcon, TargetIcon } from '@radix-ui/react-icons';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getAvatarForSeed, AvatarData } from '@/lib/avatars';
import type { PaywallDetail } from '@/types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SessionMessageSkeleton = memo(function SessionMessageSkeleton({ delay = 0, isUser = false }: { delay?: number, isUser?: boolean }) {
  return (
    <div className={cn(
      "flex flex-col gap-3 max-w-[85%] w-full",
      isUser ? "ml-auto items-end" : "mr-auto items-start"
    )}>
      <div className="flex items-center gap-3">
         {!isUser && <div className="w-6 h-6 rounded-lg bg-slate-100 animate-pulse" />}
         <motion.div animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 2, repeat: Infinity, delay }} className="h-2 w-12 bg-slate-200 rounded" />
         {isUser && <div className="w-6 h-6 rounded-lg bg-slate-100 animate-pulse" />}
      </div>
      
      <div className={cn(
        "p-5 md:p-6 rounded-[2rem] w-full max-w-sm bg-slate-50 border border-slate-100",
        isUser ? "rounded-tr-none" : "rounded-tl-none"
      )}>
        <div className="space-y-3 w-full">
           <motion.div animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 2, repeat: Infinity, delay: delay + 0.1 }} className="h-2.5 bg-slate-200 rounded-sm w-full" />
           <motion.div animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 2, repeat: Infinity, delay: delay + 0.2 }} className="h-2.5 bg-slate-200 rounded-sm w-5/6" />
           <motion.div animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 2, repeat: Infinity, delay: delay + 0.3 }} className="h-2.5 bg-slate-200 rounded-sm w-4/6" />
        </div>
      </div>
    </div>
  );
});

export default function SessionPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { loadBalance } = useAppSession();
  const {
    messages,
    state,
    progress,
    gamePrompt,
    sessionRecap,
    nodeAdvance,
    pendingTransition,
    avatarEmotion,
    affect,
    error,
    notFound,
    isStreaming,
    isRecoveringTurn,
    activeStreamKind,
    isBootstrapping,
    bootstrap,
    streamTurn,
    disconnect
  } = useZiddSession(id, true);

  const [inputValue, setInputValue] = useState('');
  const [recapVisible, setRecapVisible] = useState(true);
  const [avatar, setAvatar] = useState<AvatarData | null>(null);
  const [confirmingExit, setConfirmingExit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slowStream, setSlowStream] = useState(false);
  const [nextSkillError, setNextSkillError] = useState<string | null>(null);
  const [nextSkillPaywall, setNextSkillPaywall] = useState<PaywallDetail | null>(null);
  const [checkpointStartAction, setCheckpointStartAction] = useState<'next' | 'practice' | null>(null);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const submittingRef = useRef(false);
  const pendingClientTurnIdRef = useRef<string | null>(null);
  const pendingGameTurnIdRef = useRef<string | null>(null);
  const pendingNextStartIdRef = useRef<string | null>(null);
  const pendingPracticeStartIdRef = useRef<string | null>(null);
  const pageRequestGenerationRef = useRef(0);
  const answerInputId = useId();

  useEffect(() => {
    pageRequestGenerationRef.current += 1;
    // Deterministic per session id so the coach never reshuffles on reload.
    setAvatar(getAvatarForSeed(id));
    setInputValue('');
    setRecapVisible(true);
    setConfirmingExit(false);
    setIsSubmitting(false);
    setSlowStream(false);
    setNextSkillError(null);
    setNextSkillPaywall(null);
    setCheckpointStartAction(null);
    submittingRef.current = false;
    pendingClientTurnIdRef.current = null;
    pendingGameTurnIdRef.current = null;
    pendingNextStartIdRef.current = null;
    pendingPracticeStartIdRef.current = null;
    // Rehydrate an existing transcript or stream the opening (see hook).
    bootstrap();
    return () => {
      pageRequestGenerationRef.current += 1;
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!isStreaming) {
      setSlowStream(false);
      return;
    }
    const timeout = window.setTimeout(() => setSlowStream(true), 12000);
    return () => window.clearTimeout(timeout);
  }, [isStreaming]);

  useEffect(() => {
    const anchor = endOfMessagesRef.current;
    const scroller = anchor?.closest<HTMLElement>('[data-tutor-scroll]');
    if (!scroller) return;
    const updateAutoScroll = () => {
      shouldAutoScrollRef.current = (
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 160
      );
    };
    updateAutoScroll();
    scroller.addEventListener('scroll', updateAutoScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', updateAutoScroll);
  }, [id, isBootstrapping]);

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming, gamePrompt]);

  useEffect(() => {
    if (state?.handoff_session_id && state.handoff_session_id !== id) {
      router.replace(`/session/${state.handoff_session_id}`);
    }
  }, [id, router, state?.handoff_session_id]);

  const openingRetryActive = !isBootstrapping
    && !isStreaming
    && !pendingTransition
    && Boolean(state)
    && state?.opening_streamed === false
    && messages.length === 0;
  const checkpointReached = Boolean(nodeAdvance || pendingTransition);
  const moduleComplete = Boolean(sessionRecap)
    || (state?.status === 'ended' && state?.block_reason === 'module_done');
  const backendBlocked = Boolean(
    state?.block_reason
    && !['awaiting_next_skill', 'module_done'].includes(state.block_reason)
  );
  const teachingBlocked = openingRetryActive
    || backendBlocked
    || (state?.input_allowed === false && !checkpointReached && !moduleComplete);
  const inputBlocked = openingRetryActive
    || isBootstrapping
    || isRecoveringTurn
    || Boolean(pendingTransition)
    || state?.input_allowed === false
    || Boolean(state?.block_reason);
  const tutorStatusLabel = teachingStatusFor({
    moduleComplete,
    isBootstrapping,
    isRecoveringTurn,
    isStreaming,
    activeStreamKind,
    isSubmitting,
    teachingBlocked,
    checkpointReached,
  });

  const handleSend = async () => {
    const draft = inputValue.trim();
    if (!draft || isStreaming || isSubmitting || submittingRef.current || inputBlocked) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    const clientTurnId = pendingClientTurnIdRef.current ?? crypto.randomUUID();
    pendingClientTurnIdRef.current = clientTurnId;
    const sendRequestGeneration = pageRequestGenerationRef.current;
    const ownsSendRequest = () => (
      pageRequestGenerationRef.current === sendRequestGeneration
    );
    setInputValue('');
    try {
      const result = await streamTurn(draft, clientTurnId);
      if (!ownsSendRequest()) return;
      if (!result.started) {
        pendingClientTurnIdRef.current = null;
        setInputValue(draft);
      }
      if (result.started) {
        pendingClientTurnIdRef.current = null;
      }
    } finally {
      if (ownsSendRequest()) {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    }
  };

  const handleGameSubmit = async (answer: string) => {
    if (isStreaming || isSubmitting || submittingRef.current || inputBlocked) return false;
    submittingRef.current = true;
    setIsSubmitting(true);
    const clientTurnId = pendingGameTurnIdRef.current ?? crypto.randomUUID();
    pendingGameTurnIdRef.current = clientTurnId;
    const gameRequestGeneration = pageRequestGenerationRef.current;
    const ownsGameRequest = () => (
      pageRequestGenerationRef.current === gameRequestGeneration
    );
    let accepted = false;
    try {
      const result = await streamTurn(answer, clientTurnId);
      if (!ownsGameRequest()) return false;
      accepted = result.started;
      if (result.started) {
        pendingGameTurnIdRef.current = null;
      }
      return accepted;
    } finally {
      if (ownsGameRequest()) {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    }
  };

  const handleRetryOpening = async () => {
    if (isStreaming || isSubmitting || submittingRef.current || isBootstrapping) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await streamTurn();
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const startCheckpointAction = async (
    action: 'next' | 'practice',
    confirm: boolean,
  ) => {
    if (isBootstrapping || isStreaming || isSubmitting || submittingRef.current) return;
    const nextNodeId = action === 'practice'
      ? pendingTransition?.from_node
      : pendingTransition?.to_node || nodeAdvance?.to_node;
    const transitionId = pendingTransition?.transition_id;
    if (!nextNodeId) {
      setNextSkillError(action === 'practice'
        ? 'I could not restart this skill. Reload the session and try again.'
        : 'I could not find the next skill. Go back to your path and try again.');
      return;
    }
    if (!transitionId) {
      setNextSkillError('I could not confirm this skill transition. Reload the session and try again.');
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    setCheckpointStartAction(action);
    setNextSkillError(null);
    const startIdRef = action === 'practice'
      ? pendingPracticeStartIdRef
      : pendingNextStartIdRef;
    const clientStartId = startIdRef.current ?? crypto.randomUUID();
    startIdRef.current = clientStartId;
    const checkpointRequestGeneration = pageRequestGenerationRef.current;
    const ownsCheckpointRequest = () => (
      pageRequestGenerationRef.current === checkpointRequestGeneration
    );
    try {
      const result = await startSessionWithPaywall({
        competency_node: nextNodeId,
        test_mode: false,
        confirm,
        reattempt_confirmed: action === 'practice',
        client_start_id: clientStartId,
        source_session_id: id,
        source_transition_id: transitionId,
        source_action: action === 'practice' ? 'reattempt' : 'advance',
      });
      if (!ownsCheckpointRequest()) return;
      if (result.ok) {
        startIdRef.current = null;
        setCheckpointStartAction(null);
        void loadBalance(true).catch(() => null);
        router.push(`/session/${result.session_id}`);
        return;
      }
      setNextSkillPaywall(result.paywall);
    } catch (err) {
      if (!ownsCheckpointRequest()) return;
      setNextSkillError(friendlySessionStartErrorMessage(
        err,
        action === 'practice' ? 'Could not restart this skill.' : 'Could not start the next skill.',
      ));
    } finally {
      if (ownsCheckpointRequest()) {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    }
  };

  const handleStartNextSkill = async () => {
    await startCheckpointAction('next', false);
  };

  const handleKeepPracticing = async () => {
    await startCheckpointAction('practice', false);
  };

  const startTerminalPractice = async (confirm: boolean) => {
    if (isBootstrapping || isStreaming || isSubmitting || submittingRef.current) return;
    const nodeId = state?.competency_node;
    if (!nodeId) {
      setNextSkillError('I could not restart this skill. Return to the path and try again.');
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    setCheckpointStartAction('practice');
    setNextSkillError(null);
    const clientStartId = pendingPracticeStartIdRef.current ?? crypto.randomUUID();
    pendingPracticeStartIdRef.current = clientStartId;
    try {
      const result = await startSessionWithPaywall({
        competency_node: nodeId,
        test_mode: false,
        confirm,
        reattempt_confirmed: true,
        client_start_id: clientStartId,
      });
      if (result.ok) {
        pendingPracticeStartIdRef.current = null;
        setCheckpointStartAction(null);
        void loadBalance(true).catch(() => null);
        router.push(`/session/${result.session_id}`);
        return;
      }
      setNextSkillPaywall(result.paywall);
    } catch (err) {
      setNextSkillError(friendlySessionStartErrorMessage(err, 'Could not restart this skill.'));
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleConfirmNextSkill = async () => {
    if (isBootstrapping || isStreaming || isSubmitting || submittingRef.current) return;
    if (!checkpointStartAction) {
      setNextSkillPaywall(null);
      setNextSkillError('I could not confirm this skill transition. Reload the session and try again.');
      return;
    }
    if (sessionRecap && checkpointStartAction === 'practice') {
      await startTerminalPractice(true);
      return;
    }
    await startCheckpointAction(checkpointStartAction, true);
  };

  const handleNextSkillPaywallClose = () => {
    if (checkpointStartAction === 'practice') {
      pendingPracticeStartIdRef.current = null;
    } else {
      pendingNextStartIdRef.current = null;
    }
    setNextSkillPaywall(null);
    setNextSkillError(null);
    setCheckpointStartAction(null);
  };

  const handleReturnToPath = () => {
    disconnect();
    router.push('/map');
  };

  const isProfessional = Boolean(
    ['interview_prep', 'gd_prep', 'interview_test', 'gd_test'].includes(state?.task_type || '') ||
    state?.module_id === 'interview' ||
    state?.module_id === 'group_discussion' ||
    state?.competency_node?.startsWith('int_') ||
    state?.competency_node?.startsWith('gd_')
  );
  const transitionActive = checkpointReached && !moduleComplete && !teachingBlocked;
  const transitionMastered = Boolean(
    pendingTransition?.from_node_mastered
    ?? (!isProfessional || pendingTransition?.from_display_status === 'mastered')
  );
  const transitionReady = ['ready_to_advance', 'mastered'].includes(
    pendingTransition?.from_display_status || ''
  );
  const transitionGap = transitionReady ? undefined : pendingTransition?.from_last_gap;
  const visibleNodeTitle = transitionActive && pendingTransition?.from_title
    ? pendingTransition.from_title
    : state?.node_title;
  const latestProgressMastery = progress?.mastery ?? state?.current_mastery ?? 0;
  const latestProgressStreak = progress?.clean_streak ?? state?.clean_streak ?? 0;
  const latestProgressAttempts = progress?.attempts ?? state?.attempts ?? 0;
  const latestReadiness = progress?.readiness_score ?? state?.readiness_score ?? latestProgressMastery;
  const transitionReadiness = pendingTransition?.from_readiness_score
    ?? pendingTransition?.from_mastery
    ?? (transitionReady ? Math.max(latestReadiness, 0.8) : latestReadiness);
  const visibleMastery = transitionActive
    ? (transitionMastered ? 1 : transitionReadiness)
    : latestReadiness;
  const visibleCleanStreak = transitionActive
    ? (pendingTransition?.from_clean_streak ?? latestProgressStreak)
    : latestProgressStreak;
  const visibleAttempts = transitionActive
    ? (pendingTransition?.from_attempts ?? latestProgressAttempts)
    : latestProgressAttempts;
  const shellNodeTitle = isBootstrapping && !visibleNodeTitle
    ? 'Loading session'
    : visibleNodeTitle;
  const shellPhase = isBootstrapping && !state?.phase
    ? 'Restoring your path'
    : state?.phase;
  const slowStreamCopy = slowStreamCopyFor(activeStreamKind);

  if (notFound) {
    return <SessionNotFound onBack={() => router.push('/map')} />;
  }

  return (
    <>
    <TutorShell
      nodeTitle={shellNodeTitle}
      mastery={visibleMastery}
      cleanStreak={visibleCleanStreak}
      attempts={visibleAttempts}
      phase={shellPhase}
      mode={isProfessional ? 'professional' : 'gamified'}
      characterImg={avatar?.url}
      characterBg={avatar?.bg}
      emotion={avatarEmotion}
      affect={affect}
      statusLabel={tutorStatusLabel}
      onBack={() => setConfirmingExit(true)}
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* Transcript Area */}
        <div data-tutor-scroll className="flex-1 min-h-0 overflow-y-auto scroll-smooth flex flex-col gap-8 p-6 lg:p-10 pb-6">
          <AnimatePresence mode="popLayout">
            {messages.length === 0 && !state && !gamePrompt && (isBootstrapping || isStreaming) && (
               <motion.div 
                 key="sync-session"
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 className="flex flex-col gap-8 py-8 w-full"
               >
                  <SessionMessageSkeleton delay={0} />
                  <div className="opacity-70"><SessionMessageSkeleton delay={0.4} isUser /></div>
                  <div className="opacity-40"><SessionMessageSkeleton delay={0.8} /></div>
               </motion.div>
            )}

            {messages.map((msg) => (
              <motion.div 
                key={msg.id} 
                layout
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "flex flex-col gap-3 max-w-[85%]",
                  msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                <div className="flex items-center gap-3">
                   {msg.role === 'assistant' && <div className="w-6 h-6 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-[10px] font-bold uppercase text-accent">AI</div>}
                   <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                      {msg.role === 'user' ? 'You' : (msg.speaker_name || 'Coach')}
                   </span>
                   {msg.role === 'user' && <div className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold uppercase text-slate-600">ME</div>}
                </div>
                
                <div className={cn(
                  "p-5 md:p-6 rounded-[2rem] text-[15px] md:text-base leading-relaxed font-medium whitespace-pre-wrap",
                  msg.role === 'user' 
                    ? "bg-foreground text-background rounded-tr-none shadow-[0_10px_30px_rgba(0,0,0,0.08)]" 
                    : "bg-slate-50 border border-slate-100 text-slate-700 rounded-tl-none"
                )}>
                  {msg.content}
                </div>
              </motion.div>
            ))}

            {transitionActive && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl mx-auto my-8 bg-accent/5 border border-accent/20 rounded-3xl p-8 text-center"
              >
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-200">
                   <TargetIcon className="w-8 h-8 text-accent" />
                </div>
                <h3 className="font-display text-2xl mb-2 text-slate-800">
                  {transitionMastered
                    ? 'Skill mastered'
                    : transitionReady
                      ? 'Ready for next skill'
                      : 'Practice checkpoint passed'}
                </h3>
                <p className="text-slate-500 mb-8">
                  {pendingTransition?.to_title
                    ? `Next up: ${pendingTransition.to_title}.`
                    : transitionMastered
                      ? "You've mastered this skill. Ready to move on?"
                      : "This checkpoint opens the next skill. Use the current gap below to decide whether to keep practising first."}
                </p>
                {!transitionMastered && transitionGap && (
                  <p className="max-w-md mx-auto -mt-4 mb-8 text-sm leading-relaxed text-slate-500">
                    Current gap: {transitionGap}
                  </p>
                )}
                {nextSkillError && (
                  <p className="text-[13px] text-red-500 font-semibold mb-5">
                    {nextSkillError}
                  </p>
                )}
                <button
                  onClick={handleStartNextSkill}
                  disabled={isBootstrapping || isStreaming || isSubmitting || Boolean(nextSkillPaywall)}
                  className="px-8 py-4 bg-accent text-white rounded-full font-bold uppercase tracking-widest text-sm hover:scale-105 transition-transform shadow-lg shadow-accent/20 disabled:opacity-60 disabled:cursor-wait"
                >
                  {isSubmitting ? 'Starting...' : 'Start Next Skill'}
                </button>
                {!transitionMastered && (
                  <button
                    type="button"
                    onClick={handleKeepPracticing}
                    disabled={isBootstrapping || isStreaming || isSubmitting || Boolean(nextSkillPaywall)}
                    className="mt-3 px-6 py-3 rounded-full border border-slate-200 bg-white text-slate-600 font-bold uppercase tracking-widest text-xs hover:bg-slate-50 transition-colors"
                  >
                    {isSubmitting && checkpointStartAction === 'practice'
                      ? 'Starting Practice...'
                      : 'Keep Practicing This Skill'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleReturnToPath}
                  disabled={isSubmitting}
                  className="mt-3 px-6 py-3 text-slate-500 font-bold uppercase tracking-widest text-xs hover:text-slate-900 transition-colors disabled:opacity-50"
                >
                  Return to Path
                </button>
              </motion.div>
            )}

            {isStreaming && !checkpointReached && (
               <motion.div 
                 key="processing"
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: 10 }}
                 className="mt-6 w-full"
               >
                  <SessionMessageSkeleton />
                  {slowStream && (
                    <p className="mt-4 max-w-sm rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold leading-relaxed text-slate-500" aria-live="polite">
                      {slowStreamCopy}
                    </p>
                  )}
               </motion.div>
            )}
            
          </AnimatePresence>
          {/* Scroll anchor lives OUTSIDE AnimatePresence: a plain (non-motion)
              element as a direct child of `mode="popLayout"` makes framer-motion's
              PopChild attach a ref to it and React warns "ref is not a prop". */}
          <div ref={endOfMessagesRef} />
        </div>

        {/* Input / Action Area */}
        <div className="relative z-20 shrink-0 max-h-[65dvh] overflow-y-auto border-t border-slate-100 bg-white px-4 py-4 sm:px-6 lg:px-10">
           <div className="relative max-w-3xl mx-auto">
              <AnimatePresence>
                {error && !checkpointReached && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute -top-12 left-0 right-0 text-center text-[10px] font-bold text-red-500 uppercase tracking-widest"
                  >
                    {error}
                  </motion.div>
                )}

                {transitionActive ? null : openingRetryActive ? (
                  <motion.div
                    key="opening-retry"
                    layoutId="action-card"
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="rounded-[2rem] border border-amber-200 bg-amber-50 px-5 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.05)]"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600">
                          Opening paused
                        </p>
                        <p className="mt-1 text-sm font-semibold text-amber-950">
                          The first prompt did not finish loading.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRetryOpening}
                        disabled={isStreaming || isSubmitting || isBootstrapping}
                        className="inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-amber-600 disabled:cursor-wait disabled:opacity-60"
                      >
                        {isSubmitting ? 'Retrying...' : 'Retry opening'}
                      </button>
                    </div>
                  </motion.div>
                ) : gamePrompt ? (
                  <motion.div 
                    key="game-prompt"
                    layoutId="action-card"
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {gamePrompt.type === 'multiple_choice' && gamePrompt.options ? (
                      <MultipleChoiceCard
                        sentence={gamePrompt.sentence}
                        hint={gamePrompt.hint}
                        context={gamePrompt.context}
                        options={gamePrompt.options}
                        onSubmit={handleGameSubmit}
                        disabled={isStreaming || isSubmitting || inputBlocked}
                      />
                    ) : gamePrompt.type === 'spoken' ? (
                      <SpokenAnswerCard
                        sentence={gamePrompt.sentence}
                        hint={gamePrompt.hint}
                        context={gamePrompt.context}
                        onSubmit={handleGameSubmit}
                        disabled={isStreaming || isSubmitting || inputBlocked}
                      />
                    ) : (
                      <FillInTheBlankCard
                        sentence={gamePrompt.sentence}
                        hint={gamePrompt.hint}
                        context={gamePrompt.context}
                        onSubmit={handleGameSubmit}
                        disabled={isStreaming || isSubmitting || inputBlocked}
                      />
                    )}
                  </motion.div>
                ) : (
                  <motion.div 
                    key="chat-input"
                    layoutId="action-card"
                    className="bg-white rounded-[2.5rem] p-2 shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-slate-200/60 overflow-hidden group transition-all focus-within:ring-4 focus-within:ring-accent/10 focus-within:border-accent/30"
                  >
                    <div className="flex items-center gap-4 px-6 py-3">
                      <ChatBubbleIcon className="text-slate-300 group-focus-within:text-accent transition-colors w-5 h-5" />
                      <textarea
                        id={answerInputId}
                        name="tutor-response"
                        value={inputValue}
                        rows={1}
                        onChange={e => {
                          setInputValue(e.target.value);
                          e.currentTarget.style.height = 'auto';
                          e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 144)}px`;
                        }}
                        onInput={e => setInputValue(e.currentTarget.value)}
                        placeholder="Type your response..."
                        disabled={isStreaming || isSubmitting || inputBlocked}
                        className="flex-1 max-h-36 resize-none bg-transparent border-none focus:ring-0 text-[15px] font-medium leading-relaxed placeholder:text-slate-300 py-3 text-slate-800 outline-none"
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                      />
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleSend} 
                        aria-label="Send response"
                        title="Send response"
                        disabled={isStreaming || isSubmitting || inputBlocked || !inputValue.trim()}
                        className="w-14 h-14 rounded-full bg-accent text-white flex items-center justify-center transition-all disabled:opacity-50 disabled:grayscale"
                      >
                        <PaperPlaneIcon className="w-5 h-5 ml-1" />
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
           </div>
        </div>
        
        {sessionRecap && recapVisible && (
          <SessionRecap
            recap={sessionRecap}
            title={state?.module_id === 'interview'
              ? 'Interview Prep Complete'
              : state?.module_id === 'group_discussion'
                ? 'GD Prep Complete'
                : 'Session Complete'}
            onPractice={() => void startTerminalPractice(false)}
            practiceDisabled={isSubmitting || Boolean(nextSkillPaywall)}
            onClose={handleReturnToPath}
            returnLabel="Back to Career Map"
          />
        )}
      </div>
    </TutorShell>
    <PaywallModal
      paywall={nextSkillPaywall}
      onClose={handleNextSkillPaywallClose}
      onConfirm={handleConfirmNextSkill}
      onBalanceChange={() => void loadBalance(true).catch(() => null)}
      error={nextSkillError}
      confirming={isSubmitting}
    />
    {confirmingExit && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full mx-4 shadow-2xl">
          <h3 className="font-display text-2xl mb-2 text-slate-900">Leave session?</h3>
          <p className="text-slate-500 text-sm mb-8 leading-relaxed">Your progress so far is saved, but the current exchange will end.</p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmingExit(false)}
              className="flex-1 px-6 py-3 rounded-full border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors"
            >
              Stay
            </button>
            <button
              onClick={() => { disconnect(); router.push('/map'); }}
              className="flex-1 px-6 py-3 rounded-full bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-colors"
            >
              Leave
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
