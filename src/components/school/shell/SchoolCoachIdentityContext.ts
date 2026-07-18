"use client";

import { createContext, useContext } from 'react';
import { COACH_AVATARS } from '../../../lib/avatars.ts';
import { SCHOOL_NEUTRAL_AVATAR_ID } from '../../../lib/schoolTheme.ts';

export interface SchoolShellCoachIdentity {
  coach_avatar_id: string | null;
  coach_palette_id: string | null;
}

export interface SchoolCoachIdentitySelection {
  avatarId: string | null | undefined;
  paletteId: string | null | undefined;
}

export const SchoolShellCoachIdentityContext = createContext<SchoolShellCoachIdentity | null>(null);

export function useSchoolShellCoachIdentity() {
  return useContext(SchoolShellCoachIdentityContext);
}

function hasValidSchoolShellIdentity(
  identity: SchoolShellCoachIdentity | null,
): identity is SchoolShellCoachIdentity & { coach_avatar_id: string; coach_palette_id: string } {
  return Boolean(
    identity?.coach_avatar_id
    && identity.coach_palette_id
    && identity.coach_avatar_id === identity.coach_palette_id
    && COACH_AVATARS.some((avatar) => avatar.id === identity.coach_avatar_id),
  );
}

function hasPersistedSchoolShellIdentity(
  identity: SchoolShellCoachIdentity | null,
): boolean {
  return Boolean(
    identity
    && (identity.coach_avatar_id !== null || identity.coach_palette_id !== null),
  );
}

export function resolveSchoolCoachIdentity(
  explicitIdentity: SchoolCoachIdentitySelection,
  shellIdentity: SchoolShellCoachIdentity | null,
): SchoolCoachIdentitySelection {
  if (hasValidSchoolShellIdentity(shellIdentity)) {
    return {
      avatarId: shellIdentity.coach_avatar_id,
      paletteId: shellIdentity.coach_palette_id,
    };
  }
  if (hasPersistedSchoolShellIdentity(shellIdentity)) {
    return {
      avatarId: SCHOOL_NEUTRAL_AVATAR_ID,
      paletteId: SCHOOL_NEUTRAL_AVATAR_ID,
    };
  }
  return explicitIdentity;
}

export function useResolvedSchoolCoachIdentity(
  explicitIdentity: SchoolCoachIdentitySelection,
): SchoolCoachIdentitySelection {
  return resolveSchoolCoachIdentity(explicitIdentity, useSchoolShellCoachIdentity());
}
