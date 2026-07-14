"use client";

import Image from 'next/image';
import { ArrowRightIcon, GearIcon, RowsIcon } from '@radix-ui/react-icons';
import { getAvatarScaleClass } from '@/lib/avatarRegistry';
import { getSchoolAvatarTheme } from '@/lib/schoolTheme';
import {
  SchoolPageHeading,
  SchoolStatusChip,
  schoolPrimaryActionClass,
  schoolSecondaryActionClass,
} from '@/components/school/SchoolPrimitives';
import type { SchoolClassMap } from '@/services/schoolRebuild';

interface SchoolClassHomeProps {
  schoolClass: SchoolClassMap;
  learnerMessage: string;
  primaryAction?: {
    label: string;
    onSelect: () => void;
  };
  onViewMap: () => void;
  onChangeSetup: () => void;
}

export function SchoolClassHome({
  schoolClass,
  learnerMessage,
  primaryAction,
  onViewMap,
  onChangeSetup,
}: SchoolClassHomeProps) {
  const theme = getSchoolAvatarTheme(schoolClass.coach_avatar_id, schoolClass.coach_palette_id);
  const completed = schoolClass.chapters.filter((chapter) => chapter.status === 'complete').length;
  const activeChapter = schoolClass.chapters.find(
    (chapter) => chapter.chapter_id === schoolClass.active_chapter_id,
  );

  return (
    <main
      className="mx-auto w-full max-w-[1100px] overflow-x-hidden px-5 pb-24 pt-28 sm:px-8 lg:px-12"
      style={theme.style}
    >
      <header className="flex flex-col gap-6 border-b border-slate-200 pb-9 md:flex-row md:items-end md:justify-between">
        <SchoolPageHeading
          eyebrow={`English · Class ${schoolClass.class_no}`}
          title="Your English class"
          description="Continue your chapter or look ahead at the class journey."
        />
        <button type="button" onClick={onChangeSetup} className={schoolSecondaryActionClass}>
          <GearIcon className="h-4 w-4" aria-hidden="true" />
          Change class or subject
        </button>
      </header>

      <section
        className="mt-8 grid min-h-[320px] overflow-hidden rounded-lg border border-[var(--school-accent-border)] bg-[var(--school-accent-soft)] md:grid-cols-[minmax(0,1fr)_300px]"
        aria-label="Current class activity"
      >
        <div className="flex min-w-0 flex-col justify-center p-6 sm:p-9 lg:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <SchoolStatusChip tone={activeChapter?.status === 'needs_support' ? 'support' : 'accent'}>
              {activeChapter?.status === 'needs_support' ? 'Support ready' : 'Active chapter'}
            </SchoolStatusChip>
            <span className="text-xs font-medium text-slate-500">{schoolClass.book_title}</span>
          </div>
          {activeChapter ? (
            <>
              <h2 className="mt-5 max-w-2xl font-display text-[2.35rem] font-normal leading-[1.02] text-slate-950 sm:text-[3rem]">
                {activeChapter.title}
              </h2>
              <p className="mt-3 max-w-[55ch] text-sm leading-6 text-slate-600 sm:text-[15px]">
                {activeChapter.completed_levels} of {activeChapter.total_levels} learning levels complete. {learnerMessage}
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {primaryAction ? (
                  <button type="button" onClick={primaryAction.onSelect} className={schoolPrimaryActionClass}>
                    {primaryAction.label}
                    <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : null}
                <button type="button" onClick={onViewMap} className={schoolSecondaryActionClass}>
                  <RowsIcon className="h-4 w-4" aria-hidden="true" />
                  View class journey
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-5 font-display text-[2.25rem] font-normal leading-tight text-slate-950">
                No approved chapters are available
              </h2>
              <p className="mt-3 max-w-[55ch] text-sm leading-6 text-slate-600">
                Your class setup is saved. Approved learning content will appear here when it is ready.
              </p>
              <button type="button" onClick={onViewMap} className={`${schoolSecondaryActionClass} mt-6 self-start`}>
                <RowsIcon className="h-4 w-4" aria-hidden="true" />
                View class journey
              </button>
            </>
          )}
        </div>

        <div className="relative min-h-[240px] overflow-hidden border-t border-[var(--school-accent-border)] md:min-h-[320px] md:border-t-0">
          <Image
            src={theme.avatar.url}
            alt="Zidd class coach"
            fill
            sizes="(max-width: 767px) 100vw, 300px"
            className={`object-contain object-bottom drop-shadow-[0_18px_28px_rgba(15,23,42,0.18)] ${getAvatarScaleClass(theme.avatar.url)}`}
            priority
            unoptimized
          />
        </div>
      </section>

      <section className="mt-7 grid border-y border-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-slate-200" aria-label="Recent growth">
        <div className="border-b border-slate-200 py-5 sm:border-b-0 sm:px-6 sm:first:pl-0">
          <strong className="block font-display text-[1.8rem] font-normal text-slate-950">{schoolClass.recent_growth.strong_count}</strong>
          <span className="mt-1 block text-xs leading-5 text-slate-500">skills showing strong evidence</span>
        </div>
        <div className="border-b border-slate-200 py-5 sm:border-b-0 sm:px-6">
          <strong className="block font-display text-[1.8rem] font-normal text-slate-950">
            {schoolClass.recent_growth.improving_count + schoolClass.recent_growth.active_focus_count}
          </strong>
          <span className="mt-1 block text-xs leading-5 text-slate-500">skills growing with support</span>
        </div>
        <div className="py-5 sm:px-6 sm:last:pr-0">
          <strong className="block font-display text-[1.8rem] font-normal text-slate-950">{completed} of {schoolClass.chapters.length}</strong>
          <span className="mt-1 block text-xs leading-5 text-slate-500">chapters complete</span>
        </div>
      </section>
    </main>
  );
}
