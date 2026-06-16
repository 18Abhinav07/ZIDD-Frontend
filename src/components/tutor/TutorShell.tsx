"use client";

import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAvatarScaleClass } from '@/lib/avatarRegistry';
import { getEmotionTreatment, getAffectSupportNote } from '@/lib/emotion';
import type { DoneFrame } from '@/types';
import { 
  ChevronLeftIcon, 
  MagicWandIcon, 
  LightningBoltIcon, 
  TargetIcon, 
  StarIcon, 
  InfoCircledIcon 
} from '@radix-ui/react-icons';
import Image from 'next/image';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CreditsBadge } from '@/components/billing/CreditsBadge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TutorShellProps {
  children: React.ReactNode;
  nodeTitle?: string;
  mastery: number;
  streak: number;
  attempts: number;
  phase?: string;
  mode?: 'professional' | 'gamified';
  onBack: () => void;
  characterImg?: string;
  characterQuote?: string;
  characterBg?: string;
  emotion?: DoneFrame['avatar_emotion'];
  affect?: DoneFrame['affect'];
}

const AvatarTile = memo(function AvatarTile({ characterImg, characterQuote, mode, characterBg, emotion, affect }: { characterImg?: string, characterQuote?: string, mode: string, characterBg?: string, emotion?: DoneFrame['avatar_emotion'], affect?: DoneFrame['affect'] }) {
  const treatment = getEmotionTreatment(emotion);
  const supportNote = getAffectSupportNote(affect);
  return (
    <motion.div
      className={cn(
        "relative w-full h-full flex flex-col items-center justify-center p-8 overflow-hidden rounded-[2.5rem] border transition-colors duration-700",
        !characterBg && (mode === 'professional' ? "bg-white/40 border-slate-200/50" : "liquid-glass")
      )}
      animate={{ boxShadow: `0 0 0 1px ${treatment.ring}55, 0 0 48px -8px ${treatment.ring}66${characterBg ? `, 0 20px 40px ${characterBg}33` : ''}` }}
      transition={{ duration: 0.7, ease: "easeInOut" }}
      style={characterBg ? { backgroundColor: characterBg, borderColor: 'transparent' } : {}}
    >
      {/* Emotion mood chip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={emotion ?? 'neutral'}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.4 }}
          className="absolute top-4 right-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 backdrop-blur-md border border-slate-200/50 shadow-sm"
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: treatment.ring }}
          />
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-600">
            {treatment.label}
          </span>
        </motion.div>
      </AnimatePresence>

      {/* Abstract Ghost text behind avatar */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.05] mix-blend-overlay select-none pointer-events-none">
        <span className="font-ghost text-[15vw] leading-none text-white tracking-tighter">
          {mode === 'professional' ? 'PRO' : 'COACH'}
        </span>
      </div>

      {/* Active character layer with floating animation */}
      <AnimatePresence>
        {characterImg && (
          <motion.div 
            key={characterImg}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: [-8, 8, -8] 
            }}
            transition={{ 
              opacity: { duration: 0.5 },
              scale: { duration: 0.5 },
              y: { duration: 6, repeat: Infinity, ease: "easeInOut" }
            }}
            className="absolute inset-0 z-10 flex items-center justify-center p-4 pb-32 lg:p-8 lg:pb-32 overflow-hidden pointer-events-none"
          >
            <div className="relative w-full h-full flex items-center justify-center">
              <Image 
                src={characterImg}
                alt="Coach"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className={cn("object-contain object-bottom drop-shadow-[0_20px_40px_rgba(0,0,0,0.3)]", getAvatarScaleClass(characterImg || ''))}
                priority
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Coaching Directive floating badge */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mt-auto w-full bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-slate-200/50 shadow-sm relative z-20"
      >
        <div className="flex items-center gap-2 mb-2">
          <InfoCircledIcon className="text-accent w-4 h-4" />
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Directive</span>
        </div>
        <p className="text-sm font-medium leading-relaxed text-slate-700">
          {characterQuote}
        </p>
        <AnimatePresence>
          {supportNote && (
            <motion.p
              key={supportNote}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4 }}
              className="mt-3 text-xs font-medium leading-relaxed text-slate-500"
            >
              {supportNote}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
});

export const TutorShell: React.FC<TutorShellProps> = ({
  children,
  nodeTitle,
  mastery,
  streak,
  attempts,
  phase,
  mode = 'gamified',
  onBack,
  characterImg,
  characterQuote,
  characterBg,
  emotion,
  affect
}) => {
  return (
    <div className={cn("relative min-h-[100dvh] w-full overflow-hidden flex flex-col font-body bg-background transition-colors duration-500", mode === 'professional' ? 'mode-professional' : 'mode-gamified')}>
      <div className="grain-overlay" />

      {/* Header - Minimalist */}
      <header className="relative z-20 px-6 py-5 flex justify-between items-center max-w-[1400px] w-full mx-auto">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/50 backdrop-blur-md border border-slate-200/50 flex items-center justify-center hover:bg-white transition-all active:scale-95 text-slate-700 shadow-sm"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          
          <div>
            <div className="flex items-center gap-2 mb-0.5">
               <MagicWandIcon className="text-accent w-4 h-4" />
               <h1 className="text-sm font-bold uppercase tracking-[0.1em] text-foreground">{nodeTitle || 'Skill Module'}</h1>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold leading-none">
              {phase || 'Learning Path'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
           {/* Stats Chips */}
           <div className="flex gap-2">
              <CreditsBadge />
              <div className="px-4 py-2 rounded-full bg-white/60 backdrop-blur border border-slate-200/50 shadow-sm flex items-center gap-2 text-slate-800">
                 <LightningBoltIcon className="text-amber-500 w-4 h-4" />
                 <span className="text-sm font-bold font-mono">{streak}</span>
              </div>
              <div className="px-4 py-2 rounded-full bg-white/60 backdrop-blur border border-slate-200/50 shadow-sm flex items-center gap-2 text-slate-800">
                 <StarIcon className="text-accent w-4 h-4" />
                 <span className="text-sm font-bold font-mono">{attempts}</span>
              </div>
           </div>
        </div>
      </header>

      {/* Bento Grid Main Layout */}
      <main className="flex-1 relative z-10 max-w-[1400px] w-full mx-auto p-4 md:p-6 pb-8">
        <div className="w-full h-full grid grid-cols-1 lg:grid-cols-[380px_1fr_280px] gap-6 xl:gap-8">
          
          {/* Left Bento: Avatar/Coach */}
          <motion.aside 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="hidden lg:block w-full h-[calc(100vh-120px)] sticky top-24"
          >
            <AvatarTile characterImg={characterImg} characterQuote={characterQuote || '...'} mode={mode} characterBg={characterBg} emotion={emotion} affect={affect} />
          </motion.aside>

          {/* Center Bento: Interactive Content / Transcript */}
          <motion.section 
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className="relative flex flex-col bg-white rounded-[2.5rem] border border-slate-200/60 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] overflow-hidden h-[calc(100vh-120px)]"
          >
            <div className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth">
               {children}
            </div>
          </motion.section>

          {/* Right Bento: Dynamic Stats / Mastery / Context */}
          <motion.aside 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="hidden xl:flex flex-col gap-6 h-[calc(100vh-120px)] sticky top-24"
          >
            {/* Mastery Card */}
            <div className="bg-white rounded-[2rem] p-6 border border-slate-200/60 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                  <TargetIcon className="text-accent w-4 h-4" />
                  Mastery
                </div>
                <span className="text-xs font-mono font-bold text-slate-800">{Math.round(mastery * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden p-[1px] border border-slate-200/50">
                 <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${mastery * 100}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-accent rounded-full"
                 />
              </div>
            </div>

            {/* Empty space for future bento extensions or Session Recap */}
            <div className="flex-1 rounded-[2rem] border border-dashed border-slate-200/80 bg-slate-50/50 flex items-center justify-center p-6 text-center">
               <p className="text-xs text-slate-400 font-medium">Context Analysis &amp; Memory Stream (Phase 2)</p>
            </div>
          </motion.aside>

        </div>
      </main>
    </div>
  );
};

