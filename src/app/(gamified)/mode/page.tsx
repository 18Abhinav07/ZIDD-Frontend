"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { ExitIcon } from '@radix-ui/react-icons';
import { getToken, clearToken } from '@/services/api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getRandomAvatar, type AvatarData } from '@/lib/avatars';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function ModeSelectionPage() {
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState<'prep' | 'test' | null>(null);
  const [avatars, setAvatars] = useState<AvatarData[]>([]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/auth/login');
      return;
    }
    const a1 = getRandomAvatar();
    let a2 = getRandomAvatar();
    while (a2.id === a1.id) { a2 = getRandomAvatar(); }
    setAvatars([a1, a2]);
  }, [router]);

  const handleSelectMode = (mode: 'prep' | 'test') => {
    setSelectedMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('zidd_test_mode', mode === 'test' ? 'true' : 'false');
      const pending = localStorage.getItem('zidd_pending_module');
      if (pending) {
        localStorage.setItem('zidd_active_module', pending);
        localStorage.removeItem('zidd_pending_module');
      }
    }
    setTimeout(() => {
      router.replace('/map');
    }, 600);
  };

  return (
    <div className="min-h-[100dvh] bg-[#FCFCFC] text-slate-900 font-body relative overflow-hidden flex flex-col">
      {/* Header */}
      <header className="relative z-50 px-8 py-6 flex items-center justify-between">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors"
        >
          <ChevronLeft size={16} />
          Switch Module
        </button>
        <button onClick={() => router.push('/dashboard')} className="font-sans font-black text-2xl tracking-tighter text-slate-900">ZIDD<span className="text-indigo-600">.</span></button>
        <button
          onClick={() => { clearToken(); router.replace('/auth/login'); }}
          title="Sign out"
          className="w-9 h-9 rounded-full bg-slate-50 border border-slate-200 shadow-sm text-slate-500 flex items-center justify-center hover:bg-slate-100 hover:text-red-500 transition-all hover:scale-105 active:scale-95"
        >
          <ExitIcon className="w-4 h-4" />
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 relative z-10 flex flex-col items-center justify-center px-6 pb-20">
        
        <div className="text-center mb-16 animate-fade-rise">
          <h1 className="text-4xl md:text-5xl font-display text-slate-900 mb-4 tracking-tight">Select your environment</h1>
          <p className="text-slate-500 max-w-lg mx-auto text-lg">
            Do you want a relaxed coaching space to practice, or a high-stakes simulation to test your skills?
          </p>
        </div>

        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          
          {avatars.length > 0 && (
            <>
              {/* Preparation Mode */}
              <motion.button
                whileHover={{ scale: selectedMode === null ? 1.02 : 1 }}
                whileTap={{ scale: selectedMode === null ? 0.98 : 1 }}
                onClick={() => handleSelectMode('prep')}
                disabled={selectedMode !== null}
                className={cn(
                  "relative group flex flex-col items-center text-left transition-all duration-700 ease-out",
                  selectedMode === 'test' ? "opacity-30 grayscale scale-95 blur-sm" : "opacity-100",
                  selectedMode === 'prep' ? "scale-105 z-20" : ""
                )}
              >
                <div 
                  className="w-full h-[500px] md:h-[560px] rounded-[3rem] overflow-hidden relative transition-shadow duration-500"
                  style={{ backgroundColor: avatars[0].bg, boxShadow: `0 20px 40px ${avatars[0].bg}33` }}
                >
                  <div className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22 opacity=%220.5%22/%3E%3C/svg%3E")' }} />
                  
                  <div className="absolute -bottom-10 right-0 w-72 md:w-96 h-[120%] z-0 pointer-events-none transition-transform duration-[800ms] ease-out group-hover:scale-[1.03]">
                    <Image 
                      src={avatars[0].url}
                      alt="Preparation Mode Avatar"
                      fill
                      sizes="(max-width: 768px) 288px, 384px"
                      className="object-contain object-bottom drop-shadow-[0_20px_40px_rgba(0,0,0,0.3)]"
                      unoptimized
                    />
                  </div>

                  <div className="absolute top-8 left-8">
                    <span 
                      className="px-4 py-2 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg"
                      style={{ color: avatars[0].bg }}
                    >
                      Low Stakes
                    </span>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-8 md:p-10 pt-32 z-10 flex flex-col items-start text-left"
                       style={{ background: `linear-gradient(to top, ${avatars[0].bg}, ${avatars[0].bg}CC, transparent)` }}>
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 drop-shadow-sm">Preparation Phase</h2>
                    <p className="text-white/95 leading-relaxed font-medium drop-shadow-sm max-w-[280px] md:max-w-xs text-sm md:text-base">
                      A warm, welcoming environment. The AI acts as your coach, guiding you through the module, offering gentle feedback, and helping you build confidence.
                    </p>
                  </div>
                </div>
              </motion.button>

              {/* Test Mode */}
              <motion.button
                whileHover={{ scale: selectedMode === null ? 1.02 : 1 }}
                whileTap={{ scale: selectedMode === null ? 0.98 : 1 }}
                onClick={() => handleSelectMode('test')}
                disabled={selectedMode !== null}
                className={cn(
                  "relative group flex flex-col items-center text-left transition-all duration-700 ease-out",
                  selectedMode === 'prep' ? "opacity-30 grayscale scale-95 blur-sm" : "opacity-100",
                  selectedMode === 'test' ? "scale-105 z-20" : ""
                )}
              >
                <div 
                  className="w-full h-[500px] md:h-[560px] rounded-[3rem] overflow-hidden relative transition-shadow duration-500"
                  style={{ backgroundColor: avatars[1].bg, boxShadow: `0 20px 40px ${avatars[1].bg}33` }}
                >
                  <div className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22 opacity=%220.5%22/%3E%3C/svg%3E")' }} />
                  
                  <div className="absolute -bottom-10 right-0 w-72 md:w-96 h-[120%] z-0 pointer-events-none transition-transform duration-[800ms] ease-out group-hover:scale-[1.03]">
                    <Image 
                      src={avatars[1].url}
                      alt="Test Mode Avatar"
                      fill
                      sizes="(max-width: 768px) 288px, 384px"
                      className="object-contain object-bottom drop-shadow-[0_20px_40px_rgba(0,0,0,0.3)] scale-[1.25] origin-bottom"
                      unoptimized
                    />
                  </div>

                  <div className="absolute top-8 left-8">
                    <span 
                      className="px-4 py-2 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg"
                      style={{ color: avatars[1].bg }}
                    >
                      High Stakes
                    </span>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-8 md:p-10 pt-32 z-10 flex flex-col items-start text-left"
                       style={{ background: `linear-gradient(to top, ${avatars[1].bg}, ${avatars[1].bg}CC, transparent)` }}>
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 drop-shadow-sm">Test Phase</h2>
                    <p className="text-white/95 leading-relaxed font-medium drop-shadow-sm max-w-[280px] md:max-w-xs text-sm md:text-base">
                      A sharp, determined environment. Strict evaluation, realistic tension, and no hand-holding. Show us what you've learned.
                    </p>
                  </div>
                </div>
              </motion.button>
            </>
          )}

        </div>
      </main>
    </div>
  );
}
