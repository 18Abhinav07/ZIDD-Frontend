"use client";

import { useEffect, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import { Lightbulb, X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { getAvatarScaleFactor } from '@/lib/avatarRegistry';
import { getSchoolAvatarTheme } from '@/lib/schoolTheme';
import type { SchoolCoachHint, SchoolCoachTone } from '@/lib/schoolTeachingPresentation';
import {
  resolveSchoolCoachIdentity,
  useSchoolShellCoachIdentity,
} from '@/components/school/shell/SchoolCoachIdentityContext';
import styles from './SchoolCoachPanel.module.css';

type SchoolCoachVariant = 'immersive' | 'supporting' | 'inline';
type HintState = 'available' | 'open' | 'dismissed';

interface SchoolCoachPanelProps {
  avatarId: string | null | undefined;
  paletteId: string | null | undefined;
  status: string;
  note: string;
  hint?: SchoolCoachHint | null;
  tone?: SchoolCoachTone;
  compact?: boolean;
  variant?: SchoolCoachVariant;
}

export function SchoolCoachPanel({
  avatarId,
  paletteId,
  status,
  note,
  hint = null,
  tone = 'neutral',
  compact = false,
  variant = 'supporting',
}: SchoolCoachPanelProps) {
  const reduceMotion = useReducedMotion();
  const shellIdentity = useSchoolShellCoachIdentity();
  const coachIdentity = resolveSchoolCoachIdentity({ avatarId, paletteId }, shellIdentity);
  const theme = getSchoolAvatarTheme(coachIdentity.avatarId, coachIdentity.paletteId);
  const { avatar } = theme;
  const avatarScale = getAvatarScaleFactor(avatar.url);
  const immersiveAvatarScale = variant === 'immersive' ? avatarScale * 1.26 : avatarScale;
  const avatarStyle = {
    '--school-avatar-scale': String(immersiveAvatarScale),
    '--school-avatar-mobile-scale': String(Math.min(avatarScale, 1.12)),
  } as CSSProperties;
  const hintKey = hint?.key ?? null;
  const [hintState, setHintState] = useState<HintState>(hint ? 'available' : 'dismissed');

  useEffect(() => {
    setHintState(hintKey ? 'available' : 'dismissed');
  }, [hintKey]);

  if (variant === 'inline') {
    return (
      <div className={styles.inline} style={theme.style}>
        <div className={styles.inlinePortrait}>
          <Image
            src={avatar.url}
            alt="Zidd school coach"
            fill
            sizes="72px"
            className={styles.inlineImage}
            priority
          />
        </div>
        <div className={styles.inlineCopy}>
          <p className={styles.inlineStatus}>{status}</p>
          <p className={styles.inlineNote}>{note}</p>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className={styles.compact}
        style={theme.style}
        aria-label={`Coach status: ${status}. ${note}`}
      >
        <Image
          src={avatar.url}
          alt="Zidd school coach"
          fill
          sizes="44px"
          className={styles.compactImage}
          priority
        />
      </div>
    );
  }

  const showHintPrompt = Boolean(hint && hintState === 'available');
  const showHint = Boolean(hint && hintState === 'open');

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.36, ease: [0.16, 1, 0.3, 1] }}
      className={`${styles.panel} ${variant === 'immersive' ? styles.immersive : styles.supporting}`}
      style={theme.style}
      data-coach-tone={tone}
    >
      <div className={`${styles.portrait} ${variant === 'immersive' ? styles.immersivePortrait : ''}`}>
        <div className={styles.status}>
          <span className={styles.statusDot} aria-hidden="true" />
          <span>{status}</span>
        </div>
        <span className={styles.coachGhost} aria-hidden="true">COACH</span>
        <Image
          src={avatar.url}
          alt="Your Zidd School coach"
          fill
          sizes="(max-width: 820px) 132px, 320px"
          className={styles.avatar}
          style={avatarStyle}
          priority
        />
      </div>

      <div className={styles.dialogue} data-testid="school-coach-dialogue">
        <p className={styles.coachLabel}>Your coach</p>

        <div className={styles.noteRow} role="status" aria-live={tone === 'neutral' ? 'off' : 'polite'}>
          <p className={styles.note}>{note}</p>
          {hint && hintState === 'dismissed' ? (
            <button
              type="button"
              className={styles.hintReopen}
              onClick={() => setHintState('open')}
              aria-label="Open hint"
              title="Open hint"
            >
              <Lightbulb size={17} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {showHintPrompt ? (
          <button
            type="button"
            className={`${styles.hintPrompt} ${reduceMotion ? '' : styles.hintPulse}`}
            onClick={() => setHintState('open')}
            aria-expanded="false"
            aria-controls="school-coach-hint"
          >
            <Lightbulb size={18} aria-hidden="true" />
            <span>I&apos;ve got a hint for you</span>
          </button>
        ) : null}

        {showHint && hint ? (
          <div id="school-coach-hint" className={styles.hintBody} role="status" aria-live="polite">
            <button
              type="button"
              className={styles.hintClose}
              onClick={() => setHintState('dismissed')}
              aria-label="Close hint"
              title="Close hint"
            >
              <X size={16} aria-hidden="true" />
            </button>
            <Lightbulb className={styles.hintIcon} size={18} aria-hidden="true" />
            <p>{hint.text}</p>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
