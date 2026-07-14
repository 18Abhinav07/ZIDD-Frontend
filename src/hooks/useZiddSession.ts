"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { getAuthHeaders } from '../services/api';
import { invalidateMeActivityCache, invalidateMeLearningGraphCache } from '../services/me';
import { ZiddSSEClient } from '../services/sseClient';
import {
  durableTurnCompleted,
  nextActiveStreamKind,
  openingSnapshotComplete,
  runLateTurnRecovery,
  shouldStartLateTurnRecovery,
} from '../lib/sessionStreamPresentation.mjs';
import {
  DoneFrame,
  NodeAdvanceFrame,
  ProgressUpdateFrame,
  GamePromptFrame,
  SessionRecapFrame,
  SimulationStateFrame,
  AdaptationCueFrame,
  SpeakerFrame,
  ChatMessage,
  TranscriptResponse,
  SimulationReport,
  EndSessionResponse,
  PendingNodeTransition,
  AssessmentClientAction
} from '../types';

// Hard round cap mirrored from the backend (simulation_service MAX_SIM_ROUNDS).
// Surfaced so the simulator can render a "Round N / MAX" indicator.
export const MAX_SIM_ROUNDS = 10;

type StreamTurnResult = {
  started: boolean;
  completed: boolean;
};

export type ActiveStreamKind = 'opening' | 'learner_turn' | null;

type ExpectedUserTurn = {
  clientTurnId: string;
  userInput: string;
};

type TranscriptRestoreOutcome = {
  foundExpectedTurn: boolean;
  completed: boolean;
  failed: boolean;
  terminal?: boolean;
};

// Close any still-open (streaming) assistant bubble so the next token starts a
// fresh one. Pure: derives the new array from `prev`, with no ref mutation — the
// "is a bubble open" signal lives on the message itself (`streaming`), not in a
// ref written inside a reducer (which double-committed under React strict mode
// and split the first token into its own bubble).
function finalizeOpen(prev: ChatMessage[]): ChatMessage[] {
  const last = prev[prev.length - 1];
  if (last && last.streaming) {
    return [...prev.slice(0, -1), { ...last, streaming: false }];
  }
  return prev;
}

function duplicateAssistantDisplayKey(message: ChatMessage): string {
  return [
    message.role,
    // Live SSE bubbles carry the display name, while transcript rehydration
    // also adds speaker_id. Identity metadata must not make the same visible
    // assistant response look different during stream-plus-recovery merging.
    message.speaker_name ?? message.speaker_id ?? '',
    String(message.content ?? '').trim().replace(/\s+/g, ' '),
  ].join('|');
}

function dedupeAdjacentDuplicateMessages(messages: ChatMessage[]): ChatMessage[] {
  const deduped: ChatMessage[] = [];
  for (const message of messages) {
    const previous = deduped[deduped.length - 1];
    if (
      previous &&
      previous.role === 'assistant' &&
      message.role === 'assistant' &&
      duplicateAssistantDisplayKey(previous) === duplicateAssistantDisplayKey(message)
    ) {
      continue;
    }
    deduped.push(message);
  }
  return deduped;
}

function cleanRestoredTranscriptContent(content: string): string {
  return content.replace(/^\[(?:Fill in the blank|Bridge exercise|Multiple choice|Spoken answer)\]\s*/i, 'Bridge exercise: ');
}

function transcriptMessageKey(message: ChatMessage): string {
  if (message.message_id) return `message:${message.message_id}`;
  if (message.message_kind === 'opening') {
    return [
      'opening',
      message.node_id ?? '',
      message.transition_id ?? '',
      message.speaker_id ?? '',
      message.speaker_name ?? '',
      message.content,
    ].join('|');
  }
  return [
    message.id,
    message.role,
    message.node_id ?? '',
    message.transition_id ?? '',
    message.speaker_id ?? '',
    message.speaker_name ?? '',
    message.content,
  ].join('|');
}

function normalizeTranscriptMessages(
  messages: ChatMessage[] | undefined,
  restoredGamePrompt: GamePromptFrame | null
): ChatMessage[] {
  if (!Array.isArray(messages)) return [];
  const seen = new Set<string>();
  const normalized: ChatMessage[] = [];
  const visibleTranscriptMessages = messages.filter((m) => {
    if (!restoredGamePrompt?.turn_id) return true;
    return !(
      m.role === 'assistant' &&
      m.turn_id === restoredGamePrompt.turn_id &&
      String(m.content).includes(restoredGamePrompt.sentence)
    );
  });
  for (const m of visibleTranscriptMessages) {
    const row: ChatMessage = {
      id: m.id,
      message_id: m.message_id ?? undefined,
      role: m.role,
      content: cleanRestoredTranscriptContent(m.content),
      turn_id: m.turn_id ?? undefined,
      speaker_name: m.speaker_name ?? undefined,
      speaker_id: m.speaker_id ?? undefined,
      node_id: m.node_id ?? undefined,
      transition_id: m.transition_id ?? undefined,
      message_kind: m.message_kind ?? undefined,
      status: m.status ?? undefined,
    };
    const key = transcriptMessageKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(row);
  }
  return dedupeAdjacentDuplicateMessages(normalized);
}

function hasOpeningTranscriptMessage(messages: ChatMessage[]): boolean {
  return messages.some((message) => message.role === 'assistant' && message.message_kind === 'opening');
}

function hasCompletedTurnOutcomeAfterUserIndex(
  data: TranscriptResponse,
  messages: ChatMessage[],
  userIndex: number
): boolean {
  if (userIndex < 0) return false;
  const assistantAfterCurrentUserTurn = messages
    .slice(userIndex + 1)
    .some((message) => message.role === 'assistant');
  const pending = data.pending_transition ?? data.state?.pending_transition ?? null;
  const currentUserTurnId = messages[userIndex]?.turn_id;
  const gamePromptCompletesCurrentTurn = Boolean(
    currentUserTurnId && data.game_prompt?.turn_id === currentUserTurnId
  );
  return (
    assistantAfterCurrentUserTurn ||
    Boolean(pending) ||
    gamePromptCompletesCurrentTurn ||
    Boolean(data.state?.module_done) ||
    Boolean(data.state?.session_over) ||
    data.state?.status === 'ended' ||
    Boolean(data.state?.simulation_report)
  );
}

function hasCompletedTurnOutcomeAfterExpectedUser(
  data: TranscriptResponse,
  messages: ChatMessage[],
  expectedUserTurn?: ExpectedUserTurn
): boolean {
  if (!expectedUserTurn) return false;
  const currentUserTurnIndex = findCurrentUserTurnIndex(messages, expectedUserTurn);
  return hasCompletedTurnOutcomeAfterUserIndex(data, messages, currentUserTurnIndex);
}

function findCurrentUserTurnIndex(
  messages: ChatMessage[],
  expectedUserTurn?: ExpectedUserTurn
): number {
  if (!expectedUserTurn) return -1;
  const clientTurnId = expectedUserTurn.clientTurnId.trim();
  const exactTurnIndex = messages.findIndex((message) => {
    if (message.role !== 'user') return false;
    const messageTurnId = String(message.turn_id ?? '').trim();
    const messageId = String(message.message_id ?? '');
    if (
      clientTurnId &&
      (messageTurnId === clientTurnId || messageId.includes(`:turn:${clientTurnId}:user`))
    ) {
      return true;
    }
    return false;
  });
  return exactTurnIndex;
}

function recoverTurnLockFromTranscript(data: TranscriptResponse) {
  const activeTurn = data.active_turn ?? data.state?.active_turn ?? null;
  const blockReason = data.block_reason ?? data.state?.block_reason;
  const releaseStaleTurnLock =
    activeTurn?.status === 'processing' &&
    blockReason === 'turn_processing' &&
    durableTurnSettled(data.state?.last_turn, activeTurn.client_turn_id);
  return {
    activeTurn: releaseStaleTurnLock ? null : activeTurn,
    inputAllowed: releaseStaleTurnLock ? true : data.input_allowed ?? data.state?.input_allowed,
    blockReason: releaseStaleTurnLock ? null : blockReason,
  };
}

function durableTurnSettled(
  lastTurn: DoneFrame['last_turn'],
  expectedClientTurnId: string
): boolean {
  return Boolean(
    expectedClientTurnId &&
    lastTurn?.client_turn_id === expectedClientTurnId &&
    (lastTurn?.status === 'completed' || lastTurn?.status === 'failed')
  );
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function invalidateCareerEvidenceCaches(): void {
  invalidateMeActivityCache();
  invalidateMeLearningGraphCache();
}

function abortError(): Error {
  const error = new Error('transcript_request_aborted');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError();
}

function awaitWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      value => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      error => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      }
    );
  });
}

const OPENING_RECOVERY_POLL_ATTEMPTS = 90;
const OPENING_RECOVERY_POLL_DELAY_MS = 2_000;
const SESSION_STREAM_IDLE_TIMEOUT_MS = 35_000;
const SESSION_STREAM_RECOVERY_FIRST_POLL_MS = 25_000;
const SESSION_STREAM_RECOVERY_POLL_DELAY_MS = 10_000;
const SESSION_STREAM_RECOVERY_MAX_POLLS = 8;
const SESSION_STREAM_MAX_DURATION_MS = 150_000;
const SESSION_STREAM_LATE_RECOVERY_DURATION_MS = 360_000;
const SESSION_STREAM_LATE_RECOVERY_POLL_DELAY_MS = 20_000;
const SESSION_STREAM_LATE_RECOVERY_MAX_POLLS = 18;
const TRANSCRIPT_REQUEST_TIMEOUT_MS = 15_000;
const TRANSIENT_PROCESSING_MESSAGE = 'Your last answer is still being processed. Wait here or reload in a moment.';
const LATE_RECOVERY_MESSAGE = 'The tutor is still working. This page will update automatically when your answer is ready.';
const LATE_RECOVERY_EXHAUSTED_MESSAGE = 'The tutor is taking longer than expected. Reload this page to check for the completed answer.';

function roundFromDoneFrame(done: DoneFrame): number | null {
  const stateRound = typeof done.simulation_round === 'number' ? done.simulation_round : null;
  const progressRound =
    typeof done.assessment_state?.progress?.round_count === 'number'
      ? done.assessment_state.progress.round_count
      : null;
  const nextRound = stateRound && stateRound > 0 ? stateRound : progressRound;
  return nextRound && nextRound > 0 ? nextRound : null;
}

export function useZiddSession(sessionId: string, isOpening: boolean = false) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<DoneFrame | null>(null);
  const [progress, setProgress] = useState<ProgressUpdateFrame | null>(null);
  const [gamePrompt, setGamePrompt] = useState<GamePromptFrame | null>(null);
  const [sessionRecap, setSessionRecap] = useState<SessionRecapFrame | null>(null);
  const [nodeAdvance, setNodeAdvance] = useState<{ from_node: string, to_node: string } | null>(null);
  const [pendingTransition, setPendingTransition] = useState<PendingNodeTransition | null>(null);
  const [adaptationCue, setAdaptationCue] = useState<AdaptationCueFrame | null>(null);
  // Transient per-turn affect: the avatar's emotion + the learner's affect only
  // hold from the done frame that set them. They reset to undefined on a new
  // turn, a node_advance, or an error so the avatar never shows stale affect
  // from the previous node while the next done frame is still in flight.
  const [avatarEmotion, setAvatarEmotion] = useState<DoneFrame['avatar_emotion'] | undefined>(undefined);
  const [affect, setAffect] = useState<DoneFrame['affect'] | undefined>(undefined);
  const [tension, setTension] = useState<number>(0);
  // Current simulation round (Director's turn counter), for the "Round N/MAX"
  // indicator. 0 until the first simulation_state frame lands.
  const [simTurn, setSimTurn] = useState<number>(0);
  // Terminal simulation signals. `shouldClose` flips true (and stays) the moment
  // the Director winds the panel down or the hard round cap hits; the page then
  // fetches the scored `report` via POST /end. `isClosing` covers the scoring
  // round-trip (an LLM call) so the page can show a 'scoring' state.
  const [shouldClose, setShouldClose] = useState(false);
  const [report, setReport] = useState<SimulationReport | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecoveringTurn, setIsRecoveringTurn] = useState(false);
  const [activeStreamKind, setActiveStreamKind] = useState<ActiveStreamKind>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  // Distinct from a transport error: the session id is unknown/expired (the
  // transcript fetch 404'd). The page shows a "session not found" screen with a
  // way back to the map instead of a misleading "connection error" banner.
  const [notFound, setNotFound] = useState(false);

  const startActiveStream = useCallback((kind: Exclude<ActiveStreamKind, null>) => {
    setActiveStreamKind((current) => nextActiveStreamKind(
      current,
      kind === 'opening' ? 'opening_started' : 'learner_turn_started'
    ));
    setIsStreaming(true);
  }, []);

  const clearActiveStream = useCallback((reason: 'completed' | 'error' | 'disconnected' | 'session_changed') => {
    setIsStreaming(false);
    setActiveStreamKind((current) => nextActiveStreamKind(current, reason));
  }, []);

  const clientRef = useRef<ZiddSSEClient | null>(null);
  const currentSpeakerRef = useRef<string | undefined>(undefined);
  // Synchronous latch: state-based isClosing has a re-render race, so two effect
  // runs could both fire POST /end. The second call hits an already-popped
  // session (404/empty) and would clobber `report` back to null. This ref blocks
  // re-entry before any render commits.
  const closingRef = useRef(false);
  const streamInFlightRef = useRef(false);
  const activeStreamTokenRef = useRef<string | null>(null);
  const lateRecoveryTokenRef = useRef<string | null>(null);
  const activeStreamSettleRef = useRef<((result: StreamTurnResult) => void) | null>(null);
  const streamEventRevisionRef = useRef(0);
  const gamePromptSeenThisStreamRef = useRef(false);
  const pendingGamePromptFrameRef = useRef<GamePromptFrame | null>(null);
  const pendingVisibleSimTurnRef = useRef<number | null>(null);
  // React dev/StrictMode can run mount effects twice. Bootstrap is allowed once
  // per session id; otherwise two transcript checks can both stream an opening.
  const bootstrappedSessionRef = useRef<string | null>(null);
  const bootstrapGenerationRef = useRef(0);
  const activeSessionIdRef = useRef(sessionId);
  const transcriptRequestControllersRef = useRef<Set<AbortController>>(new Set());
  const sessionIdChanged = activeSessionIdRef.current !== sessionId;

  const abortTranscriptRequests = useCallback(() => {
    transcriptRequestControllersRef.current.forEach((controller) => {
      controller.abort();
    });
    transcriptRequestControllersRef.current.clear();
  }, []);

  const runBoundedTranscriptRequest = useCallback(async <T,>(
    deadlineMs: number,
    request: (signal: AbortSignal) => Promise<T>
  ): Promise<T> => {
    const remainingMs = deadlineMs - Date.now();
    if (remainingMs <= 0) throw abortError();

    const controller = new AbortController();
    transcriptRequestControllersRef.current.add(controller);
    const timeout = setTimeout(
      () => controller.abort(),
      Math.min(TRANSCRIPT_REQUEST_TIMEOUT_MS, remainingMs)
    );
    try {
      return await awaitWithAbort(request(controller.signal), controller.signal);
    } finally {
      clearTimeout(timeout);
      transcriptRequestControllersRef.current.delete(controller);
    }
  }, []);

  useEffect(() => {
    abortTranscriptRequests();
    bootstrapGenerationRef.current += 1;
    activeSessionIdRef.current = sessionId;
    activeStreamSettleRef.current?.({ started: false, completed: false });
    activeStreamSettleRef.current = null;
    clientRef.current?.disconnect();
    clientRef.current = null;
    currentSpeakerRef.current = undefined;
    closingRef.current = false;
    streamInFlightRef.current = false;
    activeStreamTokenRef.current = null;
    lateRecoveryTokenRef.current = null;
    setIsRecoveringTurn(false);
    streamEventRevisionRef.current = 0;
    gamePromptSeenThisStreamRef.current = false;
    pendingGamePromptFrameRef.current = null;
    pendingVisibleSimTurnRef.current = null;
    bootstrappedSessionRef.current = null;

    setMessages([]);
    setState(null);
    setProgress(null);
    setGamePrompt(null);
    setSessionRecap(null);
    setNodeAdvance(null);
    setPendingTransition(null);
    setAdaptationCue(null);
    setAvatarEmotion(undefined);
    setAffect(undefined);
    setTension(0);
    setSimTurn(0);
    setShouldClose(false);
    setReport(null);
    setIsClosing(false);
    setError(null);
    clearActiveStream('session_changed');
    setIsBootstrapping(true);
    setNotFound(false);
  }, [abortTranscriptRequests, clearActiveStream, sessionId]);

  useEffect(() => () => {
    abortTranscriptRequests();
    bootstrapGenerationRef.current += 1;
    lateRecoveryTokenRef.current = null;
    activeStreamTokenRef.current = null;
    activeStreamSettleRef.current?.({ started: false, completed: false });
    activeStreamSettleRef.current = null;
    clientRef.current?.disconnect();
    clientRef.current = null;
    streamInFlightRef.current = false;
  }, [abortTranscriptRequests]);

  const handleEvent = useCallback((eventName: string, data: unknown) => {
    switch (eventName) {
      case 'message':
        if (pendingVisibleSimTurnRef.current !== null) {
          setSimTurn(pendingVisibleSimTurnRef.current);
          pendingVisibleSimTurnRef.current = null;
        }
        // A plain assistant stream means the backend is replying in chat, not
        // serving/keeping a bridge card. Clear any local card immediately so a
        // wrong card answer cannot leave a stale disabled prompt under the retry
        // message while the backend state already has game_prompt=null.
        pendingGamePromptFrameRef.current = null;
        setGamePrompt(null);
        setError(prev => (prev === TRANSIENT_PROCESSING_MESSAGE ? null : prev));
        // Append the token to the open assistant bubble; open a NEW bubble only
        // when there is no open one or the speaker changed (GD: two debaters must
        // never merge under one name). Pure reducer — see finalizeOpen.
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (
            last &&
            last.role === 'assistant' &&
            last.streaming &&
            last.speaker_name === currentSpeakerRef.current
          ) {
              return [...prev.slice(0, -1), { ...last, content: last.content + String(data) }];
          }
          return [
            ...prev,
            {
              // `live-` prefix never collides with rehydrated `${sid}-${i}` ids;
              // prev.length is monotonic (we only append) so it's unique + stable.
              id: `live-${prev.length}`,
              role: 'assistant',
              content: String(data),
              speaker_name: currentSpeakerRef.current,
              streaming: true,
            },
          ];
        });
        break;
      case 'progress_update':
        setProgress(data as ProgressUpdateFrame);
        break;
      case 'node_advance':
        // Close the old node's bubble and drop its speaker context: a 'speaker'
        // frame sets this fresh inside a simulation, so undefined is correct
        // until then and prevents a prior persona's name bleeding onto a plain turn.
        setMessages(prev => dedupeAdjacentDuplicateMessages(finalizeOpen(prev)));
        currentSpeakerRef.current = undefined;
        setNodeAdvance(data as NodeAdvanceFrame);
        // New node: drop the prior node's affect until a fresh done frame lands.
        setAvatarEmotion(undefined);
        setAffect(undefined);
        break;
      case 'session_recap':
        setSessionRecap(data as SessionRecapFrame);
        break;
      case 'game_prompt':
        gamePromptSeenThisStreamRef.current = true;
        // A game prompt is actionable UI. The backend can still be persisting
        // mastery/progress after yielding it, so render it only once the final
        // done frame releases the stream lock. Otherwise the learner sees an
        // exercise with every control disabled.
        pendingGamePromptFrameRef.current = data as GamePromptFrame;
        break;
      case 'speaker': {
        // A new persona block begins: close the current bubble so the next token
        // opens a fresh one attributed to this speaker.
        const speakerData = data as SpeakerFrame;
        setMessages(prev => dedupeAdjacentDuplicateMessages(finalizeOpen(prev)));
        currentSpeakerRef.current = speakerData.name;
        break;
      }
      case 'simulation_state': {
        const sim = data as SimulationStateFrame;
        // Backend tension is 0.0-1.0; the meter renders `width: ${tension}%` with
        // colour thresholds at 40/70, so it expects a 0-100 scale. Scale here (the
        // meter's only consumer) so the bar actually tracks the Director's heat
        // instead of sitting flat near-empty at <=1% width.
        setTension(Math.round(Math.max(0, Math.min(1, sim.tension)) * 100));
        if (sim.turn) pendingVisibleSimTurnRef.current = sim.turn;
        // Terminal and sticky: once the Director signals close, never un-set it
        // (a later round's frame can't reopen a closing panel).
        if (sim.should_close) setShouldClose(true);
        break;
      }
      case 'adaptation_cue':
        setAdaptationCue(data as AdaptationCueFrame);
        break;
      case 'accepted':
      case 'heartbeat':
        break;
      case 'done': {
        const done = data as DoneFrame;
        if (pendingVisibleSimTurnRef.current !== null) {
          setSimTurn(pendingVisibleSimTurnRef.current);
          pendingVisibleSimTurnRef.current = null;
        }
        // The stream ended cleanly: finalise the open bubble so a later turn's
        // first token can't append to it.
        setMessages(prev => dedupeAdjacentDuplicateMessages(finalizeOpen(prev)));
        if (gamePromptSeenThisStreamRef.current && pendingGamePromptFrameRef.current) {
          setGamePrompt(pendingGamePromptFrameRef.current);
        } else {
          setGamePrompt(null);
        }
        const doneRound = roundFromDoneFrame(done);
        if (doneRound !== null) setSimTurn(doneRound);
        pendingGamePromptFrameRef.current = null;
        setState(done);
        setPendingTransition(done.pending_transition ?? null);
        setAvatarEmotion(done.avatar_emotion);
        setAffect(done.affect);
        invalidateCareerEvidenceCaches();
        clearActiveStream('completed');
        setError(prev => (prev === TRANSIENT_PROCESSING_MESSAGE ? null : prev));
        break;
      }
      case 'error':
        pendingVisibleSimTurnRef.current = null;
        pendingGamePromptFrameRef.current = null;
        // Mid-stream failure frame: the backend generator died after the 200
        // headers, so it could not change the status. Show the same banner as a
        // transport error and drop stale affect; the terminal `done` frame that
        // immediately follows releases the streaming lock.
        setError('An unexpected connection error occurred.');
        setAvatarEmotion(undefined);
        setAffect(undefined);
        break;
      default:
        console.warn('Unknown event:', eventName);
    }
  }, [clearActiveStream]);

  const restoreTranscriptSnapshotOutcome = useCallback(async (
    expectedUserTurn?: ExpectedUserTurn,
    shouldApply?: () => boolean,
    requireDurableSettlement: boolean = false,
    requestDeadlineMs: number = Date.now() + TRANSCRIPT_REQUEST_TIMEOUT_MS
  ): Promise<TranscriptRestoreOutcome> => {
    let res: Response;
    let data: TranscriptResponse | null;
    try {
      ({ res, data } = await runBoundedTranscriptRequest(requestDeadlineMs, async (signal) => {
        const headers = await getAuthHeaders();
        throwIfAborted(signal);
        if (shouldApply && !shouldApply()) throw abortError();
        const response = await fetch(`/api/session/${sessionId}/transcript`, { headers, signal });
        throwIfAborted(signal);
        if (!response.ok) return { res: response, data: null };
        const transcript = (await response.json()) as TranscriptResponse;
        throwIfAborted(signal);
        return { res: response, data: transcript };
      }));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { foundExpectedTurn: false, completed: false, failed: false };
      }
      throw error;
    }
    if (shouldApply && !shouldApply()) {
      return { foundExpectedTurn: false, completed: false, failed: false };
    }
    if (res.status === 401 || res.status === 403) {
      lateRecoveryTokenRef.current = null;
      activeStreamTokenRef.current = null;
      streamInFlightRef.current = false;
      setIsRecoveringTurn(false);
      activeStreamSettleRef.current?.({ started: Boolean(expectedUserTurn), completed: false });
      clearActiveStream('error');
      setError('Your sign-in expired while this answer was processing. Sign in again, then reopen the session.');
      return { foundExpectedTurn: false, completed: false, failed: false, terminal: true };
    }
    if (res.status === 404 || res.status === 410) {
      lateRecoveryTokenRef.current = null;
      activeStreamTokenRef.current = null;
      streamInFlightRef.current = false;
      setIsRecoveringTurn(false);
      activeStreamSettleRef.current?.({ started: Boolean(expectedUserTurn), completed: false });
      clearActiveStream('error');
      setNotFound(true);
      setIsBootstrapping(false);
      return { foundExpectedTurn: false, completed: false, failed: false, terminal: true };
    }
    if (!res.ok) {
      throw new Error(`transcript_restore_failed:${res.status}`);
    }
    if (!data) {
      throw new Error('transcript_restore_failed:empty');
    }
    const pending = data.pending_transition ?? data.state?.pending_transition ?? null;
    const restoredGamePrompt = data.game_prompt ?? null;
    const restoredMessages = normalizeTranscriptMessages(data.messages, restoredGamePrompt);
    const currentUserTurnIndex = findCurrentUserTurnIndex(restoredMessages, expectedUserTurn);
    const durableExpectedTurnCompleted = Boolean(
      expectedUserTurn &&
      durableTurnCompleted(data.state?.last_turn, expectedUserTurn.clientTurnId)
    );
    const durableExpectedTurnFailed = Boolean(
      expectedUserTurn &&
      data.state?.last_turn?.client_turn_id === expectedUserTurn.clientTurnId &&
      data.state?.last_turn?.status === 'failed'
    );
    if (
      expectedUserTurn &&
      currentUserTurnIndex < 0 &&
      !durableExpectedTurnCompleted &&
      !durableExpectedTurnFailed
    ) {
      return { foundExpectedTurn: false, completed: false, failed: false };
    }
    if (
      requireDurableSettlement &&
      !durableExpectedTurnCompleted &&
      !durableExpectedTurnFailed
    ) {
      return { foundExpectedTurn: currentUserTurnIndex >= 0, completed: false, failed: false };
    }
    const completedTurnOutcome = durableExpectedTurnCompleted || hasCompletedTurnOutcomeAfterExpectedUser(
      data,
      restoredMessages,
      expectedUserTurn,
    );
    const completedOpeningOutcome = !expectedUserTurn && openingSnapshotComplete({
      openingStreamed: data.opening_streamed ?? data.state?.opening_streamed,
      hasOpeningMessage: hasOpeningTranscriptMessage(restoredMessages),
      hasGamePrompt: Boolean(restoredGamePrompt),
      terminalSession: Boolean(
        data.state?.session_over ||
        data.state?.status === 'ended' ||
        data.state?.simulation_report
      ),
    });
    const recoveredTurn = recoverTurnLockFromTranscript(data);
    if (shouldApply && !shouldApply()) {
      return { foundExpectedTurn: false, completed: false, failed: false };
    }
    const activeTurn = recoveredTurn.activeTurn;
    const recoveredCompletedOutcome = expectedUserTurn
      ? durableExpectedTurnCompleted || (
          completedTurnOutcome && recoveredTurn.blockReason !== 'turn_processing'
        )
      : completedOpeningOutcome && recoveredTurn.blockReason !== 'turn_processing';

    if (recoveredCompletedOutcome) {
      // A durable transcript now owns the visible reply. Stop the still-live SSE
      // reader before replacing messages so a late buffered token cannot append a
      // transient duplicate after the canonical snapshot is rendered.
      const activeClient = clientRef.current;
      clientRef.current = null;
      activeClient?.disconnect();
    }

    if (data.state) {
      setState({
        ...data.state,
        session_version: data.session_version ?? data.state.session_version,
        pending_transition: pending,
        active_turn: recoveredTurn.activeTurn,
        input_allowed: recoveredTurn.inputAllowed,
        block_reason: recoveredTurn.blockReason,
        opening_streamed: data.opening_streamed ?? data.state.opening_streamed,
      });
      if (data.state.simulation_round) {
        setSimTurn(data.state.simulation_round);
      }
      if (typeof data.state.simulation_tension === 'number') {
        setTension(Math.round(Math.max(0, Math.min(1, data.state.simulation_tension)) * 100));
      }
      if (data.state.session_over || data.state.status === 'ended') {
        setShouldClose(true);
      }
      if (data.state.simulation_report) {
        setReport(data.state.simulation_report);
        closingRef.current = true;
      }
    }
    setPendingTransition(pending);
    setSessionRecap(data.session_recap ?? null);
    setGamePrompt(restoredGamePrompt);
    if (restoredMessages.length > 0) {
      setMessages(restoredMessages);
    }
    if (pending) {
      setNodeAdvance({ from_node: pending.from_node, to_node: pending.to_node });
    }
    if (recoveredCompletedOutcome) {
      streamInFlightRef.current = false;
      setIsRecoveringTurn(false);
      clearActiveStream('completed');
    }
    if (durableExpectedTurnFailed) {
      lateRecoveryTokenRef.current = null;
      streamInFlightRef.current = false;
      setIsRecoveringTurn(false);
      clearActiveStream('error');
      setError('The tutor could not finish that answer. Please try again.');
      return { foundExpectedTurn: true, completed: false, failed: true };
    }
    if (expectedUserTurn && recoveredCompletedOutcome) {
      setError(activeTurn?.status === 'processing' ? TRANSIENT_PROCESSING_MESSAGE : null);
      return { foundExpectedTurn: true, completed: true, failed: false };
    }
    if (activeTurn?.status === 'processing') {
      setError(TRANSIENT_PROCESSING_MESSAGE);
      return { foundExpectedTurn: true, completed: false, failed: false };
    }
    if (expectedUserTurn) {
      setError(TRANSIENT_PROCESSING_MESSAGE);
      return { foundExpectedTurn: true, completed: false, failed: false };
    }
    if (!expectedUserTurn && !completedOpeningOutcome) {
      return { foundExpectedTurn: false, completed: false, failed: false };
    }
    setError(null);
    return { foundExpectedTurn: true, completed: true, failed: false };
  }, [clearActiveStream, runBoundedTranscriptRequest, sessionId]);

  const restoreTranscriptSnapshot = useCallback(async (
    expectedUserTurn?: ExpectedUserTurn,
    shouldApply?: () => boolean
  ): Promise<boolean> => {
    const outcome = await restoreTranscriptSnapshotOutcome(expectedUserTurn, shouldApply);
    return outcome.completed;
  }, [restoreTranscriptSnapshotOutcome]);

  const streamTurn = useCallback(async (
    userInput?: string,
    clientTurnId?: string,
    assessmentAction?: AssessmentClientAction
  ): Promise<StreamTurnResult> => {
    if (userInput && pendingTransition) {
      setError('Start the next skill before sending another answer.');
      return { started: false, completed: false };
    }
    if (userInput && (state?.input_allowed === false || Boolean(state?.block_reason))) {
      setError(
        state?.block_reason === 'awaiting_next_skill'
          ? 'This skill is complete. Start the next skill before answering.'
          : 'This session is not ready for another answer yet.'
      );
      return { started: false, completed: false };
    }
    if (streamInFlightRef.current) {
      return { started: false, completed: false };
    }
    streamInFlightRef.current = true;
    activeStreamTokenRef.current = null;
    if (clientRef.current) {
      clientRef.current.disconnect();
    }
    const streamToken = crypto.randomUUID();
    activeStreamTokenRef.current = streamToken;
    streamEventRevisionRef.current = 0;
    const isActiveStream = () => activeStreamTokenRef.current === streamToken;
    const activeClientTurnId = clientTurnId ?? crypto.randomUUID();
    const expectedUserTurn = userInput
      ? { clientTurnId: activeClientTurnId, userInput }
      : undefined;
    const nextStreamKind: Exclude<ActiveStreamKind, null> = expectedUserTurn
      ? 'learner_turn'
      : 'opening';

    let optimisticUserMessageId: string | null = null;
    let opened = false;
    let accepted = false;
    const streamStartedAt = Date.now();
    const previousGamePrompt = gamePrompt;
    try {
      startActiveStream(nextStreamKind);
      pendingVisibleSimTurnRef.current = null;
      pendingGamePromptFrameRef.current = null;
      gamePromptSeenThisStreamRef.current = false;
      setError(null);
      setGamePrompt(null);
      setNodeAdvance(null);
      setAdaptationCue(null);
      setAvatarEmotion(undefined);
      setAffect(undefined);
      // Close any bubble left open by the previous turn so this turn's first token
      // starts fresh, and reset the speaker so a new turn never inherits the prior
      // turn's persona name; only a 'speaker' frame on this turn may set it again.
      setMessages(prev => dedupeAdjacentDuplicateMessages(finalizeOpen(prev)));
      currentSpeakerRef.current = undefined;
      if (userInput) {
        const optimisticId = `user-${crypto.randomUUID()}`;
        optimisticUserMessageId = optimisticId;
        setMessages(prev => [
          ...prev,
          { id: optimisticId, role: 'user', content: userInput },
        ]);
      }

      let url = `/api/session/turn`;
      let method = 'POST';
      let body: Record<string, unknown> | undefined = {
        session_id: sessionId,
        user_input: userInput,
        client_turn_id: activeClientTurnId,
        expected_session_version: state?.session_version,
      };
      if (assessmentAction) {
        body.assessment_action = assessmentAction;
      }

      if (!userInput && isOpening) {
        url = `/api/session/${sessionId}/opening`;
        method = 'GET';
        body = undefined;
      }

      const headers = await getAuthHeaders();
      if (!isActiveStream() || activeSessionIdRef.current !== sessionId) {
        return { started: false, completed: false };
      }
      let settled = false;
      let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
      let maxDurationTimer: ReturnType<typeof setTimeout> | null = null;
      const completion = new Promise<StreamTurnResult>((resolve) => {
        const settle = (value: StreamTurnResult) => {
          if (settled) return;
          settled = true;
          if (activeStreamSettleRef.current === settle) {
            activeStreamSettleRef.current = null;
          }
          if (recoveryTimer) {
            clearTimeout(recoveryTimer);
            recoveryTimer = null;
          }
          if (maxDurationTimer) {
            clearTimeout(maxDurationTimer);
            maxDurationTimer = null;
          }
          resolve(value);
        };
        activeStreamSettleRef.current = settle;

        let recoveryPollCount = 0;
        let lateRecoveryStarted = false;
        const startLateRecovery = () => {
          if (
            lateRecoveryStarted ||
            settled ||
            !expectedUserTurn ||
            !isActiveStream() ||
            activeSessionIdRef.current !== sessionId ||
            !shouldStartLateTurnRecovery({
              accepted,
              hasLearnerTurn: Boolean(expectedUserTurn),
              elapsedMs: Date.now() - streamStartedAt,
              normalOwnershipMs: SESSION_STREAM_MAX_DURATION_MS,
            })
          ) {
            return false;
          }
          lateRecoveryStarted = true;
          const lateRecoveryToken = crypto.randomUUID();
          const lateRecoveryDeadline = Date.now() + SESSION_STREAM_LATE_RECOVERY_DURATION_MS;
          const ownsLateRecovery = () => (
            lateRecoveryTokenRef.current === lateRecoveryToken &&
            activeSessionIdRef.current === sessionId
          );

          lateRecoveryTokenRef.current = lateRecoveryToken;
          activeStreamTokenRef.current = null;
          const activeClient = clientRef.current;
          clientRef.current = null;
          activeClient?.disconnect();
          streamInFlightRef.current = true;
          setIsRecoveringTurn(true);
          pendingVisibleSimTurnRef.current = null;
          pendingGamePromptFrameRef.current = null;
          clearActiveStream('error');
          setMessages(prev => dedupeAdjacentDuplicateMessages(finalizeOpen(prev)));
          setError(LATE_RECOVERY_MESSAGE);
          settle({ started: opened, completed: false });

          void runLateTurnRecovery({
            expectedClientTurnId: expectedUserTurn.clientTurnId,
            deadlineMs: lateRecoveryDeadline,
            maxPolls: SESSION_STREAM_LATE_RECOVERY_MAX_POLLS,
            pollDelayMs: SESSION_STREAM_LATE_RECOVERY_POLL_DELAY_MS,
            isOwner: ownsLateRecovery,
            pollTranscript: (expectedClientTurnId: string, requestDeadlineMs: number) => (
              restoreTranscriptSnapshotOutcome(
                { clientTurnId: expectedClientTurnId, userInput: expectedUserTurn.userInput },
                ownsLateRecovery,
                true,
                requestDeadlineMs
              )
            ),
          }).then((outcome) => {
            if (!ownsLateRecovery() || outcome.status === 'cancelled') return;
            lateRecoveryTokenRef.current = null;
            streamInFlightRef.current = false;
            setIsRecoveringTurn(false);
            if (outcome.status === 'completed') {
              invalidateCareerEvidenceCaches();
              setError(null);
            } else if (outcome.status === 'failed') {
              setError('The tutor could not finish that answer. Please try again.');
            } else if (outcome.status === 'terminal') {
              // The transcript restore path already supplied the terminal message.
            } else if (outcome.status === 'exhausted') {
              setError(LATE_RECOVERY_EXHAUSTED_MESSAGE);
            }
          });
          return true;
        };
        const scheduleRecoveryPoll = (delayMs: number) => {
          if (recoveryTimer) {
            clearTimeout(recoveryTimer);
          }
          recoveryTimer = setTimeout(() => {
            if (settled) return;
            const recover = async () => {
              const recoveryRevision = streamEventRevisionRef.current;
              try {
                const recovered = await restoreTranscriptSnapshot(
                  expectedUserTurn,
                  () => isActiveStream() && streamEventRevisionRef.current === recoveryRevision
                );
                if (!isActiveStream() || streamEventRevisionRef.current !== recoveryRevision) return;
                if (recovered) {
                  if (!isActiveStream()) return;
                  clientRef.current?.disconnect();
                  activeStreamTokenRef.current = null;
                  streamInFlightRef.current = false;
                  pendingVisibleSimTurnRef.current = null;
                  pendingGamePromptFrameRef.current = null;
                  clearActiveStream('completed');
                  invalidateCareerEvidenceCaches();
                  settle({ started: true, completed: true });
                  return;
                }
              } catch {
                // Keep polling until the bounded recovery budget is exhausted.
              }
              recoveryPollCount += 1;
              if (recoveryPollCount >= SESSION_STREAM_RECOVERY_MAX_POLLS) {
                if (startLateRecovery()) return;
                if (accepted && expectedUserTurn) {
                  // The accepted turn still belongs to the backend. Stop the
                  // early polls and let the 150-second backstop transfer
                  // ownership to bounded late recovery.
                  return;
                }
                if (!isActiveStream()) return;
                clientRef.current?.disconnect();
                activeStreamTokenRef.current = null;
                streamInFlightRef.current = false;
                pendingVisibleSimTurnRef.current = null;
                pendingGamePromptFrameRef.current = null;
                clearActiveStream('error');
                setError('The tutor is still working. Reopen this session in a moment if the answer does not appear.');
                settle({ started: opened, completed: false });
                return;
              }
              scheduleRecoveryPoll(SESSION_STREAM_RECOVERY_POLL_DELAY_MS);
            };
            void recover();
          }, delayMs);
        };
        const scheduleMaxDurationBackstop = () => {
          maxDurationTimer = setTimeout(() => {
            if (settled || !isActiveStream()) return;
            const recoverOrRelease = async () => {
              let recovered = false;
              const recoveryRevision = streamEventRevisionRef.current;
              try {
                recovered = await restoreTranscriptSnapshot(
                  expectedUserTurn,
                  () => isActiveStream() && streamEventRevisionRef.current === recoveryRevision
                );
              } catch {
                recovered = false;
              }
              if (settled || !isActiveStream()) return;
              if (streamEventRevisionRef.current !== recoveryRevision) {
                scheduleMaxDurationBackstop();
                return;
              }
              if (startLateRecovery()) return;
              clientRef.current?.disconnect();
              activeStreamTokenRef.current = null;
              streamInFlightRef.current = false;
              pendingVisibleSimTurnRef.current = null;
              pendingGamePromptFrameRef.current = null;
              clearActiveStream(recovered ? 'completed' : 'error');
              if (recovered) {
                invalidateCareerEvidenceCaches();
                settle({ started: true, completed: true });
                return;
              }
              setError('The tutor is still working. Reopen this session in a moment if the answer does not appear.');
              settle({ started: opened, completed: false });
            };
            void recoverOrRelease();
          }, SESSION_STREAM_MAX_DURATION_MS);
        };

        scheduleRecoveryPoll(SESSION_STREAM_RECOVERY_FIRST_POLL_MS);
        scheduleMaxDurationBackstop();

        const client = new ZiddSSEClient(url, {
          method,
          body,
          headers,
          onOpen: () => {
            opened = true;
          },
          onEvent: (eventName, data) => {
            if (!isActiveStream()) return;
            if (eventName !== 'heartbeat') {
              streamEventRevisionRef.current += 1;
            }
            if (eventName !== 'accepted' && eventName !== 'heartbeat' && recoveryTimer) {
              clearTimeout(recoveryTimer);
              recoveryTimer = null;
            }
            if (eventName === 'accepted') {
              accepted = true;
            }
            handleEvent(eventName, data);
            if (eventName !== 'done' && eventName !== 'accepted' && eventName !== 'heartbeat') {
              recoveryPollCount = 0;
              scheduleRecoveryPoll(SESSION_STREAM_RECOVERY_POLL_DELAY_MS);
            }
            if (eventName === 'accepted') opened = true;
            if (eventName === 'done') settle({ started: true, completed: true });
          },
          onError: async (err) => {
            if (!isActiveStream()) return;
            if (
              err.code === 'session_expired' ||
              err.status === 401 ||
              err.status === 403 ||
              err.status === 410
            ) {
              lateRecoveryTokenRef.current = null;
              activeStreamTokenRef.current = null;
              streamInFlightRef.current = false;
              setIsRecoveringTurn(false);
              clearActiveStream('error');
              if (err.code === 'session_expired' || err.status === 410) {
                setNotFound(true);
                setError('This session has expired. Start a new session from your path.');
              } else {
                setError('Your sign-in expired while this answer was processing. Sign in again, then reopen the session.');
              }
              settle({ started: accepted, completed: false });
              return;
            }
            if (accepted && expectedUserTurn) {
              setAvatarEmotion(undefined);
              setAffect(undefined);
              setError(TRANSIENT_PROCESSING_MESSAGE);
              if (startLateRecovery()) return;
              // Post-accept transport failures do not release learner input.
              // onComplete or the 150-second backstop owns recovery.
              return;
            }
            streamInFlightRef.current = false;
            clearActiveStream('error');
            // Clear affect so the avatar doesn't keep showing the prior turn's mood
            // behind an error banner.
            setAvatarEmotion(undefined);
            setAffect(undefined);
            if (err.code === 'session_expired' || err.status === 410) {
              setNotFound(true);
              setError('This session has expired. Start a new session from your path.');
            } else if (err.message?.includes('SSE stream startup timeout')) {
              setError(opened ? 'The tutor is still working. Reopen this session in a moment if the answer does not appear.' : 'The tutor took too long to start. Please try again.');
            } else if (err.message?.includes('SSE stream idle timeout')) {
              setError('The tutor is still working. Reopen this session in a moment if the answer does not appear.');
            } else if (err.code === 'turn_version_consumed' || err.code === 'turn_in_progress') {
              if (expectedUserTurn) {
                const outcome = await restoreTranscriptSnapshotOutcome(
                  expectedUserTurn,
                  () => isActiveStream() && activeSessionIdRef.current === sessionId
                );
                if (!isActiveStream() || activeSessionIdRef.current !== sessionId) return;
                if (outcome.completed) {
                  if (!opened && optimisticUserMessageId) {
                    setMessages(prev => prev.filter(message => message.id !== optimisticUserMessageId));
                  }
                  activeStreamTokenRef.current = null;
                  invalidateCareerEvidenceCaches();
                  settle({ started: true, completed: true });
                  return;
                }
                if (outcome.foundExpectedTurn) {
                  if (!opened && optimisticUserMessageId) {
                    setMessages(prev => prev.filter(message => message.id !== optimisticUserMessageId));
                  }
                  opened = true;
                  streamInFlightRef.current = true;
                  startActiveStream('learner_turn');
                  setError(TRANSIENT_PROCESSING_MESSAGE);
                  scheduleRecoveryPoll(SESSION_STREAM_RECOVERY_POLL_DELAY_MS);
                  return;
                }
              }
              setError('That answer is already being handled. Wait for the latest response, then try again if needed.');
            } else if (err.code === 'session_version_conflict') {
              setError('This session changed in another tab. Reload the session before sending another answer.');
            } else if (err.code === 'awaiting_next_skill') {
              setError('This skill is complete. Start the next skill before answering.');
            } else if (err.code === 'opening_in_progress') {
              setError('The opening prompt is already loading. Waiting for it to appear here.');
            } else if (err.status === 409) {
              setError('This session is not ready for another answer yet.');
            } else if (err.status === 503 || err.message?.includes('503')) {
              setError('The AI service is currently unavailable. Please try again later.');
            } else if (err.status === 429 || err.message?.includes('429')) {
              setError('Rate limit exceeded. Please wait a moment.');
            } else {
              setError('An unexpected connection error occurred.');
            }
            if (!opened && optimisticUserMessageId) {
              setMessages(prev => prev.filter(message => message.id !== optimisticUserMessageId));
            }
            if (!opened && previousGamePrompt) {
              setGamePrompt(previousGamePrompt);
            }
            if (!opened) {
              activeStreamTokenRef.current = null;
              settle({ started: false, completed: false });
            }
          },
          // EOF backstop: clears the streaming lock on every clean stream close,
          // even one that ended without a `done` frame (backend generator died
          // mid-token). Idempotent with the `done` handler on the happy path.
          onComplete: ({ doneSeen }) => {
            if (!isActiveStream()) return;
            const finish = async () => {
              let recovered = false;
              if (!doneSeen) {
                if (opened) {
                  try {
                    recovered = await restoreTranscriptSnapshot(
                      expectedUserTurn,
                      () => isActiveStream() && activeSessionIdRef.current === sessionId
                    );
                  } catch {
                    recovered = false;
                  }
                }
              }
              if (!isActiveStream() || activeSessionIdRef.current !== sessionId) return;
              if (!doneSeen && opened && !recovered && startLateRecovery()) return;
              if (!doneSeen && accepted && expectedUserTurn && !recovered) {
                // The backend accepted this learner turn. Keep ownership until
                // the normal 150-second budget can hand it to late recovery.
                return;
              }
              if (!doneSeen) {
                pendingGamePromptFrameRef.current = null;
              }
              activeStreamTokenRef.current = null;
              streamInFlightRef.current = false;
              pendingVisibleSimTurnRef.current = null;
              clearActiveStream(doneSeen || recovered ? 'completed' : 'error');
              if (doneSeen || recovered) invalidateCareerEvidenceCaches();
              setMessages(prev => dedupeAdjacentDuplicateMessages(finalizeOpen(prev)));
              if (!opened && optimisticUserMessageId) {
                setMessages(prev => prev.filter(message => message.id !== optimisticUserMessageId));
              }
              if (!opened && previousGamePrompt) {
                setGamePrompt(previousGamePrompt);
              }
              settle({ started: opened || doneSeen || recovered, completed: doneSeen || recovered });
            };
            void finish();
          },
          idleTimeoutMs: SESSION_STREAM_IDLE_TIMEOUT_MS,
        });

        clientRef.current = client;
        client.connect();
      });

      return completion;
    } catch {
      if (!isActiveStream() || activeSessionIdRef.current !== sessionId) {
        return { started: false, completed: false };
      }
      activeStreamTokenRef.current = null;
      streamInFlightRef.current = false;
      clearActiveStream('error');
      if (!opened && optimisticUserMessageId) {
        setMessages(prev => prev.filter(message => message.id !== optimisticUserMessageId));
      }
      if (!opened && previousGamePrompt) {
        setGamePrompt(previousGamePrompt);
      }
      setError('An unexpected connection error occurred.');
      return { started: false, completed: false };
    }
  }, [
    sessionId,
    isOpening,
    handleEvent,
    state?.session_version,
    state?.input_allowed,
    state?.block_reason,
    pendingTransition,
    gamePrompt,
    clearActiveStream,
    restoreTranscriptSnapshot,
    restoreTranscriptSnapshotOutcome,
    startActiveStream,
  ]);

  // Mount entry point: rehydrate an existing transcript if the session already
  // has one (a reload), otherwise stream a fresh opening. A 404/410 means the
  // session id is unknown/expired -> surface notFound instead of a bogus opening stream.
  // Replaces the old unconditional streamTurn() on mount, which wiped the chat on
  // every reload because the hook always started from an empty message list.
  const bootstrap = useCallback(async () => {
    const bootstrapKey = `${sessionId}:${isOpening ? 'opening' : 'restore'}`;
    if (bootstrappedSessionRef.current === bootstrapKey) {
      setIsBootstrapping(false);
      return;
    }
    bootstrappedSessionRef.current = bootstrapKey;
    const bootstrapGeneration = ++bootstrapGenerationRef.current;
    const ownsBootstrap = () => (
      bootstrapGenerationRef.current === bootstrapGeneration &&
      activeSessionIdRef.current === sessionId &&
      bootstrappedSessionRef.current === bootstrapKey
    );
    const bootstrapDeadline = Date.now() + SESSION_STREAM_MAX_DURATION_MS;
    setIsBootstrapping(true);

    const applyTranscriptSnapshot = (data: TranscriptResponse) => {
      if (!ownsBootstrap()) return null;
      const pending = data.pending_transition ?? data.state?.pending_transition ?? null;
      const restoredGamePrompt = data.game_prompt ?? null;
      const restoredMessages = normalizeTranscriptMessages(data.messages, restoredGamePrompt);
      const activeTurn = data.active_turn ?? data.state?.active_turn ?? null;
      const blockReason = data.block_reason ?? data.state?.block_reason;
      const observedClientTurnId =
        activeTurn?.status === 'processing' &&
        blockReason === 'turn_processing' &&
        !durableTurnSettled(data.state?.last_turn, activeTurn.client_turn_id) &&
        activeTurn.client_turn_id
          ? activeTurn.client_turn_id
          : null;
      const observedTurnFailed = Boolean(
        activeTurn?.status === 'processing' &&
        blockReason === 'turn_processing' &&
        data.state?.last_turn?.client_turn_id === activeTurn.client_turn_id &&
        data.state?.last_turn?.status === 'failed'
      );
      const recoveredTurn = recoverTurnLockFromTranscript(data);
      const terminalSession = Boolean(
        data.state?.session_over ||
        data.state?.status === 'ended' ||
        data.state?.simulation_report
      );

      if (data.state) {
        setState({
          ...data.state,
          session_version: data.session_version ?? data.state.session_version,
          pending_transition: pending,
          active_turn: recoveredTurn.activeTurn,
          input_allowed: recoveredTurn.inputAllowed,
          block_reason: recoveredTurn.blockReason,
          opening_streamed: data.opening_streamed ?? data.state.opening_streamed,
        });
        const activeTurn = recoveredTurn.activeTurn;
        const visibleAssistantReply = restoredMessages.length > 0 && restoredMessages[restoredMessages.length - 1]?.role === 'assistant';
        if (observedTurnFailed) {
          setError('The tutor could not finish that answer. Please try again.');
        } else if (activeTurn?.status === 'processing' && !visibleAssistantReply) {
          setError(TRANSIENT_PROCESSING_MESSAGE);
        } else {
          setError(null);
        }
        if (data.state.simulation_round) {
          setSimTurn(data.state.simulation_round);
        }
        if (typeof data.state.simulation_tension === 'number') {
          setTension(Math.round(Math.max(0, Math.min(1, data.state.simulation_tension)) * 100));
        }
        if (data.state.session_over || data.state.status === 'ended') {
          setShouldClose(true);
        }
        if (data.state.simulation_report) {
          setReport(data.state.simulation_report);
          closingRef.current = true;
        }
      }
      setPendingTransition(pending);
      setSessionRecap(data.session_recap ?? null);
      setGamePrompt(restoredGamePrompt);
      if (restoredMessages.length > 0) {
        setMessages(restoredMessages);
      }
      if (pending) {
        setNodeAdvance({ from_node: pending.from_node, to_node: pending.to_node });
      }

      const openingAvailable = Boolean(
        restoredGamePrompt ||
        hasOpeningTranscriptMessage(restoredMessages) ||
        data.opening_streamed ||
        pending ||
        terminalSession
      );

      return {
        terminalSession,
        openingAvailable,
        shouldStreamOpening: isOpening && !openingAvailable,
        observedClientTurnId,
      };
    };

    const fetchTranscriptSnapshot = async (deadlineMs: number) => {
      if (!ownsBootstrap()) return null;
      const { res, data } = await runBoundedTranscriptRequest(deadlineMs, async (signal) => {
        const headers = await getAuthHeaders();
        throwIfAborted(signal);
        if (!ownsBootstrap()) throw abortError();
        const response = await fetch(`/api/session/${sessionId}/transcript`, { headers, signal });
        throwIfAborted(signal);
        if (!response.ok) return { res: response, data: null };
        const transcript = (await response.json()) as TranscriptResponse;
        throwIfAborted(signal);
        return { res: response, data: transcript };
      });
      if (!ownsBootstrap()) return null;
      if (res.status === 404 || res.status === 410) {
        setNotFound(true);
        setIsBootstrapping(false);
        return null;
      }
      if (!res.ok) {
        throw new Error(`transcript_restore_failed:${res.status}`);
      }
      if (!ownsBootstrap()) return null;
      if (!data) throw new Error('transcript_restore_failed:empty');
      return data;
    };

    const recoverOpeningFromTranscript = async (recoveryDeadline: number): Promise<boolean> => {
      for (
        let attempt = 0;
        attempt < OPENING_RECOVERY_POLL_ATTEMPTS && Date.now() < recoveryDeadline;
        attempt += 1
      ) {
        if (!ownsBootstrap()) return false;
        if (attempt > 0) {
          const remainingMs = recoveryDeadline - Date.now();
          if (remainingMs <= 0) return false;
          await delay(Math.min(OPENING_RECOVERY_POLL_DELAY_MS, remainingMs));
          if (!ownsBootstrap()) return false;
        }
        try {
          const data = await fetchTranscriptSnapshot(recoveryDeadline);
          if (!data) return true;
          const snapshot = applyTranscriptSnapshot(data);
          if (!snapshot) return false;
          if (snapshot.terminalSession || snapshot.openingAvailable) {
            setError(null);
            return true;
          }
        } catch {
          continue;
        }
      }
      return false;
    };

    const recoverRestoredProcessingTurn = async (
      observedClientTurnId: string
    ): Promise<void> => {
      const recoveryToken = crypto.randomUUID();
      const recoveryDeadline = Date.now() + SESSION_STREAM_LATE_RECOVERY_DURATION_MS;
      const ownsRestoredRecovery = () => (
        ownsBootstrap() && lateRecoveryTokenRef.current === recoveryToken
      );

      lateRecoveryTokenRef.current = recoveryToken;
      streamInFlightRef.current = true;
      setIsRecoveringTurn(true);
      setError(LATE_RECOVERY_MESSAGE);

      const outcome = await runLateTurnRecovery({
        expectedClientTurnId: observedClientTurnId,
        deadlineMs: recoveryDeadline,
        maxPolls: SESSION_STREAM_LATE_RECOVERY_MAX_POLLS,
        pollDelayMs: SESSION_STREAM_LATE_RECOVERY_POLL_DELAY_MS,
        isOwner: ownsRestoredRecovery,
        pollTranscript: (expectedClientTurnId: string, requestDeadlineMs: number) => (
          restoreTranscriptSnapshotOutcome(
            { clientTurnId: expectedClientTurnId, userInput: '' },
            ownsRestoredRecovery,
            true,
            requestDeadlineMs
          )
        ),
      });
      if (!ownsRestoredRecovery() || outcome.status === 'cancelled') return;

      lateRecoveryTokenRef.current = null;
      streamInFlightRef.current = false;
      setIsRecoveringTurn(false);
      if (outcome.status === 'completed') {
        invalidateCareerEvidenceCaches();
        setError(null);
      } else if (outcome.status === 'failed') {
        setError('The tutor could not finish that answer. Please try again.');
      } else if (outcome.status === 'exhausted') {
        setError(LATE_RECOVERY_EXHAUSTED_MESSAGE);
      }
    };

    try {
      let shouldStreamOpening = isOpening;
      const data = await fetchTranscriptSnapshot(bootstrapDeadline);
      if (!data) return;
      const snapshot = applyTranscriptSnapshot(data);
      if (!snapshot) return;
      shouldStreamOpening = snapshot.shouldStreamOpening;
      if (snapshot.terminalSession) {
        return;
      }
      if (snapshot.observedClientTurnId) {
        void recoverRestoredProcessingTurn(snapshot.observedClientTurnId);
        return;
      }
      if (shouldStreamOpening) {
        const result = await streamTurn();
        if (!ownsBootstrap()) return;
        if (!result.completed) {
          const recovered = await recoverOpeningFromTranscript(bootstrapDeadline);
          if (!recovered && ownsBootstrap()) {
            setError('The opening is still loading. Reload this session in a moment if it does not appear.');
          }
        }
      }
    } catch {
      if (ownsBootstrap()) {
        bootstrappedSessionRef.current = null;
        setError('Could not restore this session. Retry from the path or reload this page.');
      }
    } finally {
      if (ownsBootstrap()) {
        setIsBootstrapping(false);
      }
    }
  }, [isOpening, restoreTranscriptSnapshotOutcome, runBoundedTranscriptRequest, sessionId, streamTurn]);

  const disconnect = useCallback(() => {
    abortTranscriptRequests();
    bootstrapGenerationRef.current += 1;
    bootstrappedSessionRef.current = null;
    activeStreamSettleRef.current?.({ started: false, completed: false });
    activeStreamSettleRef.current = null;
    lateRecoveryTokenRef.current = null;
    setIsRecoveringTurn(false);
    activeStreamTokenRef.current = null;
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    clearActiveStream('disconnected');
    streamInFlightRef.current = false;
  }, [abortTranscriptRequests, clearActiveStream]);

  // Close the session server-side and pull the scored simulation report. Safe to
  // await from a render effect OR a manual "End & Score" click: the closingRef
  // latch makes it fire at most once, and any failure (network, or a session
  // already torn down) resolves to null so the caller can route the learner on
  // instead of dead-ending on a lock.
  const endSession = useCallback(async (): Promise<SimulationReport | null> => {
    if (closingRef.current) return report;
    closingRef.current = true;
    setIsClosing(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/session/${sessionId}/end`, { method: 'POST', headers });
      if (res.status === 410 || res.status === 404) {
        setNotFound(true);
        return null;
      }
      if (!res.ok) {
        closingRef.current = false;
        setError('Could not score this session. Please try again.');
        return null;
      }
      let data = (await res.json()) as EndSessionResponse;
      if (data.status === 'processing') {
        for (let attempt = 0; attempt < 180; attempt += 1) {
          await delay(2_000);
          const poll = await fetch(`/api/session/${sessionId}/report`, { headers });
          if (poll.status === 410 || poll.status === 404) {
            if (poll.status === 410) setNotFound(true);
            continue;
          }
          if (poll.status === 202) continue;
          if (!poll.ok) {
            closingRef.current = false;
            setError('Could not score this session. Please try again.');
            return null;
          }
          data = (await poll.json()) as EndSessionResponse;
          if (data.report) break;
        }
      }
      if (data.status === 'completed' && !data.report) {
        invalidateCareerEvidenceCaches();
        return null;
      }
      if (!data.report) {
        closingRef.current = false;
        setError('Scoring is still running. Try again in a moment.');
        return null;
      }
      setReport(data.report);
      invalidateCareerEvidenceCaches();
      return data.report;
    } catch {
      closingRef.current = false;
      setError('Could not score this session. Please check your connection and try again.');
      return null;
    } finally {
      setIsClosing(false);
    }
  }, [sessionId, report]);

  return {
    messages: sessionIdChanged ? [] : messages,
    state: sessionIdChanged ? null : state,
    progress: sessionIdChanged ? null : progress,
    gamePrompt: sessionIdChanged ? null : gamePrompt,
    sessionRecap: sessionIdChanged ? null : sessionRecap,
    nodeAdvance: sessionIdChanged ? null : nodeAdvance,
    pendingTransition: sessionIdChanged ? null : pendingTransition,
    adaptationCue: sessionIdChanged ? null : adaptationCue,
    tension: sessionIdChanged ? 0 : tension,
    simTurn: sessionIdChanged ? 0 : simTurn,
    shouldClose: sessionIdChanged ? false : shouldClose,
    report: sessionIdChanged ? null : report,
    isClosing: sessionIdChanged ? false : isClosing,
    avatarEmotion: sessionIdChanged ? undefined : avatarEmotion,
    affect: sessionIdChanged ? undefined : affect,
    error: sessionIdChanged ? null : error,
    notFound: sessionIdChanged ? false : notFound,
    isStreaming: sessionIdChanged ? false : isStreaming,
    isRecoveringTurn: sessionIdChanged ? false : isRecoveringTurn,
    activeStreamKind: sessionIdChanged ? null : activeStreamKind,
    isBootstrapping: sessionIdChanged || isBootstrapping,
    bootstrap,
    streamTurn,
    endSession,
    disconnect
  };
}
