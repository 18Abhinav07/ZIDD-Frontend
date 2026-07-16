"use client";

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { getAvatarScaleClass } from '@/lib/avatarRegistry';
import { getSchoolAvatarTheme } from '@/lib/schoolTheme';
import {
  resolveSchoolCoachIdentity,
  useSchoolShellCoachIdentity,
} from '@/components/school/shell/SchoolCoachIdentityContext';

type SchoolCoachVariant = 'immersive' | 'supporting' | 'inline';

interface SchoolCoachPanelProps {
  avatarId: string | null | undefined;
  paletteId: string | null | undefined;
  status: string;
  note: string;
  compact?: boolean;
  variant?: SchoolCoachVariant;
}

export function SchoolCoachPanel({
  avatarId,
  paletteId,
  status,
  note,
  compact = false,
  variant = 'supporting',
}: SchoolCoachPanelProps) {
  const reduceMotion = useReducedMotion();
  const shellIdentity = useSchoolShellCoachIdentity();
  const coachIdentity = resolveSchoolCoachIdentity({ avatarId, paletteId }, shellIdentity);
  const theme = getSchoolAvatarTheme(coachIdentity.avatarId, coachIdentity.paletteId);
  const { avatar } = theme;

  if (variant === 'inline') {
    return (
      <div className="flex min-w-0 items-center gap-3 text-[var(--school-ink)]" style={theme.style}>
        <div className="relative h-12 w-12 flex-none overflow-hidden rounded-xl border border-[var(--school-accent-border)] bg-[var(--school-accent-soft)]">
          <Image
            src={avatar.url}
            alt="Zidd school coach"
            fill
            sizes="48px"
            className="origin-bottom scale-[1.12] object-contain object-bottom"
            priority
          />
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-mono text-[9px] font-semibold uppercase text-[var(--school-accent-deep)]">
            <span className="h-1.5 w-1.5 flex-none rounded-full bg-[var(--school-accent)]" aria-hidden="true" />
            <span className="truncate">{status}</span>
          </p>
          <p className="mt-1 break-words text-xs font-medium leading-5 text-[var(--school-muted)]">{note}</p>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className="relative h-11 w-11 flex-none overflow-hidden rounded-xl border border-[var(--school-accent-border)] bg-[var(--school-accent-soft)]"
        style={theme.style}
        aria-label={`Coach status: ${status}`}
      >
        <Image
          src={avatar.url}
          alt="Zidd school coach"
          fill
          sizes="44px"
          className="object-contain object-bottom scale-[1.12] origin-bottom"
          priority
        />
      </div>
    );
  }

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`flex h-full min-w-0 flex-col text-[var(--school-ink)] ${
        variant === 'immersive' ? 'border-r border-[var(--school-line)] pr-6' : 'rounded-2xl border border-[var(--school-line)] bg-[var(--school-paper)] p-5'
      }`}
      style={theme.style}
    >
      <div className={`relative w-full overflow-hidden border border-[var(--school-accent-border)] bg-[var(--school-accent-soft)] ${
        variant === 'immersive' ? 'aspect-[4/5] rounded-[34px]' : 'aspect-[5/4] rounded-2xl'
      }`}>
        <div className="absolute left-3 top-3 z-20 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-lg border border-[var(--school-accent-border)] bg-[var(--school-paper)] px-2.5 py-1.5 text-[var(--school-accent-deep)]">
          <span className="h-1.5 w-1.5 flex-none rounded-full bg-[var(--school-accent)]" />
          <span className="truncate font-mono text-[9px] font-semibold uppercase">{status}</span>
        </div>
        <Image
          src={avatar.url}
          alt="Zidd school coach"
          fill
          sizes="(max-width: 820px) 0px, 244px"
          className={`object-contain object-bottom drop-shadow-[0_18px_22px_rgba(18,26,45,0.16)] ${getAvatarScaleClass(avatar.url)}`}
          priority
        />
      </div>

      <div className={variant === 'immersive' ? 'pt-6' : 'pt-4'}>
        <p className="font-mono text-[10px] font-semibold uppercase text-[var(--school-accent-deep)]">Your coach</p>
        <p className="mt-3 break-words text-sm font-medium leading-6 text-[var(--school-muted)]">{note}</p>
      </div>
    </motion.div>
  );
}
