"use client";

import { Loader2 } from 'lucide-react';

function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`rounded-full bg-slate-200/80 animate-pulse ${className}`} />;
}

function SkeletonCard({ className = '' }: { className?: string }) {
  return <div className={`rounded-[1.75rem] border border-slate-200/70 bg-white/80 shadow-sm animate-pulse ${className}`} />;
}

export function HomeResolverSkeleton() {
  return (
    <div className="min-h-[100dvh] bg-[#FCFCFC] text-slate-900 px-6 lg:px-12 pt-28">
      <div className="mx-auto max-w-[1100px]">
        <div className="flex items-center gap-3 text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Resolving home
        </div>
        <div className="mt-8 space-y-4">
          <SkeletonLine className="h-12 w-72 max-w-full" />
          <SkeletonLine className="h-4 w-[32rem] max-w-full" />
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-5">
          <SkeletonCard className="h-64" />
          <SkeletonCard className="h-64" />
        </div>
      </div>
    </div>
  );
}

export function CareerHomeSkeleton() {
  return (
    <main className="relative z-10 max-w-[1100px] mx-auto px-6 lg:px-12 pt-28 pb-24">
      <SkeletonLine className="h-3 w-24" />
      <SkeletonLine className="mt-5 h-14 w-80 max-w-full" />
      <SkeletonLine className="mt-4 h-4 w-[34rem] max-w-full" />
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SkeletonCard className="h-24" />
        <SkeletonCard className="h-24" />
        <SkeletonCard className="h-24" />
      </div>
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
        <SkeletonCard className="h-[350px] rounded-[3rem]" />
        <SkeletonCard className="h-[350px] rounded-[3rem]" />
      </div>
    </main>
  );
}

export function PathMapSkeleton({ label = 'Preparing path' }: { label?: string }) {
  return (
    <main className="pt-28 pb-32 relative z-10 min-h-[100dvh]">
      <div className="max-w-[1000px] mx-auto px-6 lg:px-12">
        <div className="flex items-center gap-3 text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">
          <Loader2 className="h-4 w-4 animate-spin" />
          {label}
        </div>
        <SkeletonLine className="mt-6 h-10 w-72 max-w-full" />
        <SkeletonLine className="mt-3 h-4 w-[30rem] max-w-full" />
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard
              key={i}
              className={`h-32 ${i % 3 === 1 ? 'md:mt-12' : i % 3 === 2 ? 'md:mt-24' : ''}`}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

export function ModeCommitSkeleton({ mode }: { mode: 'prep' | 'test' }) {
  return (
    <div className="min-h-[100dvh] bg-[#FCFCFC] text-slate-900 px-6 py-24 flex items-center justify-center">
      <div className="w-full max-w-3xl">
        <div className="flex items-center gap-3 text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving {mode === 'prep' ? 'preparation' : 'test'} mode
        </div>
        <div className="mt-8 rounded-[2rem] border border-slate-200/70 bg-white p-7 shadow-sm">
          <SkeletonLine className="h-9 w-72 max-w-full" />
          <SkeletonLine className="mt-4 h-4 w-full" />
          <SkeletonLine className="mt-3 h-4 w-2/3" />
          <div className="mt-8 grid grid-cols-3 gap-3">
            <SkeletonCard className="h-24" />
            <SkeletonCard className="h-24" />
            <SkeletonCard className="h-24" />
          </div>
        </div>
      </div>
    </div>
  );
}
