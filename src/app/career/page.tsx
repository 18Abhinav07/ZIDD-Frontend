"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRightIcon } from '@radix-ui/react-icons';
import { Loader2 } from 'lucide-react';
import { AppHeader } from '@/components/shared/AppHeader';
import { CareerHomeSkeleton } from '@/components/shared/RouteSkeletons';
import { useAppSession } from '@/components/shared/AppSessionProvider';
import {
  getMeLearningGraph,
  myPathForMe,
  updatePreferences,
  type CareerMemoryItem,
  type MeActivity,
  type MeLearningGraph,
  type MeResponse,
  type ModuleId,
} from '@/services/me';
import Image from 'next/image';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getRandomAvatar, COACH_AVATARS, type AvatarData } from '@/lib/avatars';
import { getAvatarScaleClass } from '@/lib/avatarRegistry';
import { careerCompetenceLabel, careerPracticeHref } from '@/lib/careerPathPresentation.mjs';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatSkillLabel(value?: string): string {
  const text = (value || '').trim();
  if (!text) return 'Career skill';
  return text
    .replace(/^(gd|int)_\d+_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function learnerFacingDetail(value?: string): string {
  const text = (value || '').trim();
  if (!text || /^(?:gd|int)_\d+_[a-z0-9_]+$/i.test(text)) {
    return 'Keep building this skill in a fresh scenario.';
  }
  return text;
}

function careerModuleFromMemory(item: CareerMemoryItem): ModuleId | null {
  if (
    item.module_id === 'interview'
    || item.task_type?.startsWith('interview')
    || item.skill_id.startsWith('int_')
  ) {
    return 'interview';
  }
  if (
    item.module_id === 'group_discussion'
    || item.task_type?.startsWith('gd')
    || item.skill_id.startsWith('gd_')
  ) {
    return 'group_discussion';
  }
  return null;
}

const PATHS: { id: ModuleId; label: string; blurb: string }[] = [
  { id: 'interview', label: 'Interview', blurb: 'Pitch, handle pressure, negotiate, and close strong.' },
  { id: 'group_discussion', label: 'Group Discussion', blurb: 'Stake a position, build on others, drive consensus.' },
];

export default function CareerPage() {
  const router = useRouter();
  const { me: cachedMe, loadMe, loadActivity, loadingActivity } = useAppSession();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [activity, setActivity] = useState<MeActivity | null>(null);
  const [careerLearningGraph, setCareerLearningGraph] = useState<MeLearningGraph | null>(null);
  const [activityError, setActivityError] = useState('');
  const [careerLearningGraphError, setCareerLearningGraphError] = useState('');
  const [moduleAvatars, setModuleAvatars] = useState<Record<string, AvatarData>>({});
  const [openingModule, setOpeningModule] = useState<ModuleId | null>(null);
  const [actionError, setActionError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  // Gate client-only content (token/host-dependent) until after mount so the
  // first client render matches the server HTML (avoids a hydration mismatch).
  const [mounted, setMounted] = useState(false);

  const refreshActivity = useCallback((force = false) => {
    setActivityError('');
    loadActivity(force)
      .then((nextActivity) => {
        setActivity(nextActivity);
      })
      .catch(() => {
        setActivity(null);
        setActivityError('Activity summary is temporarily unavailable. Your career paths still work.');
      });
  }, [loadActivity]);

  useEffect(() => {
    setMounted(true);

    let cancelled = false;
    const loadDashboard = async () => {
      try {
        setLoadError('');
        setActivityError('');
        const profile = cachedMe ?? await loadMe();
        if (cancelled) return;
        if (!profile.onboarding?.completed) {
          router.replace('/onboarding');
          return;
        }
        if (profile.onboarding.primary_motive === 'school') {
          router.replace('/subjects');
          return;
        }
        setMe(profile);
        loadActivity()
          .then((nextActivity) => {
            if (!cancelled) setActivity(nextActivity);
          })
          .catch(() => {
            if (!cancelled) {
              setActivity(null);
              setActivityError('Activity summary is temporarily unavailable. Your career paths still work.');
            }
          });
        getMeLearningGraph()
          .then((nextGraph) => {
            if (!cancelled) {
              setCareerLearningGraph(nextGraph);
              if (nextGraph.degraded) {
                setCareerLearningGraphError('Career growth evidence is partially unavailable. Your paths still work.');
              }
            }
          })
          .catch(() => {
            if (!cancelled) {
              setCareerLearningGraph(null);
              setCareerLearningGraphError('Career growth evidence is temporarily unavailable. Your paths still work.');
            }
          });
      } catch (err: unknown) {
        if (!cancelled) {
          const raw = err instanceof Error ? err.message : '';
          if (raw === 'Unauthorized') {
            router.replace('/auth/login');
          } else {
            setLoadError(
              raw === 'request_timeout'
                ? 'Career home took too long to load. Retry when the server is ready.'
                : 'Could not load career home. Please retry.'
            );
          }
        }
      }
    };
    loadDashboard();

    const used = new Set<string>();
    const map: Record<string, AvatarData> = {};
    PATHS.forEach((p) => {
      let a = getRandomAvatar();
      while (used.has(a.id) && used.size < COACH_AVATARS.length) { a = getRandomAvatar(); }
      used.add(a.id);
      map[p.id] = a;
    });
    setModuleAvatars(map);

    return () => {
      cancelled = true;
    };
  }, [cachedMe, loadActivity, loadMe, router, retryKey]);

  const activeModule = me?.preferences.active_module ?? null;

  const openPath = async (moduleId: ModuleId) => {
    if (openingModule) return;
    setActionError('');
    setOpeningModule(moduleId);
    try {
      const res = await updatePreferences({ pending_module: moduleId, active_module: null, test_mode: null });
      setMe((m) => (m ? { ...m, preferences: res.preferences } : m));
      void loadMe(true).catch(() => null);
      router.push('/mode');
    } catch {
      setActionError('Could not save your selected path. Please try again.');
      setOpeningModule(null);
    }
  };

  const careerMemory = careerLearningGraph?.memory_context;
  const careerFocus = careerMemory?.active_gaps?.[0] ?? careerMemory?.improving_gaps?.[0] ?? null;
  const careerWin = careerMemory?.mastered_skills?.[0] ?? careerMemory?.resolved_gaps?.[0] ?? null;
  const focusModule = careerFocus ? careerModuleFromMemory(careerFocus) : null;
  const winModule = careerWin ? careerModuleFromMemory(careerWin) : null;
  const latest_evidence = careerFocus?.latest_evidence?.trim();
  const repeat_count = Number(careerFocus?.repeat_count || 0);
  const focusCompetenceStatus = careerFocus?.current_competence_status || careerFocus?.status || '';
  const focusStatus = careerCompetenceLabel(focusCompetenceStatus);
  const focusActionLabel = ['active_gap', 'needs_review'].includes(focusCompetenceStatus)
    ? 'Practice focus'
    : focusCompetenceStatus === 'improving'
      ? 'Strengthen this'
      : 'Revisit skill';
  const focusReadiness = careerFocus ? percent(careerFocus.readiness || 0) : '';

  const onPracticeCareerItem = async (item: CareerMemoryItem | null) => {
    if (!item) return;
    const moduleId = careerModuleFromMemory(item);
    if (!moduleId) return;
    if (openingModule) return;
    setActionError('');
    setOpeningModule(moduleId);
    try {
      const res = await updatePreferences({ active_module: moduleId, pending_module: null, test_mode: false });
      setMe((m) => (m ? { ...m, preferences: res.preferences } : m));
      void loadMe(true).catch(() => null);
      router.push(careerPracticeHref(item));
    } catch {
      setActionError('Could not open this practice skill. Please try again.');
      setOpeningModule(null);
    }
  };

  const onPracticeCareerFocus = () => onPracticeCareerItem(careerFocus);

  const pathHref = myPathForMe(me);

  const activeLabel = PATHS.find((p) => p.id === activeModule)?.label;
  const primaryRole = me?.career_profile?.target_roles?.[0];
  const interviewGoalCount = me?.career_profile?.interview_goals?.length ?? 0;
  const primaryRecommendation = careerFocus ? null : activity?.recommendations[0] ?? null;
  const recommendationTitle = primaryRecommendation?.title
    ?? (careerFocus ? `Practice ${formatSkillLabel(careerFocus.skill_id)}` : `Continue ${activeLabel ?? 'career'} practice`);
  const onOpenRecommendation = () => {
    if (primaryRecommendation) {
      router.push(primaryRecommendation.href);
      return;
    }
    if (focusModule) {
      void onPracticeCareerFocus();
      return;
    }
    router.push(pathHref);
  };
  // Greet by the name the coach uses (from the profile), falling back to the id.
  const displayName = me?.name?.trim() || me?.user_id || 'there';

  return (
    <div className="min-h-[100dvh] bg-[#FCFCFC] text-slate-900 font-body relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-indigo-500/[0.04] rounded-full blur-[120px] pointer-events-none" />
      <AppHeader />

      {loadError ? (
        <main className="relative z-10 max-w-[720px] mx-auto px-6 lg:px-12 pt-32 pb-24">
          <div className="rounded-[2rem] border border-rose-200 bg-rose-50 px-7 py-6">
            <p className="text-sm font-bold text-rose-700">{loadError}</p>
            <button
              onClick={() => setRetryKey((value) => value + 1)}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-rose-600 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-rose-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </main>
      ) : !me ? (
        <CareerHomeSkeleton />
      ) : (
      <main className="relative z-10 max-w-[1100px] mx-auto px-6 lg:px-12 pt-28 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-indigo-500">Career</span>
          <h1 className="mt-3 font-display text-5xl md:text-6xl tracking-tight leading-[1]">
            Welcome back, {displayName}.
          </h1>
          <p className="mt-4 text-slate-500 text-[15px] max-w-xl">
            Choose a career practice environment. Your resume details, goals, and topics live in Profile.
          </p>
        </motion.div>

        {activity && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-[1.25rem] border border-slate-200/70 bg-white px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Profile</p>
              <p className="mt-2 text-sm font-bold text-slate-800">
                {activity.career.profile_complete ? 'Personalized' : 'Needs details'}
              </p>
              {activity.career.profile_complete && (
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {primaryRole ? `For ${primaryRole}` : `${interviewGoalCount} interview goal${interviewGoalCount === 1 ? '' : 's'} active`}
                </p>
              )}
            </div>
            <div className="rounded-[1.25rem] border border-slate-200/70 bg-white px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Practice</p>
              <p className="mt-2 text-sm font-bold text-slate-800">{activity.career.attempts} practice starts tracked</p>
            </div>
            <button
              onClick={onOpenRecommendation}
              className="rounded-[1.25rem] border border-indigo-100 bg-indigo-50 px-5 py-4 text-left hover:bg-indigo-100 transition-colors"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500">Recommended</p>
              <p className="mt-2 text-sm font-bold text-indigo-900">
                {recommendationTitle}
              </p>
            </button>
          </div>
        )}

        {activityError && (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-semibold">{activityError}</p>
              <button
                type="button"
                onClick={() => refreshActivity(true)}
                disabled={loadingActivity}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60"
              >
                {loadingActivity && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Retry
              </button>
            </div>
          </div>
        )}

        {(careerFocus || careerWin || careerLearningGraphError) && (
          <div className="mt-8 rounded-[1.5rem] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            {(careerFocus || careerLearningGraphError) && (
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="max-w-2xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Career focus</p>
                  {careerFocus ? (
                  <>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-2xl tracking-tight text-slate-950">{formatSkillLabel(careerFocus.skill_id)}</h2>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">
                        {focusStatus}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {learnerFacingDetail(careerFocus.gap || careerFocus.recommended_next_action)}
                    </p>
                    {latest_evidence && (
                      <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600 break-words">
                        Evidence: {latest_evidence}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.13em] text-slate-400">
                      <span>Status: {focusStatus}</span>
                      <span>Readiness: {focusReadiness}</span>
                      <span>{careerFocus.attempts || 0} attempt{careerFocus.attempts === 1 ? '' : 's'}</span>
                      {repeat_count > 0 && (
                        <span>{repeat_count} repeated issue{repeat_count === 1 ? '' : 's'}</span>
                      )}
                    </div>
                  </>
                  ) : (
                    <p className="mt-2 text-sm font-semibold text-amber-800">{careerLearningGraphError}</p>
                  )}
                </div>
                {focusModule && (
                  <button
                    type="button"
                    onClick={onPracticeCareerFocus}
                    disabled={openingModule !== null}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-white transition-colors hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
                  >
                    {openingModule === focusModule && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {focusActionLabel}
                  </button>
                )}
              </div>
            )}
            {careerWin && (
              <div className={`${careerFocus || careerLearningGraphError ? 'mt-5 border-t border-slate-100 pt-5' : ''} flex flex-col gap-3 md:flex-row md:items-center md:justify-between`}>
                <div className="max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">Proven skill</p>
                    <span className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-400">
                      {careerCompetenceLabel(careerWin.current_competence_status || careerWin.status)}
                    </span>
                  </div>
                  <h3 className="mt-1 text-base font-black text-slate-950">{formatSkillLabel(careerWin.skill_id)}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    {careerWin.latest_evidence?.trim() || learnerFacingDetail(careerWin.recommended_next_action)}
                  </p>
                </div>
                {winModule && (
                  <button
                    type="button"
                    onClick={() => void onPracticeCareerItem(careerWin)}
                    disabled={openingModule !== null}
                    className="inline-flex shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                  >
                    {openingModule === winModule ? 'Opening...' : 'Revisit skill'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {actionError && (
          <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {actionError}
          </div>
        )}

        {/* Continue CTA — only shown after mount because auth-backed data is client-only */}
        {mounted && activeModule && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="mt-10"
          >
            <button
              onClick={() => router.push(pathHref)}
              className="group w-full sm:w-auto inline-flex items-center gap-3 bg-slate-900 text-white rounded-2xl px-8 py-4 text-sm font-bold uppercase tracking-widest hover:bg-slate-800 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.15)] transition-all"
            >
              Continue {activeLabel ?? 'your'} path
              <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </motion.div>
        )}

        {/* Paths */}
        <div className="mt-12">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-4xl tracking-tight">Career practice</h2>
          </div>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            {PATHS.map((p) => {
              const avatar = moduleAvatars[p.id];
              const isSelected = activeModule === p.id;
              if (!avatar) return null;

              return (
	                <button
	                  key={p.id}
	                  onClick={() => openPath(p.id)}
	                  disabled={openingModule !== null}
	                  className={cn(
	                    "group relative text-left rounded-[3rem] border-transparent text-white transition-all duration-700 overflow-hidden min-h-[350px] flex flex-col justify-between p-8",
	                    isSelected
	                      ? "ring-4 ring-white/30 scale-[1.01] z-20"
	                      : "opacity-90 hover:opacity-100 hover:-translate-y-1",
	                    openingModule && openingModule !== p.id ? "opacity-40 grayscale scale-[0.98]" : ""
	                  )}
                  style={{
                    backgroundColor: avatar.bg,
                    boxShadow: isSelected
                      ? `0 24px 50px ${avatar.bg}60`
                      : `0 10px 30px ${avatar.bg}33`,
                  }}
                >
                  {/* Avatar Graphic */}
                  <div className="absolute -bottom-10 -right-4 w-44 h-56 sm:w-64 sm:h-80 z-0 pointer-events-none transition-transform duration-700 ease-out group-hover:scale-105 group-hover:-translate-y-4">
                     <Image
                        src={avatar.url}
                        alt="Module Avatar"
                        fill
                        sizes="(max-width: 640px) 176px, 256px"
                        className={cn("object-contain object-bottom drop-shadow-2xl", getAvatarScaleClass(avatar.url))}
                        unoptimized
                     />
                  </div>

                  <div className="relative z-10 max-w-[60%] sm:max-w-[200px]">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display text-3xl font-bold tracking-tight leading-tight">{p.label}</h3>
                    </div>
                    {isSelected && (
                      <span className="mb-4 inline-block text-[9px] font-bold uppercase tracking-[0.18em] text-white bg-white/20 rounded-full px-3 py-1">Active</span>
                    )}
                    <p className="text-sm leading-relaxed mb-8 font-medium text-white/80">
                      {p.blurb}
                    </p>
                  </div>

	                  <div className="relative z-10 flex items-center gap-4 text-[10px] uppercase tracking-widest font-black mt-auto text-white/70">
	                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/10 backdrop-blur-sm">
	                       {openingModule === p.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Preparing
                          </>
                        ) : (
                          <>
                            Open <ArrowRightIcon className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                          </>
                        )}
	                    </span>
	                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>
      )}
    </div>
  );
}
