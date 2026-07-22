"use client";

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, CircleDot, LockKeyhole, Play, Sparkles } from 'lucide-react';
import { getAvatarForSeed } from '@/lib/avatars';
import { getAvatarDisplayPath, getAvatarScaleClass } from '@/lib/avatarRegistry';

export type JourneyNodeStatus = 'complete' | 'active' | 'ready' | 'support' | 'locked';

export interface JourneyNode {
  id: string;
  label: string;
  title: string;
  description: string;
  status: JourneyNodeStatus;
  actionLabel?: string;
  action?: () => void;
  disabled?: boolean;
  avatarSeed?: string;
}

export interface JourneyMapLabels {
  start: string;
  destinationTitle: string;
  destinationDescription: string;
  statusLabels: Record<JourneyNodeStatus, string>;
}

export interface JourneyMapLabelOverrides {
  start?: string;
  destinationTitle?: string;
  destinationDescription?: string;
  statusLabels?: Partial<Record<JourneyNodeStatus, string>>;
}

export interface JourneyMapProps {
  nodes: JourneyNode[];
  labels?: JourneyMapLabelOverrides;
  compact?: boolean;
  className?: string;
  testId?: string;
}

export const defaultJourneyMapLabels: JourneyMapLabels = {
  start: 'Your journey begins',
  destinationTitle: 'Learning confidence',
  destinationDescription: 'Built one step at a time',
  statusLabels: {
    complete: 'Complete',
    active: 'You are here',
    ready: 'Ready to begin',
    support: 'Focused support',
    locked: 'Locked',
  },
};

const tone = {
  complete: {
    badge: 'bg-emerald-600 text-white',
    ring: 'border-emerald-200 bg-emerald-50',
    label: 'text-emerald-700',
  },
  active: {
    badge: 'bg-sky-700 text-white',
    ring: 'border-sky-200 bg-sky-50',
    label: 'text-sky-700',
  },
  ready: {
    badge: 'bg-cyan-700 text-white',
    ring: 'border-cyan-200 bg-cyan-50',
    label: 'text-cyan-800',
  },
  support: {
    badge: 'bg-amber-500 text-white',
    ring: 'border-amber-200 bg-amber-50',
    label: 'text-amber-800',
  },
  locked: {
    badge: 'bg-slate-200 text-slate-500',
    ring: 'border-slate-200 bg-slate-50',
    label: 'text-slate-500',
  },
} satisfies Record<JourneyNodeStatus, Record<string, string>>;

function statusIcon(status: JourneyNodeStatus) {
  if (status === 'complete') return <Check className="h-4 w-4" aria-hidden="true" />;
  if (status === 'locked') return <LockKeyhole className="h-4 w-4" aria-hidden="true" />;
  if (status === 'active') return <CircleDot className="h-4 w-4" aria-hidden="true" />;
  return <Sparkles className="h-4 w-4" aria-hidden="true" />;
}

export function JourneyMap({
  nodes,
  labels,
  compact = false,
  className = '',
  testId = 'journey-map',
}: JourneyMapProps) {
  const reduceMotion = useReducedMotion();
  const copy: JourneyMapLabels = {
    ...defaultJourneyMapLabels,
    ...labels,
    statusLabels: {
      ...defaultJourneyMapLabels.statusLabels,
      ...labels?.statusLabels,
    },
  };

  return (
    <div
      className={`relative mx-auto w-full overflow-hidden ${compact ? 'max-w-4xl py-8' : 'max-w-5xl py-12 sm:py-16'} ${className}`}
      data-testid={testId}
    >
      <svg
        className="pointer-events-none absolute bottom-24 left-1 top-16 w-24 text-slate-200 sm:left-1/2 sm:w-72 sm:-translate-x-1/2"
        viewBox="0 0 240 1000"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M120 0 C230 125 10 250 120 375 C230 500 10 625 120 750 C230 875 10 940 120 1000"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeDasharray="3 14"
          strokeLinecap="round"
        />
      </svg>

      <div className="relative flex flex-col gap-12 sm:gap-16">
        <div className="ml-2 flex w-20 flex-col items-center gap-2 text-center sm:mx-auto">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{copy.start}</span>
          <span className="h-3 w-3 rounded-full border-2 border-slate-300 bg-slate-50 shadow-[0_0_0_5px_rgba(148,163,184,0.12)]" />
        </div>

        {nodes.map((node, index) => {
          const avatar = getAvatarForSeed(node.avatarSeed || node.id);
          const colors = tone[node.status];
          const reverse = index % 2 === 1;
          const actionable = Boolean(node.action) && node.status !== 'locked' && !node.disabled;
          const currentStatusLabel = copy.statusLabels[node.status];

          return (
            <motion.article
              key={node.id}
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduceMotion ? 0 : 0.4,
                delay: reduceMotion ? 0 : Math.min(index, 5) * 0.05,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={`relative flex w-full items-center gap-3 sm:mx-auto sm:max-w-3xl sm:gap-7 ${reverse ? 'sm:flex-row-reverse' : 'sm:flex-row'}`}
              aria-current={node.status === 'active' ? 'step' : undefined}
              aria-label={`${node.title}. ${currentStatusLabel}`}
              data-status={node.status}
            >
              <div className="relative h-32 w-24 flex-none sm:h-52 sm:w-44">
                <span className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 font-ghost text-[4rem] leading-none text-slate-900/[0.05] sm:text-[6.5rem]">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className={`absolute bottom-2 left-1/2 h-12 w-12 -translate-x-1/2 rounded-full border sm:h-20 sm:w-20 ${colors.ring}`} />
                <motion.div
                  className={`absolute inset-0 ${node.status === 'locked' ? 'grayscale opacity-45' : ''}`}
                  animate={!reduceMotion && node.status === 'active' ? { y: [0, -7, 0] } : undefined}
                  transition={!reduceMotion && node.status === 'active'
                    ? { duration: 4.5, repeat: Infinity, ease: 'easeInOut' }
                    : undefined}
                >
                  <Image
                    src={getAvatarDisplayPath(avatar.url)}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 96px, 176px"
                    className={`object-contain object-bottom drop-shadow-[0_16px_22px_rgba(15,23,42,0.18)] ${getAvatarScaleClass(avatar.url)}`}
                    unoptimized
                  />
                </motion.div>
                <span className={`absolute right-0 top-3 flex h-8 w-8 items-center justify-center rounded-full border-4 border-slate-50 shadow-sm ${colors.badge}`}>
                  {statusIcon(node.status)}
                </span>
              </div>

              <div className={`min-w-0 flex-1 rounded-lg border bg-white p-4 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.5)] sm:p-6 ${colors.ring}`}>
                <p className={`text-[10px] font-black uppercase tracking-[0.14em] ${colors.label}`}>
                  {node.label} <span aria-hidden="true">·</span> {currentStatusLabel}
                </p>
                <h3 className="mt-2 text-lg font-black leading-tight text-slate-950 sm:text-2xl">{node.title}</h3>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{node.description}</p>
                {node.actionLabel ? (
                  <button
                    type="button"
                    onClick={node.action}
                    disabled={!actionable}
                    aria-label={`${node.actionLabel}: ${node.title}`}
                    className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-slate-800 active:translate-y-px disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    <Play className="h-4 w-4" aria-hidden="true" />
                    {node.actionLabel}
                  </button>
                ) : null}
              </div>
            </motion.article>
          );
        })}

        <div className="ml-1 flex w-24 flex-col items-center gap-3 text-center sm:mx-auto sm:w-auto">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-800 shadow-sm">
            <Sparkles className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xl font-black text-slate-950 sm:text-2xl">{copy.destinationTitle}</p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{copy.destinationDescription}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
