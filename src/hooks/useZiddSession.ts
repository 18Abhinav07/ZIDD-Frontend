"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { getAuthHeaders } from '../services/api';
import { invalidateMeActivityCache } from '../services/me';
import { ZiddSSEClient } from '../services/sseClient';
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
  PendingNodeTransition
} from '../types';

// Hard round cap mirrored from the backend (simulation_service MAX_SIM_ROUNDS).
// Surfaced so the simulator can render a "Round N / MAX" indicator.
export const MAX_SIM_ROUNDS = 10;

type StreamTurnResult = {
  started: boolean;
  completed: boolean;
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

function cleanRestoredTranscriptContent(content: string): string {
  return content.replace(/^\[(?:Fill in the blank|Bridge exercise|Multiple choice|Spoken answer)\]\s*/i, 'Bridge exercise: ');
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const OPENING_RECOVERY_POLL_ATTEMPTS = 90;
const OPENING_RECOVERY_POLL_DELAY_MS = 2_000;

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
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  // Distinct from a transport error: the session id is unknown/expired (the
  // transcript fetch 404'd). The page shows a "session not found" screen with a
  // way back to the map instead of a misleading "connection error" banner.
  const [notFound, setNotFound] = useState(false);

  const clientRef = useRef<ZiddSSEClient | null>(null);
  const currentSpeakerRef = useRef<string | undefined>(undefined);
  // Synchronous latch: state-based isClosing has a re-render race, so two effect
  // runs could both fire POST /end. The second call hits an already-popped
  // session (404/empty) and would clobber `report` back to null. This ref blocks
  // re-entry before any render commits.
  const closingRef = useRef(false);
  const streamInFlightRef = useRef(false);
  const gamePromptSeenThisStreamRef = useRef(false);
  const pendingGamePromptFrameRef = useRef<GamePromptFrame | null>(null);
  const pendingVisibleSimTurnRef = useRef<number | null>(null);
  // React dev/StrictMode can run mount effects twice. Bootstrap is allowed once
  // per session id; otherwise two transcript checks can both stream an opening.
  const bootstrappedSessionRef = useRef<string | null>(null);
  const activeSessionIdRef = useRef(sessionId);
  const sessionIdChanged = activeSessionIdRef.current !== sessionId;

  useEffect(() => {
    activeSessionIdRef.current = sessionId;
    clientRef.current?.disconnect();
    clientRef.current = null;
    currentSpeakerRef.current = undefined;
    closingRef.current = false;
    streamInFlightRef.current = false;
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
    setIsStreaming(false);
    setIsBootstrapping(true);
    setNotFound(false);
  }, [sessionId]);

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
        setMessages(finalizeOpen);
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
        setMessages(finalizeOpen);
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
        setMessages(finalizeOpen);
        if (gamePromptSeenThisStreamRef.current && pendingGamePromptFrameRef.current) {
          setGamePrompt(pendingGamePromptFrameRef.current);
        } else {
          setGamePrompt(null);
        }
        pendingGamePromptFrameRef.current = null;
        setState(done);
        setPendingTransition(done.pending_transition ?? null);
        setAvatarEmotion(done.avatar_emotion);
        setAffect(done.affect);
        setIsStreaming(false);
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
  }, []);

  const streamTurn = useCallback(async (userInput?: string, clientTurnId?: string): Promise<StreamTurnResult> => {
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
    if (clientRef.current) {
      clientRef.current.disconnect();
    }

    let optimisticUserMessageId: string | null = null;
    let opened = false;
    const previousGamePrompt = gamePrompt;
    try {
      setIsStreaming(true);
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
      setMessages(finalizeOpen);
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
        client_turn_id: clientTurnId ?? crypto.randomUUID(),
        expected_session_version: state?.session_version,
      };

      if (!userInput && isOpening) {
        url = `/api/session/${sessionId}/opening`;
        method = 'GET';
        body = undefined;
      }

      const headers = await getAuthHeaders();
      let settled = false;
      const completion = new Promise<StreamTurnResult>((resolve) => {
        const settle = (value: StreamTurnResult) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };

        const client = new ZiddSSEClient(url, {
          method,
          body,
          headers,
          onOpen: () => {
            opened = true;
          },
          onEvent: (eventName, data) => {
            handleEvent(eventName, data);
            if (eventName === 'accepted') opened = true;
            if (eventName === 'done') settle({ started: true, completed: true });
          },
          onError: (err) => {
            streamInFlightRef.current = false;
            setIsStreaming(false);
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
            } else if (err.code === 'turn_version_consumed') {
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
            if (!opened) settle({ started: false, completed: false });
          },
          // EOF backstop: clears the streaming lock on every clean stream close,
          // even one that ended without a `done` frame (backend generator died
          // mid-token). Idempotent with the `done` handler on the happy path.
          onComplete: ({ doneSeen }) => {
            streamInFlightRef.current = false;
            pendingVisibleSimTurnRef.current = null;
            if (!doneSeen) {
              pendingGamePromptFrameRef.current = null;
            }
            setIsStreaming(false);
            setMessages(finalizeOpen);
            if (!opened && optimisticUserMessageId) {
              setMessages(prev => prev.filter(message => message.id !== optimisticUserMessageId));
            }
            if (!opened && previousGamePrompt) {
              setGamePrompt(previousGamePrompt);
            }
            settle({ started: opened || doneSeen, completed: doneSeen });
          },
        });

        clientRef.current = client;
        client.connect();
      });

      return completion;
    } catch {
      streamInFlightRef.current = false;
      setIsStreaming(false);
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
    setIsBootstrapping(true);

    const applyTranscriptSnapshot = (data: TranscriptResponse) => {
      const pending = data.pending_transition ?? data.state?.pending_transition ?? null;
      const restoredGamePrompt = data.game_prompt ?? null;
      const restoredMessages = Array.isArray(data.messages)
        ? data.messages
            .filter((m) => {
              if (!restoredGamePrompt || m.role !== 'assistant') return true;
              return !String(m.content).includes(restoredGamePrompt.sentence);
            })
            .map((m) => ({
              id: m.id,
              role: m.role,
              content: cleanRestoredTranscriptContent(m.content),
              speaker_name: m.speaker_name ?? undefined,
              speaker_id: m.speaker_id ?? undefined,
              node_id: m.node_id ?? undefined,
              transition_id: m.transition_id ?? undefined,
              message_kind: m.message_kind ?? undefined,
              status: m.status ?? undefined,
            }))
        : [];
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
          active_turn: data.active_turn ?? data.state.active_turn ?? null,
          input_allowed: data.input_allowed ?? data.state.input_allowed,
          block_reason: data.block_reason ?? data.state.block_reason,
          opening_streamed: data.opening_streamed ?? data.state.opening_streamed,
        });
        if (data.active_turn?.status === 'processing' || data.state.active_turn?.status === 'processing') {
          setError('Your last answer is still being processed. Wait here or reload in a moment.');
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
      setGamePrompt(restoredGamePrompt);
      if (restoredMessages.length > 0) {
        setMessages(restoredMessages);
      }
      if (pending) {
        setNodeAdvance({ from_node: pending.from_node, to_node: pending.to_node });
      }

      const openingAvailable = Boolean(
        restoredGamePrompt ||
        data.opening_streamed ||
        pending ||
        terminalSession
      );

      return {
        terminalSession,
        openingAvailable,
        shouldStreamOpening: isOpening && !openingAvailable,
      };
    };

    const fetchTranscriptSnapshot = async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/session/${sessionId}/transcript`, { headers });
      if (res.status === 404 || res.status === 410) {
        setNotFound(true);
        setIsBootstrapping(false);
        return null;
      }
      if (!res.ok) {
        throw new Error(`transcript_restore_failed:${res.status}`);
      }
      return (await res.json()) as TranscriptResponse;
    };

    const recoverOpeningFromTranscript = async (): Promise<boolean> => {
      for (let attempt = 0; attempt < OPENING_RECOVERY_POLL_ATTEMPTS; attempt += 1) {
        if (attempt > 0) {
          await delay(OPENING_RECOVERY_POLL_DELAY_MS);
        }
        const data = await fetchTranscriptSnapshot();
        if (!data) return true;
        const snapshot = applyTranscriptSnapshot(data);
        if (snapshot.terminalSession || snapshot.openingAvailable) {
          setError(null);
          return true;
        }
      }
      return false;
    };

    let shouldStreamOpening = isOpening;
    try {
      const data = await fetchTranscriptSnapshot();
      if (!data) return;
      const snapshot = applyTranscriptSnapshot(data);
      shouldStreamOpening = snapshot.shouldStreamOpening;
      if (snapshot.terminalSession) {
        setIsBootstrapping(false);
        return;
      }
    } catch {
      shouldStreamOpening = false;
      bootstrappedSessionRef.current = null;
      setError('Could not restore this session. Retry from the path or reload this page.');
    }
    if (shouldStreamOpening) {
      const result = await streamTurn();
      if (!result.completed) {
        const recovered = await recoverOpeningFromTranscript();
        if (!recovered) {
          setError('The opening is still loading. Reload this session in a moment if it does not appear.');
        }
      }
    }
    setIsBootstrapping(false);
  }, [sessionId, isOpening, streamTurn]);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      setIsStreaming(false);
    }
    streamInFlightRef.current = false;
  }, []);

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
      if (data.status === 'processing' || !data.report) {
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
      if (!data.report) {
        closingRef.current = false;
        setError('Scoring is still running. Try again in a moment.');
        return null;
      }
      setReport(data.report);
      invalidateMeActivityCache();
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
    isBootstrapping: sessionIdChanged || isBootstrapping,
    bootstrap,
    streamTurn,
    endSession,
    disconnect
  };
}
