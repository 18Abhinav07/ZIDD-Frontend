import { CheckIcon } from '@radix-ui/react-icons';
import type { SchoolOnboardingStep } from '@/lib/schoolOnboardingPolicy';

export const SCHOOL_ONBOARDING_STEPS = [
  'Learner',
  'Class',
  'Language',
  'Goals',
  'Review',
] as const;

interface OnboardingStepRailProps {
  currentStep: SchoolOnboardingStep;
  persistedStep: SchoolOnboardingStep;
  disabled: boolean;
  onSelect: (step: SchoolOnboardingStep) => void;
}

export function OnboardingStepRail({
  currentStep,
  persistedStep,
  disabled,
  onSelect,
}: OnboardingStepRailProps) {
  return (
    <nav
      className="overflow-x-auto border-b border-slate-200 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      data-school-region="step-rail"
      aria-label="Setup steps"
    >
        <span className="sr-only" aria-live="polite">
          Step {currentStep + 1} of {SCHOOL_ONBOARDING_STEPS.length}: {SCHOOL_ONBOARDING_STEPS[currentStep]}
        </span>
        <ol className="flex min-w-max items-center gap-1 sm:min-w-0">
          {SCHOOL_ONBOARDING_STEPS.map((label, index) => {
            const step = index as SchoolOnboardingStep;
            const available = step <= persistedStep;
            const current = step === currentStep;
            return (
              <li key={label} className="flex min-w-0 items-center">
                <button
                  type="button"
                  onClick={() => onSelect(step)}
                  disabled={disabled || !available}
                  aria-disabled={!available || undefined}
                  aria-current={current ? 'step' : undefined}
                  className={`flex min-h-11 items-center gap-2 rounded-lg px-2.5 text-xs font-semibold transition-[background-color,color,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--school-accent)] focus-visible:ring-offset-2 sm:px-3 ${
                    current
                      ? 'bg-[var(--school-accent-soft)] text-[var(--school-accent-deep)]'
                      : available
                        ? 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        : 'cursor-default text-slate-300'
                  }`}
                >
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-current text-[11px]" aria-hidden="true">
                    {step < persistedStep ? <CheckIcon className="h-3.5 w-3.5" /> : index + 1}
                  </span>
                  <span>{label}</span>
                </button>
                {index < SCHOOL_ONBOARDING_STEPS.length - 1 ? (
                  <span aria-hidden="true" className="h-px w-3 flex-none bg-slate-200 sm:w-5" />
                ) : null}
              </li>
            );
          })}
        </ol>
    </nav>
  );
}
