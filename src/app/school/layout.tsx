"use client";

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ReloadIcon } from '@radix-ui/react-icons';
import { SchoolClassHomeSkeleton } from '@/components/learning/LearningSkeletons';
import { SchoolPageHeading, schoolPrimaryActionClass } from '@/components/school/SchoolPrimitives';
import { SchoolShell } from '@/components/school/shell/SchoolShell';
import { learnerSafeErrorMessage } from '@/lib/errorCopy';
import { getSchoolStateResponse, type SchoolState } from '@/services/schoolRebuild';

type SchoolGateState =
  | { status: 'loading' }
  | { status: 'ready'; state: SchoolState }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

export default function SchoolLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [gate, setGate] = useState<SchoolGateState>({ status: 'loading' });
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setGate({ status: 'loading' });

    void getSchoolStateResponse({ force: true })
      .then((state) => {
        if (cancelled) return;
        setGate(state.available === false ? { status: 'unavailable' } : { status: 'ready', state });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setGate({
          status: 'error',
          message: learnerSafeErrorMessage(
            error,
            'Could not confirm School availability. Please retry.',
          ),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [retryKey]);

  return (
    <SchoolShell
      coach_avatar_id={gate.status === 'ready' ? gate.state.coach_avatar_id : null}
      coach_palette_id={gate.status === 'ready' ? gate.state.coach_palette_id : null}
    >
      {gate.status === 'ready' ? children : null}
      {gate.status === 'loading' ? (
        <SchoolClassHomeSkeleton />
      ) : gate.status !== 'ready' ? (
        <main className="mx-auto flex min-h-[100dvh] w-full max-w-[760px] items-center px-5 py-28 sm:px-8">
          <section className="w-full border-y border-slate-200 py-8">
            <SchoolPageHeading
              eyebrow="School Prep"
              title={gate.status === 'unavailable'
                ? 'School learning is not available in this release'
                : 'School availability could not be confirmed'}
              description={gate.status === 'unavailable'
                ? 'Your Career Prep progress is unchanged. School Prep will appear here after its complete curriculum has passed release review.'
                : gate.message}
              size="section"
            />
            {gate.status === 'unavailable' ? (
              <button
                type="button"
                onClick={() => router.push('/career?view=career')}
                className={`${schoolPrimaryActionClass} mt-6`}
              >
                Return to Career Prep
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setRetryKey((current) => current + 1)}
                className={`${schoolPrimaryActionClass} mt-6`}
              >
                <ReloadIcon className="h-4 w-4" aria-hidden="true" />
                Retry
              </button>
            )}
          </section>
        </main>
      ) : null}
    </SchoolShell>
  );
}
