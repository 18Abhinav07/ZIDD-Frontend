export type SchoolTeachingLanguage = 'en' | 'hi' | 'hi_en';
export type SchoolEnglishComfort = 'low' | 'medium' | 'high';
import type {
  SchoolCatalog,
  SchoolCatalogSupportStatus,
} from '../services/schoolRebuild.ts';

export type SchoolBoard = string;
export type SchoolDifficultySignal =
  | 'reading'
  | 'vocabulary'
  | 'grammar'
  | 'writing'
  | 'chapter_answers';
export type SchoolOnboardingStep = 0 | 1 | 2 | 3 | 4;
export type SchoolOnboardingEditableStep = Exclude<SchoolOnboardingStep, 4>;

export function schoolProfileEditHref(step: SchoolOnboardingEditableStep = 2): string {
  return `/school/onboarding?intent=edit_profile&step=${step}`;
}

export interface SchoolOnboardingForm {
  display_name: string;
  school_name: string;
  board_id: SchoolBoard | null;
  target_class_no: number | null;
  subject_ids: string[];
  preferred_teaching_language: SchoolTeachingLanguage | null;
  english_comfort: SchoolEnglishComfort | null;
  learner_goal: string;
  parent_goal: string;
  prior_difficulty_signals: string[];
}

export interface SchoolOnboardingProfile extends Omit<SchoolOnboardingForm,
  'board_id' | 'target_class_no' | 'preferred_teaching_language' | 'english_comfort'> {
  profile_version_id: string;
  board_id: SchoolBoard;
  target_class_no: number;
  preferred_teaching_language: SchoolTeachingLanguage;
  english_comfort: SchoolEnglishComfort;
  coach_avatar_id: string | null;
  coach_palette_id: string | null;
}

export interface SchoolOnboardingCoachIdentity {
  coach_avatar_id: string | null;
  coach_palette_id: string | null;
}

export interface SchoolOnboardingDraft {
  profile_version_id: string;
  status: 'draft';
  current_step: number;
  draft_revision: number;
  display_name: string | null;
  school_name: string | null;
  board_id: SchoolBoard | null;
  target_class_no: number | null;
  subject_ids: string[] | null;
  preferred_teaching_language: SchoolTeachingLanguage | null;
  english_comfort: SchoolEnglishComfort | null;
  learner_goal: string | null;
  parent_goal: string | null;
  prior_difficulty_signals: string[] | null;
  coach_avatar_id?: string | null;
  coach_palette_id?: string | null;
}

export interface SchoolOnboardingSnapshot {
  profile_status: 'missing' | 'incomplete' | 'complete';
  active_profile: SchoolOnboardingProfile | null;
  draft: SchoolOnboardingDraft | null;
  profile: SchoolOnboardingProfile | null;
}

export type SchoolOnboardingFieldErrors = Partial<Record<keyof SchoolOnboardingForm, string>>;

export interface HydratedSchoolOnboarding {
  source: 'draft' | 'active' | 'default';
  form: SchoolOnboardingForm;
  persistedStep: SchoolOnboardingStep;
  activeProfile: SchoolOnboardingProfile | null;
  draft: SchoolOnboardingDraft | null;
  coachIdentity: SchoolOnboardingCoachIdentity;
}

export type SchoolOnboardingNavigationDecision =
  | { kind: 'blocked' }
  | { kind: 'navigate' }
  | { kind: 'save_then_navigate'; dirtyStep: SchoolOnboardingEditableStep };

export function decideSchoolOnboardingNavigation({
  busy,
  currentStep,
  nextStep,
  persistedStep,
  dirtyStep,
}: {
  busy: boolean;
  currentStep: SchoolOnboardingStep;
  nextStep: SchoolOnboardingStep;
  persistedStep: SchoolOnboardingStep;
  dirtyStep: SchoolOnboardingEditableStep | null;
}): SchoolOnboardingNavigationDecision {
  if (busy || nextStep === currentStep || nextStep > persistedStep) return { kind: 'blocked' };
  if (dirtyStep !== null) return { kind: 'save_then_navigate', dirtyStep };
  return { kind: 'navigate' };
}

const VALID_LANGUAGES = new Set<SchoolTeachingLanguage>(['en', 'hi', 'hi_en']);
const VALID_COMFORT = new Set<SchoolEnglishComfort>(['low', 'medium', 'high']);
const VALID_SIGNALS = new Set<SchoolDifficultySignal>([
  'reading',
  'vocabulary',
  'grammar',
  'writing',
  'chapter_answers',
]);

const DRAFT_CONFLICT_CODES = new Set([
  'school_draft_lineage_required',
  'school_draft_request_conflict',
  'school_draft_profile_conflict',
  'school_draft_revision_conflict',
  'school_draft_not_found',
]);

const ACTIVATION_CONFLICT_CODES = new Set([
  'school_activation_request_conflict',
  'school_activation_result_missing',
  'school_profile_not_found',
  'school_profile_revision_conflict',
  'school_profile_already_active',
  'school_profile_not_draft',
]);

export function isSchoolOnboardingConflict(error: unknown): boolean {
  const code = error instanceof Error ? error.message : '';
  return DRAFT_CONFLICT_CODES.has(code) || ACTIVATION_CONFLICT_CODES.has(code);
}

export function emptySchoolOnboardingForm(): SchoolOnboardingForm {
  return {
    display_name: '',
    school_name: '',
    board_id: null,
    target_class_no: null,
    subject_ids: [],
    preferred_teaching_language: null,
    english_comfort: null,
    learner_goal: '',
    parent_goal: '',
    prior_difficulty_signals: [],
  };
}

export function emptySchoolOnboardingCoachIdentity(): SchoolOnboardingCoachIdentity {
  return {
    coach_avatar_id: null,
    coach_palette_id: null,
  };
}

function clampStep(step: number): SchoolOnboardingStep {
  if (!Number.isFinite(step)) return 0;
  return Math.max(0, Math.min(4, Math.trunc(step))) as SchoolOnboardingStep;
}

function formFromDraft(draft: SchoolOnboardingDraft): SchoolOnboardingForm {
  return {
    display_name: draft.display_name ?? '',
    school_name: draft.school_name ?? '',
    board_id: draft.board_id,
    target_class_no: draft.target_class_no,
    subject_ids: [...(draft.subject_ids ?? [])],
    preferred_teaching_language: draft.preferred_teaching_language,
    english_comfort: draft.english_comfort,
    learner_goal: draft.learner_goal ?? '',
    parent_goal: draft.parent_goal ?? '',
    prior_difficulty_signals: [...(draft.prior_difficulty_signals ?? [])],
  };
}

function formFromProfile(profile: SchoolOnboardingProfile): SchoolOnboardingForm {
  return {
    display_name: profile.display_name,
    school_name: profile.school_name,
    board_id: profile.board_id,
    target_class_no: profile.target_class_no,
    subject_ids: [...profile.subject_ids],
    preferred_teaching_language: profile.preferred_teaching_language,
    english_comfort: profile.english_comfort,
    learner_goal: profile.learner_goal,
    parent_goal: profile.parent_goal,
    prior_difficulty_signals: [...profile.prior_difficulty_signals],
  };
}

function coachIdentityFrom(
  source: Partial<SchoolOnboardingCoachIdentity> | null | undefined,
): SchoolOnboardingCoachIdentity {
  const avatarId = source?.coach_avatar_id ?? null;
  const paletteId = source?.coach_palette_id ?? null;
  if (!avatarId || !paletteId || avatarId !== paletteId) {
    return emptySchoolOnboardingCoachIdentity();
  }
  return {
    coach_avatar_id: avatarId,
    coach_palette_id: paletteId,
  };
}

function materialProfileSnapshot(form: SchoolOnboardingForm) {
  return {
    board_id: form.board_id,
    target_class_no: form.target_class_no,
    subject_ids: Array.from(new Set(form.subject_ids)).sort(),
    preferred_teaching_language: form.preferred_teaching_language,
    english_comfort: form.english_comfort,
    prior_difficulty_signals: Array.from(new Set(form.prior_difficulty_signals)).sort(),
  };
}

export function hasMaterialSchoolProfileChanges(
  form: SchoolOnboardingForm,
  activeProfile: SchoolOnboardingProfile,
): boolean {
  return canonicalize(materialProfileSnapshot(form))
    !== canonicalize(materialProfileSnapshot(formFromProfile(activeProfile)));
}

export function hydrateSchoolOnboarding(snapshot: SchoolOnboardingSnapshot): HydratedSchoolOnboarding {
  if (snapshot.draft) {
    return {
      source: 'draft',
      form: formFromDraft(snapshot.draft),
      persistedStep: clampStep(snapshot.draft.current_step),
      activeProfile: snapshot.active_profile,
      draft: snapshot.draft,
      coachIdentity: coachIdentityFrom(snapshot.draft),
    };
  }
  if (snapshot.active_profile) {
    return {
      source: 'active',
      form: formFromProfile(snapshot.active_profile),
      persistedStep: 4,
      activeProfile: snapshot.active_profile,
      draft: null,
      coachIdentity: coachIdentityFrom(snapshot.active_profile),
    };
  }
  return {
    source: 'default',
    form: emptySchoolOnboardingForm(),
    persistedStep: 0,
    activeProfile: null,
    draft: null,
    coachIdentity: emptySchoolOnboardingCoachIdentity(),
  };
}

function validateLearnerStep(form: SchoolOnboardingForm): SchoolOnboardingFieldErrors {
  const errors: SchoolOnboardingFieldErrors = {};
  const displayLength = form.display_name.trim().length;
  const schoolLength = form.school_name.trim().length;
  if (displayLength < 2 || displayLength > 120) {
    errors.display_name = 'Learner name must be between 2 and 120 characters.';
  }
  if (schoolLength < 2 || schoolLength > 160) {
    errors.school_name = 'School name must be between 2 and 160 characters.';
  }
  return errors;
}

function validateClassStep(form: SchoolOnboardingForm): SchoolOnboardingFieldErrors {
  const errors: SchoolOnboardingFieldErrors = {};
  if (!form.board_id?.trim()) {
    errors.board_id = 'Choose an available curriculum.';
  }
  if (!Number.isInteger(form.target_class_no)) {
    errors.target_class_no = 'Choose an available class.';
  }
  if (form.subject_ids.length !== 1 || !form.subject_ids[0]?.trim()) {
    errors.subject_ids = 'Choose an available subject.';
  }
  return errors;
}

export function isSchoolCatalogSelectionSupported(
  catalog: SchoolCatalog | null,
  boardId: string | null,
  subjectId: string | null,
  classNo: number | null,
): boolean {
  if (!catalog || !boardId || !subjectId || classNo === null) return false;
  const board = catalog.boards.find((item) => item.board_id === boardId);
  if (!board || !isSchoolCatalogSupportAvailable(board.support_status)) return false;
  const subject = board.subjects.find((item) => item.subject_id === subjectId);
  if (!subject || !isSchoolCatalogSupportAvailable(subject.support_status)) return false;
  return subject.classes.some((item) => (
    item.class_no === classNo && isSchoolCatalogSupportAvailable(item.support_status)
  ));
}

export function isSchoolCatalogSupportAvailable(status: SchoolCatalogSupportStatus): boolean {
  return status === 'available';
}

function validateLanguageStep(form: SchoolOnboardingForm): SchoolOnboardingFieldErrors {
  const errors: SchoolOnboardingFieldErrors = {};
  if (!form.preferred_teaching_language || !VALID_LANGUAGES.has(form.preferred_teaching_language)) {
    errors.preferred_teaching_language = 'Choose a teaching language.';
  }
  if (!form.english_comfort || !VALID_COMFORT.has(form.english_comfort)) {
    errors.english_comfort = 'Choose the learner\'s English comfort level.';
  }
  return errors;
}

function validateGoalsStep(form: SchoolOnboardingForm): SchoolOnboardingFieldErrors {
  const errors: SchoolOnboardingFieldErrors = {};
  if (form.learner_goal.length > 360) {
    errors.learner_goal = 'Learner goal must be 360 characters or fewer.';
  }
  if (form.parent_goal.length > 360) {
    errors.parent_goal = 'Parent goal must be 360 characters or fewer.';
  }
  if (!form.learner_goal.trim() && !form.parent_goal.trim()) {
    errors.learner_goal = 'Add at least one learner or parent goal.';
    errors.parent_goal = 'Add at least one learner or parent goal.';
  }
  const uniqueSignals = new Set(form.prior_difficulty_signals);
  if (
    form.prior_difficulty_signals.length > 5
    || uniqueSignals.size !== form.prior_difficulty_signals.length
    || form.prior_difficulty_signals.some((signal) => !VALID_SIGNALS.has(signal as SchoolDifficultySignal))
  ) {
    errors.prior_difficulty_signals = 'Choose only the available difficulty areas.';
  }
  return errors;
}

export function validateSchoolOnboardingStep(
  step: SchoolOnboardingStep,
  form: SchoolOnboardingForm,
): SchoolOnboardingFieldErrors {
  if (step === 0) return validateLearnerStep(form);
  if (step === 1) return validateClassStep(form);
  if (step === 2) return validateLanguageStep(form);
  if (step === 3) return validateGoalsStep(form);
  return {
    ...validateLearnerStep(form),
    ...validateClassStep(form),
    ...validateLanguageStep(form),
    ...validateGoalsStep(form),
  };
}

export function buildOnboardingStepPatch(
  step: Exclude<SchoolOnboardingStep, 4>,
  form: SchoolOnboardingForm,
  coachIdentity: SchoolOnboardingCoachIdentity = emptySchoolOnboardingCoachIdentity(),
) {
  if (step === 0) {
    const hasCoachIdentity = Boolean(
      coachIdentity.coach_avatar_id
      && coachIdentity.coach_palette_id
      && coachIdentity.coach_avatar_id === coachIdentity.coach_palette_id,
    );
    return {
      display_name: form.display_name.trim(),
      school_name: form.school_name.trim(),
      ...(hasCoachIdentity ? coachIdentity : {}),
      current_step: 1 as const,
    };
  }
  if (step === 1) {
    return {
      board_id: form.board_id,
      target_class_no: form.target_class_no,
      subject_ids: [...form.subject_ids],
      current_step: 2 as const,
    };
  }
  if (step === 2) {
    return {
      preferred_teaching_language: form.preferred_teaching_language,
      english_comfort: form.english_comfort,
      current_step: 3 as const,
    };
  }
  return {
    learner_goal: form.learner_goal.trim(),
    parent_goal: form.parent_goal.trim(),
    prior_difficulty_signals: [...form.prior_difficulty_signals],
    current_step: 4 as const,
  };
}

export function clampOnboardingRouteStep(
  routeStep: string | null,
  persistedStep: number,
): SchoolOnboardingStep {
  const savedBoundary = clampStep(persistedStep);
  if (routeStep === null || routeStep.trim() === '') return savedBoundary;
  const parsed = Number(routeStep);
  if (!Number.isFinite(parsed)) return savedBoundary;
  const zeroBased = clampStep(Math.trunc(parsed) - 1);
  return Math.min(zeroBased, savedBoundary) as SchoolOnboardingStep;
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function clonePayload<T extends Record<string, unknown>>(payload: T): T {
  return JSON.parse(JSON.stringify(payload)) as T;
}

export function createOnboardingRequestCoordinator(createRequestId: () => string) {
  let pending: {
    operation: 'save' | 'activate';
    payloadKey: string;
    request: Record<string, unknown> & { request_id: string };
  } | null = null;

  return {
    prepare<T extends Record<string, unknown>>(operation: 'save' | 'activate', payload: T): T & { request_id: string } {
      const payloadKey = canonicalize(payload);
      if (pending?.operation === operation && pending.payloadKey === payloadKey) {
        return clonePayload(pending.request) as T & { request_id: string };
      }
      const request = { ...clonePayload(payload), request_id: createRequestId() };
      pending = { operation, payloadKey, request };
      return clonePayload(request) as T & { request_id: string };
    },
    clear(requestId?: string) {
      if (!requestId || pending?.request.request_id === requestId) pending = null;
    },
  };
}

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : '';
}

export async function saveSchoolDraftWithConflictRefresh<T>({
  save,
  refresh,
}: {
  save: () => Promise<T>;
  refresh: () => Promise<SchoolOnboardingSnapshot>;
}): Promise<
  | { kind: 'saved'; value: T }
  | { kind: 'conflict_refreshed'; hydrated: HydratedSchoolOnboarding }
> {
  try {
    return { kind: 'saved', value: await save() };
  } catch (error) {
    if (!DRAFT_CONFLICT_CODES.has(errorCode(error))) throw error;
    return {
      kind: 'conflict_refreshed',
      hydrated: hydrateSchoolOnboarding(await refresh()),
    };
  }
}

export type SchoolActivationContext = 'initial' | 'material_edit' | 'compatible_edit';

export interface SchoolActivationRecoveryMarker {
  profile_version_id: string;
  activation_context: SchoolActivationContext;
}

interface SchoolActivationRecoveryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SchoolActivationRecoveryStore {
  read(): SchoolActivationRecoveryMarker | null;
  write(marker: SchoolActivationRecoveryMarker): void;
  clear(): void;
}

const SCHOOL_ACTIVATION_RECOVERY_KEY = 'zidd.school.activation-recovery.v1';
const VALID_ACTIVATION_CONTEXTS = new Set<SchoolActivationContext>([
  'initial',
  'material_edit',
  'compatible_edit',
]);
const COMPATIBLE_EDIT_ACTIONS = new Set([
  'start_placement',
  'resume_placement',
  'view_placement_report',
  'resume_recap',
  'resume_curriculum',
  'start_masterclass',
  'resume_masterclass',
  'resume_support',
  'view_support_plan',
  'view_report',
]);

export function createSchoolActivationRecoveryStore(
  storage: SchoolActivationRecoveryStorage,
): SchoolActivationRecoveryStore {
  return {
    read() {
      const raw = storage.getItem(SCHOOL_ACTIVATION_RECOVERY_KEY);
      if (!raw) return null;
      try {
        const marker = JSON.parse(raw) as Record<string, unknown>;
        if (
          Object.keys(marker).length === 2
          && typeof marker.profile_version_id === 'string'
          && marker.profile_version_id.length > 0
          && typeof marker.activation_context === 'string'
          && VALID_ACTIVATION_CONTEXTS.has(marker.activation_context as SchoolActivationContext)
        ) {
          return {
            profile_version_id: marker.profile_version_id,
            activation_context: marker.activation_context as SchoolActivationContext,
          };
        }
      } catch {
        // Invalid recovery state is stale and must not block onboarding.
      }
      storage.removeItem(SCHOOL_ACTIVATION_RECOVERY_KEY);
      return null;
    },
    write(marker) {
      storage.setItem(SCHOOL_ACTIVATION_RECOVERY_KEY, JSON.stringify({
        profile_version_id: marker.profile_version_id,
        activation_context: marker.activation_context,
      }));
    },
    clear() {
      storage.removeItem(SCHOOL_ACTIVATION_RECOVERY_KEY);
    },
  };
}

interface SchoolActivationAuthoritativeState {
  next_action: string | null;
  allowed_next_actions: string[];
  next_action_url: string;
}

export type SchoolActivationResolution =
  | { kind: 'route'; href: string }
  | { kind: 'refresh_required' }
  | { kind: 'no_marker' }
  | { kind: 'stale_marker'; snapshot: SchoolOnboardingSnapshot }
  | { kind: 'unexpected_state' };

function resolveSchoolActivationState(
  state: SchoolActivationAuthoritativeState,
  activationContext: SchoolActivationContext,
  recoveryStore: SchoolActivationRecoveryStore,
): SchoolActivationResolution {
  const actionAuthorized = Boolean(
    state.next_action
    && state.allowed_next_actions.includes(state.next_action)
  );
  const routeAllowed = (
    typeof state.next_action_url === 'string'
    && /^\/school(?:[/?#]|$)/.test(state.next_action_url)
  );
  const contextAllowsAction = activationContext === 'compatible_edit'
    ? Boolean(state.next_action && COMPATIBLE_EDIT_ACTIONS.has(state.next_action))
    : state.next_action === 'start_placement';

  if (
    actionAuthorized
    && routeAllowed
    && contextAllowsAction
  ) {
    recoveryStore.clear();
    return { kind: 'route', href: state.next_action_url };
  }
  recoveryStore.clear();
  return { kind: 'unexpected_state' };
}

export function createSchoolActivationCoordinator<Request>({
  recoveryStore,
  activate,
  loadOnboarding,
  refreshState,
}: {
  recoveryStore: SchoolActivationRecoveryStore;
  activate: (request: Request) => Promise<{ profile: SchoolOnboardingProfile }>;
  loadOnboarding: () => Promise<SchoolOnboardingSnapshot>;
  refreshState: () => Promise<SchoolActivationAuthoritativeState>;
}) {
  let inFlight: Promise<SchoolActivationResolution> | null = null;

  const singleFlight = (operation: () => Promise<SchoolActivationResolution>) => {
    if (inFlight) return inFlight;
    const pending = operation().finally(() => {
      if (inFlight === pending) inFlight = null;
    });
    inFlight = pending;
    return pending;
  };

  const refreshCommittedActivation = async (
    activationContext: SchoolActivationContext,
  ): Promise<SchoolActivationResolution> => {
    try {
      return resolveSchoolActivationState(await refreshState(), activationContext, recoveryStore);
    } catch {
      return { kind: 'refresh_required' };
    }
  };

  return {
    submit(request: Request, activationContext: SchoolActivationContext) {
      return singleFlight(async () => {
        const response = await activate(request);
        recoveryStore.write({
          profile_version_id: response.profile.profile_version_id,
          activation_context: activationContext,
        });
        return refreshCommittedActivation(activationContext);
      });
    },
    recover() {
      return singleFlight(async () => {
        const marker = recoveryStore.read();
        if (!marker) return { kind: 'no_marker' };
        const snapshot = await loadOnboarding();
        if (snapshot.active_profile?.profile_version_id !== marker.profile_version_id) {
          recoveryStore.clear();
          return { kind: 'stale_marker', snapshot };
        }
        return refreshCommittedActivation(marker.activation_context);
      });
    },
  };
}

interface ActivationStateShape {
  next_action: string | null;
  allowed_next_actions: string[];
}

export async function reconcileSchoolActivation<TProfile>({
  committedProfile,
  activate,
  refreshState,
}: {
  committedProfile: TProfile | null;
  activate: () => Promise<TProfile>;
  refreshState: () => Promise<ActivationStateShape>;
}): Promise<
  | { kind: 'ready'; committedProfile: TProfile }
  | { kind: 'saved_refresh_required'; committedProfile: TProfile }
  | { kind: 'saved_unexpected_state'; committedProfile: TProfile }
> {
  const profile = committedProfile ?? await activate();
  let state: ActivationStateShape;
  try {
    state = await refreshState();
  } catch {
    return { kind: 'saved_refresh_required', committedProfile: profile };
  }
  if (
    state.next_action === 'start_placement'
    && state.allowed_next_actions.includes('start_placement')
  ) {
    return { kind: 'ready', committedProfile: profile };
  }
  return { kind: 'saved_unexpected_state', committedProfile: profile };
}
