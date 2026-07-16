import { Suspense } from 'react';
import { SchoolOnboardingWizard } from '@/components/school/onboarding/SchoolOnboardingWizard';
import { SchoolCoachPanel } from '@/components/school/SchoolCoachPanel';
import { SchoolPageHeading } from '@/components/school/SchoolPrimitives';
import { getSchoolAvatarTheme } from '@/lib/schoolTheme';

export default function SchoolOnboardingPage() {
  const theme = getSchoolAvatarTheme(null, null);

  return (
    <div
      className="mode-school min-h-[100dvh] overflow-x-hidden bg-background font-body text-slate-950"
      style={theme.style}
    >
      <main className="mx-auto w-full max-w-[1240px] px-4 pb-16 pt-10 sm:px-7 sm:pt-14 lg:px-10 lg:pb-24">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(500px,1.1fr)] lg:gap-[clamp(3.5rem,7vw,7rem)]">
          <section className="min-w-0 lg:sticky lg:top-32 lg:pt-5" aria-labelledby="school-setup-title">
            <SchoolPageHeading
              id="school-setup-title"
              eyebrow="School, shaped around you"
              title="Set up learning around school, language, and goals."
              description="Five short steps give the teacher enough context to begin well."
            />

            <div className="mt-9 hidden max-w-[400px] items-center gap-3 border-t border-[var(--school-line)] pt-5 lg:flex">
              <SchoolCoachPanel
                avatarId={null}
                paletteId={null}
                status="Setup"
                note="Teaching adjusts as the learner's evidence grows."
                compact
              />
              <p className="min-w-0 text-xs leading-5 text-[var(--school-muted)]">
                <strong className="block font-semibold text-slate-700">Your School coach</strong>
                <span className="mt-0.5 block">Teaching adjusts as the learner&apos;s evidence grows.</span>
              </p>
            </div>
          </section>

          <section className="min-w-0" aria-label="School setup form">
            <Suspense fallback={<div className="h-[34rem] animate-pulse rounded-[28px] border border-[var(--school-line)] bg-[var(--school-paper)] motion-reduce:animate-none" aria-label="Loading school setup" />}>
              <SchoolOnboardingWizard />
            </Suspense>
          </section>
        </div>
      </main>
    </div>
  );
}
