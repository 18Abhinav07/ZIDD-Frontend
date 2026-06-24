"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRightIcon, LightningBoltIcon, PlusIcon } from '@radix-ui/react-icons';
import { AppHeader } from '@/components/shared/AppHeader';
import { getToken, resolveUserId } from '@/services/api';
import { getBalance, devGrantCredits, isLocalDev } from '@/services/billing';
import type { CreditsBalance } from '@/types';


const PATHS = [
  { id: 'communication', label: 'Communication' },
  { id: 'interview', label: 'Interview' },
  { id: 'group_discussion', label: 'Group Discussion' },
  { id: 'school_english', label: 'English · Class 2–5' },
];

export default function ProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState('there');
  const [balance, setBalance] = useState<CreditsBalance | null>(null);
  const [granting, setGranting] = useState(false);
  const [localActiveModule, setLocalActiveModule] = useState<string | null>(null);
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
  }, [router]);

  const activeModule = balance?.active_module || localActiveModule;

  const topUp = async () => {
    setGranting(true);
    try {
      const r = await devGrantCredits(500);
      setBalance((b) => (b ? { ...b, credits: r.credits } : b));
    } catch {
      /* endpoint is 404 outside dev */
    } finally {
      setGranting(false);
    }
  };

  const getPathDestination = (moduleId: string | null) => {
    if (!moduleId) return '/dashboard';
    if (moduleId === 'school_english') {
      const schoolClass = typeof window !== 'undefined' ? localStorage.getItem('zidd_school_class') : null;
      return schoolClass ? `/subjects/class/${schoolClass}` : '/subjects';
    }
    if ((moduleId === 'interview' || moduleId === 'group_discussion') && typeof window !== 'undefined' && localStorage.getItem('zidd_test_mode') === null) {
      return '/mode';
    }
    return '/map';
  };

  const pathHref = getPathDestination(activeModule);
  const credits = balance?.demo_unlimited ? '∞' : (balance?.credits ?? '—');
  const activeLabel = PATHS.find((p) => p.id === activeModule)?.label;
  const displayName = balance?.name?.trim() || userId;

  return (
    <div className="min-h-[100dvh] bg-[#FCFCFC] text-slate-900 font-body relative overflow-hidden flex flex-col">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-indigo-500/[0.04] rounded-full blur-[120px] pointer-events-none" />
      <AppHeader title="Profile" />

      <main className="relative z-10 max-w-[1100px] mx-auto px-6 lg:px-12 pt-28 pb-24 flex-1 w-full">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-indigo-500">Profile</span>
          <h1 className="mt-3 font-display text-5xl md:text-6xl tracking-tight leading-[1]">
            Welcome back, {displayName}.
          </h1>
          <p className="mt-4 text-slate-500 text-[15px] max-w-xl">
            Check your progress, manage credits, and resume your active path.
          </p>
        </motion.div>

        {/* Credits + resume row */}
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Wallet */}
          <div className="rounded-[1.75rem] border border-slate-200/70 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2 text-slate-400">
              <LightningBoltIcon className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Wallet</span>
            </div>
            <p className="mt-4 font-display text-5xl tracking-tight leading-none">{credits}</p>
            <p className="mt-1 text-xs text-slate-400 font-medium">credits available</p>
            {mounted && isLocalDev() && !balance?.demo_unlimited && (
              <button
                onClick={topUp}
                disabled={granting}
                className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-indigo-600 hover:text-indigo-700 disabled:opacity-50 transition-colors"
              >
                <PlusIcon className="w-3.5 h-3.5" /> {granting ? 'Adding…' : 'Add 500 (dev)'}
              </button>
            )}
          </div>

          {/* Resume / continue */}
          <button
            onClick={() => router.push(activeModule ? pathHref : '/dashboard')}
            className="group lg:col-span-2 text-left rounded-[1.75rem] border border-slate-200/70 bg-slate-900 text-white p-8 shadow-[0_4px_20px_rgba(15,23,42,0.08)] hover:shadow-[0_24px_50px_rgba(15,23,42,0.18)] hover:-translate-y-0.5 transition-all overflow-hidden relative"
          >
            <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl" />
            <span className="relative text-[10px] font-bold uppercase tracking-[0.25em] text-white/50">
              {activeModule ? 'Continue' : 'Get started'}
            </span>
            <p className="relative mt-3 font-display text-3xl md:text-4xl tracking-tight leading-tight">
              {activeModule ? `Resume ${activeLabel ?? 'your path'}` : 'Choose your first focus'}
            </p>
            <span className="relative mt-6 inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.18em] text-white/80">
              {activeModule ? 'Back to your path' : 'Start exploring'}
              <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </span>
          </button>
        </div>
      </main>
    </div>
  );
}
