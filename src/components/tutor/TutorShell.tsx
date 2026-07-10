"use client";

import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAvatarScaleClass } from '@/lib/avatarRegistry';
import { getEmotionTreatment, getAffectSupportNote } from '@/lib/emotion';
import type { DoneFrame } from '@/types';
import {
  ChevronLeftIcon,
  MagicWandIcon,
  StarIcon,
  ExitIcon,
} from '@radix-ui/react-icons';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CreditsBadge } from '@/components/billing/CreditsBadge';
import { AVATAR_PATHS } from '@/lib/avatarRegistry';
import { signOut, useSession } from 'next-auth/react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TutorShellProps {
  children: React.ReactNode;
  nodeTitle?: string;
  mastery: number;
  phase?: string;
  mode?: 'professional' | 'gamified';
  onBack: () => void;
  characterImg?: string;
  characterBg?: string;
  emotion?: DoneFrame['avatar_emotion'];
  affect?: DoneFrame['affect'];
  statusLabel?: string;
}

const AvatarTile = memo(function AvatarTile({ characterImg, mode, characterBg, emotion, affect, statusLabel }: { characterImg?: string, mode: string, characterBg?: string, emotion?: DoneFrame['avatar_emotion'], affect?: DoneFrame['affect'], statusLabel?: string }) {
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
          key={`${emotion ?? 'neutral'}:${statusLabel ?? ''}`}
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
            {statusLabel ?? treatment.label}
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

      <AnimatePresence>
        {supportNote && (
          <motion.div
            key={supportNote}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="mt-auto w-full rounded-xl border border-white/50 bg-white/85 p-4 text-sm font-medium leading-relaxed text-slate-600 shadow-sm relative z-20"
          >
            {supportNote}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export const TutorShell: React.FC<TutorShellProps> = ({
  children,
  nodeTitle,
  mastery,
  phase,
  mode = 'gamified',
  onBack,
  characterImg,
  characterBg,
  emotion,
  affect,
  statusLabel
}) => {
  const router = useRouter();
  const { data: authSession } = useSession();
  const handleSignOut = () => signOut({ callbackUrl: '/auth/login' });
  const profileImage = authSession?.user?.image || AVATAR_PATHS.casual_male;
  const progressLabel = mode === 'professional' ? 'Readiness' : 'Mastery';

  return (
    <div className={cn("relative h-[100dvh] w-full overflow-hidden flex flex-col font-body bg-background transition-colors duration-500", mode === 'professional' ? 'mode-professional' : 'mode-gamified')}>
      <div className="grain-overlay" />

      {/* Header - Minimalist */}
      <header className="relative z-20 shrink-0 px-3 sm:px-6 py-4 sm:py-5 flex justify-between items-center gap-3 max-w-[1400px] w-full mx-auto">
        <div className="min-w-0 flex flex-1 items-center gap-2 sm:gap-4">
          <div className="hidden sm:block font-sans font-black text-xl tracking-tighter text-foreground" aria-label="Zidd">
            ZIDD<span className="text-indigo-600">.</span>
          </div>

          <div className="hidden sm:block h-5 w-px bg-white/30" />

          <button
            onClick={onBack}
            aria-label="Leave session"
            title="Leave session"
            className="flex w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/50 backdrop-blur-md border border-slate-200/50 items-center justify-center hover:bg-white transition-all active:scale-95 text-slate-700 shadow-sm"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
               <MagicWandIcon className="hidden sm:block text-accent w-4 h-4" />
               <h1 className="line-clamp-2 text-xs sm:text-sm font-bold uppercase tracking-[0.1em] leading-tight text-foreground">{nodeTitle || 'Skill Module'}</h1>
            </div>
            <p className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground font-bold leading-none">
              <span className="truncate">{phase || 'Learning Path'}</span>
              {statusLabel && (
                <span className="lg:hidden inline-flex items-center gap-1.5 text-accent">
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {statusLabel}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2 sm:gap-3">
           {/* Stats Chips */}
           <div className="flex gap-2">
              <div className="hidden sm:block"><CreditsBadge /></div>
              <div className="flex px-2.5 sm:px-3 py-2 rounded-full bg-white/60 backdrop-blur border border-slate-200/50 shadow-sm items-center gap-1.5 sm:gap-2 text-slate-700" title={`${progressLabel}: ${Math.round(mastery * 100)}%`}>
                 <StarIcon className="text-accent w-4 h-4" />
                 <span className="hidden sm:inline text-xs font-semibold">{progressLabel}</span>
                 <span className="text-xs font-mono font-semibold tabular-nums">{Math.round(mastery * 100)}%</span>
              </div>
           </div>
           <button
             onClick={() => router.push('/profile')}
             aria-label="Profile"
             title="Profile"
             className="hidden sm:block relative w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 shadow-sm overflow-hidden hover:scale-105 active:scale-95 transition-all"
           >
             <Image
               src={profileImage}
               alt="Profile"
               fill
               sizes="40px"
               className="object-cover object-top scale-[1.2] translate-y-1"
               unoptimized
             />
           </button>
           <button
             onClick={handleSignOut}
             title="Sign out"
             className="w-10 h-10 rounded-full bg-white/50 backdrop-blur-md border border-slate-200/50 shadow-sm text-slate-600 flex items-center justify-center hover:bg-white hover:text-red-500 transition-all active:scale-95"
           >
             <ExitIcon className="w-4 h-4" />
           </button>
        </div>
      </header>

      {/* Bento Grid Main Layout */}
      <main className="flex-1 min-h-0 overflow-hidden relative z-10 max-w-[1400px] w-full mx-auto p-3 sm:p-4 md:p-6">
	        <div className="w-full h-full min-h-0 grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-6 xl:gap-8">
          
          {/* Left Bento: Avatar/Coach */}
          <motion.aside 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="hidden lg:block w-full h-full min-h-0"
          >
	            <AvatarTile characterImg={characterImg} mode={mode} characterBg={characterBg} emotion={emotion} affect={affect} statusLabel={statusLabel} />
          </motion.aside>

          {/* Center Bento: Interactive Content / Transcript */}
          <motion.section 
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className="relative flex h-full min-h-0 flex-col overflow-hidden bg-white sm:rounded-[2.5rem] border border-slate-200/60 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]"
          >
            <div className="flex-1 min-h-0 overflow-hidden">
               {children}
            </div>
          </motion.section>

        </div>
      </main>
    </div>
  );
};
