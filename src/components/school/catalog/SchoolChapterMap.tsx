"use client";

import type { CSSProperties } from 'react';
import Image from 'next/image';
import {
  ArrowRightIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  GearIcon,
  LockClosedIcon,
  ReaderIcon,
} from '@radix-ui/react-icons';
import { getAvatarScaleClass } from '@/lib/avatarRegistry';
import { getSchoolAvatarTheme } from '@/lib/schoolTheme';
import {
  SchoolPageHeading,
  schoolSecondaryActionClass,
} from '@/components/school/SchoolPrimitives';
import type { SchoolClassMap, SchoolMapStatus } from '@/services/schoolRebuild';
import {
  buildSchoolWindingPath,
  getSchoolPathAvatar,
  schoolPathMetrics,
  schoolPathSide,
} from './schoolPathMap.mjs';
import styles from './SchoolPathMap.module.css';

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

function statusClass(status: SchoolMapStatus) {
  if (status === 'complete') return styles.complete;
  if (status === 'active') return styles.active;
  if (status === 'ready') return styles.ready;
  if (status === 'needs_support') return styles.needsSupport;
  return styles.locked;
}

function ChapterStateIcon({ status }: { status: SchoolMapStatus }) {
  if (status === 'complete') return <CheckIcon aria-hidden="true" />;
  if (status === 'locked') return <LockClosedIcon aria-hidden="true" />;
  if (status === 'needs_support') return <ExclamationTriangleIcon aria-hidden="true" />;
  return null;
}

function ChapterPathNode({
  chapter,
  index,
  activeChapterId,
  authorizedAction,
}: {
  chapter: Chapter;
  index: number;
  activeChapterId: string | null;
  authorizedAction: SchoolChapterMapProps['authorizedAction'];
}) {
  const isCurrent = chapter.chapter_id === activeChapterId;
  const action = authorizedAction?.chapterId === chapter.chapter_id && chapter.status !== 'locked'
    ? authorizedAction
    : undefined;
  const avatar = getSchoolPathAvatar(chapter.chapter_id);
  const side = schoolPathSide(index);
  const label = chapterStatusLabel(chapter.status);
  const description = chapterDescription(chapter);
  const showStateBadge = ['complete', 'locked', 'needs_support'].includes(chapter.status);
  const className = [
    styles.node,
    side === 'right' ? styles.sideRight : styles.sideLeft,
    statusClass(chapter.status),
    isCurrent ? styles.current : '',
  ].filter(Boolean).join(' ');
  const nodeStyle = { '--school-path-index': index } as CSSProperties;

  return (
    <li
      className={className}
      style={nodeStyle}
      data-status={chapter.status}
      aria-current={isCurrent ? 'step' : undefined}
      aria-disabled={chapter.status === 'locked' ? true : undefined}
      aria-label={`${chapter.title}, ${label}. ${description}`}
    >
      <div className={styles.nodeAvatar} aria-hidden="true">
        <span className={styles.nodeGround} />
        <span className={styles.nodeRing} />
        <Image
          src={avatar}
          alt=""
          width={250}
          height={300}
          sizes="(max-width: 780px) 128px, 210px"
          className={`${styles.nodeImage} ${getAvatarScaleClass(avatar)}`}
          priority={index === 0}
        />
        {showStateBadge ? (
          <span className={styles.nodeBadge}>
            <ChapterStateIcon status={chapter.status} />
          </span>
        ) : null}
      </div>

      {action ? (
        <button
          type="button"
          disabled={action.busy}
          onClick={action.onSelect}
          aria-label={`${action.busy ? 'Starting chapter' : action.label}: ${chapter.title}`}
          className={`${styles.nodeCallout} ${styles.nodeCalloutButton}`}
        >
          <span className={styles.nodeState}>{label}</span>
          <span className={styles.nodeHeading}>
            <span className={styles.nodeNumber} aria-hidden="true">
              {String(chapter.chapter_no).padStart(2, '0')}
            </span>
            <span>{chapter.title}</span>
          </span>
          {isCurrent ? <span className={styles.nodeDescription}>{description}</span> : null}
          <span className={styles.nodeAction}>
            {action.busy ? 'Starting chapter' : action.label}
            <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
          </span>
        </button>
      ) : (
        <div className={styles.nodeCallout}>
          <span className={styles.nodeState}>{label}</span>
          <span className={styles.nodeHeading}>
            <span className={styles.nodeNumber} aria-hidden="true">
              {String(chapter.chapter_no).padStart(2, '0')}
            </span>
            <span>{chapter.title}</span>
          </span>
          {isCurrent ? <span className={styles.nodeDescription}>{description}</span> : null}
        </div>
      )}
    </li>
  );
}

export function SchoolChapterMap({ schoolClass, authorizedAction, onChangeSetup }: SchoolChapterMapProps) {
  const theme = getSchoolAvatarTheme(schoolClass.coach_avatar_id, schoolClass.coach_palette_id);
  const completedChapters = schoolClass.chapters.filter((chapter) => chapter.status === 'complete').length;
  const activeChapter = schoolClass.chapters.find(
    (chapter) => chapter.chapter_id === schoolClass.active_chapter_id,
  );

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

  const metrics = schoolPathMetrics(schoolClass.chapters.length, 'chapters');
  const route = buildSchoolWindingPath(schoolClass.chapters.length, 'chapters');
  const mapStyle = {
    '--school-path-map-height': `${metrics.desktopHeight}px`,
    '--school-path-map-height-mobile': `${metrics.mobileHeight}px`,
    '--school-path-start': `${metrics.desktopStart}px`,
    '--school-path-start-mobile': `${metrics.mobileStart}px`,
    '--school-path-step': `${metrics.desktopStep}px`,
    '--school-path-step-mobile': `${metrics.mobileStep}px`,
  } as CSSProperties;

  return (
    <main className={styles.mapPage} style={theme.style}>
      <header className={styles.mapHeader}>
        <div className={styles.mapHeaderTop}>
          <span className={styles.mapCount}>
            {completedChapters} of {schoolClass.chapters.length} complete
          </span>
          <button type="button" onClick={onChangeSetup} className={schoolSecondaryActionClass}>
            <GearIcon className="h-4 w-4" aria-hidden="true" />
            Change class or subject
          </button>
        </div>
        <div className={styles.mapHeaderBottom}>
          <div className={styles.mapHeaderCopy}>
            <SchoolPageHeading
              eyebrow={`English · Class ${schoolClass.class_no} · ${schoolClass.book_title}`}
              title="Your class journey"
              description="Follow the path from finished stories to the chapter waiting now."
            />
          </div>
        </div>
      </header>

      <section className={styles.mapCanvas} style={mapStyle} aria-label="English chapter path">
        <svg
          className={styles.route}
          viewBox={`0 0 600 ${metrics.desktopHeight}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path className={styles.routeBed} d={route} />
          <path className={styles.routeDash} d={route} />
        </svg>
        <ol className={styles.mapList}>
          {schoolClass.chapters.map((chapter, index) => (
            <ChapterPathNode
              key={chapter.chapter_id}
              chapter={chapter}
              index={index}
              activeChapterId={activeChapter?.chapter_id ?? null}
              authorizedAction={authorizedAction}
            />
          ))}
        </ol>
      </section>
    </main>
  );
}
