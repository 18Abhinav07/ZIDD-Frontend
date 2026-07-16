"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReloadIcon } from '@radix-ui/react-icons';
import { SchoolMapSkeleton } from '@/components/learning/LearningSkeletons';
import { SchoolPageHeading, schoolPrimaryActionClass, schoolSecondaryActionClass } from '@/components/school/SchoolPrimitives';
import { resolveSchoolStateDestination } from '@/lib/schoolActivityPolicy';
import { learnerSafeErrorMessage } from '@/lib/errorCopy';
import { getSchoolState } from '@/services/schoolRebuild';

export default function SchoolCurriculumResolverPage() {
  const router = useRouter();
  const requestIdRef = useRef(0);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setError('');
    void getSchoolState({ force: true })
      .then((state) => {
        if (requestIdRef.current !== requestId) return;
        const destination = resolveSchoolStateDestination({
          nextAction: state.next_action,
          allowedNextActions: state.allowed_next_actions,
          nextActionUrl: state.next_action_url,
        });
        if (!destination || destination === '/school/curriculum') throw new Error('school_state_unresolved');
        router.replace(destination);
      })
      .catch((loadError: unknown) => {
        if (requestIdRef.current !== requestId) return;
        setError(learnerSafeErrorMessage(loadError, 'Could not open your School path. Please retry.'));
      });
    return () => {
      if (requestIdRef.current === requestId) requestIdRef.current += 1;
    };
  }, [retryKey, router]);

  if (!error) return <SchoolMapSkeleton />;

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-68px)] w-full max-w-[760px] items-center px-5 py-16 sm:px-8">
      <section className="w-full border-y border-red-200 py-8" role="alert" aria-live="polite">
        <SchoolPageHeading
          eyebrow="My path"
          title="We could not open the next learning step."
          description={error}
        />
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={() => setRetryKey((value) => value + 1)} className={schoolPrimaryActionClass}>
            <ReloadIcon className="h-4 w-4" aria-hidden="true" /> Retry
          </button>
          <button type="button" onClick={() => router.push('/school')} className={schoolSecondaryActionClass}>
            Back to School
          </button>
        </div>
      </section>
    </main>
  );
}
