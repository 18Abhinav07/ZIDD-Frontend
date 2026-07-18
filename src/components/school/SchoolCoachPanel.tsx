"use client";

import { useEffect, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import { Lightbulb, X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { getAvatarScaleFactor } from '@/lib/avatarRegistry';
import { getSchoolAvatarTheme } from '@/lib/schoolTheme';
import type { SchoolCoachHint, SchoolCoachTone } from '@/lib/schoolTeachingPresentation';
import { useResolvedSchoolCoachIdentity } from '@/components/school/shell/SchoolCoachIdentityContext';
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
  const coachIdentity = useResolvedSchoolCoachIdentity({ avatarId, paletteId });
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

  const showHint = Boolean(hint && hintState === 'open');
  const showHintButton = Boolean(hint && !showHint);

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

        {showHintButton ? (
          <button
            type="button"
            className={styles.hintToggle}
            onClick={() => setHintState('open')}
            aria-label="Show coach hint"
            title="Show hint"
            aria-expanded="false"
            aria-controls="school-coach-hint"
          >
            <Lightbulb size={17} aria-hidden="true" />
          </button>
        ) : null}

        {showHint ? (
          <button
            type="button"
            className={styles.hintClose}
            onClick={() => setHintState('dismissed')}
            aria-label="Close coach hint"
            title="Close hint"
            aria-expanded="true"
            aria-controls="school-coach-hint"
          >
            <X size={15} aria-hidden="true" />
          </button>
        ) : null}

        <div className={styles.noteRow} role="status" aria-live={tone === 'neutral' ? 'off' : 'polite'}>
          <p className={styles.note}>{note}</p>
        </div>

        {showHint && hint ? (
          <div id="school-coach-hint" className={styles.hintBody} role="status" aria-live="polite">
            <p>{hint.text}</p>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
