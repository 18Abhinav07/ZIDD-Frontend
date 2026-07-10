"use client";

import { useEffect, useId, useState } from 'react';
import { ChatBubbleIcon, PaperPlaneIcon } from '@radix-ui/react-icons';
import { motion } from 'framer-motion';

interface SpokenAnswerCardProps {
  sentence: string;
  hint: string;
  context?: string;
  onSubmit: (answer: string) => Promise<boolean> | boolean;
  disabled?: boolean;
}

// Spoken bridge exercises are full prompts ("Give me your 'Tell me about
// yourself' in three sentences…"), not fill-in-the-blank sentences — they carry
// no `___`, so the blank card would render no input at all. This card gives the
// learner a free-text area to compose their spoken response.
export function SpokenAnswerCard({ sentence, hint, context, onSubmit, disabled }: SpokenAnswerCardProps) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const textareaId = useId();
  const blocked = disabled || submitting || submitted;

  useEffect(() => {
    setValue('');
    setSubmitting(false);
    setSubmitted(false);
  }, [sentence, hint]);

  const handleSubmit = async () => {
    const answer = value.trim();
    if (answer && !blocked) {
      setSubmitting(true);
      try {
        const accepted = await onSubmit(answer);
        if (accepted !== false) {
          setSubmitted(true);
          setValue('');
        }
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] text-slate-800 w-full relative overflow-hidden">
      <div className="flex items-center gap-2 mb-6">
         <ChatBubbleIcon className="text-accent w-4 h-4" />
         <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">{hint}</span>
      </div>
      {context && (
        <p className="-mt-3 mb-6 text-sm font-normal leading-6 text-slate-500">
          <span className="font-semibold text-slate-700">Why this exercise: </span>{context}
        </p>
      )}

      <p className="text-2xl font-display leading-tight mb-8 text-slate-900">
        {sentence}
      </p>

      <textarea
        id={textareaId}
        name="bridge-spoken-answer"
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Type what you would say…"
        rows={4}
        className="w-full mb-8 rounded-[1.5rem] border-[1.5px] border-slate-200/60 bg-slate-50/50 px-6 py-5 text-[15px] font-body font-medium leading-relaxed text-slate-800 placeholder:text-slate-300 outline-none transition-all focus:border-accent/40 focus:bg-white focus:ring-4 focus:ring-accent/10 resize-none disabled:cursor-wait disabled:bg-slate-100 disabled:text-slate-400 disabled:placeholder:text-slate-300"
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        disabled={blocked}
      />

      <motion.button
        whileHover={{ scale: (!value.trim() || blocked) ? 1 : 1.02 }}
        whileTap={{ scale: (!value.trim() || blocked) ? 1 : 0.98 }}
        className="w-full py-5 rounded-[1.5rem] bg-accent text-white font-bold uppercase tracking-[0.15em] text-xs transition-all disabled:opacity-50 disabled:grayscale shadow-md flex items-center justify-center gap-3"
        disabled={blocked || !value.trim()}
        onClick={handleSubmit}
      >
        {submitting || submitted ? 'Submitting...' : 'Submit Response'}
        <PaperPlaneIcon className="w-4 h-4" />
      </motion.button>
    </div>
  );
}
