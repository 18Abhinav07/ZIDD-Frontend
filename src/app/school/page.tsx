"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExclamationTriangleIcon, ReloadIcon } from '@radix-ui/react-icons';
import { SchoolClassHomeSkeleton } from '@/components/learning/LearningSkeletons';
import { SchoolClassHome } from '@/components/school/catalog/SchoolClassHome';
import { SchoolPageHeading, schoolPrimaryActionClass } from '@/components/school/SchoolPrimitives';
import { learnerSafeErrorMessage } from '@/lib/errorCopy';
import { resolveSchoolStateDestination } from '@/lib/schoolActivityPolicy';
import {
  schoolHomeActionLabel,
  shouldRenderUnlockedSchoolHome,
} from '@/lib/schoolHomePolicy.mjs';
import {
  getSchoolClassMap,
  getSchoolStateResponse,
  type SchoolClassMap,
} from '@/services/schoolRebuild';

export default function SchoolPage() {
  const router = useRouter();
  const [schoolClass, setSchoolClass] = useState<SchoolClassMap | null>(null);
  const [learnerMessage, setLearnerMessage] = useState('Your coach is ready for the next chapter.');
  const [schoolUnavailable, setSchoolUnavailable] = useState(false);
  const [primaryAction, setPrimaryAction] = useState<{ label: string; href: string } | null>(null);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const resolveSchoolHome = useCallback(async () => {
    setError('');
    setSchoolClass(null);
    setPrimaryAction(null);
    setSchoolUnavailable(false);
    try {
      const state = await getSchoolStateResponse({ force: true });
      if (state.available === false) {
        setSchoolUnavailable(true);
        return;
      }
      const activeClassNo = state.active_learning_class_no ?? state.target_class_no;
      const destination = resolveSchoolStateDestination({
        nextAction: state.next_action,
        allowedNextActions: state.allowed_next_actions,
        nextActionUrl: state.next_action_url,
      });
      if (!destination) throw new Error('school_state_unresolved');
      if (!shouldRenderUnlockedSchoolHome(state)) {
        router.replace(destination);
        return;
      }
      if (activeClassNo === null || state.subject_id === null) throw new Error('school_state_unresolved');
      const result = await getSchoolClassMap(state.subject_id, activeClassNo);
      if (result.class_no !== activeClassNo || result.subject_id !== state.subject_id) {
        throw new Error('school_catalog_profile_mismatch');
      }
      setLearnerMessage(state.learner_message);
      setPrimaryAction(destination === '/school' ? null : {
        label: schoolHomeActionLabel(state.next_action),
        href: destination,
      });
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
      {schoolClass ? (
        <SchoolClassHome
          schoolClass={schoolClass}
          learnerMessage={learnerMessage}
          primaryAction={primaryAction ? {
            label: primaryAction.label,
            onSelect: () => router.push(primaryAction.href),
          } : undefined}
          onViewMap={() => router.push(`/school/classes/${schoolClass.class_no}`)}
          onChangeSetup={() => router.push('/school/onboarding?intent=edit_profile&step=2')}
        />
      ) : schoolUnavailable ? (
        <main className="mx-auto flex min-h-[100dvh] w-full max-w-[760px] items-center px-5 py-28 sm:px-8">
          <section className="w-full border-y border-slate-200 py-8">
            <SchoolPageHeading
              eyebrow="School Prep"
              title="School learning is not available in this release"
              description="Your Career Prep progress is unchanged. School Prep will appear here after its complete curriculum has passed release review."
              size="section"
            />
            <button type="button" onClick={() => router.push('/career?view=career')} className={`${schoolPrimaryActionClass} mt-6`}>
              Return to Career Prep
            </button>
          </section>
        </main>
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
