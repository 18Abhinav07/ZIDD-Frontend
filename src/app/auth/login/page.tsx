"use client";

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { getRandomAvatar, AvatarData } from '@/lib/avatars';
import { getAvatarDisplayPath, getAvatarScaleClass, preloadAvatarDisplayAssets } from '@/lib/avatarRegistry';
import { waitForBackendReady, warmBackend } from '@/lib/backendReadiness';
import { learnerSafeErrorMessage } from '@/lib/errorCopy';
import { getMe, homeForMe } from '@/services/me';
import { ZiddLoaderOverlay } from '@/components/shared/ZiddLoaderOverlay';

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.78-2.4 3.63v3.02h3.88c2.27-2.09 3.57-5.17 3.57-8.84z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3.02c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.12C3.25 21.3 7.31 24 12 24z"/>
      <path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54V6.61H1.27a12 12 0 0 0 0 10.78l4-3.12z"/>
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.61l4 3.12C6.22 6.86 8.87 4.75 12 4.75z"/>
    </svg>
  );
}

function safePostSignInDestination(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/auth/')) {
    return '/dashboard';
  }
  return value;
}

function LoginContent() {
  const [loadingAction, setLoadingAction] = useState<'account' | 'google' | null>(null);
  const [routing, setRouting] = useState(false);
  const [error, setError] = useState('');
  const [avatar, setAvatar] = useState<AvatarData | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  useEffect(() => {
    setAvatar(getRandomAvatar());
    preloadAvatarDisplayAssets();
    void warmBackend();
  }, []);

  useEffect(() => {
    if (searchParams.get('error')) {
      setError('Sign-in could not be completed. Please choose your Google account and try again.');
    }
  }, [searchParams]);

  const handleExistingAccountContinue = async () => {
    setError('');
    setLoadingAction('account');
    setRouting(true);
    try {
      await waitForBackendReady();
      const me = await getMe();
      router.replace(homeForMe(me));
    } catch (err: unknown) {
      if (!(err instanceof Error && err.message === 'Unauthorized')) {
        setError(learnerSafeErrorMessage(err, 'We could not open your account. Please try again.'));
      }
    } finally {
      setLoadingAction(null);
      setRouting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoadingAction('google');
    try {
      await waitForBackendReady();
      await signIn(
        'google',
        { callbackUrl: safePostSignInDestination(searchParams.get('callbackUrl')) },
        existingUser ? { prompt: 'select_account' } : undefined,
      );
    } catch (err: unknown) {
      setError(learnerSafeErrorMessage(err, 'Sign-in failed. Please try again.'));
      setLoadingAction(null);
    }
  };

  // A broken or stale passive session check must never prevent the learner
  // from starting a fresh Google sign-in to recover their account.
  const busy = Boolean(loadingAction) || routing;
  const existingUser = status === 'authenticated' ? session?.user : null;
  const initials = (existingUser?.name || existingUser?.email || 'Z')
    .trim()
    .slice(0, 1)
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-white text-slate-900 overflow-hidden">
      {busy && <ZiddLoaderOverlay label="Preparing Zidd" />}
      {/* Left Panel: Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-24 xl:px-32 relative z-30">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          <div className="mb-12">
            <Link href="/" className="inline-block mb-16 opacity-90 hover:opacity-100 transition-opacity">
              <span className="font-sans font-black text-3xl tracking-tighter text-slate-900">ZIDD.</span>
            </Link>
            <h1 className="font-display text-5xl sm:text-6xl tracking-tight mb-4 leading-none text-slate-900">Welcome Back</h1>
            <p className="text-slate-500 text-sm tracking-wide uppercase font-semibold">
              Continue your journey with Zidd
            </p>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-8 text-sm font-semibold"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {existingUser && (
            <button
              type="button"
              onClick={handleExistingAccountContinue}
              disabled={busy}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition-all hover:border-slate-300 hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:pointer-events-none"
            >
              <div className="flex items-center gap-4">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-900 text-white">
                  {existingUser.image ? (
                    <Image
                      src={existingUser.image}
                      alt={existingUser.name || existingUser.email || 'Google account'}
                      fill
                      sizes="48px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-sm font-black">
                      {initials}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                    Continue as
                  </p>
                  <p className="mt-1 truncate text-sm font-black text-slate-900">
                    {existingUser.name || 'Google account'}
                  </p>
                  {existingUser.email && (
                    <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
                      {existingUser.email}
                    </p>
                  )}
                </div>
                {loadingAction === 'account' || routing ? (
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-slate-400" />
                ) : (
                  <ArrowRight className="h-5 w-5 shrink-0 text-slate-400" />
                )}
              </div>
            </button>
          )}

          {existingUser && (
            <div className="mt-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">or</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={busy}
            className={`${existingUser ? 'mt-5' : ''} w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-5 py-4 flex items-center justify-center gap-3 text-sm font-bold uppercase tracking-widest hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50 disabled:pointer-events-none`}
          >
            {loadingAction === 'google' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <GoogleIcon />
                Continue with Google
              </>
            )}
          </button>

          <p className="mt-3 text-center text-xs font-medium text-slate-400">
            Choose or add another Google account.
          </p>

          <p className="mt-8 text-center text-slate-400 text-xs">
            By continuing, you agree to Zidd's terms and privacy policy.
          </p>
        </motion.div>
      </div>

      {/* Right Panel: Visual World */}
      <div className="hidden lg:flex w-1/2 relative items-center justify-center overflow-hidden p-8 pointer-events-none">
         <div className="grain-overlay opacity-30 z-10 mix-blend-overlay pointer-events-none" />

         {/* Dynamic Background */}
         <AnimatePresence>
           {avatar && (
             <motion.div
               key={`bg-${avatar.id}`}
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ duration: 0.5 }}
               className="absolute inset-0 z-0"
               style={{ backgroundColor: avatar.bg }}
             />
           )}
         </AnimatePresence>

         {/* Gradient Overlay for depth */}
         <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/10 z-0" />

         {/* Centered Transparent Card with Avatar */}
         <AnimatePresence>
           {avatar && (
             <motion.div
               key={avatar.id}
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               transition={{ duration: 0.5 }}
               className="relative z-20 w-full max-w-lg aspect-[4/5] rounded-[3rem] overflow-hidden flex items-end justify-center"
             >
               <motion.div
                 animate={{ y: [-10, 10, -10] }}
                 transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                 className="relative z-10 w-[90%] h-[105%] mb-[-2%]"
               >
                 <Image
                   src={getAvatarDisplayPath(avatar.url)}
                   alt={`${avatar.id} 3D Avatar`}
                   fill
                   sizes="(max-width: 1024px) 50vw, 33vw"
                   className={`object-contain object-bottom drop-shadow-2xl ${getAvatarScaleClass(avatar.url)}`}
                   draggable={false}
                   priority
                 />
               </motion.div>
             </motion.div>
           )}
         </AnimatePresence>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <LoginContent />
    </Suspense>
  );
}
