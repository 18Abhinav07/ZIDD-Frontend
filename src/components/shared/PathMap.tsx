"use client";

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { LockClosedIcon } from '@radix-ui/react-icons';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AVATAR_PATHS, getAvatarScaleClass } from '@/lib/avatarRegistry';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ProgressNode {
  node_id: string;
  title: string;
  mastery: number;
  clean_streak: number;
  status: 'locked' | 'active' | 'mastered';
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
  "You're doing great! Keep it up.",
  "Let's conquer this next challenge.",
  "Consistency is your superpower.",
  "Ready to level up your clarity?",
  "Focus on your breathing. You got this.",
  "Mastery is just a few turns away."
];

export const PathMap: React.FC<PathMapProps> = ({ nodes, onNodeClick }) => {
  
  // Calculate how far down the active node is to fill the SVG path
  const activeIndex = nodes.findIndex(n => n.status === 'active');
  const pathFillPercentage = activeIndex === -1 ? 100 : (activeIndex / Math.max(1, nodes.length - 1)) * 100;

  return (
    <div className="relative flex flex-col items-center py-20 px-4 w-full max-w-5xl mx-auto min-h-[1200px]">
      
      {/* Dynamic Background Winding Path */}
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[300px] pointer-events-none opacity-20">
        <svg width="100%" height="100%" preserveAspectRatio="none">
           {/* Base faded path */}
          <path 
            d="M150,0 C300,300 0,600 150,900 C300,1200 0,1500 150,1800" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="8" 
            className="text-slate-300 stroke-dashed"
            strokeDasharray="16 16"
          />
        </svg>
      </div>

      {/* Active Glowing Path Overlay */}
      <div 
         className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] pointer-events-none transition-all duration-1000 ease-out overflow-hidden"
         style={{ height: `${pathFillPercentage + 10}%` }}
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
        {nodes.map((node, index) => {
          const isEven = index % 2 === 0;
          const status = node.status;
          
          let hash = 0;
          const seedStr = node.node_id + index.toString();
          for (let i = 0; i < seedStr.length; i++) {
            hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
          }
          const avatarUrl = AVATAR_POOL[Math.abs(hash) % AVATAR_POOL.length];
          const quote = QUOTES[Math.abs(hash) % QUOTES.length];
          
          return (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
              key={node.node_id}
              className={cn(
                "relative flex items-center justify-center w-full max-w-3xl",
                status !== 'locked' ? "cursor-pointer" : "cursor-not-allowed",
                isEven ? "flex-row" : "flex-row-reverse"
              )}
              onClick={() => onNodeClick(node)}
            >
              
              {/* 3D Avatar Area */}
              <div className={cn(
                 "relative z-20 flex-shrink-0 transition-all duration-500",
                 isEven ? "ml-auto md:ml-[50%] md:-translate-x-1/2" : "mr-auto md:mr-[50%] md:translate-x-1/2"
              )}>
                 <motion.div 
                    animate={status !== 'locked' ? { y: [0, -12, 0] } : {}}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: index * 0.2 }}
                    whileHover={status !== 'locked' ? { scale: 1.08, rotate: isEven ? 2 : -2 } : {}}
                    whileTap={status !== 'locked' ? { scale: 0.95 } : {}}
                    className={cn(
                      "relative w-48 h-56 md:w-64 md:h-72 flex items-center justify-center transition-all duration-700",
                      status === 'mastered' && "opacity-80 scale-90",
                      status === 'active' && "drop-shadow-[0_30px_40px_rgba(99,102,241,0.4)] z-30",
                      status === 'locked' && "opacity-30 grayscale blur-[2px]"
                    )}
                 >
                    {/* Active Halo */}
                    {status === 'active' && (
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

                    {status === 'locked' && (
                       <div className="absolute inset-0 flex items-center justify-center z-20">
                          <div className="w-16 h-16 bg-slate-900/50 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/10 shadow-2xl">
                             <LockClosedIcon className="w-8 h-8 text-white" />
                          </div>
                       </div>
                    )}
                 </motion.div>
              </div>

              {/* Speech Bubble / Info Panel */}
              <div className={cn(
                 "absolute z-30 transition-all duration-500",
                 isEven ? "left-4 md:left-[calc(50%+100px)]" : "right-4 md:right-[calc(50%+100px)]",
                 status === 'locked' ? "opacity-0 translate-y-4 pointer-events-none" : "opacity-100 translate-y-0"
              )}>
                 <div className={cn(
                    "bg-white/95 backdrop-blur-xl border rounded-[2rem] p-6 shadow-2xl max-w-[280px]",
                    status === 'active' ? "border-indigo-200 shadow-indigo-500/10 ring-4 ring-indigo-50/50" : "border-slate-200/60 shadow-slate-900/5"
                 )}>
                    {/* The Tail */}
                    <div className={cn(
                       "absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white/95 border-b border-l border-slate-200/60 backdrop-blur-xl rotate-45 -z-10",
                       isEven ? "-left-3" : "-right-3 border-t border-r border-b-0 border-l-0"
                    )} />

                    {status === 'active' && (
                       <div className="mb-4">
                          <p className="text-indigo-600 font-display text-xl leading-tight tracking-tight italic">
                             &quot;{quote}&quot;
                          </p>
                       </div>
                    )}

                    <div>
                       <h3 className={cn(
                          "font-bold text-lg mb-2 leading-tight tracking-tight",
                          status === 'active' ? "text-slate-900" : "text-slate-600"
                       )}>{node.title}</h3>
                       
                       <div className="flex items-center gap-3">
                         <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                           <div 
                             className={cn(
                               "h-full rounded-full transition-all duration-1000",
                               status === 'mastered' ? "bg-emerald-400" : "bg-indigo-500"
                             )}
                             style={{ width: `${Math.round(node.mastery * 100)}%` }}
                           />
                         </div>
                         <span className="text-xs font-black tracking-widest text-slate-400">
                            {Math.round(node.mastery * 100)}%
                         </span>
                       </div>
                    </div>
                 </div>
              </div>

            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
