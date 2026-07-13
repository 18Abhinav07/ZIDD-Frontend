"use client";

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRightIcon,
  LightningBoltIcon,
  PlusIcon,
} from '@radix-ui/react-icons';
import {
  BookOpen,
  BriefcaseBusiness,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  IdCard,
  Loader2,
  Mail,
  Target,
  TrendingUp,
  Trophy,
  UserRound,
} from 'lucide-react';
import { AppHeader } from '@/components/shared/AppHeader';
import {
  CareerContinuityPanel,
  careerEvidenceProvenance,
} from '@/components/career/CareerContinuityPanel';
import { canShowDevCreditGrant, devGrantCredits } from '@/services/billing';
import {
  getMe,
  getMeActivity,
  getMeLearningGraph,
  invalidateMeCache,
  updatePreferences,
  type CareerMemoryItem,
  type MeActivity,
  type MeLearningGraph,
  type MeResponse,
  type ModuleId,
} from '@/services/me';
import { useAppSession } from '@/components/shared/AppSessionProvider';
import { labelGdTopic } from '@/lib/gdTopics';
import { careerCompetenceLabel, careerPracticeHref } from '@/lib/careerPathPresentation.mjs';

const CAREER_PATHS: { id: ModuleId; label: string; blurb: string }[] = [
  { id: 'interview', label: 'Interview', blurb: 'Practice structured answers, pressure, and role fit.' },
  { id: 'group_discussion', label: 'Group Discussion', blurb: 'Practice taking a stance, building on others, and closing.' },
];

function motiveLabel(motive?: string | null): string {
  if (motive === 'school') return 'School English';
  if (motive === 'career') return 'Interview and GD prep';
  return 'Not completed';
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

function learnerFacingDetail(value?: string, fallback = 'Keep collecting evidence in a fresh scenario.'): string {
  const text = (value || '').trim();
  if (!text || /^(?:gd|int)_\d+_[a-z0-9_]+$/i.test(text)) return fallback;
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

export default function ProfilePage() {
  const router = useRouter();
  const { loadBalance, loadMe } = useAppSession();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [activity, setActivity] = useState<MeActivity | null>(null);
  const [learningGraph, setLearningGraph] = useState<MeLearningGraph | null>(null);
  const [activityError, setActivityError] = useState('');
  const [learningGraphError, setLearningGraphError] = useState('');
  const [activityLoading, setActivityLoading] = useState(false);
  const [learningGraphLoading, setLearningGraphLoading] = useState(false);
  const [granting, setGranting] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState('');
  const [mounted, setMounted] = useState(false);

  const loadProfileActivity = useCallback(async () => {
    setActivityError('');
    setActivityLoading(true);
    try {
      const nextActivity = await getMeActivity();
      setActivity(nextActivity);
    } catch {
      setActivity(null);
      setActivityError('Activity summary is temporarily unavailable. Profile details are still available.');
    } finally {
      setActivityLoading(false);
    }
  }, []);

  const loadCareerGrowth = useCallback(async () => {
    setLearningGraphError('');
    setLearningGraphLoading(true);
    try {
      const nextGraph = await getMeLearningGraph();
      setLearningGraph(nextGraph);
      if (nextGraph.degraded) {
        setLearningGraphError('Career growth evidence is partially unavailable. Recent profile details are still visible.');
      }
    } catch {
      setLearningGraph(null);
      setLearningGraphError('Career growth evidence is temporarily unavailable. Profile details are still available.');
    } finally {
      setLearningGraphLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    let cancelled = false;
    const loadProfile = async () => {
      try {
        const profile = await getMe();
        if (cancelled) return;
        setMe(profile);
        setActivityError('');
        setLearningGraphError('');
        setActivityLoading(true);
        setLearningGraphLoading(true);
        getMeActivity()
          .then((nextActivity) => {
            if (!cancelled) setActivity(nextActivity);
          })
          .catch(() => {
            if (!cancelled) {
              setActivity(null);
              setActivityError('Activity summary is temporarily unavailable. Profile details are still available.');
            }
          })
          .finally(() => {
            if (!cancelled) setActivityLoading(false);
          });
        getMeLearningGraph()
          .then((nextGraph) => {
            if (!cancelled) {
              setLearningGraph(nextGraph);
              if (nextGraph.degraded) {
                setLearningGraphError('Career growth evidence is partially unavailable. Recent profile details are still visible.');
              }
            }
          })
          .catch(() => {
            if (!cancelled) {
              setLearningGraph(null);
              setLearningGraphError('Career growth evidence is temporarily unavailable. Profile details are still available.');
            }
          })
          .finally(() => {
            if (!cancelled) setLearningGraphLoading(false);
          });
      } catch {
        if (!cancelled) {
          router.replace('/auth/login');
        }
      }
    };
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const topUp = async () => {
    setGranting(true);
    try {
      const r = await devGrantCredits(500);
      invalidateMeCache();
      setMe((m) => (m ? { ...m, credits: r.credits } : m));
      await Promise.allSettled([loadBalance(true), loadMe(true)]);
    } catch {
      /* endpoint is 404 outside dev */
    } finally {
      setGranting(false);
    }
  };

  const openSchool = async () => {
    setSwitching('school_english');
    setSwitchError('');
    try {
      const res = await updatePreferences({ active_module: 'school_english', pending_module: null, test_mode: null });
      setMe((m) => (m ? { ...m, preferences: res.preferences } : m));
      router.push('/subjects');
    } catch {
      setSwitchError('Could not switch paths. Please try again.');
      setSwitching(null);
    }
  };

  const openCareer = async (moduleId: ModuleId) => {
    setSwitching(moduleId);
    setSwitchError('');
    try {
      const res = await updatePreferences({ pending_module: moduleId, active_module: null, test_mode: null });
      setMe((m) => (m ? { ...m, preferences: res.preferences } : m));
      router.push('/mode');
    } catch {
      setSwitchError('Could not switch paths. Please try again.');
      setSwitching(null);
    }
  };

  const onPracticeCareerGap = async (item: CareerMemoryItem) => {
    const moduleId = careerModuleFromMemory(item);
    if (!moduleId) return;
    setSwitching(moduleId);
    setSwitchError('');
    try {
      const res = await updatePreferences({ active_module: moduleId, pending_module: null, test_mode: false });
      setMe((m) => (m ? { ...m, preferences: res.preferences } : m));
      void loadMe(true).catch(() => null);
      router.push(careerPracticeHref(item));
    } catch {
      setSwitchError('Could not open this practice skill. Please try again.');
      setSwitching(null);
    }
  };

  const credits = me?.demo_unlimited ? '∞' : (me?.credits ?? '—');
  const displayName = me?.name?.trim() || me?.user_id || 'there';
  const primaryMotive = me?.onboarding?.primary_motive;
  const schoolProfile = me?.school_profile ?? {};
  const careerProfile = me?.career_profile ?? {};
  const targetRoleChips = careerProfile.target_roles ?? [];
  const interviewGoalChips = careerProfile.interview_goals ?? [];
  const gdTopicChips = (careerProfile.gd_topic_ids ?? []).map(labelGdTopic);
  const customGdTopicChips = careerProfile.custom_gd_topics ?? [];
  const careerMemory = learningGraph?.memory_context;
  const hasCareerProfileDetails = [
    targetRoleChips,
    interviewGoalChips,
    gdTopicChips,
    customGdTopicChips,
  ].some((items) => items.length > 0);

  if (!me) {
    return (
      <div className="min-h-[100dvh] bg-[#FCFCFC] text-slate-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400 text-sm font-bold uppercase tracking-[0.18em]">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading profile
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#FCFCFC] text-slate-900 font-body relative overflow-hidden flex flex-col">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-indigo-500/[0.04] rounded-full blur-[120px] pointer-events-none" />
      <AppHeader title="Profile" />

      <main className="relative z-10 max-w-[1120px] mx-auto px-6 lg:px-12 pt-28 pb-24 flex-1 w-full">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-indigo-700">Profile</span>
          <h1 className="mt-3 font-display text-5xl md:text-6xl leading-[1]">
            {displayName}
          </h1>
          <p className="mt-4 text-slate-600 text-[15px] max-w-xl">
            Account identity, learning profile, credits, activity, and module switching.
          </p>
        </motion.div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-5">
          <section className="lg:col-span-2 rounded-[1.75rem] border border-slate-200/70 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2 text-slate-500">
              <IdCard className="w-4 h-4" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Account</span>
            </div>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow icon={<UserRound className="w-4 h-4" />} label="Username" value={me.name || 'Not set'} />
              <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={me.email || 'Not available'} />
              <InfoRow icon={<Target className="w-4 h-4" />} label="Primary motive" value={motiveLabel(primaryMotive)} />
              <InfoRow icon={<IdCard className="w-4 h-4" />} label="User ID" value={me.user_id} mono />
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-slate-200/70 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2 text-slate-500">
              <LightningBoltIcon className="w-4 h-4" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Wallet</span>
            </div>
            <p className="mt-4 font-display text-5xl leading-none">{credits}</p>
            <p className="mt-1 text-xs text-slate-500 font-medium">credits available</p>
            {mounted && canShowDevCreditGrant() && !me.demo_unlimited && (
              <button
                onClick={topUp}
                disabled={granting}
                className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-indigo-600 hover:text-indigo-700 disabled:opacity-50 transition-colors"
              >
                <PlusIcon className="w-3.5 h-3.5" /> {granting ? 'Adding...' : 'Add 500 (dev)'}
              </button>
            )}
          </section>
        </div>

        {activityError && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-semibold">{activityError}</p>
              <button
                type="button"
                onClick={() => void loadProfileActivity()}
                disabled={activityLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60"
              >
                {activityLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Retry
              </button>
            </div>
          </div>
        )}

        {switchError && (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {switchError}
          </div>
        )}

        {learningGraphError && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-semibold">{learningGraphError}</p>
              <button
                type="button"
                onClick={() => void loadCareerGrowth()}
                disabled={learningGraphLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60"
              >
                {learningGraphLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Retry growth
              </button>
            </div>
          </div>
        )}

        <div className={`mt-5 grid grid-cols-1 gap-5 ${primaryMotive === 'school' ? 'lg:grid-cols-2' : ''}`}>
          {primaryMotive === 'school' && (
          <section className="rounded-[1.75rem] border border-slate-200/70 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2 text-indigo-700">
              <BookOpen className="w-4 h-4" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em]">School profile</span>
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-900">
              {schoolProfile.school_name || 'No school profile added yet'}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {schoolProfile.learning_goal || 'Class is not stored on your profile. Open any available class from the curriculum.'}
            </p>
            <div className="mt-5 flex items-center gap-3 text-sm">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-600">
                {activity ? `${activity.school.results_count} tests` : activityError ? 'Tests unavailable' : '0 tests'}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-600">
                {activity ? `${percent(activity.school.average_score)} average` : activityError ? 'Average unavailable' : '0% average'}
              </span>
            </div>
            <button
              onClick={openSchool}
              disabled={switching !== null}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Open curriculum <ArrowRightIcon className="w-4 h-4" />
            </button>
          </section>
          )}

          <section className="rounded-[1.75rem] border border-slate-200/70 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2 text-emerald-700">
              <BriefcaseBusiness className="w-4 h-4" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Career profile</span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-800">
              {careerProfile.resume_present ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <FileText className="w-4 h-4 text-slate-400" />}
              {careerProfile.resume_present ? 'Resume/details added' : 'Resume/details not added'}
            </div>
            {hasCareerProfileDetails ? (
              <div className="mt-4 space-y-4">
                <ChipGroup label="Target roles" items={targetRoleChips} />
                <ChipGroup label="Interview goals" items={interviewGoalChips} />
                <ChipGroup label="GD topics" items={gdTopicChips} />
                <ChipGroup label="Custom GD topics" items={customGdTopicChips} />
              </div>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                Add target roles, interview goals, or GD topics during onboarding/profile refinement for stronger personalization.
              </p>
            )}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CAREER_PATHS.map((path) => (
                <button
                  key={path.id}
                  onClick={() => openCareer(path.id)}
                  disabled={switching !== null}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left hover:border-indigo-200 hover:bg-white disabled:opacity-50 transition-all"
                >
                  <p className="font-bold text-slate-900">{path.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{path.blurb}</p>
                </button>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-5 rounded-[1.75rem] border border-slate-200/70 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-slate-500">
                <TrendingUp className="w-4 h-4" />
                <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Career growth</span>
              </div>
              <h2 className="mt-3 font-display text-3xl leading-tight text-slate-950">Evidence the tutor is tracking</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
                Career evidence prioritized by what needs work next and what has stronger proof.
              </p>
            </div>
            {learningGraphLoading && (
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading
              </div>
            )}
          </div>

          {careerMemory ? (
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <GrowthBucket
                title="Active gaps"
                tone="rose"
                icon={<AlertTriangle className="w-4 h-4" />}
                items={careerMemory.active_gaps}
                empty="No active career gaps tracked yet."
                onPractice={onPracticeCareerGap}
                graph={learningGraph}
              />
              <GrowthBucket
                title="Improving"
                tone="amber"
                icon={<TrendingUp className="w-4 h-4" />}
                items={careerMemory.improving_gaps}
                empty="No improving gaps yet."
                onPractice={onPracticeCareerGap}
                graph={learningGraph}
              />
              <GrowthBucket
                title="Resolved"
                tone="emerald"
                icon={<CheckCircle2 className="w-4 h-4" />}
                items={careerMemory.resolved_gaps}
                empty="No resolved gaps yet."
                onPractice={onPracticeCareerGap}
                graph={learningGraph}
              />
              <GrowthBucket
                title="Mastered"
                tone="indigo"
                icon={<Trophy className="w-4 h-4" />}
                items={careerMemory.mastered_skills}
                empty="No sustained mastery evidence yet."
                onPractice={onPracticeCareerGap}
                graph={learningGraph}
              />
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-5 text-sm leading-relaxed text-slate-500">
              Complete prep turns or scored tests to build the career growth graph.
            </div>
          )}
        </section>

        <CareerContinuityPanel graph={learningGraph} compact />

        <section className="mt-5 rounded-[1.75rem] border border-slate-200/70 bg-slate-900 text-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.08)]">
          <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/70">Recommendations</span>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {(activity?.recommendations.length
              ? activity.recommendations
              : [{
                title: activityError ? 'Activity unavailable' : 'Continue learning',
                body: activityError ? 'Retry activity loading for personalized recommendations.' : 'Open your primary path and keep going.',
                href: activityError ? '/profile' : primaryMotive === 'school' ? '/subjects' : '/career',
                kind: 'default',
              }]).map((item) => (
              <button
                key={`${item.kind}-${item.title}`}
                onClick={() => router.push(item.href)}
                className="rounded-2xl bg-white/10 border border-white/10 px-5 py-4 text-left hover:bg-white/15 transition-colors"
              >
                <p className="font-bold">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-white/60">{item.body}</p>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-[0.18em]">{label}</span>
      </div>
      <p className={`mt-2 text-sm font-bold text-slate-800 break-words ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function ChipGroup({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;

  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={`${label}-${item}`} className="rounded-full bg-emerald-50 border border-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

const GROWTH_TONES: Record<string, { wrap: string; label: string; chip: string }> = {
  rose: {
    wrap: 'border-rose-100 bg-rose-50/70',
    label: 'text-rose-700',
    chip: 'bg-rose-100 text-rose-700',
  },
  amber: {
    wrap: 'border-amber-100 bg-amber-50/70',
    label: 'text-amber-700',
    chip: 'bg-amber-100 text-amber-800',
  },
  emerald: {
    wrap: 'border-emerald-100 bg-emerald-50/70',
    label: 'text-emerald-700',
    chip: 'bg-emerald-100 text-emerald-700',
  },
  indigo: {
    wrap: 'border-indigo-100 bg-indigo-50/70',
    label: 'text-indigo-700',
    chip: 'bg-indigo-100 text-indigo-700',
  },
};

function GrowthBucket({
  title,
  tone,
  icon,
  items,
  empty,
  onPractice,
  graph,
}: {
  title: string;
  tone: keyof typeof GROWTH_TONES;
  icon: ReactNode;
  items: CareerMemoryItem[];
  empty: string;
  onPractice: (item: CareerMemoryItem) => void;
  graph: MeLearningGraph | null;
}) {
  const styles = GROWTH_TONES[tone];
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? items : items.slice(0, 3);
  const hiddenCount = Math.max(0, items.length - visibleItems.length);

  return (
    <div className={`rounded-2xl border px-4 py-4 ${styles.wrap}`}>
      <div className={`flex items-center gap-2 ${styles.label}`}>
        {icon}
        <h3 className="text-[11px] font-black uppercase tracking-[0.18em]">{title}</h3>
      </div>
      {items.length ? (
        <div className="mt-4 space-y-3">
          {visibleItems.map((item) => (
            <GrowthItem key={`${title}-${item.skill_id}`} item={item} chipClass={styles.chip} onPractice={onPractice} graph={graph} />
          ))}
          {items.length > 3 && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              className={`inline-flex items-center gap-1.5 px-1 py-1 text-[11px] font-black uppercase tracking-[0.13em] transition-colors ${styles.label}`}
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {expanded ? 'Show less' : `Show all ${items.length}`}
              {!expanded && hiddenCount > 0 && <span className="sr-only"> ({hiddenCount} more)</span>}
            </button>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-slate-600">{empty}</p>
      )}
    </div>
  );
}

function GrowthItem({
  item,
  chipClass,
  onPractice,
  graph,
}: {
  item: CareerMemoryItem;
  chipClass: string;
  onPractice: (item: CareerMemoryItem) => void;
  graph: MeLearningGraph | null;
}) {
  const latest_evidence = item.latest_evidence?.trim();
  const repeat_count = Number(item.repeat_count || 0);
  const careerModule = careerModuleFromMemory(item);
  const moduleLabel = careerModule === 'group_discussion'
    ? 'Group Discussion'
    : careerModule === 'interview'
      ? 'Interview'
      : '';
  const displaySkill = item.skill_id;
  const secondaryGap = learnerFacingDetail(
    item.gap || item.recommended_next_action
  );
  const competenceStatus = item.current_competence_status || item.status;
  const competenceLabel = careerCompetenceLabel(competenceStatus);
  const statusLabel = ['resolved', 'mastered'].includes(competenceStatus)
    ? competenceLabel
    : `${competenceLabel} · ${percent(item.readiness || 0)}`;
  const practiceLabel = ['active_gap', 'needs_review'].includes(competenceStatus)
    ? 'Practice focus'
    : competenceStatus === 'improving'
      ? 'Strengthen this'
      : 'Revisit skill';
  const provenance = careerEvidenceProvenance(graph, item.skill_id);

  return (
    <div className="rounded-xl border border-white/70 bg-white/80 px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-black leading-tight text-slate-900">{formatSkillLabel(displaySkill)}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{secondaryGap}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${chipClass}`}>
          {statusLabel}
        </span>
      </div>
      {latest_evidence && (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-xs leading-relaxed text-slate-600 break-words">
            Evidence: {latest_evidence}
          </p>
          {provenance && (
            <p className="mt-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{provenance}</p>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
        {moduleLabel && <span>{moduleLabel}</span>}
        <span>{item.attempts || 0} attempt{item.attempts === 1 ? '' : 's'}</span>
        {repeat_count > 1 && <span>{repeat_count} repeated issues</span>}
      </div>
      {careerModule && (
        <button
          type="button"
          onClick={() => onPractice(item)}
          className="mt-3 inline-flex items-center justify-center rounded-full bg-slate-900 px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-white transition-colors hover:bg-slate-800"
        >
          {practiceLabel}
        </button>
      )}
    </div>
  );
}
