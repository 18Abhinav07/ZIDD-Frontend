"use client";

import { useState } from 'react';
import { ChatBubbleIcon, PaperPlaneIcon } from '@radix-ui/react-icons';
import { motion } from 'framer-motion';

interface SpokenAnswerCardProps {
  sentence: string;
  hint: string;
  onSubmit: (answer: string) => void;
  disabled?: boolean;
}

// Spoken bridge exercises are full prompts ("Give me your 'Tell me about
// yourself' in three sentences…"), not fill-in-the-blank sentences — they carry
// no `___`, so the blank card would render no input at all. This card gives the
// learner a free-text area to compose their spoken response.
export function SpokenAnswerCard({ sentence, hint, onSubmit, disabled }: SpokenAnswerCardProps) {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    if (value.trim() && !disabled) {
      onSubmit(value);
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] text-slate-800 w-full relative overflow-hidden">
      <div className="flex items-center gap-2 mb-6">
         <ChatBubbleIcon className="text-accent w-4 h-4" />
         <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">{hint}</span>
      </div>

      <p className="text-2xl font-display leading-tight mb-8 text-slate-900">
        {sentence}
      </p>

      <textarea
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Speak your answer here…"
        rows={4}
        className="w-full mb-8 rounded-[1.5rem] border-[1.5px] border-slate-200/60 bg-slate-50/50 px-6 py-5 text-[15px] font-body font-medium leading-relaxed text-slate-800 placeholder:text-slate-300 outline-none transition-all focus:border-accent/40 focus:bg-white focus:ring-4 focus:ring-accent/10 resize-none"
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        disabled={disabled}
      />

      <motion.button
        whileHover={{ scale: (!value.trim() || disabled) ? 1 : 1.02 }}
        whileTap={{ scale: (!value.trim() || disabled) ? 1 : 0.98 }}
        className="w-full py-5 rounded-[1.5rem] bg-accent text-white font-bold uppercase tracking-[0.15em] text-xs transition-all disabled:opacity-50 disabled:grayscale shadow-md flex items-center justify-center gap-3"
        disabled={!value.trim() || disabled}
        onClick={handleSubmit}
      >
        Submit Response
        <PaperPlaneIcon className="w-4 h-4" />
      </motion.button>
    </div>
  );
}
