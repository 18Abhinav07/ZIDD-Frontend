import { apiFetch, getAuthCacheKey } from '@/services/api';

export type ModuleId = 'interview' | 'group_discussion' | 'school_english';
export type PrimaryMotive = 'school' | 'career';

export interface UserPreferences {
  active_module?: ModuleId | null;
  pending_module?: ModuleId | null;
  test_mode?: boolean | null;
  first_sim_complete?: boolean;
}

export interface OnboardingSummary {
  completed: boolean;
  completed_at?: string | number | null;
  primary_motive?: PrimaryMotive | null;
}

export interface SchoolProfile {
  school_name?: string;
  learning_goal?: string;
}

export interface CareerProfile {
  resume_present?: boolean;
  target_roles?: string[];
  interview_goals?: string[];
  gd_topic_ids?: string[];
  custom_gd_topics?: string[];
}

export interface MeResponse {
  user_id: string;
  name: string;
  email?: string | null;
  google_sub?: string | null;
  credits: number;
  beta_credits: number;
  paid_credits: number;
  promo_credits: number;
  beta_expires_at: string | null;
  purchases_enabled: boolean;
  demo_unlimited: boolean;
  onboarding: OnboardingSummary;
  school_profile: SchoolProfile;
  career_profile: CareerProfile;
  preferences: UserPreferences;
}

export interface MeActivity {
  school: {
    results_count: number;
    recent_classes: number[];
    average_score: number;
    weak_skills: string[];
    skill_mastery: { skill: string; mastery: number; attempts: number }[];
  };
  career: {
    completed_nodes: number;
    attempts: number;
    weaknesses: { task_type?: string; skill_id?: string; hit_count: number; last_raw?: string }[];
    profile_complete: boolean;
    resume_present: boolean;
  };
  recommendations: { kind: string; title: string; body: string; href: string }[];
  degraded?: boolean;
}

export interface CareerLearningGraphNode {
  user_id?: string;
  domain: 'career' | 'school_adapter' | string;
  skill_id: string;
  module_id?: ModuleId | string;
  task_type?: string;
  mastery: number;
  readiness: number;
  confidence: number;
  attempts: number;
  strengths_json?: string[];
  gaps_json?: string[];
  evidence_json?: Record<string, unknown>;
  recommended_next_action?: string;
  source_summary?: string;
}

export interface SessionReportSummary {
  report_id?: string;
  session_id: string;
  report_type: string;
  task_type: string;
  module_id?: ModuleId | string;
  status: string;
  score: number;
  readiness_score?: number;
  summary?: string;
  strengths_json?: string[];
  gaps_json?: string[];
  recommended_actions_json?: string[];
  evidence_json?: Record<string, unknown>;
  validity_json?: Record<string, unknown>;
  public_context_json?: Record<string, unknown>;
  created_at?: string | number | null;
}

export interface LearningEventSummary {
  source_event_key: string;
  domain: 'career' | 'school_adapter' | string;
  task_type: string;
  module_id?: ModuleId | string;
  session_id?: string | null;
  node_id?: string;
  skill_id: string;
  source: string;
  attempt_type?: string;
  score: number;
  confidence: number;
  evidence_json?: Record<string, unknown>;
  gap?: string;
  caveats?: string[];
  occurred_at?: string | number | null;
}

export interface ActiveCareerSessionSummary {
  session_id: string;
  current_node: string;
  module_id?: ModuleId | string;
  task_type: string;
  test_mode: boolean;
  status: string;
  pending_transition?: Record<string, unknown> | null;
  updated_at?: string | number | null;
}

export interface CareerMemoryItem {
  skill_id: string;
  focus_id?: string;
  module_id?: ModuleId | string;
  task_type?: string;
  status: 'active_gap' | 'improving' | 'resolved' | 'mastered' | string;
  readiness: number;
  confidence: number;
  attempts: number;
  gap?: string;
  latest_evidence?: string;
  recommended_next_action?: string;
  repeat_count?: number;
  historical_failure_count?: number;
  current_competence_status?: string;
  milestone_mastered?: boolean;
  growth?: {
    grounded_recovery_count?: number;
    recoveries_since_latest_failure?: number;
  };
}

export interface CareerMemoryContext {
  active_gaps: CareerMemoryItem[];
  improving_gaps: CareerMemoryItem[];
  resolved_gaps: CareerMemoryItem[];
  mastered_skills: CareerMemoryItem[];
  repeated_issue_counts: Record<string, number>;
  recent_reports: Array<{
    task_type?: string;
    status?: string;
    score?: number;
    summary?: string;
    recommended_actions?: string[];
  }>;
}

export interface MeLearningGraph {
  career_profile: CareerProfile;
  profiles: CareerLearningGraphNode[];
  reports: SessionReportSummary[];
  events: LearningEventSummary[];
  active_sessions: ActiveCareerSessionSummary[];
  memory_context: CareerMemoryContext;
  degraded?: boolean;
}

const ME_CACHE_MS = 15_000;
const ME_ACTIVITY_CACHE_MS = 30_000;
const ME_LEARNING_GRAPH_CACHE_MS = 30_000;
let cachedMe: { authKey: string; value: MeResponse; expiresAt: number } | null = null;
let meRequest: { authKey: string; promise: Promise<MeResponse> } | null = null;
let meCacheGeneration = 0;
let cachedActivity: { authKey: string; value: MeActivity; expiresAt: number } | null = null;
let activityRequest: { authKey: string; promise: Promise<MeActivity> } | null = null;
let cachedLearningGraph: { authKey: string; value: MeLearningGraph; expiresAt: number } | null = null;
let learningGraphRequest: { authKey: string; promise: Promise<MeLearningGraph> } | null = null;

export function invalidateMeCache() {
  meCacheGeneration += 1;
  cachedMe = null;
  meRequest = null;
}

export function invalidateMeActivityCache() {
  cachedActivity = null;
  activityRequest = null;
}

export function invalidateMeLearningGraphCache() {
  cachedLearningGraph = null;
  learningGraphRequest = null;
}

export async function getMe(): Promise<MeResponse> {
  const authKey = await getAuthCacheKey();
  const now = Date.now();
  if (cachedMe && cachedMe.authKey === authKey && cachedMe.expiresAt > now) {
    return Promise.resolve(cachedMe.value);
  }
  if (!meRequest || meRequest.authKey !== authKey) {
    const requestGeneration = meCacheGeneration;
    const promise = apiFetch('/me')
      .then((me: MeResponse) => {
        if (meCacheGeneration === requestGeneration) {
          cachedMe = { authKey, value: me, expiresAt: Date.now() + ME_CACHE_MS };
        }
        return me;
      })
      .finally(() => {
        if (meRequest?.promise === promise) meRequest = null;
      });
    meRequest = { authKey, promise };
  }
  return meRequest.promise;
}

export async function getMeActivity(): Promise<MeActivity> {
  const authKey = await getAuthCacheKey();
  const now = Date.now();
  if (cachedActivity && cachedActivity.authKey === authKey && cachedActivity.expiresAt > now) {
    return Promise.resolve(cachedActivity.value);
  }
  if (!activityRequest || activityRequest.authKey !== authKey) {
    const promise = apiFetch('/me/activity')
      .then((activity: MeActivity) => {
        cachedActivity = { authKey, value: activity, expiresAt: Date.now() + ME_ACTIVITY_CACHE_MS };
        return activity;
      })
      .finally(() => {
        if (activityRequest?.authKey === authKey) activityRequest = null;
      });
    activityRequest = { authKey, promise };
  }
  return activityRequest.promise;
}

export async function getMeLearningGraph(options: { force?: boolean } = {}): Promise<MeLearningGraph> {
  if (options.force) {
    cachedLearningGraph = null;
    learningGraphRequest = null;
  }
  const authKey = await getAuthCacheKey();
  const now = Date.now();
  if (cachedLearningGraph && cachedLearningGraph.authKey === authKey && cachedLearningGraph.expiresAt > now) {
    return Promise.resolve(cachedLearningGraph.value);
  }
  if (!learningGraphRequest || learningGraphRequest.authKey !== authKey) {
    const promise = apiFetch('/me/learning-graph')
      .then((graph: MeLearningGraph) => {
        cachedLearningGraph = { authKey, value: graph, expiresAt: Date.now() + ME_LEARNING_GRAPH_CACHE_MS };
        return graph;
      })
      .finally(() => {
        if (learningGraphRequest?.authKey === authKey) learningGraphRequest = null;
      });
    learningGraphRequest = { authKey, promise };
  }
  return learningGraphRequest.promise;
}

export async function updatePreferences(patch: Partial<UserPreferences>): Promise<{ preferences: UserPreferences }> {
  invalidateMeCache();
  const response = await apiFetch('/me/preferences', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  invalidateMeCache();
  return response;
}

export function homeForMe(me: MeResponse | null | undefined): string {
  if (!me) return '/dashboard';
  if (!me.onboarding?.completed) return '/onboarding';
  if (me.onboarding.primary_motive === 'school') return '/school';
  return '/career';
}

export function myPathForMe(me: MeResponse | null | undefined): string {
  if (!me) return '/dashboard';
  if (!me.onboarding?.completed) return '/onboarding';
  if (me.onboarding.primary_motive === 'school') return '/school';

  const prefs = me.preferences ?? {};
  if (prefs.pending_module === 'interview' || prefs.pending_module === 'group_discussion') {
    return '/mode';
  }

  const active = prefs.active_module;
  if (!active) return '/career';
  if (active === 'school_english') return '/school';
  if (prefs.test_mode == null) return '/mode';
  return '/map';
}
