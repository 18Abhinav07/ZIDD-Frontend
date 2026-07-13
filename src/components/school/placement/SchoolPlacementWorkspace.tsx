"use client";

import type { ReactNode, RefObject } from 'react';
import {
  ArrowLeftIcon,
  CheckCircledIcon,
  CheckIcon,
  ClipboardIcon,
  FileTextIcon,
  InfoCircledIcon,
  MagicWandIcon,
  PaperPlaneIcon,
  ReloadIcon,
  StopIcon,
} from '@radix-ui/react-icons';
import {
  SchoolStatusChip,
  schoolPrimaryActionClass,
  schoolSecondaryActionClass,
} from '@/components/school/SchoolPrimitives';
import type { SchoolPlacementResponse } from '@/services/schoolRebuild';

type PlacementStage = SchoolPlacementResponse['stage'];

const PLACEMENT_STAGES: Array<{
  id: PlacementStage;
  label: string;
  description: string;
}> = [
  {
    id: 'snapshot',
    label: 'Snapshot',
    description: 'A quick look across key skills',
  },
  {
    id: 'targeted_diagnostic',
    label: 'Focused Check',
    description: 'Questions chosen from your answers',
  },
  {
    id: 'confirmatory',
    label: 'Confirmation',
    description: 'A final check, only when needed',
  },
];

export function placementStageLabel(stage: PlacementStage) {
  return PLACEMENT_STAGES.find((entry) => entry.id === stage)?.label ?? 'Snapshot';
}

interface PlacementStageRailProps {
  placement: SchoolPlacementResponse | null;
}

export function PlacementStageRail({ placement }: PlacementStageRailProps) {
  const activeIndex = placement
    ? PLACEMENT_STAGES.findIndex((entry) => entry.id === placement.stage)
    : -1;
  const finished = placement !== null && placement.status !== 'in_progress';

  return (
    <div className="mx-auto max-w-sm xl:mx-0">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase text-[var(--school-accent-deep)]">
            Starting-point check
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">Three short stages</p>
        </div>
        {placement ? (
          <p
            data-testid="school-placement-progress"
            className="text-right text-[11px] font-semibold leading-5 text-slate-500"
          >
            {placementStageLabel(placement.stage)}
            <br />
            {placement.answered_count}/{placement.max_items} answered
          </p>
        ) : null}
      </div>

      <ol className="mt-5 grid grid-cols-3 gap-2 xl:grid-cols-1 xl:gap-0">
        {PLACEMENT_STAGES.map((stage, index) => {
          const complete = index < activeIndex || (finished && index === activeIndex);
          const current = !finished && index === activeIndex;
          return (
            <li
              key={stage.id}
              aria-current={current ? 'step' : undefined}
              className="relative min-w-0 xl:flex xl:gap-3 xl:pb-5"
            >
              {index < PLACEMENT_STAGES.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={`absolute left-[calc(50%+1rem)] right-[calc(-50%+1rem)] top-4 h-px xl:bottom-0 xl:left-4 xl:right-auto xl:top-8 xl:h-auto xl:w-px ${
                    complete ? 'bg-teal-500' : 'bg-slate-200'
                  }`}
                />
              ) : null}
              <span
                className={`relative z-10 mx-auto flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold xl:mx-0 xl:flex-none ${
                  complete
                    ? 'border-teal-600 bg-teal-600 text-white'
                    : current
                      ? 'border-[var(--school-accent)] bg-[var(--school-accent-soft)] text-[var(--school-accent-deep)]'
                      : 'border-slate-200 bg-[var(--school-surface,#fcfdff)] text-slate-400'
                }`}
              >
                {complete ? <CheckIcon className="h-4 w-4" aria-hidden="true" /> : index + 1}
              </span>
              <div className="mt-2 min-w-0 text-center xl:mt-0 xl:text-left">
                <p className={`text-xs font-semibold sm:text-sm ${current ? 'text-slate-950' : 'text-slate-500'}`}>
                  {stage.label}
                </p>
                <p className="mt-1 hidden text-xs leading-5 text-slate-500 sm:block">
                  {stage.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs leading-5 text-slate-500 xl:mt-0">
        Confirmation is skipped when your answers are already clear.
      </p>
    </div>
  );
}

interface SchoolPlacementActivityProps {
  placement: SchoolPlacementResponse | null;
  targetClassNo: number | null;
  canStartPlacement: boolean;
  placementLoadFailed: boolean;
  placementRedirecting: boolean;
  starting: boolean;
  submitting: boolean;
  abandoning: boolean;
  confirmingAbandon: boolean;
  answer: string;
  error: string;
  questionHeadingRef: RefObject<HTMLHeadingElement>;
  onAnswerChange: (answer: string) => void;
  onBegin: () => void;
  onSubmit: (answer?: string) => void;
  onRequestAbandon: () => void;
  onCancelAbandon: () => void;
  onConfirmAbandon: () => void;
  onRefresh: () => void;
  onReturnToSchool: () => void;
  onViewReport: () => void;
}

function ActionButton({
  children,
  icon,
  onClick,
  disabled = false,
  tone = 'primary',
}: {
  children: ReactNode;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'danger';
}) {
  const toneClass = tone === 'primary'
    ? schoolPrimaryActionClass
    : tone === 'danger'
      ? 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-800 bg-red-800 px-4 py-2.5 text-sm font-semibold text-white transition-[transform,background-color,opacity] hover:bg-red-700 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55'
      : schoolSecondaryActionClass;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={toneClass}
    >
      {icon}
      {children}
    </button>
  );
}

function MessagePanel({
  eyebrow,
  title,
  body,
  icon,
  tone = 'plain',
  children,
  role,
}: {
  eyebrow: string;
  title: string;
  body: string;
  icon: ReactNode;
  tone?: 'plain' | 'warning' | 'error';
  children?: ReactNode;
  role?: 'alert' | 'status';
}) {
  const toneClass = tone === 'warning'
    ? 'border-orange-200 bg-orange-50/70'
    : tone === 'error'
      ? 'border-red-200 bg-red-50/70'
      : 'border-[var(--school-accent-border)] bg-[var(--school-accent-soft)]';
  const iconClass = tone === 'warning'
    ? 'bg-orange-100 text-orange-800'
    : tone === 'error'
      ? 'bg-red-100 text-red-800'
      : 'bg-[var(--school-surface,#fcfdff)] text-[var(--school-accent-deep)]';

  return (
    <section role={role} aria-live={role === 'status' ? 'polite' : undefined} className={`rounded-2xl border p-5 sm:p-7 ${toneClass}`}>
      <div className="flex items-start gap-4">
        <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-lg ${iconClass}`}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase text-[var(--school-accent-deep)]">{eyebrow}</p>
          <h2 className="mt-2 font-display text-[2rem] font-normal leading-[1.05] text-slate-950 sm:text-[2.4rem]">{title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{body}</p>
        </div>
      </div>
      {children ? <div className="mt-6 flex flex-col gap-3 sm:flex-row">{children}</div> : null}
    </section>
  );
}

export function SchoolPlacementActivity({
  placement,
  targetClassNo,
  canStartPlacement,
  placementLoadFailed,
  placementRedirecting,
  starting,
  submitting,
  abandoning,
  confirmingAbandon,
  answer,
  error,
  questionHeadingRef,
  onAnswerChange,
  onBegin,
  onSubmit,
  onRequestAbandon,
  onCancelAbandon,
  onConfirmAbandon,
  onRefresh,
  onReturnToSchool,
  onViewReport,
}: SchoolPlacementActivityProps) {
  const item = placement?.next_item ?? null;

  if (placementRedirecting) {
    return (
      <MessagePanel
        role="status"
        eyebrow="Check complete"
        title="Opening your starting-point report"
        body="Your answers are saved. We are taking you to the path chosen from them."
        icon={<FileTextIcon className="h-5 w-5" aria-hidden="true" />}
      />
    );
  }

  if (placementLoadFailed) {
    return (
      <MessagePanel
        role="alert"
        tone="error"
        eyebrow="Could not open the check"
        title="Let's try that again"
        body={error || 'Return to your School path or retry loading your saved check.'}
        icon={<ReloadIcon className="h-5 w-5" aria-hidden="true" />}
      >
        <ActionButton tone="danger" icon={<ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />} onClick={onReturnToSchool}>
          Return to School
        </ActionButton>
        <ActionButton tone="secondary" icon={<ReloadIcon className="h-4 w-4" aria-hidden="true" />} onClick={onRefresh}>
          Retry loading
        </ActionButton>
      </MessagePanel>
    );
  }

  if (!placement) {
    return (
      <MessagePanel
        eyebrow="Before your lessons"
        title="Let's find the right place to begin"
        body={`You will answer a few English questions for Class ${targetClassNo ?? 'your class'}. This is not a school exam, and there are no marks.`}
        icon={<ClipboardIcon className="h-5 w-5" aria-hidden="true" />}
      >
        <ActionButton tone="secondary" icon={<ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />} onClick={onReturnToSchool}>
          Back
        </ActionButton>
        {canStartPlacement ? (
          <ActionButton
            icon={<MagicWandIcon className="h-4 w-4" aria-hidden="true" />}
            onClick={onBegin}
            disabled={starting}
          >
            <span className="min-w-[10.5rem] text-center">
              {starting ? 'Starting your check' : 'Begin the check'}
            </span>
          </ActionButton>
        ) : null}
        {error ? <p role="alert" className="w-full text-sm font-semibold text-red-800">{error}</p> : null}
      </MessagePanel>
    );
  }

  if (item) {
    return (
      <section data-testid="school-placement-card" className="flex min-h-full flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-7">
          <div>
            <p className="text-[10px] font-semibold uppercase text-[var(--school-accent-deep)]">
              {placementStageLabel(placement.stage)}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {placement.answered_count} answered so far
            </p>
          </div>
          <div className="flex items-center gap-2">
            {placement.status === 'in_progress' ? (
              <button
                type="button"
                onClick={onRequestAbandon}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-[var(--school-surface,#fcfdff)] px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                <StopIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Stop check
              </button>
            ) : null}
            <button
              type="button"
              onClick={onRefresh}
              aria-label="Refresh readiness check"
              title="Refresh readiness check"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-[var(--school-surface,#fcfdff)] text-slate-600 transition-colors hover:bg-slate-50"
            >
              <ReloadIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {confirmingAbandon ? (
          <section role="region" aria-labelledby="stop-readiness-title" className="border-b border-orange-200 bg-orange-50 px-4 py-4 text-orange-950 sm:px-7">
            <h2 id="stop-readiness-title" className="text-base font-semibold">Stop this readiness check?</h2>
            <p className="mt-1 text-sm font-semibold leading-6">
              Your answers stay saved, but an unfinished check cannot choose your class path.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <ActionButton tone="secondary" icon={<ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />} onClick={onCancelAbandon} disabled={abandoning}>
                Keep going
              </ActionButton>
              <ActionButton tone="danger" icon={<StopIcon className="h-4 w-4" aria-hidden="true" />} onClick={onConfirmAbandon} disabled={abandoning}>
                <span className="min-w-[9rem] text-center">
                  {abandoning ? 'Stopping safely' : 'Stop for now'}
                </span>
              </ActionButton>
            </div>
          </section>
        ) : null}

        <div className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto max-w-3xl">
            <SchoolStatusChip>{item.learner_skill_label}</SchoolStatusChip>
            <p data-testid="school-placement-instruction" className="mt-3 text-sm font-medium leading-6 text-slate-600">
              {item.instruction}
            </p>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-5 sm:px-5">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Read this</p>
              <p data-testid="school-placement-passage" className="mt-2 font-display text-[1.35rem] font-normal leading-8 text-slate-800 sm:text-[1.55rem]">
                {item.passage}
              </p>
            </div>

            <h2
              ref={questionHeadingRef}
              data-testid="school-placement-question"
              tabIndex={-1}
              aria-live="polite"
              className="mt-7 font-display text-[2rem] font-normal leading-[1.08] text-slate-950 outline-none sm:text-[2.35rem]"
            >
              {item.prompt}
            </h2>

            {item.options?.length ? (
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {item.options.map((option, index) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onSubmit(option)}
                    disabled={submitting}
                    className="group flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 bg-[var(--school-surface,#fcfdff)] px-4 py-3 text-left text-sm font-semibold text-slate-800 transition-[background-color,border-color,color] hover:border-[var(--school-accent)] hover:bg-[var(--school-accent-soft)] disabled:cursor-wait disabled:opacity-60"
                  >
                    <span aria-hidden="true" className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-500 group-hover:bg-[var(--school-surface,#fcfdff)]">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span>{option}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-7">
                <label htmlFor="school-placement-answer" className="block text-sm font-semibold text-slate-800">Your answer</label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                  <input
                    id="school-placement-answer"
                    value={answer}
                    onChange={(event) => onAnswerChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') onSubmit();
                    }}
                    disabled={submitting}
                    placeholder="Type your answer"
                    className="min-h-12 flex-1 rounded-xl border border-slate-300 bg-[var(--school-surface,#fcfdff)] px-4 py-3 text-base font-medium text-slate-900 outline-none transition-[border-color,box-shadow] focus:border-[var(--school-accent)] focus:ring-4 focus:ring-[var(--school-accent-soft)] disabled:bg-slate-50"
                  />
                  <ActionButton
                    icon={submitting ? <CheckIcon className="h-4 w-4" aria-hidden="true" /> : <PaperPlaneIcon className="h-4 w-4" aria-hidden="true" />}
                    onClick={() => onSubmit()}
                    disabled={submitting || !answer.trim()}
                  >
                    <span className="min-w-[7.5rem] text-center">
                      {submitting ? 'Checking your answer' : 'Check answer'}
                    </span>
                  </ActionButton>
                </div>
              </div>
            )}

            <div data-testid="school-placement-support" className="mt-5 flex items-start gap-3 rounded-xl bg-[var(--school-accent-soft)] px-4 py-3 text-sm leading-6 text-slate-700">
              <InfoCircledIcon className="mt-0.5 h-4 w-4 flex-none text-[var(--school-accent-deep)]" aria-hidden="true" />
              <p>{item.support}</p>
            </div>

            {submitting && item.options?.length ? (
              <p role="status" aria-live="polite" className="mt-5 text-sm font-semibold text-[var(--school-accent-deep)]">
                Checking your answer...
              </p>
            ) : null}
            {error ? <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</p> : null}
          </div>
        </div>
      </section>
    );
  }

  if (placement.status === 'target_ready' || placement.status === 'below_target') {
    return (
      <MessagePanel
        role="status"
        eyebrow="All done"
        title="Your starting path is ready"
        body="You gave enough answers for Zidd to choose what you should learn next."
        icon={<CheckCircledIcon className="h-5 w-5" aria-hidden="true" />}
      >
        <ActionButton icon={<FileTextIcon className="h-4 w-4" aria-hidden="true" />} onClick={onViewReport}>
          View readiness report
        </ActionButton>
      </MessagePanel>
    );
  }

  if (placement.status === 'insufficient_evidence') {
    return (
      <MessagePanel
        role="status"
        tone="warning"
        eyebrow="A few answers are still needed"
        title="Let's finish finding your starting point"
        body="Your work is saved. Continue from here so Zidd can choose the right lessons for you."
        icon={<ClipboardIcon className="h-5 w-5" aria-hidden="true" />}
      >
        <ActionButton icon={<ReloadIcon className="h-4 w-4" aria-hidden="true" />} onClick={onRefresh}>
          Continue the check
        </ActionButton>
        <ActionButton tone="secondary" icon={<ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />} onClick={onReturnToSchool}>
          Back to School
        </ActionButton>
      </MessagePanel>
    );
  }

  if (placement.status === 'abandoned') {
    return (
      <MessagePanel
        role="status"
        eyebrow="Check stopped"
        title="No starting point was chosen"
        body="Your answers are saved in the report. You can start a new check from your School path."
        icon={<StopIcon className="h-5 w-5" aria-hidden="true" />}
      >
        <ActionButton icon={<FileTextIcon className="h-4 w-4" aria-hidden="true" />} onClick={onViewReport}>
          View saved report
        </ActionButton>
        <ActionButton tone="secondary" icon={<ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />} onClick={onReturnToSchool}>
          Back to School
        </ActionButton>
      </MessagePanel>
    );
  }

  if (placement.status === 'in_progress') {
    return (
      <MessagePanel
        role="status"
        eyebrow="Your check is saved"
        title="The next question is getting ready"
        body="Refresh to continue from this same place."
        icon={<ReloadIcon className="h-5 w-5" aria-hidden="true" />}
      >
        <ActionButton icon={<ReloadIcon className="h-4 w-4" aria-hidden="true" />} onClick={onRefresh}>
          Refresh
        </ActionButton>
      </MessagePanel>
    );
  }

  return (
    <MessagePanel
      role="alert"
      tone="error"
      eyebrow="Check unavailable"
      title="Return to your School path"
      body="Zidd could not recognize this saved check safely."
      icon={<ReloadIcon className="h-5 w-5" aria-hidden="true" />}
    >
      <ActionButton tone="danger" icon={<ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />} onClick={onReturnToSchool}>
        Back to School
      </ActionButton>
    </MessagePanel>
  );
}
