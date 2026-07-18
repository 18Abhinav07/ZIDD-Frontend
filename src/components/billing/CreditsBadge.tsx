"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { LightningBoltIcon } from '@radix-ui/react-icons';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAppSession } from '@/components/shared/AppSessionProvider';
import { isBetaBillingDisabled } from '@/lib/publicConfig.mjs';
import { PacksModal } from './PacksModal';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface CreditsBadgeHandle {
  refresh: () => void;
}

interface CreditsBadgeProps {
  className?: string;
  refreshOnMount?: boolean;
}

// Compact wallet pill. Shows the live credit balance (∞ when demo_unlimited);
// clicking opens the PacksModal. Parents can grab a ref and call refresh() after
// a gated action spends credits. The badge also self-refreshes after a purchase.
export const CreditsBadge = forwardRef<CreditsBadgeHandle, CreditsBadgeProps>(
  function CreditsBadge({ className, refreshOnMount = false }, ref) {
    const { balance, loadingBalance, loadBalance } = useAppSession();
    const billingDisabled = isBetaBillingDisabled();
    const [packsOpen, setPacksOpen] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const hasLoadedOnMountRef = useRef(false);

    const refresh = useCallback(() => {
      if (billingDisabled) return;
      setLoadFailed(false);
      loadBalance(true)
        .then(() => setLoadFailed(false))
        .catch(() => {
          setLoadFailed(true);
        });
    }, [billingDisabled, loadBalance]);

    useEffect(() => {
      if (billingDisabled) return;
      const shouldForceRefresh = refreshOnMount && !hasLoadedOnMountRef.current;
      if (shouldForceRefresh) {
        hasLoadedOnMountRef.current = true;
      } else if (balance) {
        return;
      }
      setLoadFailed(false);
      loadBalance(shouldForceRefresh)
        .then(() => setLoadFailed(false))
        .catch(() => {
          setLoadFailed(true);
        });
    }, [balance, billingDisabled, loadBalance, refreshOnMount]);

    useImperativeHandle(ref, () => ({ refresh }), [refresh]);

    if (billingDisabled) return null;

    const unlimited = balance?.demo_unlimited === true;
    const label = unlimited ? '∞' : balance ? String(balance.credits) : '';
    const unavailable = loadFailed && !balance;
    const loading = loadingBalance && !balance && !unavailable;
    return (
      <>
        <button
          aria-label={unavailable
            ? 'Credit balance unavailable, retry'
            : unlimited
              ? 'Unlimited credits, open credit packs'
              : `${label} credits, open credit packs`}
          onClick={() => {
            if (unavailable) {
              refresh();
              return;
            }
            setPacksOpen(true);
          }}
          className={cn(
            'px-2.5 py-2 sm:px-4 rounded-full bg-white/60 backdrop-blur border shadow-sm flex items-center gap-1.5 sm:gap-2 text-slate-800 transition-all hover:bg-white active:scale-95',
            unavailable ? 'border-amber-300/70' : 'border-slate-200/50',
            className
          )}
          title={unavailable ? 'Credit balance unavailable — retry' : unlimited ? 'Unlimited credits (demo)' : 'Credit balance'}
        >
          <LightningBoltIcon className="text-accent w-4 h-4" />
          {loading ? (
            <span className="inline-block w-4 h-3 rounded bg-slate-200 animate-pulse align-middle" />
          ) : unavailable ? (
            <span className="text-sm font-black font-mono leading-none text-amber-700">!</span>
          ) : (
            <span className="text-sm font-bold font-mono leading-none">{label}</span>
          )}
          {!unlimited && (
            <span className="hidden text-[11px] uppercase tracking-widest font-bold text-slate-600 leading-none sm:inline">
              credits
            </span>
          )}
          <span className="sr-only">
            {unavailable
              ? ', credit balance unavailable, retry'
              : loading
                ? ', loading credit balance, open credit packs'
                : unlimited
                  ? ', unlimited credits, open credit packs'
                  : ', open credit packs'}
          </span>
        </button>

        <PacksModal
          open={packsOpen}
          onClose={() => setPacksOpen(false)}
          onPurchased={refresh}
        />
      </>
    );
  }
);
