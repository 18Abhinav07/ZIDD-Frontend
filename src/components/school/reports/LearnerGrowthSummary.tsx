"use client";

import {
  ArrowRightIcon,
  CheckCircledIcon,
  PersonIcon,
  RowsIcon,
  TargetIcon,
} from '@radix-ui/react-icons';
import {
  SchoolDisclosure,
  SchoolPageHeading,
  SchoolStatusChip,
  schoolPrimaryActionClass,
  schoolSecondaryActionClass,
} from '@/components/school/SchoolPrimitives';
import { getSchoolAvatarTheme } from '@/lib/schoolTheme';
import { useResolvedSchoolCoachIdentity } from '@/components/school/shell/SchoolCoachIdentityContext';
import {
  createLearnerSafeSkillLabeler,
  describeSavedAttempts,
  groupSkillEvidenceByLabel,
  selectLearnerPracticeChapter,
} from './reportEvidence.mjs';
import type {
  SchoolClassMap,
  SchoolCoachIdentity,
  SchoolCurriculumSession,
  SchoolNextAction,
  SchoolPlacementReport,
  SchoolState,
  SchoolSupportPlan,
} from '@/services/schoolRebuild';

interface LearnerGrowthSummaryProps {
  state: SchoolState;
  placementReport: SchoolPlacementReport | null;
  classMap: SchoolClassMap | null;
  curriculumSession: SchoolCurriculumSession | null;
  supportPlan: SchoolSupportPlan | null;
  activeCoachIdentity: SchoolCoachIdentity | null;
  learnerName: string | null;
  nextStepOverride: {
    heading: string;
    actionLabel: string;
    message: string;
  } | null;
  limitations?: readonly string[];
  onNextAction: () => void;
  onOpenClassMap: () => void;
  onOpenParentView: () => void;
}

const NEXT_ACTION_LABELS: Partial<Record<SchoolNextAction, string>> = {
  complete_profile: 'Finish my setup',
  edit_profile: 'Check my setup',
  start_placement: 'Find my starting point',
  resume_placement: 'Finish my readiness check',
  finish_placement: 'Finish my readiness check',
  view_placement_report: 'See my starting point',
  start_recap: 'Start my readiness path',
  resume_recap: 'Continue my readiness path',
  revise_recap_path: 'Strengthen my readiness path',
  start_curriculum: 'Start my next chapter',
  resume_curriculum: 'Continue my chapter',
  start_masterclass: 'Start focused practice',
  resume_masterclass: 'Continue focused practice',
  resume_support: 'Continue support',
  view_support_plan: 'See my support plan',
  view_report: 'See my report',
  retry: 'Try again',
};

function nextActionLabel(action: SchoolNextAction | null): string {
  return action ? NEXT_ACTION_LABELS[action] ?? 'Continue learning' : 'Back to my class';
}

export function LearnerGrowthSummary({
  state,
  placementReport,
  classMap,
  curriculumSession,
  supportPlan,
  activeCoachIdentity,
  learnerName,
  nextStepOverride,
  limitations = [],
  onNextAction,
  onOpenClassMap,
  onOpenParentView,
}: LearnerGrowthSummaryProps) {
  const identity = activeCoachIdentity ?? classMap ?? state;
  const coachIdentity = useResolvedSchoolCoachIdentity({
    avatarId: identity.coach_avatar_id,
    paletteId: identity.coach_palette_id,
  });
  const theme = getSchoolAvatarTheme(coachIdentity.avatarId, coachIdentity.paletteId);
  const awaitingEvaluation = state.status === 'awaiting_evaluation';
  const completedChapters = classMap?.chapters.filter((chapter) => chapter.status === 'complete') ?? [];
  const activeChapter = selectLearnerPracticeChapter(classMap);
  const placementStillOwnsPath = state.unlock_state !== 'target_unlocked';
  const readinessPathComplete = placementReport?.placement_status === 'below_target'
    && state.unlock_state === 'target_unlocked';
  const placementIsConclusive = placementReport?.placement_status !== 'insufficient_evidence';
  const currentPlacementFocuses = placementStillOwnsPath && placementIsConclusive
    ? placementReport?.blocking_skills ?? []
    : [];
  const activeGaps = curriculumSession?.memory_summary?.active_gaps ?? [];
  const strongSkillIds = curriculumSession?.memory_summary?.strong_skill_ids ?? [];
  const improvingSkillIds = curriculumSession?.memory_summary?.improving_skill_ids ?? [];
  const strongSkills = curriculumSession?.memory_summary?.strong_skills ?? [];
  const improvingSkills = curriculumSession?.memory_summary?.improving_skills ?? [];
  const labelSkill = createLearnerSafeSkillLabeler(curriculumSession?.levels);
  const strongEvidenceRows = groupSkillEvidenceByLabel(strongSkills, labelSkill);
  const improvingEvidenceRows = groupSkillEvidenceByLabel(improvingSkills, labelSkill);
  const latestAssessment = curriculumSession?.chapter_assessment?.last_result;
  const latestAssessmentPercent = latestAssessment
    ? Math.round(latestAssessment.score * 100)
    : null;

  const canDoRows: string[] = [];
  if (latestAssessment?.passed && latestAssessmentPercent !== null && curriculumSession) {
    canDoRows.push(
      `You scored ${latestAssessmentPercent}% on the ${curriculumSession.chapter.title} chapter challenge.`,
    );
  }
  strongEvidenceRows.slice(0, 3).forEach((skill) => {
    canDoRows.push(
      `${skill.label} is strong across ${describeSavedAttempts(skill.attempts, skill.last_attempt_type)}.`,
    );
  });
  if (strongEvidenceRows.length === 0) {
    strongSkillIds.slice(0, 3).forEach((skillId) => {
      const label = labelSkill(skillId);
      if (label !== 'Current learning skill') {
        canDoRows.push(`${label} is strong in your saved class checks.`);
      }
    });
  }
  completedChapters.slice(-2).forEach((chapter) => {
    canDoRows.push(`${chapter.title} is complete across all ${chapter.total_levels} learning stages.`);
  });
  if (readinessPathComplete) {
    canDoRows.push('You completed the readiness path and unlocked your target class.');
  }

  const practiceRows = currentPlacementFocuses.slice(0, 3).map((skill) => ({
    title: skill.label,
    detail: skill.learner_reason,
  }));
  if (practiceRows.length === 0 && activeGaps.length > 0) {
    activeGaps.slice(0, 3).forEach((gap) => practiceRows.push({
      title: gap.skill_label || labelSkill(gap.skill_id),
      detail: gap.gap,
    }));
  }
  if (practiceRows.length === 0 && improvingEvidenceRows.length > 0) {
    improvingEvidenceRows.slice(0, 3).forEach((skill) => practiceRows.push({
      title: skill.label,
      detail: `${skill.skill_count > 1 ? 'These related skills are' : 'This skill is'} improving across ${describeSavedAttempts(skill.attempts, skill.last_attempt_type)}.`,
    }));
  }
  if (practiceRows.length === 0 && improvingSkillIds.length > 0) {
    improvingSkillIds.slice(0, 3).forEach((skillId) => practiceRows.push({
      title: labelSkill(skillId),
      detail: 'This skill is improving in recent saved chapter checks.',
    }));
  }
  if (practiceRows.length === 0 && supportPlan?.focus) {
    practiceRows.push({
      title: 'Focused support',
      detail: supportPlan.focus,
    });
  }
  if (practiceRows.length === 0 && activeChapter) {
    practiceRows.push({
      title: activeChapter.title,
      detail: `${activeChapter.completed_levels} of ${activeChapter.total_levels} learning levels complete.`,
    });
  }

  return (
    <main
      className="mx-auto w-full max-w-[1180px] overflow-x-hidden px-4 pb-24 pt-12 sm:px-8 sm:pt-16 lg:px-12"
      style={theme.style}
    >
      <header className="flex flex-col gap-6 border-b border-slate-200 pb-9 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <SchoolPageHeading
            eyebrow="Your growth"
            title={learnerName ? `${learnerName}, look what is changing.` : 'Look what is changing.'}
            description="This summary uses your saved readiness checks and chapter work."
          />
        </div>
        <button type="button" onClick={onOpenParentView} className={`${schoolSecondaryActionClass} w-full sm:w-auto`}>
          <PersonIcon className="h-4 w-4" aria-hidden="true" />
          Open parent view
        </button>
      </header>

      <div className="learner-report-first-view" aria-label="Growth summary">
        <section className="grid gap-5 border-b border-slate-200 py-8 md:grid-cols-[220px_minmax(0,1fr)]" aria-labelledby="learner-can-do-heading">
          <div>
            <p className="text-[11px] font-semibold uppercase text-teal-700">What you can do now</p>
            <h2 id="learner-can-do-heading" className="mt-2 break-words font-display text-[1.75rem] font-normal leading-[1.08] text-slate-950 sm:text-[2rem]">
              Your saved wins
            </h2>
          </div>
          {canDoRows.length > 0 ? (
            <ul className="divide-y divide-slate-200 border-y border-slate-200" aria-label="Current achievements">
              {canDoRows.map((item) => (
                <li key={item} className="flex gap-3 py-4 text-sm leading-6 text-slate-700">
                  <CheckCircledIcon className="mt-1 h-4 w-4 flex-none text-teal-700" aria-hidden="true" />
                  <span className="min-w-0 break-words">{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="border-y border-slate-200 py-4">
              <h3 className="font-medium text-slate-950">
                {placementReport?.placement_status === 'insufficient_evidence'
                  ? 'Not enough evidence yet'
                  : 'Your first saved win is still ahead'}
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {placementReport?.placement_status === 'insufficient_evidence'
                  ? 'Finish more readiness checks before this report names a strength or a gap.'
                  : 'Complete the next saved check and Zidd will add confirmed progress here.'}
              </p>
            </div>
          )}
        </section>

        <section className="grid gap-5 border-b border-slate-200 py-8 md:grid-cols-[220px_minmax(0,1fr)]" aria-labelledby="learner-practice-heading">
          <div>
            <p className="text-[11px] font-semibold uppercase text-orange-800">What you are practising</p>
            <h2 id="learner-practice-heading" className="mt-2 break-words font-display text-[1.75rem] font-normal leading-[1.08] text-slate-950 sm:text-[2rem]">
              Your current focus
            </h2>
          </div>
          {practiceRows.length > 0 ? (
            <div className="divide-y divide-slate-200 border-y border-slate-200">
              {practiceRows.map((focus) => (
                <article key={focus.title} className="py-4">
                  <h3 className="break-words font-medium text-slate-950">{focus.title}</h3>
                  <p className="mt-1 break-words text-sm leading-6 text-slate-600">{focus.detail}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="border-y border-slate-200 py-4">
              <h3 className="font-medium text-slate-950">No current focus has been confirmed.</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Zidd will wait for saved evidence before naming something to practise.
              </p>
            </div>
          )}
        </section>

        <section className="border-b border-slate-200 py-8" aria-labelledby="learner-next-heading">
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase text-[var(--school-accent-deep)]">{awaitingEvaluation ? 'Saved answer' : 'Your next challenge'}</p>
              <h2 id="learner-next-heading" className="mt-2 break-words font-display text-[1.85rem] font-normal leading-[1.08] text-slate-950 sm:text-[2.15rem]">
                {awaitingEvaluation ? 'Your latest work is being reviewed' : nextStepOverride?.heading ?? nextActionLabel(state.next_action)}
              </h2>
              <p className="mt-3 max-w-[64ch] break-words text-sm leading-6 text-slate-600">
                {awaitingEvaluation
                  ? 'School is reviewing the latest saved work. This report will update when the next step is ready.'
                  : nextStepOverride?.message || state.learner_message || 'Continue from the exact place saved in your learning path.'}
              </p>
            </div>
            {awaitingEvaluation ? (
              <p role="status" aria-live="polite" className="text-sm font-medium text-slate-600">Your place is saved.</p>
            ) : (
              <button type="button" onClick={onNextAction} className={`${schoolPrimaryActionClass} w-full sm:w-auto`}>
                {nextStepOverride?.actionLabel ?? nextActionLabel(state.next_action)}
                <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </section>
      </div>

      <section className="mt-10" aria-labelledby="learner-more-heading">
        <SchoolPageHeading
          eyebrow="Saved report details"
          title="The evidence behind your progress."
          level="h2"
          size="section"
          id="learner-more-heading"
        />
        <div className="mt-6">
          <SchoolDisclosure title="Completed milestones" summary="Starting-point and completed chapter history">
            <div className="space-y-4">
              {placementReport && placementIsConclusive ? (
                <div>
                  <h3 className="font-medium text-slate-950">Starting point found</h3>
                  <p className="mt-1">{placementReport.evidence_summary.total_attempts} readiness checks helped build your path.</p>
                </div>
              ) : null}
              {readinessPathComplete ? (
                <div>
                  <h3 className="font-medium text-slate-950">Readiness path complete</h3>
                  <p className="mt-1">The placement gap is part of your starting-point history, not your current focus.</p>
                </div>
              ) : null}
              {completedChapters.length > 0 ? (
                <div>
                  <h3 className="font-medium text-slate-950">Completed chapter work</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {completedChapters.map((chapter) => <li key={chapter.chapter_id}>{chapter.title}</li>)}
                  </ul>
                </div>
              ) : null}
              {!placementReport && completedChapters.length === 0 ? <p>No deeper completed work is available yet.</p> : null}
            </div>
          </SchoolDisclosure>

          {limitations.length > 0 ? (
            <SchoolDisclosure title="Report limitations" summary="Evidence that could not be included right now">
              <ul className="list-disc space-y-2 break-words pl-5 text-sm leading-6 text-slate-700">
                {limitations.map((limitation) => <li key={limitation} className="pl-1">{limitation}</li>)}
              </ul>
            </SchoolDisclosure>
          ) : null}
        </div>

        {classMap ? (
          <button type="button" onClick={onOpenClassMap} className={`${schoolSecondaryActionClass} mt-7`}>
            <RowsIcon className="h-4 w-4" aria-hidden="true" />
            View class map
          </button>
        ) : (
          <SchoolStatusChip tone="neutral">
            <TargetIcon className="mr-2 h-4 w-4" aria-hidden="true" />
            Class map available after class unlock
          </SchoolStatusChip>
        )}
      </section>
    </main>
  );
}
