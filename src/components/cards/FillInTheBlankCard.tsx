"use client";

import { useState } from 'react';
import { MagicWandIcon, PaperPlaneIcon } from '@radix-ui/react-icons';
import { motion } from 'framer-motion';

interface FillInTheBlankCardProps {
  sentence: string;
  hint: string;
  onSubmit: (answer: string) => void;
  disabled?: boolean;
}

export function FillInTheBlankCard({ sentence, hint, onSubmit, disabled }: FillInTheBlankCardProps) {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    if (value.trim() && !disabled) {
      onSubmit(value);
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
                autoFocus
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="........"
                className="inline-block border-b-[3px] border-accent/30 mx-2 text-accent font-body font-bold text-center focus:ring-0 focus:border-accent transition-all w-[180px] bg-transparent outline-none"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleSubmit();
                  }
                }}
                disabled={disabled}
              />
            )}
          </span>
        ))}
      </p>
      
      <motion.button
        whileHover={{ scale: (!value.trim() || disabled) ? 1 : 1.02 }}
        whileTap={{ scale: (!value.trim() || disabled) ? 1 : 0.98 }}
        className="w-full py-5 rounded-[1.5rem] bg-accent text-white font-bold uppercase tracking-[0.15em] text-xs transition-all disabled:opacity-50 disabled:grayscale shadow-md flex items-center justify-center gap-3"
        disabled={!value.trim() || disabled}
        onClick={handleSubmit}
      >
        Verify Completion
        <PaperPlaneIcon className="w-4 h-4" />
      </motion.button>
    </div>
  );
}
