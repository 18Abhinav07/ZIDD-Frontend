import { apiFetch } from '@/services/api';
import { invalidateMeActivityCache, invalidateMeCache } from '@/services/me';
import type { PrimaryMotive, SchoolProfile } from '@/services/me';

export interface OnboardingState {
  completed: boolean;
  completed_at?: string | number | null;
  primary_motive?: PrimaryMotive | null;
  destination: string;
  display_name?: string;
  draft: Record<string, unknown>;
}

export interface CompleteOnboardingPayload {
  display_name: string;
  primary_motive: PrimaryMotive;
  school_profile?: SchoolProfile;
  career_profile?: CareerProfileInput;
}

export interface CareerProfileInput {
  resume_text?: string;
  target_roles?: string[];
  interview_goals?: string[];
  gd_topic_ids?: string[];
  custom_gd_topics?: string[];
}

export function getOnboardingState(): Promise<OnboardingState> {
  return apiFetch('/onboarding/state');
}

export function saveOnboardingDraft(draft: Record<string, unknown>): Promise<{ draft: Record<string, unknown> }> {
  return apiFetch('/onboarding/state', {
    method: 'PATCH',
    body: JSON.stringify({ draft }),
  });
}

export function completeOnboarding(payload: CompleteOnboardingPayload): Promise<{ destination: string }> {
  return apiFetch('/onboarding/complete', {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then((result) => {
    invalidateMeCache();
    invalidateMeActivityCache();
    return result;
  });
}
