"use client";

import type { CSSProperties } from 'react';
import Image from 'next/image';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  StarIcon,
} from '@radix-ui/react-icons';
import { getAvatarScaleClass } from '@/lib/avatarRegistry';
import { getSchoolAvatarTheme } from '@/lib/schoolTheme';
import { useResolvedSchoolCoachIdentity } from '@/components/school/shell/SchoolCoachIdentityContext';
import {
  SchoolPageHeading,
  SchoolStatusChip,
  schoolSecondaryActionClass,
} from '@/components/school/SchoolPrimitives';
import { buildSchoolLevelStages } from './schoolLevelStages.mjs';
import {
  buildSchoolWindingPath,
  getSchoolPathAvatar,
  schoolPathMetrics,
  schoolPathSide,
} from './schoolPathMap.mjs';
import styles from './SchoolPathMap.module.css';
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

function statusClass(status: SchoolMapStatus) {
  if (status === 'complete') return styles.complete;
  if (status === 'active') return styles.active;
  if (status === 'ready') return styles.ready;
  if (status === 'needs_support') return styles.needsSupport;
  return styles.locked;
}

function StageStateIcon({ status }: { status: SchoolMapStatus }) {
  if (status === 'complete') return <CheckIcon aria-hidden="true" />;
  if (status === 'locked') return <LockClosedIcon aria-hidden="true" />;
  if (status === 'needs_support') return <ExclamationTriangleIcon aria-hidden="true" />;
  return null;
}

function LevelPathNode({
  stage,
  index,
  isCurrent,
  busy,
  authorizedAction,
}: {
  stage: Stage;
  index: number;
  isCurrent: boolean;
  busy: boolean;
  authorizedAction: SchoolLevelMapProps['authorizedAction'];
}) {
  const action = isCurrent && stage.status !== 'locked' ? authorizedAction : undefined;
  const side = schoolPathSide(index);
  const avatar = getSchoolPathAvatar(stage.id);
  const isChallenge = stage.label === 'Chapter Challenge';
  const label = stageStatusLabel(stage.status);
  const showStateBadge = ['complete', 'locked', 'needs_support'].includes(stage.status);
  const className = [
    styles.node,
    styles.levelNode,
    side === 'right' ? styles.sideRight : styles.sideLeft,
    statusClass(stage.status),
    isCurrent ? styles.current : '',
  ].filter(Boolean).join(' ');
  const nodeStyle = { '--school-path-index': index } as CSSProperties;

  return (
    <li
      className={className}
      style={nodeStyle}
      data-status={stage.status}
      aria-current={isCurrent ? 'step' : undefined}
      aria-disabled={stage.status === 'locked' ? true : undefined}
      aria-label={`${stage.label}, ${label}. ${stage.title}`}
    >
      <div
        className={`${styles.nodeAvatar} ${isChallenge ? styles.challengeAvatar : ''}`}
        aria-hidden="true"
      >
        {isChallenge ? (
          <span className={styles.challengeMark}>
            <StarIcon />
          </span>
        ) : (
          <>
            <span className={styles.nodeGround} />
            <span className={styles.nodeRing} />
            <Image
              src={avatar}
              alt=""
              width={250}
              height={300}
              sizes="(max-width: 780px) 128px, 250px"
              className={`${styles.nodeImage} ${getAvatarScaleClass(avatar)}`}
              priority={index === 0}
            />
          </>
        )}
        {showStateBadge ? (
          <span className={styles.nodeBadge}>
            <StageStateIcon status={stage.status} />
          </span>
        ) : null}
      </div>

      {action ? (
        <button
          type="button"
          onClick={action.onSelect}
          disabled={busy}
          className={`${styles.nodeCallout} ${styles.nodeCalloutButton}`}
          aria-label={`${busy ? 'Starting chapter' : action.label}: ${stage.label}`}
        >
          <span className={styles.levelMeta}>
            <span>{label}</span>
            <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          </span>
          <span className={styles.nodeHeading}>{stage.label}</span>
          <span className={styles.nodeDescription}>{stage.title}</span>
          <span className={styles.nodeDescription}>{STAGE_DESCRIPTION[stage.label]}</span>
          <span className={styles.nodeAction}>
            {busy ? 'Starting chapter' : action.label}
            <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
          </span>
        </button>
      ) : (
        <div className={styles.nodeCallout}>
          <span className={styles.levelMeta}>
            <span>{label}</span>
            <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          </span>
          <span className={styles.nodeHeading}>{stage.label}</span>
          {isCurrent ? (
            <>
              <span className={styles.nodeDescription}>{stage.title}</span>
              <span className={styles.nodeDescription}>{STAGE_DESCRIPTION[stage.label]}</span>
            </>
          ) : stage.title !== stage.label ? (
            <span className={styles.nodeDescription}>{stage.title}</span>
          ) : null}
        </div>
      )}
    </li>
  );
}

export function SchoolLevelMap({ chapter, busy = false, onBack, authorizedAction }: SchoolLevelMapProps) {
  const coachIdentity = useResolvedSchoolCoachIdentity({
    avatarId: chapter.coach_avatar_id,
    paletteId: chapter.coach_palette_id,
  });
  const theme = getSchoolAvatarTheme(coachIdentity.avatarId, coachIdentity.paletteId);
  const stages = buildSchoolLevelStages(chapter.levels, chapter.chapter_check, chapter.chapter_id) as Stage[];
  const activeIndex = stages.findIndex((stage) => ['active', 'ready', 'needs_support'].includes(stage.status));
  const completedStages = stages.filter((stage) => stage.status === 'complete').length;
  const metrics = schoolPathMetrics(stages.length, 'levels');
  const route = buildSchoolWindingPath(stages.length, 'levels');
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
          <button type="button" onClick={onBack} className={schoolSecondaryActionClass}>
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            Class {chapter.class_no} chapters
          </button>
          <SchoolStatusChip tone={chapter.status === 'needs_support' ? 'support' : completedStages > 0 ? 'success' : 'accent'}>
            {completedStages} of {stages.length} stages complete
          </SchoolStatusChip>
        </div>
        <div className={styles.mapHeaderBottom}>
          <div className={styles.mapHeaderCopy}>
            <SchoolPageHeading
              eyebrow={`Chapter ${chapter.chapter_no} · ${chapter.book_title ?? 'English'}`}
              title={chapter.title}
              description="Learn the idea, practise it, and show what you can do independently."
            />
          </div>
        </div>
      </header>

      <section className={styles.mapCanvas} style={mapStyle} aria-label="Chapter learning stages">
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
          {stages.map((stage, index) => (
            <LevelPathNode
              key={stage.id}
              stage={stage}
              index={index}
              isCurrent={index === activeIndex}
              busy={busy}
              authorizedAction={authorizedAction}
            />
          ))}
        </ol>
      </section>
    </main>
  );
}
