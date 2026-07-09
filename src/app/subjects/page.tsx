"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRightIcon, BookmarkIcon } from '@radix-ui/react-icons';
import { Loader2 } from 'lucide-react';
import { AppHeader } from '@/components/shared/AppHeader';
import { getClasses, type SchoolClassSummary } from '@/services/school';

export default function SubjectsPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<SchoolClassSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openingClass, setOpeningClass] = useState<number | null>(null);

  const loadClasses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const c = await getClasses();
      setClasses(c.sort((a, b) => a.class_no - b.class_no));
    } catch {
      setClasses([]);
      setError('Could not load your classes. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  return (
    <div className="min-h-[100dvh] bg-[#FCFCFC] text-slate-900 font-body relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-indigo-500/[0.05] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-rose-500/[0.05] rounded-full blur-[100px] pointer-events-none" />
      <AppHeader title="Subjects" />

      <main className="relative z-10 max-w-[1100px] mx-auto px-6 lg:px-12 pt-28 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-indigo-500">Subjects · NCERT</span>
          <h1 className="mt-3 font-display text-5xl md:text-6xl tracking-tight leading-[1]">English</h1>
          <p className="mt-4 text-slate-500 text-[15px] max-w-xl">
            The full Marigold curriculum, one class at a time. Each chapter teaches new words,
            reading, grammar, and writing, then checks what you learned. Pick your class to begin.
          </p>
        </motion.div>

        {error && (
          <div className="mt-10 rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-700">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-semibold">{error}</p>
              <button
                type="button"
                onClick={() => void loadClasses()}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-wait disabled:opacity-60"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Retry
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-[1.75rem] bg-slate-100/70 border border-slate-200/60 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {classes.map((c, i) => (
              <motion.button
                key={c.class_no}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
	                transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
	                onClick={() => {
                    setOpeningClass(c.class_no);
                    router.push(`/subjects/class/${c.class_no}`);
                  }}
                  disabled={openingClass !== null}
	                className="group relative text-left rounded-[1.75rem] border border-slate-200/70 bg-white p-7 shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden transition-all duration-300 ease-out hover:-translate-y-1 hover:border-indigo-200 hover:shadow-[0_24px_44px_rgba(79,70,229,0.12)] focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 disabled:opacity-60 disabled:cursor-wait"
	              >
                <span className="pointer-events-none absolute -top-6 right-4 font-anton text-[8rem] leading-none tracking-tighter text-slate-900/[0.04] group-hover:text-indigo-500/[0.10] transition-colors duration-300 select-none">
                  {c.class_no}
                </span>
                <div className="relative">
                  <div className="flex items-center gap-2 text-indigo-500">
                    <BookmarkIcon className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Class {c.class_no}</span>
                  </div>
                  <h2 className="mt-3 font-bold text-2xl tracking-tight leading-tight pr-16">{c.title}</h2>
                  <p className="mt-2 text-sm text-slate-500">{c.chapter_count} chapters · Marigold</p>
	                  <span className="mt-6 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">
	                    {openingClass === c.class_no ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Opening class
                        </>
                      ) : (
                        <>
                          Open class <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                        </>
                      )}
	                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
