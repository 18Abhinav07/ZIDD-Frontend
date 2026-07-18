"use client";

import { useMemo, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import type { SchoolCoachIdentity } from '@/services/schoolRebuild';
import { AppHeader, type AppHeaderNavItem } from '@/components/shared/AppHeader';
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
  if (pathname === '/school' || pathname === '/school/') return 'home';
  if (pathname.startsWith('/school/placement') || pathname.startsWith('/school/readiness')) return 'placement';
  if (pathname.startsWith('/school/reports') || pathname.startsWith('/school/parent')) return 'reports';
  if (
    pathname.startsWith('/school/classes')
    || pathname.startsWith('/school/curriculum')
  ) return 'path';
  if (
    pathname.startsWith('/school/session')
    || pathname.startsWith('/school/recap')
    || pathname.startsWith('/school/masterclass')
    || pathname.startsWith('/school/support')
  ) return 'learning';
  return null;
}

export function SchoolShell({ children, coach_avatar_id, coach_palette_id }: SchoolShellProps) {
  const pathname = usePathname();
  const section = currentSection(pathname);
  const coachIdentity = useMemo(() => ({
    coach_avatar_id: coach_avatar_id ?? null,
    coach_palette_id: coach_palette_id ?? null,
  }), [coach_avatar_id, coach_palette_id]);
  const navigation = useMemo<readonly AppHeaderNavItem[]>(() => SCHOOL_NAV.map((item) => ({
    key: item.section,
    label: item.label,
    href: item.href,
    active: section === item.section,
  })), [section]);

  return (
    <div className={styles.surface} data-school-surface="canonical">
      <AppHeader
        title="School Prep"
        appearance="school"
        showCredits={false}
        navigation={navigation}
        brandHref="/school"
        position="sticky"
      />
      <SchoolShellCoachIdentityContext.Provider value={coachIdentity}>
        <div className={styles.content}>{children}</div>
      </SchoolShellCoachIdentityContext.Provider>
    </div>
  );
}
