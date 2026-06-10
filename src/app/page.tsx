"use client";

import React, { useRef } from 'react';
import Image from 'next/image';
import { ToonHub } from '@/components/shared/ToonHub';
import { ArrowRight } from 'lucide-react';
import { AVATAR_PATHS, needsPaddingCompensation, getAvatarScaleClass } from "@/lib/avatarRegistry";
import { motion, useInView } from 'framer-motion';
import { SmoothScroll } from '@/components/shared/SmoothScroll';

export default function LandingPage() {
  const footerTriggerRef = useRef(null);
  const isFooterVisible = useInView(footerTriggerRef, { once: false, amount: 0.1 });

  const avatarVariants: any = {
    hidden: (i: number) => ({
      x: i < 4 ? -100 - (4 - i) * 50 : i === 4 ? 0 : 100 + (i - 4) * 50,
      opacity: 0,
    }),
    visible: (i: number) => ({
      x: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 60,
        damping: 15,
        delay: (4 - Math.abs(4 - i)) * 0.1
      }
    })
  };

  const logoVariants: any = {
    hidden: { y: 200, opacity: 0, scale: 0.8 },
    visible: { 
      y: 0, 
      opacity: 1, 
      scale: 1,
      transition: { 
        delay: 0.4, 
        duration: 1.2, 
        ease: [0.16, 1, 0.3, 1] 
      } 
    }
  };

  return (
    <SmoothScroll>
      <main className="relative bg-slate-950 selection:bg-accent selection:text-white">
        
      {/* Foreground Content Layer */}
      <div className="relative z-10 bg-[#FCFCFC] rounded-b-[2.5rem] md:rounded-b-[4rem] shadow-[0_30px_80px_rgba(0,0,0,0.6)] mb-[85vh] overflow-x-hidden">
        
      {/* Navigation Layer */}
      <div className="fixed top-0 inset-x-0 z-50 bg-white/70 supports-[backdrop-filter]:bg-white/50 backdrop-blur-2xl border-b border-slate-200/40 transition-all duration-300">
        <nav className="px-6 md:px-12 py-5 max-w-[1400px] mx-auto flex justify-between items-center">
          <div className="flex items-baseline w-32">
            <span className="font-hero font-black text-2xl tracking-tighter text-slate-900 antialiased">ZIDD<span className="text-accent">.</span></span>
          </div>
          <div className="hidden md:flex flex-1 justify-center gap-12 items-center text-[10px] font-bold tracking-[0.25em] uppercase text-slate-400">
            <a href="#" className="hover:text-slate-900 transition-colors duration-300">Platform</a>
            <a href="#" className="hover:text-slate-900 transition-colors duration-300">Methodology</a>
            <a href="#" className="hover:text-slate-900 transition-colors duration-300">Pricing</a>
          </div>
          <div className="w-32 flex justify-end">
            <a 
              href="/auth/login" 
              className="group relative flex items-center justify-center bg-slate-900 rounded-full px-7 py-2.5 overflow-hidden transition-all duration-300 hover:shadow-[0_8px_20px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 active:translate-y-0 border border-transparent hover:border-slate-700"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-slate-800 to-slate-900 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative z-10 text-[10px] text-white font-bold tracking-[0.2em] uppercase">BEGIN</span>
            </a>
          </div>
        </nav>
      </div>

      {/* 1. Editorial Hero */}
      <section className="relative pt-40 pb-24 md:pt-52 md:pb-32 px-6 md:px-12 max-w-[1400px] mx-auto flex flex-col lg:flex-row items-center justify-between gap-16 lg:gap-24 min-h-[90vh]">
        
        {/* Left: Typography */}
        <div className="flex-1 max-w-2xl relative z-10 w-full animate-fade-rise">
          <h1 className="text-[4.5rem] md:text-[5.5rem] lg:text-[6.5rem] leading-[0.85] tracking-[-0.04em] font-display font-normal text-slate-900">
            Education that <br />
            <em className="not-italic text-slate-400">adapts to</em><br />
            your mind.
          </h1>
          <p className="text-slate-600 text-[15px] md:text-[17px] max-w-xl mt-8 leading-[1.8] font-body font-medium">
            Zidd is a hyper-personalized AI growth platform. It abandons static curriculums to actively monitor, build, and optimize your learning path. It catches what you forget, binds loose concepts, and engineers a holistic environment catered exclusively to your personal evolution.
          </p>
          <div className="mt-14 flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <a 
              href="/auth/login" 
              className="bg-slate-900 rounded-full px-8 py-4 text-sm text-white hover:scale-[1.02] hover:bg-slate-800 transition-all cursor-pointer font-bold tracking-widest shadow-xl flex items-center gap-3"
            >
              LAUNCH STUDIO
              <ArrowRight className="w-4 h-4" />
            </a>
            <button 
              onClick={() => {
                document.getElementById('carousel')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-[0.2em] px-4 py-4"
            >
              Discover Tutors
            </button>
          </div>
        </div>

        {/* Right: Media Frame */}
        <div className="flex-1 w-full max-w-xl relative animate-fade-rise-delay">
          <div className="relative aspect-[4/5] rounded-[2rem] overflow-hidden bg-slate-100 shadow-2xl ring-1 ring-inset ring-slate-900/5">
            {/* Background Video */}
            <video
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover scale-105"
            >
              <source 
                src="/Zidd-hero.mp4" 
                type="video/mp4" 
              />
            </video>
            {/* Inner subtle shadow for physical depth */}
            <div className="absolute inset-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)] rounded-[2rem] pointer-events-none" />
          </div>
        </div>
      </section>

      {/* 2. TOONHUB Carousel Section */}
      <section id="carousel" className="relative h-screen w-full">
        <ToonHub />
      </section>

      {/* 3. CTA */}
      <section className="relative py-32 md:py-40 bg-[#FCFCFC] flex flex-col items-center text-center px-6">
        <div className="max-w-3xl flex flex-col items-center animate-fade-rise">
          <h2 className="text-5xl sm:text-7xl font-display mb-8 tracking-[-0.03em] text-slate-900 leading-[0.9]">
            Ready to rewrite <br/>
            <em className="not-italic text-slate-400">your limits?</em>
          </h2>
          <p className="text-slate-500 text-[15px] md:text-[17px] mb-12 max-w-xl mx-auto leading-[1.8] font-medium">
            Experience an AI protocol that strengthens your critical thinking, refines your communication, and continuously adapts to challenge your true potential.
          </p>
          <a 
            href="/auth/login" 
            className="inline-flex items-center gap-3 bg-slate-900 text-white px-10 py-5 rounded-full text-sm font-bold hover:scale-[1.02] hover:bg-slate-800 transition-all shadow-2xl tracking-widest uppercase"
          >
            START TRAINING
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>
      
      {/* Trigger for Footer Animation */}
      <div ref={footerTriggerRef} className="absolute bottom-0 w-full h-[15vh] pointer-events-none" />
      </div> {/* End of Foreground Content Layer */}

      {/* Reveal Footer */}
      <footer className="fixed bottom-0 inset-x-0 h-[85vh] w-full flex flex-col items-center justify-end overflow-hidden z-0 bg-slate-950 text-white">
        {/* Decorative subtle noise */}
        <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22 opacity=%220.5%22/%3E%3C/svg%3E')] pointer-events-none mix-blend-overlay" />
        
        <div className="relative w-full flex flex-col items-center flex-1 justify-end pt-20">
          
          {/* Hero ZIDD Text */}
          <motion.h2 
            initial="hidden"
            animate={isFooterVisible ? "visible" : "hidden"}
            variants={logoVariants}
            className="font-hero text-[22vw] leading-[0.8] tracking-tighter font-black antialiased text-white -mb-[4vw] relative z-0 mix-blend-screen drop-shadow-2xl uppercase"
          >
            ZIDD
          </motion.h2>
          
          {/* Avatar Group */}
          <div className="relative z-10 w-full max-w-6xl mx-auto -mb-8 px-4 pointer-events-auto">
            <div className="flex justify-center items-end">
              {[
                AVATAR_PATHS.casual_male,
                AVATAR_PATHS.casual_female,
                AVATAR_PATHS.tech_black,
                AVATAR_PATHS.coach_pink,
                AVATAR_PATHS.coach_orange,
                AVATAR_PATHS.coach_green,
                AVATAR_PATHS.coach_blue,
                AVATAR_PATHS.casual_blue,
                AVATAR_PATHS.casual_purple,
              ].map((avatarSrc, i) => (
                <motion.div 
                  key={i} 
                  custom={i}
                  initial="hidden"
                  animate={isFooterVisible ? "visible" : "hidden"}
                  variants={avatarVariants}
                  className="relative group w-[30vw] h-[30vh] sm:w-[20vw] sm:h-[40vh] md:w-[15vw] md:h-[45vh] hover:-translate-y-6 hover:scale-[1.05] cursor-pointer" 
                  style={{ marginLeft: i === 0 ? 0 : '-7vw', zIndex: i }}
                  onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.zIndex = '50'}
                  onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.zIndex = i.toString()}
                >
                  <Image 
                    src={avatarSrc}
                    alt={`Avatar ${i}`}
                    fill
                    sizes="(max-width: 768px) 60vw, 300px"
                    className={`object-contain object-bottom drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)] transition-transform duration-700 ease-out group-hover:drop-shadow-[0_30px_50px_rgba(0,0,0,0.7)] ${getAvatarScaleClass(avatarSrc)} ${needsPaddingCompensation(avatarSrc) ? 'group-hover:scale-[1.4]' : 'group-hover:scale-[1.05]'}`}
                    unoptimized
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Footer Utilities */}
        <div className="absolute bottom-6 w-full max-w-[1400px] mx-auto px-8 flex justify-between items-center text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] z-20 pointer-events-auto">
          <span className="hover:text-white transition-colors cursor-default">ZIDD STUDIO © 2026</span>
          <div className="flex gap-8">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </footer>
      </main>
    </SmoothScroll>
  );
}
