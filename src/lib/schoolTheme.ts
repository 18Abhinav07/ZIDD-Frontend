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

export const SCHOOL_NEUTRAL_AVATAR_ID: CoachAvatarId = 'tech_black';

export const SCHOOL_AVATAR_PALETTES = {
  stuttering_sam: { accent: '#B54708', deep: '#8A3506', soft: '#FFF2E8', border: '#F3C8A8', onAccent: '#FFFFFF' },
  fluent_finn: { accent: '#18794E', deep: '#115C3A', soft: '#E8F7EF', border: '#AFDEC3', onAccent: '#FFFFFF' },
  brave_bella: { accent: '#B4235A', deep: '#8E1746', soft: '#FDEAF2', border: '#EFB6CD', onAccent: '#FFFFFF' },
  quiet_quint: { accent: '#1F5FBF', deep: '#184A94', soft: '#EAF2FF', border: '#B6D0F6', onAccent: '#FFFFFF' },
  tech_black: { accent: '#3F4B62', deep: '#2B3548', soft: '#EEF2F7', border: '#C8D2E0', onAccent: '#FFFFFF' },
  casual_purple: { accent: '#7048B8', deep: '#55358E', soft: '#F2ECFC', border: '#D5C3F1', onAccent: '#FFFFFF' },
  casual_male: { accent: '#9A4D0C', deep: '#783B08', soft: '#FFF1E5', border: '#F0C69E', onAccent: '#FFFFFF' },
  casual_female: { accent: '#806000', deep: '#624A00', soft: '#FFF8DB', border: '#E7D58B', onAccent: '#FFFFFF' },
  casual_blue: { accent: '#1D4ED8', deep: '#173EA9', soft: '#EBF1FF', border: '#B7C9F7', onAccent: '#FFFFFF' },
} as const satisfies Record<CoachAvatarId, Readonly<SchoolAccentRoles>>;

export const SCHOOL_CANONICAL_PALETTE = SCHOOL_AVATAR_PALETTES[SCHOOL_NEUTRAL_AVATAR_ID];
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
    return SCHOOL_AVATAR_PALETTES[avatarId as CoachAvatarId];
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
  const roles = getSchoolAvatarPalette(paletteId === avatar.id ? paletteId : avatar.id);
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
