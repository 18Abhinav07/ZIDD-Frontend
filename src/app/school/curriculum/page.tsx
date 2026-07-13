"use client";

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SchoolMapSkeleton } from '@/components/learning/LearningSkeletons';
import { resolveSchoolStateDestination } from '@/lib/schoolActivityPolicy';
import { getSchoolState } from '@/services/schoolRebuild';

export default function SchoolCurriculumResolverPage() {
  const router = useRouter();
  const resolvingRef = useRef(false);

  useEffect(() => {
    if (resolvingRef.current) return;
    resolvingRef.current = true;
    void getSchoolState({ force: true })
      .then((state) => {
        const destination = resolveSchoolStateDestination({
          nextAction: state.next_action,
          allowedNextActions: state.allowed_next_actions,
          nextActionUrl: state.next_action_url,
        });
        if (!destination) throw new Error('school_state_unresolved');
        router.replace(destination);
      })
      .catch(() => undefined)
      .finally(() => {
        resolvingRef.current = false;
      });
  }, [router]);

  return <SchoolMapSkeleton />;
}
