// Zidd-Frontend/src/types/index.ts

export type FrameType =
  | 'message'
  | 'progress_update'
  | 'node_advance'
  | 'session_recap'
  | 'game_prompt'
  | 'speaker'
  | 'simulation_state'
  | 'adaptation_cue'
  | 'done';

export interface GamePromptFrame {
  type: 'fill_blank' | 'multiple_choice' | 'spoken';
  sentence: string;
  hint: string;
  context: string;
  options: string[] | null;
  turn_id?: string | null;
}

export interface NodeAdvanceFrame {
  from_node: string;
  to_node: string;
}

export interface ProgressUpdateFrame {
  node_id: string;
  mastery: number;
  readiness_score: number;
  clean_streak: number;
  attempts: number;
}

export interface WeaknessRow {
  skill_id: string;
  hit_count: number;
  last_raw: string | null;
}

export interface SessionRecapFrame {
  nodes_completed: string[];
  weaknesses: WeaknessRow[];
  score_metric?: 'readiness' | 'mastery';
  readiness_score?: number;
  mastery_score?: number;
  avg_score?: number;
}

export interface SpeakerFrame {
  speaker_id: string;
  name: string;
}

export interface SimulationStateFrame {
  turn: number;
  speaker_id: string;
  tension: number;
  // Director's terminal wind-down signal (topic exhausted) OR the hard round
  // cap. Once true the simulation is on its final round; the FE locks input and
  // fetches the scored report via POST /session/{id}/end. Mirrors
  // app/models.py SimulationState.should_close.
  should_close: boolean;
}

export interface AdaptationCueFrame {
  action: 'ADVANCE' | 'REMEDIATE';
  band: 'foundational' | 'standard' | 'stretch';
  rationale: string;
}

// POST /session/{id}/end -> { session_id, summary, report, score }
// `report` is the once-at-the-end scored read of a TEST-mode simulation
// (interview_test / gd_test). Mirrors app/ai/schemas.py SimulationReport: it
// always carries the session's own rubric sub-scores. The backend may null
// dimensions that were not measured for this mode, so the UI must render by mode
// and must not treat a null sub-score as a real 0%.
//   GD       -> participation_score, relevance_score, language_score
//   Interview -> clarity_score, confidence_score
// For coaching ("prep") sessions the backend returns report: null.
export interface SimulationReport {
  score: number;              // overall 0-1, gates progression
  summary: string;            // one-paragraph read of the whole performance
  strengths: string[];        // what landed (may be empty)
  improvements: string[];     // the few things to work on next (may be empty)
  participation_score: number | null;
  relevance_score: number | null;
  language_score: number | null;
  clarity_score: number | null;
  confidence_score: number | null;
  assertiveness_score?: number;    // GD only — derived from tension escalation events
  // One data-driven sentence per rubric dimension, keyed by label (e.g. "Participation")
  score_explanations?: Record<string, string>;
  // Three utterance-level observations: [hedging_phrase, strong_moment, structural_change]
  read_observations?: string[];
  scenario_label?: string;
  role_focus?: string;
  topic?: string;
  observed_skill_gaps?: string[];
  recommended_next_nodes?: string[];
  assessment_caveats?: string[];
  learner_assessment_caveats?: string[];
  simulator_integrity_notes?: string[];
  score_breakdown?: {
    model_score?: number | null;
    round_quality_mean?: number | null;
    round_quality_weight?: number | null;
    coverage_cap?: number | null;
    validity_cap?: number | null;
    repeated_prompt_count?: number;
    final_score?: number | null;
    [key: string]: number | string | null | undefined;
  };
  validity_status?: 'final' | 'partial' | 'insufficient_evidence' | 'invalid_simulation' | string;
  scorable_turn_count?: number;
  coverage_map?: {
    required_unique?: number;
    unique_covered?: number;
    covered_ids?: string[];
    event_count?: number;
    repeated_prompt_count?: number;
    source?: string;
  };
  evidence_quotes?: string[];
  repeated_answer_flags?: string[];
  topic_drift_flags?: string[];
  persona_warnings?: string[];
}

export interface ReadinessReport {
  status: 'in_progress' | 'ready_to_advance' | 'mastered' | 'needs_remediation' | string;
  readiness_score: number;
  strengths: string[];
  gaps: string[];
  recommended_actions: string[];
  summary?: string;
  allow_next?: boolean;
  allow_mastery_challenge?: boolean;
}

export interface EndSessionResponse {
  status?: 'processing' | 'completed' | 'failed' | 'not_started' | string;
  session_id: string;
  summary?: string;
  report?: SimulationReport | null;
  score?: number;
}

export interface ActiveTurn {
  client_turn_id: string;
  status: 'processing' | 'completed' | 'failed' | string;
}

// TEST-mode simulation roster, carried on the done frame. Interview personas
// carry `role`; GD debaters carry `stance`. Fixed once per session on the
// backend (app/services/simulation_service.py build_personas).
export interface SimPersona {
  speaker_id: string;
  name: string;
  stance?: string;
  role?: string;
  role_type?: 'moderator' | 'debater' | 'interviewer' | string;
}

export type AssessmentActionKind = 'ask_panelist' | 'clarify' | 'new_angle' | 'move_on';

export interface AssessmentClientAction {
  kind: AssessmentActionKind;
  speaker_id?: string;
  speaker_name?: string;
  label?: string;
  source?: 'quick_action' | 'typed_control';
}

export interface SimulationScenarioConfig {
  topic_mode?: 'profile' | 'custom' | 'random';
  topic?: string;
  custom_topic?: string;
  environment?: 'campus_placement' | 'business_case' | 'workplace_debate' | 'high_pressure_panel';
  persona_ids?: string[];
  target_role?: string;
  interview_type?: 'hr' | 'behavioral' | 'technical_project' | 'management' | 'mixed';
  pressure_level?: 'warm' | 'standard' | 'high';
}

export interface ScenarioSnapshot {
  task_type?: string;
  topic?: string;
  environment?: string;
  personas?: string[];
  interview_type?: string;
  pressure_level?: string;
  target_role?: string;
  role_family?: string;
}

export interface AssessmentStateSnapshot {
  plan?: Record<string, unknown> | null;
  validity_flags?: Array<Record<string, unknown>>;
  coverage_events?: Array<Record<string, unknown>>;
  assessment_events?: Array<Record<string, unknown>>;
  progress?: AssessmentProgressSnapshot | null;
}

export interface AssessmentProgressSnapshot {
  scorable_turn_count?: number;
  min_scorable_turns?: number;
  control_turn_count?: number;
  round_count?: number;
  coverage_map?: Record<string, unknown>;
}

export interface DoneFrame {
  session_id: string;
  competency_node: string;
  task_type?: string;
  module_id?: string;
  node_title: string;
  current_mastery: number;
  turn_count: number;
  last_route: string | null;
  last_eval_score: number | null;
  bridge_attempts: number;
  strengthen_attempts: number;
  attempts: number;
  clean_streak: number;
  scaffold: number;
  node_mastered?: boolean;
  display_status?: 'not_started' | 'in_progress' | 'ready_to_advance' | 'proficient' | 'mastered' | 'needs_remediation' | 'active' | string;
  best_independent_score?: number;
  independent_passes?: number;
  transfer_passes?: number;
  pressure_passes?: number;
  scaffold_successes?: number;
  meaningful_attempts?: number;
  readiness_score?: number;
  last_gap?: string;
  mastery_evidence?: Array<string | Record<string, unknown>>;
  readiness_report?: ReadinessReport | null;
  remediation: boolean;
  module_done: boolean;
  phase: string;
  level_kind: string;
  tester_level: boolean;
  weaknesses: WeaknessRow[];
  on_task: boolean;
  english: boolean;
  affect: 'neutral' | 'frustrated' | 'confident' | 'confused';
  avatar_emotion: 'neutral' | 'engaged' | 'impressed' | 'skeptical' | 'empathetic' | 'patient' | 'concerned';
  // TEST-mode roster (interview panel / GD debaters); null for coaching sessions
  // and the first simulation frame before round 1 builds it.
  personas?: SimPersona[] | null;
  scenario_config?: ScenarioSnapshot | null;
  status?: 'active' | 'ended' | 'expired' | string;
  session_over?: boolean;
  simulation_round?: number;
  simulation_tension?: number;
  simulation_score?: number | null;
  simulation_report?: SimulationReport | null;
  assessment_state?: AssessmentStateSnapshot | null;
  session_version?: number;
  pending_transition?: PendingNodeTransition | null;
  active_turn?: ActiveTurn | null;
  last_turn?: ActiveTurn | null;
  handoff_session_id?: string | null;
  input_allowed?: boolean;
  block_reason?: string | null;
  opening_streamed?: boolean;
}

export interface PendingNodeTransition {
  transition_id: string;
  from_node: string;
  from_title?: string;
  from_display_status?: string;
  from_node_mastered?: boolean;
  from_last_gap?: string;
  from_readiness_score?: number;
  from_mastery?: number;
  from_clean_streak?: number;
  from_attempts?: number;
  to_node: string;
  to_title?: string;
  status?: 'awaiting_next_opening' | 'opening_streaming' | 'opening_failed' | 'committed' | string;
  created_at?: number;
  attempts?: number;
  last_error?: string | null;
}

export interface ChatMessage {
  id: string;
  message_id?: string;
  turn_id?: string;
  role: 'user' | 'assistant';
  content: string;
  speaker_name?: string; // For TEST mode
  speaker_id?: string;
  node_id?: string;
  transition_id?: string;
  message_kind?: string;
  status?: string;
  // True while this assistant bubble is still receiving streamed tokens. Used to
  // coalesce tokens into ONE bubble per reply (a new bubble opens only when there
  // is no open one, or the speaker changes) instead of relying on a ref mutated
  // inside the setMessages reducer. Finalised (false) on done/node_advance/speaker.
  streaming?: boolean;
}

// GET /session/{id}/transcript -> persisted conversation for reload rehydration.
export interface TranscriptResponse {
  messages: ChatMessage[];
  state: DoneFrame;
  session_recap?: SessionRecapFrame | null;
  opening_streamed: boolean;
  pending_transition?: PendingNodeTransition | null;
  active_turn?: ActiveTurn | null;
  game_prompt?: GamePromptFrame | null;
  input_allowed?: boolean;
  block_reason?: string | null;
  session_version?: number;
}

// ───────────────────────────────────────────────────────────────────────────
// Billing / credits / paywall contract
// Shapes mirror app/billing/models.py and the /session/start 402 body exactly.
// ───────────────────────────────────────────────────────────────────────────

// GET /billing/balance -> BalanceResponse
export interface CreditsBalance {
  user_id: string;
  credits: number;
  demo_unlimited: boolean;
  name?: string; // profile display name, so the dashboard greets like the coach
  active_module?: string;
}

// GET /billing/packs -> { packs: PackInfo[] }
export interface PackInfo {
  id: string;
  title: string;
  price_paise: number;
  credits: number;
}

// GET /billing/quote?node_id=… -> QuoteResponse
export interface BillingQuote {
  node_id: string;
  free: boolean;
  cost: number;
  scope: string;
  ref_id: string;
  owned: boolean;
  reason: string;
}

// GET /billing/unlocks -> { unlocks: UnlockInfo[] }
export interface UnlockInfo {
  scope: string;
  ref_id: string;
  credits_spent: number;
}

// POST /billing/purchase/order -> OrderResponse
export interface OrderResponse {
  order_id: string;
  pack_id: string;
  amount_paise: number;
  credits: number;
  razorpay_key_id: string;
}

// ── /session/start 402 paywall bodies ──
// FastAPI wraps the raise-detail under `detail`. Two discriminated variants:
//  - confirm_required:     gate costs N credits, learner has enough -> confirm.
//  - insufficient_credits: shortfall; offer packs, then retry with confirm.
export interface ConfirmRequiredPaywall {
  error: 'confirm_required';
  cost: number;
  balance: number;
  scope: string;
  ref_id: string;
}

export interface InsufficientCreditsPaywall {
  error: 'insufficient_credits';
  cost: number;
  balance: number;
  packs: PackInfo[];
}

export type PaywallDetail = ConfirmRequiredPaywall | InsufficientCreditsPaywall;
