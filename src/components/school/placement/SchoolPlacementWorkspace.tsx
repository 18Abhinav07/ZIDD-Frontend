"use client";

import Image from 'next/image';
import type { ReactNode, RefObject } from 'react';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircledIcon,
  CheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FileTextIcon,
  InfoCircledIcon,
  MagicWandIcon,
  PaperPlaneIcon,
  PauseIcon,
  ReloadIcon,
  StopIcon,
} from '@radix-ui/react-icons';
import {
  SchoolStatusChip,
  schoolPrimaryActionClass,
  schoolSecondaryActionClass,
} from '@/components/school/SchoolPrimitives';
import { getAvatarScaleClass } from '@/lib/avatarRegistry';
import { getSchoolAvatarTheme } from '@/lib/schoolTheme';
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
    <div data-testid="school-placement-progress" className="min-w-0 flex-1 sm:max-w-md">
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[10px] font-semibold uppercase text-[var(--school-muted)]">
          Starting point
        </p>
        <p className="text-xs font-semibold text-slate-500">
          {placement ? `${placement.answered_count} of ${placement.max_items} answered` : 'Ready'}
        </p>
      </div>
      <ol className="mt-2 grid grid-cols-3 gap-1.5" aria-label="Starting-point stages">
        {PLACEMENT_STAGES.map((stage, index) => {
          const complete = index < activeIndex || (finished && index === activeIndex);
          const current = !finished && index === activeIndex;
          return (
            <li key={stage.id} aria-current={current ? 'step' : undefined} className="min-w-0">
              <span
                className={`block h-1 rounded-full ${
                  complete || current ? 'bg-[var(--school-accent)]' : 'bg-slate-200'
                }`}
                aria-hidden="true"
              />
              <span className={`mt-2 hidden text-[10px] font-semibold sm:block ${current ? 'text-slate-800' : 'text-slate-500'}`}>
                {stage.label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="sr-only">
        {placement ? `${placementStageLabel(placement.stage)} stage` : 'The check has not started'}.
        Confirmation is skipped when the saved evidence is already clear.
      </p>
    </div>
  );
}

interface SchoolPlacementActivityProps {
  placement: SchoolPlacementResponse | null;
  targetClassNo: number | null;
  coachAvatarId: string | null | undefined;
  coachPaletteId: string | null | undefined;
  canStartPlacement: boolean;
  placementLoadFailed: boolean;
  placementRedirecting: boolean;
  placementRecoveryRequired: boolean;
  awaitingEvaluation: boolean;
  reportAvailable: boolean;
  stateMessage: string;
  starting: boolean;
  submitting: boolean;
  abandoning: boolean;
  confirmingAbandon: boolean;
  answer: string;
  error: string;
  questionHeadingRef: RefObject<HTMLHeadingElement>;
  onAnswerChange: (answer: string) => void;
  onBegin: () => void;
  onSubmit: () => void;
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
    <button type="button" onClick={onClick} disabled={disabled} className={toneClass}>
      {icon}
      {children}
    </button>
  );
}

export function SchoolPlacementSkeleton() {
  return (
    <main
      className="mx-auto grid min-h-[calc(100dvh-68px)] w-full max-w-[1240px] items-center gap-10 px-4 py-12 sm:px-7 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.72fr)] lg:px-10"
      aria-busy="true"
      aria-label="Loading starting-point check"
    >
      <div className="space-y-5">
        <div className="h-3 w-44 animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none" />
        <div className="h-16 w-full max-w-xl animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />
        <div className="h-4 w-full max-w-lg animate-pulse rounded-full bg-slate-100 motion-reduce:animate-none" />
        <div className="h-11 w-40 animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none" />
      </div>
      <div className="mx-auto h-[370px] w-full max-w-[420px] animate-pulse rounded-t-[48%] rounded-b-[30px] border border-slate-200 bg-slate-100 motion-reduce:animate-none lg:h-[520px]" />
    </main>
  );
}

function PlacementCoachScene({
  avatarId,
  paletteId,
}: {
  avatarId: string | null | undefined;
  paletteId: string | null | undefined;
}) {
  const theme = getSchoolAvatarTheme(avatarId, paletteId);

  return (
    <div
      className="relative mx-auto min-h-[370px] w-full max-w-[450px] overflow-hidden rounded-t-[48%] rounded-b-[30px] border border-[var(--school-accent-border)] bg-[var(--school-accent-soft)] lg:min-h-[520px]"
      style={theme.style}
    >
      <span aria-hidden="true" className="absolute left-1/2 top-14 h-[min(72vw,300px)] w-[min(72vw,300px)] -translate-x-1/2 rounded-full border border-[var(--school-accent-border)] opacity-80" />
      <span aria-hidden="true" className="absolute left-1/2 top-24 h-[min(52vw,214px)] w-[min(52vw,214px)] -translate-x-1/2 rounded-full border border-[var(--school-accent-border)] opacity-55" />
      <div className="absolute right-4 top-7 z-20 max-w-[142px] rounded-xl border border-[var(--school-accent-border)] bg-[var(--school-paper)] px-3 py-2.5 shadow-[0_12px_30px_rgba(30,37,63,0.08)] sm:right-6">
        <strong className="block text-[11px] font-semibold text-slate-700">Your coach</strong>
        <span className="mt-1 block text-[10px] leading-4 text-slate-500">I will guide each prompt.</span>
      </div>
      <Image
        src={theme.avatar.url}
        alt="Your Zidd School coach ready to guide the starting point"
        fill
        sizes="(max-width: 860px) 92vw, 450px"
        className={`z-10 object-contain object-bottom ${getAvatarScaleClass(theme.avatar.url)}`}
        priority
      />
    </div>
  );
}

function PlacementTerminal({
  eyebrow,
  title,
  body,
  icon,
  tone = 'accent',
  note,
  role,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  icon: ReactNode;
  tone?: 'accent' | 'success' | 'warning' | 'error';
  note?: ReactNode;
  role?: 'status' | 'alert';
  children?: ReactNode;
}) {
  const markClass = tone === 'success'
    ? 'border-teal-200 bg-teal-50 text-teal-800'
    : tone === 'warning'
      ? 'border-orange-200 bg-orange-50 text-orange-800'
      : tone === 'error'
        ? 'border-red-200 bg-red-50 text-red-800'
        : 'border-[var(--school-accent-border)] bg-[var(--school-accent-soft)] text-[var(--school-accent-deep)]';

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-68px)] w-full max-w-[900px] flex-col items-start justify-center px-4 py-14 sm:px-7 lg:px-10 lg:py-20">
      <section role={role} aria-live={role === 'status' ? 'polite' : undefined} className="w-full">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${markClass}`} aria-hidden="true">
          {icon}
        </div>
        <p className="mt-7 font-mono text-[10px] font-semibold uppercase text-[var(--school-accent-deep)]">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl font-display text-[2.75rem] font-normal leading-[1.02] text-slate-950 sm:text-[3.5rem]">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--school-muted)] sm:text-base sm:leading-7">{body}</p>
        {note ? <div className="mt-6 max-w-2xl border-y border-[var(--school-line)] py-4 text-sm leading-6 text-slate-600">{note}</div> : null}
        {children ? <div className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">{children}</div> : null}
      </section>
    </main>
  );
}

export function SchoolPlacementActivity({
  placement,
  targetClassNo,
  coachAvatarId,
  coachPaletteId,
  canStartPlacement,
  placementLoadFailed,
  placementRedirecting,
  placementRecoveryRequired,
  awaitingEvaluation,
  reportAvailable,
  stateMessage,
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
      <PlacementTerminal
        role="status"
        eyebrow="Saved School state"
        title="Opening your current School step"
        body="Your latest backend-approved path is ready. This page will move there without changing your saved work."
        icon={<ArrowRightIcon className="h-6 w-6" />}
      />
    );
  }

  if (placementLoadFailed) {
    return (
      <PlacementTerminal
        role="alert"
        tone="error"
        eyebrow="Could not open the check"
        title="Your saved starting point could not be loaded"
        body={error || 'Return to your School path or retry loading the canonical check.'}
        icon={<ExclamationTriangleIcon className="h-6 w-6" />}
      >
        <ActionButton icon={<ReloadIcon className="h-4 w-4" />} onClick={onRefresh}>Retry loading</ActionButton>
        <ActionButton tone="secondary" icon={<ArrowLeftIcon className="h-4 w-4" />} onClick={onReturnToSchool}>Back to School</ActionButton>
      </PlacementTerminal>
    );
  }

  if (placementRecoveryRequired) {
    return (
      <PlacementTerminal
        role="alert"
        tone="warning"
        eyebrow="Saved work needs recovery"
        title="Current School step needs confirmation"
        body={stateMessage || 'No next question is available until the current School session and profile version are confirmed.'}
        icon={<ExclamationTriangleIcon className="h-6 w-6" />}
        note="Answering is disabled in this recovery state so a mutation response cannot replace authoritative School state."
      >
        <ActionButton icon={<ReloadIcon className="h-4 w-4" />} onClick={onRefresh}>Refresh School state</ActionButton>
        <ActionButton tone="secondary" icon={<ArrowLeftIcon className="h-4 w-4" />} onClick={onReturnToSchool}>Back to School</ActionButton>
      </PlacementTerminal>
    );
  }

  if (awaitingEvaluation) {
    return (
      <PlacementTerminal
        role="status"
        eyebrow="Answer saved"
        title="Your answer is still being checked"
        body={stateMessage || 'Stay on this page. Zidd will reload this same check when the next question or report is ready.'}
        icon={<ClockIcon className="h-6 w-6" />}
        note={answer ? <p>Your response stays visible here while checking: <strong className="text-slate-800">{answer}</strong></p> : undefined}
      >
        <ActionButton tone="secondary" icon={<ReloadIcon className="h-4 w-4" />} onClick={onRefresh}>Refresh now</ActionButton>
      </PlacementTerminal>
    );
  }

  if (!placement) {
    return (
      <main className="mx-auto grid min-h-[calc(100dvh-68px)] w-full max-w-[1240px] items-center gap-10 px-4 py-10 sm:px-7 sm:py-14 lg:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.72fr)] lg:gap-[clamp(3.5rem,8vw,7rem)] lg:px-10">
        <section className="min-w-0">
          <p className="font-mono text-[10px] font-semibold uppercase text-[var(--school-accent-deep)]">Find the right first step</p>
          <h1 className="mt-3 max-w-[650px] font-display text-[3rem] font-normal leading-[0.98] text-slate-950 sm:text-[4rem]">
            A starting point, not a test.
          </h1>
          <p className="mt-5 max-w-[620px] text-sm leading-6 text-[var(--school-muted)] sm:text-base sm:leading-7">
            A few reading and writing prompts help choose where Class {targetClassNo ?? 'your class'} learning should begin. We look for useful evidence, not marks.
          </p>
          {error ? <p role="alert" className="mt-4 max-w-xl text-sm font-semibold text-red-800">{error}</p> : null}
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            {canStartPlacement ? (
              <ActionButton icon={<MagicWandIcon className="h-4 w-4" />} onClick={onBegin} disabled={starting}>
                <span className="min-w-[8rem] text-center">{starting ? 'Starting safely' : 'Begin'}</span>
                {!starting ? <ArrowRightIcon className="h-4 w-4" /> : null}
              </ActionButton>
            ) : (
              <ActionButton icon={<ReloadIcon className="h-4 w-4" />} onClick={onRefresh}>Refresh School state</ActionButton>
            )}
            {reportAvailable ? (
              <ActionButton tone="secondary" icon={<FileTextIcon className="h-4 w-4" />} onClick={onViewReport}>See my starting point</ActionButton>
            ) : null}
          </div>
          <p className="mt-5 flex items-center gap-2 text-[11px] text-slate-500">
            <ClockIcon className="h-4 w-4 flex-none" aria-hidden="true" />
            <span>About 8 minutes. Pause whenever you need.</span>
          </p>
        </section>
        <PlacementCoachScene avatarId={coachAvatarId} paletteId={coachPaletteId} />
      </main>
    );
  }

  if (item) {
    return (
      <main className="mx-auto min-h-[calc(100dvh-68px)] w-full max-w-[940px] px-4 pb-16 pt-8 sm:px-7 lg:px-10 lg:pt-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <button
            type="button"
            onClick={onReturnToSchool}
            className="inline-flex min-h-11 items-center gap-2 self-start px-1 text-xs font-semibold text-slate-600 hover:text-slate-950"
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            School
          </button>
          <PlacementStageRail placement={placement} />
        </div>

        <article data-testid="school-placement-card" className="mt-6 overflow-hidden rounded-[28px] border border-[var(--school-line)] bg-[var(--school-paper)] shadow-[var(--school-shadow)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--school-line)] px-5 py-3 sm:px-8">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase text-[var(--school-accent-deep)]">{placementStageLabel(placement.stage)}</p>
              <p className="mt-1 text-xs text-slate-500">{placement.answered_count} answered so far</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRequestAbandon}
                disabled={submitting}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <StopIcon className="h-4 w-4" aria-hidden="true" />
                Stop for now
              </button>
              <button
                type="button"
                onClick={onRefresh}
                disabled={submitting}
                aria-label="Refresh starting-point check"
                title="Refresh starting-point check"
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--school-line)] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <ReloadIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {confirmingAbandon ? (
            <section role="region" aria-labelledby="stop-starting-point-title" className="border-b border-orange-200 bg-orange-50 px-5 py-5 text-orange-950 sm:px-8">
              <h2 id="stop-starting-point-title" className="text-base font-semibold">Stop this starting point?</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6">Your answers stay saved, but an unfinished check cannot choose a learning path.</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <ActionButton tone="secondary" icon={<ArrowLeftIcon className="h-4 w-4" />} onClick={onCancelAbandon} disabled={abandoning}>Keep going</ActionButton>
                <ActionButton tone="danger" icon={<StopIcon className="h-4 w-4" />} onClick={onConfirmAbandon} disabled={abandoning}>
                  <span className="min-w-[8rem] text-center">{abandoning ? 'Stopping safely' : 'Stop for now'}</span>
                </ActionButton>
              </div>
            </section>
          ) : null}

          <div className="px-5 py-7 sm:px-10 sm:py-10">
            <div className="mx-auto max-w-3xl">
              <SchoolStatusChip>{item.learner_skill_label}</SchoolStatusChip>
              <p data-testid="school-placement-instruction" className="mt-3 text-sm leading-6 text-slate-600">{item.instruction}</p>

              {item.passage ? (
                <div className="mt-6 border-l-2 border-[var(--school-accent-border)] pl-5">
                  <p className="font-mono text-[10px] font-semibold uppercase text-slate-500">Read this</p>
                  <p data-testid="school-placement-passage" className="mt-3 font-display text-[1.4rem] font-normal leading-8 text-slate-800 sm:text-[1.6rem]">{item.passage}</p>
                </div>
              ) : null}

              <h1
                ref={questionHeadingRef}
                data-testid="school-placement-question"
                tabIndex={-1}
                aria-live="polite"
                className="mt-8 max-w-3xl font-display text-[2rem] font-normal leading-[1.08] text-slate-950 outline-none sm:text-[2.45rem]"
              >
                {item.prompt}
              </h1>

              {item.options?.length ? (
                <fieldset className="mt-7" disabled={submitting}>
                  <legend className="sr-only">Choose one answer</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {item.options.map((option, index) => (
                      <label
                        key={option}
                        htmlFor={`school-placement-option-${index}`}
                        className={`group flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold text-slate-800 transition-[background-color,border-color,color] ${
                          answer === option
                            ? 'border-[var(--school-accent)] bg-[var(--school-accent-soft)]'
                            : 'border-slate-200 bg-[var(--school-paper)] hover:border-[var(--school-accent)] hover:bg-[var(--school-accent-soft)]'
                        }`}
                      >
                        <input
                          id={`school-placement-option-${index}`}
                          type="radio"
                          name="school-placement-answer"
                          value={option}
                          checked={answer === option}
                          onChange={() => onAnswerChange(option)}
                          disabled={submitting}
                          className="h-4 w-4 flex-none accent-[var(--school-accent)]"
                        />
                        <span aria-hidden="true" className="font-mono text-[10px] font-semibold text-slate-400">{String.fromCharCode(65 + index)}</span>
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <ActionButton icon={submitting ? <ClockIcon className="h-4 w-4" /> : <CheckIcon className="h-4 w-4" />} onClick={() => onSubmit()} disabled={submitting || !answer.trim()}>
                      <span className="min-w-[8rem] text-center">{submitting ? 'Checking safely' : 'Check my answer'}</span>
                    </ActionButton>
                  </div>
                </fieldset>
              ) : (
                <div className="mt-7">
                  <label htmlFor="school-placement-answer" className="block text-sm font-semibold text-slate-800">Your answer</label>
                  <textarea
                    id="school-placement-answer"
                    value={answer}
                    onChange={(event) => onAnswerChange(event.target.value)}
                    disabled={submitting}
                    rows={4}
                    placeholder="Write one or two sentences"
                    className="mt-2 min-h-28 w-full resize-y rounded-xl border border-slate-300 bg-[var(--school-paper)] px-4 py-3 text-base leading-6 text-slate-900 outline-none transition-[border-color,box-shadow] focus:border-[var(--school-accent)] focus:ring-4 focus:ring-[var(--school-accent-soft)] disabled:bg-slate-50"
                  />
                  <div className="mt-4 flex justify-end">
                    <ActionButton icon={submitting ? <ClockIcon className="h-4 w-4" /> : <PaperPlaneIcon className="h-4 w-4" />} onClick={() => onSubmit()} disabled={submitting || !answer.trim()}>
                      <span className="min-w-[8rem] text-center">{submitting ? 'Checking safely' : 'Submit answer'}</span>
                    </ActionButton>
                  </div>
                </div>
              )}

              {item.support ? (
                <div data-testid="school-placement-support" className="mt-5 flex items-start gap-3 border-y border-[var(--school-line)] py-3 text-sm leading-6 text-slate-600">
                  <InfoCircledIcon className="mt-1 h-4 w-4 flex-none text-[var(--school-accent-deep)]" aria-hidden="true" />
                  <p>{item.support}</p>
                </div>
              ) : <div data-testid="school-placement-support" className="sr-only">No extra prompt support was provided.</div>}

              {submitting ? <p role="status" aria-live="polite" className="mt-5 text-sm font-semibold text-[var(--school-accent-deep)]">Your answer is being checked. Please keep this page open.</p> : null}
              {error ? <p role="alert" className="mt-5 border-y border-red-200 bg-red-50 px-3 py-3 text-sm font-semibold text-red-800">{error}</p> : null}
            </div>
          </div>
        </article>
      </main>
    );
  }

  if (placement.status === 'target_ready' || placement.status === 'below_target') {
    return (
      <PlacementTerminal
        role="status"
        tone="success"
        eyebrow="Starting point saved"
        title="Your first learning path is ready"
        body="Your report explains what the saved evidence supports and shows the next School step authorized by the backend."
        icon={<CheckCircledIcon className="h-6 w-6" />}
        note="This is an evidence summary, not a mark or rank."
      >
        <ActionButton icon={<ReloadIcon className="h-4 w-4" />} onClick={onRefresh}>Open current School step</ActionButton>
        {reportAvailable ? (
          <ActionButton tone="secondary" icon={<FileTextIcon className="h-4 w-4" />} onClick={onViewReport}>See my starting point</ActionButton>
        ) : null}
      </PlacementTerminal>
    );
  }

  if (placement.status === 'insufficient_evidence') {
    return (
      <PlacementTerminal
        role="status"
        tone="warning"
        eyebrow="More evidence needed"
        title="This saved check cannot continue yet"
        body="The backend has no additional question for this saved session. Starting again could replace your saved answers, so Zidd will not restart it here."
        icon={<PauseIcon className="h-6 w-6" />}
        note={stateMessage || 'No learning path, class readiness, or unlock has been assigned from this incomplete evidence.'}
      >
        <ActionButton icon={<ArrowLeftIcon className="h-4 w-4" />} onClick={onReturnToSchool}>Back to School</ActionButton>
        <ActionButton tone="secondary" icon={<ReloadIcon className="h-4 w-4" />} onClick={onRefresh}>Check for another question</ActionButton>
      </PlacementTerminal>
    );
  }

  if (placement.status === 'abandoned') {
    return (
      <PlacementTerminal
        role="status"
        tone="warning"
        eyebrow="Saved for later"
        title="Your starting point is paused"
        body="The answers already given are saved. No learning path has been assigned from partial work."
        icon={<PauseIcon className="h-6 w-6" />}
      >
        <ActionButton icon={<ReloadIcon className="h-4 w-4" />} onClick={onRefresh}>Open current School step</ActionButton>
        {reportAvailable ? (
          <ActionButton tone="secondary" icon={<FileTextIcon className="h-4 w-4" />} onClick={onViewReport}>View saved evidence</ActionButton>
        ) : null}
      </PlacementTerminal>
    );
  }

  if (placement.status === 'in_progress') {
    return (
      <PlacementTerminal
        role="status"
        tone="warning"
        eyebrow="Question unavailable"
        title="The next question is not available yet"
        body="Everything already answered is safe. Refresh this same session instead of starting a new check."
        icon={<ReloadIcon className="h-6 w-6" />}
      >
        <ActionButton icon={<ReloadIcon className="h-4 w-4" />} onClick={onRefresh}>Refresh this check</ActionButton>
      </PlacementTerminal>
    );
  }

  return (
    <PlacementTerminal
      role="alert"
      tone="error"
      eyebrow="Check unavailable"
      title="Return to your School path"
      body="Zidd could not recognize this saved check safely, so no progression has been inferred."
      icon={<ExclamationTriangleIcon className="h-6 w-6" />}
    >
      <ActionButton icon={<ArrowLeftIcon className="h-4 w-4" />} onClick={onReturnToSchool}>Back to School</ActionButton>
    </PlacementTerminal>
  );
}
