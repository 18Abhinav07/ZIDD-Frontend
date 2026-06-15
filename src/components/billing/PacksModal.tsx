"use client";

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cross2Icon, LightningBoltIcon } from '@radix-ui/react-icons';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { PackInfo } from '@/types';
import { getPacks, createOrder } from '@/services/billing';
import { loadRazorpay, openCheckout } from '@/lib/razorpay';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PacksModalProps {
  open: boolean;
  onClose: () => void;
  // Fired after a checkout completes. `granted` is true only when the webhook
  // grant was confirmed (credits rose); false when payment was captured but the
  // grant is not yet visible. Callers refresh balance always, but should only
  // retry a gated action when `granted` is true.
  onPurchased?: (granted: boolean) => void;
  // Optional pre-fetched packs (e.g. from a 402 insufficient_credits body) so
  // we skip a redundant getPacks() round-trip.
  initialPacks?: PackInfo[];
}

const formatPrice = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// Paise per credit — lower is better. Used to surface the best-value pack so the
// learner isn't left to do the arithmetic across three price points.
const perCreditPaise = (p: PackInfo) => (p.credits > 0 ? p.price_paise / p.credits : Infinity);
const formatPerCredit = (p: PackInfo) => `₹${(perCreditPaise(p) / 100).toFixed(2)}/credit`;

export function PacksModal({ open, onClose, onPurchased, initialPacks }: PacksModalProps) {
  const [packs, setPacks] = useState<PackInfo[]>(initialPacks ?? []);
  const [loading, setLoading] = useState(!initialPacks);
  const [error, setError] = useState('');
  const [buyingId, setBuyingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialPacks && initialPacks.length > 0) {
      setPacks(initialPacks);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getPacks()
      .then((p) => {
        if (!cancelled) setPacks(p);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load credit packs.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, initialPacks]);

  const handleBuy = async (pack: PackInfo) => {
    setError('');
    setBuyingId(pack.id);
    try {
      const order = await createOrder(pack.id);
      await loadRazorpay();
      const granted = await openCheckout(order);
      onPurchased?.(granted);
      if (granted) {
        onClose();
      } else {
        // Payment captured but webhook grant not yet visible — let the learner
        // know it will appear shortly; balance refresh is already triggered.
        setError('Payment received. Credits will appear in a moment.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg !== 'Checkout dismissed') {
        setError('Purchase could not be completed. Please try again.');
      }
    } finally {
      setBuyingId(null);
    }
  };

  // Block close while a checkout is in flight: handleBuy is still awaiting
  // openCheckout, so unmounting now would setState on an unmounted modal (and
  // fire onClose/onPurchased after teardown). Re-enabled once buyingId clears.
  const handleClose = () => {
    if (buyingId !== null) return;
    onClose();
  };

  // The single best-value pack (lowest price per credit), highlighted with a
  // badge. Only meaningful when there's more than one pack to compare.
  const bestValueId =
    packs.length > 1
      ? packs.reduce((best, p) => (perCreditPaise(p) < perCreditPaise(best) ? p : best), packs[0]).id
      : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-md bg-white/90 backdrop-blur-xl rounded-[2rem] border border-slate-200/60 shadow-2xl p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleClose}
              className="absolute top-5 right-5 w-9 h-9 rounded-full bg-slate-50 border border-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-100 hover:text-slate-900 transition-all active:scale-95"
              aria-label="Close"
            >
              <Cross2Icon className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <LightningBoltIcon className="text-accent w-4 h-4" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">
                Credit Packs
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-5">
              Top up your wallet
            </h2>

            {loading ? (
              <div className="flex flex-col gap-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-[68px] bg-slate-50 rounded-[1.5rem] border border-slate-100 animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {packs.map((pack) => (
                  <div
                    key={pack.id}
                    className={cn(
                      "flex items-center justify-between gap-4 rounded-[1.25rem] border bg-white/70 backdrop-blur px-5 py-4 shadow-sm",
                      pack.id === bestValueId ? "border-emerald-200 ring-1 ring-emerald-100" : "border-slate-200/70"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {pack.title}
                        </p>
                        {pack.id === bestValueId && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[8px] font-black uppercase tracking-[0.12em] border border-emerald-100">
                            Best value
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] uppercase tracking-widest font-bold text-slate-400 mt-0.5">
                        {pack.credits} credits · {formatPerCredit(pack)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleBuy(pack)}
                      disabled={buyingId !== null}
                      className={cn(
                        'shrink-0 px-5 py-2.5 rounded-full text-xs font-bold tracking-wide transition-all active:scale-95',
                        'bg-accent text-white shadow-sm hover:opacity-90',
                        'disabled:opacity-40 disabled:cursor-not-allowed'
                      )}
                    >
                      {buyingId === pack.id ? 'Opening…' : formatPrice(pack.price_paise)}
                    </button>
                  </div>
                ))}
                {packs.length === 0 && (
                  <p className="text-center text-sm text-slate-400 py-8">
                    No packs available right now.
                  </p>
                )}
              </div>
            )}

            {error && (
              <p
                className={cn(
                  'mt-4 text-center text-[13px] leading-relaxed',
                  error.startsWith('Payment received')
                    ? 'text-emerald-600'
                    : 'text-rose-600'
                )}
              >
                {error}
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
