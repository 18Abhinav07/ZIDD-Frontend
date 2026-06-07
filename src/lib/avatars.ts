import { AVATAR_PATHS } from './avatarRegistry';

export interface AvatarData {
  id: string;
  url: string;
  quote: string;
  bg: string;
}

export const COACH_AVATARS: AvatarData[] = [
  {
    id: 'stuttering_sam',
    url: AVATAR_PATHS.coach_orange,
    quote: '"Focus on clarity. I\'m analyzing your pacing and structure."',
    bg: '#F59E0B' // Amber
  },
  {
    id: 'fluent_finn',
    url: AVATAR_PATHS.coach_green,
    quote: '"Great effort! Let\'s try to make that sentence a little bit smoother."',
    bg: '#10B981' // Green
  },
  {
    id: 'brave_bella',
    url: AVATAR_PATHS.coach_pink,
    quote: '"I am here to help! Remember to take a deep breath before you speak."',
    bg: '#EC4899' // Pink
  },
  {
    id: 'quiet_quint',
    url: AVATAR_PATHS.coach_blue,
    quote: '"Wisdom comes from practice. Let\'s review your vocabulary choices."',
    bg: '#3B82F6' // Blue
  },
  {
    id: 'tech_black',
    url: AVATAR_PATHS.tech_black,
    quote: '"Structure your logic. I will test your analytical thinking."',
    bg: '#334155' // Slate Gray
  },
  {
    id: 'casual_purple',
    url: AVATAR_PATHS.casual_purple,
    quote: '"Don\'t rush. Think deeply and respond with intention."',
    bg: '#A855F7' // Purple
  },
  {
    id: 'casual_male',
    url: AVATAR_PATHS.casual_male,
    quote: '"Take the lead. I\'m looking for confidence and initiative."',
    bg: '#D97706' // Deep Amber
  },
  {
    id: 'casual_female',
    url: AVATAR_PATHS.casual_female,
    quote: '"Let\'s brainstorm together. Share your wildest ideas!"',
    bg: '#EAB308' // Yellow
  },
  {
    id: 'casual_blue',
    url: AVATAR_PATHS.casual_blue,
    quote: '"A solid foundation is everything. Let\'s build it up!"',
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
