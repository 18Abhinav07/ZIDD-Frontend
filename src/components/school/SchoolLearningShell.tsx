"use client";

import type { ReactNode } from 'react';
import { SchoolCoachPanel } from '@/components/school/SchoolCoachPanel';
import { SchoolLearningWorkspace } from '@/components/school/SchoolLearningWorkspace';
import { getSchoolAvatarTheme } from '@/lib/schoolTheme';
import type { SchoolCoachHint, SchoolCoachTone } from '@/lib/schoolTeachingPresentation';

export interface SchoolLearningShellProps {
  title: string;
  coachStatus: string;
  coachNote: string;
  coachHint?: SchoolCoachHint | null;
  coachTone?: SchoolCoachTone;
  coachAvatarId: string | null | undefined;
  coachPaletteId: string | null | undefined;
  onBack: () => void;
  backLabel?: string;
  children: ReactNode;
  progress?: ReactNode;
}

export function SchoolLearningShell({
  title,
  coachStatus,
  coachNote,
  coachHint,
  coachTone = 'neutral',
  coachAvatarId,
  coachPaletteId,
  onBack,
  backLabel = "Back to school path",
  children,
  progress,
}: SchoolLearningShellProps) {
  const theme = getSchoolAvatarTheme(coachAvatarId, coachPaletteId);

  return (
    <SchoolLearningWorkspace
      title={title}
      onBack={onBack}
      coach={(
        <SchoolCoachPanel
          avatarId={coachAvatarId}
          paletteId={coachPaletteId}
          status={coachStatus}
          note={coachNote}
          hint={coachHint}
          tone={coachTone}
          variant="immersive"
        />
      )}
      progress={progress}
      backLabel={backLabel}
      coachLabel="School learning coach"
      progressLabel="School learning progress"
      workspaceLabel={title}
      className="mode-school bg-background font-body"
      themeStyle={theme.style}
      rootDataAttributes={{ 'data-school-region': 'learning-shell' }}
    >
      {children}
    </SchoolLearningWorkspace>
  );
}
