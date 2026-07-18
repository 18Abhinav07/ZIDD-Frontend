import { apiFetch, getAuthCacheKey } from '@/services/api';
import {
  SchoolStateRequestCache,
  type SchoolLoadScope,
} from '@/lib/schoolStateCachePolicy';
import type {
  SchoolEnglishComfort,
  SchoolOnboardingDraft,
  SchoolOnboardingCoachIdentity,
  SchoolOnboardingProfile,
  SchoolOnboardingSnapshot,
  SchoolTeachingLanguage,
} from '@/lib/schoolOnboardingPolicy';
import {
  SCHOOL_CLOUD_EVALUATOR_TIMEOUT_MS,
  SCHOOL_CONTROL_TIMEOUT_MS,
  SCHOOL_READ_TIMEOUT_MS,
  isSchoolEvaluatorPendingResponse,
} from '@/lib/schoolRequestPolicy.mjs';

export type TeachingLanguage = SchoolTeachingLanguage;
export type EnglishComfort = SchoolEnglishComfort;
export type SchoolCurriculumInteractionType =
  | 'continue'
  | 'single_choice'
  | 'multi_select'
  | 'cloze'
  | 'matching'
  | 'ordering'
  | 'classification'
  | 'sentence_completion'
  | 'short_text'
  | 'evidence_text'
  | 'paragraph_text'
  | 'dialogue'
  | 'creative_continuation'
  | 'summary'
  | 'reflection';
export type SchoolCurriculumEvidenceRole =
  | 'experience'
  | 'formative'
  | 'supported'
  | 'certifying'
  | 'reflection';
export interface SchoolSourceReferenceAnchor {
  section_label?: string | null;
  page_start?: number | null;
  page_end?: number | null;
  source_url?: string | null;
}

export interface SchoolSourceReference {
  book_title?: string | null;
  chapter_title?: string | null;
  anchors?: SchoolSourceReferenceAnchor[] | null;
}

export type SchoolStateStatus =
  | 'needs_action'
  | 'in_progress'
  | 'awaiting_evaluation'
  | 'insufficient_evidence'
  | 'ready'
  | 'complete'
  | 'needs_support'
  | 'needs_path_revision'
  | 'recoverable_error';
export type SchoolNextAction =
  | 'sign_in'
  | 'complete_profile'
  | 'edit_profile'
  | 'start_placement'
  | 'resume_placement'
  | 'finish_placement'
  | 'view_placement_report'
  | 'start_recap'
  | 'resume_recap'
  | 'revise_recap_path'
  | 'start_curriculum'
  | 'resume_curriculum'
  | 'start_masterclass'
  | 'resume_masterclass'
  | 'resume_support'
  | 'view_support_plan'
  | 'view_report'
  | 'retry';

export interface SchoolCoachIdentity {
  coach_avatar_id: string | null;
  coach_palette_id: string | null;
}

export interface SchoolProfileInput {
  display_name: string;
  school_name: string;
  board_id: string;
  target_class_no: number;
  subject_ids: [string];
  preferred_teaching_language: TeachingLanguage;
  english_comfort: EnglishComfort;
  learner_goal: string;
  parent_goal: string;
  prior_difficulty_signals: Array<'reading' | 'vocabulary' | 'grammar' | 'writing' | 'chapter_answers'>;
}

export type SchoolProfile = SchoolOnboardingProfile;
export type SchoolProfileDraft = SchoolOnboardingDraft;
export type SchoolOnboardingEnvelope = SchoolOnboardingSnapshot;

export type SaveSchoolOnboardingRequest = Partial<SchoolProfileInput>
  & Partial<SchoolOnboardingCoachIdentity> & {
  current_step: 0 | 1 | 2 | 3 | 4;
  request_id: string;
  profile_version_id?: string;
  expected_revision?: number;
};

export interface ActivateSchoolOnboardingRequest {
  profile_version_id: string;
  expected_revision: number;
  request_id: string;
}

export interface SchoolUnavailableState {
  available: false;
  availability_reason?: string | null;
}

export interface SchoolState extends SchoolCoachIdentity {
  available?: true;
  availability_reason?: null;
  profile_status: 'unauthenticated' | 'missing' | 'incomplete' | 'complete';
  target_class_no: number | null;
  subject_id: string | null;
  profile_version_id: string | null;
  preferred_teaching_language: TeachingLanguage | null;
  active_flow:
    | 'onboarding'
    | 'none'
    | 'placement'
    | 'placement_report'
    | 'recap'
    | 'curriculum'
    | 'masterclass'
    | 'support'
    | 'report';
  active_session_id: string | null;
  placement_status:
    | 'not_started'
    | 'in_progress'
    | 'insufficient_evidence'
    | 'below_target'
    | 'target_ready'
    | 'abandoned';
  unlock_state: 'locked' | 'recap_required' | 'target_unlocked';
  evaluated_class_no: number | null;
  active_learning_class_no: number | null;
  status: SchoolStateStatus;
  next_action: SchoolNextAction | null;
  next_action_url: string;
  allowed_next_actions: SchoolNextAction[];
  learner_message: string;
  parent_message: string;
  blocked_reason: string | null;
}

export interface SchoolEvaluatorPendingResponse {
  status: 'awaiting_evaluation';
  session_id: string;
  activity_id: string;
  state_url: string;
}

export type SchoolEvaluatorAnswerResult<Resolved> = Resolved | SchoolEvaluatorPendingResponse;

export function isSchoolEvaluatorPendingAnswer(
  result: unknown,
): result is SchoolEvaluatorPendingResponse {
  return isSchoolEvaluatorPendingResponse(result);
}

export type SchoolStateResponse = SchoolState | SchoolUnavailableState;

export interface SchoolPlacementItem {
  item_id: string;
  stage: 'snapshot' | 'targeted_diagnostic' | 'confirmatory';
  type: 'short_answer' | 'multiple_choice' | 'fill_blank';
  source_class_no: number;
  target_class_no: number;
  learner_skill_label: string;
  instruction: string;
  support: string;
  prompt: string;
  passage: string;
  options: string[] | null;
}

export interface SchoolPlacementResponse extends SchoolCoachIdentity {
  session_id: string;
  profile_version_id: string;
  subject_id: string;
  target_class_no: number;
  preferred_teaching_language: TeachingLanguage;
  stage: 'snapshot' | 'targeted_diagnostic' | 'confirmatory';
  status: 'in_progress' | 'target_ready' | 'below_target' | 'insufficient_evidence' | 'abandoned';
  answered_count: number;
  scorable_answers: number;
  max_items: number;
  readiness_summary: {
    stage: string;
    status: string;
    required_skill_count: number;
    ready_skill_ids: string[];
    weak_skill_ids: string[];
    skill_statuses: Record<string, string>;
  };
  next_item: SchoolPlacementItem | null;
}

export interface SchoolPlacementReport extends SchoolCoachIdentity {
  report_id: string;
  placement_session_id: string;
  profile_version_id: string;
  placement_status: 'below_target' | 'target_ready' | 'insufficient_evidence' | 'abandoned';
  subject_id: string;
  target_class_no: number;
  evaluated_class_no: number;
  active_learning_class_no: number;
  unlock_state: 'locked' | 'recap_required' | 'target_unlocked';
  blocking_skills: Array<{
    label: string;
    source_class_no: number;
    status: string;
    attempts: number;
    correct_attempts: number;
    learner_reason: string;
  }>;
  watchlist_skills: Array<{
    label: string;
    source_class_no: number;
    status: string;
  }>;
  evidence_summary: {
    total_attempts: number;
    correct_attempts: number;
    incorrect_attempts: number;
    stage_counts: Record<string, number>;
    scoring_source: string;
  };
  recommended_recap_modules: Array<{
    module_id: string;
    title: string;
    source_class_no: number;
    focus: string;
    why_this_is_first: string;
    estimated_minutes: number;
    status: string;
  }>;
  learner_summary: string;
  parent_summary: string;
}

export interface SchoolRecapPath extends SchoolCoachIdentity {
  session_id: string;
  flow_type: 'recap';
  status: 'active' | 'complete' | 'needs_support' | 'capped_support' | 'needs_path_revision';
  source_placement_report_id: string;
  source_placement_session_id: string;
  subject_id: string;
  target_class_no: number;
  active_learning_class_no: number;
  current_module_index: number;
  progress: {
    completed_modules: number;
    total_modules: number;
  };
  current_activity: {
    activity_id: string;
    module_id: string;
    kind:
      | 'guided_check'
      | 'bridge'
      | 'masterclass'
      | 'revision_level_1'
      | 'revision_level_2'
      | 'revision_level_3'
      | 'independent_check'
      | 'transfer_check';
    title: string;
    focus: string;
    source_class_no: number;
    teaching_block: string;
    passage: string;
    prompt: string;
    options: string[] | null;
    attempt_no: number;
    can_answer: boolean;
  } | null;
  last_feedback: {
    activity_id: string;
    module_id: string;
    kind: string;
    correct: boolean;
    message: string;
  } | null;
  modules: Array<{
    module_id: string;
    title: string;
    source_class_no: number;
    focus: string;
    status: string;
    teaching_block: string;
    guided_check_label: string;
    bridge_label: string;
    independent_check_label: string;
    transfer_check_label: string;
    masterclass_trigger_rule: string;
  }>;
}

export interface SchoolSupportPlan extends SchoolCoachIdentity {
  session_id: string;
  flow_type: 'support';
  status: string;
  profile_version_id: string;
  source_placement_report_id: string | null;
  parent_session_id: string;
  parent_flow_type: 'curriculum' | 'recap' | 'readiness';
  subject_id: string;
  target_class_no: number;
  reason: string;
  focus: string;
  cap: Partial<{
    used: number;
    limit: number;
    remaining: number;
    scope: string;
  }>;
  history: Array<{
    event?: string;
    source_session_id?: string;
    attempt_no?: number;
    score?: number;
    skill_ids?: string[];
    path_type?: 'focused_revision' | 'expanded_revision' | 'parent_supported_pause';
    [key: string]: unknown;
  }>;
}

export interface SchoolCurriculumLanding {
  flow_type: 'curriculum';
  status: 'unlocked';
  subject_id: string;
  target_class_no: number;
  active_learning_class_no: number;
  preferred_teaching_language?: TeachingLanguage;
  source_recap_session_id: string | null;
  source_placement_report_id: string | null;
  book_title: string;
  source_note: string;
  chapters_preview: Array<{
    chapter_id: string;
    chapter_no: number;
    title: string;
    status: 'complete' | 'ready' | 'locked_next' | 'ready_next_slice';
  }>;
}

export interface SchoolSkillEvidenceSummary {
  skill_id: string;
  skill_label?: string;
  latest_evidence: string;
  last_attempt_type: string;
  last_chapter_id: string;
  attempts: number;
}

export interface SchoolCurriculumSession extends SchoolCoachIdentity {
  session_id: string;
  flow_type: 'curriculum';
  status: 'active' | 'paused_for_masterclass' | 'complete';
  phase: 'learning' | 'paused_for_masterclass' | 'chapter_check' | 'remediation' | 'needs_support' | 'capped_support' | 'complete';
  subject_id: string;
  target_class_no: number;
  active_learning_class_no: number;
  preferred_teaching_language?: TeachingLanguage;
  source_recap_session_id: string | null;
  source_placement_report_id: string | null;
  chapter: {
    chapter_id: string;
    title: string;
    book_title: string;
    unit_title: string;
    source_url: string;
    source_note: string;
    chapter_no?: number;
  };
  completed_chapter_ids: string[];
  next_available_chapter: {
    chapter_id: string;
    chapter_no: number;
    title: string;
    book_title: string;
    unit_title: string;
    source_url: string;
    source_note: string;
  } | null;
  carry_forward_focuses: string[];
  memory_summary?: {
    active_gaps: Array<{
      skill_id: string;
      skill_label?: string;
      gap: string;
      recommended_next_action: string;
      latest_evidence?: string;
      last_attempt_type?: string;
      last_chapter_id?: string;
    }>;
    improving_skill_ids: string[];
    strong_skill_ids: string[];
    improving_skills?: SchoolSkillEvidenceSummary[];
    strong_skills?: SchoolSkillEvidenceSummary[];
  };
  active_interrupt: {
    interrupt_id: string;
    level_id: string;
    focus: string;
    trigger_count: number;
    masterclass_session_id: string | null;
  } | null;
  interrupt_history: Array<{
    interrupt_id: string;
    level_id: string;
    focus: string;
    trigger_count: number;
    masterclass_session_id: string | null;
    resolution: 'complete' | 'abandoned' | 'capped_out';
  }>;
  progress: {
    completed_levels: number;
    total_levels: number;
    current_level_index: number;
  };
  chapter_assessment: {
    status: 'not_started' | 'in_progress' | 'remediation' | 'needs_support' | 'passed';
    attempt_no: number;
    item_number: number;
    total_items: number;
    last_result: {
      attempt_no: number;
      score: number;
      passed: boolean;
    } | null;
  } | null;
  levels: Array<{
    level_id: string;
    title: string;
    focus: string;
    skill_ids: string[];
    status: string;
    teaching_goal: string;
    guided_check_label: string;
    bridge_label: string;
    masterclass_label: string;
    independent_check_label: string;
    transfer_check_label: string;
  }>;
  current_activity: {
    activity_id: string;
    level_id: string;
    kind:
      | 'guided_check'
      | 'bridge'
      | 'masterclass'
      | 'revision_level_1'
      | 'revision_level_2'
      | 'revision_level_3'
      | 'independent_check'
      | 'transfer_check'
      | 'chapter_check'
      | 'v2_connect'
      | 'v2_co_construct'
      | 'v2_guided_practice'
      | 'v2_independent_application'
      | 'v2_transfer'
      | 'v2_review'
      | 'v2_support';
    title: string;
    focus: string;
    skill_ids: string[];
    teaching_block: string;
    passage: string;
    prompt: string;
    options: string[] | null;
    response_mode?: 'short' | 'paragraph';
    interaction_type?: SchoolCurriculumInteractionType | null;
    evidence_role?: SchoolCurriculumEvidenceRole | null;
    source_reference?: SchoolSourceReference | null;
    attempt_no: number;
    can_answer: boolean;
  } | null;
  last_feedback: {
    activity_id: string;
    level_id: string;
    kind: string;
    correct: boolean | null;
    result_visible?: boolean;
    message: string;
  } | null;
}

export interface SchoolMasterclassSession extends SchoolCoachIdentity {
  session_id: string;
  flow_type: 'masterclass';
  status: 'active' | 'complete' | 'abandoned';
  linked_curriculum_session_id: string;
  interrupt_id: string;
  level_id: string;
  focus: string;
  trigger_count: number;
  remediation_phase: string;
  completed_phases: number;
  total_phases: number;
  current_activity: {
    activity_id: string;
    kind: 'masterclass';
    remediation_phase: string;
    phase_index: number;
    phase_count: number;
    level_id: string;
    focus: string;
    title: string;
    teaching_block: string;
    passage: string;
    prompt: string;
    options: string[] | null;
    source_reference?: SchoolSourceReference | null;
    attempt_no: number;
    can_answer: boolean;
  } | null;
  last_feedback: {
    activity_id: string;
    correct: boolean;
    message: string;
  } | null;
}

export type SchoolMapStatus = 'complete' | 'active' | 'ready' | 'locked' | 'needs_support';

export type SchoolCatalogSupportStatus = 'available' | 'unavailable';

export interface SchoolCatalogClass {
  class_no: number;
  title: string;
  support_status: SchoolCatalogSupportStatus;
  unavailable_reason?: string;
}

export interface SchoolCatalogSubject {
  subject_id: string;
  title: string;
  support_status: SchoolCatalogSupportStatus;
  unavailable_reason?: string;
  classes: SchoolCatalogClass[];
}

export interface SchoolCatalogBoard {
  board_id: string;
  title: string;
  description: string;
  support_status: SchoolCatalogSupportStatus;
  unavailable_reason?: string;
  subjects: SchoolCatalogSubject[];
}

export interface SchoolCatalog {
  boards: SchoolCatalogBoard[];
  active_board_id: string | null;
  active_subject_id: string | null;
  active_class_no: number | null;
}

export interface SchoolClassMap extends SchoolCoachIdentity {
  subject_id: string;
  class_no: number;
  book_title: string;
  active_chapter_id: string | null;
  recent_growth: {
    improving_count: number;
    strong_count: number;
    active_focus_count: number;
  };
  chapters: Array<{
    chapter_id: string;
    chapter_no: number;
    title: string;
    status: SchoolMapStatus;
    completed_levels: number;
    total_levels: number;
    active_session_id: string | null;
  }>;
}

export interface SchoolChapterMap extends SchoolCoachIdentity {
  subject_id: string;
  class_no: number;
  chapter_id: string;
  chapter_no: number;
  title: string;
  book_title?: string;
  status: SchoolMapStatus;
  active_session_id: string | null;
  levels: Array<{
    level_id: string;
    title: string;
    learner_stage: 'Discover' | 'Practise Together' | 'Try It Yourself' | 'Use It Somewhere New';
    status: SchoolMapStatus;
  }>;
  chapter_check: {
    title: string;
    status: SchoolMapStatus;
  };
  active_interrupt?: {
    masterclass_session_id: string;
    level_id: string;
    title?: string;
  } | null;
}

const SCHOOL_STATE_CACHE_MS = 5_000;
const stateRequestCache = new SchoolStateRequestCache<SchoolStateResponse>(SCHOOL_STATE_CACHE_MS);
const SCHOOL_QWEN_REQUESTS_UNBOUNDED = process.env.NEXT_PUBLIC_SCHOOL_QWEN_UNBOUNDED === '1';
type SchoolApiFetchOptions = Omit<NonNullable<Parameters<typeof apiFetch>[1]>, 'timeoutMs'>;

const schoolReadFetch = (endpoint: string, options: SchoolApiFetchOptions = {}) => apiFetch(endpoint, {
  ...options,
  timeoutMs: SCHOOL_QWEN_REQUESTS_UNBOUNDED
    ? null
    : SCHOOL_READ_TIMEOUT_MS,
});

const schoolControlFetch = (endpoint: string, options: SchoolApiFetchOptions = {}) => apiFetch(endpoint, {
  ...options,
  timeoutMs: SCHOOL_QWEN_REQUESTS_UNBOUNDED
    ? null
    : SCHOOL_CONTROL_TIMEOUT_MS,
});

const schoolEvaluatorFetch = (endpoint: string, options: SchoolApiFetchOptions = {}) => apiFetch(endpoint, {
  ...options,
  timeoutMs: SCHOOL_QWEN_REQUESTS_UNBOUNDED
    ? null
    : SCHOOL_CLOUD_EVALUATOR_TIMEOUT_MS,
});

export function invalidateSchoolRebuildCache() {
  stateRequestCache.invalidate();
}

export async function getSchoolLoadScope(): Promise<SchoolLoadScope> {
  return stateRequestCache.loadScope(await getAuthCacheKey());
}

export async function getSchoolStateResponse(
  { force = false }: { force?: boolean } = {},
): Promise<SchoolStateResponse> {
  const authKey = await getAuthCacheKey();
  return stateRequestCache.get({
    authKey,
    force,
    load: () => schoolReadFetch('/school/state'),
  });
}

export async function getSchoolState({ force = false }: { force?: boolean } = {}): Promise<SchoolState> {
  const state = await getSchoolStateResponse({ force });
  if (state.available === false) throw new Error('school_unavailable');
  return state;
}

export async function getSchoolOnboarding(): Promise<SchoolOnboardingEnvelope> {
  return schoolReadFetch('/school/onboarding');
}

export async function saveSchoolOnboarding(
  request: SaveSchoolOnboardingRequest,
): Promise<SchoolOnboardingEnvelope> {
  return schoolControlFetch('/school/onboarding', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function activateSchoolOnboarding(
  request: ActivateSchoolOnboardingRequest,
): Promise<{
  profile_status: 'complete';
  profile: SchoolProfile;
}> {
  const result = await schoolControlFetch('/school/onboarding/complete', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  invalidateSchoolRebuildCache();
  return result;
}

export async function startSchoolPlacement(): Promise<SchoolPlacementResponse> {
  const result = await schoolControlFetch('/school/placement/start', { method: 'POST' });
  invalidateSchoolRebuildCache();
  return result;
}

export async function getSchoolPlacement(sessionId: string): Promise<SchoolPlacementResponse> {
  return schoolReadFetch(`/school/placement/${sessionId}`);
}

export async function answerSchoolPlacement(
  sessionId: string,
  itemId: string,
  answer: string,
): Promise<SchoolEvaluatorAnswerResult<SchoolPlacementResponse>> {
  const result = await schoolEvaluatorFetch(`/school/placement/${sessionId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ item_id: itemId, answer }),
  });
  invalidateSchoolRebuildCache();
  return result;
}

export async function abandonSchoolPlacement(
  sessionId: string,
): Promise<SchoolPlacementResponse> {
  const result = await schoolControlFetch(`/school/placement/${sessionId}/abandon`, {
    method: 'POST',
  });
  invalidateSchoolRebuildCache();
  return result;
}

export async function getSchoolPlacementReport(): Promise<SchoolPlacementReport> {
  return schoolReadFetch('/school/placement/report');
}

export async function startSchoolRecap(): Promise<SchoolRecapPath> {
  const result = await schoolControlFetch('/school/recap/start', { method: 'POST' });
  invalidateSchoolRebuildCache();
  return result;
}

export async function getActiveSchoolRecap(): Promise<SchoolRecapPath> {
  return schoolReadFetch('/school/recap');
}

export async function getSchoolSupportPlan(sessionId: string): Promise<SchoolSupportPlan> {
  return schoolReadFetch(`/school/support/${sessionId}`);
}

export async function answerSchoolRecap(
  sessionId: string,
  activityId: string,
  answer: string,
): Promise<SchoolEvaluatorAnswerResult<SchoolRecapPath>> {
  const result = await schoolEvaluatorFetch(`/school/recap/${sessionId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ activity_id: activityId, answer }),
  });
  invalidateSchoolRebuildCache();
  return result;
}

export async function getSchoolCurriculumLanding(): Promise<SchoolCurriculumLanding> {
  return schoolReadFetch('/school/curriculum');
}

export async function getSchoolCatalog(): Promise<SchoolCatalog> {
  return schoolReadFetch('/school/catalog');
}

export async function getSchoolClassMap(subjectId: string, classNo: number): Promise<SchoolClassMap> {
  return schoolReadFetch(`/school/catalog/${subjectId}/classes/${classNo}`);
}

export async function getSchoolChapterMap(
  subjectId: string,
  classNo: number,
  chapterId: string,
): Promise<SchoolChapterMap> {
  return schoolReadFetch(`/school/catalog/${subjectId}/classes/${classNo}/chapters/${chapterId}`);
}

export async function startSchoolCurriculum(
  chapterId: string,
  clientStartId: string,
): Promise<SchoolCurriculumSession> {
  const result = await schoolControlFetch('/school/curriculum/start', {
    method: 'POST',
    body: JSON.stringify({ chapter_id: chapterId, client_start_id: clientStartId }),
  });
  invalidateSchoolRebuildCache();
  return result;
}

export async function getSchoolCurriculumSession(sessionId: string): Promise<SchoolCurriculumSession> {
  return schoolReadFetch(`/school/curriculum/${sessionId}`);
}

export async function answerSchoolCurriculum(
  sessionId: string,
  activityId: string,
  answer: string,
): Promise<SchoolEvaluatorAnswerResult<SchoolCurriculumSession>> {
  const result = await schoolEvaluatorFetch(`/school/curriculum/${sessionId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ activity_id: activityId, answer }),
  });
  invalidateSchoolRebuildCache();
  return result;
}

export async function startSchoolCurriculumMasterclass(
  curriculumSessionId: string,
): Promise<SchoolMasterclassSession> {
  const result = await schoolControlFetch(
    `/school/curriculum/${curriculumSessionId}/masterclass/start`,
    { method: 'POST' },
  );
  invalidateSchoolRebuildCache();
  return result;
}

export async function getSchoolMasterclass(
  sessionId: string,
): Promise<SchoolMasterclassSession> {
  return schoolReadFetch(`/school/masterclass/${sessionId}`);
}

export async function answerSchoolMasterclass(
  sessionId: string,
  activityId: string,
  answer: string,
): Promise<SchoolEvaluatorAnswerResult<SchoolMasterclassSession>> {
  const result = await schoolEvaluatorFetch(`/school/masterclass/${sessionId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ activity_id: activityId, answer }),
  });
  invalidateSchoolRebuildCache();
  return result;
}

export async function resumeSchoolCurriculumMasterclass(
  curriculumSessionId: string,
): Promise<SchoolCurriculumSession> {
  const result = await schoolControlFetch(
    `/school/curriculum/${curriculumSessionId}/resume-masterclass`,
    { method: 'POST' },
  );
  invalidateSchoolRebuildCache();
  return result;
}

export async function abandonSchoolCurriculumMasterclass(
  curriculumSessionId: string,
): Promise<SchoolCurriculumSession> {
  const result = await schoolControlFetch(
    `/school/curriculum/${curriculumSessionId}/abandon-masterclass`,
    { method: 'POST' },
  );
  invalidateSchoolRebuildCache();
  return result;
}

export async function continueSchoolCurriculumAfterSupportCap(
  curriculumSessionId: string,
): Promise<SchoolCurriculumSession> {
  const result = await schoolControlFetch(
    `/school/curriculum/${curriculumSessionId}/continue-after-support-cap`,
    { method: 'POST' },
  );
  invalidateSchoolRebuildCache();
  return result;
}
