"use client";

import { createContext, useContext } from 'react';

export interface SchoolShellCoachIdentity {
  coach_avatar_id: string | null;
  coach_palette_id: string | null;
}

interface SchoolCoachIdentitySelection {
  avatarId: string | null | undefined;
  paletteId: string | null | undefined;
}

export const SchoolShellCoachIdentityContext = createContext<SchoolShellCoachIdentity | null>(null);

export function useSchoolShellCoachIdentity() {
  return useContext(SchoolShellCoachIdentityContext);
}

export function resolveSchoolCoachIdentity(
  explicitIdentity: SchoolCoachIdentitySelection,
  shellIdentity: SchoolShellCoachIdentity | null,
): SchoolCoachIdentitySelection {
  if (
    explicitIdentity.avatarId == null
    && explicitIdentity.paletteId == null
    && shellIdentity
  ) {
    return {
      avatarId: shellIdentity.coach_avatar_id,
      paletteId: shellIdentity.coach_palette_id,
    };
  }
  return explicitIdentity;
}
