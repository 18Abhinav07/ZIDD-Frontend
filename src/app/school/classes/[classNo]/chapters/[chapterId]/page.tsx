"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ExclamationTriangleIcon, ReloadIcon } from '@radix-ui/react-icons';
import { SchoolLevelMapSkeleton } from '@/components/learning/LearningSkeletons';
import { SchoolLevelMap } from '@/components/school/catalog/SchoolLevelMap';
import { SchoolPageHeading, schoolPrimaryActionClass } from '@/components/school/SchoolPrimitives';
import { learnerSafeErrorMessage } from '@/lib/errorCopy';
import { resolveSchoolStateDestination } from '@/lib/schoolActivityPolicy';
import {
  createSchoolRouteLoadSingleFlight,
  schoolRouteLoadDisposition,
  schoolRouteLoadKey,
  type SchoolRouteLoadOwner,
} from '@/lib/schoolRouteLoadPolicy';
import {
  getSchoolChapterMap,
  getSchoolLoadScope,
  getSchoolState,
  startSchoolCurriculum,
  type SchoolChapterMap as SchoolChapterMapData,
  type SchoolNextAction,
} from '@/services/schoolRebuild';

interface SchoolChapterSnapshot {
  chapter: SchoolChapterMapData;
  stateAction: { action: SchoolNextAction; href: string };
}

type SchoolChapterLoadResult =
  | { kind: 'redirect'; href: string }
  | { kind: 'ready'; snapshot: SchoolChapterSnapshot };

const chapterMapLoadSingleFlight = createSchoolRouteLoadSingleFlight<SchoolChapterLoadResult>();

async function loadSchoolChapter(classNo: number, chapterId: string): Promise<SchoolChapterLoadResult> {
  const state = await getSchoolState({ force: true });
  const destination = resolveSchoolStateDestination({
    nextAction: state.next_action,
    allowedNextActions: state.allowed_next_actions,
    nextActionUrl: state.next_action_url,
  });
  if (!destination || !state.next_action) throw new Error('school_state_unresolved');
  if (destination !== `/school/classes/${classNo}/chapters/${chapterId}`) {
    return { kind: 'redirect', href: destination };
  }
  const activeClassNo = state.active_learning_class_no ?? state.target_class_no;
  if (state.profile_status !== 'complete' || activeClassNo !== classNo || state.target_class_no !== classNo || !state.subject_id) {
    throw new Error('school_catalog_profile_mismatch');
  }
  const result = await getSchoolChapterMap(state.subject_id, classNo, chapterId);
  if (result.class_no !== classNo || result.chapter_id !== chapterId || result.subject_id !== state.subject_id) {
    throw new Error('school_catalog_profile_mismatch');
  }
  return {
    kind: 'ready',
    snapshot: {
      chapter: result,
      stateAction: { action: state.next_action, href: destination },
    },
  };
}

export default function SchoolChapterPage() {
  const params = useParams<{ classNo: string; chapterId: string }>();
  const router = useRouter();
  const classNo = Number(params.classNo);
  const chapterId = params.chapterId;
  const clientStartIdRef = useRef<string | null>(null);
  if (!clientStartIdRef.current) clientStartIdRef.current = crypto.randomUUID();
  const [snapshot, setSnapshot] = useState<SchoolChapterSnapshot | null>(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const mountedRef = useRef(false);
  const loadRequestIdRef = useRef(0);
  const loadOwnerRef = useRef<SchoolRouteLoadOwner | null>(null);

  const load = useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    let requestOwner: SchoolRouteLoadOwner | null = null;
    const requestDisposition = async () => {
      if (!requestOwner) return mountedRef.current && loadRequestIdRef.current === requestId ? 'commit' : 'ignore';
      try {
        const currentScope = await getSchoolLoadScope();
        return schoolRouteLoadDisposition(
          loadOwnerRef.current,
          requestOwner,
          mountedRef.current,
          currentScope,
        );
      } catch {
        return 'ignore';
      }
    };
    setError('');
    setSnapshot(null);
    try {
      const scope = await getSchoolLoadScope();
      if (!mountedRef.current || loadRequestIdRef.current !== requestId) return;
      requestOwner = { requestId, scopeKey: scope.key };
      loadOwnerRef.current = requestOwner;
      const result = await chapterMapLoadSingleFlight.run(
        () => loadSchoolChapter(classNo, chapterId),
        schoolRouteLoadKey(scope, `chapter-map:${classNo}:${chapterId}`),
      );
      const disposition = await requestDisposition();
      if (disposition !== 'commit') {
        if (disposition === 'retry') queueMicrotask(() => void load());
        return;
      }
      if (result.kind === 'redirect') {
        router.replace(result.href);
        return;
      }
      setSnapshot(result.snapshot);
    } catch (err: unknown) {
      const disposition = await requestDisposition();
      if (disposition !== 'commit') {
        if (disposition === 'retry') queueMicrotask(() => void load());
        return;
      }
      const code = err instanceof Error ? err.message : '';
      setError(code === 'school_catalog_profile_mismatch'
        ? 'This chapter is not part of your active School setup.'
        : learnerSafeErrorMessage(err, 'Could not load this chapter. Please retry.'));
    }
  }, [chapterId, classNo, router]);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
      loadRequestIdRef.current += 1;
      loadOwnerRef.current = null;
    };
  }, [load]);

  const continueChapter = async () => {
    if (!snapshot || snapshot.stateAction.action !== 'start_curriculum' || starting) return;
    setStarting(true);
    setError('');
    try {
      await startSchoolCurriculum(snapshot.chapter.chapter_id, clientStartIdRef.current!);
      const state = await getSchoolState({ force: true });
      const destination = resolveSchoolStateDestination({
        nextAction: state.next_action,
        allowedNextActions: state.allowed_next_actions,
        nextActionUrl: state.next_action_url,
      });
      if (!destination) throw new Error('school_state_unresolved');
      router.replace(destination);
    } catch (err: unknown) {
      setError(learnerSafeErrorMessage(err, 'Could not start this chapter. Please retry.'));
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="mode-school min-h-[100dvh] bg-background font-body text-slate-950">
      {snapshot ? (
        <>
          {error ? (
            <div role="alert" className="fixed inset-x-5 top-20 z-40 mx-auto max-w-xl rounded-lg border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-800 shadow-sm">
              {error}
            </div>
          ) : null}
          <SchoolLevelMap
            chapter={snapshot.chapter}
            busy={starting}
            onBack={() => router.push(`/school/classes/${classNo}`)}
            authorizedAction={snapshot.stateAction.action === 'start_curriculum'
              ? { label: 'Start chapter', onSelect: () => void continueChapter() }
              : undefined}
          />
        </>
      ) : error ? (
        <main className="mx-auto flex min-h-[100dvh] max-w-2xl items-center px-5 py-28 sm:px-8">
          <section role="alert" className="w-full rounded-lg border border-red-200 bg-white p-6">
            <div className="flex gap-4">
              <ExclamationTriangleIcon className="mt-1 h-5 w-5 flex-none text-red-700" aria-hidden="true" />
              <div className="min-w-0">
                <SchoolPageHeading
                  eyebrow="Chapter journey"
                  title="Chapter unavailable"
                  description={error}
                  size="section"
                />
                <button type="button" onClick={() => void load()} className={`${schoolPrimaryActionClass} mt-6`}>
                  <ReloadIcon className="h-4 w-4" aria-hidden="true" />
                  Retry
                </button>
              </div>
            </div>
          </section>
        </main>
      ) : <SchoolLevelMapSkeleton />}
    </div>
  );
}
