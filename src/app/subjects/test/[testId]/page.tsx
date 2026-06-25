"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircledIcon, CrossCircledIcon } from '@radix-ui/react-icons';
import { AppHeader } from '@/components/shared/AppHeader';
import { getToken } from '@/services/api';
import {
  getTest, submitTest, recordResult,
  type ServedTest, type TestResult,
} from '@/services/school';

export default function TestPage() {
  const router = useRouter();
  const { testId } = useParams() as { testId: string };
  const search = useSearchParams();
  const classNo = Number(search.get('class')) || 0;
  const chapterId = search.get('chapter') || undefined;

  const [test, setTest] = useState<ServedTest | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<TestResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.replace('/auth/login');
      return;
    }
    getTest(testId)
      .then(setTest)
      .catch(() => setError('Could not load this test.'))
      .finally(() => setLoading(false));
  }, [router, testId]);

  const answered = test ? test.items.filter((i) => (answers[i.id] || '').trim()).length : 0;
  const allAnswered = test ? answered === test.items.length : false;

  const submit = async () => {
    if (!test) return;
    setSubmitting(true);
    try {
      const r = await submitTest(testId, answers);
      setResult(r);
      if (classNo) recordResult(classNo, r, chapterId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('Could not submit your answers. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const backToClass = () => router.push(classNo ? `/subjects/class/${classNo}` : '/subjects');

  return (
    <div className="min-h-[100dvh] bg-[#FCFCFC] text-slate-900 font-body relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-500/[0.05] rounded-full blur-[120px] pointer-events-none" />
      <AppHeader title="Test" onBack={backToClass} backLabel="Class" />

      <main className="relative z-10 max-w-[760px] mx-auto px-6 pt-28 pb-32">
        {loading ? (
          <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-28 bg-slate-100/70 rounded-[1.5rem] animate-pulse" />)}</div>
        ) : error && !test ? (
          <div className="bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl px-6 py-4">{error}</div>
        ) : result ? (
          <ResultView result={result} onBack={backToClass} onRetry={() => { setResult(null); setAnswers({}); }} />
        ) : test && (
          <>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-indigo-500">
                {test.kind === 'chapter' ? 'Chapter Test' : 'Milestone Exam'}
              </span>
              <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">{test.title}</h1>
              <p className="mt-3 text-slate-500 text-sm">{test.items.length} questions · pass mark {Math.round(test.pass_mark * 100)}%</p>
            </motion.div>

            <div className="mt-10 space-y-5">
              {test.items.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: Math.min(idx * 0.05, 0.4), ease: [0.16, 1, 0.3, 1] }}
                  className="rounded-[1.5rem] border border-slate-200/70 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 text-xs font-black flex items-center justify-center mt-0.5">{idx + 1}</span>
                    <p className="font-semibold text-[17px] leading-snug text-slate-800">{item.prompt}</p>
                  </div>

                  {item.type === 'multiple_choice' && item.options ? (
                    <div className="mt-4 ml-10 grid grid-cols-1 gap-2.5">
                      {item.options.map((opt) => {
                        const sel = answers[item.id] === opt;
                        return (
                          <button
                            key={opt}
                            onClick={() => setAnswers((a) => ({ ...a, [item.id]: opt }))}
                            className={`text-left rounded-2xl border px-4 py-3 text-[15px] font-medium transition-all ${sel ? 'border-indigo-400 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-100' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-4 ml-10">
                      <input
                        value={answers[item.id] || ''}
                        onChange={(e) => setAnswers((a) => ({ ...a, [item.id]: e.target.value }))}
                        placeholder="Type your answer…"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[15px] outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
                      />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            {error && <p className="mt-5 text-sm text-rose-600 text-center">{error}</p>}

            {/* sticky submit bar */}
            <div className="fixed bottom-0 inset-x-0 z-40 bg-white/85 backdrop-blur-xl border-t border-slate-200/60">
              <div className="max-w-[760px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
                <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">{answered}/{test.items.length} answered</span>
                <button
                  onClick={submit}
                  disabled={!allAnswered || submitting}
                  className="rounded-full bg-indigo-600 text-white px-8 py-3 text-[13px] font-bold uppercase tracking-[0.15em] shadow-sm hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Scoring…' : 'Submit test'}
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function ResultView({ result, onBack, onRetry }: { result: TestResult; onBack: () => void; onRetry: () => void }) {
  const pct = Math.round(result.score * 100);
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}>
      <div className={`rounded-[2rem] p-8 text-white relative overflow-hidden ${result.passed ? 'bg-emerald-600' : 'bg-slate-900'}`}>
        <div className="absolute -right-12 -bottom-12 w-56 h-56 bg-white/15 rounded-full blur-3xl" />
        <div className="relative flex items-center gap-3">
          {result.passed ? <CheckCircledIcon className="w-7 h-7" /> : <CrossCircledIcon className="w-7 h-7" />}
          <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/70">
            {result.passed ? 'Passed' : 'Keep practising'}
          </span>
        </div>
        <p className="relative mt-4 font-display text-6xl tracking-tight leading-none">{pct}%</p>
        <p className="relative mt-2 text-white/70 text-sm">{result.correct} of {result.total} correct · {result.title}</p>
      </div>

      <h3 className="mt-8 mb-3 font-display text-xl tracking-tight">By skill</h3>
      <div className="space-y-3">
        {result.by_skill.map((s) => (
          <div key={s.skill} className="flex items-center gap-3">
            <span className="w-32 text-sm font-semibold text-slate-600 capitalize truncate">{s.skill.replace(/_/g, ' ')}</span>
            <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
              <motion.div
                className={`h-full rounded-full ${s.mastery >= 0.6 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                initial={{ width: 0 }} animate={{ width: `${Math.round(s.mastery * 100)}%` }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <span className="text-xs font-black tracking-widest text-slate-400 w-10 text-right">{s.correct}/{s.total}</span>
          </div>
        ))}
      </div>

      {result.weak_skills.length > 0 && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/60 px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">Work on next</p>
          <p className="mt-1.5 text-sm text-amber-900 capitalize">{result.weak_skills.map((s) => s.replace(/_/g, ' ')).join(' · ')}</p>
        </div>
      )}

      <div className="mt-8 flex items-center gap-3">
        <button onClick={onBack} className="flex-1 rounded-full bg-slate-900 text-white py-3.5 text-[13px] font-bold uppercase tracking-[0.15em] hover:bg-slate-800 transition-colors active:scale-[0.99]">Back to class</button>
        <button onClick={onRetry} className="rounded-full border border-slate-200 px-6 py-3.5 text-[13px] font-bold uppercase tracking-[0.15em] text-slate-600 hover:bg-slate-50 transition-colors">Retry</button>
      </div>
    </motion.div>
  );
}
