"use client";

import Image from 'next/image';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
} from '@radix-ui/react-icons';
import { getSchoolAvatarTheme } from '@/lib/schoolTheme';
import {
  SchoolPageHeading,
  SchoolStatusChip,
  schoolPrimaryActionClass,
  schoolSecondaryActionClass,
} from '@/components/school/SchoolPrimitives';
import { buildSchoolLevelStages } from './schoolLevelStages.mjs';
import type { SchoolChapterMap, SchoolMapStatus } from '@/services/schoolRebuild';

interface SchoolLevelMapProps {
  chapter: SchoolChapterMap;
  busy?: boolean;
  onBack: () => void;
  authorizedAction?: {
    label: string;
    onSelect: () => void;
  };
}

const STAGE_DESCRIPTION = {
  'Discover': 'Meet the chapter idea through an example and a conversation with your coach.',
  'Practise Together': 'Try the idea with useful hints and supportive feedback.',
  'Try It Yourself': 'Show what you can do independently.',
  'Use It Somewhere New': 'Use the same skill in a fresh situation.',
  'Chapter Challenge': 'Bring the whole chapter together and show what you understand.',
} as const;

type LearnerStage = keyof typeof STAGE_DESCRIPTION;

type Stage = ReturnType<typeof buildSchoolLevelStages>[number] & { label: LearnerStage };

function stageStatusLabel(status: SchoolMapStatus) {
  if (status === 'complete') return 'Complete';
  if (status === 'active') return 'You are here';
  if (status === 'ready') return 'Ready';
  if (status === 'needs_support') return 'Support ready';
  return 'Locked';
}

function CompactMarker({ status, number }: { status: SchoolMapStatus; number: number }) {
  if (status === 'complete') {
    return <CheckIcon className="h-5 w-5" aria-hidden="true" />;
  }
  if (status === 'locked') {
    return <LockClosedIcon className="h-4 w-4" aria-hidden="true" />;
  }
  if (status === 'needs_support') {
    return <ExclamationTriangleIcon className="h-5 w-5" aria-hidden="true" />;
  }
  return <>{number}</>;
}

export function SchoolLevelMap({ chapter, busy = false, onBack, authorizedAction }: SchoolLevelMapProps) {
  const theme = getSchoolAvatarTheme(chapter.coach_avatar_id, chapter.coach_palette_id);
  const stages = buildSchoolLevelStages(chapter.levels, chapter.chapter_check, chapter.chapter_id) as Stage[];
  const activeIndex = stages.findIndex((stage) => ['active', 'ready', 'needs_support'].includes(stage.status));
  const completedStages = stages.filter((stage) => stage.status === 'complete').length;

  return (
    <main
      className="mx-auto w-full max-w-[1100px] overflow-x-hidden px-5 pb-24 pt-28 sm:px-8 lg:px-12"
      style={theme.style}
    >
      <button type="button" onClick={onBack} className={schoolSecondaryActionClass}>
        <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
        Class {chapter.class_no} chapters
      </button>

      <header className="mt-8 flex flex-col gap-5 border-b border-slate-200 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <SchoolPageHeading
          eyebrow={`Chapter ${chapter.chapter_no} · ${chapter.book_title ?? 'English'}`}
          title={chapter.title}
          description="Learn the idea, practise it, and show what you can do independently."
        />
        <SchoolStatusChip tone={chapter.status === 'needs_support' ? 'support' : completedStages > 0 ? 'success' : 'accent'}>
          {completedStages} of {stages.length} stages complete
        </SchoolStatusChip>
      </header>

      <div className="relative mt-10">
        <span className="pointer-events-none absolute bottom-10 left-[37px] top-10 w-px bg-slate-200 sm:bottom-auto sm:left-[10%] sm:right-[10%] sm:top-[52px] sm:h-px sm:w-auto" aria-hidden="true" />
        <ol className="relative grid grid-cols-1 gap-0 sm:grid-cols-5 sm:gap-3" aria-label="Chapter learning stages">
        {stages.map((stage, index) => {
          const active = index === activeIndex;
          const tone = stage.status === 'complete'
            ? 'border-teal-600 bg-teal-600 text-white'
            : stage.status === 'needs_support'
              ? 'border-orange-300 bg-orange-50 text-orange-800'
              : stage.status === 'locked'
                ? 'border-slate-200 bg-slate-50 text-slate-400'
                : 'border-[var(--school-accent-border)] bg-[var(--school-accent-soft)] text-[var(--school-accent-deep)]';

          return (
            <li
              key={stage.id}
              className={`relative z-10 grid min-h-[116px] grid-cols-[76px_minmax(0,1fr)] items-center gap-4 py-3 sm:block sm:min-h-0 sm:px-1 sm:py-0 sm:text-center ${stage.status === 'locked' ? 'opacity-65' : ''}`}
              aria-current={active ? 'step' : undefined}
              data-status={stage.status}
            >
              {active ? (
                <div className="relative h-[76px] w-[76px] overflow-hidden rounded-full border-4 border-[var(--school-accent)] bg-[var(--school-accent-soft)] shadow-[0_0_0_7px_var(--school-accent-soft)] sm:mx-auto sm:h-[104px] sm:w-[104px]">
                  <Image
                    src={theme.avatar.url}
                    alt="Current learning coach"
                    fill
                    sizes="(max-width: 639px) 76px, 104px"
                    className="object-contain object-bottom scale-100 p-1"
                    priority
                    unoptimized
                  />
                </div>
              ) : (
                <span className={`flex h-12 w-12 items-center justify-center rounded-full border-2 font-display text-xl font-normal sm:mx-auto sm:mt-7 ${tone}`}>
                  <CompactMarker status={stage.status} number={index + 1} />
                </span>
              )}

              <div className={`min-w-0 sm:mt-4 ${active ? 'sm:mt-3' : ''}`}>
                <p className={`text-[11px] font-semibold uppercase ${
                  stage.status === 'complete'
                    ? 'text-teal-700'
                    : stage.status === 'needs_support'
                      ? 'text-orange-700'
                      : stage.status === 'locked'
                        ? 'text-slate-400'
                        : 'text-[var(--school-accent-deep)]'
                }`}>
                  {stageStatusLabel(stage.status)}
                </p>
                <h2 className="mt-1 text-sm font-semibold leading-5 text-slate-900">{stage.label}</h2>
                <p className="mt-1 text-xs font-medium leading-5 text-slate-700 sm:px-1">{stage.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500 sm:px-1">{STAGE_DESCRIPTION[stage.label]}</p>
                {active && authorizedAction ? (
                  <button
                    type="button"
                    onClick={authorizedAction.onSelect}
                    disabled={busy}
                    className={`${schoolPrimaryActionClass} mt-4 w-full sm:px-3`}
                  >
                    {busy ? 'Starting chapter' : authorizedAction.label}
                    <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
        </ol>
      </div>
    </main>
  );
}
