import { Suspense } from 'react';
import { AppHeader } from '@/components/shared/AppHeader';
import { SchoolOnboardingWizard } from '@/components/school/onboarding/SchoolOnboardingWizard';
import { SchoolCoachPanel } from '@/components/school/SchoolCoachPanel';
import { getSchoolAvatarTheme } from '@/lib/schoolTheme';

export default function SchoolOnboardingPage() {
  const theme = getSchoolAvatarTheme(null, null);

  return (
    <div
      className="mode-school min-h-[100dvh] overflow-x-hidden bg-background font-body text-slate-950"
      style={theme.style}
    >
      <AppHeader title="School Setup" appearance="school" />
      <main className="mx-auto w-full max-w-[1320px] px-4 pb-10 pt-20 sm:px-7 lg:px-10">
        <div className="grid min-h-[calc(100dvh-7rem)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-7">
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--school-accent-border)] bg-[var(--school-accent-soft)] p-3 lg:hidden">
            <SchoolCoachPanel avatarId={null} paletteId={null} status="Setup" note="Let's begin." compact />
            <p className="text-sm font-medium leading-5 text-slate-700">
              Tell your coach what feels comfortable. You can return to saved steps.
            </p>
          </div>
          <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-200/80 bg-[var(--school-surface,#fcfdff)] px-4 py-5 shadow-[0_24px_60px_-46px_rgba(15,23,42,0.35)] sm:px-7 sm:py-7 lg:px-9 lg:py-8">
            <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" aria-label="Loading school setup" />}>
              <SchoolOnboardingWizard />
            </Suspense>
          </section>
          <aside className="hidden h-[min(70vh,560px)] lg:sticky lg:top-24 lg:block" aria-label="School learning coach">
            <SchoolCoachPanel
              avatarId={null}
              paletteId={null}
              status="Getting to know you"
              note="There is no perfect starting point. Tell me what feels comfortable, and I will build the path around you."
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
