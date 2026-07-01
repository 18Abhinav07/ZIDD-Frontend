// Billing client. Wraps the 6 verified /billing endpoints via apiFetch, plus a
// dedicated raw fetch for /session/start that can read the structured 402 body
// (apiFetch only surfaces errorData.detail as a string, so it cannot expose the
// paywall object — hence the bespoke fetch here).
import { apiFetch, getToken } from '@/services/api';
import type {
  CreditsBalance,
  PackInfo,
  BillingQuote,
  UnlockInfo,
  OrderResponse,
  PaywallDetail,
} from '@/types';

// ── /billing reads + order creation (normal apiFetch path) ──

export function getBalance(): Promise<CreditsBalance> {
  return apiFetch('/billing/balance');
}

export async function getPacks(): Promise<PackInfo[]> {
  const data: { packs: PackInfo[] } = await apiFetch('/billing/packs');
  return data.packs;
}

export function getQuote(nodeId: string): Promise<BillingQuote> {
  return apiFetch(`/billing/quote?node_id=${encodeURIComponent(nodeId)}`);
}

export async function getUnlocks(): Promise<UnlockInfo[]> {
  const data: { unlocks: UnlockInfo[] } = await apiFetch('/billing/unlocks');
  return data.unlocks;
}

export function createOrder(packId: string): Promise<OrderResponse> {
  return apiFetch('/billing/purchase/order', {
    method: 'POST',
    body: JSON.stringify({ pack_id: packId }),
  });
}

// DEV-ONLY: top up the wallet locally without Razorpay (which needs a public
// webhook to grant credits). The backend route 404s outside non-prod.
export function devGrantCredits(amount = 500): Promise<{ credits: number; granted: number }> {
  return apiFetch(`/billing/dev/grant?amount=${amount}`, { method: 'POST' });
}

// Verify a Razorpay Checkout success server-side and grant immediately — so a
// TEST payment funds the wallet on localhost (where the webhook can't reach the
// server) and as a safety net if the webhook is delayed. Idempotent server-side.
export function verifyPayment(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<{ granted: boolean; credits: number }> {
  return apiFetch('/billing/razorpay/verify', { method: 'POST', body: JSON.stringify(payload) });
}

// True only on a local dev host, so dev-only affordances never render in prod.
export function isLocalDev(): boolean {
  if (typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

// ── /session/start with paywall awareness ──

export interface StartSessionArgs {
  user_id: string;
  competency_node: string;
  test_mode?: boolean;
  confirm?: boolean;
}

// 2xx -> { ok: true, session_id, … }; HTTP 402 -> { ok: false, paywall };
// any other non-2xx throws (mirrors apiFetch's surfacing of `detail`).
export type StartSessionResult =
  | {
      ok: true;
      session_id: string;
      node_title: string;
      first_message: string;
      current_mastery: number;
    }
  | { ok: false; paywall: PaywallDetail };

export async function startSessionWithPaywall(
  args: StartSessionArgs
): Promise<StartSessionResult> {
  const token = getToken();
  const response = await fetch('/api/session/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      user_id: args.user_id,
      competency_node: args.competency_node,
      test_mode: args.test_mode ?? false,
      confirm: args.confirm ?? false,
    }),
  });

  if (response.status === 402) {
    const body = await response.json().catch(() => ({}));
    // FastAPI wraps the raised detail under `detail`.
    const detail = body?.detail as PaywallDetail | undefined;
    if (detail && typeof detail === 'object' && 'error' in detail) {
      return { ok: false, paywall: detail };
    }
    // Defensive: a 402 without the expected structured detail.
    throw new Error(
      typeof body?.detail === 'string' ? body.detail : 'Payment required'
    );
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API Error: ${response.status}`);
  }

  const data = await response.json();
  return { ok: true, ...data };
}
