"use client";

import { useEffect, useState } from 'react';
import { MagicWandIcon, CheckCircledIcon } from '@radix-ui/react-icons';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MultipleChoiceCardProps {
  sentence: string;
  hint: string;
  options: string[];
  onSubmit: (answer: string) => Promise<boolean> | boolean;
  disabled?: boolean;
}

export function MultipleChoiceCard({ sentence, hint, options, onSubmit, disabled }: MultipleChoiceCardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const blocked = disabled || submitting || submitted;
  const optionsKey = options.join('\u0001');

  useEffect(() => {
    setSelected(null);
    setSubmitting(false);
    setSubmitted(false);
  }, [sentence, hint, optionsKey]);

  const handleSubmit = async () => {
    if (!selected || blocked) return;
    const answer = selected;
    setSubmitting(true);
    try {
      const accepted = await onSubmit(answer);
      if (accepted !== false) {
        setSubmitted(true);
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
              <span className="inline-block min-w-[120px] border-b-[3px] border-accent/30 mx-2 text-accent font-body font-bold text-center">
                {selected || '......'}
              </span>
            )}
          </span>
        ))}
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {options.map((opt, idx) => (
          <motion.button
            whileHover={{ scale: blocked ? 1 : 1.02 }}
            whileTap={{ scale: blocked ? 1 : 0.98 }}
            key={idx}
            className={cn(
              "px-6 py-5 rounded-[1.5rem] text-left transition-all duration-300 border-[1.5px] group",
              selected === opt 
                ? "bg-accent text-white border-accent shadow-lg shadow-accent/20" 
                : "bg-slate-50/50 border-slate-200/60 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
            )}
            onClick={() => {
              if (!blocked) setSelected(opt);
            }}
            disabled={blocked}
          >
            <div className="flex items-center justify-between">
               <span className="font-bold tracking-tight text-[15px]">{opt}</span>
               {selected === opt && <CheckCircledIcon className="w-5 h-5 text-white" />}
            </div>
          </motion.button>
        ))}
      </div>

      <motion.button
        whileHover={{ scale: (!selected || blocked) ? 1 : 1.02 }}
        whileTap={{ scale: (!selected || blocked) ? 1 : 0.98 }}
        className="w-full py-5 rounded-[1.5rem] bg-accent text-white font-bold uppercase tracking-[0.15em] text-xs transition-all disabled:opacity-50 disabled:grayscale shadow-md"
        disabled={blocked || !selected}
        onClick={handleSubmit}
      >
        {submitting || submitted ? 'Submitting...' : 'Submit Selection'}
      </motion.button>
    </div>
  );
}
