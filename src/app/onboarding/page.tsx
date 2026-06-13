"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/services/api';
import { 
  ChevronRight, 
  ChevronLeft,
  Sparkles,
  Target
} from 'lucide-react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { getAvatarForModule, getModuleThemeColor, getAvatarForCharacter } from '@/lib/avatarRegistry';
import { getRandomAvatar, type AvatarData } from '@/lib/avatars';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Module {
  id: string;
  title: string;
  description: string;
  cefr_range?: string;
  grade_range?: string;
  level_count: number;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState('');
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  
  // Placement Data
  const [placementMode, setPlacementMode] = useState<'write' | 'report' | null>(null);
  const [selfReport, setSelfReport] = useState('');
  const [writingSample, setWritingSample] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [moduleAvatars, setModuleAvatars] = useState<Record<string, AvatarData>>({});
  const [placementAvatars, setPlacementAvatars] = useState<AvatarData[]>([]);

  useEffect(() => {
    const fetchModules = async () => {
      try {
        const data = await apiFetch('/modules');
        setModules(data);
        
        const map: Record<string, AvatarData> = {};
        const used = new Set<string>();
        data.forEach((m: Module) => {
          let a = getRandomAvatar();
          while(used.has(a.id) && used.size < 9) {
             a = getRandomAvatar();
          }
          used.add(a.id);
          map[m.id] = a;
        });
        setModuleAvatars(map);
      } catch (err: any) {
        if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
           router.push('/auth/login');
        } else {
           setError('Failed to load modules.');
        }
      }
    };
    fetchModules();
    
    const p1 = getRandomAvatar();
    let p2 = getRandomAvatar();
    while(p2.id === p1.id) p2 = getRandomAvatar();
    setPlacementAvatars([p1, p2]);
  }, [router]);

  const handleNextStep = () => {
    if (!selectedModule) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(2);
      setIsTransitioning(false);
      window.scrollTo(0, 0);
    }, 300);
  };

  const handlePrevStep = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(1);
      setPlacementMode(null);
      setIsTransitioning(false);
      window.scrollTo(0, 0);
    }, 300);
  };

  const handlePlacementSubmit = async () => {
    if (!selectedModule) return;
    setLoading(true);
    setError('');

    try {
      let payload: Record<string, any> = {
        module_id: selectedModule,
        writing_sample: writingSample.trim() || undefined,
      };
      
      const isGrade = modules.find(m => m.id === selectedModule)?.grade_range;
      if (isGrade) {
        payload.grade = selfReport ? parseInt(selfReport, 10) : undefined;
      } else {
        payload.self_report = selfReport || undefined;
      }

      await apiFetch('/onboarding/placement', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (typeof window !== 'undefined') {
        localStorage.setItem('zidd_active_module', selectedModule);
      }

      const isSpecialModule = selectedModule === 'interview' || selectedModule === 'group_discussion';
      if (isSpecialModule) {
        router.push('/mode');
      } else {
        router.push('/map');
      }
    } catch (err: any) {
      setError(err.message || 'Placement failed.');
      setLoading(false);
    }
  };

  const getModuleNumber = (index: number) => {
    return String(index + 1).padStart(2, '0');
  };

  return (
    <div className="min-h-screen bg-[#FCFCFC] text-slate-900 font-body relative overflow-x-hidden flex flex-col">
      {/* Background Decor */}
      {/* Decor self-hosted from /public/avatars (was an external figma.site URL
          that 404'd/aborted in the console on every load). */}
      <div className="fixed -bottom-40 -right-40 w-[800px] h-[800px] opacity-10 pointer-events-none rotate-12 blur-[4px]">
        <Image
          src="/avatars/coach_blue.png"
          alt=""
          aria-hidden="true"
          fill
          sizes="800px"
          className="object-contain"
          unoptimized
        />
      </div>
      <div className="fixed -top-40 -left-40 w-[600px] h-[600px] opacity-[0.05] pointer-events-none -rotate-12 blur-[2px]">
        <Image
          src="/avatars/coach_pink.png"
          alt=""
          aria-hidden="true"
          fill
          sizes="600px"
          className="object-contain"
          unoptimized
        />
      </div>
      
      {/* Header */}
      <header className="relative z-50 px-8 py-6 flex items-center justify-between border-b border-slate-100 bg-white/50 backdrop-blur-xl">
         <div className="font-sans font-black text-2xl tracking-tighter text-slate-900">ZIDD<span className="text-indigo-600">.</span></div>
         <div className="flex gap-2 items-center">
            <div className={cn("w-12 h-1.5 rounded-full transition-colors duration-500", step >= 1 ? "bg-slate-900" : "bg-slate-200")} />
            <div className={cn("w-12 h-1.5 rounded-full transition-colors duration-500", step >= 2 ? "bg-slate-900" : "bg-slate-200")} />
         </div>
      </header>

      <main className="flex-1 relative z-10 px-6 py-12 md:py-20 flex flex-col items-center">
        
        {error && (
          <div className="max-w-md w-full mb-8 bg-red-50 text-red-600 px-6 py-4 rounded-[1.5rem] text-sm font-bold text-center border border-red-100 shadow-sm">
            {error}
          </div>
        )}

        <div className={cn(
          "w-full max-w-6xl transition-all duration-500 transform origin-top",
          isTransitioning ? "opacity-0 scale-95 blur-sm" : "opacity-100 scale-100 blur-0",
          loading && "pointer-events-none"
        )}>

          {/* STEP 1: Select Module */}
          {step === 1 && (
            <div className="animate-fade-rise w-full">
              <div className="text-center mb-16">
                 <h1 className="text-5xl md:text-6xl font-display text-slate-900 mb-6 tracking-tight">Choose your focus</h1>
                 <p className="text-slate-500 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">Select a learning track. We'll tailor the coaching directives, UI, and scenarios entirely to this goal.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-16">
                {modules.length === 0 && !error ? (
                   <div className="col-span-full py-20 flex justify-center text-slate-300">
                      <div className="w-10 h-10 rounded-full border-4 border-slate-100 border-t-indigo-500 animate-spin" />
                   </div>
                ) : error ? (
                   <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
                      <p className="text-slate-500 mb-4">We couldn't load the modules at this time.</p>
                      <button 
                        onClick={() => window.location.reload()} 
                        className="px-8 py-3 bg-indigo-50 text-indigo-600 rounded-full font-bold hover:bg-indigo-100 transition-colors"
                      >
                        Retry Connection
                      </button>
                   </div>
                ) : (
                  modules.map((m, idx) => {
                    const isSelected = selectedModule === m.id || hoveredModule === m.id;
                    const avatar = moduleAvatars[m.id];
                    if (!avatar) return null;
                    
                    return (
                      <button 
                        key={m.id}
                        onMouseEnter={() => setHoveredModule(m.id)}
                        onMouseLeave={() => setHoveredModule(null)}
                        onClick={() => {
                          setSelectedModule(m.id);
                          setIsTransitioning(true);
                          setTimeout(() => {
                            setStep(2);
                            setIsTransitioning(false);
                            window.scrollTo(0, 0);
                          }, 300);
                        }}
                        className={cn(
                          "group relative text-left rounded-[3rem] border transition-all duration-700 overflow-hidden min-h-[400px] flex flex-col justify-between p-8",
                          isSelected ? "text-white ring-4 ring-white/30 border-transparent scale-[1.02] z-20" : "bg-white border-slate-200 hover:border-slate-300"
                        )}
                        style={isSelected ? { backgroundColor: avatar.bg, boxShadow: `0 20px 40px ${avatar.bg}4D` } : {}}
                      >
                        {/* Massive Avatar Graphic */}
                        <div className="absolute -bottom-10 right-0 w-64 h-80 z-0 pointer-events-none transition-transform duration-700 ease-out group-hover:scale-105 group-hover:-translate-y-4">
                           <Image 
                              src={avatar.url}
                              alt="Module Avatar"
                              fill
                              sizes="256px"
                              className={cn(
                                "object-contain object-bottom drop-shadow-2xl",
                                !isSelected && "mix-blend-multiply opacity-90"
                              )}
                              unoptimized
                           />
                        </div>

                        {/* Huge background number */}
                        <div className={cn(
                          "absolute top-4 right-4 font-display font-black text-[6rem] leading-none transition-colors duration-500 pointer-events-none select-none z-0",
                          isSelected ? "text-white/20" : "text-slate-100"
                        )}>
                           {getModuleNumber(idx)}
                        </div>

                        <div className="relative z-10 max-w-[200px]">
                          <h3 className="font-display text-3xl font-bold mb-4 tracking-tight leading-tight">{m.title}</h3>
                          <p className={cn(
                            "text-sm leading-relaxed mb-8 font-medium transition-colors duration-500",
                            isSelected ? "text-white/90" : "text-slate-500"
                          )}>
                            {m.description}
                          </p>
                        </div>
                        
                        <div className={cn(
                          "relative z-10 flex items-center gap-4 text-[10px] uppercase tracking-widest font-black mt-auto transition-colors duration-500",
                          isSelected ? "text-white/80" : "text-slate-400"
                        )}>
                          <span className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors duration-500", isSelected ? "bg-black/10" : "bg-slate-100")}>
                             <Target size={12} className={isSelected ? "text-white" : ""} style={!isSelected ? { color: avatar.bg } : {}}/> 
                             {m.level_count} Nodes
                          </span>
                          <span className={cn("px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors duration-500", isSelected ? "bg-black/10" : "bg-slate-100")}>
                             {m.cefr_range ? `CEFR ${m.cefr_range}` : `Grades ${m.grade_range}`}
                          </span>
                        </div>

                        {isSelected && (
                           <div className="absolute top-8 left-8 animate-fade-in">
                              <div className="w-8 h-8 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-lg">
                                 <ChevronRight size={20} strokeWidth={3} />
                              </div>
                           </div>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Placement */}
          {step === 2 && (
            <div className="animate-fade-rise w-full max-w-5xl mx-auto">
              <button 
                 onClick={handlePrevStep}
                 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors mb-12 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm w-fit"
              >
                 <ChevronLeft size={14} strokeWidth={3} /> Back to Modules
              </button>

              <div className="text-center mb-16">
                 <h1 className="text-5xl md:text-6xl font-display text-slate-900 mb-6 tracking-tight">Determine your level</h1>
                 <p className="text-slate-500 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">Help us place you on the map. Let our AI evaluate a writing sample, or simply self-report your level.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mb-16">
                
                {placementAvatars.length > 0 && (
                  <>
                    {/* AI Evaluation / Write Statement */}
                    <motion.div
                      className={cn(
                        "relative group flex flex-col text-left transition-all duration-700 ease-out",
                        placementMode === 'report' ? "opacity-40 grayscale scale-[0.98]" : "opacity-100",
                        placementMode === 'write' ? "scale-[1.02] z-20" : ""
                      )}
                    >
                      <button 
                        onClick={() => {
                           setPlacementMode('write');
                           setSelfReport('');
                        }}
                        className={cn(
                           "w-full h-[400px] rounded-[3rem] overflow-hidden relative transition-shadow duration-500 text-left",
                           placementMode === 'write' ? `shadow-[0_30px_60px_${placementAvatars[0].bg}66] ring-4 ring-white/30` : `shadow-[0_20px_40px_${placementAvatars[0].bg}33] group-hover:shadow-[0_30px_60px_${placementAvatars[0].bg}4D]`
                        )}
                        style={{ backgroundColor: placementAvatars[0].bg }}
                      >
                        <div className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22 opacity=%220.5%22/%3E%3C/svg%3E")' }} />
                        
                        <Image 
                          src={placementAvatars[0].url}
                          alt="Evaluator Avatar"
                          fill
                          sizes="(max-width: 768px) 50vw, 33vw"
                          className="object-contain object-bottom drop-shadow-2xl translate-y-8 group-hover:translate-y-4 transition-transform duration-700 ease-out"
                          unoptimized
                        />

                        <div className="absolute top-8 left-8">
                          <span 
                            className="px-5 py-2.5 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2"
                            style={{ color: placementAvatars[0].bg }}
                          >
                            <Sparkles size={14} /> Recommended
                          </span>
                        </div>

                        <div className="absolute bottom-0 inset-x-0 p-8 pt-20" style={{ background: `linear-gradient(to top, ${placementAvatars[0].bg}, ${placementAvatars[0].bg}CC, transparent)` }}>
                           <h2 className="text-3xl font-bold text-white mb-2">Write a Statement</h2>
                           <p className="text-white/80 leading-relaxed font-medium">Let the AI evaluate your current level.</p>
                        </div>
                      </button>

                  {/* Expandable Input Area */}
                  <motion.div 
                     initial={{ height: 0, opacity: 0 }}
                     animate={{ height: placementMode === 'write' ? 'auto' : 0, opacity: placementMode === 'write' ? 1 : 0 }}
                     className="overflow-hidden"
                  >
                     <div className="pt-6">
                        <div className="relative group">
                          <textarea 
                            placeholder="Write 3-4 sentences about your typical day, your job, or your studies. Don't worry about mistakes..."
                            value={writingSample}
                            onChange={e => setWritingSample(e.target.value)}
                            rows={5}
                            className="w-full bg-white border border-slate-200 rounded-[2rem] p-6 text-slate-700 placeholder:text-slate-400 focus:ring-4 focus:ring-[#5390D9]/20 focus:border-[#5390D9] transition-all resize-none outline-none shadow-sm text-lg leading-relaxed"
                          />
                          {writingSample.length > 0 && (
                             <div className="absolute bottom-6 right-6 px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500">
                                {writingSample.split(' ').length} words
                             </div>
                          )}
                        </div>
                     </div>
                  </motion.div>
                </motion.div>

                {/* Self Report */}
                <motion.div
                  className={cn(
                    "relative group flex flex-col text-left transition-all duration-700 ease-out",
                    placementMode === 'write' ? "opacity-40 grayscale scale-[0.98]" : "opacity-100",
                    placementMode === 'report' ? "scale-[1.02] z-20" : ""
                  )}
                >
                  <button 
                    onClick={() => {
                       setPlacementMode('report');
                       setWritingSample('');
                    }}
                    className={cn(
                       "w-full h-[400px] rounded-[3rem] overflow-hidden relative transition-shadow duration-500 text-left",
                       placementMode === 'report' ? `shadow-[0_30px_60px_${placementAvatars[1].bg}66] ring-4 ring-white/30` : `shadow-[0_20px_40px_${placementAvatars[1].bg}33] group-hover:shadow-[0_30px_60px_${placementAvatars[1].bg}4D]`
                    )}
                    style={{ backgroundColor: placementAvatars[1].bg }}
                  >
                    <div className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22 opacity=%220.5%22/%3E%3C/svg%3E")' }} />
                    
                    <Image 
                      src={placementAvatars[1].url}
                      alt="Guide Avatar"
                      fill
                      sizes="(max-width: 768px) 50vw, 33vw"
                      className="object-contain object-bottom drop-shadow-2xl translate-y-8 group-hover:translate-y-4 transition-transform duration-700 ease-out"
                      unoptimized
                    />

                    <div className="absolute bottom-0 inset-x-0 p-8 pt-20" style={{ background: `linear-gradient(to top, ${placementAvatars[1].bg}, ${placementAvatars[1].bg}CC, transparent)` }}>
                       <h2 className="text-3xl font-bold text-white mb-2">Self Report</h2>
                       <p className="text-white/80 leading-relaxed font-medium">Tell us where you want to start.</p>
                    </div>
                  </button>

                  {/* Expandable Grid Area */}
                  <motion.div 
                     initial={{ height: 0, opacity: 0 }}
                     animate={{ height: placementMode === 'report' ? 'auto' : 0, opacity: placementMode === 'report' ? 1 : 0 }}
                     className="overflow-hidden"
                  >
                     <div className="pt-6">
                        <div className="grid grid-cols-2 gap-3">
                           {(modules.find(m => m.id === selectedModule)?.grade_range 
                             ? [
                                 { val: '2', label: 'Grade 2', sub: undefined as string | undefined, disabled: false },
                                 { val: '3', label: 'Grade 3', sub: 'Upcoming', disabled: true },
                                 { val: '4', label: 'Grade 4', sub: 'Upcoming', disabled: true },
                                 { val: '5', label: 'Grade 5', sub: 'Upcoming', disabled: true }
                               ]
                             : [
                                 { val: 'beginner', label: 'Beginner', sub: 'A1/A2', disabled: false },
                                 { val: 'intermediate', label: 'Intermediate', sub: 'B1/B2', disabled: false },
                                 { val: 'advanced', label: 'Advanced', sub: 'C1', disabled: false },
                                 { val: 'fluent', label: 'Fluent', sub: 'C2', disabled: false }
                               ]
                           ).map((opt) => (
                              <button
                                key={opt.val}
                                disabled={opt.disabled}
                                onClick={() => setSelfReport(opt.val)}
                                className={cn(
                                   "flex flex-col items-center justify-center p-6 rounded-[1.5rem] border text-center transition-all",
                                   opt.disabled
                                      ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-70"
                                      : selfReport === opt.val
                                         ? "text-white shadow-lg ring-2 ring-offset-2"
                                         : "bg-white border-slate-200 text-slate-600 hover:shadow-md"
                                )}
                                style={(!opt.disabled && selfReport === opt.val) ? { 
                                    backgroundColor: placementAvatars[1].bg, 
                                    borderColor: placementAvatars[1].bg,
                                    boxShadow: `0 10px 25px ${placementAvatars[1].bg}4D`,
                                } : {}}
                              >
                                 <span className="font-bold text-lg">{opt.label}</span>
                                 {opt.sub && <span className={cn("text-[10px] font-black uppercase tracking-widest mt-2", selfReport === opt.val ? "text-white/80" : opt.disabled ? "text-slate-300" : "text-slate-400")}>{opt.sub}</span>}
                              </button>
                           ))}
                        </div>
                     </div>
                  </motion.div>
                </motion.div>
              </>
            )}
            </div>

              {/* Submit */}
              <div className="flex justify-center md:justify-end pb-20">
                <button 
                  onClick={handlePlacementSubmit} 
                  disabled={loading || (!writingSample.trim() && !selfReport)}
                  className="relative overflow-hidden group flex items-center gap-3 bg-slate-900 text-white px-10 py-5 rounded-[2rem] font-bold text-lg hover:bg-indigo-600 hover:shadow-[0_10px_30px_rgba(79,70,229,0.3)] transition-all disabled:opacity-30 disabled:hover:bg-slate-900 disabled:hover:shadow-none active:scale-95"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                      Generating Path...
                    </>
                  ) : (
                    <>
                      Start Learning
                      <Sparkles size={20} className="group-hover:rotate-12 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
