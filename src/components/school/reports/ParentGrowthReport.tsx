"use client";

import {
  ArrowRightIcon,
  CheckCircledIcon,
  ExclamationTriangleIcon,
  PersonIcon,
} from '@radix-ui/react-icons';
import { SchoolCoachPanel } from '@/components/school/SchoolCoachPanel';
import {
  SchoolDisclosure,
  SchoolPageHeading,
  SchoolStatusChip,
  schoolPrimaryActionClass,
  schoolSecondaryActionClass,
} from '@/components/school/SchoolPrimitives';
import { getSchoolAvatarTheme } from '@/lib/schoolTheme';
import {
  resolveParentCurrentClassNo,
  selectParentCurrentChapter,
  selectParentNextChapter,
} from './reportEvidence.mjs';
import type {
  SchoolClassMap,
  SchoolCoachIdentity,
  SchoolCurriculumSession,
  SchoolPlacementReport,
  SchoolRecapPath,
  SchoolState,
  SchoolSupportPlan,
} from '@/services/schoolRebuild';

interface ParentGrowthReportProps {
  state: SchoolState;
  placementReport: SchoolPlacementReport | null;
  classMap: SchoolClassMap | null;
  curriculumSession: SchoolCurriculumSession | null;
  recapSession: SchoolRecapPath | null;
  supportPlan: SchoolSupportPlan | null;
  activeCoachIdentity: SchoolCoachIdentity | null;
  limitations?: readonly string[];
  onNextAction: () => void;
  onOpenLearnerView: () => void;
}

function readableSkill(value: string): string {
  const leaf = value.split('.').at(-1) ?? value;
  return leaf
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function chapterStatus(status: SchoolClassMap['chapters'][number]['status']): string {
  if (status === 'complete') return 'Complete';
  if (status === 'active') return 'In progress';
  if (status === 'ready') return 'Ready';
  if (status === 'needs_support') return 'Needs focused support';
  return 'Locked';
}

function assessmentSupportTitle(pathType: string | undefined): string {
  if (pathType === 'focused_revision') return 'Focused revision';
  if (pathType === 'expanded_revision') return 'Expanded revision';
  if (pathType === 'parent_supported_pause') return 'Parent-supported pause';
  return 'Saved support step';
}

export function ParentGrowthReport({
  state,
  placementReport,
  classMap,
  curriculumSession,
  recapSession,
  supportPlan,
  activeCoachIdentity,
  limitations = [],
  onNextAction,
  onOpenLearnerView,
}: ParentGrowthReportProps) {
  const identity = activeCoachIdentity ?? classMap ?? state;
  const theme = getSchoolAvatarTheme(identity.coach_avatar_id, identity.coach_palette_id);
  const activeGaps = curriculumSession?.memory_summary?.active_gaps ?? [];
  const strongSkillIds = curriculumSession?.memory_summary?.strong_skill_ids ?? [];
  const improvingSkillIds = curriculumSession?.memory_summary?.improving_skill_ids ?? [];
  const improvingSkills = curriculumSession?.memory_summary?.improving_skills ?? [];
  const interruptHistory = curriculumSession?.interrupt_history ?? [];
  const assessmentSupportHistory = supportPlan?.history ?? [];
  const supportHistoryCount = interruptHistory.length + assessmentSupportHistory.length;
  const cappedEvents = interruptHistory.filter((event) => event.resolution === 'capped_out');
  const completedChapters = classMap?.chapters.filter((chapter) => chapter.status === 'complete') ?? [];
  const activeMapChapter = selectParentCurrentChapter(classMap);
  const nextMapChapter = selectParentNextChapter(classMap, curriculumSession);
  const recapModule = recapSession?.modules[recapSession.current_module_index] ?? null;
  const currentChapterTitle = activeMapChapter?.title
    ?? (curriculumSession?.status !== 'complete' ? curriculumSession?.chapter.title : null)
    ?? null;
  const currentLearningTitle = currentChapterTitle ?? recapModule?.title ?? null;
  const nextChapterTitle = !currentLearningTitle ? nextMapChapter?.title ?? null : null;
  const currentClassNo = recapSession?.active_learning_class_no
    ?? resolveParentCurrentClassNo({ curriculumSession, classMap, state });
  const placementEvidence = placementReport?.evidence_summary;
  const placementIsConclusive = placementReport?.placement_status !== 'insufficient_evidence';
  const readinessPathComplete = placementReport?.placement_status === 'below_target'
    && state.unlock_state === 'target_unlocked';
  const confirmedSkillCount = classMap?.recent_growth.strong_count ?? strongSkillIds.length;
  const currentFocusCount = Math.max(
    classMap?.recent_growth.active_focus_count ?? activeGaps.length,
    supportPlan?.focus ? 1 : 0,
  );
  const improvingCount = classMap?.recent_growth.improving_count ?? improvingSkillIds.length;

  const changeTitle = improvingSkillIds.length > 0
    ? `${readableSkill(improvingSkillIds[0])} is improving`
    : improvingCount > 0
      ? `${improvingCount} ${improvingCount === 1 ? 'skill is' : 'skills are'} improving`
    : completedChapters.length > 0
      ? `${completedChapters.length} ${completedChapters.length === 1 ? 'chapter is' : 'chapters are'} complete`
      : 'No change has been confirmed yet';
  const changeDetail = improvingSkills[0]?.latest_evidence
    ? `Latest saved evidence for ${readableSkill(improvingSkills[0].skill_id)}: “${improvingSkills[0].latest_evidence}” (${improvingSkills[0].last_attempt_type.replaceAll('_', ' ') || 'saved check'}).`
    : improvingSkillIds.length > 0
      ? `Recent saved class evidence identifies ${readableSkill(improvingSkillIds[0])} as improving${improvingSkillIds.length > 1 ? `, with ${improvingSkillIds.length - 1} more improving skill${improvingSkillIds.length === 2 ? '' : 's'}` : ''}.`
    : improvingCount > 0
      ? 'This count comes from recent saved class evidence.'
    : completedChapters.length > 0
      ? 'Completed chapter records are included in the class map.'
      : 'The report will wait for new saved evidence before describing progress.';

  const attentionTitle = supportPlan?.focus
    ? 'A focused-support plan is saved'
    : cappedEvents.length > 0
    ? 'A focused-support limit was reached'
    : activeGaps.length > 0
      ? readableSkill(activeGaps[0].skill_id)
      : recapModule
        ? recapModule.focus
      : currentFocusCount > 0
        ? `${currentFocusCount} ${currentFocusCount === 1 ? 'skill needs' : 'skills need'} continued practice`
        : 'No current support need is confirmed';
  const attentionDetail = supportPlan?.focus
    ? supportPlan.focus
    : cappedEvents.length > 0
    ? `${cappedEvents[0].focus} reached the saved extra-support limit after ${cappedEvents[0].trigger_count} support attempts.`
    : activeGaps.length > 0
      ? activeGaps[0].latest_evidence
        ? `${activeGaps[0].gap} Latest saved answer: “${activeGaps[0].latest_evidence}”.`
        : activeGaps[0].gap
      : recapModule
        ? `The readiness path paused at ${recapModule.title}. The saved module focus is ${recapModule.focus}.`
      : currentFocusCount > 0
        ? 'The class map records these as current focus areas without naming unsupported details.'
        : 'New chapter evidence will update this section when a support need appears.';

  return (
    <main
      className="mx-auto w-full max-w-[1080px] overflow-x-hidden px-5 pb-24 pt-28 sm:px-8 lg:px-12"
      style={theme.style}
    >
      <header className="flex flex-col gap-6 border-b border-slate-200 pb-9 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <SchoolCoachPanel
            avatarId={identity.coach_avatar_id}
            paletteId={identity.coach_palette_id}
            status="Parent report"
            note={state.parent_message || "The learner's saved path decides the next action."}
            compact
          />
          <SchoolPageHeading
            eyebrow={currentClassNo ? `Parent view · Class ${currentClassNo} English` : 'Parent view'}
            title="Learning evidence, at a glance."
            description="A concise view of the learner's current position, saved change, attention needs, and next step."
          />
        </div>
        <button type="button" onClick={onOpenLearnerView} className={schoolSecondaryActionClass}>
          <PersonIcon className="h-4 w-4" aria-hidden="true" />
          Back to learner view
        </button>
      </header>

      <div className="parent-report-first-view" aria-label="Parent report summary">
        <section className="border-b border-slate-200 py-8" aria-labelledby="parent-position-heading">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.55fr)]">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase text-[var(--school-accent-deep)]">Current position</p>
              <h2 id="parent-position-heading" className="mt-2 font-display text-[2.2rem] font-normal leading-[1.05] text-slate-950">
                {currentLearningTitle
                  ? `Working in ${currentLearningTitle}`
                  : nextChapterTitle
                    ? `Ready for ${nextChapterTitle}`
                  : currentClassNo
                    ? `Current learning is in Class ${currentClassNo}`
                    : 'The current learning position is not confirmed'}
              </h2>
              <p className="mt-3 max-w-[64ch] text-sm leading-6 text-slate-600">
                {currentLearningTitle && currentClassNo
                  ? recapModule
                    ? `The saved School state places the learner in a Class ${currentClassNo} readiness module, with ${recapModule.focus} as the current focus.`
                    : `The saved School state places the learner in Class ${currentClassNo}, with ${currentLearningTitle} as the current chapter.`
                  : nextChapterTitle && currentClassNo
                    ? `The previous chapter is complete. ${nextChapterTitle} is the next available Class ${currentClassNo} chapter.`
                  : currentClassNo
                    ? `Saved current-learning evidence identifies Class ${currentClassNo}, but no current chapter is available.`
                    : 'This report will not treat the target class as active until the saved School state unlocks it.'}
              </p>
            </div>
            <dl className="grid grid-cols-2 border-y border-slate-200 text-sm">
              <div className="border-b border-r border-slate-200 py-4 pr-4">
                <dt className="text-xs text-slate-500">Current class</dt>
                <dd className="mt-1 font-display text-2xl font-normal text-slate-950">{currentClassNo ? `Class ${currentClassNo}` : 'Not available'}</dd>
              </div>
              <div className="border-b border-slate-200 py-4 pl-4">
                <dt className="text-xs text-slate-500">{recapModule ? 'Readiness module' : nextChapterTitle ? 'Next chapter' : 'Current chapter'}</dt>
                <dd className="mt-1 break-words font-semibold text-slate-950">{currentLearningTitle ?? nextChapterTitle ?? 'Not available'}</dd>
              </div>
              <div className="border-r border-slate-200 py-4 pr-4">
                <dt className="text-xs text-slate-500">Chapters complete</dt>
                <dd className="mt-1 font-display text-2xl font-normal text-slate-950">{classMap ? completedChapters.length : '-'}</dd>
              </div>
              <div className="py-4 pl-4">
                <dt className="text-xs text-slate-500">Confirmed skills</dt>
                <dd className="mt-1 font-display text-2xl font-normal text-slate-950">{classMap || curriculumSession ? confirmedSkillCount : '-'}</dd>
                <span className="mt-1 block text-xs text-slate-500">Current focus: {classMap || curriculumSession || supportPlan ? currentFocusCount : 'not available'}</span>
              </div>
            </dl>
          </div>
        </section>

        <section className="grid border-b border-slate-200 md:grid-cols-2 md:divide-x md:divide-slate-200" aria-label="Change and attention">
          <article className="border-b border-slate-200 py-7 md:border-b-0 md:pr-8" aria-labelledby="parent-change-heading">
            <p className="text-[11px] font-semibold uppercase text-teal-700">What changed</p>
            <h2 id="parent-change-heading" className="mt-2 font-display text-[1.8rem] font-normal leading-[1.08] text-slate-950">{changeTitle}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{changeDetail}</p>
          </article>
          <article className="py-7 md:pl-8" aria-labelledby="parent-attention-heading">
            <p className={`text-[11px] font-semibold uppercase ${cappedEvents.length > 0 ? 'text-red-700' : 'text-orange-800'}`}>Needs attention</p>
            <div className="mt-2 flex items-start gap-3">
              {cappedEvents.length > 0 ? <ExclamationTriangleIcon className="mt-1 h-5 w-5 flex-none text-red-700" aria-hidden="true" /> : null}
              <div className="min-w-0">
                <h2 id="parent-attention-heading" className="break-words font-display text-[1.8rem] font-normal leading-[1.08] text-slate-950">{attentionTitle}</h2>
                <p className="mt-3 break-words text-sm leading-6 text-slate-600">{attentionDetail}</p>
              </div>
            </div>
          </article>
        </section>

        <section className="border-b border-slate-200 py-8" aria-labelledby="parent-week-heading">
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase text-[var(--school-accent-deep)]">This week</p>
              <h2 id="parent-week-heading" className="mt-2 font-display text-[2rem] font-normal leading-[1.05] text-slate-950">Recommended next action</h2>
              <p className="mt-3 max-w-[64ch] break-words text-sm leading-6 text-slate-600">
                {state.parent_message || "Continue from the next step saved in the learner's path."}
              </p>
            </div>
            <button type="button" onClick={onNextAction} className={schoolPrimaryActionClass}>
              Open next step
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>

      <section className="mt-10" aria-labelledby="parent-details-heading">
        <SchoolPageHeading
          eyebrow="Report detail"
          title="Evidence when you need it."
          description="The summary stays first. Open a section for the saved records behind it."
          level="h2"
          size="section"
          id="parent-details-heading"
        />

        <div className="mt-6">
          <SchoolDisclosure title="How the starting point was chosen" summary="Placement method and conclusion">
            {placementReport ? (
              <div className="space-y-3">
                <p>
                  {placementEvidence?.scoring_source === 'committed_learning_events'
                    ? 'The starting point uses committed learning events from the completed readiness flow.'
                    : 'The starting point uses the completed readiness check recorded in the placement report.'}
                </p>
                <dl className="divide-y divide-slate-200 border-y border-slate-200">
                  <div className="flex flex-wrap justify-between gap-3 py-3"><dt>Target class selected for placement</dt><dd className="font-semibold text-slate-950">Class {placementReport.target_class_no}</dd></div>
                  <div className="flex flex-wrap justify-between gap-3 py-3"><dt>Starting point</dt><dd className="font-semibold text-slate-950">{placementIsConclusive ? `Class ${placementReport.evaluated_class_no}` : 'Not decided'}</dd></div>
                </dl>
                {!placementIsConclusive ? (
                  <p className="font-medium text-orange-900">Preliminary misses are not presented as lasting weaknesses until enough evidence is saved.</p>
                ) : null}
              </div>
            ) : <p>No completed placement report is available, so this report makes no placement claim.</p>}
          </SchoolDisclosure>

          <SchoolDisclosure title="Complete chapter list" summary={classMap ? `${completedChapters.length} of ${classMap.chapters.length} chapters complete` : 'Class map unavailable'}>
            {classMap ? (
              <div className="divide-y divide-slate-200 border-y border-slate-200">
                {classMap.chapters.map((chapter) => (
                  <div key={chapter.chapter_id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-slate-950">{chapter.chapter_no}. {chapter.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{chapter.completed_levels} of {chapter.total_levels} levels complete</p>
                    </div>
                    <SchoolStatusChip tone={chapter.status === 'needs_support' ? 'support' : chapter.status === 'complete' ? 'success' : 'neutral'}>
                      {chapterStatus(chapter.status)}
                    </SchoolStatusChip>
                  </div>
                ))}
              </div>
            ) : <p>Chapter progress is unavailable until the target class map is unlocked and loaded.</p>}
          </SchoolDisclosure>

          <SchoolDisclosure title="Placement evidence detail" summary={placementEvidence ? `${placementEvidence.total_attempts} saved readiness checks` : 'Placement evidence unavailable'}>
            {placementEvidence ? (
              <dl className="divide-y divide-slate-200 border-y border-slate-200">
                <div className="flex justify-between gap-4 py-3"><dt>Saved checks used</dt><dd className="font-semibold text-slate-950">{placementEvidence.total_attempts}</dd></div>
                <div className="flex justify-between gap-4 py-3"><dt>Strong checks</dt><dd className="font-semibold text-slate-950">{placementEvidence.correct_attempts}</dd></div>
                <div className="flex justify-between gap-4 py-3"><dt>Checks needing another look</dt><dd className="font-semibold text-slate-950">{placementEvidence.incorrect_attempts}</dd></div>
              </dl>
            ) : <p>No placement evidence detail is available.</p>}
          </SchoolDisclosure>

          <SchoolDisclosure title="Skill evidence history" summary="Placement history and current curriculum memory">
            <div className="space-y-5">
              {placementReport && !placementIsConclusive ? (
                <p>There is not enough evidence to confirm a placement skill gap. Preliminary misses are not presented as lasting weaknesses.</p>
              ) : placementReport?.blocking_skills.length ? (
                <div>
                  <h3 className="font-semibold text-slate-950">Placement skill evidence</h3>
                  {readinessPathComplete ? (
                    <p className="mt-1 text-teal-800">The readiness path is complete. These are historical starting-point evidence, not a current gap.</p>
                  ) : null}
                  <ul className="mt-3 space-y-3">
                    {placementReport.blocking_skills.map((skill) => (
                      <li key={`${skill.label}-${skill.source_class_no}`}>
                        <strong className="font-semibold text-slate-950">{skill.label}</strong>
                        <span className="block">{skill.learner_reason} {skill.correct_attempts} of {skill.attempts} checks were strong.</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : <p>No blocking placement skill is recorded.</p>}

              <div>
                <h3 className="font-semibold text-slate-950">Current curriculum memory</h3>
                {activeGaps.length > 0 ? (
                  <ul className="mt-3 space-y-3">
                    {activeGaps.map((gap) => (
                      <li key={`${gap.skill_id}-${gap.gap}`}>
                        <strong className="font-semibold text-slate-950">{readableSkill(gap.skill_id)}</strong>
                        <span className="block">{gap.gap}</span>
                        <span className="block text-xs text-[var(--school-accent-deep)]">Next support: {gap.recommended_next_action}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-2">No current chapter gap is confirmed.</p>}
                {(strongSkillIds.length > 0 || improvingSkillIds.length > 0) ? (
                  <dl className="mt-4 grid grid-cols-2 border-y border-slate-200">
                    <div className="border-r border-slate-200 py-3 pr-4"><dt>Strong skill records</dt><dd className="mt-1 font-semibold text-slate-950">{strongSkillIds.length}</dd></div>
                    <div className="py-3 pl-4"><dt>Improving skill records</dt><dd className="mt-1 font-semibold text-slate-950">{improvingSkillIds.length}</dd></div>
                  </dl>
                ) : null}
              </div>
            </div>
          </SchoolDisclosure>

          <SchoolDisclosure title="Support history and limits" summary={`${supportHistoryCount} saved support ${supportHistoryCount === 1 ? 'event' : 'events'}`}>
            {supportHistoryCount > 0 ? (
              <div className="divide-y divide-slate-200 border-y border-slate-200">
                {interruptHistory.map((event) => (
                  <article key={event.interrupt_id} className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="break-words font-semibold text-slate-950">{event.focus}</h3>
                      <SchoolStatusChip tone={event.resolution === 'capped_out' ? 'error' : event.resolution === 'complete' ? 'success' : 'neutral'}>
                        {event.resolution === 'capped_out' ? 'Support limit reached' : event.resolution === 'complete' ? 'Complete' : 'Ended'}
                      </SchoolStatusChip>
                    </div>
                    <p className="mt-2">{event.trigger_count} support {event.trigger_count === 1 ? 'attempt was' : 'attempts were'} recorded.</p>
                  </article>
                ))}
                {assessmentSupportHistory.map((event, index) => (
                  <article key={`${event.path_type ?? 'support'}-${event.attempt_no ?? index}`} className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="break-words font-semibold text-slate-950">{assessmentSupportTitle(event.path_type)}</h3>
                      <SchoolStatusChip tone={event.path_type === 'parent_supported_pause' ? 'support' : 'neutral'}>
                        {event.path_type === 'parent_supported_pause' ? 'Automatic loop stopped' : 'Completed support step'}
                      </SchoolStatusChip>
                    </div>
                    <p className="mt-2">
                      {event.attempt_no
                        ? `Saved after chapter check ${event.attempt_no}.`
                        : 'Saved during the chapter support path.'}
                      {event.skill_ids?.length
                        ? ` Focused on ${event.skill_ids.map(readableSkill).join(', ')}.`
                        : ''}
                    </p>
                  </article>
                ))}
              </div>
            ) : <p>No focused-support event is recorded for the current curriculum session.</p>}
          </SchoolDisclosure>

          <SchoolDisclosure title="Report limitations" summary={limitations.length > 0 ? `${limitations.length} unavailable evidence ${limitations.length === 1 ? 'source' : 'sources'}` : 'No loading limitations recorded'}>
            {limitations.length > 0 ? (
              <div>
                <p className="font-semibold text-slate-950">Some evidence is unavailable right now.</p>
                <ul className="mt-3 list-disc space-y-2 pl-5">
                  {limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
                </ul>
              </div>
            ) : (
              <p className="flex items-center gap-2"><CheckCircledIcon className="h-4 w-4 text-teal-700" aria-hidden="true" /> No report-loading limitation was recorded.</p>
            )}
          </SchoolDisclosure>
        </div>
      </section>
    </main>
  );
}
