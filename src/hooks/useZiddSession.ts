"use client";

import { useState, useCallback, useRef } from 'react';
import { ZiddSSEClient } from '../services/sseClient';
import {
  DoneFrame,
  ProgressUpdateFrame,
  GamePromptFrame,
  SessionRecapFrame,
  SimulationStateFrame,
  AdaptationCueFrame,
  SpeakerFrame,
  ChatMessage,
  TranscriptResponse,
  SimulationReport,
  EndSessionResponse
} from '../types';

// Hard round cap mirrored from the backend (simulation_service MAX_SIM_ROUNDS).
// Surfaced so the simulator can render a "Round N / MAX" indicator.
export const MAX_SIM_ROUNDS = 10;

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

export function useZiddSession(sessionId: string, isOpening: boolean = false) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<DoneFrame | null>(null);
  const [progress, setProgress] = useState<ProgressUpdateFrame | null>(null);
  const [gamePrompt, setGamePrompt] = useState<GamePromptFrame | null>(null);
  const [sessionRecap, setSessionRecap] = useState<SessionRecapFrame | null>(null);
  const [nodeAdvance, setNodeAdvance] = useState<{ from_node: string, to_node: string } | null>(null);
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

  const handleEvent = useCallback((eventName: string, data: any) => {
    switch (eventName) {
      case 'message':
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
            return [...prev.slice(0, -1), { ...last, content: last.content + data }];
          }
          return [
            ...prev,
            {
              // `live-` prefix never collides with rehydrated `${sid}-${i}` ids;
              // prev.length is monotonic (we only append) so it's unique + stable.
              id: `live-${prev.length}`,
              role: 'assistant',
              content: data,
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
        setNodeAdvance(data);
        // New node: drop the prior node's affect until a fresh done frame lands.
        setAvatarEmotion(undefined);
        setAffect(undefined);
        break;
      case 'session_recap':
        setSessionRecap(data as SessionRecapFrame);
        break;
      case 'game_prompt':
        setGamePrompt(data as GamePromptFrame);
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
        if (sim.turn) setSimTurn(sim.turn);
        // Terminal and sticky: once the Director signals close, never un-set it
        // (a later round's frame can't reopen a closing panel).
        if (sim.should_close) setShouldClose(true);
        break;
      }
      case 'adaptation_cue':
        setAdaptationCue(data as AdaptationCueFrame);
        break;
      case 'done': {
        const done = data as DoneFrame;
        // The stream ended cleanly: finalise the open bubble so a later turn's
        // first token can't append to it.
        setMessages(finalizeOpen);
        setState(done);
        setAvatarEmotion(done.avatar_emotion);
        setAffect(done.affect);
        setIsStreaming(false);
        break;
      }
      case 'error':
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

  const streamTurn = useCallback(async (userInput?: string) => {
    if (clientRef.current) {
      clientRef.current.disconnect();
    }

    setIsStreaming(true);
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

    let url = `/api/session/turn`;
    let method = 'POST';
    let body: any = { session_id: sessionId, user_input: userInput };

    if (!userInput && isOpening) {
      url = `/api/session/${sessionId}/opening`;
      method = 'GET';
      body = undefined;
    }

    if (userInput) {
       setMessages(prev => [...prev, { id: `user-${prev.length}`, role: 'user', content: userInput }]);
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('zidd_token') : null;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    const client = new ZiddSSEClient(url, {
      method,
      body,
      headers,
      onEvent: handleEvent,
      onError: (err) => {
        setIsStreaming(false);
        // Clear affect so the avatar doesn't keep showing the prior turn's mood
        // behind an error banner.
        setAvatarEmotion(undefined);
        setAffect(undefined);
        if (err.message?.includes('503')) {
          setError('The AI service is currently unavailable. Please try again later.');
        } else if (err.message?.includes('429')) {
          setError('Rate limit exceeded. Please wait a moment.');
        } else {
          setError('An unexpected connection error occurred.');
        }
      },
      // EOF backstop: clears the streaming lock on every clean stream close,
      // even one that ended without a `done` frame (backend generator died
      // mid-token). Idempotent with the `done` handler on the happy path.
      onComplete: () => {
        setIsStreaming(false);
        setMessages(finalizeOpen);
      },
    });

    clientRef.current = client;
    client.connect();
  }, [sessionId, isOpening, handleEvent]);

  // Mount entry point: rehydrate an existing transcript if the session already
  // has one (a reload), otherwise stream a fresh opening. A 404 means the session
  // id is unknown/expired -> surface notFound instead of a bogus opening stream.
  // Replaces the old unconditional streamTurn() on mount, which wiped the chat on
  // every reload because the hook always started from an empty message list.
  const bootstrap = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('zidd_token') : null;
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/session/${sessionId}/transcript`, { headers });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as TranscriptResponse;
        if (data.opening_streamed && Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(
            data.messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              speaker_name: m.speaker_name ?? undefined,
            }))
          );
          if (data.state) setState(data.state);
          return;
        }
      }
    } catch {
      // Transient transcript-fetch failure: fall through to the opening so a
      // fresh session still starts rather than dead-ending on a network blip.
    }
    if (isOpening) await streamTurn();
  }, [sessionId, isOpening, streamTurn]);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      setIsStreaming(false);
    }
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
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('zidd_token') : null;
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/session/${sessionId}/end`, { method: 'POST', headers });
      if (!res.ok) return null;
      const data = (await res.json()) as EndSessionResponse;
      setReport(data.report);
      return data.report;
    } catch {
      return null;
    } finally {
      setIsClosing(false);
    }
  }, [sessionId, report]);

  return {
    messages,
    state,
    progress,
    gamePrompt,
    sessionRecap,
    nodeAdvance,
    adaptationCue,
    tension,
    simTurn,
    shouldClose,
    report,
    isClosing,
    avatarEmotion,
    affect,
    error,
    notFound,
    isStreaming,
    bootstrap,
    streamTurn,
    endSession,
    disconnect
  };
}
