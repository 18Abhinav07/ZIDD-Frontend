"use client";

import { motion } from 'framer-motion';

interface GDBriefingCardProps {
  topic?: string;
  onStart: () => void;
  onSkip: () => void;
}

const DEFAULT_TIP = "Start with one clear claim. 'I believe X because Y.' You don't need three points from the start.";

export function GDBriefingCard({ topic, onStart, onSkip }: GDBriefingCardProps) {
  return (
    <div className="h-[100dvh] bg-slate-950 flex items-center justify-center p-6 font-body">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg"
      >
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-baseline gap-1 mb-4">
            <span className="font-sans font-black text-xl tracking-tighter text-white">ZIDD</span>
            <span className="text-indigo-500">.</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 ml-3">
              Studio / GD: Policy Debate
            </span>
          </div>
          <h1 className="text-3xl font-black text-white leading-tight tracking-tight">
            Before you begin
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Know the arena before you step in.
          </p>
        </div>

        {/* Info tiles */}
        <div className="space-y-3 mb-8">
          {/* Motion */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4">
            <p className="text-[9px] uppercase tracking-[0.2em] font-black text-indigo-400 mb-1">Today's Motion</p>
            <p className="text-[13px] text-slate-200 leading-relaxed font-medium">
              {topic || "The motion will be announced when the discussion opens."}
            </p>
          </div>

          {/* How it works */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4">
            <p className="text-[9px] uppercase tracking-[0.2em] font-black text-slate-500 mb-3">How It Works</p>
            <ul className="space-y-2">
              {[
                "Up to 10 rounds — one primary speaker takes the floor, with panel follow-ups when the discussion needs them",
                "Floor rotates automatically — watch the avatar cards to see who's speaking",
                "Tension meter (top bar) = debate intensity. Rising tension is good.",
              ].map((item, i) => (
                <li key={i} className="flex gap-2.5 text-[12px] text-slate-400 leading-relaxed">
                  <span className="text-indigo-500 shrink-0 font-black mt-0.5">{i + 1}.</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Stance */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4">
            <p className="text-[9px] uppercase tracking-[0.2em] font-black text-slate-500 mb-1.5">Your Stance</p>
            <p className="text-[12px] text-slate-400 leading-relaxed">
              Pick a side clearly when the session opens. You can change your stance later, but the first move should not sound unsure.
            </p>
          </div>

          {/* Coach tip */}
          <div className="bg-indigo-950 border border-indigo-900 rounded-2xl px-5 py-4">
            <p className="text-[9px] uppercase tracking-[0.2em] font-black text-indigo-400 mb-1">Coach Tip</p>
            <p className="text-[12px] text-indigo-200 leading-relaxed">
              {DEFAULT_TIP}
            </p>
          </div>
        </div>

        {/* CTAs */}
        <div className="space-y-3">
          <button
            onClick={onStart}
            className="w-full py-4 rounded-2xl bg-white text-slate-900 font-black text-sm hover:bg-indigo-50 active:scale-[0.98] transition-all"
          >
            I'm Ready — Start the Discussion
          </button>
          <button
            onClick={onSkip}
            className="w-full text-center text-[12px] text-slate-600 hover:text-slate-400 transition-colors py-2"
          >
            Already know the drill? Skip briefing
          </button>
        </div>
      </motion.div>
    </div>
  );
}
