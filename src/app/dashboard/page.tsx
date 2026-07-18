"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCw } from 'lucide-react';
import { getMe, homeForMe } from '@/services/me';
import { HomeResolverSkeleton } from '@/components/shared/RouteSkeletons';
import { learnerSafeErrorMessage } from '@/lib/errorCopy';

export default function DashboardResolverPage() {
  const router = useRouter();
  const [retryKey, setRetryKey] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');

    getMe()
      .then((me) => {
        if (!cancelled) router.replace(homeForMe(me));
      })
      .catch((err: unknown) => {
        if (cancelled || (err instanceof Error && err.message === 'Unauthorized')) return;
        setError(learnerSafeErrorMessage(err, 'We could not open your dashboard. Please try again.'));
      });

    return () => {
      cancelled = true;
    };
  }, [retryKey, router]);

  if (!error) return <HomeResolverSkeleton />;

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#FCFCFC] px-5 font-body text-slate-900">
      <section className="w-full max-w-lg border-y border-slate-200 py-10">
        <p className="text-sm font-semibold text-slate-500">Dashboard unavailable</p>
        <h1 className="mt-3 font-display text-4xl leading-tight">Your account is still signed in.</h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">{error}</p>
        <button
          type="button"
          onClick={() => setRetryKey((value) => value + 1)}
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
        >
          <RotateCw className="h-4 w-4" aria-hidden="true" />
          Retry
        </button>
      </section>
    </main>
  );
}
