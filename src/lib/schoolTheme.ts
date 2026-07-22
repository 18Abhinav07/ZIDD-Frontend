import type { CSSProperties } from 'react';

import {
  COACH_AVATARS,
  type AvatarData,
  type CoachAvatarId,
} from './avatars.ts';

export interface SchoolAccentRoles {
  accent: string;
  deep: string;
  soft: string;
  border: string;
  onAccent: string;
}

export const SCHOOL_CANONICAL_PALETTE: Readonly<SchoolAccentRoles> = {
  accent: '#555BD8',
  deep: '#4248BB',
  soft: '#EFEFFD',
  border: '#D4D5FA',
  onAccent: '#FFFFFF',
};

export const SCHOOL_NEUTRAL_AVATAR_ID: CoachAvatarId = 'tech_black';

// Avatar identity is expressive, but it cannot change the meaning of an
// action, selection, or learning-state signal. The coach art alone carries
// the chosen avatar's colour; every teaching surface keeps Career's calm,
// stable indigo control system.
export const SCHOOL_AVATAR_PALETTES = {
  stuttering_sam: SCHOOL_CANONICAL_PALETTE,
  fluent_finn: SCHOOL_CANONICAL_PALETTE,
  brave_bella: SCHOOL_CANONICAL_PALETTE,
  quiet_quint: SCHOOL_CANONICAL_PALETTE,
  tech_black: SCHOOL_CANONICAL_PALETTE,
  casual_purple: SCHOOL_CANONICAL_PALETTE,
  casual_male: SCHOOL_CANONICAL_PALETTE,
  casual_female: SCHOOL_CANONICAL_PALETTE,
  casual_blue: SCHOOL_CANONICAL_PALETTE,
} as const satisfies Record<CoachAvatarId, Readonly<SchoolAccentRoles>>;

export const SCHOOL_FALLBACK_PALETTE = SCHOOL_CANONICAL_PALETTE;

export type SchoolThemeVariable =
  | '--school-accent'
  | '--school-accent-deep'
  | '--school-accent-soft'
  | '--school-accent-border'
  | '--school-on-accent'
  | '--school-coach-surface';

export type SchoolThemeStyle = CSSProperties & Record<SchoolThemeVariable, string>;

export interface SchoolAvatarTheme {
  avatar: AvatarData;
  roles: Readonly<SchoolAccentRoles>;
  style: SchoolThemeStyle;
}

export function getSchoolAvatarPalette(avatarId: string): Readonly<SchoolAccentRoles> {
  if (Object.prototype.hasOwnProperty.call(SCHOOL_AVATAR_PALETTES, avatarId)) {
    return SCHOOL_CANONICAL_PALETTE;
  }
  return SCHOOL_FALLBACK_PALETTE;
}

function schoolThemeStyle(roles: Readonly<SchoolAccentRoles>, coachSurface: string): SchoolThemeStyle {
  return {
    '--school-accent': roles.accent,
    '--school-accent-deep': roles.deep,
    '--school-accent-soft': roles.soft,
    '--school-accent-border': roles.border,
    '--school-on-accent': roles.onAccent,
    '--school-coach-surface': coachSurface,
  };
}

function schoolAvatarById(avatarId: string | null | undefined): AvatarData | null {
  return COACH_AVATARS.find((avatar) => avatar.id === avatarId) ?? null;
}

export function getSchoolAvatarThemeForAvatar(
  avatar: AvatarData,
  paletteId: string = avatar.id,
): SchoolAvatarTheme {
  const roles = getSchoolAvatarPalette(paletteId);
  return {
    avatar,
    roles,
    style: schoolThemeStyle(roles, avatar.bg),
  };
}

export function getSchoolAvatarTheme(
  avatarId: string | null | undefined,
  paletteId: string | null | undefined,
): SchoolAvatarTheme {
  const avatar = schoolAvatarById(avatarId);
  if (avatar) {
    return getSchoolAvatarThemeForAvatar(avatar, paletteId === avatar.id ? paletteId : avatar.id);
  }

  const neutralAvatar = schoolAvatarById(SCHOOL_NEUTRAL_AVATAR_ID);
  if (!neutralAvatar) throw new Error('school_neutral_avatar_missing');
  return {
    avatar: neutralAvatar,
    roles: SCHOOL_FALLBACK_PALETTE,
    style: schoolThemeStyle(SCHOOL_FALLBACK_PALETTE, neutralAvatar.bg),
  };
}
