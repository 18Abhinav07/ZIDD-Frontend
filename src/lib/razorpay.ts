// Razorpay checkout integration. The checkout.js script is injected lazily and
// only once. The publishable key is NEVER hardcoded — it arrives as
// razorpay_key_id on the order response. Credits are granted server-side via
// the Razorpay webhook (async), so after the success handler fires we poll
// getBalance() until the wallet increases before resolving.
import type { OrderResponse } from '@/types';
import { getBalance, verifyPayment } from '@/services/billing';

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

// ── Minimal Razorpay typings (no `any`) ──
interface RazorpayHandlerResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: RazorpayHandlerResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
}

type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay: RazorpayConstructor;
  }
}

let loadPromise: Promise<void> | null = null;

export function loadRazorpay(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay can only load in the browser'));
  }
  if (window.Razorpay) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHECKOUT_SRC}"]`
    );
    if (existing) {
      // A previous call already injected the tag; wait for it (or detect ready).
      if (window.Razorpay) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => {
        // Mirror the fresh-inject branch: clear the cached promise so the NEXT
        // call retries. Otherwise this rejected promise is returned forever and
        // every later checkout attempt fails until a full page reload.
        loadPromise = null;
        reject(new Error('Failed to load Razorpay checkout'));
      });
      return;
    }
    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null; // allow a retry on the next call
      reject(new Error('Failed to load Razorpay checkout'));
    };
    document.body.appendChild(script);
  });

  return loadPromise;
}

export interface OpenCheckoutOptions {
  prefill?: { name?: string; email?: string; contact?: string };
  // Poll cadence for the webhook-driven credit grant.
  pollAttempts?: number;
  pollDelayMs?: number;
}

// Opens Razorpay checkout for `order`, then waits for the backend webhook to
// grant credits. Resolves true once the wallet balance has increased (credits
// confirmed) or after the poll budget is exhausted; rejects only if the learner
// dismisses the modal without paying.
export async function openCheckout(
  order: OrderResponse,
  opts: OpenCheckoutOptions = {}
): Promise<boolean> {
  const pollAttempts = opts.pollAttempts ?? 5;
  const pollDelayMs = opts.pollDelayMs ?? 1500;

  // Snapshot the wallet BEFORE opening checkout so the post-payment poll can
  // detect the webhook-driven grant as a strict increase. Awaiting here ensures
  // the baseline is settled before the (possibly fast) payment handler fires. On
  // a read failure we fall back to -Infinity so any real post-payment balance
  // still counts as an increase rather than the poll mis-firing on a stale value.
  let baseline = -Infinity;
  try {
    const b = await getBalance();
    baseline = b.credits;
  } catch {
    baseline = -Infinity;
  }

  return new Promise<boolean>((resolve, reject) => {
    let settled = false;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const pollForGrant = async () => {
      for (let i = 0; i < pollAttempts; i++) {
        await sleep(pollDelayMs);
        try {
          const bal = await getBalance();
          if (bal.demo_unlimited || bal.credits > baseline) {
            resolve(true);
            return;
          }
        } catch {
          // transient — keep polling
        }
      }
      // Webhook may still be in-flight; resolve so the caller can refresh + retry.
      resolve(false);
    };

    const rzp = new window.Razorpay({
      key: order.razorpay_key_id,
      order_id: order.order_id,
      amount: order.amount_paise,
      currency: 'INR',
      name: 'Zidd',
      description: `${order.credits} credits`,
      prefill: opts.prefill,
      theme: { color: '#4f46e5' },
      handler: (response: RazorpayHandlerResponse) => {
        if (settled) return;
        settled = true;
        // Verify the success server-side for an INSTANT grant (works on localhost
        // where the webhook can't reach us). Fall back to polling the webhook
        // grant if verify is unavailable/fails.
        void (async () => {
          try {
            const v = await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            if (v.granted || v.credits > baseline) {
              resolve(true);
              return;
            }
          } catch {
            // verify endpoint unavailable / signature mismatch — fall through.
          }
          void pollForGrant();
        })();
      },
      modal: {
        ondismiss: () => {
          if (settled) return;
          settled = true;
          reject(new Error('Checkout dismissed'));
        },
      },
    });
    rzp.open();
  });
}
