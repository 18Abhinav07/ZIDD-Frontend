"use client";

import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
import { COACH_AVATARS, getRandomAvatar, type AvatarData } from '@/lib/avatars';
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
  const [welcomeAvatar, setWelcomeAvatar] = useState<AvatarData>(COACH_AVATARS[0]);

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

  const handleWelcomeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (displayName.trim().length < 2) return;
    setStep('motive');
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
      <div className="min-h-[100dvh] bg-[#FCFCFC] font-body text-slate-900">
        <header className="flex h-16 items-center justify-between border-b border-slate-200/70 bg-white px-6 lg:px-12">
          <span className="font-sans text-2xl font-black text-slate-900">ZIDD<span className="text-indigo-600">.</span></span>
          <span className="h-1.5 w-20 animate-pulse rounded-full bg-slate-200" />
        </header>
        <main className="mx-auto max-w-[1120px] px-6 py-12 lg:px-12 lg:py-16">
          <div
            data-testid="onboarding-welcome-skeleton"
            aria-hidden="true"
            className="mx-auto grid max-w-[1120px] overflow-hidden rounded-[1.25rem] border border-slate-200/80 bg-white lg:min-h-[610px] lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]"
          >
            <div className="relative min-h-[244px] bg-slate-100 lg:min-h-0">
              <span className="absolute left-7 top-8 h-3 w-28 animate-pulse rounded-full bg-slate-200 sm:left-10 sm:top-11" />
              <span className="absolute bottom-0 left-1/2 h-52 w-52 -translate-x-1/2 rounded-t-full bg-slate-200/80" />
            </div>
            <div className="flex flex-col px-6 py-9 sm:px-10 lg:px-16 lg:py-16">
              <span className="h-3 w-20 animate-pulse rounded-full bg-slate-200" />
              <span className="mt-6 h-12 w-3/4 animate-pulse rounded-md bg-slate-200" />
              <span className="mt-5 h-4 w-full max-w-[31rem] animate-pulse rounded-full bg-slate-100" />
              <span className="mt-2 h-4 w-4/5 max-w-[25rem] animate-pulse rounded-full bg-slate-100" />
              <span className="mt-auto h-14 w-full animate-pulse rounded-xl bg-slate-100" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  const welcomePanelTextClass = welcomeAvatar.id === 'tech_black' || welcomeAvatar.id === 'casual_purple'
    ? 'text-white'
    : 'text-slate-950';
  const welcomePanelMutedTextClass = welcomeAvatar.id === 'tech_black' || welcomeAvatar.id === 'casual_purple'
    ? 'text-white/75'
    : 'text-slate-800/75';

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#FCFCFC] font-body text-slate-900">
      <header className="flex h-16 items-center justify-between border-b border-slate-200/70 bg-white px-6 lg:px-12">
        <button onClick={() => router.push('/onboarding')} className="font-sans text-2xl font-black text-slate-900">
          ZIDD<span className="text-indigo-600">.</span>
        </button>
        <nav className="flex items-center gap-2" aria-label={`Onboarding step ${step === 'welcome' ? 1 : step === 'motive' ? 2 : 3} of 3`}>
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
        </nav>
      </header>

      <main className="max-w-[1120px] mx-auto px-6 lg:px-12 py-12 lg:py-16">
        {error && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        )}

        <div className={cn("mx-auto", step === 'welcome' ? "max-w-[1120px]" : "max-w-[760px]")}>
          <motion.section
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className={cn(
              "border border-slate-200/70 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.06)]",
              step === 'welcome' ? "overflow-hidden rounded-[1.25rem]" : "rounded-[2rem] p-6 lg:p-8"
            )}
          >
            {step === 'welcome' && (
              <div data-testid="onboarding-welcome-layout" className="grid min-h-[610px] lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
                <aside
                  data-testid="onboarding-welcome-guide"
                  className={cn("relative isolate flex min-h-[250px] overflow-hidden px-7 py-8 sm:px-10 sm:py-11 lg:min-h-0", welcomePanelTextClass)}
                  style={{ backgroundColor: welcomeAvatar.bg }}
                >
                  <div className="relative z-10 max-w-[14rem]">
                    <p className={cn("text-[10px] font-bold uppercase tracking-[0.22em]", welcomePanelMutedTextClass)}>Your learning guide</p>
                    <h2 className="mt-4 font-display text-4xl font-normal leading-[0.98] sm:text-5xl">A path built around you.</h2>
                  </div>
                  <motion.div
                    key={welcomeAvatar.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="pointer-events-none absolute inset-x-0 bottom-0 top-[4.25rem] z-0"
                  >
                    <Image
                      src={getAvatarDisplayPath(welcomeAvatar.url)}
                      alt="A Zidd learning coach"
                      fill
                      sizes="(min-width: 1024px) 380px, 100vw"
                      className={`object-contain object-bottom ${getAvatarScaleClass(welcomeAvatar.url)}`}
                      priority
                    />
                  </motion.div>
                  <p className={cn("relative z-10 mt-auto max-w-[15rem] text-sm font-medium leading-relaxed", welcomePanelMutedTextClass)}>
                    One clear starting point is enough.
                  </p>
                </aside>

                <form
                  data-testid="onboarding-welcome-form"
                  onSubmit={handleWelcomeSubmit}
                  className="flex min-h-[360px] flex-col px-7 py-9 sm:px-10 sm:py-12 lg:min-h-0 lg:px-16 lg:py-16"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-600">Step 1 of 3</p>
                  <h1 className="mt-5 max-w-[28rem] font-display text-[2.65rem] font-normal leading-[0.98] text-slate-950 sm:text-5xl">
                    What should I call you?
                  </h1>
                  <p className="mt-5 max-w-[32rem] text-sm leading-relaxed text-slate-500 sm:text-base">
                    This is how your coach will address you. Your Google email stays attached to your account.
                  </p>

                  <label htmlFor="display-name" className="mt-12 block max-w-[34rem]">
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Your name</span>
                    <span className="mt-3 flex items-center gap-3 border-b-2 border-slate-200 pb-3 transition-colors focus-within:border-indigo-600">
                      <UserRound aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-400" />
                      <input
                        id="display-name"
                        name="display-name"
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        placeholder="Asha"
                        autoComplete="name"
                        minLength={2}
                        required
                        aria-describedby="display-name-helper"
                        className="min-w-0 flex-1 bg-transparent text-xl font-semibold text-slate-950 outline-none placeholder:text-slate-300"
                      />
                    </span>
                  </label>
                  <p id="display-name-helper" className="mt-3 text-xs leading-relaxed text-slate-400">
                    You can change this later from Profile.
                  </p>

                  <button
                    type="submit"
                    disabled={displayName.trim().length < 2}
                    className="mt-auto inline-flex min-h-14 w-full max-w-[34rem] items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Continue <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
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
