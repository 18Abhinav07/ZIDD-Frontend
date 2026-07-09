"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import {
  ArrowRightIcon, CheckCircledIcon, ChevronDownIcon, LockClosedIcon,
  Pencil2Icon, ReaderIcon, RocketIcon, StarIcon,
} from '@radix-ui/react-icons';
import { AppHeader } from '@/components/shared/AppHeader';
import { startSessionWithPaywall } from '@/services/billing';
import {
  cacheProgress, getClassDetail, getProgress, getServerProgress, humanizeSkill,
  serverToProgress, type SchoolClassDetail,
} from '@/services/school';



const LEVEL_ICON = [ReaderIcon, ReaderIcon, Pencil2Icon, RocketIcon];

export default function ClassPage() {
  const router = useRouter();
  const params = useParams();
  const classNo = Number(params.classNo);
  const [detail, setDetail] = useState<SchoolClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [progressError, setProgressError] = useState('');
  const [openChapter, setOpenChapter] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [progress, setProgress] = useState(() => getProgress(classNo));
  const [progressTrusted, setProgressTrusted] = useState(false);
  const [weakSkills, setWeakSkills] = useState<string[]>([]);
  const [serverOverall, setServerOverall] = useState<number | null>(null);
  const startIdsRef = useRef<Map<string, string>>(new Map());

  const loadClass = useCallback(async () => {
    setLoading(true);
    setError('');
    setProgressError('');
    setProgress(getProgress(classNo));
    setProgressTrusted(false);
    setWeakSkills([]);
    setServerOverall(null);
    try {
      const d = await getClassDetail(classNo);
      setDetail(d);
      try {
        const server = await getServerProgress(classNo);
        const mapped = serverToProgress(d, server);
        setProgress(mapped);
        setProgressTrusted(true);
        cacheProgress(classNo, mapped);
        setWeakSkills(server.weak_skills);
        setServerOverall(server.overall);
      } catch (err: unknown) {
        const raw = err instanceof Error ? err.message : '';
        setProgressTrusted(false);
        setProgressError(
          raw === 'request_timeout'
            ? 'Saved progress took too long to load. Lesson statuses are temporarily unavailable.'
            : 'Could not load saved progress. Lesson statuses are temporarily unavailable.'
        );
      }
    } catch {
      setError('Could not load this class.');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [classNo]);

  useEffect(() => {
    void loadClass();
  }, [loadClass]);

  const total = detail?.chapters.length ?? 0;
  const done = progress.passedChapters.length;
  const progressUnavailable = Boolean(progressError) && !progressTrusted;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const reportSkills = useMemo(() => {
    const scores = Object.values(progress.testScores);
    const localAvg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    // Prefer the server's durable average when it has a record.
    const avg = serverOverall != null && scores.length ? serverOverall : localAvg;
    return { taken: scores.length, avg: Math.round(avg * 100) };
  }, [progress, serverOverall]);

  const startIdForLevel = (levelId: string) => {
    const existing = startIdsRef.current.get(levelId);
    if (existing) return existing;
    const next = crypto.randomUUID();
    startIdsRef.current.set(levelId, next);
    return next;
  };

  const clearStartId = (levelId: string) => {
    startIdsRef.current.delete(levelId);
  };

  const startLevel = async (levelId: string) => {
    setStarting(levelId);
    setError('');
    try {
      const r = await startSessionWithPaywall({
        competency_node: levelId,
        test_mode: false,
        client_start_id: startIdForLevel(levelId),
      });
      if (r.ok) {
        clearStartId(levelId);
        router.push(`/session/${r.session_id}`);
      } else {
        clearStartId(levelId);
        setError('This lesson is not available right now.');
      }
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : '';
      if (raw !== 'session_start_timeout' && !/Failed to fetch|NetworkError|load failed/i.test(raw)) {
        clearStartId(levelId);
      }
      setError(raw === 'progression_unavailable'
        ? 'Could not read your saved lesson progress from the server. Please retry in a moment.'
        : 'Could not start the lesson. Please try again.');
    } finally {
      setStarting(null);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#FCFCFC] text-slate-900 font-body relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-indigo-500/[0.05] rounded-full blur-[120px] pointer-events-none" />
      <AppHeader title={`Class ${classNo}`} onBack={() => router.push('/subjects')} backLabel="Subjects" />

      <main className="relative z-10 max-w-[1000px] mx-auto px-6 lg:px-12 pt-28 pb-24">
        {loading ? (
          <div className="space-y-4">
            <div className="h-16 w-2/3 bg-slate-100 rounded-2xl animate-pulse" />
            {[0, 1, 2].map((i) => <div key={i} className="h-20 bg-slate-100/70 rounded-[1.5rem] animate-pulse" />)}
          </div>
        ) : error && !detail ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-700">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-semibold">{error}</p>
              <button
                type="button"
                onClick={() => void loadClass()}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-wait disabled:opacity-60"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Retry
              </button>
            </div>
          </div>
        ) : detail && (
          <>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-indigo-500">English curriculum</span>
              <h1 className="mt-3 font-display text-4xl md:text-5xl tracking-tight leading-[1.05]">{detail.title}</h1>
              {/* progress bar */}
              <div className="mt-6 flex items-center gap-4 max-w-md">
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                  <motion.div
                    className={`h-full rounded-full ${progressUnavailable ? 'bg-slate-300' : 'bg-indigo-500'}`}
                    initial={{ width: 0 }}
                    animate={{ width: progressUnavailable ? '100%' : `${pct}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                <span className="text-xs font-black tracking-widest text-slate-400">
                  {progressUnavailable ? 'Progress unavailable' : `${done}/${total} chapters`}
                </span>
              </div>
            </motion.div>

            {progressError && (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-semibold">{progressError}</p>
                  <button
                    type="button"
                    onClick={() => void loadClass()}
                    className="inline-flex items-center justify-center rounded-xl border border-amber-300 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-amber-800 transition-colors hover:bg-amber-100"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* Chapters */}
            <h2 className="mt-12 mb-4 font-display text-2xl tracking-tight">Chapters</h2>
            <div className="space-y-3">
              {detail.chapters.map((ch, i) => {
                const passed = progress.passedChapters.includes(ch.id);
                const open = openChapter === ch.id;
                const completedLessons = ch.levels.filter(
                  (level) => progress.lessonProgress[level.id] === 'completed',
                ).length;
                return (
                  <motion.div
                    key={ch.id}
                    initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.3), ease: [0.16, 1, 0.3, 1] }}
                    className="rounded-[1.5rem] border border-slate-200/70 bg-white shadow-sm overflow-hidden"
                  >
                    <button
                      onClick={() => setOpenChapter(open ? null : ch.id)}
                      className="w-full flex items-center gap-4 p-5 text-left hover:bg-slate-50/60 transition-colors"
                    >
                      <span className={`flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center font-anton text-xl ${passed ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                        {passed ? <CheckCircledIcon className="w-6 h-6" /> : ch.chapter_no}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-lg tracking-tight truncate">{ch.ncert_unit}</p>
                        <p className="text-xs text-slate-400 font-medium capitalize">
                          {ch.genre} · {progressUnavailable ? 'saved progress unavailable' : `${completedLessons}/${ch.levels.length} lessons done`}
                        </p>
                      </div>
                      <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {ch.levels.map((lvl, li) => {
                              const Icon = LEVEL_ICON[li] ?? ReaderIcon;
                              const lessonStatus = progressUnavailable ? 'unavailable' : (progress.lessonProgress[lvl.id] || 'learn');
                              const label = lessonStatus === 'unavailable'
                                ? 'Unavailable'
                                : lessonStatus === 'completed'
                                ? 'Completed'
                                : lessonStatus === 'in_progress' || lessonStatus === 'reattempting'
                                  ? 'Continue'
                                  : 'Learn';
                              return (
                                <button
                                  key={lvl.id}
                                  onClick={() => startLevel(lvl.id)}
                                  disabled={starting !== null || progressUnavailable}
                                  className={`group flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all disabled:opacity-50 ${
                                    lessonStatus === 'completed'
                                      ? 'border-emerald-200 bg-emerald-50/40 hover:bg-white'
                                      : lessonStatus === 'in_progress' || lessonStatus === 'reattempting'
                                        ? 'border-indigo-200 bg-indigo-50/40 hover:bg-white'
                                        : lessonStatus === 'unavailable'
                                          ? 'border-slate-200/70 bg-slate-100/70 cursor-not-allowed'
                                          : 'border-slate-200/70 bg-slate-50/40 hover:border-indigo-200 hover:bg-white'
                                  }`}
                                >
                                  <span className={`w-8 h-8 rounded-xl bg-white border flex items-center justify-center ${
                                    lessonStatus === 'completed'
                                      ? 'border-emerald-200 text-emerald-600'
                                      : 'border-slate-200 text-indigo-500'
                                  }`}>
                                    {lessonStatus === 'completed' ? <CheckCircledIcon className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                                  </span>
                                  <span className="flex-1 text-sm font-semibold text-slate-700">{lvl.title}</span>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                                    {starting === lvl.id ? (
                                        <span className="inline-flex items-center gap-1.5">
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Starting
                                        </span>
                                      ) : label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          {ch.chapter_test_id && (
                            <div className="px-5 pb-5">
                              <button
                                onClick={() => router.push(`/subjects/test/${ch.chapter_test_id}?class=${classNo}&chapter=${ch.id}`)}
                                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-slate-900 text-white py-3.5 text-[12px] font-bold uppercase tracking-[0.15em] hover:bg-slate-800 transition-colors active:scale-[0.99]"
                              >
                                {passed ? 'Retake chapter test' : 'Take chapter test'}
                                <ArrowRightIcon className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>

            {/* Milestones */}
            <h2 className="mt-12 mb-4 font-display text-2xl tracking-tight">Milestone exams</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {detail.milestones.map((m) => {
                const unlocked = pct >= m.at_percent;
                const taken = progress.firedMilestones.includes(m.at_percent);
                return (
                  <div
                    key={m.id}
                    className={`rounded-[1.5rem] border p-5 transition-all ${unlocked ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200/70 bg-white'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${unlocked ? 'text-amber-600' : 'text-slate-400'}`}>{m.at_percent}% review</span>
                      {taken ? <CheckCircledIcon className="w-5 h-5 text-emerald-500" /> : unlocked ? <StarIcon className="w-5 h-5 text-amber-500" /> : <LockClosedIcon className="w-4 h-4 text-slate-300" />}
                    </div>
                    <p className="mt-3 font-bold text-[15px] leading-tight">{m.title}</p>
                    <button
                      disabled={!unlocked}
                      onClick={() => router.push(`/subjects/test/${m.id}?class=${classNo}`)}
                      className={`mt-4 text-[11px] font-bold uppercase tracking-[0.15em] inline-flex items-center gap-1.5 ${unlocked ? 'text-indigo-600 hover:gap-2.5' : 'text-slate-300 cursor-not-allowed'} transition-all`}
                    >
                      {unlocked ? (taken ? 'Retake exam' : 'Take exam') : 'Locked'}
                      {unlocked && <ArrowRightIcon className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Report card */}
            {reportSkills.taken > 0 && (
              <div className="mt-12 rounded-[1.75rem] border border-slate-200/70 bg-slate-900 text-white p-7 relative overflow-hidden">
                <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl" />
                <span className="relative text-[10px] font-bold uppercase tracking-[0.25em] text-white/50">Report card</span>
                <p className="relative mt-3 font-display text-4xl tracking-tight">{reportSkills.avg}% average</p>
                <p className="relative mt-1 text-sm text-white/60">across {reportSkills.taken} test{reportSkills.taken === 1 ? '' : 's'} taken · {done}/{total} chapters mastered</p>
                {weakSkills.length > 0 && (
                  <div className="relative mt-5 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Focus areas</span>
                    {weakSkills.map((s) => (
                      <span key={s} className="rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-semibold capitalize text-white/80">
                        {humanizeSkill(s)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {error && detail && <p className="mt-6 text-sm text-rose-600">{error}</p>}
          </>
        )}
      </main>
    </div>
  );
}
