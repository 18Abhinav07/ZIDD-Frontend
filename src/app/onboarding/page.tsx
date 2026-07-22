"use client";

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  GraduationCap,
  Loader2,
  UserRound,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  completeOnboarding,
  getOnboardingState,
  saveOnboardingDraft,
} from '@/services/onboarding';
import { getRandomAvatar, AvatarData } from '@/lib/avatars';
import { getAvatarDisplayPath, getAvatarScaleClass } from '@/lib/avatarRegistry';
import { learnerSafeErrorMessage } from '@/lib/errorCopy';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Step = 'welcome' | 'motive' | 'school' | 'career';
type Motive = 'school' | 'career' | null;

const GD_TOPICS = [
  { id: 'ai-in-education', label: 'AI in education' },
  { id: 'social-media', label: 'Social media and students' },
  { id: 'startup-india', label: 'Startups in India' },
  { id: 'remote-work', label: 'Remote work culture' },
  { id: 'climate-action', label: 'Climate responsibility' },
  { id: 'digital-payments', label: 'Digital payments' },
];

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function splitList(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('welcome');
  const [motive, setMotive] = useState<Motive>(null);
  const [displayName, setDisplayName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [learningGoal, setLearningGoal] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [targetRoles, setTargetRoles] = useState('');
  const [interviewGoals, setInterviewGoals] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [customTopics, setCustomTopics] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [welcomeAvatar, setWelcomeAvatar] = useState<AvatarData | null>(null);

  useEffect(() => {
    setWelcomeAvatar(getRandomAvatar());
  }, []);

  useEffect(() => {
    let cancelled = false;
    getOnboardingState()
      .then((state) => {
        if (cancelled) return;
        if (state.completed) {
          router.replace(state.destination);
          return;
        }
        const draft = state.draft || {};
        setDisplayName(asString(draft.display_name) || state.display_name || '');
        const draftMotive = draft.primary_motive === 'school' || draft.primary_motive === 'career'
          ? draft.primary_motive
          : null;
        setMotive(draftMotive);
        setSchoolName(asString(draft.school_name));
        setLearningGoal(asString(draft.learning_goal));
        setResumeText(asString(draft.resume_text));
        setTargetRoles(asStringArray(draft.target_roles).join('\n'));
        setInterviewGoals(asStringArray(draft.interview_goals).join('\n'));
        setSelectedTopics(asStringArray(draft.gd_topic_ids));
        setCustomTopics(asStringArray(draft.custom_gd_topics).join('\n'));
        setStep(draftMotive ? draftMotive : 'welcome');
        setReady(true);
      })
      .catch(() => setError('Could not load onboarding. Please refresh and try again.'))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const draft = useMemo(() => ({
    step,
    display_name: displayName,
    primary_motive: motive,
    school_name: schoolName,
    learning_goal: learningGoal,
    resume_text: resumeText,
    target_roles: splitList(targetRoles),
    interview_goals: splitList(interviewGoals),
    gd_topic_ids: selectedTopics,
    custom_gd_topics: splitList(customTopics),
  }), [
    customTopics,
    displayName,
    interviewGoals,
    learningGoal,
    motive,
    resumeText,
    schoolName,
    selectedTopics,
    step,
    targetRoles,
  ]);

  useEffect(() => {
    if (!ready) return;
    const handle = window.setTimeout(() => {
      saveOnboardingDraft(draft).catch(() => {});
    }, 600);
    return () => window.clearTimeout(handle);
  }, [draft, ready]);

  const chooseMotive = (next: Exclude<Motive, null>) => {
    setMotive(next);
    setStep(next);
  };

  const toggleTopic = (id: string) => {
    setSelectedTopics((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const canCompleteSchool = displayName.trim().length > 1 && schoolName.trim().length > 1;
  const careerDetails = Boolean(
    resumeText.trim() ||
    targetRoles.trim() ||
    interviewGoals.trim() ||
    selectedTopics.length ||
    customTopics.trim()
  );
  const canCompleteCareer = displayName.trim().length > 1 && careerDetails;

  const finish = async () => {
    if (!motive) return;
    setSaving(true);
    setError('');
    try {
      const result = await completeOnboarding({
        display_name: displayName.trim(),
        primary_motive: motive,
        school_profile: {
          school_name: schoolName.trim(),
          learning_goal: learningGoal.trim(),
        },
        career_profile: {
          resume_text: resumeText.trim(),
          target_roles: splitList(targetRoles),
          interview_goals: splitList(interviewGoals),
          gd_topic_ids: selectedTopics,
          custom_gd_topics: splitList(customTopics),
        },
      });
      router.replace(result.destination);
    } catch (err: unknown) {
      setError(learnerSafeErrorMessage(err, 'Could not finish onboarding. Please try again.'));
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#FCFCFC] text-slate-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400 text-sm font-bold uppercase tracking-[0.18em]">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#FCFCFC] text-slate-900 font-body overflow-hidden">
      <header className="px-6 lg:px-12 h-16 flex items-center justify-between border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <button onClick={() => router.push('/onboarding')} className="font-sans font-black text-2xl text-slate-900">
          ZIDD<span className="text-indigo-600">.</span>
        </button>
        <div className="flex items-center gap-2">
          {(['welcome', 'motive', motive || 'school'] as string[]).map((item, index) => (
            <span
              key={`${item}-${index}`}
              className={cn(
                "h-1.5 rounded-full transition-all",
                index === 0 || (index === 1 && step !== 'welcome') || (index === 2 && (step === 'school' || step === 'career'))
                  ? "w-10 bg-slate-900"
                  : "w-6 bg-slate-200"
              )}
            />
          ))}
        </div>
      </header>

      <main className="max-w-[1120px] mx-auto px-6 lg:px-12 py-12 lg:py-16">
        {error && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        )}

        <div className="mx-auto max-w-[760px]">
          <motion.section
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35 }}
            className="rounded-[2rem] border border-slate-200/70 bg-white p-6 lg:p-8 shadow-[0_16px_50px_rgba(15,23,42,0.06)]"
          >
            {step === 'welcome' && (
              <div className="h-full flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-500">Step 1</span>
                <h2 className="mt-3 font-display text-4xl leading-tight">What should I call you?</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  This name appears across your dashboard and profile. Your Google email stays attached to the account.
                </p>
                {welcomeAvatar ? (
                  <div className="relative mt-7 h-32 overflow-hidden rounded-xl" style={{ backgroundColor: welcomeAvatar.bg }}>
                    <motion.div
                      key={welcomeAvatar.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0"
                    >
                      <Image
                        src={getAvatarDisplayPath(welcomeAvatar.url)}
                        alt="A Zidd learning coach"
                        fill
                        sizes="160px"
                        className={`object-contain object-bottom ${getAvatarScaleClass(welcomeAvatar.url)}`}
                        priority
                      />
                    </motion.div>
                  </div>
                ) : <div aria-hidden="true" className="mt-7 h-32 rounded-xl bg-slate-200" />}
                <label className="mt-10 block">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Username</span>
                  <div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50">
                    <UserRound className="h-5 w-5 text-slate-400" />
                    <input
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="Asha"
                      className="w-full bg-transparent outline-none text-lg font-semibold text-slate-900 placeholder:text-slate-300"
                    />
                  </div>
                </label>
                <button
                  disabled={displayName.trim().length < 2}
                  onClick={() => setStep('motive')}
                  className="mt-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-40"
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {step === 'motive' && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-500">Step 2</span>
                <h2 className="mt-3 font-display text-4xl leading-tight">What are you here for?</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  Pick the primary reason. You can still explore the other side later from your profile.
                </p>
                <div className="mt-8 grid grid-cols-1 gap-4">
                  <button
                    onClick={() => chooseMotive('school')}
                    className="group rounded-[1.5rem] border border-slate-200 bg-white p-5 text-left hover:border-indigo-200 hover:bg-indigo-50/30 transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                        <GraduationCap className="h-6 w-6" />
                      </span>
                      <div>
                        <h3 className="font-bold text-xl">School English</h3>
                        <p className="mt-1 text-sm leading-relaxed text-slate-500">
                          English chapters, readiness checks, and focused skill practice.
                        </p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => chooseMotive('career')}
                    className="group rounded-[1.5rem] border border-slate-200 bg-white p-5 text-left hover:border-indigo-200 hover:bg-indigo-50/30 transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                        <BriefcaseBusiness className="h-6 w-6" />
                      </span>
                      <div>
                        <h3 className="font-bold text-xl">Interview and GD prep</h3>
                        <p className="mt-1 text-sm leading-relaxed text-slate-500">
                          Practice interviews, pressure answers, and group discussion topics.
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {step === 'school' && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-500">School profile</span>
                <h2 className="mt-3 font-display text-4xl leading-tight">Set up your school learning profile.</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  We do not store your class as identity. You can open any available class from the curriculum.
                </p>
                <div className="mt-8 space-y-5">
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">School name</span>
                    <input
                      value={schoolName}
                      onChange={(event) => setSchoolName(event.target.value)}
                      placeholder="City Public School"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-base font-semibold outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Learning goal</span>
                    <textarea
                      value={learningGoal}
                      onChange={(event) => setLearningGoal(event.target.value)}
                      rows={4}
                      placeholder="I want to read chapters better and write stronger answers."
                      className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-base outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
                    />
                  </label>
                </div>
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <button onClick={() => setStep('motive')} className="rounded-2xl border border-slate-200 px-6 py-4 text-sm font-bold text-slate-600 hover:bg-slate-50">
                    Back
                  </button>
                  <button
                    disabled={!canCompleteSchool || saving}
                    onClick={finish}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-40"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Open curriculum
                  </button>
                </div>
              </div>
            )}

            {step === 'career' && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-500">Career profile</span>
                <h2 className="mt-3 font-display text-4xl leading-tight">Add context for focused practice.</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  Resume details are optional, but they make interview and GD practice much sharper.
                </p>
                <div className="mt-7 space-y-4">
                  <textarea
                    value={resumeText}
                    onChange={(event) => setResumeText(event.target.value)}
                    rows={5}
                    placeholder="Paste resume summary, projects, internships, or achievements..."
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <textarea
                      value={targetRoles}
                      onChange={(event) => setTargetRoles(event.target.value)}
                      rows={4}
                      placeholder="Target roles, one per line"
                      className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
                    />
                    <textarea
                      value={interviewGoals}
                      onChange={(event) => setInterviewGoals(event.target.value)}
                      rows={4}
                      placeholder="Interview goals, one per line"
                      className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">GD topics</span>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {GD_TOPICS.map((topic) => {
                        const selected = selectedTopics.includes(topic.id);
                        return (
                          <button
                            key={topic.id}
                            onClick={() => toggleTopic(topic.id)}
                            className={cn(
                              "rounded-full border px-4 py-2 text-sm font-semibold transition-all",
                              selected
                                ? "border-indigo-600 bg-indigo-600 text-white"
                                : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200"
                            )}
                          >
                            {topic.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <textarea
                    value={customTopics}
                    onChange={(event) => setCustomTopics(event.target.value)}
                    rows={3}
                    placeholder="Custom GD topics, one per line"
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
                  />
                </div>
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <button onClick={() => setStep('motive')} className="rounded-2xl border border-slate-200 px-6 py-4 text-sm font-bold text-slate-600 hover:bg-slate-50">
                    Back
                  </button>
                  <button
                    disabled={!canCompleteCareer || saving}
                    onClick={finish}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-40"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Open career prep
                  </button>
                </div>
              </div>
            )}
          </motion.section>
        </div>
      </main>
    </div>
  );
}
