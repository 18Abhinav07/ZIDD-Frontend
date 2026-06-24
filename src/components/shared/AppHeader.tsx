"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ExitIcon, ChevronLeftIcon, HamburgerMenuIcon, Cross1Icon, PersonIcon
} from '@radix-ui/react-icons';
import { CreditsBadge } from '@/components/billing/CreditsBadge';
import { clearToken } from '@/services/api';
import Image from 'next/image';
import { AVATAR_PATHS } from '@/lib/avatarRegistry';

interface AppHeaderProps {
  title?: string;
  // An in-app back affordance (preferred over the browser back button).
  onBack?: () => void;
  backLabel?: string;
  showCredits?: boolean;
}

// The learner's "path" depends on their focus: the NCERT English track lives in
// the Subjects experience, every coaching module lives on the gamified map. One
// helper keeps that routing identical in the header, the dashboard, and the map.
function pathDestination(): string {
  if (typeof window === 'undefined') return '/map';
  const active = localStorage.getItem('zidd_active_module');
  if (active === 'school_english') {
    const schoolClass = localStorage.getItem('zidd_school_class');
    return schoolClass ? `/subjects/class/${schoolClass}` : '/subjects';
  }
  // For interview/GD: only force mode selection if the learner has never chosen one.
  // Once zidd_test_mode is stored, skip /mode and go straight to the map.
  if ((active === 'interview' || active === 'group_discussion') && localStorage.getItem('zidd_test_mode') === null) {
    return '/mode';
  }
  return '/map';
}

// One header for every authenticated surface, so a learner is never stranded
// without a way home or out. Logo -> dashboard, optional back, credits, sign out.
export function AppHeader({ title, onBack, backLabel = 'Back', showCredits = true }: AppHeaderProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const signOut = () => {
    clearToken();
    router.replace('/auth/login');
  };

  const NAV: { label: string; go: () => void }[] = [
    { label: 'Home', go: () => router.push('/dashboard') },
    { label: 'My Path', go: () => router.push(pathDestination()) },
  ];

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          {onBack ? (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors text-[13px] font-semibold"
            >
              <ChevronLeftIcon className="w-4 h-4" /> {backLabel}
            </button>
          ) : (
            <button
              onClick={() => router.push('/dashboard')}
              className="font-sans font-black text-xl tracking-tighter text-slate-900"
            >
              ZIDD<span className="text-indigo-600">.</span>
            </button>
          )}
          {title && (
            <>
              <div className="h-5 w-px bg-slate-200 hidden sm:block" />
              <span className="text-sm font-bold tracking-tight text-slate-500 truncate hidden sm:block">{title}</span>
            </>
          )}
        </div>

        <nav className="flex items-center gap-5">
          {showCredits && <CreditsBadge />}
          {/* Desktop nav links */}
          {NAV.map((item) => (
            <button
              key={item.label}
              onClick={item.go}
              className="hidden sm:block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 hover:text-indigo-600 transition-colors"
            >
              {item.label}
            </button>
          ))}
          <button
            onClick={() => router.push('/profile')}
            title="Profile"
            className="hidden sm:block relative w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 shadow-sm overflow-hidden hover:scale-105 active:scale-95 transition-all"
          >
            <Image 
              src={AVATAR_PATHS.casual_male}
              alt="Profile"
              fill
              sizes="36px"
              className="object-cover object-top scale-[1.2] translate-y-1"
              unoptimized
            />
          </button>
          <button
            onClick={signOut}
            title="Sign out"
            className="hidden sm:flex w-9 h-9 rounded-full bg-slate-50 border border-slate-200 shadow-sm text-slate-500 items-center justify-center hover:bg-slate-100 hover:text-red-500 transition-all hover:scale-105 active:scale-95"
          >
            <ExitIcon className="w-4 h-4" />
          </button>
          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="sm:hidden w-9 h-9 rounded-full bg-slate-50 border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-100 transition-colors"
          >
            {menuOpen ? <Cross1Icon className="w-4 h-4" /> : <HamburgerMenuIcon className="w-4 h-4" />}
          </button>
        </nav>
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="sm:hidden border-t border-slate-200/60 bg-white/95 backdrop-blur-xl px-6 py-3"
          >
            {NAV.map((item) => (
              <button
                key={item.label}
                onClick={() => { setMenuOpen(false); item.go(); }}
                className="w-full text-left py-3 text-[13px] font-bold uppercase tracking-[0.15em] text-slate-600 hover:text-indigo-600 transition-colors border-b border-slate-100 last:border-0"
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => { setMenuOpen(false); signOut(); }}
              className="w-full text-left py-3 mt-1 text-[13px] font-bold uppercase tracking-[0.15em] text-red-500 hover:text-red-600 transition-colors flex items-center gap-2"
            >
              <ExitIcon className="w-4 h-4" /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
