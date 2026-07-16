"use client";

import type { ReactNode } from 'react';
import { ReaderIcon } from '@radix-ui/react-icons';
import { SchoolCoachPanel } from '@/components/school/SchoolCoachPanel';
import { SchoolLearningWorkspace } from '@/components/school/SchoolLearningWorkspace';
import { getSchoolAvatarTheme } from '@/lib/schoolTheme';

export interface SchoolLearningShellProps {
  title: string;
  eyebrow: string;
  coachStatus: string;
  coachNote: string;
  coachAvatarId: string | null | undefined;
  coachPaletteId: string | null | undefined;
  onBack: () => void;
  backLabel?: string;
  children: ReactNode;
  progress?: ReactNode;
  headerMeta?: string;
}

export function SchoolLearningShell({
  title,
  eyebrow,
  coachStatus,
  coachNote,
  coachAvatarId,
  coachPaletteId,
  onBack,
  backLabel = "Back to school path",
  children,
  progress,
  headerMeta,
}: SchoolLearningShellProps) {
  const theme = getSchoolAvatarTheme(coachAvatarId, coachPaletteId);

  return (
    <SchoolLearningWorkspace
      title={title}
      eyebrow={eyebrow}
      onBack={onBack}
      coach={<SchoolCoachPanel avatarId={coachAvatarId} paletteId={coachPaletteId} status={coachStatus} note={coachNote} variant="immersive" />}
      mobileCoach={<SchoolCoachPanel avatarId={coachAvatarId} paletteId={coachPaletteId} status={coachStatus} note={coachNote} variant="inline" />}
      progress={progress}
      headerMeta={headerMeta ? <><span aria-hidden="true">/</span> {headerMeta}</> : undefined}
      headerIcon={<ReaderIcon className="h-3.5 w-3.5" aria-hidden="true" />}
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
