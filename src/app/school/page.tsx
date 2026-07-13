"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExclamationTriangleIcon, ReloadIcon } from '@radix-ui/react-icons';
import { SchoolClassHomeSkeleton } from '@/components/learning/LearningSkeletons';
import { SchoolClassHome } from '@/components/school/catalog/SchoolClassHome';
import { SchoolPageHeading, schoolPrimaryActionClass } from '@/components/school/SchoolPrimitives';
import { AppHeader } from '@/components/shared/AppHeader';
import { learnerSafeErrorMessage } from '@/lib/errorCopy';
import { resolveSchoolStateDestination } from '@/lib/schoolActivityPolicy';
import {
  getSchoolClassMap,
  getSchoolState,
  type SchoolClassMap,
} from '@/services/schoolRebuild';

export default function SchoolPage() {
  const router = useRouter();
  const [schoolClass, setSchoolClass] = useState<SchoolClassMap | null>(null);
  const [learnerMessage, setLearnerMessage] = useState('Your coach is ready for the next chapter.');
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const resolveSchoolHome = useCallback(async () => {
    setError('');
    setSchoolClass(null);
    try {
      const state = await getSchoolState({ force: true });
      const activeClassNo = state.active_learning_class_no ?? state.target_class_no;
      const destination = resolveSchoolStateDestination({
        nextAction: state.next_action,
        allowedNextActions: state.allowed_next_actions,
        nextActionUrl: state.next_action_url,
      });
      if (!destination) throw new Error('school_state_unresolved');
      if (destination !== '/school') {
        router.replace(destination);
        return;
      }
      if (activeClassNo === null || state.subject_id === null) throw new Error('school_state_unresolved');
      const result = await getSchoolClassMap(state.subject_id, activeClassNo);
      if (result.class_no !== activeClassNo || result.subject_id !== state.subject_id) {
        throw new Error('school_catalog_profile_mismatch');
      }
      setLearnerMessage(state.learner_message);
      setSchoolClass(result);
    } catch (err: unknown) {
      setError(learnerSafeErrorMessage(err, 'Could not open your school journey. Please retry.'));
    }
  }, [router]);

  useEffect(() => {
    void resolveSchoolHome();
  }, [resolveSchoolHome, retryKey]);

  return (
    <div className="mode-school min-h-[100dvh] bg-background font-body text-slate-950">
      <AppHeader title="School Prep" appearance="school" />
      {schoolClass ? (
        <SchoolClassHome
          schoolClass={schoolClass}
          learnerMessage={learnerMessage}
          primaryAction={undefined}
          onViewMap={() => router.push(`/school/classes/${schoolClass.class_no}`)}
          onChangeSetup={() => router.push('/school/onboarding?step=2')}
        />
      ) : error ? (
        <main className="mx-auto flex min-h-[100dvh] w-full max-w-[760px] items-center px-5 py-28 sm:px-8">
          <section className="w-full rounded-lg border border-red-200 bg-white px-6 py-7" role="alert">
            <div className="flex items-start gap-4 text-red-800">
              <ExclamationTriangleIcon className="mt-1 h-5 w-5 flex-none" aria-hidden="true" />
              <div className="min-w-0">
                <SchoolPageHeading
                  eyebrow="School journey"
                  title="We could not open your learning path"
                  description={error}
                  size="section"
                />
                <button type="button" onClick={() => setRetryKey((current) => current + 1)} className={`${schoolPrimaryActionClass} mt-6`}>
                  <ReloadIcon className="h-4 w-4" aria-hidden="true" />
                  Retry
                </button>
              </div>
            </div>
          </section>
        </main>
      ) : <SchoolClassHomeSkeleton />}
    </div>
  );
}
