"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRightIcon } from '@radix-ui/react-icons';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ProgressNode } from '@/components/shared/PathMap';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ScenarioPickerProps {
  nodes: ProgressNode[];
  onPick: (node: ProgressNode) => void;
}

// TEST mode is NOT a climbed ladder: each node is an independent, scored
// simulation the backend will start on demand (metered: first attempts free,
// then per-attempt credits). So we present the scenarios as a flat, fully-open
// picker instead of the prep-mode progression map (which locks every node behind
// mastering the previous one, a constraint the backend does not enforce here).
export const ScenarioPicker: React.FC<ScenarioPickerProps> = ({ nodes, onPick }) => {
  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-12">
      <div className="text-center max-w-2xl mx-auto mb-14">
        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-indigo-500">Assessment</span>
        <h2 className="mt-3 font-display text-4xl md:text-5xl tracking-tight text-slate-900 leading-[1.05]">
          Choose your scenario
        </h2>
        <p className="mt-4 text-slate-500 text-[15px] leading-relaxed">
          Each one is a live, scored simulation with a full panel. Pick where you want to be
          tested, in any order. Your first attempts are free.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {nodes.map((node, index) => (
          <motion.button
            key={node.node_id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: Math.min(index * 0.04, 0.4), ease: [0.16, 1, 0.3, 1] }}
            onClick={() => onPick(node)}
            className={cn(
              "group relative text-left bg-white rounded-[1.75rem] border border-slate-200/70 p-6 pb-5",
              "shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden",
              "transition-all duration-300 ease-out hover:-translate-y-1 hover:border-indigo-200",
              "hover:shadow-[0_24px_40px_rgba(79,70,229,0.12)] focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
            )}
          >
            <span className="pointer-events-none absolute -top-4 right-3 font-anton text-[5.5rem] leading-none tracking-tighter text-slate-900/[0.04] group-hover:text-indigo-500/10 transition-colors duration-300 select-none">
              {String(index + 1).padStart(2, '0')}
            </span>

            <div className="relative">
              {node.status === 'mastered' && (
                <span className="inline-block mb-3 text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-600">
                  Mastered
                </span>
              )}
              <h3 className="font-bold text-lg text-slate-900 leading-tight tracking-tight pr-12">
                {node.title}
              </h3>
              <div className="mt-6 flex items-center gap-2 text-indigo-600">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em]">Start assessment</span>
                <ArrowRightIcon className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};
