"use client";

import React, { useState, useEffect, memo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PaperPlaneIcon,
  ExclamationTriangleIcon,
  ExitIcon
} from '@radix-ui/react-icons';
import Image from 'next/image';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getAvatarForCharacter, getBgColorForAvatar, getAvatarScaleClass } from '@/lib/avatarRegistry';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Participant {
  id: string;
  name: string;
  role?: string;
  stance?: string;
  isActive?: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  speaker_name?: string;
}

interface SimulatorShellProps {
  type: 'interview' | 'gd';
  title: string;
  participants: Participant[];
  messages: Message[];
  inputValue: string;
  setInputValue: (val: string) => void;
  onSend: () => void;
  isStreaming: boolean;
  tension?: number;
  phase?: string;
  error?: string | null;
  // Optional slot rendered in the header, left of the Live/Ready pill
  // (e.g. the credits badge). Additive — existing callers are unaffected.
  headerExtra?: React.ReactNode;
  // Manual "End & Score" control + round indicator. The sim otherwise only
  // scores on the Director's auto-close, which can strand a learner who wants to
  // stop early (or if a close signal is missed). onEnd closes + scores now.
  onEnd?: () => void;
  round?: number;
  maxRounds?: number;
  isClosing?: boolean;
}

const getAvatarConfig = (name: string) => {
  const src = getAvatarForCharacter(name);
  const bg = getBgColorForAvatar(src);
  return { src, bg };
};

// ─────────────────────────────────────────────────────────────────────────────
// GD Avatar Card
// ─────────────────────────────────────────────────────────────────────────────
const GDAvatarCard = memo(function GDAvatarCard({ participant }: { participant: Participant }) {
  const config = getAvatarConfig(participant.name);
  const isActive = participant.isActive;

  return (
    <div
      className={cn(
        "relative flex-1 flex flex-col overflow-hidden rounded-[1.5rem] transition-all duration-500 min-w-0",
        isActive
          ? "shadow-[0_12px_40px_rgba(0,0,0,0.2)] scale-[1.03] z-20"
          : "shadow-[0_2px_12px_rgba(0,0,0,0.07)] scale-[0.97] opacity-60 saturate-50 z-10"
      )}
      style={{ backgroundColor: config.bg }}
    >
      {/* Avatar fills card */}
      <div className="relative flex-1">
        <Image
          src={config.src}
          alt={participant.name}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className={cn("object-contain object-bottom", getAvatarScaleClass(config.src))}
          unoptimized
          priority
        />
      </div>

      {/* Compact label pinned to bottom */}
      <div className="bg-white/95 backdrop-blur-sm mx-2.5 mb-2.5 rounded-xl px-3 py-2.5 border border-white/50 shadow-sm shrink-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            isActive ? "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.6)] animate-pulse" : "bg-slate-300"
          )} />
          <span className="text-[12px] font-bold text-slate-900 tracking-tight truncate">{participant.name}</span>
          {isActive && (
            <div className="flex gap-[2px] h-2.5 items-end ml-auto shrink-0">
              <motion.div animate={{ height: ['40%', '100%', '40%'] }} transition={{ duration: 0.7, repeat: Infinity }} className="w-[2px] bg-indigo-500 rounded-t-full" />
              <motion.div animate={{ height: ['60%', '100%', '60%'] }} transition={{ duration: 0.7, repeat: Infinity, delay: 0.15 }} className="w-[2px] bg-indigo-500 rounded-t-full" />
              <motion.div animate={{ height: ['30%', '80%', '30%'] }} transition={{ duration: 0.7, repeat: Infinity, delay: 0.3 }} className="w-[2px] bg-indigo-500 rounded-t-full" />
            </div>
          )}
        </div>
        <span className="text-[8px] text-slate-500 uppercase tracking-[0.15em] font-black pl-3 truncate block">
          {participant.role || participant.stance || 'Participant'}
        </span>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Interview Avatar — full-stage, cinematic presence
// ─────────────────────────────────────────────────────────────────────────────
const InterviewAvatar = memo(function InterviewAvatar({
  participant,
  latestMessage,
  isStreaming,
}: {
  participant: Participant;
  latestMessage?: Message;
  isStreaming: boolean;
}) {
  const config = getAvatarConfig(participant.name);
  const latestAIMessage = latestMessage?.role === 'assistant' ? latestMessage : undefined;

  return (
    // Stage: fills the entire left content area
    <div className="relative flex flex-col h-full w-full overflow-hidden select-none">

      {/* Tinted floor that bleeds from the avatar colour — gives depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 70% 55% at 50% 100%, ${config.bg}22 0%, transparent 70%)`,
        }}
      />

      {/* Avatar — fills the stage, pinned to the bottom edge */}
      <div className="relative flex-1">
        <motion.div
          animate={{ y: isStreaming ? [0, -8, 0] : 0 }}
          transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity }}
          className="absolute inset-0"
        >
          <Image
            src={config.src}
            alt={participant.name}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className={cn('object-contain object-bottom drop-shadow-2xl', getAvatarScaleClass(config.src))}
            unoptimized
            priority
          />
        </motion.div>
      </div>

      {/* Bottom bar: name + status + latest message snippet */}
      <div className="relative shrink-0 px-6 pb-6 pt-2">
        {/* Latest AI message — shown just above the name plate */}
        <AnimatePresence mode="wait">
          {(latestAIMessage || isStreaming) && (
            <motion.div
              key={latestAIMessage?.id || 'typing'}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="mb-3"
            >
              <div className="bg-white rounded-[1.25rem] shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-slate-100 px-5 py-4">
                {latestAIMessage?.content ? (
                  <p className="text-[13px] leading-[1.7] text-slate-800 font-medium line-clamp-4">
                    {latestAIMessage.content}
                  </p>
                ) : (
                  <div className="flex gap-1.5 h-4 items-center">
                    <motion.div animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.8, repeat: Infinity, delay: 0 }} className="w-2 h-2 rounded-full bg-slate-300" />
                    <motion.div animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.8, repeat: Infinity, delay: 0.15 }} className="w-2 h-2 rounded-full bg-slate-300" />
                    <motion.div animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.8, repeat: Infinity, delay: 0.3 }} className="w-2 h-2 rounded-full bg-slate-300" />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Name plate */}
        <div className="flex items-center gap-3 bg-white/90 backdrop-blur-sm rounded-2xl px-5 py-3.5 shadow-md border border-slate-100">
          <div
            className="w-10 h-10 rounded-xl shrink-0 overflow-hidden relative shadow-inner"
            style={{ backgroundColor: config.bg }}
          >
            <Image src={config.src} alt={participant.name} fill sizes="40px" className="object-cover object-top" unoptimized />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-slate-900 tracking-tight">{participant.name}</p>
            <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-black">{participant.role || 'Interviewer'}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn(
              'w-2 h-2 rounded-full',
              isStreaming ? 'bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-slate-300'
            )} />
            {isStreaming && (
              <div className="flex gap-[3px] h-3.5 items-end">
                <motion.div animate={{ height: ['40%', '100%', '40%'] }} transition={{ duration: 0.7, repeat: Infinity }} className="w-1 bg-slate-400 rounded-t-full" />
                <motion.div animate={{ height: ['60%', '100%', '60%'] }} transition={{ duration: 0.7, repeat: Infinity, delay: 0.15 }} className="w-1 bg-slate-400 rounded-t-full" />
                <motion.div animate={{ height: ['30%', '80%', '30%'] }} transition={{ duration: 0.7, repeat: Infinity, delay: 0.3 }} className="w-1 bg-slate-400 rounded-t-full" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});


// ─────────────────────────────────────────────────────────────────────────────
// Skeleton loader
// ─────────────────────────────────────────────────────────────────────────────
const MessageSkeleton = memo(function MessageSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="flex flex-col gap-3 p-5 bg-slate-50 rounded-[1.5rem] border border-slate-100 opacity-60">
      <motion.div animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 2, repeat: Infinity, delay }} className="h-3 w-20 bg-slate-200 rounded-full" />
      <div className="space-y-2 w-full">
        <motion.div animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 2, repeat: Infinity, delay: delay + 0.1 }} className="h-2.5 bg-slate-200 rounded-full w-full" />
        <motion.div animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 2, repeat: Infinity, delay: delay + 0.2 }} className="h-2.5 bg-slate-200 rounded-full w-5/6" />
        <motion.div animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 2, repeat: Infinity, delay: delay + 0.3 }} className="h-2.5 bg-slate-200 rounded-full w-4/6" />
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Transcript feed — shared by both layouts
// ─────────────────────────────────────────────────────────────────────────────
const TranscriptFeed = memo(function TranscriptFeed({
  messages,
  isStreaming,
  phase,
  scrollRef,
  type,
}: {
  messages: Message[];
  isStreaming: boolean;
  phase?: string;
  scrollRef: React.RefObject<HTMLDivElement>;
  type: 'interview' | 'gd';
}) {
  return (
    <aside className={cn(
      "flex flex-col h-full overflow-hidden border-l border-slate-200",
      type === 'interview' ? "w-full lg:w-[380px] xl:w-[440px] bg-white" : "w-full lg:w-[400px] xl:w-[460px] bg-slate-50/60"
    )}>
      <div className="px-7 py-5 border-b border-slate-200 flex items-center justify-between shrink-0">
        <span className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">
          Transcript Feed
        </span>
        {phase && (
          <span className="text-[9px] px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full font-black uppercase tracking-[0.18em] border border-indigo-100">
            {phase}
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Conversation transcript"
        className="flex-1 overflow-y-auto scrollbar-hide p-5 space-y-4"
      >
        <AnimatePresence>
          {messages.length === 0 && isStreaming && (
            <motion.div key="awaiting" exit={{ opacity: 0 }} className="flex flex-col gap-4">
              <MessageSkeleton delay={0} />
              <div className="opacity-50"><MessageSkeleton delay={0.4} /></div>
            </motion.div>
          )}

          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const speakerLabel = msg.speaker_name || (isUser ? 'YOU' : 'SYSTEM');
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={cn(
                  "rounded-[1.25rem] px-5 py-4",
                  isUser
                    ? "bg-slate-900 text-white ml-6"
                    : type === 'interview'
                      ? "bg-slate-50 text-slate-800 border border-slate-100 mr-6"
                      : "bg-white text-slate-800 border border-slate-100 shadow-sm mr-6"
                )}
              >
                <p className={cn("text-[9px] uppercase tracking-[0.2em] font-black mb-2", isUser ? "text-white/50" : "text-indigo-600")}>
                  {speakerLabel}
                </p>
                <p className="text-[13px] leading-[1.7]">{msg.content}</p>
              </motion.div>
            );
          })}

          {isStreaming && messages.length > 0 && (
            <motion.div key="rx" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <MessageSkeleton />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Input bar — shared
// ─────────────────────────────────────────────────────────────────────────────
const InputBar = memo(function InputBar({
  inputValue,
  setInputValue,
  onSend,
  isStreaming,
  placeholder,
  type,
}: {
  inputValue: string;
  setInputValue: (v: string) => void;
  onSend: () => void;
  isStreaming: boolean;
  placeholder: string;
  type: 'interview' | 'gd';
}) {
  return (
    <div className={cn(
      "relative shrink-0 z-30",
      type === 'interview'
        ? "px-6 py-5 bg-white border-t border-slate-100"
        : "px-5 py-4 bg-white/80 backdrop-blur-xl border-t border-slate-200"
    )}>
      <div className="flex items-end gap-3 max-w-2xl mx-auto">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          rows={2}
          className={cn(
            "flex-1 resize-none text-[14px] font-medium rounded-[1.25rem] border outline-none transition-all",
            "px-5 py-4 text-slate-900 placeholder:text-slate-400 leading-relaxed",
            type === 'interview'
              ? "bg-slate-50 border-slate-200 focus:bg-white focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              : "bg-slate-50 border-slate-100 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
          )}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <motion.button
          type="button"
          aria-label="Send response"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.93 }}
          onClick={onSend}
          disabled={isStreaming || !inputValue.trim()}
          className={cn(
            "w-14 h-14 shrink-0 flex items-center justify-center rounded-[1.25rem] transition-all",
            "disabled:opacity-40 disabled:cursor-not-allowed shadow-md",
            type === 'interview'
              ? "bg-slate-900 text-white disabled:bg-slate-300"
              : "bg-indigo-600 text-white disabled:bg-slate-300"
          )}
        >
          <PaperPlaneIcon className="w-5 h-5" />
        </motion.button>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main SimulatorShell
// ─────────────────────────────────────────────────────────────────────────────
export const SimulatorShell: React.FC<SimulatorShellProps> = ({
  type,
  title,
  participants,
  messages,
  inputValue,
  setInputValue,
  onSend,
  isStreaming,
  tension = 0,
  phase,
  error,
  headerExtra,
  onEnd,
  round = 0,
  maxRounds = 10,
  isClosing = false
}) => {
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  if (!mounted) return null;

  // Last assistant message for interview speech bubble
  const latestMsg = messages[messages.length - 1];

  return (
    <div className="relative h-[100dvh] overflow-hidden flex flex-col font-body text-slate-900 selection:bg-indigo-100">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className={cn(
        "relative z-20 px-8 py-4 border-b flex justify-between items-center shrink-0",
        type === 'interview'
          ? "bg-white border-slate-100 shadow-[0_1px_0_rgba(0,0,0,0.04)]"
          : "bg-white/80 backdrop-blur-xl border-slate-200 shadow-sm"
      )}>
        <div className="flex items-baseline gap-1">
          <span className="font-sans font-black text-xl tracking-tighter text-slate-900">
            ZIDD<span className={type === 'interview' ? "text-slate-900" : "text-indigo-600"}>.</span>
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 ml-4 hidden sm:inline-block">
            Studio / {title}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {type === 'gd' && (
            <div className="hidden sm:flex items-center gap-3 pr-4 border-r border-slate-200">
              <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-black">Tension</span>
              <div className="w-28 h-1 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className={cn("h-full rounded-full", tension > 70 ? "bg-red-500" : tension > 40 ? "bg-orange-400" : "bg-indigo-400")}
                  initial={{ width: 0 }}
                  animate={{ width: `${tension}%` }}
                  transition={{ duration: 1 }}
                />
              </div>
            </div>
          )}

          {onEnd && (
            <div className="flex items-center gap-2.5 pr-3 sm:pr-4 sm:border-r sm:border-slate-200">
              <span className="hidden sm:inline text-[9px] uppercase tracking-[0.2em] text-slate-500 font-black tabular-nums">
                Round {Math.min(Math.max(round, 1), maxRounds)}/{maxRounds}
              </span>
              <button
                type="button"
                onClick={onEnd}
                disabled={isClosing}
                aria-label="End the session and get my score"
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900 text-white text-[9px] font-black uppercase tracking-[0.18em] hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                {isClosing ? 'Scoring…' : 'End & Score'}
                <ExitIcon className="w-3 h-3" />
              </button>
            </div>
          )}

          {headerExtra}

          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-50 rounded-full border border-slate-200">
            <span className={cn("w-1.5 h-1.5 rounded-full", isStreaming ? "bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.5)]" : "bg-slate-300")} />
            <span className="text-[9px] uppercase tracking-[0.2em] font-black text-slate-600">
              {isStreaming ? 'Live' : 'Ready'}
            </span>
          </div>
        </div>
      </header>

      {/* ── GD Layout ── */}
      {type === 'gd' && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-[#F7F7F8]">
          {/* Left: avatar area is flex-1 — fills all height between header and input */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Cards live in the flex-1 zone and grow to fill it */}
            <div className="flex-1 flex gap-3 px-5 pt-5 pb-3 overflow-hidden">
              {participants.map((p) => (
                <GDAvatarCard key={p.id} participant={p} />
              ))}
            </div>

            <InputBar
              inputValue={inputValue}
              setInputValue={setInputValue}
              onSend={onSend}
              isStreaming={isStreaming}
              placeholder="Contribute to the discussion..."
              type="gd"
            />
          </div>

          {/* Right: Scrollable transcript */}
          <TranscriptFeed
            messages={messages}
            isStreaming={isStreaming}
            phase={phase}
            scrollRef={scrollRef}
            type="gd"
          />
        </div>
      )}


      {/* ── Interview Layout ── */}
      {type === 'interview' && (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Interview stage — avatar fills the column, input docked below */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#F5F5F7]">
            {/* Stage takes all remaining height */}
            <div className="flex-1 overflow-hidden">
              {participants[0] && (
                <InterviewAvatar
                  participant={participants[0]}
                  latestMessage={latestMsg}
                  isStreaming={isStreaming}
                />
              )}
            </div>

            {/* Input docked to bottom */}
            <div className="shrink-0 bg-white border-t border-slate-100">
              <InputBar
                inputValue={inputValue}
                setInputValue={setInputValue}
                onSend={onSend}
                isStreaming={isStreaming}
                placeholder="Speak your response..."
                type="interview"
              />
            </div>
          </div>

          {/* Right: Transcript log */}
          <TranscriptFeed
            messages={messages}
            isStreaming={isStreaming}
            phase={phase}
            scrollRef={scrollRef}
            type="interview"
          />
        </div>
      )}

      {/* ── Error overlay ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute inset-x-0 top-20 flex justify-center z-[100] px-8 pointer-events-none"
          >
            <div className="bg-red-50 text-red-600 px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 border border-red-100">
              <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />
              <span className="text-[13px] font-medium">{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
