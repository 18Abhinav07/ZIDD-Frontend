"use client";

import Image from 'next/image';
import {
  ArrowRightIcon,
  CheckCircledIcon,
  DotFilledIcon,
  ExclamationTriangleIcon,
  GearIcon,
  LockClosedIcon,
  ReaderIcon,
} from '@radix-ui/react-icons';
import { needsPaddingCompensation } from '@/lib/avatarRegistry';
import { getSchoolAvatarTheme } from '@/lib/schoolTheme';
import {
  SchoolDisclosure,
  SchoolPageHeading,
  SchoolStatusChip,
  schoolPrimaryActionClass,
  schoolSecondaryActionClass,
} from '@/components/school/SchoolPrimitives';
import type { SchoolClassMap, SchoolMapStatus } from '@/services/schoolRebuild';

interface SchoolChapterMapProps {
  schoolClass: SchoolClassMap;
  authorizedAction?: {
    chapterId: string;
    label: string;
    busy: boolean;
    onSelect: () => void;
  };
  onChangeSetup: () => void;
}

type Chapter = SchoolClassMap['chapters'][number];

function chapterDescription(chapter: Chapter) {
  if (chapter.status === 'complete') return `${chapter.completed_levels} of ${chapter.total_levels} levels complete. Ready to review.`;
  if (chapter.status === 'active') return `${chapter.completed_levels} of ${chapter.total_levels} levels complete. Continue where you stopped.`;
  if (chapter.status === 'ready') return `${chapter.total_levels} learning levels are ready.`;
  if (chapter.status === 'needs_support') return 'Focused support is ready before you continue.';
  return 'Complete the previous chapter to unlock this one.';
}

function chapterStatusLabel(status: SchoolMapStatus) {
  if (status === 'complete') return 'Complete';
  if (status === 'active') return 'In progress';
  if (status === 'ready') return 'Ready';
  if (status === 'needs_support') return 'Support ready';
  return 'Locked';
}

function ChapterStateIcon({ status }: { status: SchoolMapStatus }) {
  if (status === 'complete') return <CheckCircledIcon className="h-5 w-5 text-teal-700" aria-hidden="true" />;
  if (status === 'locked') return <LockClosedIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />;
  if (status === 'needs_support') return <ExclamationTriangleIcon className="h-5 w-5 text-orange-700" aria-hidden="true" />;
  if (status === 'active') return <DotFilledIcon className="h-5 w-5 text-[var(--school-accent)]" aria-hidden="true" />;
  return <DotFilledIcon className="h-5 w-5 text-[var(--school-accent-deep)]" aria-hidden="true" />;
}

function ChapterRow({
  chapter,
  authorizedAction,
}: {
  chapter: Chapter;
  authorizedAction: SchoolChapterMapProps['authorizedAction'];
}) {
  const action = authorizedAction?.chapterId === chapter.chapter_id ? authorizedAction : undefined;
  const rowContent = (
    <>
      <span className="font-display text-xl font-normal text-slate-400">{String(chapter.chapter_no).padStart(2, '0')}</span>
      <span className="min-w-0">
        <span className="block break-words text-sm font-semibold leading-5 text-slate-900 sm:text-[15px]">{chapter.title}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{chapterDescription(chapter)}</span>
      </span>
      <span className={`hidden text-xs font-semibold sm:block ${
        chapter.status === 'complete'
          ? 'text-teal-700'
          : chapter.status === 'needs_support'
            ? 'text-orange-700'
            : chapter.status === 'locked'
              ? 'text-slate-400'
              : 'text-[var(--school-accent-deep)]'
      }`}>
        {chapterStatusLabel(chapter.status)}
      </span>
      <span className="flex h-11 w-11 items-center justify-center" aria-hidden="true">
        <ChapterStateIcon status={chapter.status} />
      </span>
    </>
  );
  const rowClassName = "grid min-h-[76px] w-full grid-cols-[38px_minmax(0,1fr)_44px] items-center gap-3 border-b border-slate-200 py-3 text-left last:border-b-0 sm:grid-cols-[46px_minmax(0,1fr)_130px_44px] sm:gap-4";

  return action ? (
    <button
      type="button"
      disabled={action.busy}
      onClick={action.onSelect}
      aria-label={`${action.label}: ${chapter.title}`}
      className={`${rowClassName} transition-colors hover:bg-[var(--school-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--school-accent)] focus-visible:ring-inset disabled:cursor-wait disabled:opacity-65`}
    >
      {rowContent}
    </button>
  ) : (
    <div className={rowClassName} aria-label={`${chapterStatusLabel(chapter.status)}: ${chapter.title}`}>
      {rowContent}
    </div>
  );
}

export function SchoolChapterMap({ schoolClass, authorizedAction, onChangeSetup }: SchoolChapterMapProps) {
  const theme = getSchoolAvatarTheme(schoolClass.coach_avatar_id, schoolClass.coach_palette_id);
  const desktopAvatarScale = needsPaddingCompensation(theme.avatar.url) ? 'sm:scale-[1.35]' : '';
  const completedChapters = schoolClass.chapters.filter((chapter) => chapter.status === 'complete').length;
  const activeChapter = schoolClass.chapters.find(
    (chapter) => chapter.chapter_id === schoolClass.active_chapter_id,
  );

  const compactChapters = schoolClass.chapters.filter((chapter) => chapter.chapter_id !== activeChapter?.chapter_id);
  const usefulChapterIds = new Set([
    ...compactChapters.filter((chapter) => chapter.status !== 'locked'),
    ...compactChapters.filter((chapter) => chapter.status === 'locked'),
  ].slice(0, 5).map((chapter) => chapter.chapter_id));
  const visibleChapters = compactChapters.filter((chapter) => usefulChapterIds.has(chapter.chapter_id));
  const remainingChapters = compactChapters.filter((chapter) => !usefulChapterIds.has(chapter.chapter_id));

  if (schoolClass.chapters.length === 0) {
    return (
      <main className="mx-auto w-full max-w-[760px] px-5 pb-24 pt-32 sm:px-8" style={theme.style}>
        <ReaderIcon className="h-7 w-7 text-[var(--school-accent-deep)]" aria-hidden="true" />
        <SchoolPageHeading
          className="mt-5"
          eyebrow={`English · Class ${schoolClass.class_no}`}
          title="No approved chapters are available"
          description="Your class setup is saved. Approved English chapters will appear here when they are ready."
        />
        <button type="button" onClick={onChangeSetup} className={`${schoolSecondaryActionClass} mt-6`}>
          <GearIcon className="h-4 w-4" aria-hidden="true" />
          Change class or subject
        </button>
      </main>
    );
  }

  return (
    <main
      className="mx-auto w-full max-w-[1100px] overflow-x-hidden px-5 pb-24 pt-28 sm:px-8 lg:px-12"
      style={theme.style}
    >
      <header className="flex flex-col gap-6 border-b border-slate-200 pb-8 md:flex-row md:items-end md:justify-between">
        <SchoolPageHeading
          eyebrow={`English · Class ${schoolClass.class_no} · ${schoolClass.book_title}`}
          title="Your class journey"
          description="The chapter that needs you now has the detail. The rest stay compact until they become relevant."
        />
        <div className="flex flex-col items-start gap-3 md:items-end">
          <SchoolStatusChip tone={completedChapters > 0 ? 'success' : 'neutral'}>
            {completedChapters} of {schoolClass.chapters.length} complete
          </SchoolStatusChip>
          <button type="button" onClick={onChangeSetup} className={schoolSecondaryActionClass}>
            <GearIcon className="h-4 w-4" aria-hidden="true" />
            Change class or subject
          </button>
        </div>
      </header>

      {activeChapter ? (
        <article
          className="mt-8 grid min-h-[250px] overflow-hidden rounded-lg border border-[var(--school-accent-border)] bg-[var(--school-accent-soft)] sm:grid-cols-[190px_minmax(0,1fr)]"
          aria-current={activeChapter.status === 'active' ? 'step' : undefined}
        >
          <div className="relative min-h-[220px] overflow-hidden border-b border-[var(--school-accent-border)] sm:min-h-[250px] sm:border-b-0">
            <Image
              src={theme.avatar.url}
              alt="Zidd class coach"
              fill
              sizes="(max-width: 639px) 100vw, 190px"
              className={`object-contain object-bottom scale-100 origin-bottom p-3 drop-shadow-[0_16px_24px_rgba(15,23,42,0.18)] sm:p-0 ${desktopAvatarScale}`}
              priority
              unoptimized
            />
          </div>
          <div className="flex min-w-0 flex-col justify-center p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[11px] font-semibold uppercase text-[var(--school-accent-deep)]">Chapter {activeChapter.chapter_no}</span>
              <SchoolStatusChip tone={activeChapter.status === 'needs_support' ? 'support' : 'accent'}>
                {chapterStatusLabel(activeChapter.status)}
              </SchoolStatusChip>
            </div>
            <h2 className="mt-4 font-display text-[2.25rem] font-normal leading-[1.03] text-slate-950 sm:text-[2.7rem]">
              {activeChapter.title}
            </h2>
            <p className="mt-3 max-w-[58ch] text-sm leading-6 text-slate-600">{chapterDescription(activeChapter)}</p>
            {authorizedAction?.chapterId === activeChapter.chapter_id ? (
              <button
                type="button"
                onClick={authorizedAction.onSelect}
                disabled={authorizedAction.busy}
                className={`${schoolPrimaryActionClass} mt-6 self-start`}
              >
                {authorizedAction.busy ? 'Starting chapter' : authorizedAction.label}
                <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </article>
      ) : null}

      <section className="mt-5" aria-label="All class chapters">
        <div className="border-y border-slate-200">
          {visibleChapters.map((chapter) => (
            <ChapterRow key={chapter.chapter_id} chapter={chapter} authorizedAction={authorizedAction} />
          ))}
        </div>
        {remainingChapters.length > 0 ? (
          <SchoolDisclosure
            title={`Show the remaining ${remainingChapters.length} chapters`}
            summary="Every chapter stays available here as your class journey opens."
          >
            <div className="border-t border-slate-200">
              {remainingChapters.map((chapter) => (
                <ChapterRow key={chapter.chapter_id} chapter={chapter} authorizedAction={authorizedAction} />
              ))}
            </div>
          </SchoolDisclosure>
        ) : null}
      </section>
    </main>
  );
}
