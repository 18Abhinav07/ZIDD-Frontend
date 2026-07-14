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

export const SCHOOL_FALLBACK_PALETTE: Readonly<SchoolAccentRoles> = {
  accent: '#334155',
  deep: '#1E293B',
  soft: '#F1F5F9',
  border: '#CBD5E1',
  onAccent: '#FFFDF8',
};

export const SCHOOL_NEUTRAL_AVATAR_ID: CoachAvatarId = 'tech_black';

// Avatar asset colors are intentionally translated into calmer, readable UI roles.
export const SCHOOL_AVATAR_PALETTES = {
  stuttering_sam: {
    accent: '#C2410C', deep: '#7C2D12', soft: '#FFF7ED', border: '#FED7AA', onAccent: '#FFFDF8',
  },
  fluent_finn: {
    accent: '#047857', deep: '#064E3B', soft: '#ECFDF5', border: '#A7F3D0', onAccent: '#FFFDF8',
  },
  brave_bella: {
    accent: '#BE185D', deep: '#831843', soft: '#FDF2F8', border: '#FBCFE8', onAccent: '#FFFDF8',
  },
  quiet_quint: {
    accent: '#1D4ED8', deep: '#1E3A8A', soft: '#EFF6FF', border: '#BFDBFE', onAccent: '#FFFDF8',
  },
  tech_black: {
    accent: '#475569', deep: '#1E293B', soft: '#F1F5F9', border: '#CBD5E1', onAccent: '#FFFDF8',
  },
  casual_purple: {
    accent: '#7E22CE', deep: '#581C87', soft: '#FAF5FF', border: '#E9D5FF', onAccent: '#FFFDF8',
  },
  casual_male: {
    accent: '#B45309', deep: '#78350F', soft: '#FFFBEB', border: '#FDE68A', onAccent: '#FFFDF8',
  },
  casual_female: {
    accent: '#A16207', deep: '#713F12', soft: '#FEFCE8', border: '#FEF08A', onAccent: '#FFFDF8',
  },
  casual_blue: {
    accent: '#1E40AF', deep: '#172554', soft: '#EFF6FF', border: '#BFDBFE', onAccent: '#FFFDF8',
  },
} as const satisfies Record<CoachAvatarId, Readonly<SchoolAccentRoles>>;

export type SchoolThemeVariable =
  | '--school-accent'
  | '--school-accent-deep'
  | '--school-accent-soft'
  | '--school-accent-border'
  | '--school-on-accent';

export type SchoolThemeStyle = CSSProperties & Record<SchoolThemeVariable, string>;

export interface SchoolAvatarTheme {
  avatar: AvatarData;
  roles: Readonly<SchoolAccentRoles>;
  style: SchoolThemeStyle;
}

export function getSchoolAvatarPalette(avatarId: string): Readonly<SchoolAccentRoles> {
  if (Object.prototype.hasOwnProperty.call(SCHOOL_AVATAR_PALETTES, avatarId)) {
    return SCHOOL_AVATAR_PALETTES[avatarId as CoachAvatarId];
  }
  return SCHOOL_FALLBACK_PALETTE;
}

function schoolThemeStyle(roles: Readonly<SchoolAccentRoles>): SchoolThemeStyle {
  return {
    '--school-accent': roles.accent,
    '--school-accent-deep': roles.deep,
    '--school-accent-soft': roles.soft,
    '--school-accent-border': roles.border,
    '--school-on-accent': roles.onAccent,
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
    style: schoolThemeStyle(roles),
  };
}

export function getSchoolAvatarTheme(
  avatarId: string | null | undefined,
  paletteId: string | null | undefined,
): SchoolAvatarTheme {
  const avatar = schoolAvatarById(avatarId);
  const identityIsValid = avatar !== null
    && avatar.id === paletteId
    && Object.prototype.hasOwnProperty.call(SCHOOL_AVATAR_PALETTES, paletteId);
  if (identityIsValid) return getSchoolAvatarThemeForAvatar(avatar, paletteId);

  const neutralAvatar = schoolAvatarById(SCHOOL_NEUTRAL_AVATAR_ID);
  if (!neutralAvatar) throw new Error('school_neutral_avatar_missing');
  return {
    avatar: neutralAvatar,
    roles: SCHOOL_FALLBACK_PALETTE,
    style: schoolThemeStyle(SCHOOL_FALLBACK_PALETTE),
  };
}
