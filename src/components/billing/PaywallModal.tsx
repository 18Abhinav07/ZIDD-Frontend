"use client";

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Cross2Icon, LightningBoltIcon, LockClosedIcon } from '@radix-ui/react-icons';
import type { PaywallDetail } from '@/types';
import { billingScopeLabel } from '@/services/billing';
import { useAppSession } from '@/components/shared/AppSessionProvider';
import { PacksModal } from './PacksModal';

interface PaywallModalProps {
  // The structured 402 body from startSessionWithPaywall. null -> closed.
  paywall: PaywallDetail | null;
  onClose: () => void;
  // Re-run the gated action with confirm: true. Called when the learner confirms
  // a spend (confirm_required) or after they top up (insufficient_credits).
  // Throwing/rejecting is handled by the caller; this just triggers the retry.
  onConfirm: () => void | Promise<void>;
  // Called whenever a purchase grant lands, so the parent can refresh its badge.
  onBalanceChange?: () => void;
  // Disables the confirm button while the parent re-runs the session start.
  confirming?: boolean;
  // Caller-visible failure from the gated action. Kept in the modal so a
  // confirm timeout/error does not disappear behind the overlay.
  error?: string | null;
  purchasesEnabled?: boolean;
  allowConfirmation?: boolean;
}

const fmt = (n: number) => n.toLocaleString('en-IN');

export function PaywallModal({
  paywall,
  onClose,
  onConfirm,
  onBalanceChange,
  confirming = false,
  error = null,
  purchasesEnabled,
  allowConfirmation = true,
}: PaywallModalProps) {
  const { balance: walletBalance, me } = useAppSession();
  const purchasesAllowed = purchasesEnabled
    ?? walletBalance?.purchases_enabled
    ?? me?.purchases_enabled
    ?? false;
  const [packsOpen, setPacksOpen] = useState(false);
  const [slowConfirming, setSlowConfirming] = useState(false);
  // Portal the overlay to <body> so `position: fixed` is viewport-relative, not
  // trapped inside an ancestor with a transform/backdrop-filter (same fix as
  // PacksModal). Mount-gated for SSR safety.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const open = paywall !== null;
  const insufficient = paywall?.error === 'insufficient_credits';
  const cost = paywall?.cost ?? 0;
  const balance = paywall?.balance ?? 0;
  const shortfall = insufficient ? Math.max(0, cost - balance) : 0;
  const itemLabel = billingScopeLabel(paywall?.scope);
  useEffect(() => {
    if (!open || !confirming) {
      setSlowConfirming(false);
      return;
    }
    const timeout = window.setTimeout(() => setSlowConfirming(true), 8000);
    return () => window.clearTimeout(timeout);
  }, [confirming, open]);

  const handleClose = () => {
    if (!confirming) onClose();
  };

  return (
    <>
      {mounted && createPortal(
        <AnimatePresence>
        {open && !packsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[190] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto"
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
                disabled={confirming}
                className="absolute top-5 right-5 w-9 h-9 rounded-full bg-slate-50 border border-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-100 hover:text-slate-900 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-wait"
                aria-label="Close"
              >
                <Cross2Icon className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-1">
                <LockClosedIcon className="text-accent w-4 h-4" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">
                  {insufficient ? 'Not enough credits' : `Start ${itemLabel}`}
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-4">
                {insufficient
                  ? 'Top up to continue'
                  : `Start this ${itemLabel}`}
              </h2>

              {/* Cost / balance summary */}
              <div className="rounded-[1.25rem] border border-slate-200/70 bg-white/70 backdrop-blur px-5 py-4 shadow-sm mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LightningBoltIcon className="text-accent w-4 h-4" />
                  <span className="text-sm font-bold text-slate-900">{fmt(cost)} credits</span>
                </div>
                <span className="text-[11px] uppercase tracking-widest font-bold text-slate-400">
                  You have {fmt(balance)}
                </span>
              </div>

              {error && (
                <p className="mb-5 rounded-[1rem] border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold leading-relaxed text-red-600">
                  {error}
                </p>
              )}

              {insufficient ? (
                <>
                  <p className="text-sm text-slate-600 leading-relaxed mb-5">
                    You need{' '}
                    <span className="font-bold text-slate-900">{fmt(shortfall)} more</span>{' '}
                    credit{shortfall === 1 ? '' : 's'} to continue. Grab a pack, then
                    we&apos;ll start your session.
                  </p>
                  {purchasesAllowed ? (
                    <button
                      onClick={() => setPacksOpen(true)}
                      className="w-full px-5 py-3 rounded-full bg-accent text-white text-sm font-bold tracking-wide shadow-sm hover:opacity-90 transition-all active:scale-[0.98]"
                    >
                      Buy credits
                    </button>
                  ) : (
                    <p className="rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                      New credit packs are unavailable during beta. Your current balance stays visible in your wallet.
                    </p>
                  )}
                </>
              ) : allowConfirmation ? (
                <>
                  <p className="text-sm text-slate-600 leading-relaxed mb-5">
                    Starting this {itemLabel} spends{' '}
                    <span className="font-bold text-slate-900">{fmt(cost)} credits</span>. Continue?
                  </p>
                  {confirming && (
                    <div className="mb-5 rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-relaxed text-slate-600" aria-live="polite">
                      {slowConfirming
                        ? 'Still starting your session. We are checking the handoff so you are not charged twice.'
                        : 'Starting your session...'}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={handleClose}
                      disabled={confirming}
                      className="flex-1 px-5 py-3 rounded-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold tracking-wide hover:bg-slate-100 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void onConfirm()}
                      disabled={confirming}
                      className="flex-1 px-5 py-3 rounded-full bg-accent text-white text-sm font-bold tracking-wide shadow-sm hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {confirming ? 'Starting…' : 'Confirm & start'}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-600 leading-relaxed">
                  This {itemLabel} requires {fmt(cost)} credits. Your current balance is shown above.
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>,
        document.body
      )}

      {/* Top-up flow for the insufficient_credits branch. The packs come from the
          402 body so we avoid a redundant fetch. After a confirmed grant we close
          the packs sheet and retry the gated action with confirm: true. */}
      <PacksModal
        open={packsOpen}
        initialPacks={insufficient ? paywall.packs : undefined}
        purchasesEnabled={purchasesAllowed}
        onClose={() => setPacksOpen(false)}
        onPurchased={(granted) => {
          onBalanceChange?.();
          if (!granted) return;
          setPacksOpen(false);
          void onConfirm();
        }}
      />
    </>
  );
}
