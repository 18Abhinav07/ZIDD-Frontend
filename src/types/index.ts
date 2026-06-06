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
}

export interface NodeAdvanceFrame {
  from_node: string;
  to_node: string;
}

export interface ProgressUpdateFrame {
  node_id: string;
  mastery: number;
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
  avg_score: number;
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
// always carries all five rubric sub-scores, but only the dimensions for the
// session's own mode are populated (the other mode's three/two default to 0.0),
// so the recap renders the type-appropriate subset rather than misleading zeros.
//   GD       -> participation_score, relevance_score, language_score
//   Interview -> clarity_score, confidence_score
// For coaching ("prep") sessions the backend returns report: null.
export interface SimulationReport {
  score: number;              // overall 0-1, gates progression
  summary: string;            // one-paragraph read of the whole performance
  strengths: string[];        // what landed (may be empty)
  improvements: string[];     // the few things to work on next (may be empty)
  participation_score: number;
  relevance_score: number;
  language_score: number;
  clarity_score: number;
  confidence_score: number;
}

export interface EndSessionResponse {
  session_id: string;
  summary: string;
  report: SimulationReport | null;
  score: number;
}

// TEST-mode simulation roster, carried on the done frame. Interview personas
// carry `role`; GD debaters carry `stance`. Fixed once per session on the
// backend (app/services/simulation_service.py build_personas).
export interface SimPersona {
  speaker_id: string;
  name: string;
  stance?: string;
  role?: string;
}

export interface DoneFrame {
  session_id: string;
  competency_node: string;
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
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  speaker_name?: string; // For TEST mode
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
  opening_streamed: boolean;
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
