"use client";

import { useEffect, useId, useState } from 'react';
import { MagicWandIcon, PaperPlaneIcon } from '@radix-ui/react-icons';
import { motion } from 'framer-motion';

interface FillInTheBlankCardProps {
  sentence: string;
  hint: string;
  onSubmit: (answer: string) => Promise<boolean> | boolean;
  disabled?: boolean;
}

export function FillInTheBlankCard({ sentence, hint, onSubmit, disabled }: FillInTheBlankCardProps) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const inputId = useId();
  const blocked = disabled || submitting || submitted;

  useEffect(() => {
    setValue('');
    setSubmitting(false);
    setSubmitted(false);
  }, [sentence, hint]);

  const handleSubmit = async () => {
    const answer = value.trim();
    if (!answer || blocked) return;
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
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] text-slate-800 w-full relative overflow-hidden">
      <div className="flex items-center gap-2 mb-6">
         <MagicWandIcon className="text-accent w-4 h-4" />
         <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">{hint}</span>
      </div>
      
      <p className="text-2xl font-display leading-tight mb-10 text-slate-900">
        {sentence.split('___').map((part, i, arr) => (
          <span key={i}>
            {part}
            {i < arr.length - 1 && (
              <input
                id={inputId}
                name="bridge-fill-blank-answer"
                autoFocus
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="........"
                className="inline-block border-b-[3px] border-accent/30 mx-2 text-accent font-body font-bold text-center focus:ring-0 focus:border-accent transition-all w-[180px] bg-transparent outline-none disabled:cursor-wait disabled:text-slate-400 disabled:border-slate-200 disabled:placeholder:text-slate-300"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                disabled={blocked}
              />
            )}
          </span>
        ))}
      </p>
      
      <motion.button
        whileHover={{ scale: (!value.trim() || blocked) ? 1 : 1.02 }}
        whileTap={{ scale: (!value.trim() || blocked) ? 1 : 0.98 }}
        className="w-full py-5 rounded-[1.5rem] bg-accent text-white font-bold uppercase tracking-[0.15em] text-xs transition-all disabled:opacity-50 disabled:grayscale shadow-md flex items-center justify-center gap-3"
        disabled={blocked || !value.trim()}
        onClick={handleSubmit}
      >
        {submitting || submitted ? 'Verifying...' : 'Verify Completion'}
        <PaperPlaneIcon className="w-4 h-4" />
      </motion.button>
    </div>
  );
}
