"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRightIcon, LightningBoltIcon, PlusIcon } from '@radix-ui/react-icons';
import { AppHeader } from '@/components/shared/AppHeader';
import { getToken, resolveUserId } from '@/services/api';
import { getBalance, devGrantCredits, isLocalDev } from '@/services/billing';
import type { CreditsBalance } from '@/types';
import Image from 'next/image';
import { ChevronRight, Target } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getRandomAvatar, COACH_AVATARS, type AvatarData } from '@/lib/avatars';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


const PATHS = [
  { id: 'communication', label: 'Communication', blurb: 'Speak and write clearly, from greetings to persuasion.' },
  { id: 'interview', label: 'Interview', blurb: 'Pitch, handle pressure, negotiate, and close strong.' },
  { id: 'group_discussion', label: 'Group Discussion', blurb: 'Stake a position, build on others, drive consensus.' },
  { id: 'school_english', label: 'English · Class 2–5', blurb: 'The full NCERT Marigold curriculum: chapters, levels, tests, and a personal tutor.' },
];

export default function DashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('there');
  const [balance, setBalance] = useState<CreditsBalance | null>(null);
  const [granting, setGranting] = useState(false);
  const [localActiveModule, setLocalActiveModule] = useState<string | null>(null);
  const [moduleAvatars, setModuleAvatars] = useState<Record<string, AvatarData>>({});
  // Gate client-only content (token/host-dependent) until after mount so the
  // first client render matches the server HTML (avoids a hydration mismatch).
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!getToken()) {
      router.replace('/auth/login');
      return;
    }
    setUserId(resolveUserId());
    setLocalActiveModule(localStorage.getItem('zidd_active_module'));
    getBalance().then(setBalance).catch(() => {});
    
    const used = new Set<string>();
    const map: Record<string, AvatarData> = {};
    PATHS.forEach((p) => {
      let a = getRandomAvatar();
      while (used.has(a.id) && used.size < COACH_AVATARS.length) { a = getRandomAvatar(); }
      used.add(a.id);
      map[p.id] = a;
    });
    setModuleAvatars(map);
  }, [router]);

  const activeModule = balance?.active_module || localActiveModule;

  const topUp = async () => {
    setGranting(true);
    try {
      const r = await devGrantCredits(500);
      setBalance((b) => (b ? { ...b, credits: r.credits } : b));
    } catch {
      /* endpoint is 404 outside dev; button is hidden there anyway */
    } finally {
      setGranting(false);
    }
  };

  const openPath = (moduleId: string) => {
    if (moduleId === 'school_english') {
      localStorage.setItem('zidd_active_module', moduleId);
      const schoolClass = localStorage.getItem('zidd_school_class');
      router.push(schoolClass ? `/subjects/class/${schoolClass}` : '/subjects');
      return;
    }
    // Stage as pending; the module is only committed (zidd_active_module) when
    // the learner confirms mode selection in /mode, or on /map mount for modules
    // that bypass the mode screen (returning communication users).
    localStorage.setItem('zidd_pending_module', moduleId);
    if (moduleId === 'interview' || moduleId === 'group_discussion') {
      router.push('/mode');
      return;
    }
    const modeSet = localStorage.getItem('zidd_test_mode') !== null;
    router.push(modeSet ? '/map' : '/mode');
  };

  // English → Subjects; interview/GD without a stored mode → mode selection; others → map.
  const modeStored = typeof window !== 'undefined' && localStorage.getItem('zidd_test_mode') !== null;
  const pathHref =
    activeModule === 'school_english'
      ? '/subjects'
      : (activeModule === 'interview' || activeModule === 'group_discussion') && !modeStored
      ? '/mode'
      : '/map';

  const credits = balance?.demo_unlimited ? '∞' : (balance?.credits ?? '—');
  const activeLabel = PATHS.find((p) => p.id === activeModule)?.label;
  // Greet by the name the coach uses (from the profile), falling back to the id.
  const displayName = balance?.name?.trim() || userId;

  return (
    <div className="min-h-[100dvh] bg-[#FCFCFC] text-slate-900 font-body relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-indigo-500/[0.04] rounded-full blur-[120px] pointer-events-none" />
      <AppHeader />

      <main className="relative z-10 max-w-[1100px] mx-auto px-6 lg:px-12 pt-28 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-indigo-500">Dashboard</span>
          <h1 className="mt-3 font-display text-5xl md:text-6xl tracking-tight leading-[1]">
            Welcome back, {displayName}.
          </h1>
          <p className="mt-4 text-slate-500 text-[15px] max-w-xl">
            Choose a focus. Every session adapts to you.
          </p>
        </motion.div>

        {/* Resume CTA — only shown after mount (localStorage is client-only) */}
        {mounted && activeModule && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="mt-10"
          >
            <button
              onClick={() => router.push(pathHref)}
              className="group w-full sm:w-auto inline-flex items-center gap-3 bg-slate-900 text-white rounded-2xl px-8 py-4 text-sm font-bold uppercase tracking-widest hover:bg-slate-800 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.15)] transition-all"
            >
              Resume {activeLabel ?? 'your path'}
              <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </motion.div>
        )}

        {/* Paths */}
        <div className="mt-12">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-4xl tracking-tight">Your focuses</h2>
          </div>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            {PATHS.map((p, i) => {
              const avatar = moduleAvatars[p.id];
              const isSelected = activeModule === p.id;
              if (!avatar) return null;

              return (
                <button
                  key={p.id}
                  onClick={() => openPath(p.id)}
                  className={cn(
                    "group relative text-left rounded-[3rem] border-transparent text-white transition-all duration-700 overflow-hidden min-h-[350px] flex flex-col justify-between p-8",
                    isSelected
                      ? "ring-4 ring-white/30 scale-[1.01] z-20"
                      : "opacity-90 hover:opacity-100 hover:-translate-y-1"
                  )}
                  style={{
                    backgroundColor: avatar.bg,
                    boxShadow: isSelected
                      ? `0 24px 50px ${avatar.bg}60`
                      : `0 10px 30px ${avatar.bg}33`,
                  }}
                >
                  {/* Avatar Graphic */}
                  <div className="absolute -bottom-10 -right-4 w-44 h-56 sm:w-64 sm:h-80 z-0 pointer-events-none transition-transform duration-700 ease-out group-hover:scale-105 group-hover:-translate-y-4">
                     <Image
                        src={avatar.url}
                        alt="Module Avatar"
                        fill
                        sizes="(max-width: 640px) 176px, 256px"
                        className="object-contain object-bottom drop-shadow-2xl"
                        unoptimized
                     />
                  </div>

                  <div className="relative z-10 max-w-[60%] sm:max-w-[200px]">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display text-3xl font-bold tracking-tight leading-tight">{p.label}</h3>
                    </div>
                    {isSelected && (
                      <span className="mb-4 inline-block text-[9px] font-bold uppercase tracking-[0.18em] text-white bg-white/20 rounded-full px-3 py-1">Active</span>
                    )}
                    <p className="text-sm leading-relaxed mb-8 font-medium text-white/80">
                      {p.blurb}
                    </p>
                  </div>

                  <div className="relative z-10 flex items-center gap-4 text-[10px] uppercase tracking-widest font-black mt-auto text-white/70">
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/10 backdrop-blur-sm">
                       Open <ArrowRightIcon className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
