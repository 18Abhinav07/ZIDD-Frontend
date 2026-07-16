"use client";

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { ChevronRight, LogOut, Menu, UserRound, X } from 'lucide-react';
import type { SchoolCoachIdentity } from '@/services/schoolRebuild';
import styles from '../SchoolSurface.module.css';
import { SchoolShellCoachIdentityContext } from './SchoolCoachIdentityContext';

interface SchoolShellProps extends Partial<SchoolCoachIdentity> {
  children: ReactNode;
}

const SCHOOL_NAV = [
  { label: 'Home', href: '/school', section: 'home' },
  { label: 'Starting point', href: '/school/placement', section: 'placement' },
  { label: 'My path', href: '/school/curriculum', section: 'path' },
  { label: 'Reports', href: '/school/reports', section: 'reports' },
] as const;

function currentSection(pathname: string) {
  if (pathname.startsWith('/school/placement') || pathname.startsWith('/school/readiness')) return 'placement';
  if (pathname.startsWith('/school/reports') || pathname.startsWith('/school/parent')) return 'reports';
  if (
    pathname.startsWith('/school/classes')
    || pathname.startsWith('/school/session')
    || pathname.startsWith('/school/recap')
    || pathname.startsWith('/school/masterclass')
    || pathname.startsWith('/school/support')
    || pathname.startsWith('/school/curriculum')
  ) return 'path';
  return 'home';
}

function surfaceLabel(pathname: string) {
  if (pathname.startsWith('/school/onboarding')) return 'Setup';
  if (pathname.startsWith('/school/placement/report')) return 'Starting-point report';
  if (pathname.startsWith('/school/placement')) return 'Starting point';
  if (pathname.startsWith('/school/classes') && pathname.includes('/chapters/')) return 'Chapter map';
  if (pathname.startsWith('/school/classes')) return 'Class journey';
  if (pathname.startsWith('/school/session')) return 'Tutor';
  if (pathname.startsWith('/school/recap')) return 'Foundation recap';
  if (pathname.startsWith('/school/masterclass')) return 'Focused practice';
  if (pathname.startsWith('/school/support')) return 'Support plan';
  if (pathname.startsWith('/school/parent')) return 'Parent report';
  if (pathname.startsWith('/school/reports')) return 'Learner report';
  return 'Home';
}

export function SchoolShell({ children, coach_avatar_id, coach_palette_id }: SchoolShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: authSession } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const section = currentSection(pathname);
  const coachIdentity = useMemo(() => ({
    coach_avatar_id: coach_avatar_id ?? null,
    coach_palette_id: coach_palette_id ?? null,
  }), [coach_avatar_id, coach_palette_id]);
  const profileImage = authSession?.user?.image ?? null;

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  return (
    <div className={styles.surface} data-school-surface="canonical">
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.brandLockup}>
            <Link className={styles.wordmark} href="/school" aria-label="Zidd School Prep home">
              ZIDD<span className={styles.wordmarkDot}>.</span>
            </Link>
            <span className={styles.brandDivider} aria-hidden="true" />
            <span className={styles.productName}>School Prep</span>
          </div>
          <div className={styles.surfaceIndicator} aria-label={`Current School surface: ${surfaceLabel(pathname)}`}>
            <span>{surfaceLabel(pathname)}</span>
          </div>
        </div>

        <div className={styles.headerActions}>
          <nav className={styles.nav} aria-label="School Prep navigation">
            {SCHOOL_NAV.map((item) => (
              <Link
                key={item.section}
                href={item.href}
                prefetch={false}
                className={styles.navLink}
                aria-current={section === item.section ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <button
            type="button"
            className={styles.profileButton}
            onClick={() => router.push('/profile')}
            aria-label="Open profile"
            title="Profile"
          >
            {profileImage ? (
              <Image
                src={profileImage}
                alt="Profile"
                fill
                sizes="38px"
                className={styles.profileImage}
              />
            ) : (
              <UserRound size={18} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className={styles.signOutButton}
            aria-label="Sign out"
            title="Sign out"
            onClick={() => void signOut({ callbackUrl: '/auth/login' })}
          >
            <LogOut size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.menuButton}
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close School menu' : 'Open School menu'}
            aria-expanded={menuOpen}
            aria-controls="school-mobile-menu"
          >
            {menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>

          {menuOpen ? (
            <nav id="school-mobile-menu" className={styles.mobileMenu} aria-label="School Prep mobile navigation">
              {SCHOOL_NAV.map((item) => (
                <Link
                  key={item.section}
                  href={item.href}
                  prefetch={false}
                  className={styles.mobileLink}
                  aria-current={section === item.section ? 'page' : undefined}
                >
                  <span>{item.label}</span>
                  <ChevronRight size={16} aria-hidden="true" />
                </Link>
              ))}
              <button type="button" className={styles.mobileCommand} onClick={() => router.push('/profile')}>
                <span>Profile</span>
                <UserRound size={17} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.mobileCommand}
                onClick={() => void signOut({ callbackUrl: '/auth/login' })}
              >
                <span>Sign out</span>
                <LogOut size={17} aria-hidden="true" />
              </button>
            </nav>
          ) : null}
        </div>
      </header>
      <SchoolShellCoachIdentityContext.Provider value={coachIdentity}>
        <div className={styles.content}>{children}</div>
      </SchoolShellCoachIdentityContext.Provider>
    </div>
  );
}
