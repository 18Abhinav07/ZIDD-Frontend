"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ReloadIcon,
} from '@radix-ui/react-icons';
import {
  SchoolPageHeading,
  SchoolStatusChip,
  schoolPrimaryActionClass,
  schoolSecondaryActionClass,
} from '@/components/school/SchoolPrimitives';
import {
  buildOnboardingStepPatch,
  clampOnboardingRouteStep,
  createSchoolActivationCoordinator,
  createSchoolActivationRecoveryStore,
  createOnboardingRequestCoordinator,
  decideSchoolOnboardingNavigation,
  emptySchoolOnboardingForm,
  hydrateSchoolOnboarding,
  hasMaterialSchoolProfileChanges,
  isSchoolCatalogSelectionSupported,
  isSchoolCatalogSupportAvailable,
  isSchoolOnboardingConflict,
  saveSchoolDraftWithConflictRefresh,
  validateSchoolOnboardingStep,
  type HydratedSchoolOnboarding,
  type SchoolOnboardingFieldErrors,
  type SchoolOnboardingForm,
  type SchoolOnboardingEditableStep,
  type SchoolOnboardingStep,
  type SchoolActivationContext,
} from '@/lib/schoolOnboardingPolicy';
import { resolveSchoolStateDestination } from '@/lib/schoolActivityPolicy';
import { learnerSafeErrorMessage } from '@/lib/errorCopy';
import {
  activateSchoolOnboarding,
  getSchoolCatalog,
  getSchoolOnboarding,
  getSchoolState,
  saveSchoolOnboarding,
  type ActivateSchoolOnboardingRequest,
  type SaveSchoolOnboardingRequest,
  type SchoolCatalog,
  type SchoolProfile,
} from '@/services/schoolRebuild';
import { ClassSubjectStep } from '../setup/ClassSubjectStep';
import { OnboardingStepRail } from './OnboardingStepRail';

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English', detail: 'Teaching and practice mostly in English.' },
  { value: 'hi_en', label: 'Hinglish', detail: 'Hindi support while building English confidence.' },
  { value: 'hi', label: 'Hindi', detail: 'Gentle Hindi explanations with separate English checks.' },
] as const;
const COMFORT_OPTIONS = [
  { value: 'low', label: 'I need help reading and writing answers' },
  { value: 'medium', label: 'I understand some English but need support' },
  { value: 'high', label: 'I am comfortable and want sharper practice' },
] as const;
const DIFFICULTY_OPTIONS = [
  { value: 'reading', label: 'Reading passages' },
  { value: 'vocabulary', label: 'Word meanings' },
  { value: 'grammar', label: 'Grammar use' },
  { value: 'writing', label: 'Writing full sentences' },
  { value: 'chapter_answers', label: 'Chapter answers' },
] as const;

const STEP_HEADINGS = [
  'Who is learning?',
  'What are you learning at school?',
  'Which language works best?',
  'What would you like help with?',
  'Does this learning setup look right?',
] as const;

const LANGUAGE_LABELS = { en: 'English', hi: 'Hindi', hi_en: 'Hinglish' } as const;
const COMFORT_LABELS = {
  low: 'Needs regular support',
  medium: 'Building confidence',
  high: 'Comfortable with English',
} as const;

const SCHOOL_FIELD_CLASS = 'mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-[var(--school-surface,#fcfdff)] px-3 text-base outline-none transition-[border-color,box-shadow] focus:border-[var(--school-accent)] focus:ring-2 focus:ring-[var(--school-accent-soft)]';

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'conflict' | 'error' | 'refresh_required';
type CatalogStatus = 'loading' | 'ready' | 'error';

function onboardingStepHref(step: SchoolOnboardingStep, activeProfileEditIntent: boolean) {
  return activeProfileEditIntent
    ? `/school/onboarding?intent=edit_profile&step=${step + 1}`
    : `/school/onboarding?step=${step + 1}`;
}

function requestId() {
  return crypto.randomUUID();
}

function fieldErrorId(field: keyof SchoolOnboardingForm) {
  return `school-onboarding-${field}-error`;
}

function FieldError({ field, errors }: {
  field: keyof SchoolOnboardingForm;
  errors: SchoolOnboardingFieldErrors;
}) {
  if (!errors[field]) return null;
  return (
    <p id={fieldErrorId(field)} role="alert" className="mt-2 text-sm font-semibold text-red-700">
      {errors[field]}
    </p>
  );
}

function describedBy(field: keyof SchoolOnboardingForm, errors: SchoolOnboardingFieldErrors) {
  return errors[field] ? fieldErrorId(field) : undefined;
}

function OnboardingSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading saved school setup"
      className="overflow-hidden rounded-[28px] border border-[var(--school-line)] bg-[var(--school-paper)] shadow-[var(--school-shadow)]"
    >
      <div className="border-b border-[var(--school-line)] bg-[var(--school-surface-soft)] px-5 py-5 sm:px-7">
        <div className="h-3 w-28 animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none" />
        <div className="mt-4 grid grid-cols-5 gap-1.5">
          {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-1 animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none" />)}
        </div>
      </div>
      <div className="space-y-5 px-5 py-8 sm:px-10 sm:py-10">
        <div className="h-11 w-80 max-w-full animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />
        <div className="h-4 w-full max-w-lg animate-pulse rounded-full bg-slate-100 motion-reduce:animate-none" />
        <div className="h-12 w-full animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />
        <div className="h-12 w-full animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />
      </div>
    </div>
  );
}

export function SchoolOnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeProfileEditIntent = searchParams.get('intent') === 'edit_profile';
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const saveRequests = useRef(createOnboardingRequestCoordinator(requestId));
  const activationRequests = useRef(createOnboardingRequestCoordinator(requestId));
  const activationCoordinator = useRef<ReturnType<
    typeof createSchoolActivationCoordinator<ActivateSchoolOnboardingRequest>
  > | null>(null);
  const loadInFlight = useRef<Promise<void> | null>(null);
  const catalogLoadInFlight = useRef<Promise<void> | null>(null);
  const dirtyStepRef = useRef<SchoolOnboardingEditableStep | null>(null);
  const saveInFlight = useRef<Promise<HydratedSchoolOnboarding | null> | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState('');
  const [catalog, setCatalog] = useState<SchoolCatalog | null>(null);
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>('loading');
  const [catalogError, setCatalogError] = useState('');
  const [form, setForm] = useState<SchoolOnboardingForm>(emptySchoolOnboardingForm);
  const [step, setStep] = useState<SchoolOnboardingStep>(0);
  const [persistedStep, setPersistedStep] = useState<SchoolOnboardingStep>(0);
  const [activeProfile, setActiveProfile] = useState<SchoolProfile | null>(null);
  const [draft, setDraft] = useState<HydratedSchoolOnboarding['draft']>(null);
  const [errors, setErrors] = useState<SchoolOnboardingFieldErrors>({});
  const [message, setMessage] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [busy, setBusy] = useState(false);
  const [editConfirmed, setEditConfirmed] = useState(false);
  const [dirtyStep, setDirtyStep] = useState<SchoolOnboardingEditableStep | null>(null);
  const [goalOwner, setGoalOwner] = useState<'learner' | 'parent'>('learner');
  const [supportSignalsOpen, setSupportSignalsOpen] = useState(false);
  const hasMaterialChanges = activeProfile
    ? hasMaterialSchoolProfileChanges(form, activeProfile)
    : false;

  const applyHydration = useCallback((hydrated: HydratedSchoolOnboarding) => {
    setForm(hydrated.form);
    setPersistedStep(hydrated.persistedStep);
    setActiveProfile(hydrated.activeProfile as SchoolProfile | null);
    setDraft(hydrated.draft);
    dirtyStepRef.current = null;
    setDirtyStep(null);
    setEditConfirmed(false);
    setGoalOwner(hydrated.form.parent_goal.trim() && !hydrated.form.learner_goal.trim() ? 'parent' : 'learner');
    setSupportSignalsOpen(hydrated.form.prior_difficulty_signals.length > 0);
    setErrors({});
    setLoadingError('');
    setLoaded(true);
  }, []);

  const getActivationCoordinator = useCallback(() => {
    if (!activationCoordinator.current) {
      activationCoordinator.current = createSchoolActivationCoordinator({
        recoveryStore: createSchoolActivationRecoveryStore(window.sessionStorage),
        activate: async (request: ActivateSchoolOnboardingRequest) => {
          const response = await activateSchoolOnboarding(request);
          activationRequests.current.clear(request.request_id);
          return response;
        },
        loadOnboarding: getSchoolOnboarding,
        refreshState: () => getSchoolState({ force: true }),
      });
    }
    return activationCoordinator.current;
  }, []);

  const load = useCallback(() => {
    if (loadInFlight.current) return loadInFlight.current;

    const operation = (async () => {
      setLoadingError('');
      setLoaded(false);
      try {
        const recovery = await getActivationCoordinator().recover();
        if (recovery.kind === 'route') {
          router.replace(recovery.href);
          return;
        }
        const recoveryAllowsExplicitEdit = (
          recovery.kind === 'no_marker' || recovery.kind === 'stale_marker'
        );
        const state = await getSchoolState({ force: true });
        const destination = resolveSchoolStateDestination({
          nextAction: state.next_action,
          allowedNextActions: state.allowed_next_actions,
          nextActionUrl: state.next_action_url,
        });
        if (!destination) throw new Error('school_state_unresolved');
        if (
          (!activeProfileEditIntent || !recoveryAllowsExplicitEdit)
          && !destination.startsWith('/school/onboarding')
        ) {
          router.replace(destination);
          return;
        }
        const snapshot = recovery.kind === 'stale_marker'
          ? recovery.snapshot
          : await getSchoolOnboarding();
        const canOpenActiveProfileEdit = (
          activeProfileEditIntent
          && recoveryAllowsExplicitEdit
          && state.profile_status === 'complete'
          && snapshot.active_profile !== null
        );
        if (!canOpenActiveProfileEdit && !destination.startsWith('/school/onboarding')) {
          router.replace(destination);
          return;
        }
        const hydrated = hydrateSchoolOnboarding(snapshot);
        applyHydration(hydrated);
        if (recovery.kind === 'refresh_required' || recovery.kind === 'unexpected_state') {
          setSaveStatus('refresh_required');
          setMessage('Your setup is active. Refresh the backend-approved next step without submitting it again.');
        } else {
          setSaveStatus(hydrated.source === 'draft' ? 'saved' : 'idle');
          setMessage(hydrated.source === 'draft' ? 'Latest saved setup restored.' : '');
        }
      } catch (error: unknown) {
        setLoadingError(learnerSafeErrorMessage(error, 'Could not load the saved school setup.'));
      }
    })();

    loadInFlight.current = operation;
    void operation.finally(() => {
      if (loadInFlight.current === operation) loadInFlight.current = null;
    });
    return operation;
  }, [activeProfileEditIntent, applyHydration, getActivationCoordinator, router]);

  const loadCatalog = useCallback(() => {
    if (catalogLoadInFlight.current) return catalogLoadInFlight.current;

    const operation = (async () => {
      setCatalog(null);
      setCatalogError('');
      setCatalogStatus('loading');
      try {
        const nextCatalog = await getSchoolCatalog();
        if (!nextCatalog.boards.some((board) => (
          isSchoolCatalogSupportAvailable(board.support_status)
          && board.subjects.some((subject) => (
            isSchoolCatalogSupportAvailable(subject.support_status)
            && subject.classes.some((schoolClass) => (
              isSchoolCatalogSupportAvailable(schoolClass.support_status)
            ))
          ))
        ))) {
          throw new Error('school_catalog_has_no_live_choices');
        }
        setCatalog(nextCatalog);
        setCatalogStatus('ready');
      } catch (error: unknown) {
        setCatalogError(learnerSafeErrorMessage(
          error,
          'Could not load the approved class and subject choices.',
        ));
        setCatalogStatus('error');
      }
    })();

    catalogLoadInFlight.current = operation;
    void operation.finally(() => {
      if (catalogLoadInFlight.current === operation) catalogLoadInFlight.current = null;
    });
    return operation;
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (!loaded) return;
    const routeStep = clampOnboardingRouteStep(searchParams.get('step'), persistedStep);
    if (dirtyStep !== null && routeStep !== step) {
      router.replace(onboardingStepHref(step, activeProfileEditIntent), { scroll: false });
      return;
    }
    setStep(routeStep);
    const canonical = String(routeStep + 1);
    if (searchParams.get('step') !== canonical) {
      router.replace(onboardingStepHref(routeStep, activeProfileEditIntent), { scroll: false });
    }
  }, [activeProfileEditIntent, dirtyStep, loaded, persistedStep, router, searchParams, step]);

  useEffect(() => {
    if (!loaded) return;
    const frame = requestAnimationFrame(() => headingRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [loaded, step]);

  const updateField = <K extends keyof SchoolOnboardingForm>(field: K, value: SchoolOnboardingForm[K]) => {
    if (step !== 4 && dirtyStepRef.current === null) {
      dirtyStepRef.current = step;
      setDirtyStep(step);
    }
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setMessage('Unsaved changes.');
    setSaveStatus('dirty');
  };

  const selectCatalogSubject = (subjectId: string, classes: number[]) => {
    if (step !== 4 && dirtyStepRef.current === null) {
      dirtyStepRef.current = step;
      setDirtyStep(step);
    }
    setForm((current) => ({
      ...current,
      subject_ids: [subjectId],
      target_class_no: current.target_class_no !== null && classes.includes(current.target_class_no)
        ? current.target_class_no
        : null,
    }));
    setErrors((current) => ({
      ...current,
      subject_ids: undefined,
      target_class_no: undefined,
    }));
    setMessage('Unsaved changes.');
    setSaveStatus('dirty');
  };

  const selectCatalogBoard = (boardId: string) => {
    if (step !== 4 && dirtyStepRef.current === null) {
      dirtyStepRef.current = step;
      setDirtyStep(step);
    }
    setForm((current) => ({
      ...current,
      board_id: boardId,
      subject_ids: [],
      target_class_no: null,
    }));
    setErrors((current) => ({
      ...current,
      board_id: undefined,
      subject_ids: undefined,
      target_class_no: undefined,
    }));
    setMessage('Unsaved changes.');
    setSaveStatus('dirty');
  };

  const refreshAfterConflict = (hydrated: HydratedSchoolOnboarding) => {
    applyHydration(hydrated);
    saveRequests.current.clear();
    activationRequests.current.clear();
    setSaveStatus('conflict');
    setMessage('Setup changed in another session. The latest saved version is now loaded.');
    router.replace(onboardingStepHref(hydrated.persistedStep, activeProfileEditIntent), { scroll: false });
  };

  const persistOnboardingStep = async (
    stepToSave: SchoolOnboardingEditableStep,
  ): Promise<HydratedSchoolOnboarding | null> => {
    if (saveInFlight.current) return saveInFlight.current;

    const operation = (async () => {
      const validation = validateSchoolOnboardingStep(stepToSave, form);
      if (stepToSave === 1 && !isSchoolCatalogSelectionSupported(
        catalog,
        form.board_id,
        form.subject_ids[0] ?? null,
        form.target_class_no,
      )) {
        const selectedBoard = catalog?.boards.find((board) => board.board_id === form.board_id);
        const subjectAvailable = selectedBoard?.subjects.some(
          (subject) => subject.subject_id === form.subject_ids[0]
            && isSchoolCatalogSupportAvailable(subject.support_status),
        );
        if (!subjectAvailable) {
          validation.subject_ids = 'Choose an available subject from the School catalog.';
        } else {
          validation.target_class_no = 'Choose an available class for this subject.';
        }
      }
      setErrors(validation);
      if (Object.keys(validation).length > 0) {
        setMessage('Check the highlighted fields before continuing.');
        setSaveStatus('error');
        return null;
      }

      setBusy(true);
      setLoadingError('');
      setSaveStatus('saving');
      setMessage('Saving this step...');
      const patch = buildOnboardingStepPatch(stepToSave, form);
      const payload = {
        ...patch,
        ...(draft ? {
          profile_version_id: draft.profile_version_id,
          expected_revision: draft.draft_revision,
        } : {}),
      };
      const request = saveRequests.current.prepare('save', payload);
      try {
        const result = await saveSchoolDraftWithConflictRefresh({
          save: () => saveSchoolOnboarding(request as SaveSchoolOnboardingRequest),
          refresh: getSchoolOnboarding,
        });
        if (result.kind === 'conflict_refreshed') {
          refreshAfterConflict(result.hydrated);
          return null;
        }

        saveRequests.current.clear(request.request_id);
        const hydrated = hydrateSchoolOnboarding(result.value);
        applyHydration(hydrated);
        setSaveStatus('saved');
        setMessage('Saved.');
        return hydrated;
      } catch (error: unknown) {
        setSaveStatus('error');
        setMessage('Save was interrupted. Retrying unchanged details will reuse the same request.');
        setErrors({});
        setLoadingError(learnerSafeErrorMessage(error, 'Could not save this step. Please retry.'));
        return null;
      } finally {
        setBusy(false);
      }
    })();

    saveInFlight.current = operation;
    try {
      return await operation;
    } finally {
      if (saveInFlight.current === operation) saveInFlight.current = null;
    }
  };

  const navigateToStep = async (nextStep: SchoolOnboardingStep) => {
    const decision = decideSchoolOnboardingNavigation({
      busy: busy || saveInFlight.current !== null,
      currentStep: step,
      nextStep,
      persistedStep,
      dirtyStep: dirtyStepRef.current,
    });
    if (decision.kind === 'blocked') return;
    if (decision.kind === 'save_then_navigate') {
      const saved = await persistOnboardingStep(decision.dirtyStep);
      if (!saved) return;
    }
    router.push(onboardingStepHref(nextStep, activeProfileEditIntent), { scroll: false });
  };

  const continueStep = async () => {
    if (busy || step === 4) return;
    const nextStep = buildOnboardingStepPatch(step, form).current_step;
    const saved = await persistOnboardingStep(step);
    if (!saved) return;
    router.push(onboardingStepHref(nextStep, activeProfileEditIntent), { scroll: false });
  };

  const finishActivation = async () => {
    if (busy || saveInFlight.current) return;
    const validation = validateSchoolOnboardingStep(4, form);
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      setSaveStatus('error');
      setMessage('Review the missing setup details before confirming.');
      const firstInvalidStep = ([0, 1, 2, 3] as const).find((candidate) => (
        Object.keys(validateSchoolOnboardingStep(candidate, form)).length > 0
      ));
      if (firstInvalidStep !== undefined) {
        router.push(onboardingStepHref(firstInvalidStep, activeProfileEditIntent), { scroll: false });
      }
      return;
    }
    if (catalogStatus !== 'ready' || !isSchoolCatalogSelectionSupported(
      catalog,
      form.board_id,
      form.subject_ids[0] ?? null,
      form.target_class_no,
    )) {
      setSaveStatus('error');
      setMessage('Refresh the approved class and subject choices before confirming this setup.');
      return;
    }
    if (activeProfile && hasMaterialChanges && !editConfirmed) {
      setMessage('Confirm the School work restart notice before activating this setup.');
      setSaveStatus('error');
      return;
    }

    let activationDraft = draft;
    if (dirtyStepRef.current !== null) {
      const saved = await persistOnboardingStep(dirtyStepRef.current);
      if (!saved) return;
      activationDraft = saved.draft;
    }
    if (!activationDraft) {
      setSaveStatus('error');
      setMessage('Save every setup step before confirming.');
      setLoadingError('Could not find the saved School setup. Please retry the current step.');
      return;
    }

    setBusy(true);
    setLoadingError('');
    setSaveStatus('saving');
    setMessage('Checking the saved setup and backend-approved next step...');
    try {
      const coordinator = getActivationCoordinator();
      let result = await coordinator.recover();
      if (result.kind === 'no_marker' || result.kind === 'stale_marker') {
        const request = activationRequests.current.prepare('activate', {
            profile_version_id: activationDraft.profile_version_id,
            expected_revision: activationDraft.draft_revision,
        }) as ActivateSchoolOnboardingRequest;
        const activationContext: SchoolActivationContext = !activeProfile
          ? 'initial'
          : hasMaterialChanges
            ? 'material_edit'
            : 'compatible_edit';
        result = await coordinator.submit(request, activationContext);
      }
      if (result.kind === 'route') {
        setSaveStatus('saved');
        setMessage('Setup saved. Opening the backend-approved next step.');
        router.replace(result.href);
        return;
      }
      if (result.kind === 'refresh_required') {
        setSaveStatus('refresh_required');
        setMessage('Your setup is saved. Refresh the next step without submitting it again.');
        return;
      }
      setSaveStatus('refresh_required');
      setMessage('Your setup is saved, but School Prep has not authorized a valid next step yet. Refresh the saved state.');
    } catch (error: unknown) {
      if (isSchoolOnboardingConflict(error)) {
        try {
          refreshAfterConflict(hydrateSchoolOnboarding(await getSchoolOnboarding()));
        } catch (refreshError: unknown) {
          setSaveStatus('error');
          setLoadingError(learnerSafeErrorMessage(refreshError, 'Could not refresh the latest saved setup.'));
        }
        return;
      }
      setSaveStatus('error');
      setMessage('Confirmation was interrupted. Retrying unchanged details will reuse the same request.');
      setLoadingError(learnerSafeErrorMessage(error, 'Could not confirm the saved setup. Please retry.'));
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) {
    return loadingError ? (
      <section role="alert" className="rounded-[28px] border border-red-200 bg-[var(--school-paper)] px-5 py-7 text-red-950 shadow-[var(--school-shadow)] sm:px-8">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-none" />
          <div>
            <p className="font-bold">{loadingError}</p>
            <button
              type="button"
              onClick={() => void load()}
              className={`${schoolSecondaryActionClass} mt-4`}
            >
              <ReloadIcon className="h-4 w-4" />
              Retry loading
            </button>
          </div>
        </div>
      </section>
    ) : <OnboardingSkeleton />;
  }

  const toggleDifficulty = (value: string) => {
    const current = form.prior_difficulty_signals;
    updateField(
      'prior_difficulty_signals',
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  };
  const selectedSubjectTitle = catalog?.boards
    .find((board) => board.board_id === form.board_id)
    ?.subjects.find((subject) => subject.subject_id === form.subject_ids[0])
    ?.title;

  return (
    <div className="overflow-hidden rounded-[28px] border border-[var(--school-line)] bg-[var(--school-paper)] shadow-[var(--school-shadow)]">
      <OnboardingStepRail
        currentStep={step}
        persistedStep={persistedStep}
        disabled={busy}
        onSelect={navigateToStep}
      />

      <fieldset disabled={busy} className="min-w-0 px-5 pb-6 pt-7 disabled:opacity-90 sm:px-10 sm:pb-8 sm:pt-9" data-school-region="form-workspace">
        <div>
          <SchoolPageHeading
            eyebrow=""
            title={STEP_HEADINGS[step]}
            description={<StepIntroduction step={step} />}
            titleRef={headingRef}
            titleTabIndex={-1}
            level="h2"
            size="section"
            className="[&>p:first-child]:hidden [&>h2]:mt-0"
          />
        </div>

        <div className="py-7">
          {step === 0 && (
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-800">
                Learner name
                <input
                  value={form.display_name}
                  onChange={(event) => updateField('display_name', event.target.value)}
                  aria-invalid={Boolean(errors.display_name)}
                  aria-describedby={describedBy('display_name', errors)}
                  maxLength={120}
                  autoComplete="name"
                  className={SCHOOL_FIELD_CLASS}
                />
                <FieldError field="display_name" errors={errors} />
              </label>
              <label className="block text-sm font-semibold text-slate-800">
                School name
                <input
                  value={form.school_name}
                  onChange={(event) => updateField('school_name', event.target.value)}
                  aria-invalid={Boolean(errors.school_name)}
                  aria-describedby={describedBy('school_name', errors)}
                  maxLength={160}
                  autoComplete="organization"
                  className={SCHOOL_FIELD_CLASS}
                />
                <FieldError field="school_name" errors={errors} />
              </label>
            </div>
          )}

          {step === 1 && (
            <ClassSubjectStep
              boardId={form.board_id}
              targetClassNo={form.target_class_no}
              subjectIds={form.subject_ids}
              catalog={catalog}
              loading={catalogStatus === 'loading'}
              error={catalogError}
              boardError={<FieldError field="board_id" errors={errors} />}
              classError={<FieldError field="target_class_no" errors={errors} />}
              subjectError={<FieldError field="subject_ids" errors={errors} />}
              onBoardChange={selectCatalogBoard}
              onSubjectChange={selectCatalogSubject}
              onClassChange={(classNo) => updateField('target_class_no', classNo)}
              onRetry={() => void loadCatalog()}
            />
          )}

          {step === 2 && (
            <div className="space-y-7">
              <ChoiceGroup label="Preferred teaching language" error={<FieldError field="preferred_teaching_language" errors={errors} />}>
                <div className="grid gap-3" role="radiogroup" aria-label="Preferred teaching language">
                  {LANGUAGE_OPTIONS.map((option) => (
                    <ChoiceButton
                      key={option.value}
                      selected={form.preferred_teaching_language === option.value}
                      label={option.label}
                      detail={option.detail}
                      onClick={() => updateField('preferred_teaching_language', option.value)}
                    />
                  ))}
                </div>
              </ChoiceGroup>
              <ChoiceGroup label="English comfort" error={<FieldError field="english_comfort" errors={errors} />}>
                <div className="grid gap-3" role="radiogroup" aria-label="English comfort">
                  {COMFORT_OPTIONS.map((option) => (
                    <ChoiceButton
                      key={option.value}
                      selected={form.english_comfort === option.value}
                      label={option.label}
                      onClick={() => updateField('english_comfort', option.value)}
                    />
                  ))}
                </div>
              </ChoiceGroup>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-7">
              <div>
                <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1" aria-label="Whose learning goal is this?">
                  <button
                    type="button"
                    aria-pressed={goalOwner === 'learner'}
                    onClick={() => setGoalOwner('learner')}
                    className={`min-h-11 rounded-lg px-4 text-sm font-semibold transition-[background-color,color,box-shadow] ${goalOwner === 'learner' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Learner goal
                  </button>
                  <button
                    type="button"
                    aria-pressed={goalOwner === 'parent'}
                    onClick={() => setGoalOwner('parent')}
                    className={`min-h-11 rounded-lg px-4 text-sm font-semibold transition-[background-color,color,box-shadow] ${goalOwner === 'parent' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Parent goal
                  </button>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-500">Add at least one goal. Switching tabs will not clear what you wrote.</p>
              </div>

              {goalOwner === 'learner' ? (
                <label className="block text-sm font-semibold text-slate-800">
                  What would you like to get better at?
                  <textarea
                    value={form.learner_goal}
                    onChange={(event) => updateField('learner_goal', event.target.value)}
                    aria-invalid={Boolean(errors.learner_goal)}
                    aria-describedby={describedBy('learner_goal', errors)}
                    maxLength={360}
                    className={`${SCHOOL_FIELD_CLASS} min-h-32 resize-y py-3 leading-6`}
                  />
                  <span className="mt-1 block text-right text-xs text-slate-500">{form.learner_goal.length}/360</span>
                  <FieldError field="learner_goal" errors={errors} />
                </label>
              ) : (
                <label className="block text-sm font-semibold text-slate-800">
                  What progress would a parent like to see?
                  <textarea
                    value={form.parent_goal}
                    onChange={(event) => updateField('parent_goal', event.target.value)}
                    aria-invalid={Boolean(errors.parent_goal)}
                    aria-describedby={describedBy('parent_goal', errors)}
                    maxLength={360}
                    className={`${SCHOOL_FIELD_CLASS} min-h-32 resize-y py-3 leading-6`}
                  />
                  <span className="mt-1 block text-right text-xs text-slate-500">{form.parent_goal.length}/360</span>
                  <FieldError field="parent_goal" errors={errors} />
                </label>
              )}

              <details
                open={supportSignalsOpen}
                onToggle={(event) => setSupportSignalsOpen(event.currentTarget.open)}
                className="border-y border-slate-200 py-4"
              >
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-slate-800">
                  <span>
                    Areas where support may help
                    <span className="ml-2 font-normal text-slate-500">Optional</span>
                  </span>
                  <span className="text-xs text-slate-500">{form.prior_difficulty_signals.length || 'None'} selected</span>
                </summary>
                <div className="pt-5">
                  <ChoiceGroup label="Choose any that apply" error={<FieldError field="prior_difficulty_signals" errors={errors} />}>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {DIFFICULTY_OPTIONS.map((option) => {
                        const selected = form.prior_difficulty_signals.includes(option.value);
                        return (
                          <button
                            key={option.value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleDifficulty(option.value)}
                            className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 text-left text-sm font-semibold transition-[background-color,border-color,color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--school-accent)] focus-visible:ring-offset-2 ${
                              selected
                                ? 'border-[var(--school-accent)] bg-[var(--school-accent-soft)] text-[var(--school-accent-deep)]'
                                : 'border-slate-300 bg-[var(--school-surface,#fcfdff)] text-slate-700 hover:border-[var(--school-accent-border)]'
                            }`}
                          >
                            <span className="flex h-5 w-5 flex-none items-center justify-center border border-current" aria-hidden="true">
                              {selected && <CheckIcon className="h-3.5 w-3.5" />}
                            </span>
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </ChoiceGroup>
                </div>
              </details>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              {catalogStatus === 'error' && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-950">
                  <p className="font-semibold">{catalogError}</p>
                  <button
                    type="button"
                    onClick={() => void loadCatalog()}
                    className={`${schoolSecondaryActionClass} mt-3`}
                  >
                    <ReloadIcon className="h-4 w-4" aria-hidden="true" />
                    Retry choices
                  </button>
                </div>
              )}
              <dl className="grid border-t border-slate-200 sm:grid-cols-2">
                <Summary label="Learner" value={form.display_name || 'Not provided'} />
                <Summary label="School" value={form.school_name || 'Not provided'} />
                <Summary label="Class" value={form.target_class_no ? `Class ${form.target_class_no}` : 'Not selected'} />
                <Summary
                  label="Subject"
                  value={selectedSubjectTitle ?? (form.subject_ids.length ? 'Unavailable selection' : 'Not selected')}
                />
                <Summary
                  label="Teaching language"
                  value={form.preferred_teaching_language ? LANGUAGE_LABELS[form.preferred_teaching_language] : 'Not selected'}
                />
                <Summary
                  label="English comfort"
                  value={form.english_comfort ? COMFORT_LABELS[form.english_comfort] : 'Not selected'}
                />
                <Summary label="Learner goal" value={form.learner_goal || 'Not provided'} />
                <Summary label="Parent goal" value={form.parent_goal || 'Not provided'} />
                <Summary
                  label="Support areas"
                  value={form.prior_difficulty_signals.length
                    ? form.prior_difficulty_signals.map((value) => (
                        DIFFICULTY_OPTIONS.find((option) => option.value === value)?.label ?? value
                      )).join(', ')
                    : 'None selected'}
                />
              </dl>

              {activeProfile && hasMaterialChanges ? (
                <label className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm leading-6 text-orange-950">
                  <input
                    type="checkbox"
                    checked={editConfirmed}
                    onChange={(event) => setEditConfirmed(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-[var(--school-accent)]"
                  />
                  <span>
                    <strong className="block">Confirm setup changes</strong>
                    Changing class, curriculum, subject, or teaching language starts a fresh learning path. Your completed reports remain saved.
                  </span>
                </label>
              ) : activeProfile ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  These updates keep your current learning path and save the new profile details.
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--school-accent-border)] bg-[var(--school-accent-soft)] p-4 text-sm leading-6 text-[var(--school-accent-deep)]">
                  We will save this setup and begin with a short starting-point check.
                </div>
              )}
            </div>
          )}
        </div>

        {(loadingError || message) && (
          <div role={loadingError ? 'alert' : 'status'} aria-live={loadingError ? 'assertive' : 'polite'} className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <SchoolStatusChip
              tone={loadingError || saveStatus === 'error'
                ? 'error'
                : saveStatus === 'conflict' || saveStatus === 'refresh_required'
                  ? 'support'
                  : 'accent'}
            >
              {loadingError || saveStatus === 'error'
                ? 'Needs attention'
                : saveStatus === 'conflict' || saveStatus === 'refresh_required'
                  ? 'Check saved state'
                  : saveStatus === 'saving'
                    ? 'Saving'
                    : 'Saved progress'}
            </SchoolStatusChip>
            <span className="min-w-0 flex-1">{loadingError || message}</span>
          </div>
        )}

        <div className="flex min-h-14 flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between" data-school-region="form-actions">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => navigateToStep((step - 1) as SchoolOnboardingStep)}
              disabled={busy}
              className={schoolSecondaryActionClass}
            >
              <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
              Back
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void (step === 4 ? finishActivation() : continueStep())}
            disabled={busy || (step === 1 && catalogStatus !== 'ready')}
            aria-busy={busy}
            className={`${schoolPrimaryActionClass} w-full min-w-[11rem] sm:ml-auto sm:w-auto`}
          >
            {saveStatus === 'refresh_required'
              ? <ReloadIcon className="h-4 w-4" aria-hidden="true" />
              : <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />}
            {step === 4
              ? busy
                ? 'Confirming setup'
                : saveStatus === 'refresh_required'
                  ? 'Refresh next step'
                  : activeProfile && !hasMaterialChanges
                    ? 'Save without restart'
                    : activeProfile
                      ? 'Confirm and activate'
                      : 'Confirm setup'
              : busy ? 'Saving this step' : 'Continue'}
          </button>
        </div>
      </fieldset>
    </div>
  );
}

function StepIntroduction({ step }: { step: SchoolOnboardingStep }) {
  const copy = [
    'Add the learner name and school details used in this journey.',
    'Choose the class journey you want to prepare for.',
    'Pick the language that makes explanations easiest to understand.',
    'Share what you want to improve and what often feels difficult.',
    'Check your choices before the starting-point check begins.',
  ] as const;
  return <>{copy[step]}</>;
}

function ChoiceGroup({ label, children, error }: {
  label: string;
  children: React.ReactNode;
  error: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-800">{label}</legend>
      <div className="mt-3">{children}</div>
      {error}
    </fieldset>
  );
}

function ChoiceButton({ selected, label, detail, onClick }: {
  selected: boolean;
  label: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`min-h-14 w-full rounded-xl border px-4 py-3 text-left transition-[background-color,border-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--school-accent)] focus-visible:ring-offset-2 ${
        selected
          ? 'border-[var(--school-accent)] bg-[var(--school-accent-soft)] text-[var(--school-accent-deep)] ring-1 ring-[var(--school-accent)]'
          : 'border-slate-300 bg-[var(--school-surface,#fcfdff)] text-slate-700 hover:border-[var(--school-accent-border)]'
      }`}
    >
      <span className="block text-sm font-semibold">{label}</span>
      {detail && <span className="mt-1 block text-sm leading-5 text-slate-600">{detail}</span>}
    </button>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-200 px-1 py-4 sm:odd:pr-5 sm:even:border-l sm:even:pl-5">
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-950">{value}</dd>
    </div>
  );
}
