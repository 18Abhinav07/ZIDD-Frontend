import Link from 'next/link';

// Branded root 404 (replaces Next's bare default). Any unknown path — e.g. a
// stale /nope link — lands here with the Zidd mark and a clear way back in.
export default function NotFound() {
  return (
    <div className="min-h-[100dvh] bg-[#FCFCFC] text-slate-900 flex flex-col items-center justify-center px-6 text-center font-body">
      <span className="font-sans font-black text-3xl tracking-tighter text-slate-900 mb-10">
        ZIDD<span className="text-indigo-600">.</span>
      </span>
      <p className="text-[11px] uppercase tracking-[0.3em] font-black text-slate-400 mb-4">
        Error 404
      </p>
      <h1 className="font-display text-4xl sm:text-5xl tracking-tight mb-4">
        This page wandered off
      </h1>
      <p className="text-slate-500 leading-relaxed max-w-md mb-10">
        The link you followed doesn&apos;t lead anywhere. Let&apos;s get you back
        to where the learning happens.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/map"
          className="px-7 py-3.5 bg-slate-900 text-white rounded-full font-bold uppercase tracking-widest text-xs hover:bg-slate-800 transition-colors"
        >
          Go to my map
        </Link>
        <Link
          href="/"
          className="px-7 py-3.5 bg-white border border-slate-200 text-slate-700 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-slate-50 transition-colors"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
