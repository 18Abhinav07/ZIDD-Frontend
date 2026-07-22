"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { AVATAR_PATHS, getAvatarScaleClass } from '@/lib/avatarRegistry';
import {
  getToonHubAvatarPath,
  TOONHUB_AVATAR_PATHS,
  TOONHUB_INITIAL_AVATAR_PATH,
} from '@/lib/landingAssets';

import { motion } from 'framer-motion';

const IMAGES = [
  { 
    src: AVATAR_PATHS.coach_pink, 
    bg: '#DB2777', 
    panel: '#F472B6',
    label: 'THE EMPATH',
    bgWord: 'REWIRE',
    desc: 'Calibrate your emotional intelligence. Learn to read subtext, de-escalate tension, and build authentic connections even in the most high-stakes, adversarial environments.'
  },
  { 
    src: AVATAR_PATHS.coach_orange, 
    bg: '#C2410C', 
    panel: '#EA580C',
    label: 'THE MAVERICK',
    bgWord: 'YOUR',
    desc: 'Embrace bold, unconventional communication. Break the rules of standard corporate speak to deliver highly memorable, high-impact statements that refuse to be ignored.'
  },
  { 
    src: AVATAR_PATHS.coach_green, 
    bg: '#15803D', 
    panel: '#16A34A',
    label: 'THE NEGOTIATOR',
    bgWord: 'MIND',
    desc: 'Master the psychology of leverage. Practice anchoring, strategic silence, and rapid compromise framing to walk out of every conversation with the upper hand.'
  },
  { 
    src: AVATAR_PATHS.coach_blue, 
    bg: '#1D4ED8', 
    panel: '#2563EB',
    label: 'THE VISIONARY',
    bgWord: 'MASTER',
    desc: 'Elevate your pitch. Train to articulate massive, abstract concepts with crystal clarity, inspiring buy-in from skeptics and turning ideas into immediate action.'
  },
  { 
    src: AVATAR_PATHS.casual_male, 
    bg: '#D97706', 
    panel: '#F59E0B',
    label: 'THE STRATEGIST',
    bgWord: 'EVERY',
    desc: 'Think three moves ahead. Anticipate objections before they arise and engineer your responses to guide the conversation precisely where you want it to go.'
  },
  { 
    src: AVATAR_PATHS.student_female, 
    bg: '#BE123C', 
    panel: '#E11D48',
    label: 'THE CATALYST',
    bgWord: 'WORD',
    desc: 'Spark immediate momentum. Learn the exact words to cut through bureaucratic stagnation and drive your team from passive listening to urgent execution.'
  },
  { 
    src: AVATAR_PATHS.tech_black, 
    bg: '#0F172A', 
    panel: '#1E293B',
    label: 'THE ARCHITECT',
    bgWord: 'CONQUER',
    desc: 'Structure complex arguments flawlessly. Build unbreakable logical frameworks on the fly, ensuring your ideas are bulletproof against intense scrutiny.'
  },
  { 
    src: AVATAR_PATHS.casual_blue, 
    bg: '#0369A1', 
    panel: '#0284C7',
    label: 'THE MENTOR',
    bgWord: 'ANY',
    desc: 'Guide rather than dictate. Develop the rare ability to deliver critical feedback that inspires growth instead of triggering defensive resistance.'
  },
  { 
    src: AVATAR_PATHS.casual_purple, 
    bg: '#7E22CE', 
    panel: '#9333EA',
    label: 'THE PHILOSOPHER',
    bgWord: 'ROOM',
    desc: 'Question the foundation of every prompt. Challenge underlying assumptions and reframe the entire debate to prove your unshakeable intellectual depth.'
  },
];

export const ToonHub = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [loadedAssets, setLoadedAssets] = useState<Record<string, true>>({});

  const markAssetLoaded = useCallback((src: string) => {
    setLoadedAssets((current) => current[src]
      ? current
      : { ...current, [src]: true });
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    
    const pending = TOONHUB_AVATAR_PATHS.filter((src) => src !== TOONHUB_INITIAL_AVATAR_PATH);
    let cursor = 0;
    let active = true;

    const loadAsset = (src: string) => new Promise<void>((resolve) => {
      const image = new window.Image();
      const settle = () => {
        if (active) markAssetLoaded(src);
        resolve();
      };
      const fail = () => resolve();
      image.addEventListener('load', settle, { once: true });
      image.addEventListener('error', fail, { once: true });
      image.src = src;
      if (image.complete) {
        if (image.naturalWidth > 0) settle();
        else fail();
      }
    });

    const preloadWorker = async () => {
      while (active) {
        const src = pending[cursor];
        cursor += 1;
        if (!src) return;
        await loadAsset(src);
      }
    };

    // Two workers avoid starving the hero video while still warming the next
    // portraits before the carousel is allowed to navigate to them.
    void Promise.all([preloadWorker(), preloadWorker()]);

    return () => {
      active = false;
      window.removeEventListener('resize', handleResize);
    };
  }, [markAssetLoaded]);

  const targetIndex = useCallback((direction: 'next' | 'prev') => (
    direction === 'next'
      ? (activeIndex + 1) % IMAGES.length
      : (activeIndex + IMAGES.length - 1) % IMAGES.length
  ), [activeIndex]);

  const canNavigate = useCallback((direction: 'next' | 'prev') => (
    Boolean(loadedAssets[getToonHubAvatarPath(IMAGES[targetIndex(direction)].src)])
  ), [loadedAssets, targetIndex]);

  const navigate = useCallback((direction: 'next' | 'prev') => {
    const nextIndex = targetIndex(direction);
    const nextAsset = getToonHubAvatarPath(IMAGES[nextIndex].src);
    if (isAnimating || !loadedAssets[nextAsset]) return;
    setIsAnimating(true);
    setActiveIndex(nextIndex);

    setTimeout(() => setIsAnimating(false), 650);
  }, [isAnimating, loadedAssets, targetIndex]);

  // Auto-play feature
  useEffect(() => {
    const timer = setInterval(() => {
      navigate('next');
    }, 3000);
    return () => clearInterval(timer);
  }, [navigate]);

  const getRole = (index: number) => {
    if (index === activeIndex) return 'center';
    if (index === (activeIndex + 8) % 9) return 'left';
    if (index === (activeIndex + 1) % 9) return 'right';
    return 'back';
  };

  const getRoleStyles = (role: string) => {
    switch (role) {
      case 'center':
        return {
          transform: `translateX(-50%) scale(${isMobile ? 1.25 : 1.68})`,
          filter: 'blur(0px)',
          opacity: 1,
          zIndex: 20,
          left: '50%',
          height: isMobile ? '60%' : '92%',
          bottom: isMobile ? '22%' : '0',
        };
      case 'left':
        return {
          transform: `translateX(-50%) scale(1)`,
          filter: 'blur(2px)',
          opacity: 0.85,
          zIndex: 10,
          left: isMobile ? '20%' : '30%',
          height: isMobile ? '16%' : '28%',
          bottom: isMobile ? '32%' : '12%',
        };
      case 'right':
        return {
          transform: `translateX(-50%) scale(1)`,
          filter: 'blur(2px)',
          opacity: 0.85,
          zIndex: 10,
          left: isMobile ? '80%' : '70%',
          height: isMobile ? '16%' : '28%',
          bottom: isMobile ? '32%' : '12%',
        };
      case 'back':
      default:
        return {
          transform: `translateX(-50%) scale(1)`,
          filter: 'blur(4px)',
          opacity: 1,
          zIndex: 5,
          left: '50%',
          height: isMobile ? '13%' : '22%',
          bottom: isMobile ? '32%' : '12%',
        };
    }
  };

  return (
    <div 
      className="relative w-full h-screen overflow-hidden transition-colors duration-[650ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
      style={{ backgroundColor: IMAGES[activeIndex].bg }}
    >
      <div className="grain-overlay" />
      
      {/* Ghost Text */}
      <motion.div 
        key={`bgword-${activeIndex}`}
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: false, amount: 0.1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="absolute w-full flex items-center justify-center pointer-events-none select-none z-[2] top-[18%] overflow-hidden"
      >
        <h2 
          className="font-hero leading-[0.8] uppercase tracking-tighter whitespace-nowrap text-white opacity-90"
          style={{ fontSize: 'clamp(120px, 22vw, 400px)', fontWeight: 900 }}
        >
          {IMAGES[activeIndex].bgWord}
        </h2>
      </motion.div>

      {/* Brand Label */}
      <div className="absolute top-6 left-4 sm:left-8 z-[60] text-xs font-semibold uppercase text-white opacity-90 tracking-[0.18em]">
        ZIDD TOONHUB
      </div>

      {/* Carousel */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.8, y: 100 }}
        whileInView={{ opacity: 1, scale: 1, y: 0 }}
        viewport={{ once: false, amount: 0.1 }}
        transition={{ duration: 0.8, delay: 0.4, type: "spring" }}
        className="absolute inset-0 z-[3]"
      >
        {IMAGES.map((img, idx) => {
          const role = getRole(idx);
          const styles = getRoleStyles(role);
          
          return (
            <div
              key={idx}
              className="absolute transition-all duration-[650ms] ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[transform,filter,opacity]"
              style={{ ...styles, aspectRatio: '0.6 / 1' }}
            >
              <Image
                src={getToonHubAvatarPath(img.src)}
                alt={img.label}
                fill
                sizes="(max-width: 768px) 70vw, 40vw"
                priority={idx === activeIndex}
                unoptimized
                onLoad={() => markAssetLoaded(getToonHubAvatarPath(img.src))}
                className={`object-contain object-bottom pointer-events-none select-none ${getAvatarScaleClass(img.src)}`}
                draggable={false}
              />
            </div>
          );
        })}
      </motion.div>

      {/* Navigation & Copy */}
      <motion.div 
        initial={{ opacity: 0, x: -50 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: false, amount: 0.1 }}
        transition={{ duration: 0.8, delay: 0.6, type: "spring" }}
        className="absolute bottom-6 left-4 sm:bottom-20 sm:left-24 z-[60] max-w-[320px]"
      >
        <h3 className="text-white opacity-95 font-bold uppercase tracking-[0.02em] mb-2 sm:mb-3 text-base sm:text-[22px]">
          {IMAGES[activeIndex].label}
        </h3>
        <motion.p 
          key={`desc-${activeIndex}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="hidden sm:block text-[13px] sm:text-[15px] text-white opacity-85 leading-[1.7] mb-6 sm:mb-8 font-medium"
        >
          {IMAGES[activeIndex].desc}
        </motion.p>
        
        <div className="flex gap-4">
          <button 
            onClick={() => navigate('prev')}
            className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center rounded-full border-2 border-white text-white transition-all hover:scale-[1.08] hover:bg-white/10 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isAnimating || !canNavigate('prev')}
          >
            <ArrowLeft size={isMobile ? 22 : 26} strokeWidth={2.25} />
          </button>
          <button 
            onClick={() => navigate('next')}
            className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center rounded-full border-2 border-white text-white transition-all hover:scale-[1.08] hover:bg-white/10 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isAnimating || !canNavigate('next')}
          >
            <ArrowRight size={isMobile ? 22 : 26} strokeWidth={2.25} />
          </button>
        </div>
      </motion.div>

      {/* Discover Link */}
      <motion.div 
        initial={{ opacity: 0, x: 50 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: false, amount: 0.1 }}
        transition={{ duration: 0.8, delay: 0.7, type: "spring" }}
        className="absolute bottom-6 right-4 sm:bottom-20 sm:right-10 z-[60]"
      >
        <a 
          href="/auth/login" 
          className="flex items-center gap-2 font-anton text-white opacity-95 hover:opacity-100 transition-opacity uppercase tracking-[-0.02em] leading-none"
          style={{ fontSize: 'clamp(20px, 4vw, 56px)' }}
        >
          BEGIN JOURNEY
          <ArrowRight className="w-5 h-5 sm:w-8 sm:h-8" strokeWidth={2.25} />
        </a>
      </motion.div>
    </div>
  );
};
