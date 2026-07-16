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
      className="border-b border-[var(--school-line)] bg-[var(--school-surface-soft)] px-5 pb-3 pt-4 sm:px-7 sm:pt-5"
      data-school-region="step-rail"
      aria-label="Setup steps"
    >
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-[10px] font-semibold uppercase text-[var(--school-muted)]" aria-live="polite">
            Step {String(currentStep + 1).padStart(2, '0')} of {String(SCHOOL_ONBOARDING_STEPS.length).padStart(2, '0')}
          </p>
          <p className="text-xs font-semibold text-slate-600">{SCHOOL_ONBOARDING_STEPS[currentStep]}</p>
        </div>
        <ol className="mt-2 grid grid-cols-5 gap-1.5">
          {SCHOOL_ONBOARDING_STEPS.map((label, index) => {
            const step = index as SchoolOnboardingStep;
            const available = step <= persistedStep;
            const current = step === currentStep;
            return (
              <li key={label} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onSelect(step)}
                  disabled={disabled || !available}
                  aria-disabled={!available || undefined}
                  aria-current={current ? 'step' : undefined}
                  aria-label={`Go to ${label} setup step`}
                  className="group flex min-h-11 w-full items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--school-accent)] focus-visible:ring-offset-2 disabled:cursor-default"
                >
                  <span
                    className={`flex h-1 w-full items-center justify-center rounded-full transition-colors ${
                      current || step < persistedStep
                        ? 'bg-[var(--school-accent)]'
                        : available
                          ? 'bg-[var(--school-accent-border)] group-hover:bg-[var(--school-accent)]'
                          : 'bg-slate-200'
                    }`}
                    aria-hidden="true"
                  >
                    {step < persistedStep ? <CheckIcon className="sr-only" /> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
    </nav>
  );
}
