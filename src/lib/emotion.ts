import type { DoneFrame } from '@/types';

export type AvatarEmotion = DoneFrame['avatar_emotion'];
export type LearnerAffect = DoneFrame['affect'];

export interface EmotionTreatment {
  label: string; // short, warm mood label shown in the chip
  ring: string; // hex color for the avatar glow/ring
}

export const EMOTION_TREATMENT: Record<AvatarEmotion, EmotionTreatment> = {
  neutral: { label: 'Listening', ring: '#94a3b8' },
  engaged: { label: 'Engaged', ring: '#6366f1' },
  impressed: { label: 'Impressed', ring: '#10b981' },
  skeptical: { label: 'Considering', ring: '#f59e0b' },
  empathetic: { label: 'With you', ring: '#ec4899' },
  patient: { label: 'Patient', ring: '#0ea5e9' },
  concerned: { label: 'Checking in', ring: '#ef4444' },
};

export function getEmotionTreatment(e?: AvatarEmotion): EmotionTreatment {
  return EMOTION_TREATMENT[e ?? 'neutral'] ?? EMOTION_TREATMENT.neutral;
}

/**
 * Supportive micro-note for learner affect, phrased as encouragement rather
 * than a diagnosis. Only frustrated/confused yield a note; neutral/confident
 * intentionally yield none.
 */
export function getAffectSupportNote(a?: LearnerAffect): string | null {
  switch (a) {
    case 'frustrated':
      return 'Take your time — there’s no rush here.';
    case 'confused':
      return 'Let’s slow down and work through it together.';
    default:
      return null;
  }
}
