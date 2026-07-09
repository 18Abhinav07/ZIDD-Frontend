"use client";

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ExitIcon, ChevronLeftIcon, HamburgerMenuIcon, Cross1Icon
} from '@radix-ui/react-icons';
import { Loader2 } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { CreditsBadge } from '@/components/billing/CreditsBadge';
import Image from 'next/image';
import { AVATAR_PATHS } from '@/lib/avatarRegistry';
import { homeForMe, myPathForMe, type MeResponse } from '@/services/me';
import { useAppSession } from '@/components/shared/AppSessionProvider';

interface AppHeaderProps {
  title?: string;
  // An in-app back affordance (preferred over the browser back button).
  onBack?: () => void;
  backLabel?: string;
  showCredits?: boolean;
}

export function AppHeader({ title, onBack, backLabel = 'Back', showCredits = true }: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: authSession } = useSession();
  const { me, loadMe } = useAppSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingNav, setPendingNav] = useState<string | null>(null);

  useEffect(() => {
    setPendingNav(null);
  }, [pathname]);

  const handleSignOut = () => signOut({ callbackUrl: '/auth/login' });

  const navigateFromProfile = async (
    key: string,
    destination: (me: MeResponse) => string
  ) => {
    if (pendingNav) return;
    setPendingNav(key);
    try {
      const profile = me ?? await loadMe();
      const target = destination(profile);
      if (target === pathname) {
        setPendingNav(null);
        return;
      }
      router.push(target);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      if (message === 'Unauthorized') {
        router.push('/auth/login');
        return;
      }
      if (me) {
        router.push(destination(me));
        return;
      }
      setPendingNav(null);
    }
  };

  const navigateProfile = () => {
    if (pendingNav) return;
    setPendingNav('profile');
    if (pathname === '/profile') {
      setPendingNav(null);
      return;
    }
    router.push('/profile');
  };

  const NAV: { key: string; label: string; go: () => void | Promise<void> }[] = [
    { key: 'home', label: 'Home', go: () => navigateFromProfile('home', homeForMe) },
    { key: 'path', label: 'My Path', go: () => navigateFromProfile('path', myPathForMe) },
  ];
  const homeRoute = me ? homeForMe(me) : null;
  const onResolvedHome = pathname === '/dashboard'
    || (homeRoute != null && pathname === homeRoute)
    || (pathname === '/subjects' && (!me || me.onboarding.primary_motive === 'school'))
    || (pathname === '/career' && (!me || me.onboarding.primary_motive === 'career'));
  const profileImage = authSession?.user?.image || AVATAR_PATHS.casual_male;

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
              onClick={() => navigateFromProfile('home', homeForMe)}
              disabled={pendingNav !== null || onResolvedHome}
              aria-disabled={pendingNav !== null || onResolvedHome}
              className="font-sans font-black text-xl tracking-tighter text-slate-900 disabled:cursor-default disabled:opacity-70"
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
              key={item.key}
              onClick={item.go}
              disabled={pendingNav !== null || (item.key === 'home' && onResolvedHome)}
              aria-current={item.key === 'home' && onResolvedHome ? 'page' : undefined}
              className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-default transition-colors"
            >
              {pendingNav === item.key && <Loader2 className="h-3 w-3 animate-spin" />}
              {item.label}
            </button>
          ))}
          <button
            onClick={navigateProfile}
            disabled={pendingNav !== null}
            title="Profile"
            className="hidden sm:block relative w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 shadow-sm overflow-hidden hover:scale-105 active:scale-95 disabled:opacity-50 transition-all"
          >
            {pendingNav === 'profile' ? (
              <Loader2 className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 animate-spin text-indigo-600" />
            ) : (
              <Image
                src={profileImage}
                alt="Profile"
                fill
                sizes="36px"
                className="object-cover object-top scale-[1.2] translate-y-1"
                unoptimized
              />
            )}
          </button>
          <button
            onClick={handleSignOut}
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
                key={item.key}
                onClick={() => { setMenuOpen(false); item.go(); }}
                disabled={pendingNav !== null || (item.key === 'home' && onResolvedHome)}
                aria-current={item.key === 'home' && onResolvedHome ? 'page' : undefined}
                className="w-full text-left py-3 text-[13px] font-bold uppercase tracking-[0.15em] text-slate-600 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-default transition-colors border-b border-slate-100 last:border-0"
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => { setMenuOpen(false); navigateProfile(); }}
              disabled={pendingNav !== null}
              className="w-full text-left py-3 text-[13px] font-bold uppercase tracking-[0.15em] text-slate-600 hover:text-indigo-600 disabled:opacity-50 transition-colors border-b border-slate-100"
            >
              Profile
            </button>
            <button
              onClick={() => { setMenuOpen(false); handleSignOut(); }}
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
