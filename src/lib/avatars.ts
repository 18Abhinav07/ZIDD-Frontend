import { AVATAR_PATHS } from './avatarRegistry';

export interface AvatarData {
  id: string;
  url: string;
  quote: string;
  bg: string;
}

// Each coach carries a short, supportive line shown beside the avatar. Kept
// modality-neutral (no "pacing"/"before you speak" claims: the tutor reads typed
// answers, so audio-analysis copy would be a lie) and subject-agnostic, so the
// same line reads right for a Class-2 reader and an interview candidate alike.
export const COACH_AVATARS: AvatarData[] = [
  {
    id: 'stuttering_sam',
    url: AVATAR_PATHS.coach_orange,
    quote: '"Take your time. Every try shows me how to help you better."',
    bg: '#F59E0B' // Amber
  },
  {
    id: 'fluent_finn',
    url: AVATAR_PATHS.coach_green,
    quote: '"Nice work. Let\'s make that answer a little sharper together."',
    bg: '#10B981' // Green
  },
  {
    id: 'brave_bella',
    url: AVATAR_PATHS.coach_pink,
    quote: '"You\'ve got this. There are no wrong tries here, only practice."',
    bg: '#EC4899' // Pink
  },
  {
    id: 'quiet_quint',
    url: AVATAR_PATHS.coach_blue,
    quote: '"Real progress comes from practice. One small step at a time."',
    bg: '#3B82F6' // Blue
  },
  {
    id: 'tech_black',
    url: AVATAR_PATHS.tech_black,
    quote: '"Show me your reasoning. I\'m here to stretch your thinking."',
    bg: '#334155' // Slate Gray
  },
  {
    id: 'casual_purple',
    url: AVATAR_PATHS.casual_purple,
    quote: '"No need to rush. Think it over, then tell me what you\'ve got."',
    bg: '#A855F7' // Purple
  },
  {
    id: 'casual_male',
    url: AVATAR_PATHS.casual_male,
    quote: '"Lead the way. I\'m looking for clear thinking and a bit of courage."',
    bg: '#D97706' // Deep Amber
  },
  {
    id: 'casual_female',
    url: AVATAR_PATHS.casual_female,
    quote: '"Let\'s explore this together. Share whatever comes to mind."',
    bg: '#EAB308' // Yellow
  },
  {
    id: 'casual_blue',
    url: AVATAR_PATHS.casual_blue,
    quote: '"Strong foundations win. Let\'s lay the next brick."',
    bg: '#3B82F6' // Blue
  }
];

export function getRandomAvatar(): AvatarData {
  return COACH_AVATARS[Math.floor(Math.random() * COACH_AVATARS.length)];
}

// Deterministic pick for a stable seed (e.g. a session id). The tutor coach must
// NOT reshuffle on every reload — the learner bonds with one coach per session —
// so the session page seeds by id instead of getRandomAvatar(). Decorative
// surfaces (login/register/mode) keep getRandomAvatar().
export function getAvatarForSeed(seed: string): AvatarData {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COACH_AVATARS[Math.abs(hash) % COACH_AVATARS.length];
}
