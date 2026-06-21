"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, setToken, getToken } from '@/services/api';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { getRandomAvatar, AvatarData } from '@/lib/avatars';

export default function LoginPage() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [avatar, setAvatar] = useState<AvatarData | null>(null);
  const router = useRouter();

  useEffect(() => {
    setAvatar(getRandomAvatar());
    // Already signed in? Don't show login again (e.g. landing here via back) —
    // forward to the app so the session stays alive instead of dead-ending.
    if (getToken()) router.replace('/dashboard');
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, password }),
      });
      
      setToken(data.access_token);
      // replace (not push) so login is NOT left in history — otherwise browser
      // back lands the learner straight back on login. Returning learners land on
      // their dashboard; onboarding is for new sign-ups (register).
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white text-slate-900 overflow-hidden">
      {/* Left Panel: Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-24 xl:px-32 relative z-10">
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

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="group relative">
              <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-2 transition-colors group-focus-within:text-slate-900">
                Username
              </label>
              <input
                type="text"
                value={userId}
                onChange={e => setUserId(e.target.value)}
                placeholder="e.g., asha_r"
                autoComplete="username"
                className="w-full bg-white border border-slate-200 rounded-xl px-5 py-4 text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-slate-400 focus:shadow-sm transition-all text-sm"
                required
              />
            </div>
            
            <div className="group relative">
              <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-2 transition-colors group-focus-within:text-slate-900">
                Password
              </label>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-slate-200 rounded-xl px-5 py-4 text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-slate-400 focus:shadow-sm transition-all font-mono text-sm"
                required 
              />
            </div>
            
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full mt-4 bg-slate-900 text-white rounded-xl px-5 py-4 flex items-center justify-center gap-3 text-sm font-bold uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50 disabled:pointer-events-none group"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-slate-200">
            <p className="text-slate-500 text-sm">
              Don't have an account?{' '}
              <Link href="/auth/register" className="text-slate-900 font-medium hover:underline underline-offset-4 transition-all">
                Create one
              </Link>
            </p>
          </div>
        </motion.div>
      </div>

      {/* Right Panel: Visual World */}
      <div className="hidden lg:flex w-1/2 relative items-center justify-center overflow-hidden p-8">
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
                   src={avatar.url} 
                   alt={`${avatar.id} 3D Avatar`}
                   fill
                   sizes="(max-width: 1024px) 50vw, 33vw"
                   className="object-contain object-bottom drop-shadow-2xl"
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
