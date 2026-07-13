function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse bg-slate-200/75 motion-reduce:animate-none ${className}`} />;
}

function SchoolHeadingSkeleton() {
  return (
    <div className="max-w-2xl">
      <SkeletonBlock className="h-3 w-28 rounded-full" />
      <SkeletonBlock className="mt-5 h-12 w-80 max-w-full rounded-2xl" />
      <SkeletonBlock className="mt-4 h-4 w-full rounded-full" />
      <SkeletonBlock className="mt-2 h-4 w-3/4 rounded-full" />
    </div>
  );
}

export function SchoolEntrySkeleton() {
  return <SchoolClassHomeSkeleton />;
}

export function SchoolClassHomeSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label="Opening your class"
      className="mode-school mx-auto min-h-[100dvh] w-full max-w-[1180px] bg-background px-5 pb-20 pt-28 sm:px-8 lg:px-12"
    >
      <SchoolHeadingSkeleton />
      <section className="mt-10 grid min-h-[340px] overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[var(--school-surface)] md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex flex-col justify-center p-6 sm:p-10">
          <SkeletonBlock className="h-7 w-32 rounded-full" />
          <SkeletonBlock className="mt-6 h-10 w-56 rounded-xl" />
          <SkeletonBlock className="mt-5 h-4 w-full rounded-full" />
          <SkeletonBlock className="mt-3 h-4 w-4/5 rounded-full" />
          <SkeletonBlock className="mt-7 h-11 w-40 rounded-2xl" />
        </div>
        <SkeletonBlock className="hidden h-full min-h-[340px] rounded-none bg-slate-200/60 md:block" />
      </section>
      <div className="mt-8 divide-y divide-slate-200/80 border-y border-slate-200/80 sm:flex sm:divide-x sm:divide-y-0">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex-1 py-5 sm:px-6 sm:first:pl-0">
            <SkeletonBlock className="h-7 w-16 rounded-lg" />
            <SkeletonBlock className="mt-3 h-3 w-36 max-w-full rounded-full" />
          </div>
        ))}
      </div>
    </main>
  );
}

export function SchoolMapSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <main
      aria-busy="true"
      aria-label="Loading your learning map"
      className="mode-school mx-auto min-h-[100dvh] w-full max-w-[1040px] bg-background px-5 pb-24 pt-28 sm:px-8 lg:px-12"
    >
      <SchoolHeadingSkeleton />
      {compact ? (
        <div className="mt-10 max-w-3xl border-y border-slate-200/80">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex gap-4 border-b border-slate-200/80 py-5 last:border-b-0">
              <SkeletonBlock className="h-10 w-10 flex-none rounded-full" />
              <div className="min-w-0 flex-1 pt-1">
                <SkeletonBlock className="h-4 w-48 max-w-full rounded-full" />
                <SkeletonBlock className="mt-3 h-3 w-3/4 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-10 divide-y divide-slate-200/80 border-y border-slate-200/80">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex items-center gap-4 py-5">
              <SkeletonBlock className="h-9 w-9 flex-none rounded-lg" />
              <div className="min-w-0 flex-1">
                <SkeletonBlock className="h-4 w-56 max-w-full rounded-full" />
                <SkeletonBlock className="mt-3 h-3 w-2/3 rounded-full" />
              </div>
              <SkeletonBlock className="hidden h-7 w-20 rounded-full sm:block" />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

export function SchoolLevelMapSkeleton() {
  return <SchoolMapSkeleton compact />;
}

export function SchoolTutorSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label="Opening your lesson"
      className="mode-school mx-auto grid min-h-[100dvh] w-full max-w-[1540px] grid-cols-1 gap-4 bg-background px-3 pb-4 pt-20 sm:px-5 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-5 lg:px-6 xl:grid-cols-[380px_minmax(0,1fr)_280px] xl:gap-6"
    >
      <SkeletonBlock className="hidden h-[calc(100dvh-6rem)] rounded-[2.5rem] border border-slate-200/80 bg-[var(--school-accent-soft)] lg:block" />
      <section className="min-h-[calc(100dvh-5.75rem)] overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-[var(--school-surface)] sm:rounded-[2rem] xl:rounded-[2.5rem]">
        <div className="flex min-h-[4.5rem] items-center gap-3 border-b border-slate-200/80 px-4 sm:px-6">
          <SkeletonBlock className="h-11 w-11 rounded-full" />
          <div className="flex-1">
            <SkeletonBlock className="h-3 w-24 rounded-full" />
            <SkeletonBlock className="mt-2 h-6 w-48 max-w-full rounded-lg" />
          </div>
          <SkeletonBlock className="h-12 w-12 rounded-2xl lg:hidden" />
        </div>
        <div className="space-y-5 p-5 sm:p-8">
          <SkeletonBlock className="h-4 w-32 rounded-full" />
          <SkeletonBlock className="h-9 w-4/5 rounded-xl" />
          <SkeletonBlock className="h-24 w-full rounded-2xl" />
          <SkeletonBlock className="h-12 w-40 rounded-2xl" />
        </div>
      </section>
      <div className="hidden space-y-5 xl:block">
        <SkeletonBlock className="h-44 rounded-3xl border border-slate-200/80 bg-[var(--school-surface)]" />
        <SkeletonBlock className="h-72 rounded-3xl border border-slate-200/80 bg-[var(--school-surface)]" />
      </div>
    </main>
  );
}

export function SchoolReportSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading your learning report"
      className="mode-school mx-auto min-h-[100dvh] w-full max-w-[1040px] bg-background px-5 pb-24 pt-28 sm:px-8"
    >
      <SchoolHeadingSkeleton />
      <section className="mt-10 border-y border-slate-200/80 py-8 sm:flex sm:items-start sm:justify-between sm:gap-10">
        <div className="flex-1">
          <SkeletonBlock className="h-3 w-28 rounded-full" />
          <SkeletonBlock className="mt-4 h-8 w-72 max-w-full rounded-xl" />
          <SkeletonBlock className="mt-4 h-4 w-full rounded-full" />
          <SkeletonBlock className="mt-2 h-4 w-4/5 rounded-full" />
        </div>
        <SkeletonBlock className="mt-6 h-11 w-40 rounded-2xl sm:mt-0" />
      </section>
      <div className="divide-y divide-slate-200/80">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="py-7">
            <SkeletonBlock className="h-3 w-36 rounded-full" />
            <SkeletonBlock className="mt-4 h-6 w-64 max-w-full rounded-lg" />
            <SkeletonBlock className="mt-3 h-4 w-3/4 rounded-full" />
          </div>
        ))}
      </div>
    </main>
  );
}
