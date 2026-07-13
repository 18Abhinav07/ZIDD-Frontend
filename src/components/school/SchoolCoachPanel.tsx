"use client";

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { getAvatarScaleClass } from '@/lib/avatarRegistry';
import { getSchoolAvatarTheme } from '@/lib/schoolTheme';

type SchoolCoachVariant = 'immersive' | 'supporting';

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
  const theme = getSchoolAvatarTheme(avatarId, paletteId);
  const { avatar } = theme;

  if (compact) {
    return (
      <div
        className="relative h-12 w-12 flex-none overflow-hidden rounded-2xl border border-[var(--school-accent-border)] bg-[var(--school-accent-soft)] shadow-sm"
        style={theme.style}
        aria-label={`Coach status: ${status}`}
      >
        <Image
          src={avatar.url}
          alt="Zidd school coach"
          fill
          sizes="48px"
          className="object-cover object-top scale-[1.8] origin-top translate-y-1"
          priority
          unoptimized
        />
      </div>
    );
  }

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`relative h-full overflow-hidden border border-[var(--school-accent-border)] bg-[var(--school-accent-soft)] text-slate-900 shadow-[0_24px_60px_-38px_rgba(15,23,42,0.35)] ${
        variant === 'immersive' ? 'min-h-[520px] rounded-[2.5rem]' : 'min-h-[300px] rounded-3xl'
      }`}
      style={theme.style}
    >
      <div className="absolute left-5 top-5 z-20 inline-flex items-center gap-2 rounded-full border border-[var(--school-accent-border)] bg-[var(--school-surface,#fcfdff)] px-3 py-1.5 text-[var(--school-accent-deep)] shadow-sm">
        <span className="h-2 w-2 rounded-full bg-[var(--school-accent)]" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">{status}</span>
      </div>

      <div className={`absolute inset-x-0 ${variant === 'immersive' ? 'bottom-24 top-12' : 'bottom-20 top-12'}`}>
        <Image
          src={avatar.url}
          alt="Zidd school coach"
          fill
          sizes="(max-width: 1024px) 0px, 380px"
          className={`object-contain object-bottom drop-shadow-[0_24px_38px_rgba(15,23,42,0.28)] ${getAvatarScaleClass(avatar.url)}`}
          priority
          unoptimized
        />
      </div>

      <div className="absolute inset-x-4 bottom-4 z-20 rounded-2xl border border-slate-200/80 bg-[var(--school-surface,#fcfdff)] p-4 text-slate-800 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.4)]">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--school-accent-deep)]">
          <InfoCircledIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Coach note
        </div>
        <p className="mt-2 text-sm font-semibold leading-5">{note}</p>
      </div>
    </motion.div>
  );
}
