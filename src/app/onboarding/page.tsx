"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  ArrowLeft,
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
import { getAvatarDisplayPath } from '@/lib/avatarRegistry';
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

const GUIDE_COPY: Record<Step, { eyebrow: string; title: string; body: string }> = {
  welcome: {
    eyebrow: 'Meet your coach',
    title: 'A path built around you.',
    body: 'One name is enough to begin.',
  },
  motive: {
    eyebrow: 'Choose a direction',
    title: 'Start with what matters now.',
    body: 'Your other path stays available from Profile.',
  },
  school: {
    eyebrow: 'School journey',
    title: 'Begin at the right level.',
    body: 'These details prepare the readiness check that comes next.',
  },
  career: {
    eyebrow: 'Career journey',
    title: 'Bring practice closer to real life.',
    body: 'Your goals help us choose situations worth rehearsing.',
  },
};

const FIELD_CLASS = 'mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-300 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50';
const FIELD_LABEL_CLASS = 'text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500';
const PRIMARY_BUTTON_CLASS = 'inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-40';
const SECONDARY_BUTTON_CLASS = 'inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600';

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

function restoreOnboardingStep(value: unknown, motive: Motive): Step {
  if (value === 'welcome' || value === 'motive') return value;
  if ((value === 'school' || value === 'career') && value === motive) return value;
  return motive ?? 'welcome';
}

function OnboardingGuidePanel({ avatar, step }: { avatar: AvatarData; step: Step }) {
  const copy = GUIDE_COPY[step];

  return (
    <aside
      data-testid="onboarding-guide-panel"
      className="grid min-h-[390px] grid-rows-[minmax(260px,1fr)_auto] bg-slate-950 lg:min-h-full"
    >
      <div
        data-testid="onboarding-guide-image"
        className="relative isolate min-h-[260px] overflow-hidden"
        style={{ backgroundColor: avatar.bg }}
      >
        <motion.div
          key={avatar.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none absolute inset-0"
        >
          <Image
            src={getAvatarDisplayPath(avatar.url)}
            alt="A Zidd learning coach"
            fill
            sizes="(min-width: 1024px) 380px, 100vw"
            className="object-contain object-center p-4 sm:p-5 lg:p-6"
            priority
          />
        </motion.div>
      </div>

      <div data-testid="onboarding-guide-caption" className="border-t border-white/10 bg-slate-950 px-7 py-7 text-white sm:px-10 sm:py-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">{copy.eyebrow}</p>
        <h2 className="mt-3 max-w-[18rem] font-display text-[2rem] font-normal leading-[1.02] text-white sm:text-[2.35rem]">
          {copy.title}
        </h2>
        <p className="mt-3 max-w-[20rem] text-sm font-medium leading-relaxed text-white/65">{copy.body}</p>
      </div>
    </aside>
  );
}

function OnboardingStepFrame({
  avatar,
  step,
  children,
}: {
  avatar: AvatarData;
  step: Step;
  children: ReactNode;
}) {
  return (
    <div
      data-testid="onboarding-step-frame"
      data-step={step}
      className="grid min-h-[650px] lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]"
    >
      <OnboardingGuidePanel avatar={avatar} step={step} />
      <div className="min-w-0 px-7 py-9 sm:px-10 sm:py-12 lg:px-16 lg:py-16">{children}</div>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousStepRef = useRef<Step | null>(null);
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
  const [onboardingAvatar, setOnboardingAvatar] = useState<AvatarData>(COACH_AVATARS[0]);

  useEffect(() => {
    setOnboardingAvatar(getRandomAvatar());
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
        const restoredStep = restoreOnboardingStep(draft.step, draftMotive);
        setStep(restoredStep);
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

  useEffect(() => {
    if (loading) return;
    const previousStep = previousStepRef.current;
    previousStepRef.current = step;
    if (previousStep === null || previousStep === step) return;

    const frame = window.requestAnimationFrame(() => stepHeadingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [loading, step]);

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
            className="mx-auto grid max-w-[1120px] overflow-hidden rounded-[1.25rem] border border-slate-200/80 bg-white lg:min-h-[650px] lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]"
          >
            <div className="grid min-h-[390px] grid-rows-[minmax(260px,1fr)_auto] bg-slate-950 lg:min-h-0">
              <div className="relative min-h-[260px] bg-slate-100">
                <span className="absolute bottom-0 left-1/2 h-52 w-52 -translate-x-1/2 rounded-t-full bg-slate-200/80" />
              </div>
              <div className="space-y-3 border-t border-white/10 bg-slate-950 px-7 py-7 sm:px-10 sm:py-8">
                <span className="block h-2.5 w-24 animate-pulse rounded-full bg-white/15" />
                <span className="block h-8 w-4/5 animate-pulse rounded-md bg-white/15" />
                <span className="block h-3 w-3/5 animate-pulse rounded-full bg-white/10" />
              </div>
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

  const activeStepIndex = step === 'welcome' ? 0 : step === 'motive' ? 1 : 2;

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#FCFCFC] font-body text-slate-900">
      <header className="flex h-16 items-center justify-between border-b border-slate-200/70 bg-white px-6 lg:px-12">
        <button onClick={() => router.push('/onboarding')} className="font-sans text-2xl font-black text-slate-900">
          ZIDD<span className="text-indigo-600">.</span>
        </button>
        <nav className="flex items-center gap-2" aria-label={`Onboarding step ${activeStepIndex + 1} of 3`}>
          <span className="sr-only" aria-live="polite" aria-atomic="true">
            Step {activeStepIndex + 1} of 3
          </span>
          {[0, 1, 2].map((item, index) => (
            <span
              key={item}
              aria-hidden="true"
              className={cn(
                "h-1.5 rounded-full transition-all",
                index <= activeStepIndex
                  ? "w-10 bg-slate-900"
                  : "w-6 bg-slate-200"
              )}
            />
          ))}
        </nav>
      </header>

      <main className="max-w-[1120px] mx-auto px-6 lg:px-12 py-12 lg:py-16">
        {error && (
          <div role="alert" className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        )}

        <div className="mx-auto max-w-[1120px]">
          <motion.section
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden rounded-[1.25rem] border border-slate-200/70 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.06)]"
          >
            {step === 'welcome' && (
              <OnboardingStepFrame avatar={onboardingAvatar} step="welcome">
                <form
                  data-testid="onboarding-welcome-form"
                  onSubmit={handleWelcomeSubmit}
                  className="flex h-full flex-col"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">Step 1 of 3</p>
                  <h1 ref={stepHeadingRef} tabIndex={-1} className="mt-5 max-w-[28rem] font-display text-[2.65rem] font-normal leading-[0.98] text-slate-950 outline-none sm:text-5xl">
                    What should I call you?
                  </h1>
                  <p className="mt-5 max-w-[32rem] text-sm leading-relaxed text-slate-500 sm:text-base">
                    This is how your coach will address you. Your Google email remains linked to the account.
                  </p>

                  <label htmlFor="display-name" className="mt-12 block max-w-[34rem]">
                    <span className={FIELD_LABEL_CLASS}>Your name</span>
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
                    className={cn(PRIMARY_BUTTON_CLASS, "mt-auto w-full max-w-[34rem]")}
                  >
                    Continue <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              </OnboardingStepFrame>
            )}

            {step === 'motive' && (
              <OnboardingStepFrame avatar={onboardingAvatar} step="motive">
                <div data-testid="onboarding-path-step" className="flex h-full flex-col">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">Step 2 of 3</p>
                  <h1 ref={stepHeadingRef} tabIndex={-1} className="mt-5 max-w-[30rem] font-display text-[2.65rem] font-normal leading-[0.98] text-slate-950 outline-none sm:text-5xl">
                    Choose what you want to work on.
                  </h1>
                  <p className="mt-5 max-w-[31rem] text-sm leading-relaxed text-slate-500 sm:text-base">
                    You can add the other path later from Profile.
                  </p>

                  <div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">
                    <button
                      type="button"
                      onClick={() => chooseMotive('school')}
                      className="group flex w-full items-center gap-4 py-6 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100">
                        <GraduationCap aria-hidden="true" className="h-6 w-6" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg font-semibold text-slate-950">School English</span>
                        <span className="mt-1 block text-sm leading-relaxed text-slate-500">
                          Chapters, readiness checks, and focused skill support.
                        </span>
                      </span>
                      <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-slate-600" />
                    </button>
                    <button
                      type="button"
                      onClick={() => chooseMotive('career')}
                      className="group flex w-full items-center gap-4 py-6 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-100">
                        <BriefcaseBusiness aria-hidden="true" className="h-6 w-6" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg font-semibold text-slate-950">Interview and GD prep</span>
                        <span className="mt-1 block text-sm leading-relaxed text-slate-500">
                          Targeted interview practice and group discussions.
                        </span>
                      </span>
                      <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-slate-600" />
                    </button>
                  </div>

                  <button type="button" onClick={() => setStep('welcome')} className={cn(SECONDARY_BUTTON_CLASS, "mt-auto self-start")}>
                    <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                    Back to name
                  </button>
                </div>
              </OnboardingStepFrame>
            )}

            {step === 'school' && (
              <OnboardingStepFrame avatar={onboardingAvatar} step="school">
                <form
                  data-testid="onboarding-school-details"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void finish();
                  }}
                  className="flex h-full flex-col"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">Step 3 of 3</p>
                  <h1 ref={stepHeadingRef} tabIndex={-1} className="mt-5 max-w-[30rem] font-display text-[2.65rem] font-normal leading-[0.98] text-slate-950 outline-none sm:text-5xl">
                    Tell us about school.
                  </h1>
                  <p className="mt-5 max-w-[31rem] text-sm leading-relaxed text-slate-500 sm:text-base">
                    We only need enough context to prepare your starting-point check.
                  </p>

                  <div className="mt-10 space-y-6">
                    <label htmlFor="school-name" className="block">
                      <span className={FIELD_LABEL_CLASS}>School name</span>
                      <input
                        id="school-name"
                        name="school-name"
                        value={schoolName}
                        onChange={(event) => setSchoolName(event.target.value)}
                        placeholder="City Public School"
                        autoComplete="organization"
                        minLength={2}
                        required
                        className={cn(FIELD_CLASS, "font-semibold")}
                      />
                    </label>
                    <label htmlFor="learning-goal" className="block">
                      <span className={FIELD_LABEL_CLASS}>Learning goal <span className="font-medium normal-case tracking-normal text-slate-400">(optional)</span></span>
                      <textarea
                        id="learning-goal"
                        name="learning-goal"
                        value={learningGoal}
                        onChange={(event) => setLearningGoal(event.target.value)}
                        rows={4}
                        placeholder="I want to read chapters better and write stronger answers."
                        className={cn(FIELD_CLASS, "resize-none")}
                      />
                    </label>
                  </div>

                  <div className="mt-auto flex flex-col gap-3 pt-10 sm:flex-row">
                    <button type="button" onClick={() => setStep('motive')} className={SECONDARY_BUTTON_CLASS}>
                      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                      Back
                    </button>
                    <button type="submit" disabled={!canCompleteSchool || saving} className={cn(PRIMARY_BUTTON_CLASS, "flex-1")}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Continue to school setup
                    </button>
                  </div>
                </form>
              </OnboardingStepFrame>
            )}

            {step === 'career' && (
              <OnboardingStepFrame avatar={onboardingAvatar} step="career">
                <form
                  data-testid="onboarding-career-details"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void finish();
                  }}
                  className="flex h-full flex-col"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">Step 3 of 3</p>
                  <h1 ref={stepHeadingRef} tabIndex={-1} className="mt-5 max-w-[32rem] font-display text-[2.65rem] font-normal leading-[0.98] text-slate-950 outline-none sm:text-5xl">
                    Add useful career context.
                  </h1>
                  <p className="mt-5 max-w-[32rem] text-sm leading-relaxed text-slate-500 sm:text-base">
                    Add at least one detail so practice can reflect your goals.
                  </p>

                  <div className="mt-10 space-y-6">
                    <label htmlFor="resume-context" className="block">
                      <span className={FIELD_LABEL_CLASS}>Resume or background</span>
                      <textarea
                        id="resume-context"
                        name="resume-context"
                        value={resumeText}
                        onChange={(event) => setResumeText(event.target.value)}
                        rows={4}
                        placeholder="Projects, internships, achievements, or a short resume summary"
                        className={cn(FIELD_CLASS, "resize-none text-sm")}
                      />
                    </label>

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <label htmlFor="target-roles" className="block">
                        <span className={FIELD_LABEL_CLASS}>Target roles</span>
                        <textarea
                          id="target-roles"
                          name="target-roles"
                          value={targetRoles}
                          onChange={(event) => setTargetRoles(event.target.value)}
                          rows={3}
                          placeholder="Backend engineer"
                          className={cn(FIELD_CLASS, "resize-none text-sm")}
                        />
                      </label>
                      <label htmlFor="interview-goals" className="block">
                        <span className={FIELD_LABEL_CLASS}>Interview goals</span>
                        <textarea
                          id="interview-goals"
                          name="interview-goals"
                          value={interviewGoals}
                          onChange={(event) => setInterviewGoals(event.target.value)}
                          rows={3}
                          placeholder="Explain projects clearly"
                          className={cn(FIELD_CLASS, "resize-none text-sm")}
                        />
                      </label>
                    </div>

                    <fieldset>
                      <legend className={FIELD_LABEL_CLASS}>GD topics</legend>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {GD_TOPICS.map((topic) => {
                          const selected = selectedTopics.includes(topic.id);
                          return (
                            <button
                              key={topic.id}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => toggleTopic(topic.id)}
                              className={cn(
                                "min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
                                selected
                                  ? "border-indigo-600 bg-indigo-600 text-white"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                              )}
                            >
                              {topic.label}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>

                    <label htmlFor="custom-topics" className="block">
                      <span className={FIELD_LABEL_CLASS}>Other GD topics <span className="font-medium normal-case tracking-normal text-slate-400">(optional)</span></span>
                      <textarea
                        id="custom-topics"
                        name="custom-topics"
                        value={customTopics}
                        onChange={(event) => setCustomTopics(event.target.value)}
                        rows={2}
                        placeholder="One topic per line"
                        className={cn(FIELD_CLASS, "resize-none text-sm")}
                      />
                    </label>
                  </div>

                  <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                    <button type="button" onClick={() => setStep('motive')} className={SECONDARY_BUTTON_CLASS}>
                      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                      Back
                    </button>
                    <button type="submit" disabled={!canCompleteCareer || saving} className={cn(PRIMARY_BUTTON_CLASS, "flex-1")}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Open career prep
                    </button>
                  </div>
                </form>
              </OnboardingStepFrame>
            )}
          </motion.section>
        </div>
      </main>
    </div>
  );
}
