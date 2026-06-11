"use client";

import { motion } from 'framer-motion';
import { QuestionMarkCircledIcon } from '@radix-ui/react-icons';

// Shown when a session id is unknown or expired (the transcript fetch 404'd).
// Distinct from a transport-error banner: the session genuinely isn't there, so
// we tell the learner that plainly and give them one clear way back to the map.
export function SessionNotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-[100dvh] bg-[#FCFCFC] text-slate-900 flex flex-col items-center justify-center px-6 text-center font-body">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md"
      >
        <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-6">
          <QuestionMarkCircledIcon className="w-7 h-7 text-slate-400" />
        </div>
        <h1 className="font-display text-3xl tracking-tight mb-3">Session not found</h1>
        <p className="text-slate-500 leading-relaxed mb-8">
          This session has ended or the link is no longer valid. Head back to your
          map to pick up where you left off.
        </p>
        <button
          onClick={onBack}
          className="px-7 py-3.5 bg-slate-900 text-white rounded-full font-bold uppercase tracking-widest text-xs hover:bg-slate-800 transition-colors"
        >
          Back to map
        </button>
      </motion.div>
    </div>
  );
}
