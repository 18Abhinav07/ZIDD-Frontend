"use client";

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { LockClosedIcon, CheckIcon } from '@radix-ui/react-icons';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AVATAR_PATHS, getAvatarScaleClass } from '@/lib/avatarRegistry';
import { deriveCareerPathPresentation } from '@/lib/careerPathPresentation.mjs';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ProgressNode {
  node_id: string;
  title: string;
  mastery: number;
  raw_mastery?: number;
  best_mastery?: number;
  display_mastery?: number;
  completed?: boolean;
  mastered?: boolean;
  node_mastered?: boolean;
  display_status?: 'not_started' | 'in_progress' | 'ready_to_advance' | 'proficient' | 'mastered' | 'needs_remediation' | 'active' | 'locked' | string;
  last_gap?: string;
  clean_streak: number;
  attempts?: number;
  status: 'locked' | 'active' | 'mastered' | 'ready_to_advance' | 'proficient' | 'needs_remediation' | 'in_progress' | string;
}

interface PathMapProps {
  nodes: ProgressNode[];
  onNodeClick: (node: ProgressNode) => void;
}

const AVATAR_POOL = [
  AVATAR_PATHS.casual_male,
  AVATAR_PATHS.casual_female,
  AVATAR_PATHS.tech_black,
  AVATAR_PATHS.coach_pink,
  AVATAR_PATHS.coach_orange,
  AVATAR_PATHS.coach_green,
  AVATAR_PATHS.coach_blue,
  AVATAR_PATHS.casual_blue,
  AVATAR_PATHS.casual_purple,
];

const QUOTES = [
  "Open this skill when you are ready to practice.",
  "One focused answer is enough to make progress.",
  "Use a specific example when the coach asks.",
  "Slow down, answer clearly, then refine.",
  "The next turn will focus on one concrete step.",
  "Progress updates after the coach reviews your answer."
];

function statusDescription({
  isActive,
  isLocked,
  isMastered,
  isNeedsPractice,
  isReady,
}: {
  isActive: boolean;
  isLocked: boolean;
  isMastered: boolean;
  isNeedsPractice: boolean;
  isReady: boolean;
}) {
  if (isLocked) return 'Locked';
  if (isMastered) return 'Mastered';
  if (isReady) return 'Ready for next skill';
  if (isActive) return 'You are here';
  if (isNeedsPractice) return 'Needs practice';
  return 'Needs practice';
}

export const PathMap: React.FC<PathMapProps> = ({ nodes, onNodeClick }) => {
  
  const {
    hasPathActivity,
    headline,
    lastProgressIndex,
    pathFillPercentage,
  } = deriveCareerPathPresentation(nodes);

  return (
    <div className="relative flex flex-col items-center py-20 px-4 w-full max-w-5xl mx-auto min-h-[1200px]">
      
      {/* Dynamic Background Winding Path */}
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[300px] pointer-events-none opacity-30">
        <svg width="100%" height="100%" preserveAspectRatio="none">
           {/* Soft solid underlay so the route reads even before any progress */}
          <path
            d="M150,0 C300,300 0,600 150,900 C300,1200 0,1500 150,1800"
            fill="none"
            stroke="currentColor"
            strokeWidth="14"
            className="text-slate-200/70"
          />
           {/* Dashed travel line on top */}
          <path
            d="M150,0 C300,300 0,600 150,900 C300,1200 0,1500 150,1800"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-slate-300"
            strokeDasharray="2 18"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Active Glowing Path Overlay */}
      <div 
         className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] pointer-events-none transition-all duration-1000 ease-out overflow-hidden"
         style={{ height: `${Math.min(100, pathFillPercentage + (hasPathActivity ? 10 : 0))}%` }}
      >
        <svg width="100%" height="1800px" preserveAspectRatio="none" className="absolute top-0 left-0">
          <path 
            d="M150,0 C300,300 0,600 150,900 C300,1200 0,1500 150,1800" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="8" 
            className="text-indigo-500 drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]"
          />
        </svg>
      </div>

      <div className="relative z-10 flex flex-col gap-40 w-full items-center">

        {/* Journey start */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-2 -mb-24 select-none"
        >
          <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-500">
            {headline}
          </span>
          <div className="w-3 h-3 rounded-full bg-white border-2 border-slate-300 shadow-[0_0_0_4px_rgba(148,163,184,0.12)]" />
        </motion.div>

        {nodes.map((node, index) => {
          const isEven = index % 2 === 0;
          const status = node.display_status ?? node.status;
          const isLocked = status === 'locked';
          const isMastered = Boolean(node.mastered || node.node_mastered || status === 'mastered');
          const isReady = !isMastered && (status === 'ready_to_advance' || status === 'proficient');
          const isActive = status === 'active' || status === 'in_progress';
          const isNeedsPractice = !isLocked && !isMastered && !isReady && !isActive;
          const accessibleStatus = statusDescription({ isActive, isLocked, isMastered, isNeedsPractice, isReady });
          const displayMastery = isMastered
            ? 1
            : Math.max(0, Math.min(1, node.display_mastery ?? node.mastery ?? 0));
          
          let hash = 0;
          const seedStr = node.node_id + index.toString();
          for (let i = 0; i < seedStr.length; i++) {
            hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
          }
          const avatarUrl = AVATAR_POOL[Math.abs(hash) % AVATAR_POOL.length];
          const quote = QUOTES[Math.abs(hash) % QUOTES.length];
          
          return (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
              key={node.node_id}
              aria-label={`${node.title} ${accessibleStatus}`}
              disabled={isLocked}
              className={cn(
                "relative flex items-center justify-center w-full max-w-3xl border-0 bg-transparent p-0 text-left",
                !isLocked ? "cursor-pointer" : "cursor-not-allowed",
                isEven ? "flex-row" : "flex-row-reverse"
              )}
              onClick={() => onNodeClick(node)}
            >
              
              {/* 3D Avatar Area */}
              <div className={cn(
                 "relative z-20 flex-shrink-0 transition-all duration-500 w-48 h-56 md:w-64 md:h-72",
                 isEven ? "ml-auto md:ml-[50%] md:-translate-x-1/2" : "mr-auto md:mr-[50%] md:translate-x-1/2"
              )}>
                 {/* Ghost step numeral — echoes the onboarding cards, gives the path a count */}
	                 <span className={cn(
	                    "absolute -top-8 left-1/2 -translate-x-1/2 z-0 font-anton leading-none select-none pointer-events-none text-[7rem] md:text-[9rem] tracking-tighter transition-colors duration-700",
	                    isActive ? "text-indigo-500/10" : isMastered ? "text-emerald-500/10" : isReady ? "text-amber-500/10" : isNeedsPractice ? "text-rose-500/10" : "text-slate-900/[0.04]"
	                 )}>{String(index + 1).padStart(2, '0')}</span>

                 {/* Station: a station ring + soft ground shadow so the figure stands ON the path */}
                 <div className="absolute left-1/2 bottom-4 -translate-x-1/2 z-0 pointer-events-none">
                    <div className={cn(
                       "w-28 md:w-36 h-5 rounded-[100%] blur-md transition-colors duration-700",
	                       isActive ? "bg-indigo-900/15" : isLocked ? "bg-slate-900/[0.06]" : isReady ? "bg-amber-900/10" : isNeedsPractice ? "bg-rose-900/10" : "bg-slate-900/10"
	                    )} />
                    <div className={cn(
                       "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 md:w-20 h-16 md:h-20 rounded-full border transition-all duration-700",
	                       isActive ? "border-indigo-300/60 bg-indigo-50/40" : isMastered ? "border-emerald-300/50 bg-emerald-50/30" : isReady ? "border-amber-300/50 bg-amber-50/30" : isNeedsPractice ? "border-rose-200/60 bg-rose-50/30" : "border-slate-200/70 bg-white/30"
	                    )} />
                 </div>

                 <motion.div
	                    animate={!isLocked ? { y: [0, -12, 0] } : {}}
	                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: index * 0.2 }}
	                    whileHover={!isLocked ? { scale: 1.08, rotate: isEven ? 2 : -2 } : {}}
	                    whileTap={!isLocked ? { scale: 0.95 } : {}}
	                    className={cn(
	                      "relative w-48 h-56 md:w-64 md:h-72 flex items-center justify-center transition-all duration-700 z-10",
	                      isMastered && "opacity-90 scale-90",
	                      isActive && "drop-shadow-[0_30px_40px_rgba(99,102,241,0.4)] z-30",
	                      isLocked && "opacity-45 grayscale-[85%] blur-[1px]"
	                    )}
	                 >
	                    {/* Active Halo */}
	                    {isActive && (
                       <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-3xl -z-10 animate-pulse" />
                    )}

                    <Image
                      src={avatarUrl}
                      alt={`Agent ${index + 1}`}
                      fill
                      sizes="200px"
                      className={cn(
                        "object-contain pointer-events-none",
                        getAvatarScaleClass(avatarUrl)
                      )}
                      unoptimized
                    />

	                    {isLocked && (
                       <div className="absolute inset-0 flex items-center justify-center z-20">
                          <div className="w-16 h-16 bg-slate-900/50 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/10 shadow-2xl">
                             <LockClosedIcon className="w-8 h-8 text-white" />
                          </div>
                       </div>
                    )}

	                    {isMastered && (
                       <div className="absolute top-2 right-2 z-30 w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 ring-4 ring-white">
                          <CheckIcon className="w-5 h-5" />
                       </div>
                    )}
                 </motion.div>
              </div>

              {/* Speech Bubble / Info Panel */}
              <div className={cn(
                 "absolute z-30 transition-all duration-500 opacity-100 translate-y-0",
                 isEven ? "left-4 md:left-[calc(50%+100px)]" : "right-4 md:right-[calc(50%+100px)]"
              )}>
	                 {isLocked ? (
                    /* Muted name tag: the upcoming skill is NAMED, not an anonymous ghost */
                    <div className={cn(
                       "flex items-center gap-2 bg-white/70 backdrop-blur-sm border border-slate-200/70 rounded-full pl-2 pr-4 py-1.5 shadow-sm max-w-[240px]",
                       index === lastProgressIndex + 1 && "ring-1 ring-slate-200"
                    )}>
                       <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                          <LockClosedIcon className="w-3 h-3" />
                       </span>
                       <span className="text-[13px] font-semibold text-slate-400 truncate">{node.title}</span>
                    </div>
                 ) : (
                    <div className={cn(
                       "relative bg-white/95 backdrop-blur-xl border rounded-[2rem] p-6 shadow-2xl max-w-[280px]",
	                       isActive ? "border-indigo-200 shadow-indigo-500/10 ring-4 ring-indigo-50/50" : isReady ? "border-amber-200 shadow-amber-500/10 ring-4 ring-amber-50/50" : isNeedsPractice ? "border-rose-200 shadow-rose-500/10 ring-4 ring-rose-50/50" : "border-slate-200/60 shadow-slate-900/5"
	                    )}>
                       {/* The Tail */}
                       <div className={cn(
                          "absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white/95 border-b border-l border-slate-200/60 backdrop-blur-xl rotate-45 -z-10",
                          isEven ? "-left-3" : "-right-3 border-t border-r border-b-0 border-l-0"
                       )} />

	                       {isActive ? (
	                          <span className="inline-block mb-3 text-[9px] font-bold uppercase tracking-[0.25em] text-indigo-500 bg-indigo-50 rounded-full px-2.5 py-1">You are here</span>
	                       ) : isReady ? (
	                          <span className="inline-flex items-center gap-1.5 mb-3 text-[9px] font-bold uppercase tracking-[0.25em] text-amber-600">
	                             Ready for next skill
	                          </span>
	                       ) : isNeedsPractice ? (
	                          <span className="inline-flex items-center gap-1.5 mb-3 text-[9px] font-bold uppercase tracking-[0.25em] text-rose-600">
	                             Needs practice
	                          </span>
	                       ) : (
	                          <span className="inline-flex items-center gap-1.5 mb-3 text-[9px] font-bold uppercase tracking-[0.25em] text-emerald-600">
	                             <CheckIcon className="w-3 h-3" /> Mastered
	                          </span>
	                       )}

	                       {isActive && (
                          <p className="text-indigo-600 font-display text-xl leading-tight tracking-tight italic mb-4">
                             &quot;{quote}&quot;
                          </p>
                       )}

                       <h3 className={cn(
	                          "font-bold text-lg mb-2 leading-tight tracking-tight",
	                          isActive ? "text-slate-900" : isNeedsPractice ? "text-slate-800" : "text-slate-600"
	                       )}>{node.title}</h3>
	                       {isReady && node.last_gap && (
	                         <p className="mb-4 text-xs leading-relaxed text-slate-500">{node.last_gap}</p>
	                       )}

                       <div className="flex items-center gap-3">
                         <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                           <div
                             className={cn(
                               "h-full rounded-full transition-all duration-1000",
	                               isMastered ? "bg-emerald-400" : isReady ? "bg-amber-400" : isNeedsPractice ? "bg-rose-400" : "bg-indigo-500"
	                             )}
                             style={{ width: `${Math.round(displayMastery * 100)}%` }}
                           />
                         </div>
                         <span className="text-xs font-black tracking-widest text-slate-400">
	                            {isMastered ? 'Done' : `${Math.round(displayMastery * 100)}%`}
	                         </span>
                       </div>
                    </div>
                 )}
              </div>

            </motion.button>
          );
        })}

        {/* Journey destination */}
        {nodes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center gap-4 -mt-16 select-none"
          >
            <div className="relative w-20 h-20 rounded-full bg-white border border-slate-200/70 shadow-[0_20px_40px_rgba(15,23,42,0.08)] flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-gradient-to-b from-amber-100/60 to-transparent" />
              <span className="relative text-3xl" role="img" aria-label="trophy">🏆</span>
            </div>
            <div className="text-center">
              <p className="font-display text-3xl tracking-tight text-slate-900 leading-none">Sustained Mastery</p>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Repeat proof across every skill</p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
