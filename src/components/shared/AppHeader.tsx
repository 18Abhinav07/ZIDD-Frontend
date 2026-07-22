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
import { homeForMe, myPathForMe, type MeResponse } from '@/services/me';
import { useAppSession } from '@/components/shared/AppSessionProvider';

interface AppHeaderProps {
  title?: string;
  // An in-app back affordance (preferred over the browser back button).
  onBack?: () => void;
  backLabel?: string;
  showCredits?: boolean;
  appearance?: 'default' | 'school';
  navigation?: readonly AppHeaderNavItem[];
  brandHref?: string;
  position?: 'fixed' | 'sticky';
}

export interface AppHeaderNavItem {
  key: string;
  label: string;
  href: string;
  active?: boolean;
}

export function AppHeader({
  title,
  onBack,
  backLabel = 'Back',
  showCredits = true,
  appearance = 'default',
  navigation,
  brandHref,
  position = 'fixed',
}: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: authSession, status: authStatus } = useSession();
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

  const homeRoute = me ? homeForMe(me) : null;
  const onResolvedHome = pathname === '/dashboard'
    || (homeRoute != null && pathname === homeRoute)
    || (pathname === '/school' && (!me || me.onboarding.primary_motive === 'school'))
    || (pathname === '/career' && (!me || me.onboarding.primary_motive === 'career'));
  const authenticated = authStatus === 'authenticated';
  const schoolControls = appearance === 'school';
  const profileImage = authSession?.user?.image || null;
  const profileInitial = (authSession?.user?.name || authSession?.user?.email || 'Z')
    .trim()
    .slice(0, 1)
    .toUpperCase();
  const profileControlClass = 'rounded-full border-slate-200 bg-slate-50 shadow-sm hover:scale-105 active:scale-95';
  const utilityControlClass = 'rounded-full bg-slate-50 hover:bg-slate-100 hover:scale-105 active:scale-95';
  const defaultNavigation = [
    { key: 'home', label: 'Home', href: homeRoute ?? '/dashboard', active: onResolvedHome },
    {
      key: 'path',
      label: 'My Path',
      href: me ? myPathForMe(me) : '/map',
      active: pathname === '/map' || pathname.startsWith('/map/') || pathname.startsWith('/session/'),
    },
  ] satisfies readonly AppHeaderNavItem[];
  const navItems = navigation ?? defaultNavigation;

  const navigateRoute = (item: AppHeaderNavItem) => {
    if (pendingNav || item.active || pathname === item.href) return;
    setPendingNav(item.key);
    router.push(item.href);
  };

  const navigateBrand = () => {
    if (brandHref) {
      navigateRoute({ key: 'brand', label: 'Home', href: brandHref, active: pathname === brandHref });
      return;
    }
    void navigateFromProfile('home', homeForMe);
  };

  return (
    <header className={`${position === 'sticky' ? 'sticky' : 'fixed'} top-0 inset-x-0 z-50 border-b border-slate-200/60 bg-white/90 backdrop-blur-xl`}>
      <div className="mx-auto grid h-16 max-w-[1400px] grid-cols-[minmax(0,1fr)_auto] items-center gap-5 px-5 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:px-12">
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
              onClick={navigateBrand}
              disabled={pendingNav !== null || (brandHref ? pathname === brandHref : onResolvedHome)}
              aria-disabled={pendingNav !== null || (brandHref ? pathname === brandHref : onResolvedHome)}
              className="font-sans text-xl font-black text-slate-900 disabled:cursor-default disabled:opacity-70"
            >
              ZIDD<span className="text-indigo-600">.</span>
            </button>
          )}
          {title && (
            <>
              <div className="h-5 w-px bg-slate-200 hidden sm:block" />
              <span className="hidden truncate text-sm font-semibold text-slate-500 sm:block">{title}</span>
            </>
          )}
        </div>

        {authenticated ? (
          <nav className="hidden items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 p-1 md:flex" aria-label={title ? `${title} navigation` : 'Primary navigation'}>
            {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => navigateRoute(item)}
              disabled={pendingNav !== null}
              aria-current={item.active ? 'page' : undefined}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-medium transition-[background-color,border-color,color,box-shadow] disabled:cursor-default disabled:opacity-50 ${item.active
                ? 'border border-zinc-200 bg-white text-zinc-900 shadow-sm'
                : 'border border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {pendingNav === item.key && (schoolControls
                ? <span className="h-2.5 w-5 animate-pulse rounded-full bg-slate-200" aria-hidden="true" />
                : <Loader2 className="h-3 w-3 animate-spin" />)}
              {item.label}
            </button>
            ))}
          </nav>
        ) : <span />}

        <nav className="col-start-2 flex items-center justify-self-end gap-3 md:col-start-3" aria-label="Account navigation">
          {authenticated && showCredits && <CreditsBadge />}
          {authenticated && <button
            onClick={navigateProfile}
            disabled={pendingNav !== null}
            title="Profile"
            className={`relative hidden h-9 w-9 overflow-hidden border disabled:opacity-50 md:block transition-all ${profileControlClass}`}
          >
            {pendingNav === 'profile' ? (
              schoolControls
                ? <span className="absolute inset-1 animate-pulse rounded-full bg-indigo-100" aria-hidden="true" />
                : <Loader2 className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 animate-spin text-indigo-600" />
            ) : (
              profileImage ? (
                <Image
                  src={profileImage}
                  alt="Profile"
                  fill
                  sizes="36px"
                  className="object-cover object-top scale-[1.2] translate-y-1"
                />
              ) : (
                <span className="absolute inset-0 grid place-items-center text-xs font-semibold text-slate-700">
                  {profileInitial}
                </span>
              )
            )}
          </button>}
          {authenticated && <button
            onClick={handleSignOut}
            title="Sign out"
            className={`hidden h-9 w-9 items-center justify-center border border-slate-200 text-slate-500 transition-all hover:text-red-500 md:flex ${utilityControlClass}`}
          >
            <ExitIcon className="w-4 h-4" />
          </button>}
          {/* Mobile menu toggle */}
          {authenticated && <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className={`flex h-11 w-11 items-center justify-center border-0 text-slate-600 transition-colors md:hidden ${utilityControlClass}`}
          >
            {menuOpen ? <Cross1Icon className="w-4 h-4" /> : <HamburgerMenuIcon className="w-4 h-4" />}
          </button>}
        </nav>
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {authenticated && menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="border-t border-slate-200/60 bg-white/95 px-5 py-3 backdrop-blur-xl md:hidden"
          >
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => { setMenuOpen(false); navigateRoute(item); }}
                disabled={pendingNav !== null}
                aria-current={item.active ? 'page' : undefined}
                className={`w-full border-b border-slate-100 py-3 text-left text-[14px] font-medium transition-colors last:border-0 disabled:cursor-default disabled:opacity-50 ${item.active ? 'text-indigo-700' : 'text-slate-600 hover:text-indigo-600'}`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => { setMenuOpen(false); navigateProfile(); }}
              disabled={pendingNav !== null}
              className="w-full border-b border-slate-100 py-3 text-left text-[14px] font-medium text-slate-600 transition-colors hover:text-indigo-600 disabled:opacity-50"
            >
              Profile
            </button>
            <button
              onClick={() => { setMenuOpen(false); handleSignOut(); }}
              className="mt-1 flex w-full items-center gap-2 py-3 text-left text-[14px] font-medium text-red-500 transition-colors hover:text-red-600"
            >
              <ExitIcon className="w-4 h-4" /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
